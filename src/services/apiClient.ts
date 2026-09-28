import { getEnv } from '../config/env';

// Header the API expects the short-lived access token in (see YCT-Mesh-API middleware/auth.rs).
export const SESSION_HEADER = 'x-session-access-id';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export interface ApiRequestOptions extends Omit<RequestInit, 'headers'> {
  // Omit for unauthenticated calls.
  accessToken?: string | null;
  headers?: Record<string, string>;
  // Parse and return the JSON body. When false, `data` is undefined.
  parseJson?: boolean;
}

export interface ApiResult<T> {
  data: T;
  // Selected response headers the callers care about (lower-cased keys).
  headers: Record<string, string>;
  status: number;
}

const EXPOSED_HEADERS = ['x-refresh-id-token', 'x-session-expiry'];

export const getApiUrl = (path: string) =>
  `${getEnv('API_URL').replace(/\/$/, '')}/${path.replace(/^\//, '')}`;

// Every YCT-Mesh-API call. Credentials are included so the SSO cookie rides along
// (web: browser cookie jar; native: the platform cookie store fetch shares).
export async function apiRequest<T = unknown>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiResult<T>> {
  const { accessToken, headers = {}, parseJson = true, ...init } = options;

  const finalHeaders: Record<string, string> = {
    accept: 'application/json',
    ...headers,
  };
  if (accessToken) {
    finalHeaders[SESSION_HEADER] = accessToken;
  }
  if (
    init.body !== undefined &&
    !('content-type' in finalHeaders) &&
    !('Content-Type' in finalHeaders)
  ) {
    finalHeaders['content-type'] = 'application/json';
  }

  const res = await fetch(getApiUrl(path), {
    credentials: 'include',
    ...init,
    headers: finalHeaders,
  });

  const pickedHeaders: Record<string, string> = {};
  for (const key of EXPOSED_HEADERS) {
    const value = res.headers.get(key);
    if (value !== null) {
      pickedHeaders[key] = value;
    }
  }

  if (!res.ok) {
    // Errors are `{ "error": "<message>" }` or plain text.
    let message = '';
    try {
      const text = await res.text();
      try {
        const parsed = JSON.parse(text);
        message = typeof parsed?.error === 'string' ? parsed.error : text;
      } catch {
        message = text;
      }
    } catch {
      /* body unavailable */
    }
    throw new HttpError(
      res.status,
      message ||
        `${init.method || 'GET'} ${path} failed with status ${res.status}`,
    );
  }

  let data = undefined as T;
  if (parseJson) {
    const text = await res.text();
    data = (text ? JSON.parse(text) : undefined) as T;
  }

  return { data, headers: pickedHeaders, status: res.status };
}
