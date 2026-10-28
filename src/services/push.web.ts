import { initializeApp, type FirebaseOptions } from 'firebase/app';
import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type Messaging,
} from 'firebase/messaging';
import { getEnv } from '../config/env';
import type { PushMessage } from './pushTypes';

// Web push, via the Firebase JS SDK. Needs a registered service worker
// (web/firebase-messaging-sw.js, served at /firebase-messaging-sw.js — see
// webpack.config.js's CopyWebpackPlugin) for background delivery; foreground
// messages come through onMessage below instead, same as native's
// foreground-only onForegroundMessage.
//
// The modular SDK has no "token refreshed" event the way native's does —
// there's nothing to subscribe to, so onTokenRefresh here is a no-op. A
// fresh token is simply re-read (getPushToken) on every boot instead.

const firebaseConfig: FirebaseOptions = {
  apiKey: getEnv('FIREBASE_API_KEY'),
  authDomain: getEnv('FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('FIREBASE_APP_ID'),
  measurementId: getEnv('FIREBASE_MEASUREMENT_ID') || undefined,
};

let messagingPromise: Promise<Messaging | null> | null = null;

// Lazy + memoized: most sessions never touch push (signed out, or the
// browser can't support it), so nothing here runs until something actually
// asks for a token.
function getMessagingInstance(): Promise<Messaging | null> {
  if (!messagingPromise) {
    messagingPromise = (async () => {
      if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
        console.warn(
          'Push notifications are off: FIREBASE_* env vars are not set (see .env.example).',
        );
        return null;
      }
      if (!(await isSupported().catch(() => false))) {
        // Safari < 16.4, non-browser test environments, etc.
        return null;
      }
      const app = initializeApp(firebaseConfig);
      return getMessaging(app);
    })();
  }
  return messagingPromise;
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    return await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  } catch (err) {
    console.warn('Could not register the push service worker:', err);
    return null;
  }
}

export async function getPushToken(): Promise<string | null> {
  const vapidKey = getEnv('FIREBASE_VAPID_KEY');
  if (!vapidKey) {
    console.warn(
      'Push notifications are off: FIREBASE_VAPID_KEY is not set (Firebase console → Project settings → Cloud Messaging → Web Push certificates).',
    );
    return null;
  }
  const messaging = await getMessagingInstance();
  if (!messaging) {
    return null;
  }
  const registration = await registerServiceWorker();
  if (!registration) {
    return null;
  }
  try {
    return await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });
  } catch (err) {
    console.warn('Could not get a push token:', err);
    return null;
  }
}

// No modular-SDK equivalent on web — see header comment.
export function onTokenRefresh(_cb: (token: string) => void): () => void {
  return () => {};
}

export function onForegroundMessage(
  cb: (message: PushMessage) => void,
): () => void {
  let unsubscribe: (() => void) | undefined;
  let cancelled = false;
  getMessagingInstance().then(messaging => {
    if (!messaging || cancelled) {
      return;
    }
    unsubscribe = onMessage(messaging, payload => {
      cb({
        title: payload.notification?.title,
        body: payload.notification?.body,
        data: payload.data,
      });
    });
  });
  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}
