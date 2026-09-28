// Type-check fallback only — runtime.native.ts / runtime.web.ts are what actually run
// (see src/config/env.ts for why this bare file exists). Both export the same API.
export * from './runtime.native';
