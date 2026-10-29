import { Platform } from 'react-native';

export interface InviteRouteParams {
  validationCode: string;
  taskId: number;
  inviteeEmail: string;
}

// Detects an invite-response link (see EventInviteesSection.tsx /
// InviteResponseScreen.tsx) from the page's own query string —
// `?invite=<validation_code>&task_id=<id>&email=<address>`. Web only:
// there's no deep-link handling for this on native yet, and the app has no
// other route concept to hang this off of (see App.tsx) — so it's a plain
// query string on the app's own root URL, not a path.
export function getInviteRouteParams(): InviteRouteParams | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }
  const params = new URLSearchParams(window.location.search);
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
