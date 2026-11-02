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
// The query param is `email` (a `SearchQuery { email: String }` struct) — it used
// to be a bare `web::Query<String>`, which 400'd on every call ("invalid type:
// map, expected a string": a query string always parses as a map, even a single
// `?q=x`, so it could never bind to a bare String). Fixed server-side by giving it
// a proper struct; `email` is that struct's field name, not a renamed `q`.
export const searchUsersByEmail = async (
  accessToken: string,
  query: string,
): Promise<UserSearchResult[]> => {
  const { data } = await apiRequest<UserSearchResult[]>(
    `/user/search?email=${encodeURIComponent(query)}`,
    { accessToken },
  );
  return data;
};
