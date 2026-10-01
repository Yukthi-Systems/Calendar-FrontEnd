import type { WorkItem } from './types';

// A top-level task is level 1; subtasks nest up to this many levels in total.
export const MAX_DEPTH = 7;

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

// e.g. { done: 2, total: 5 } across all levels below the item.
export const subtaskProgress = (items: WorkItem[], id: string) => {
  const all = descendantsOf(items, id);
  return {
    done: all.filter(i => i.status === 'completed').length,
    total: all.length,
  };
};
