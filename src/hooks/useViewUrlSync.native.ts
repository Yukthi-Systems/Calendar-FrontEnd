// No-op: there's no address bar on iOS/Android, and the last-open view already
// survives a relaunch via the local-storage persistence in projectStore.ts.
// Web counterpart: useViewUrlSync.web.ts.
export function useViewUrlSync() {}
