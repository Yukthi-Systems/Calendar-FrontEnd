import { getDefaultStore } from 'jotai';
import { tokenAtom } from '../atoms/auth';
import { withAuthRetry } from './authRetry';
import { requestNotificationPermission } from './notifications';
import { getPushToken, onTokenRefresh } from './push';
import { updateFcmToken } from './users';

// Registers this device for push (Task Alerts' notify_via_push) once signed
// in: request the OS notification permission (shared with the local-reminder
// system — one OS-level toggle covers both), read the platform's FCM token,
// and hand it to the server (PATCH /user/update-fcm-token) so it knows where
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
};
