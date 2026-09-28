import { getEnv } from '../config/env';
import type { SsoProfile } from './types';

// App identifier registered with the Yukthi SSO service.
export const getSsoAppId = () => getEnv('SSO_APP_ID');
export const getSsoUrl = () => getEnv('SSO_URL').replace(/\/$/, '');

// Field names vary, so read snake_case and camelCase, one level deep.
export const extractSsoProfile = (message: unknown): SsoProfile => {
  const data = (message ?? {}) as Record<string, unknown>;
  const source = {
    ...data,
    ...((data.payload as Record<string, unknown>) ?? {}),
    ...((data.user as Record<string, unknown>) ?? {}),
    ...((data.user_info as Record<string, unknown>) ?? {}),
    ...((data.profile as Record<string, unknown>) ?? {}),
  } as Record<string, unknown>;

  const str = (...keys: string[]): string | undefined => {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return undefined;
  };

  const methods = (): string[] | undefined => {
    const raw =
      source.two_factor_methods ??
      source.twoFactorMethods ??
      source.mfa_methods ??
      source['2fa_methods'] ??
      source.two_factor;
    if (Array.isArray(raw)) {
      return raw.map(m => String(m)).filter(Boolean);
    }
    if (raw && typeof raw === 'object') {
      return Object.entries(raw as Record<string, unknown>)
        .filter(([, enabled]) => Boolean(enabled))
        .map(([name]) => name);
    }
    if (typeof raw === 'string' && raw.trim()) {
      return raw.split(/[,\s]+/).filter(Boolean);
    }
    return undefined;
  };

  const fullName = str(
    'name',
    'full_name',
    'fullName',
    'display_name',
    'displayName',
  );
  const [derivedFirst, ...derivedRest] = fullName ? fullName.split(' ') : [];

  return {
    first_name:
      str('first_name', 'firstName', 'given_name', 'givenName') ?? derivedFirst,
    last_name:
      str('last_name', 'lastName', 'family_name', 'familyName', 'surname') ??
      (derivedRest.length ? derivedRest.join(' ') : undefined),
    phone: str(
      'phone',
      'phone_number',
      'phoneNumber',
      'primary_phone',
      'mobile',
      'mobile_number',
      'contact_number',
    ),
    two_factor_methods: methods(),
  };
};
