import { Platform } from 'react-native';

export interface InviteRouteParams {
  validationCode: string;
  taskId: number;
  inviteeEmail: string;
}

// `?d=<base64>` payload shape — base64(JSON({invite, task_id, email})). Not
// encryption (base64 is trivially reversible, e.g. browser devtools' own
// atob()) — it's only to keep the link's query string from showing a plain
// task id/e-mail at a glance (shoulder-surfing, browser history, a pasted
// screenshot). The real credential is still `invite` alone, same as before.
interface EncodedInvitePayload {
  invite: string;
  task_id: number;
  email: string;
}

// Frontend-ready for when Tasks-Main-API's invite e-mail switches to this
// format — it doesn't build invite links itself (the backend e-mails them),
// so until that change ships, every real link still arrives as the legacy
// `?invite=&task_id=&email=` query string below, and this just falls through
// to parsing that.
export const encodeInviteParam = (params: InviteRouteParams): string =>
  btoa(
    JSON.stringify({
      invite: params.validationCode,
      task_id: params.taskId,
      email: params.inviteeEmail,
    } satisfies EncodedInvitePayload),
  );

const decodeInviteParam = (encoded: string): InviteRouteParams | null => {
  try {
    const data = JSON.parse(atob(encoded)) as Partial<EncodedInvitePayload>;
    if (typeof data.invite !== 'string' || typeof data.email !== 'string') {
      return null;
    }
    const taskId = Number(data.task_id);
    if (!Number.isFinite(taskId)) {
      return null;
    }
    return { validationCode: data.invite, taskId, inviteeEmail: data.email };
  } catch {
    // Malformed/garbage `d` — not a valid encoded link.
    return null;
  }
};

// Detects an invite-response link (see EventInviteesSection.tsx /
// InviteResponseScreen.tsx) from the page's own query string — either the
// base64 `?d=<payload>` form above, or the legacy
// `?invite=<validation_code>&task_id=<id>&email=<address>` form. Web only:
// there's no deep-link handling for this on native yet, and the app has no
// other route concept to hang this off of (see App.tsx) — so it's a plain
// query string on the app's own root URL, not a path.
export function getInviteRouteParams(): InviteRouteParams | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }
  const params = new URLSearchParams(window.location.search);

  const encoded = params.get('d');
  if (encoded) {
    const decoded = decodeInviteParam(encoded);
    if (decoded) {
      return decoded;
    }
  }

  const validationCode = params.get('invite');
  const taskId = params.get('task_id');
  const inviteeEmail = params.get('email');
  if (!validationCode || !taskId || !inviteeEmail) {
    return null;
  }
  const numericTaskId = Number(taskId);
  if (!Number.isFinite(numericTaskId)) {
    return null;
  }
  return { validationCode, taskId: numericTaskId, inviteeEmail };
}
