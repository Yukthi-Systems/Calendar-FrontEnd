// Type-check fallback only — Metro and webpack resolve Press.native.tsx /
// Press.web.tsx ahead of this file (same pattern as project/Tooltip.tsx).
export * from './Press.native';
export type { PressProps } from './Press.types';
