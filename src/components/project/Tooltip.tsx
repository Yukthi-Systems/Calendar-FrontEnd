// Type-check fallback only. Metro (mobile) and webpack (web) both resolve platform-
// suffixed files ahead of this bare one — Tooltip.native.tsx / Tooltip.web.tsx are
// what actually run; this file exists purely so `tsc` (and editors) can resolve
// `import './Tooltip'` without needing to understand Metro's platform-extension
// convention. Re-exports the native (no-op) implementation.
export * from './Tooltip.native';
