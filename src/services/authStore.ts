import { getDefaultStore } from 'jotai';
import {
  openSsoLoginAndAuthenticate,
  silentSsoAuthenticate,
  isReturningFromSsoRedirect,
  ssoLogout,
} from './sso';
import { apiLogout, fetchSession, refreshSession } from './auth';
import { HttpError } from './apiClient';
import {
  storage,
  sessionFlag,
  isAfterLogout,
  markLoggedOut,
  clearAuthReturnState,
} from './runtime';
import type { AuthPayload, BackendUserInfo, SsoProfile } from './types';
import {
  userAtom,
  tokenAtom,
  refreshTokenAtom,
  sessionExpiresAtAtom,
  persistedSessionAtom,
  isAuthLoadingAtom,
  authErrorMsgAtom,
  type UserInfo,
} from '../atoms/auth';

// Session singleton: SSO and token refresh, ported from YFS-FrontEnd. State lives in
// atoms/auth.ts; booted once from App.tsx.

const store = getDefaultStore();

const SESSION_KEY = 'ytc_session';

// Stops a failing auto-SSO from looping; cleared on successful sign-in or explicit logout.
export const AUTO_SSO_ATTEMPTED_KEY = 'ytc_sso_auto_attempted';

// Reads the persisted session into the atoms, then keeps storage in step with them.
let persisting = false;
const hydrateSession = async () => {
  try {
    const raw = await storage.getItem(SESSION_KEY);
    if (raw) {
      const session = JSON.parse(raw);
      store.set(userAtom, session.user ?? null);
      store.set(tokenAtom, session.token ?? null);
      store.set(refreshTokenAtom, session.refreshToken ?? null);
      store.set(sessionExpiresAtAtom, session.sessionExpiresAt ?? null);
    }
  } catch {
    /* corrupt or unavailable — start signed out */
  }
  if (!persisting) {
    persisting = true;
    store.sub(persistedSessionAtom, persistSession);
  }
};

const persistSession = () => {
  const session = store.get(persistedSessionAtom);
  if (session.token) {
    storage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    storage.removeItem(SESSION_KEY);
  }
};

const stripUndefined = <T extends object>(obj: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>;

// /auth/refresh and /auth/session return a subset of user_info, so merge onto what we had.
const buildUser = (
  info: BackendUserInfo,
  profile: SsoProfile | undefined,
  prev: UserInfo | null,
): UserInfo => {
  const merged = { ...prev, ...info, ...stripUndefined(profile ?? {}) };
  const fullName = [merged.first_name, merged.last_name]
    .filter(Boolean)
    .join(' ');
  return { ...merged, username: fullName || info.email.split('@')[0] };
};

const persistPayload = (payload: AuthPayload) => {
  const expiresAt = payload.expires_in
    ? Date.now() + payload.expires_in * 1000
    : store.get(sessionExpiresAtAtom);

  store.set(tokenAtom, payload.access_token);
  store.set(
    refreshTokenAtom,
    payload.refresh_token ?? store.get(refreshTokenAtom),
  );
  store.set(
    userAtom,
    buildUser(payload.user_info, payload.sso_profile, store.get(userAtom)),
  );
  store.set(sessionExpiresAtAtom, expiresAt);
  sessionFlag.clear(AUTO_SSO_ATTEMPTED_KEY);
  scheduleProactiveRefresh();
};

const clearSession = () => {
  store.set(tokenAtom, null);
  store.set(refreshTokenAtom, null);
  store.set(userAtom, null);
  store.set(sessionExpiresAtAtom, null);
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
};

// Refresh ahead of expiry.
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
const REFRESH_SKEW_MS = 60_000;

const scheduleProactiveRefresh = () => {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }
  refreshTimer = null;
  const expiresAt = store.get(sessionExpiresAtAtom);
  if (!expiresAt) {
    return;
  }
  const delay = Math.max(0, expiresAt - Date.now() - REFRESH_SKEW_MS);
  refreshTimer = setTimeout(() => {
    refreshAccessToken();
  }, delay);
};

// Single-flight: concurrent 401s share one refresh.
let refreshInFlight: Promise<string | null> | null = null;

export const refreshAccessToken = (): Promise<string | null> => {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  const run = (async (): Promise<string | null> => {
    const curToken = store.get(tokenAtom);
    const curRefresh = store.get(refreshTokenAtom);
    const curEmail = store.get(userAtom)?.email;
    if (!curToken || !curRefresh || !curEmail) {
      clearSession();
      return null;
    }
    try {
      const payload = await refreshSession({
        refreshToken: curRefresh,
        accessToken: curToken,
        userEmail: curEmail,
      });
      persistPayload(payload);
      return payload.access_token;
    } catch (err) {
      console.warn('Session refresh failed, signing out:', err);
      clearSession();
      store.set(
        authErrorMsgAtom,
        'Your session has expired — please sign in again',
      );
      return null;
    }
  })();

  refreshInFlight = run;
  run.finally(() => {
    refreshInFlight = null;
  });
  return run;
};

// Runs once on start. A cached session renders immediately and is verified in the background.
export const bootAuth = async (signal: { cancelled: boolean }) => {
  await hydrateSession();
  if (signal.cancelled) {
    return;
  }

  const afterLogout = isAfterLogout();
  const returningFromRedirect = isReturningFromSsoRedirect();
  const cachedToken = store.get(tokenAtom);
  const hasCachedSession = !!cachedToken && !!store.get(userAtom);

  // Render the cached session (or the login screen) right away when there's nothing to wait for.
  store.set(
    isAuthLoadingAtom,
    !hasCachedSession && (returningFromRedirect || !afterLogout),
  );

  const trySilentLogin = async () => {
    try {
      const { data } = await silentSsoAuthenticate();
      if (!signal.cancelled) {
        persistPayload(data);
      }
    } catch {
      if (!signal.cancelled) {
        clearSession();
      }
    }
  };

  try {
    if (returningFromRedirect) {
      // Back from a full-page SSO redirect (web only); the cookie is set.
      try {
        const { data } = await openSsoLoginAndAuthenticate();
        if (!signal.cancelled) {
          persistPayload(data);
        }
      } catch (err) {
        console.warn('SSO redirect-return login failed:', err);
        if (!signal.cancelled) {
          clearSession();
          store.set(
            authErrorMsgAtom,
            err instanceof Error
              ? err.message
              : 'SSO sign-in could not be completed',
          );
        }
      }
    } else if (hasCachedSession) {
      scheduleProactiveRefresh();
      try {
        const info = await fetchSession(cachedToken!);
        if (!signal.cancelled) {
          store.set(userAtom, buildUser(info, undefined, store.get(userAtom)));
        }
      } catch (err) {
        if (signal.cancelled) {
          return;
        }
        if (
          err instanceof HttpError &&
          (err.status === 401 || err.status === 400)
        ) {
          const refreshed = await refreshAccessToken();
          if (!refreshed && !signal.cancelled && !afterLogout) {
            store.set(authErrorMsgAtom, null);
            await trySilentLogin();
          }
        } else {
          console.warn(
            'Could not verify cached session, keeping it for now:',
            err,
          );
        }
      }
    } else if (!afterLogout) {
      await trySilentLogin();
    }
  } finally {
    if (!signal.cancelled) {
      store.set(isAuthLoadingAtom, false);
    }
  }
};

export const loginWithSso = async () => {
  store.set(isAuthLoadingAtom, true);
  store.set(authErrorMsgAtom, null);
  try {
    const { data } = await openSsoLoginAndAuthenticate();
    persistPayload(data);
    clearAuthReturnState();
  } catch (err: unknown) {
    console.error('SSO authentication failed:', err);
    store.set(
      authErrorMsgAtom,
      err instanceof Error ? err.message : 'SSO Authentication failed',
    );
    throw err;
  } finally {
    store.set(isAuthLoadingAtom, false);
  }
};

// Tears down the YCT session, then the SSO session.
export const logout = async () => {
  store.set(isAuthLoadingAtom, true);
  const currentToken = store.get(tokenAtom);
  try {
    if (currentToken) {
      try {
        await apiLogout(currentToken);
      } catch (err) {
        console.error('YCT API logout failed', err);
      }
    }
    try {
      await ssoLogout();
    } catch (err) {
      console.error('SSO logout failed', err);
    }
  } finally {
    clearSession();
    sessionFlag.clear(AUTO_SSO_ATTEMPTED_KEY);
    markLoggedOut();
    store.set(isAuthLoadingAtom, false);
  }
};

export const clearError = () => store.set(authErrorMsgAtom, null);
