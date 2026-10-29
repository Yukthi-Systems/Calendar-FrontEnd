import { useEffect, useRef } from 'react';
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useAtomValue } from 'jotai';
import { tokenAtom, userAtom } from '../atoms/auth';
import { currentUserIdAtom } from '../atoms/members';
import {
  fetchUserInfo,
  searchUsersByEmail,
  updateUserInfo,
} from '../services/users';
import { withAuthRetry } from '../services/authRetry';
import { DEFAULT_PALETTE_KEY } from '../data/palettes';
import type { ThemeSettings } from '../atoms/theme';
import type { UserInfoResponse, UserSearchResult } from '../services/types';
import { useDebouncedValue } from './useDebouncedValue';
import { errorMessage, toast } from '../atoms/feedback';

// Users, profile and theme — read straight from Tasks-Main-API's /user routes via
// TanStack Query, written straight back, nothing kept anywhere else. See
// docs/BACKEND.md §1–2.
//
// Shape of the open-schema JSON this app reads/writes on a user record:
//   public_info  { name?: string, role?: string }            visible to the org
//   private_info { phone?: string, settings?: { theme?: ThemeSettings } }  self only

// A person as the UI shows them — any user, including the signed-in one.
export interface Person {
  id: string;
  name: string;
  email: string;
  role: string;
  initials: string;
  color: string;
}

export const userKey = (id: string) => ['user', id] as const;

export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0].toUpperCase())
    .join('') || '?';

// A stable, distinct avatar colour per user id (the same id always gets the same
// colour), so people are tell-apart-able at a glance in stacked avatars.
const AVATAR_COLORS = [
  '#8b5cf6',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#6366f1',
  '#14b8a6',
  '#f97316',
  '#06b6d4',
];
export const colorForId = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) % 2147483647;
  }
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

const str = (v: unknown) => (typeof v === 'string' ? v : '');

// `fallbackName`: the SSO name for the signed-in user, used until they set one.
export const personFrom = (
  u: Pick<
    UserInfoResponse | UserSearchResult,
    'user_id' | 'email' | 'public_info'
  >,
  fallbackName?: string,
): Person => {
  const name =
    str(u.public_info?.name) || fallbackName || u.email.split('@')[0];
  return {
    id: u.user_id,
    name,
    email: u.email,
    role: str(u.public_info?.role),
    initials: initialsOf(name),
    color: colorForId(u.user_id),
  };
};

// Shown while a user's record is loading or couldn't be fetched (e.g. left the org).
const placeholder = (id: string): Person => ({
  id,
  name: 'Unknown user',
  email: '',
  role: '',
  initials: '?',
  color: '#9ca3af',
});

const USER_STALE_MS = 5 * 60_000;

// GET /user/info/{id}. For the signed-in user this includes private_info.
export function useUserInfoQuery(id: string | null | undefined) {
  const token = useAtomValue(tokenAtom);
  return useQuery({
    queryKey: userKey(id ?? ''),
    queryFn: () => withAuthRetry(token, t => fetchUserInfo(t, id!)),
    enabled: !!token && !!id,
    staleTime: USER_STALE_MS,
  });
}

// The signed-in user's full record (public + private info).
export function useMe() {
  return useUserInfoQuery(useAtomValue(currentUserIdAtom) || null);
}

export interface MyProfile extends Person {
  phone: string;
  organization: string;
}

export function useMyProfile(): MyProfile {
  const session = useAtomValue(userAtom);
  const id = useAtomValue(currentUserIdAtom);
  const { data } = useMe();
  const base = data
    ? personFrom(data, session?.username)
    : {
        ...placeholder(id),
        name: session?.username ?? '',
        email: session?.email ?? '',
        initials: initialsOf(session?.username ?? ''),
        color: colorForId(id),
      };
  return {
    ...base,
    phone: str(data?.private_info?.phone),
    organization: data?.organization_name ?? session?.organization_name ?? '',
  };
}

// One person by id — every avatar / name in the app resolves through this, so
// any user id the server hands us (assignee, creator, comment author) shows a
// real name, not just people this device happened to search for.
export function usePerson(id: string | null | undefined): Person | null {
  const me = useAtomValue(currentUserIdAtom);
  const session = useAtomValue(userAtom);
  const { data } = useUserInfoQuery(id);
  if (!id) {
    return null;
  }
  return data
    ? personFrom(data, id === me ? session?.username : undefined)
    : placeholder(id);
}

// Many people at once (avatar stacks, name lists, sorting by assignee).
export function usePeople(ids: string[]): Map<string, Person> {
  const token = useAtomValue(tokenAtom);
  const me = useAtomValue(currentUserIdAtom);
  const session = useAtomValue(userAtom);
  const unique = [...new Set(ids)];
  const results = useQueries({
    queries: unique.map(id => ({
      queryKey: userKey(id),
      queryFn: () => withAuthRetry(token, t => fetchUserInfo(t, id)),
      enabled: !!token,
      staleTime: USER_STALE_MS,
    })),
  });
  const map = new Map<string, Person>();
  unique.forEach((id, i) => {
    const data = results[i]?.data;
    map.set(
      id,
      data
        ? personFrom(data, id === me ? session?.username : undefined)
        : placeholder(id),
    );
  });
  return map;
}

// Exact lookups for a pasted list of emails: each through GET /user/search (same
// organization), keeping only an exact (case-insensitive) match. Returns who was
// found and which addresses weren't.
export function useFindPeopleByEmail() {
  const token = useAtomValue(tokenAtom);
  const queryClient = useQueryClient();
  return async (emails: string[]) => {
    const found: Person[] = [];
    const missing: string[] = [];
    for (const email of emails) {
      const hits = await queryClient
        .fetchQuery({
          queryKey: ['userSearch', email],
          queryFn: () =>
            withAuthRetry(token, t => searchUsersByEmail(t, email)),
          staleTime: 60_000,
        })
        .catch(() => []);
      const hit = hits.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (hit) {
        found.push(personFrom(hit));
      } else {
        missing.push(email);
      }
    }
    return { found, missing };
  };
}

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

// GET /user/search?email= (same organization, max 10), debounced. Returns the
// hits for the current query only — pickers combine them with whoever is already
// selected (resolved by id), so nothing needs to accumulate between searches.
export function useUserSearch(query: string) {
  const token = useAtomValue(tokenAtom);
  const debounced = useDebouncedValue(query.trim(), DEBOUNCE_MS);
  const enabled = !!token && debounced.length >= MIN_QUERY_LENGTH;
  const result = useQuery({
    queryKey: ['userSearch', debounced],
    queryFn: () => withAuthRetry(token, t => searchUsersByEmail(t, debounced)),
    enabled,
    staleTime: 60_000,
  });
  return {
    people: enabled ? (result.data ?? []).map(u => personFrom(u)) : [],
    isSearching: enabled && result.isFetching,
    error: result.error,
    tooShort: debounced.length < MIN_QUERY_LENGTH,
  };
}

// POST /user/info/{is_public}. The route replaces the whole object, so `patch` is
// merged onto the latest server copy here, then the record is refetched.
export function useUpdateMyInfo() {
  const token = useAtomValue(tokenAtom);
  const me = useAtomValue(currentUserIdAtom);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      isPublic,
      patch,
    }: {
      isPublic: boolean;
      patch: Record<string, unknown>;
    }) => {
      const current = queryClient.getQueryData<UserInfoResponse>(userKey(me));
      const base =
        (isPublic ? current?.public_info : current?.private_info) ?? {};
      await withAuthRetry(token, t =>
        updateUserInfo(t, isPublic, { ...base, ...patch }),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: userKey(me) }),
  });
}

export const DEFAULT_THEME: ThemeSettings = {
  mode: 'system',
  paletteKey: DEFAULT_PALETTE_KEY,
};

// Theme lives in private_info.settings.theme — read straight from the user record
// (the default until signed in / loaded). The user's record can briefly go missing
// from the query cache without them actually signing out — e.g. the hourly SSO
// check or a proactive token refresh clearing and re-fetching the session — and
// falling back to DEFAULT_THEME (mode: 'system') during that gap made the app
// flash to the OS's light/dark preference before snapping back once the refetch
// landed. Remembering the last real value read and only falling back to the
// default when nothing has ever loaded avoids that flash.
export function useTheme(): ThemeSettings {
  const { data } = useMe();
  const saved = (
    data?.private_info?.settings as
      | { theme?: Partial<ThemeSettings> }
      | undefined
  )?.theme;
  const lastKnown = useRef<ThemeSettings | null>(null);
  useEffect(() => {
    if (saved) {
      lastKnown.current = { ...DEFAULT_THEME, ...saved };
    }
  });
  if (saved) {
    return { ...DEFAULT_THEME, ...saved };
  }
  return lastKnown.current ?? DEFAULT_THEME;
}

// Saves the theme with POST /user/info/false. The cached record is updated first
// so the palette switches without waiting on the network; a failed save rolls back
// to the server's value and says so. The record is refetched either way.
export function useSetTheme() {
  const token = useAtomValue(tokenAtom);
  const me = useAtomValue(currentUserIdAtom);
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (next: ThemeSettings) => {
      const current = queryClient.getQueryData<UserInfoResponse>(userKey(me));
      const priv = current?.private_info ?? {};
      const settings = (priv.settings ?? {}) as Record<string, unknown>;
      await withAuthRetry(token, t =>
        updateUserInfo(t, false, {
          ...priv,
          settings: { ...settings, theme: next },
        }),
      );
    },
    onMutate: async next => {
      await queryClient.cancelQueries({ queryKey: userKey(me) });
      const prev = queryClient.getQueryData<UserInfoResponse>(userKey(me));
      if (prev) {
        const settings = (prev.private_info?.settings ?? {}) as Record<
          string,
          unknown
        >;
        queryClient.setQueryData<UserInfoResponse>(userKey(me), {
          ...prev,
          private_info: {
            ...prev.private_info,
            settings: { ...settings, theme: next },
          },
        });
      }
      return { prev };
    },
    onError: (err, _next, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(userKey(me), ctx.prev);
      }
      toast.error('Couldn’t save your appearance settings', {
        description: errorMessage(err, 'Please try again.'),
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: userKey(me) }),
  });
  return (next: ThemeSettings) => mutation.mutate(next);
}
