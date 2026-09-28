import {
  openLoginPopup,
  redirectToLogin,
  checkSilentAuth,
  ssoLogout as sdkSsoLogout,
  PopupBlockedError,
} from '@rjyspl/phoenix-sso-react';
import { ssoLogin } from './auth';
import { extractSsoProfile, getSsoAppId, getSsoUrl } from './ssoProfile';
import type { SsoAuthResponse } from './types';

// Web: popup + postMessage handshake via the Yukthi SSO SDK, same as YFS-FrontEnd.
// Native counterpart: sso.native.ts (in-app WebView).

// Added to the return URL after a blocked-popup redirect; the SSO cookie is already set on return.
export const SSO_REDIRECT_PARAM = 'sso_redirect';

// Exchanges the SSO cookie for a YCT token. Pass `ssoPayload` to skip re-running the silent check.
const completeSsoLogin = async (
  ssoPayload?: unknown,
): Promise<SsoAuthResponse> => {
  let profileSource = ssoPayload;
  if (profileSource === undefined) {
    try {
      profileSource = await checkSilentAuth(getSsoUrl(), getSsoAppId());
    } catch {
      profileSource = null; // best-effort; /auth/login is authoritative
    }
  }

  const payload = await ssoLogin();
  return {
    data: { ...payload, sso_profile: extractSsoProfile(profileSource) },
  };
};

// Popup login, falling back to a full-page redirect when blocked.
export const openSsoLoginAndAuthenticate =
  async (): Promise<SsoAuthResponse> => {
    const url = new URL(window.location.href);
    if (url.searchParams.get(SSO_REDIRECT_PARAM) === '1') {
      url.searchParams.delete(SSO_REDIRECT_PARAM);
      window.history.replaceState(
        {},
        document.title,
        `${url.pathname}${url.search}${url.hash}`,
      );
      return completeSsoLogin();
    }

    try {
      await openLoginPopup(getSsoUrl(), getSsoAppId(), {
        width: 500,
        height: 650,
      });
    } catch (err) {
      if (err instanceof PopupBlockedError) {
        const returnTo = new URL(window.location.href);
        returnTo.searchParams.set(SSO_REDIRECT_PARAM, '1');
        redirectToLogin(getSsoUrl(), getSsoAppId(), {
          returnTo: returnTo.toString(),
        });
        return new Promise<SsoAuthResponse>(() => {}); // page is navigating away
      }
      throw err;
    }

    return completeSsoLogin();
  };

// Exchanges an existing SSO session for a token via the hidden iframe; rejects when there's none.
export const silentSsoAuthenticate = async (): Promise<SsoAuthResponse> => {
  const ssoPayload = await checkSilentAuth(getSsoUrl(), getSsoAppId());
  return completeSsoLogin(ssoPayload);
};

// True right after a blocked-popup redirect brought the user back to the app.
export const isReturningFromSsoRedirect = (): boolean =>
  new URLSearchParams(window.location.search).get(SSO_REDIRECT_PARAM) === '1';

// Clears the SSO session cookies.
export const ssoLogout = (): Promise<void> => sdkSsoLogout(getSsoUrl());
