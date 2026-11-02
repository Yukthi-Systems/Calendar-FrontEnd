// Background push delivery (tab closed/backgrounded) — must be a plain,
// un-bundled script at the site root (served here as /firebase-messaging-sw.js;
// copied into web-build/ by webpack.config.js's CopyWebpackPlugin), since the
// browser requests it directly, outside the webpack bundle. Uses the
// "compat" build via importScripts because a service worker can't use ES
// module imports the way src/services/push.web.ts does.
//
// The config below is the same, non-secret FIREBASE_* config push.web.ts reads
// from .env (see .env.example) — a service worker has no way to read
// window._env_ (env.web.ts's own runtime-config mechanism) at request time,
// so these are placeholders, not real values: env.sh fills them in from the
// container's FIREBASE_* env vars at container start (the same idea as
// env-config.js, just via sed on this file instead of a separate config
// file). A container started with any FIREBASE_* var unset gets that field
// blanked out instead — background push then fails to initialize until it's
// set. Local dev (`npm run web`) never runs env.sh, so this file is served
// with the placeholders as-is there; set up a local override if you need to
// test background push from dev.
importScripts('https://www.gstatic.com/firebasejs/13.1.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/13.1.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: '__FIREBASE_API_KEY__',
  authDomain: '__FIREBASE_AUTH_DOMAIN__',
  projectId: '__FIREBASE_PROJECT_ID__',
  storageBucket: '__FIREBASE_STORAGE_BUCKET__',
  messagingSenderId: '__FIREBASE_MESSAGING_SENDER_ID__',
  appId: '__FIREBASE_APP_ID__',
});

const messaging = firebase.messaging();

// Only reached for messages that arrive while no tab has focus — a
// `notification` payload (every Task Alert push has one) would otherwise be
// shown by the browser automatically; this exists mainly so Chrome doesn't
// log a "no handler" warning, and so the title/body are explicitly ours
// rather than left to the browser's default formatting.
messaging.onBackgroundMessage(payload => {
  console.log('[push] background message received:', payload);
  const title = payload.notification?.title ?? 'Task alert';
  self.registration.showNotification(title, {
    body: payload.notification?.body,
    data: payload.data,
  });
});

// Clicking the OS notification otherwise just dismisses it (the browser's own
// default) — bring the app to front instead, reusing an already-open tab
// when there is one. task_id/view_id are a best-effort read of the data
// payload: whatever service actually sends the push lives outside this repo
// (not Calendar-FrontEnd or Tasks-Main-API), so these field names are a
// guess at its shape, not a confirmed contract. When they're absent or don't
// match, this still brings the app to front — it just isn't pinned to one
// task (see useViewUrlSync.web.ts's `task` param for the other half of this).
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const data = event.notification.data || {};
  const taskId = data.task_id || data.taskId;
  const viewId = data.view_id || data.viewId;
  const params = new URLSearchParams();
  if (viewId) {
    params.set('mode', 'tasks');
    params.set('view', String(viewId));
  }
  if (taskId) {
    params.set('task', String(taskId));
  }
  const query = params.toString();
  const targetPath = query ? `/?${query}` : '/';
  const targetUrl = new URL(targetPath, self.location.origin).href;
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if ('focus' in client) {
            if (query && 'navigate' in client) {
              client.navigate(targetUrl).catch(() => {});
            }
            return client.focus();
          }
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});
