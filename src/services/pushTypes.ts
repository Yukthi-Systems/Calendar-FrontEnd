// Shared between push.web.ts / push.native.ts (and whatever reads
// onForegroundMessage) so neither platform file needs to import the other.
export interface PushMessage {
  title?: string;
  body?: string;
  // Whatever the server sent under "data" — e.g. a task id, so a tap could
  // one day open straight to it. Values are always strings (FCM's own data
  // payload rule, on every platform).
  data?: Record<string, string>;
}
