import { apiRequest } from './apiClient';
import type { AuthPayload, BackendUserInfo } from './types';

const expiryFrom = (headers: Record<string, string>) =>
  headers['x-session-expiry'] ? Number(headers['x-session-expiry']) : undefined;

// POST /auth/login — exchanges the SSO cookie for access and refresh tokens.
export const ssoLogin = async (): Promise<AuthPayload> => {
  const { data, headers } = await apiRequest<{
    access_token: string;
    user_info: BackendUserInfo;
  }>('/auth/login', { method: 'POST' });

  return {
    access_token: data.access_token,
    refresh_token: headers['x-refresh-id-token'],
    expires_in: expiryFrom(headers),
    user_info: data.user_info,
  };
};

// GET /auth/session — throws HttpError(401) when the session is invalid.
export const fetchSession = async (
  accessToken: string,
): Promise<BackendUserInfo> => {
  const { data } = await apiRequest<BackendUserInfo>('/auth/session', {
    accessToken,
  });
  return data;
};

// POST /auth/refresh — also needs the SSO cookie. The API reads only the two tokens.
export const refreshSession = async (params: {
  refreshToken: string;
  accessToken: string;
}): Promise<AuthPayload> => {
  const { data, headers } = await apiRequest<{
    access_token: string;
    user_info: BackendUserInfo;
  }>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({
      refresh_token: params.refreshToken,
      access_token: params.accessToken,
    }),
  });

  return {
    access_token: data.access_token,
    refresh_token: params.refreshToken,
    expires_in: expiryFrom(headers),
    user_info: data.user_info,
  };
};

// DELETE /auth/logout — tears down the YCT session only; SSO logout is separate.
export const apiLogout = async (accessToken: string): Promise<void> => {
  await apiRequest('/auth/logout', {
    method: 'DELETE',
    accessToken,
    parseJson: false,
  });
};

// PATCH /auth/update-fcm-token — registers this device's push token on the session.
export const updateFcmToken = async (
  accessToken: string,
  fcmToken: string,
): Promise<void> => {
  await apiRequest('/auth/update-fcm-token', {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify(fcmToken),
    parseJson: false,
  });
};
