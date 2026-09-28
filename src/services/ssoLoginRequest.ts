import { getDefaultStore } from 'jotai';
import { ssoLoginRequestAtom } from '../atoms/ssoLogin';

// Native-only channel between sso.native.ts (which wants a Promise) and
// SsoLoginModal.native.tsx (which renders the WebView while ssoLoginRequestAtom is set).

const store = getDefaultStore();

// Resolves with the SSO_AUTH_SUCCESS payload; rejects on failure or cancel.
export const requestSsoLogin = (url: string): Promise<unknown> =>
  new Promise((resolve, reject) => {
    store
      .get(ssoLoginRequestAtom)
      ?.reject(new Error('SSO sign-in was restarted'));
    store.set(ssoLoginRequestAtom, { url, resolve, reject });
  });

export const settleSsoLogin = (
  result: { ok: true; payload: unknown } | { ok: false; error: Error },
) => {
  const req = store.get(ssoLoginRequestAtom);
  if (!req) {
    return;
  }
  store.set(ssoLoginRequestAtom, null);
  if (result.ok) {
    req.resolve(result.payload);
  } else {
    req.reject(result.error);
  }
};
