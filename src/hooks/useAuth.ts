import { useAtomValue } from 'jotai';
import {
  userAtom,
  tokenAtom,
  sessionExpiresAtAtom,
  isAuthLoadingAtom,
  authErrorMsgAtom,
} from '../atoms/auth';
import {
  loginWithSso,
  logout,
  clearError,
  refreshAccessToken,
} from '../services/authStore';

export type { UserInfo } from '../atoms/auth';

export const useAuth = () => {
  const user = useAtomValue(userAtom);
  const token = useAtomValue(tokenAtom);
  const isLoading = useAtomValue(isAuthLoadingAtom);
  const errorMsg = useAtomValue(authErrorMsgAtom);
  const sessionExpiresAt = useAtomValue(sessionExpiresAtAtom);

  return {
    user,
    token,
    isAuthenticated: !!token,
    isLoading,
    errorMsg,
    loginWithSso,
    logout,
    clearError,
    refreshAccessToken,
    sessionExpiresAt,
  };
};
