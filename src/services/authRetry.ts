import { HttpError } from './apiClient';
import { refreshAccessToken } from './authStore';

// Every call to Tasks-Main-API needs a valid access token, and the cached one can
// be stale — expired, or simply wrong the instant a refresh is in flight. Exactly
// one place used to handle that: authStore's own bootAuth, which notices a 401 on
// GET /auth/session and calls refreshAccessToken(). Nothing else did — every other
// hook (views, tasks, user info/search) fires with whatever token was in
// tokenAtom at render time, and if that happened to be the stale one, it just
// failed with its own 401 and sat there; nothing re-triggered it once the
// session refresh (started by that one unrelated call) actually finished. That's
// the burst of 401s alongside a single successful `refresh` call you'd see on a
// token that expired right as several things loaded at once.
//
// withAuthRetry is the fix, applied at every call site that takes a token
// (queryFn/mutationFn across the hooks, and ShareViewModal's direct call): try
// the real request; on a 401, call refreshAccessToken() (already singleflighted
// there, so concurrent callers share one refresh) and retry once with whatever
// token comes back. A null token coming in (signed out) or a second 401 (the
// refresh itself didn't fix it — a real auth failure) both just surface as the
// original error, same as before.
export async function withAuthRetry<T>(
  token: string | null | undefined,
  call: (token: string) => Promise<T>,
): Promise<T> {
  if (!token) {
    throw new HttpError(401, 'Not signed in');
  }
  try {
    return await call(token);
  } catch (err) {
    if (!(err instanceof HttpError) || err.status !== 401) {
      throw err;
    }
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      throw err;
    }
    return call(refreshed);
  }
}
