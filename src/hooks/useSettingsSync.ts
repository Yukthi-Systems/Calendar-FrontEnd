import { useEffect, useRef } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { tokenAtom } from '../atoms/auth';
import { themeAtom } from '../atoms/theme';
import { userInfoAtom } from '../atoms/userInfo';
import { useUpdateUserInfo } from './useUpdateUserInfo';

// Keeps the theme in the user's `private_info.settings` (the API's open-schema
// JSON, written via POST /user/info/false through useUpdateUserInfo's TanStack
// mutation), so it follows the account across devices. The server copy is applied
// once per sign-in; after that local changes are pushed, debounced — a mutation
// doesn't debounce itself, so that part stays a plain timer around `.mutate`.
// `private_info` is replaced wholesale by the API, so we always merge onto the latest.
// Views used to live in this same `settings.views` blob; they now have their own
// backend rows (src/hooks/useViewsSync.ts) — `settings` keeps a `viewsMigrated`
// flag for that hook, which this one leaves untouched.
const PUSH_DELAY_MS = 800;

export function useSettingsSync() {
  const token = useAtomValue(tokenAtom);
  const info = useAtomValue(userInfoAtom);
  const [theme, setTheme] = useAtom(themeAtom);
  const updateUserInfo = useUpdateUserInfo();

  const appliedFor = useRef<string | null>(null);
  const lastSynced = useRef('');
  const infoRef = useRef(info);
  infoRef.current = info;

  // Apply the server theme the first time this user's record arrives.
  useEffect(() => {
    if (!info) {
      appliedFor.current = null;
      return;
    }
    if (appliedFor.current === info.user_id) {
      return;
    }
    appliedFor.current = info.user_id;
    const saved = info.private_info?.settings as
      | { theme?: Partial<typeof theme> }
      | undefined;
    if (!saved?.theme) {
      return;
    }
    const nextTheme = { ...theme, ...saved.theme };
    setTheme(nextTheme);
    lastSynced.current = JSON.stringify(nextTheme);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apply once per user
  }, [info?.user_id]);

  const snapshot = JSON.stringify(theme);

  // Push local changes.
  useEffect(() => {
    if (!token || !info || appliedFor.current !== info.user_id) {
      return;
    }
    if (snapshot === lastSynced.current) {
      return;
    }
    const timer = setTimeout(() => {
      const current = infoRef.current;
      if (!current) {
        return;
      }
      const prevSettings = (current.private_info?.settings ?? {}) as Record<
        string,
        unknown
      >;
      const privateInfo = {
        ...current.private_info,
        settings: { ...prevSettings, theme: JSON.parse(snapshot) },
      };
      updateUserInfo.mutate(
        { isPublic: false, info: privateInfo },
        {
          onSuccess: () => {
            lastSynced.current = snapshot;
          },
          onError: err => console.warn('Could not sync settings to server:', err),
        },
      );
    }, PUSH_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- info only gates on user id
  }, [snapshot, token, info?.user_id]);
}
