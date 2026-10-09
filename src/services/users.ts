import { apiRequest } from './apiClient';
import type { UserInfoResponse, UserSearchResult } from './types';

// GET /user/info/{user_id} — 403 for another organization, 404 when unknown.
export const fetchUserInfo = async (
  accessToken: string,
  userId: string,
): Promise<UserInfoResponse> => {
  const { data } = await apiRequest<UserInfoResponse>(
    `/user/info/${encodeURIComponent(userId)}`,
    { accessToken },
  );
  return data;
};

// POST /user/info/{is_public} — replaces the caller's whole public or private JSON object.
export const updateUserInfo = async (
  accessToken: string,
  isPublic: boolean,
  info: Record<string, unknown>,
): Promise<void> => {
  await apiRequest(`/user/info/${isPublic}`, {
    method: 'POST',
    accessToken,
    body: JSON.stringify(info),
    parseJson: false,
  });
};

// GET /user/search — email substring match within the caller's organization (max 10).
// The API's `Query<String>` extractor wants the raw query string as the value.
export const searchUsersByEmail = async (
  accessToken: string,
  query: string,
): Promise<UserSearchResult[]> => {
  const { data } = await apiRequest<UserSearchResult[]>(
    `/user/search?q=${encodeURIComponent(query)}`,
    { accessToken },
  );
  return data;
};
