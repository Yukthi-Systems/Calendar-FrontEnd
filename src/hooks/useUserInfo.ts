import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAtomValue, useSetAtom } from 'jotai';
import { tokenAtom, userAtom } from '../atoms/auth';
import { userInfoAtom } from '../atoms/userInfo';
import { fetchUserInfo } from '../services/users';

// GET /user/info/{user_id} for the signed-in user, via TanStack Query. The result
// is bridged onto userInfoAtom so the rest of the app (profile, members, view sync,
// settings sync) keeps reading one plain atom rather than each needing its own
// useQuery — see App.tsx's header comment.
export function useUserInfo() {
  const token = useAtomValue(tokenAtom);
  const userId = useAtomValue(userAtom)?.user_id;
  const setUserInfo = useSetAtom(userInfoAtom);

  const query = useQuery({
    queryKey: ['userInfo', userId],
    queryFn: () => fetchUserInfo(token!, userId!),
    enabled: !!token && !!userId,
  });

  useEffect(() => {
    if (query.data) {
      setUserInfo(query.data);
    }
  }, [query.data, setUserInfo]);

  useEffect(() => {
    if (!token || !userId) {
      setUserInfo(null);
    }
  }, [token, userId, setUserInfo]);

  useEffect(() => {
    if (query.error) {
      console.warn('Could not load user info:', query.error);
    }
  }, [query.error]);
}
