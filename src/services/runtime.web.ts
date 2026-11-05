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

// After a successful sign-out: everything this site keeps in localStorage, and
// every cookie it can see. A cookie has to be expired with the domain and path it
// was set on, which JS can't read, so each is tried on this host and its parents.
// HttpOnly cookies (SSO-Session-ID) can't be touched from here — the logout
// responses remove those.
export const clearDeviceData = async (): Promise<void> => {
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
  try {
    const parts = window.location.hostname.split('.');
    const domains = [
      '',
      ...parts
        .slice(0, -1)
        .map((_, i) => `;domain=${parts.slice(i).join('.')}`),
    ];
    const paths = [...new Set(['/', window.location.pathname])];
    document.cookie
      .split(';')
      .map(c => c.split('=')[0].trim())
      .filter(Boolean)
      .forEach(name =>
        domains.forEach(domain =>
          paths.forEach(path => {
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path}${domain}`;
          }),
        ),
      );
  } catch {
    /* ignore */
  }
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

// Any `logout=` — signed out by the user (`true`) or because the SSO session ended
// (`expired`); either way, don't sign straight back in automatically.
export const isAfterLogout = (): boolean =>
  new URLSearchParams(window.location.search).has('logout');

// Signed out because the SSO session ended (hourly check) — not by the user.
export const markSessionEnded = (): void => {
  window.location.search = 'logout=expired';
};

export const isSessionEnded = (): boolean =>
  new URLSearchParams(window.location.search).get('logout') === 'expired';

// After sign-in: drops query params left over from the SSO round trip / logout.
export const clearAuthReturnState = (): void => {
  if (window.location.search) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
};
