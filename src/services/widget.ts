// Type-check fallback only — widget.native.ts / widget.web.ts are what actually run
// (see src/config/env.ts for why this bare file exists). Both export the same API.
export * from './widget.native';
