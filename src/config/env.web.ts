import type { EnvKey } from './keys';

// Web: webpack.config.js's Dotenv plugin reads the git-ignored .env at build time and
// replaces process.env.<KEY> references with the literal value in the bundle — nothing
// is baked into source, but it IS baked into the built output, same as any client-side
// web app (there is no way to keep a value out of a browser bundle and still use it
// there; don't put anything here that must stay server-only). Resolved by webpack's
// extension order (env.web.ts beats the bare env.ts) whenever app code imports './env'.
export const getEnv = (key: EnvKey): string => {
  const value = typeof process !== 'undefined' ? process.env[key] : undefined;
  return (value as string | undefined) ?? '';
};
