export type Shortcuts = Record<string, () => void>;

// No-op on iOS/Android. Web counterpart: useShortcuts.web.ts.
export function useShortcuts(_map: Shortcuts) {}
