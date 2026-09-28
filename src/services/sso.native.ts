import { Platform } from 'react-native';
import CookieManager from '@preeternal/react-native-cookie-manager';
import { getEnv } from '../config/env';
import { ssoLogin } from './auth';
import { extractSsoProfile, getSsoAppId, getSsoUrl } from './ssoProfile';
import { requestSsoLogin } from './ssoLoginRequest';
import type { SsoAuthResponse } from './types';

// iOS/Android: there are no popups or iframes, so the SSO login page runs in an
// in-app WebView (SsoLoginModal.native.tsx) in `mode=popup`, with a shimmed
// `window.opener` that forwards its postMessage to React Native. The SSO page then
// sets its session cookie exactly as it does in a browser popup, and fetch() picks
// it up for /auth/login. Web counterpart: sso.web.ts.

// Android's WebView and fetch share android.webkit.CookieManager. iOS keeps WKWebView
// cookies in a separate store from the one fetch (NSURLSession) uses, so copy them.
const syncWebViewCookies = async () => {
  if (Platform.OS !== 'ios') {
    return;
  }
  const urls = [getEnv('API_URL'), getSsoUrl()].filter(Boolean);
  for (const url of urls) {
    const cookies = await CookieManager.getAsArray(url, {
      iosCookieStore: 'webKit',
    });
    for (const cookie of cookies) {
      await CookieManager.set(url, cookie);
    }
  }
};

export const buildSsoLoginUrl = () =>
  `${getSsoUrl()}/login?mode=popup&app=${encodeURIComponent(getSsoAppId())}`;

// Shows the WebView login, then exchanges the SSO cookie for a YCT token.
export const openSsoLoginAndAuthenticate =
  async (): Promise<SsoAuthResponse> => {
    const ssoPayload = await requestSsoLogin(buildSsoLoginUrl());
    await syncWebViewCookies();
    const payload = await ssoLogin();
    return {
      data: { ...payload, sso_profile: extractSsoProfile(ssoPayload) },
    };
  };

// No iframe on native: an existing SSO cookie is enough for /auth/login to succeed,
// so just try the exchange. Rejects (HttpError 401) when there's no SSO session.
export const silentSsoAuthenticate = async (): Promise<SsoAuthResponse> => {
  await syncWebViewCookies();
  const payload = await ssoLogin();
  return { data: payload };
};

// Native has no full-page redirect fallback.
export const isReturningFromSsoRedirect = (): boolean => false;

// Clears the SSO session server-side, then drops local cookies so the WebView
// doesn't sign straight back in on the next login.
export const ssoLogout = async (): Promise<void> => {
  try {
    const res = await fetch(`${getSsoUrl()}/auth/logout`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      throw new Error(`SSO logout failed with status ${res.status}`);
    }
  } finally {
    await (Platform.OS === 'ios'
      ? CookieManager.clearAllStores()
      : CookieManager.clearAll());
  }
};
