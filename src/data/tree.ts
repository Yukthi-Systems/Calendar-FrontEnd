import type { WorkItem } from './types';

// A top-level task is level 1; subtasks nest up to this many levels in total.
export const MAX_DEPTH = 250;

export const childrenOf = (items: WorkItem[], id: string) =>
  items.filter(i => i.parentId === id);

export const depthOf = (items: WorkItem[], item: WorkItem): number => {
  let depth = 1;
  let cur: WorkItem | undefined = item;
  while (cur?.parentId && depth <= MAX_DEPTH) {
    cur = items.find(i => i.id === cur!.parentId);
    depth++;
  }
  return depth;
};

export const ancestorsOf = (items: WorkItem[], item: WorkItem): WorkItem[] => {
  const out: WorkItem[] = [];
  let cur = items.find(i => i.id === item.parentId);
  while (cur && out.length < MAX_DEPTH) {
    out.unshift(cur);
    cur = items.find(i => i.id === cur!.parentId);
  }
  return out;
};

export const descendantsOf = (items: WorkItem[], id: string): WorkItem[] =>
  childrenOf(items, id).flatMap(c => [c, ...descendantsOf(items, c.id)]);

export const canAddSubtask = (items: WorkItem[], item: WorkItem) =>
  depthOf(items, item) < MAX_DEPTH;

// Whether a task has direct children at all, independent of whether they're
// loaded into `items` yet — tasks load lazily (see useTasksSync's header
// comment), so `childrenOf(items, id).length > 0` would say "no" for a task
// whose subtasks just haven't been fetched. `totalSubtasks` comes straight from
// the server (total_sub_tasks) and is always known, loaded or not.
export const hasSubtasks = (item: WorkItem) => item.totalSubtasks > 0;

// Depth-first order (parent, then its subtasks) with each row's depth. `collapsed`
// hides the subtasks of the listed ids. Orphans are treated as top-level.
export function flattenTree(
  items: WorkItem[],
  collapsed: ReadonlySet<string> = new Set(),
): { item: WorkItem; depth: number }[] {
  const ids = new Set(items.map(i => i.id));
  const out: { item: WorkItem; depth: number }[] = [];
  const walk = (parentId: string | null, depth: number) => {
    const kids = items.filter(i =>
      parentId === null
        ? !i.parentId || !ids.has(i.parentId)
        : i.parentId === parentId,
    );
    for (const item of kids) {
      out.push({ item, depth });
      if (!collapsed.has(item.id)) {
        walk(item.id, depth + 1);
      }
    }
  };
  walk(null, 1);
  return out;
}

// e.g. { done: 1, total: 3 } for the item's DIRECT children only (not every
// level below it — that would need the whole subtree loaded, which lazy loading
// deliberately avoids; see useTasksSync's header comment). `total` is
// `item.totalSubtasks`, always accurate whether or not those children are
// loaded; `done` only counts whichever of them happen to be loaded right now, so
// it can under-count until they're fetched (loadChildren/loadSubtree in
// useTaskMutations.ts) — `loaded` says whether that's actually happened yet, for
// callers that want to show a placeholder instead of a possibly-wrong count.
export const subtaskProgress = (items: WorkItem[], item: WorkItem) => {
  const loadedChildren = childrenOf(items, item.id);
  return {
    done: loadedChildren.filter(i => i.status === 'completed').length,
    total: item.totalSubtasks,
    loaded: loadedChildren.length >= item.totalSubtasks,
  };
};
