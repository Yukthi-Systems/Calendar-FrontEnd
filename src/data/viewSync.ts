import {
  BACKEND_STATUS,
  BACKEND_TAG,
  STATUS_FROM_BACKEND,
  TAG_FROM_BACKEND,
} from './constants';
import type { ProjectView, ViewField, ViewType } from './types';
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
const FIELD_KEYS: string[] = ['status', 'assignee', 'start', 'end'];
const isViewType = (v: unknown): v is ViewType =>
  typeof v === 'string' && (VIEW_TYPES as string[]).includes(v);

export function viewFromServer(dto: TaskViewDbDto, shared = false): ProjectView {
  const ui = (dto.ui_info ?? {}) as { type?: unknown; fields?: unknown };
  return {
    id: String(dto.view_id),
    ownerId: dto.owner_id,
    shared,
    name: dto.view_name,
    type: isViewType(ui.type) ? ui.type : 'table',
    description: dto.description || undefined,
    fields: Array.isArray(ui.fields)
      ? (ui.fields as string[]).filter((f): f is ViewField => FIELD_KEYS.includes(f))
      : undefined,
    statusFilter: dto.status_filter
      .map(s => STATUS_FROM_BACKEND[s])
      .filter(Boolean),
    tagFilter: dto.task_tag_filter.map(t => TAG_FROM_BACKEND[t]).filter(Boolean),
    showRecurring: dto.show_recurring,
    showComments: dto.show_comments,
    showSubtasks: dto.show_subtasks,
    showAssigned: dto.show_assigned,
  };
}

export function viewToCreatePayload(
  view: Omit<ProjectView, 'id' | 'ownerId' | 'shared'>,
): CreateTaskViewPayload {
  return {
    view_name: view.name,
    description: view.description ?? '',
    ui_info: { type: view.type, fields: view.fields ?? null },
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
