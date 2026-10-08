import type { EnvKey } from './keys';

// Web: webpack.config.js's Dotenv plugin reads the git-ignored .env at build time and
// replaces process.env.<KEY> references with the literal value in the bundle — nothing
// is baked into source, but it IS baked into the built output, same as any client-side
// web app (there is no way to keep a value out of a browser bundle and still use it
// there; don't put anything here that must stay server-only). Resolved by webpack's
// extension order (env.web.ts beats the bare env.ts) whenever app code imports './env'.
//
// Dotenv only substitutes literal `process.env.KEY` expressions — a dynamic
// `process.env[key]` lookup is left alone and reads as empty in the browser — so every
// key must be spelled out here. Add new keys here too (the Record type enforces it).
const buildValues: Record<EnvKey, string | undefined> = {
  API_URL: process.env.API_URL,
  SSO_URL: process.env.SSO_URL,
  SSO_APP_ID: process.env.SSO_APP_ID,
};

// Docker deploys: env.sh writes /env-config.js (loaded by web/index.html) from the
// container's env at startup, so one image works for every environment. A non-empty
// runtime value wins over the build-time one.
declare global {
  interface Window {
    _env_?: Partial<Record<EnvKey, string>>;
  }
}

export const getEnv = (key: EnvKey): string =>
  window._env_?.[key] || buildValues[key] || '';
