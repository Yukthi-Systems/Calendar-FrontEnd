import { getDefaultStore } from 'jotai';
import { tokenAtom } from '../atoms/auth';
import { toast } from '../atoms/feedback';
import { withAuthRetry } from './authRetry';
import { requestNotificationPermission } from './notifications';
import { getPushToken, onForegroundMessage, onTokenRefresh } from './push';
import { updateFcmToken } from './auth';

// Registers this device for push (Task Alerts' notify_via_push) once signed
// in: request the OS notification permission (shared with the local-reminder
// system — one OS-level toggle covers both), read the platform's FCM token,
// and hand it to the server (PATCH /auth/update-fcm-token) so it knows where
// to push alerts for this user. Re-sent whenever the platform SDK reports a
// refreshed token (native only has that event — see push.web.ts), and
// re-attempted on sign-in (not on every access-token refresh — see
// wasSignedIn below).

const store = getDefaultStore();
let booted = false;
let wasSignedIn = false;
let lastSentToken: string | null = null;

const sendToken = async (pushToken: string) => {
  if (pushToken === lastSentToken) {
    return;
  }
  const accessToken = store.get(tokenAtom);
  if (!accessToken) {
    return;
  }
  try {
    await withAuthRetry(accessToken, t => updateFcmToken(t, pushToken));
    lastSentToken = pushToken;
  } catch (err) {
    console.warn('Could not register this device for push notifications:', err);
  }
};

const registerDevice = async () => {
  const granted = await requestNotificationPermission();
  if (!granted) {
    return;
  }
  const pushToken = await getPushToken();
  if (pushToken) {
    await sendToken(pushToken);
  }
};

const checkAuth = () => {
  const signedIn = !!store.get(tokenAtom);
  if (signedIn && !wasSignedIn) {
    registerDevice();
  }
  wasSignedIn = signedIn;
};

export const bootPush = () => {
  if (booted) {
    return;
  }
  booted = true;
  checkAuth();
  store.sub(tokenAtom, checkAuth);
  onTokenRefresh(sendToken);
  // Also what actually arms onMessage() in push.web.ts/push.native.ts (and,
  // on native, Notifee's own system notification) — neither fires at all
  // until something subscribes here. Web has no OS-level foreground
  // notification of its own (that's the whole reason FCM calls onMessage out
  // instead of auto-displaying it, same as native — see push.native.ts's
  // header comment), so a toast is what makes the alert visible in the UI
  // there; shown on native too, alongside its system notification, so a push
  // that arrives while the app's already open and focused is never silent.
  onForegroundMessage(message => {
    console.log('[push] foreground message received:', message);
    toast.info(message.title || 'Task alert', { description: message.body });
  });
};
