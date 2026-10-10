import { BACKEND_STATUS, STATUS_FROM_BACKEND } from './constants';
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

const VIEW_TYPES: ViewType[] = ['table', 'team', 'kanban', 'roadmap', 'calendar'];
const isViewType = (v: unknown): v is ViewType =>
  typeof v === 'string' && (VIEW_TYPES as string[]).includes(v);

export function viewFromServer(dto: TaskViewDbDto): ProjectView {
  const ui = (dto.ui_info ?? {}) as { type?: unknown; fields?: unknown };
  return {
    id: String(dto.view_id),
    name: dto.view_name,
    type: isViewType(ui.type) ? ui.type : 'kanban',
    description: dto.description || undefined,
    fields: Array.isArray(ui.fields) ? (ui.fields as ViewField[]) : undefined,
    statusFilter: dto.status_filter
      .map(s => STATUS_FROM_BACKEND[s])
      .filter(Boolean),
    showRecurring: dto.show_recurring,
    showComments: dto.show_comments,
    showSubtasks: dto.show_subtasks,
    showAssigned: dto.show_assigned,
  };
}

export function viewToCreatePayload(
  view: Omit<ProjectView, 'id'>,
): CreateTaskViewPayload {
  return {
    view_name: view.name,
    description: view.description ?? '',
    ui_info: { type: view.type, fields: view.fields ?? null },
    status_filter: (view.statusFilter ?? []).map(s => BACKEND_STATUS[s]),
    show_recurring: view.showRecurring ?? false,
    show_comments: view.showComments ?? false,
    show_subtasks: view.showSubtasks ?? false,
    show_assigned: view.showAssigned ?? false,
  };
}

export function viewToUpdatePayload(view: ProjectView): UpdateTaskViewPayload {
  return { view_id: Number(view.id), ...viewToCreatePayload(view) };
}

// Server-backed views have the server's numeric view_id as their string id;
// anything else (the built-in defaults, or a view made while signed out) is
// local-only and has no row to PATCH/DELETE.
export const isServerViewId = (id: string) => /^\d+$/.test(id);
