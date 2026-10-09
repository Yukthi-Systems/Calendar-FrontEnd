import { useEffect, useRef } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { tokenAtom } from '../atoms/auth';
import { themeAtom } from '../atoms/theme';
import { viewsAtom } from '../atoms/project';
import { userInfoAtom } from '../atoms/userInfo';
import { updateUserInfo } from '../services/users';

// Keeps the theme and custom views in the user's `private_info.settings` (the API's
// open-schema JSON), so they follow the account across devices. The server copy is
// applied once per sign-in; after that local changes are pushed, debounced.
// `private_info` is replaced wholesale by the API, so we always merge onto the latest.
const PUSH_DELAY_MS = 800;

export function useSettingsSync() {
  const token = useAtomValue(tokenAtom);
  const [info, setInfo] = useAtom(userInfoAtom);
  const [theme, setTheme] = useAtom(themeAtom);
  const [views, setViews] = useAtom(viewsAtom);

  const appliedFor = useRef<string | null>(null);
  const lastSynced = useRef('');
  const infoRef = useRef(info);
  infoRef.current = info;

  // Apply server settings the first time this user's record arrives.
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
      | { theme?: Partial<typeof theme>; views?: typeof views }
      | undefined;
    if (!saved) {
      return;
    }
    const nextTheme = { ...theme, ...saved.theme };
    const nextViews =
      Array.isArray(saved.views) && saved.views.length > 0
        ? saved.views
        : views;
    setTheme(nextTheme);
    setViews(nextViews);
    lastSynced.current = JSON.stringify({ theme: nextTheme, views: nextViews });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apply once per user
  }, [info?.user_id]);

  const snapshot = JSON.stringify({ theme, views });

  // Push local changes.
  useEffect(() => {
    if (!token || !info || appliedFor.current !== info.user_id) {
      return;
    }
    if (snapshot === lastSynced.current) {
      return;
    }
    const timer = setTimeout(async () => {
      const current = infoRef.current;
      if (!current) {
        return;
      }
      const privateInfo = {
        ...current.private_info,
        settings: JSON.parse(snapshot),
      };
      try {
        await updateUserInfo(token, false, privateInfo);
        lastSynced.current = snapshot;
        setInfo(prev => (prev ? { ...prev, private_info: privateInfo } : prev));
      } catch (err) {
        console.warn('Could not sync settings to server:', err);
      }
    }, PUSH_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- info only gates on user id
  }, [snapshot, token, info?.user_id]);
}
