import { apiRequest } from './apiClient';
import type {
  EventInviteeDto,
  InviteResponseStatus,
  PublicInviteInfoResponse,
} from './types';

// Tasks-Main-API /invites routes — per-task invitees by e-mail (they don't
// need an app account). Anyone who's the task's owner, assignee, or creator
// can invite/resend/list; only the owner or creator can remove one (see
// event_invitees::can_invite / can_delete_invite). The create/resend/delete
// bodies are the bare e-mail string, not an object — matches the routes'
// `web::Json<String>`.

export const createInvite = async (
  accessToken: string,
  viewId: number,
  taskId: number,
  inviteeEmail: string,
): Promise<void> => {
  await apiRequest(`/invites/create/${viewId}/${taskId}`, {
    method: 'POST',
    accessToken,
    body: JSON.stringify(inviteeEmail),
    parseJson: false,
  });
};

export const resendInvite = async (
  accessToken: string,
  viewId: number,
  taskId: number,
  inviteeEmail: string,
): Promise<void> => {
  await apiRequest(`/invites/resend/${viewId}/${taskId}`, {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify(inviteeEmail),
    parseJson: false,
  });
};

export const deleteInvite = async (
  accessToken: string,
  viewId: number,
  taskId: number,
  inviteeEmail: string,
): Promise<void> => {
  await apiRequest(`/invites/delete/${viewId}/${taskId}`, {
    method: 'DELETE',
    accessToken,
    body: JSON.stringify(inviteeEmail),
    parseJson: false,
  });
};

export const listInvitees = async (
  accessToken: string,
  viewId: number,
  taskId: number,
): Promise<EventInviteeDto[]> => {
  const { data } = await apiRequest<EventInviteeDto[]>(
    `/invites/list/${viewId}/${taskId}`,
    { accessToken },
  );
  return data;
};

// Tasks-Main-API's /public routes — no session: the validation code in the
// invitee's link (plus the task id and their own e-mail, both carried as
// query params) is the only credential checked.

export const getPublicInviteInfo = async (
  validationCode: string,
  taskId: number,
  inviteeEmail: string,
): Promise<PublicInviteInfoResponse> => {
  const { data } = await apiRequest<PublicInviteInfoResponse>(
    `/public/event/invite/info/${validationCode}?task_id=${taskId}&invitee_email=${encodeURIComponent(
      inviteeEmail,
    )}`,
  );
  return data;
};

export const respondToInvite = async (
  validationCode: string,
  taskId: number,
  inviteeEmail: string,
  response: { status: InviteResponseStatus; info: Record<string, unknown> },
): Promise<void> => {
  await apiRequest(
    `/public/event/invite/${validationCode}?task_id=${taskId}&invitee_email=${encodeURIComponent(
      inviteeEmail,
    )}`,
    {
      method: 'POST',
      body: JSON.stringify({
        response_status: response.status,
        response_info: response.info,
      }),
      parseJson: false,
    },
  );
};
