// Type-check fallback only. Metro (mobile) and webpack (web) both resolve platform-
// suffixed files ahead of this bare one — useViewUrlSync.native.ts / .web.ts are
// what actually run; this file exists purely so `tsc` (and editors) can resolve
// `import './useViewUrlSync'` without needing to understand Metro's platform-
// extension convention. Re-exports the native (no-op) implementation.
export * from './useViewUrlSync.native';
