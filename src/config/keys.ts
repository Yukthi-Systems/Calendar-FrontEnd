// The one place every runtime-configurable value (API URLs, feature flags, anything
// that differs between environments) gets named. Add new keys here, in .env.example
// (with a placeholder — never a real value), and nowhere else.
//
// This repo is PUBLIC. Nothing in this file is a secret — it's just the list of names.
// The actual values live in a local, git-ignored `.env` (mobile: read via
// react-native-config; web: injected at build time by webpack.config.js's Dotenv
// plugin). See README.md's "Environment & secrets" section before adding a key.
export type EnvKey =
  | 'API_URL'
  | 'SSO_URL'
  | 'SSO_APP_ID'
  // Firebase Cloud Messaging (push notifications) — web SDK only; native
  // (iOS/Android) auto-configures from GoogleService-Info.plist /
  // google-services.json instead (git-ignored, not env vars — see
  // README.md), so only push.web.ts reads these. The values themselves
  // aren't secrets (Firebase's own docs: they identify the project, they
  // don't authorize access — that's Security Rules' job), but
  // FIREBASE_VAPID_KEY is still local config, not something to hardcode.
  | 'FIREBASE_API_KEY'
  | 'FIREBASE_AUTH_DOMAIN'
  | 'FIREBASE_PROJECT_ID'
  | 'FIREBASE_STORAGE_BUCKET'
  | 'FIREBASE_MESSAGING_SENDER_ID'
  | 'FIREBASE_APP_ID'
  | 'FIREBASE_MEASUREMENT_ID'
  // Web Push certificate key pair (Firebase Console → Project settings →
  // Cloud Messaging → Web Push certificates) — required by getToken() on
  // web; there's no equivalent on native. Not set yet (no value was ever
  // generated) — push.web.ts logs a warning and no-ops until it is.
  | 'FIREBASE_VAPID_KEY';
