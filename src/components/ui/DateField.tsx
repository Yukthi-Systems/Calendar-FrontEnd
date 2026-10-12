// Type-check fallback only — Metro and webpack resolve DateField.native.tsx /
// DateField.web.tsx ahead of this file (same pattern as project/Tooltip.tsx).
export * from './DateField.native';
export type { DateFieldProps } from './DateField.types';
