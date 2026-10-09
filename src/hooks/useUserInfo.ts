import { useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { tokenAtom, userAtom } from '../atoms/auth';
import { userInfoAtom } from '../atoms/userInfo';
import { fetchUserInfo } from '../services/users';

// Loads the signed-in user's record once a session exists, clears it on sign-out.
export function useUserInfo() {
  const token = useAtomValue(tokenAtom);
  const userId = useAtomValue(userAtom)?.user_id;
  const setUserInfo = useSetAtom(userInfoAtom);

  useEffect(() => {
    if (!token || !userId) {
      setUserInfo(null);
      return;
    }
    let active = true;
    fetchUserInfo(token, userId)
      .then(info => active && setUserInfo(info))
      .catch(err => console.warn('Could not load user info:', err));
    return () => {
      active = false;
    };
  }, [token, userId, setUserInfo]);
}
