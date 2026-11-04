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

// `e=` is base64url (or plain base64), usually unpadded — e.g.
// "aW52aXRlZUBleGFtcGxlLmNvbQ" → "invitee@example.com". Decoded as UTF-8 so a
// non-ASCII address survives. Encoding only, not encryption: no key involved.
const decodeBase64Email = (encoded: string): string | null => {
  try {
    const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
    const email = new TextDecoder('utf-8', { fatal: true })
      .decode(bytes)
      .trim();
    return email.includes('@') ? email : null;
  } catch {
    return null;
  }
};

const INVITE_PATH_RE =
  /^\/invite\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i;

// `/invite/{uuid}?t={task_id}&e={base64 email}` — the uuid is the
// validation code.
const parseInvitePath = (
  pathname: string,
  params: URLSearchParams,
): InviteRouteParams | null => {
  const match = INVITE_PATH_RE.exec(pathname);
  if (!match) {
    return null;
  }
  const taskId = Number(params.get('t'));
  const encodedEmail = params.get('e');
  if (!Number.isInteger(taskId) || taskId <= 0 || !encodedEmail) {
    return null;
  }
  const inviteeEmail = decodeBase64Email(encodedEmail);
  if (!inviteeEmail) {
    return null;
  }
  return { validationCode: match[1], taskId, inviteeEmail };
};

// Detects an invite-response link (see EventInviteesSection.tsx /
// InviteResponseScreen.tsx) from the page's URL, in order: the
// `/invite/{uuid}?t=&e=` path form, the base64 `?d=<payload>` form, or the
// legacy `?invite=<validation_code>&task_id=<id>&email=<address>` form. Web
// only: there's no deep-link handling for this on native yet. The path form
// needs the host to serve index.html for /invite/* (dev server's
// historyApiFallback already does).
export function getInviteRouteParams(): InviteRouteParams | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }
  const params = new URLSearchParams(window.location.search);

  const fromPath = parseInvitePath(window.location.pathname, params);
  if (fromPath) {
    return fromPath;
  }

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
