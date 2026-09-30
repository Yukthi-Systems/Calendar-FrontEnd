import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useAtomValue, useSetAtom } from 'jotai';
import { format, parseISO } from 'date-fns';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
} from 'lucide-react-native';
import { itemsAtom, selectedItemIdAtom } from '../../atoms/project';
import { PRIORITY_COLOR, STATUS_BY_KEY } from '../../data/constants';
import { childrenOf, flattenTree } from '../../data/tree';
import type { WorkItem } from '../../data/types';
import { useThemeColors } from '../../hooks/useThemeColors';
import { AssigneeAvatars, Pill, SubtaskBadge, assigneeNames } from './shared';

type SortKey =
  | 'id'
  | 'title'
  | 'status'
  | 'assignee'
  | 'priority'
  | 'start'
  | 'end';

const PRIORITY_RANK = { low: 0, medium: 1, high: 2 };
const STATUS_RANK = { todo: 0, in_progress: 1, in_review: 2, done: 3 };

// `width` undefined = the flexible column that absorbs spare width.
const COLUMNS: { key: SortKey; label: string; width?: number }[] = [
  { key: 'id', label: 'ID', width: 96 },
  { key: 'title', label: 'Title' },
  { key: 'status', label: 'Status', width: 140 },
  { key: 'assignee', label: 'Assignees', width: 130 },
  { key: 'priority', label: 'Priority', width: 110 },
  { key: 'start', label: 'Start', width: 90 },
  { key: 'end', label: 'End', width: 90 },
];

const sortValue = (i: WorkItem, key: SortKey): string | number => {
  switch (key) {
    case 'status':
      return STATUS_RANK[i.status];
    case 'priority':
      return PRIORITY_RANK[i.priority];
    case 'assignee':
      return assigneeNames(i.assigneeIds);
    default:
      return i[key];
  }
};

const INDENT = 20;

export function TableView() {
  const items = useAtomValue(itemsAtom);
  const select = useSetAtom(selectedItemIdAtom);
  const { text, heading } = useThemeColors();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({
    key: 'id',
    dir: 1,
  });
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Sorting applies among siblings, so subtasks stay under their parent.
  const sorted = [...items].sort((a, b) => {
    const x = sortValue(a, sort.key);
    const y = sortValue(b, sort.key);
    return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
  });
  const rows = flattenTree(sorted, collapsed);
  const parents = items.filter(i => childrenOf(items, i.id).length > 0);

  const toggleSort = (key: SortKey) =>
    setSort(s => ({ key, dir: s.key === key && s.dir === 1 ? -1 : 1 }));
  const toggleRow = (id: string) =>
    setCollapsed(prev => {
      const next = new Set(prev);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  const allCollapsed = parents.length > 0 && collapsed.size >= parents.length;

  const cell = (i: WorkItem, key: SortKey, depth: number) => {
    switch (key) {
      case 'id':
        return (
          <Text numberOfLines={1} className="text-xs text-text-main">
            {i.id}
          </Text>
        );
      case 'title': {
        const hasKids = childrenOf(items, i.id).length > 0;
        return (
          <View
            style={{ paddingLeft: (depth - 1) * INDENT }}
            className="flex-row items-center gap-1"
          >
            {hasKids ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  collapsed.has(i.id) ? 'Expand subtasks' : 'Collapse subtasks'
                }
                onPress={() => toggleRow(i.id)}
                className="h-6 w-6 items-center justify-center rounded-md active:opacity-60"
              >
                {collapsed.has(i.id) ? (
                  <ChevronRight size={16} color={text} />
                ) : (
                  <ChevronDown size={16} color={text} />
                )}
              </Pressable>
            ) : (
              <View className="h-6 w-6" />
            )}
            <Text
              numberOfLines={1}
              className={`shrink text-sm text-text-heading ${
                depth === 1 ? 'font-semibold' : 'font-medium'
              }`}
            >
              {i.title}
            </Text>
            <SubtaskBadge id={i.id} />
          </View>
        );
      }
      case 'status': {
        const s = STATUS_BY_KEY[i.status];
        return (
          <View className="flex-row">
            <Pill text={s.label} color={s.color} />
          </View>
        );
      }
      case 'assignee':
        return (
          <View className="flex-row items-center">
            <AssigneeAvatars ids={i.assigneeIds} size={24} max={4} />
          </View>
        );
      case 'priority':
        return (
          <View className="flex-row">
            <Pill text={i.priority} color={PRIORITY_COLOR[i.priority]} />
          </View>
        );
      default:
        return (
          <Text className="text-sm text-text-main">
            {format(parseISO(i[key]), 'MMM d')}
          </Text>
        );
    }
  };

  const cellStyle = (width?: number) =>
    width ? { width } : { flexGrow: 1, flexBasis: 0, minWidth: 300 };

  // Toolbar and column headers stay fixed; only the rows scroll vertically. The
  // header and rows share one horizontal scroller so columns stay aligned.
  return (
    <View className="flex-1 p-4">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-sm text-text-main">
          {items.length} items · {parents.length} with subtasks
        </Text>
        {parents.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              setCollapsed(
                allCollapsed ? new Set() : new Set(parents.map(p => p.id)),
              )
            }
            className="rounded-lg border border-border-main px-3 py-1.5 active:opacity-70"
          >
            <Text className="text-xs text-text-heading">
              {allCollapsed ? 'Expand all' : 'Collapse all'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View className="flex-1 overflow-hidden rounded-2xl border border-border-main bg-bg-card">
        <ScrollView
          horizontal
          contentContainerStyle={{ minWidth: '100%', height: '100%' }}
        >
          <View style={{ flexGrow: 1, minWidth: 940 }}>
            <View className="flex-row border-b border-border-main bg-bg-main">
              {COLUMNS.map(c => (
                <Pressable
                  key={c.key}
                  accessibilityRole="button"
                  onPress={() => toggleSort(c.key)}
                  style={cellStyle(c.width)}
                  className="flex-row items-center gap-1 px-3 py-3 active:opacity-70"
                >
                  <Text className="text-[11px] font-semibold uppercase tracking-wide text-text-main">
                    {c.label}
                  </Text>
                  {sort.key === c.key ? (
                    sort.dir === 1 ? (
                      <ArrowUp size={12} color={heading} />
                    ) : (
                      <ArrowDown size={12} color={heading} />
                    )
                  ) : null}
                </Pressable>
              ))}
            </View>
            <ScrollView className="flex-1" contentContainerClassName="pb-16">
              {rows.map(({ item: i, depth }) => (
                <Pressable
                  key={i.id}
                  accessibilityRole="button"
                  onPress={() => select(i.id)}
                  className="min-h-[48px] flex-row items-center border-b border-border-main active:bg-accent/10"
                >
                  {COLUMNS.map(c => (
                    <View
                      key={c.key}
                      style={cellStyle(c.width)}
                      className="px-3 py-2"
                    >
                      {cell(i, c.key, depth)}
                    </View>
                  ))}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
