import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useAtomValue, useSetAtom } from 'jotai';
import { format, parseISO } from 'date-fns';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  ListTodo,
  Plus,
} from 'lucide-react-native';
import {
  itemFormAtom,
  itemsAtom,
  selectedItemIdAtom,
  tasksLoadingAtom,
} from '../../atoms/project';
import { childrenOf, flattenTree } from '../../data/tree';
import { showsField } from '../../data/viewFields';
import type { ProjectView, WorkItem } from '../../data/types';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Button, EmptyState, Press, Skeleton } from '../ui';
import {
  AssigneeAvatars,
  DueDate,
  PriorityBadge,
  RecurrenceIcon,
  StatusBadge,
  SubtaskBadge,
  assigneeNames,
} from './shared';

type SortKey =
  | 'id'
  | 'title'
  | 'status'
  | 'assignee'
  | 'priority'
  | 'start'
  | 'end';

const PRIORITY_RANK = { low: 0, medium: 1, high: 2 };
const STATUS_RANK = {
  not_started: 0,
  in_progress: 1,
  on_hold: 2,
  rejected: 3,
  completed: 4,
};

// `width` undefined = the flexible column that absorbs spare width.
const COLUMNS: { key: SortKey; label: string; width?: number }[] = [
  { key: 'id', label: 'ID', width: 88 },
  { key: 'title', label: 'Title' },
  { key: 'status', label: 'Status', width: 136 },
  { key: 'assignee', label: 'Assignees', width: 120 },
  { key: 'priority', label: 'Priority', width: 112 },
  { key: 'start', label: 'Start', width: 88 },
  { key: 'end', label: 'Due', width: 88 },
];

const sortValue = (i: WorkItem, key: SortKey): string | number => {
  switch (key) {
    case 'status':
      return STATUS_RANK[i.status] ?? 0;
    case 'priority':
      return PRIORITY_RANK[i.priority];
    case 'assignee':
      return assigneeNames(i.assigneeIds);
    default:
      return i[key];
  }
};

const INDENT = 20;
const cellStyle = (width?: number) =>
  width ? { width } : { flexGrow: 1, flexBasis: 0, minWidth: 280 };

export function TableView({ view }: { view: ProjectView }) {
  const items = useAtomValue(itemsAtom);
  const loading = useAtomValue(tasksLoadingAtom);
  const setForm = useSetAtom(itemFormAtom);
  const columns = COLUMNS.filter(
    c => c.key === 'title' || showsField(view.fields, c.key),
  );
  const select = useSetAtom(selectedItemIdAtom);
  const c = useThemeColors();
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

  if (!loading && items.length === 0) {
    return (
      <EmptyState
        icon={ListTodo}
        title="No tasks yet"
        description="Tasks you create show up here as a sortable table, with subtasks nested under their parent."
        action={
          <Button variant="primary" icon={Plus} onPress={() => setForm({ mode: 'new' })}>
            New task
          </Button>
        }
      />
    );
  }

  const cell = (i: WorkItem, key: SortKey, depth: number) => {
    switch (key) {
      case 'id':
        return (
          <Text numberOfLines={1} className="text-xs text-text-subtle">
            {i.id}
          </Text>
        );
      case 'title': {
        const hasKids = childrenOf(items, i.id).length > 0;
        return (
          <View
            style={{ paddingLeft: (depth - 1) * INDENT }}
            className="flex-row items-center gap-1.5"
          >
            {hasKids ? (
              <Press
                accessibilityRole="button"
                accessibilityLabel={
                  collapsed.has(i.id) ? 'Expand subtasks' : 'Collapse subtasks'
                }
                onPress={() => toggleRow(i.id)}
                hitSlop={4}
                className="h-5 w-5 items-center justify-center rounded hover:bg-border-main"
              >
                {collapsed.has(i.id) ? (
                  <ChevronRight size={14} color={c.text} />
                ) : (
                  <ChevronDown size={14} color={c.text} />
                )}
              </Press>
            ) : (
              <View className="h-5 w-5" />
            )}
            <Text
              numberOfLines={1}
              className={`shrink text-sm ${
                depth === 1
                  ? 'font-medium text-text-heading'
                  : 'text-text-heading'
              }`}
            >
              {i.title}
            </Text>
            {i.recurrence ? <RecurrenceIcon freq={i.recurrence} /> : null}
            <SubtaskBadge id={i.id} />
          </View>
        );
      }
      case 'status':
        return <StatusBadge status={i.status} />;
      case 'assignee':
        return <AssigneeAvatars ids={i.assigneeIds} size={22} max={4} />;
      case 'priority':
        return <PriorityBadge priority={i.priority} />;
      case 'end':
        return <DueDate item={i} />;
      default:
        return (
          <Text className="text-sm text-text-main">
            {format(parseISO(i[key]), 'MMM d')}
          </Text>
        );
    }
  };

  // Toolbar and column headers stay fixed; only the rows scroll vertically. The
  // header and rows share one horizontal scroller so columns stay aligned.
  return (
    <View className="flex-1 px-4 pb-4 pt-3 lg:px-6">
      <View className="mb-3 h-8 flex-row items-center justify-between">
        <Text className="text-sm text-text-main">
          <Text className="font-medium text-text-heading">{items.length}</Text>
          {items.length === 1 ? ' task' : ' tasks'}
          {parents.length > 0 ? (
            <Text className="text-text-subtle">
              {' '}· {parents.length} with subtasks
            </Text>
          ) : null}
        </Text>
        {parents.length > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            icon={allCollapsed ? ChevronsUpDown : ChevronsDownUp}
            onPress={() =>
              setCollapsed(
                allCollapsed ? new Set() : new Set(parents.map(p => p.id)),
              )
            }
          >
            {allCollapsed ? 'Expand all' : 'Collapse all'}
          </Button>
        ) : null}
      </View>

      <View className="flex-1 overflow-hidden rounded-xl border border-border-main bg-bg-card">
        <ScrollView
          horizontal
          contentContainerStyle={{ minWidth: '100%', height: '100%' }}
        >
          <View style={{ flexGrow: 1, minWidth: 900 }}>
            <View className="h-9 flex-row border-b border-border-main bg-muted">
              {columns.map(col => {
                const isSorted = sort.key === col.key;
                return (
                  <Press
                    key={col.key}
                    feedback="none"
                    accessibilityRole="button"
                    accessibilityLabel={`Sort by ${col.label}`}
                    onPress={() => toggleSort(col.key)}
                    style={cellStyle(col.width)}
                    className="group flex-row items-center gap-1 px-3"
                  >
                    <Text
                      className={`text-2xs font-semibold uppercase tracking-wider ${
                        isSorted
                          ? 'text-text-heading'
                          : 'text-text-subtle group-hover:text-text-main'
                      }`}
                    >
                      {col.label}
                    </Text>
                    {isSorted ? (
                      sort.dir === 1 ? (
                        <ArrowUp size={11} color={c.heading} strokeWidth={2.5} />
                      ) : (
                        <ArrowDown size={11} color={c.heading} strokeWidth={2.5} />
                      )
                    ) : null}
                  </Press>
                );
              })}
            </View>
            <ScrollView className="flex-1" contentContainerClassName="pb-16">
              {loading && items.length === 0
                ? Array.from({ length: 8 }, (_, n) => (
                    <View
                      key={n}
                      className="h-11 flex-row items-center gap-6 border-b border-border-main px-3"
                    >
                      <Skeleton className="h-3 w-12 rounded" />
                      <Skeleton className={`h-3 rounded ${n % 2 ? 'w-64' : 'w-80'}`} />
                      <Skeleton className="h-3 w-20 rounded" />
                    </View>
                  ))
                : rows.map(({ item: i, depth }) => (
                    <Press
                      key={i.id}
                      feedback="none"
                      accessibilityRole="button"
                      accessibilityLabel={i.title}
                      onPress={() => select(i.id)}
                      className="h-11 flex-row items-center border-b border-border-main hover:bg-hover active:bg-hover"
                    >
                      {columns.map(col => (
                        <View
                          key={col.key}
                          style={cellStyle(col.width)}
                          className="justify-center px-3"
                        >
                          {cell(i, col.key, depth)}
                        </View>
                      ))}
                    </Press>
                  ))}
            </ScrollView>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
