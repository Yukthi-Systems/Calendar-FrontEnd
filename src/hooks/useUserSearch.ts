import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAtomValue, useSetAtom } from 'jotai';
import { tokenAtom } from '../atoms/auth';
import { directoryAtom } from '../atoms/userInfo';
import { searchUsersByEmail } from '../services/users';
import { useDebouncedValue } from './useDebouncedValue';

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

// GET /user/search, debounced — shared by the assignee picker (ItemFormModal) and
// the view-sharing picker (ShareViewModal). Results are merged into directoryAtom
// (keyed by user_id, so repeated searches accumulate rather than replace) since
// both the local "member" list and the share picker read from it.
export function useUserSearch(query: string) {
  const token = useAtomValue(tokenAtom);
  const setDirectory = useSetAtom(directoryAtom);
  const debounced = useDebouncedValue(query.trim(), DEBOUNCE_MS);
  const enabled = !!token && debounced.length >= MIN_QUERY_LENGTH;

  const result = useQuery({
    queryKey: ['userSearch', debounced],
    queryFn: () => searchUsersByEmail(token!, debounced),
    enabled,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!result.data) {
      return;
    }
    setDirectory(prev => [
      ...prev,
      ...result.data.filter(f => !prev.some(p => p.user_id === f.user_id)),
    ]);
  }, [result.data, setDirectory]);

  useEffect(() => {
    if (result.error) {
      console.warn('User search failed:', result.error);
    }
  }, [result.error]);

  return { isSearching: result.isFetching };
}
