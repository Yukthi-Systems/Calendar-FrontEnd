// `user_info` from YCT-Mesh-API. /auth/login returns every field; /auth/refresh and
// /auth/session return a subset, so callers merge onto the previous value.
export interface BackendUserInfo {
  email: string;
  domain_name?: string;
  organization_id?: string;
  organization_name?: string;
  enable_file_sharing?: boolean;
  file_size_limit_mb?: number;
  enable_group_chat?: boolean;
  enable_direct_chat?: boolean;
  quota_allocated?: number;
  quota_utilized?: number;
}

// Optional profile fields the SSO service may hand back alongside a login.
export interface SsoProfile {
  first_name?: string;
  last_name?: string;
  phone?: string;
  two_factor_methods?: string[];
}

export interface AuthPayload {
  access_token: string;
  refresh_token?: string;
  // Seconds until the access token expires.
  expires_in?: number;
  user_info: BackendUserInfo;
  sso_profile?: SsoProfile;
}

export interface SsoAuthResponse {
  data: AuthPayload;
}
