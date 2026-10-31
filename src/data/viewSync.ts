import {
  BACKEND_STATUS,
  BACKEND_TAG,
  STATUS_FROM_BACKEND,
  TAG_FROM_BACKEND,
} from './constants';
import { CALENDAR_FIELDS, TABLE_FIELDS } from './viewFields';
import type {
  ProjectView,
  TaskQuickFilter,
  ViewField,
  ViewType,
} from './types';
import type {
  CreateTaskViewPayload,
  TaskViewDbDto,
  UpdateTaskViewPayload,
} from '../services/types';

// Converts between this app's ProjectView and Tasks-Main-API's task_views row.
// The API has no `type`/`fields` columns — those are purely how this app draws a
// view, not what it means to the backend — so they ride in the open-schema
// `ui_info` JSON column instead.

const VIEW_TYPES: ViewType[] = ['table', 'kanban', 'roadmap', 'calendar'];
// Every field key any layout's "Fields shown" form can offer (see
// viewFields.ts) — read from there rather than hand-kept here, so a field
// added to that form doesn't silently get stripped back out on load.
const FIELD_KEYS: string[] = [...TABLE_FIELDS, ...CALENDAR_FIELDS].map(
  f => f.key,
);
const isViewType = (v: unknown): v is ViewType =>
  typeof v === 'string' && (VIEW_TYPES as string[]).includes(v);

// Loose shape check, not a deep enum validation — ui_info.filter is written
// only by this app (see TableView's persistFilter), so this just guards
// against a stale/missing shape, not a hostile payload.
function isQuickFilterShape(v: unknown): v is TaskQuickFilter {
  if (!v || typeof v !== 'object') {
    return false;
  }
  const f = v as Record<string, unknown>;
  return (
    Array.isArray(f.statuses) &&
    Array.isArray(f.tags) &&
    Array.isArray(f.assigneeIds) &&
    typeof f.dueFrom === 'string' &&
    typeof f.dueTo === 'string'
  );
}

// The {type, fields, filter} trio either ui_info shape can carry — a view's
// own (task_views.ui_info) or a shared viewer's own override
// (shared_views.ui_info, see applySharedUiInfo below). Each field is read
// independently and only present when it parses, so a partial/empty ui_info
// (every shared viewer's, until they've customized something) contributes
// nothing rather than clobbering whatever it's layered onto.
function uiInfoOverrides(uiInfo: Record<string, unknown> | null | undefined) {
  const ui = (uiInfo ?? {}) as {
    type?: unknown;
    fields?: unknown;
    filter?: unknown;
  };
  return {
    type: isViewType(ui.type) ? ui.type : undefined,
    fields: Array.isArray(ui.fields)
      ? (ui.fields as string[]).filter((f): f is ViewField =>
          FIELD_KEYS.includes(f),
        )
      : undefined,
    // Three states, not two: a real filter object; `null`, meaning
    // explicitly cleared (a shared viewer's own ui_info stores `filter: null`
    // when they clear their quick filter — see TableView's persist effect);
    // or `undefined`, meaning no opinion at all (key absent/invalid). A
    // shared viewer's explicit clear has to stay distinguishable from never
    // having customized anything, or applySharedUiInfo below can't tell "stay
    // empty" from "fall back to the owner's filter."
    quickFilter: isQuickFilterShape(ui.filter)
      ? ui.filter
      : ui.filter === null
      ? null
      : undefined,
  };
}

export function viewFromServer(
  dto: TaskViewDbDto,
  shared = false,
): ProjectView {
  const overrides = uiInfoOverrides(dto.ui_info);
  return {
    id: String(dto.view_id),
    ownerId: dto.owner_id,
    shared,
    name: dto.view_name,
    type: overrides.type ?? 'table',
    description: dto.description || undefined,
    fields: overrides.fields,
    statusFilter: dto.status_filter
      .map(s => STATUS_FROM_BACKEND[s])
      .filter(Boolean),
    tagFilter: dto.task_tag_filter
      .map(t => TAG_FROM_BACKEND[t])
      .filter(Boolean),
    showRecurring: dto.show_recurring,
    showComments: dto.show_comments,
    showSubtasks: dto.show_subtasks,
    showAssigned: dto.show_assigned,
    // A view's own ui_info has no "fall back to something else" layer above
    // it, so an explicit `null` and an absent/invalid filter mean the same
    // thing here: no filter.
    quickFilter: overrides.quickFilter ?? undefined,
  };
}

// Overlays a shared viewer's own saved ui_info (Tasks-Main-API's
// shared_views.ui_info, written through PATCH /shared/update-shared/{view_id}
// — see useViews.ts's useUpdateMySharedViewInfo) on top of the view the owner
// defined. Only the quick filter is ever written here today (TableView.tsx's
// filter popover) — type/fields stay the owner's, since editing a shared
// view's own definition isn't offered to anyone but the owner (see
// ViewMenuModal.tsx) — but every field is parsed the same way `viewFromServer`
// parses the owner's, so nothing has to change here if that ever does.
export function applySharedUiInfo(
  view: ProjectView,
  myUiInfo: Record<string, unknown> | null | undefined,
): ProjectView {
  const overrides = uiInfoOverrides(myUiInfo);
  return {
    ...view,
    type: overrides.type ?? view.type,
    fields: overrides.fields ?? view.fields,
    // `null` here means "I explicitly cleared my filter" — that has to win
    // outright, not fall back to the owner's filter the way "I never set an
    // override" (`undefined`) does, or clearing a shared view's filter would
    // silently restore the owner's the next time this view loads.
    quickFilter:
      overrides.quickFilter === null
        ? undefined
        : overrides.quickFilter ?? view.quickFilter,
  };
}

export function viewToCreatePayload(
  view: Omit<ProjectView, 'id' | 'ownerId' | 'shared'>,
): CreateTaskViewPayload {
  return {
    view_name: view.name,
    description: view.description ?? '',
    ui_info: {
      type: view.type,
      fields: view.fields ?? null,
      filter: view.quickFilter ?? null,
    },
    status_filter: (view.statusFilter ?? []).map(s => BACKEND_STATUS[s]),
    task_tag_filter: (view.tagFilter ?? []).map(t => BACKEND_TAG[t]),
    show_recurring: view.showRecurring ?? false,
    show_comments: view.showComments ?? false,
    show_subtasks: view.showSubtasks ?? true,
    show_assigned: view.showAssigned ?? false,
  };
}

export function viewToUpdatePayload(view: ProjectView): UpdateTaskViewPayload {
  return { view_id: Number(view.id), ...viewToCreatePayload(view) };
}
