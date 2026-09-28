// Web: localStorage for the persisted session, sessionStorage for per-tab flags, and
// the `?logout=true` query param as the post-logout marker (same as YFS-FrontEnd).
// Native counterpart: runtime.native.ts.

export const storage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

// Survives the blocked-popup redirect, but not a new tab.
export const sessionFlag = {
  get: (key: string): boolean => {
    try {
      return sessionStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  },
  set: (key: string): void => {
    try {
      sessionStorage.setItem(key, '1');
    } catch {
      /* ignore */
    }
  },
  clear: (key: string): void => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export const isAfterLogout = (): boolean =>
  new URLSearchParams(window.location.search).get('logout') === 'true';

// Full reload so no signed-in state survives.
export const markLoggedOut = (): void => {
  window.location.search = 'logout=true';
};

// After sign-in: drops query params left over from the SSO round trip / logout.
export const clearAuthReturnState = (): void => {
  if (window.location.search) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
};
