// Type-check fallback only — notifications.native.ts / notifications.web.ts are what
// actually run (see src/config/env.ts for why this bare file exists). Both export the
// same API.
export * from './notifications.native';
