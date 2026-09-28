// Type-check fallback only. Metro (mobile) and webpack (web) both resolve platform-
// suffixed files ahead of this bare one — env.native.ts / env.web.ts are what actually
// run; this file exists purely so `tsc` (and editors) can resolve `import './env'`
// without needing to understand Metro's platform-extension convention. Re-exports the
// native implementation since its type signature is identical to the web one's.
export * from './env.native';
