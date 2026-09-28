// The one place every runtime-configurable value (API URLs, feature flags, anything
// that differs between environments) gets named. Add new keys here, in .env.example
// (with a placeholder — never a real value), and nowhere else.
//
// This repo is PUBLIC. Nothing in this file is a secret — it's just the list of names.
// The actual values live in a local, git-ignored `.env` (mobile: read via
// react-native-config; web: injected at build time by webpack.config.js's Dotenv
// plugin). See README.md's "Environment & secrets" section before adding a key.
export type EnvKey = 'API_URL' | 'SSO_URL' | 'SSO_APP_ID';
