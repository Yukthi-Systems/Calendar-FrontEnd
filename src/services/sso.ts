// Type-check fallback only — sso.native.ts / sso.web.ts are what actually run (see
// src/config/env.ts for why this bare file exists). Both export the same API.
export * from './sso.native';
