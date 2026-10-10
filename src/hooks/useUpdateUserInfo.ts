import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAtomValue, useSetAtom } from 'jotai';
import { tokenAtom, userAtom } from '../atoms/auth';
import { userInfoAtom } from '../atoms/userInfo';
import { updateUserInfo } from '../services/users';
import type { UserInfoResponse } from '../services/types';

// POST /user/info/{is_public}, shared by every writer of public_info/private_info
// (ProfileEditModal's own fields, useSettingsSync's theme, useViewsSync's
// view-migration flag) so there's one place that updates the cache + atom
// consistently. The route replaces the whole object, so callers must merge onto
// `userInfoAtom`'s current value themselves before calling mutate.
export function useUpdateUserInfo() {
  const token = useAtomValue(tokenAtom);
  const userId = useAtomValue(userAtom)?.user_id;
  const setUserInfo = useSetAtom(userInfoAtom);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      isPublic,
      info,
    }: {
      isPublic: boolean;
      info: Record<string, unknown>;
    }) => {
      if (!token) {
        return Promise.reject(new Error('Not signed in'));
      }
      return updateUserInfo(token, isPublic, info);
    },
    onSuccess: (_void, { isPublic, info }) => {
      setUserInfo(prev =>
        prev
          ? {
              ...prev,
              ...(isPublic ? { public_info: info } : { private_info: info }),
            }
          : prev,
      );
      queryClient.setQueryData<UserInfoResponse>(['userInfo', userId], prev =>
        prev
          ? {
              ...prev,
              ...(isPublic ? { public_info: info } : { private_info: info }),
            }
          : prev,
      );
    },
  });
}
