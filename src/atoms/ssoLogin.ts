import { atom } from 'jotai';

// Native-only: the pending in-app SSO login. sso.native.ts sets it (via
// services/ssoLoginRequest.ts) and SsoLoginModal.native.tsx renders the WebView while
// it's non-null.
export interface SsoLoginRequest {
  url: string;
  resolve: (payload: unknown) => void;
  reject: (err: Error) => void;
}

export const ssoLoginRequestAtom = atom<SsoLoginRequest | null>(null);
