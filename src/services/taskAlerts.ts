import { apiRequest } from './apiClient';
import type { TaskAlertDto } from './types';

// Tasks-Main-API /alerts routes — entirely self-scoped (no view_id, no
// ownership/assignee checks server-side: "All alerts are associated only
// with self"). task_id is still per-route, since an alert belongs to one
// task; there's no "fetch one alert by id" route — alert_at is itself the
// identifier within (task_id, recipient), used as-is by edit/delete.

const LIST_PAGE_SIZE = 50;

// POST /alerts/create/{task_id} — 400 if alert_at isn't at least 5 minutes
// from now (server-side; see data/taskAlerts.ts for the matching client check).
export const createTaskAlert = async (
  accessToken: string,
  taskId: number,
  alert: { alertAt: string; notifyViaEmail: boolean; notifyViaPush: boolean },
): Promise<void> => {
  await apiRequest(`/alerts/create/${taskId}`, {
    method: 'POST',
    accessToken,
    body: JSON.stringify({
      alert_at: alert.alertAt,
      notify_via_email: alert.notifyViaEmail,
      notify_via_push: alert.notifyViaPush,
    }),
    parseJson: false,
  });
};

// PATCH /alerts/edit/{task_id} — current_alert_at identifies which alert;
// new_alert_at is the same 5-minutes-from-now rule as create.
export const editTaskAlert = async (
  accessToken: string,
  taskId: number,
  edit: {
    currentAlertAt: string;
    newAlertAt: string;
    notifyViaEmail: boolean;
    notifyViaPush: boolean;
  },
): Promise<void> => {
  await apiRequest(`/alerts/edit/${taskId}`, {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify({
      current_alert_at: edit.currentAlertAt,
      new_alert_at: edit.newAlertAt,
      notify_via_email: edit.notifyViaEmail,
      notify_via_push: edit.notifyViaPush,
    }),
    parseJson: false,
  });
};

// DELETE /alerts/delete/{task_id}
export const deleteTaskAlert = async (
  accessToken: string,
  taskId: number,
  alertAt: string,
): Promise<void> => {
  await apiRequest(`/alerts/delete/${taskId}`, {
    method: 'DELETE',
    accessToken,
    body: JSON.stringify({ alert_at: alertAt }),
    parseJson: false,
  });
};

// GET /alerts/list/{task_id} — this task's alerts only, soonest first.
export const listTaskAlerts = async (
  accessToken: string,
  taskId: number,
): Promise<TaskAlertDto[]> => {
  const { data } = await apiRequest<TaskAlertDto[]>(
    `/alerts/list/${taskId}?alert_at_ascending=true&offset=0&limit=${LIST_PAGE_SIZE}`,
    { accessToken },
  );
  return data;
};

// GET /alerts/list-all — every alert across every task, soonest first. Caps
// at LIST_PAGE_SIZE (the server's own max per page); no pagination UI yet —
// if that limit is ever actually hit, this quietly shows only the first
// page rather than everything.
export const listAllTaskAlerts = async (
  accessToken: string,
): Promise<TaskAlertDto[]> => {
  const { data } = await apiRequest<TaskAlertDto[]>(
    `/alerts/list-all?alert_at_ascending=true&offset=0&limit=${LIST_PAGE_SIZE}`,
    { accessToken },
  );
  return data;
};
