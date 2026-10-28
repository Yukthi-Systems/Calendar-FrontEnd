// Type-check fallback only — push.native.ts / push.web.ts are what actually
// run (see src/config/env.ts for why this bare file exists). Both export the
// same API: getPushToken, onTokenRefresh, onForegroundMessage.
export * from './push.native';
