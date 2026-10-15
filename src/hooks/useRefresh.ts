import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAtomValue } from 'jotai';
import { itemsAtom } from '../atoms/project';
import { errorMessage, toast } from '../atoms/feedback';
import { useTaskMutations } from './useTaskMutations';
import { myShareKey, useActiveView, useViewList } from './useViews';

// The refresh button: re-read everything on screen from the server — the view
// lists, my access to the active view, its tasks, and every subtask list that's
// currently expanded (those load on demand, outside the root query).
export function useRefresh() {
  const queryClient = useQueryClient();
  const view = useActiveView();
  const { refetch: refetchViews } = useViewList();
  const { loadChildren } = useTaskMutations();
  const items = useAtomValue(itemsAtom);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    if (refreshing) {
      return;
    }
    setRefreshing(true);
    try {
      await Promise.all([
        refetchViews(),
        view ? queryClient.invalidateQueries({ queryKey: myShareKey(view.id) }) : null,
        view ? queryClient.invalidateQueries({ queryKey: ['tasks', Number(view.id)] }) : null,
        queryClient.invalidateQueries({ queryKey: ['taskSearch'] }),
      ]);
      const parents = [...new Set(items.map(i => i.parentId).filter((p): p is string => !!p))];
      // A parent deleted elsewhere just has nothing to re-read.
      await Promise.all(parents.map(p => loadChildren(p).catch(() => null)));
    } catch (err) {
      toast.error('Couldn’t refresh', { description: errorMessage(err, 'Please try again.') });
    } finally {
      setRefreshing(false);
    }
  };

  return { refresh, refreshing };
}
