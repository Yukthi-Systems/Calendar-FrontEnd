import { useEffect, useRef, useState } from 'react';
import { SSO_ENABLED } from '../config/features';
import { AUTO_SSO_ATTEMPTED_KEY } from '../services/authStore';
import { isAfterLogout, sessionFlag } from '../services/runtime';

// Auto-starts SSO at most once per session (web: tab, native: app launch), so a
// failure shows the login screen instead of looping.
export function useSsoAutoLogin({
  isAuthenticated,
  authLoading,
  loginWithSso,
  clearError,
}: {
  isAuthenticated: boolean;
  authLoading: boolean;
  loginWithSso: () => Promise<void>;
  clearError: () => void;
}) {
  const [ssoPending, setSsoPending] = useState(false);
  const startedRef = useRef(false);

  const isLogoutParam = isAfterLogout();

  useEffect(() => {
    if (!SSO_ENABLED || isAuthenticated || authLoading || isLogoutParam) {
      return;
    }
    if (startedRef.current || sessionFlag.get(AUTO_SSO_ATTEMPTED_KEY)) {
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      if (!active) {
        return;
      }
      startedRef.current = true;
      sessionFlag.set(AUTO_SSO_ATTEMPTED_KEY);
      try {
        setSsoPending(true);
        await loginWithSso();
      } catch (err) {
        console.warn('Auto SSO login was blocked or failed', err);
      } finally {
        if (active) {
          setSsoPending(false);
        }
      }
    }, 600);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isAuthenticated, authLoading, isLogoutParam, loginWithSso]);

  const handleManualLogin = async () => {
    try {
      setSsoPending(true);
      clearError();
      await loginWithSso();
    } catch (err) {
      console.error('Manual SSO login failed', err);
    } finally {
      setSsoPending(false);
    }
  };

  return { ssoPending, isLogoutParam, handleManualLogin };
}
