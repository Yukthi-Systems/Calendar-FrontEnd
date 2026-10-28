import {
  getMessaging,
  getToken,
  onMessage,
  onTokenRefresh as onTokenRefreshNative,
  registerDeviceForRemoteMessages,
  type Messaging,
  type RemoteMessage,
} from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import type { PushMessage } from './pushTypes';

// Native push, via React Native Firebase's modular API (mirrors the web
// SDK's shape almost exactly — getMessaging/getToken/onMessage/
// onTokenRefresh all take a Messaging instance as their first argument).
// Auto-configured from GoogleService-Info.plist / google-services.json at
// the native layer (not the FIREBASE_* env vars push.web.ts reads — those
// are web-only) — see README.md for what still needs adding there before
// this actually works.
//
// getMessaging() throws if no native Firebase app exists yet (i.e. before
// those config files are added), so it's resolved lazily here rather than
// at module scope — importing this file must never crash app startup just
// because push isn't configured yet.
//
// getToken/onTokenRefresh are deprecated in RNFirebase 27 in favor of FID
// registration (register/onRegistered) — but still functional, and the
// backend's fcm_token column expects exactly this kind of token, not a
// Firebase Installation ID, so this intentionally keeps using them.
//
// Background/killed-app delivery needs no code here: a push with a
// `notification` payload (every alert this app sends has one) is displayed
// by the OS automatically. index.js still registers a minimal
// setBackgroundMessageHandler, which RNFirebase expects to exist on Android
// regardless. Foreground delivery is the one case FCM never auto-displays
// (deliberately — the app is already open), so onForegroundMessage below
// shows it itself via Notifee, same library notifications.native.ts already
// uses for local reminders (a separate channel: this is push, not local).

const CHANNEL_ID = 'ytc-push';
let channelReady: Promise<void> | null = null;

function ensureChannel(): Promise<void> {
  if (!channelReady) {
    channelReady = notifee
      .createChannel({
        id: CHANNEL_ID,
        name: 'Task alerts',
        importance: AndroidImportance.HIGH,
      })
      .then(() => undefined);
  }
  return channelReady;
}

function getMessagingInstance(): Messaging | null {
  try {
    return getMessaging();
  } catch (err) {
    console.warn(
      'Push notifications are off: Firebase isn’t configured natively yet.',
      err,
    );
    return null;
  }
}

export async function getPushToken(): Promise<string | null> {
  const messaging = getMessagingInstance();
  if (!messaging) {
    return null;
  }
  try {
    // A no-op on Android; iOS needs it before getToken will resolve.
    await registerDeviceForRemoteMessages(messaging);
    return await getToken(messaging);
  } catch (err) {
    console.warn('Could not get a push token:', err);
    return null;
  }
}

export function onTokenRefresh(cb: (token: string) => void): () => void {
  const messaging = getMessagingInstance();
  return messaging ? onTokenRefreshNative(messaging, cb) : () => {};
}

export function onForegroundMessage(
  cb: (message: PushMessage) => void,
): () => void {
  const messaging = getMessagingInstance();
  if (!messaging) {
    return () => {};
  }
  return onMessage(messaging, async (remoteMessage: RemoteMessage) => {
    const title = remoteMessage.notification?.title;
    const body = remoteMessage.notification?.body;
    const data = remoteMessage.data as Record<string, string> | undefined;
    if (title || body) {
      await ensureChannel();
      await notifee.displayNotification({
        title,
        body,
        data,
        android: { channelId: CHANNEL_ID },
      });
    }
    cb({ title, body, data });
  });
}
