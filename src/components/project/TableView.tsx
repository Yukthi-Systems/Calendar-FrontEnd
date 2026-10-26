import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  ArrowDown,
  ArrowUp,
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
import { MAX_DEPTH, hasSubtasks } from '../../data/tree';
import { showsField } from '../../data/viewFields';
import { useTaskMutations } from '../../hooks/useTaskMutations';
import { useViewAccess } from '../../hooks/useViews';
import { errorMessage, toast } from '../../atoms/feedback';
import type { ProjectView, WorkItem } from '../../data/types';
import { useThemeColors } from '../../hooks/useThemeColors';
import { usePeople, type Person } from '../../hooks/useUsers';
import { Button, EmptyState, IconButton, Press, Skeleton } from '../ui';
import {
  AssigneeAvatars,
  Avatar,
  DueDate,
  RecurrenceIcon,
  StatusBadge,
  SubtaskBadge,
  namesOf,
} from './shared';

type SortKey = 'title' | 'status' | 'assignee' | 'creator' | 'owner' | 'end';

const STATUS_RANK = {
  not_started: 0,
  in_progress: 1,
  on_hold: 2,
  rejected: 3,
  completed: 4,
};

// `width` undefined = the flexible column that absorbs spare width.
const COLUMNS: { key: SortKey; label: string; width?: number }[] = [
  { key: 'title', label: 'Title' },
  { key: 'status', label: 'Status', width: 136 },
  { key: 'assignee', label: 'Assignees', width: 120 },
  { key: 'creator', label: 'Creator', width: 140 },
  { key: 'owner', label: 'Owner', width: 140 },
  { key: 'end', label: 'Due', width: 116 },
];

const sortValue = (
  i: WorkItem,
  key: SortKey,
  people: Map<string, Person>,
): string | number => {
  switch (key) {
    case 'status':
      return STATUS_RANK[i.status] ?? 0;
    case 'assignee':
      return namesOf(i.assigneeIds, people);
    case 'creator':
      return people.get(i.createdById)?.name ?? '';
    case 'owner':
      return people.get(i.ownerId)?.name ?? '';
    // Date, then time; an all-day due date sorts last in its day.
    case 'end':
      return `${i.end} ${i.endTime ?? '24:00'}`;
    default:
      return i[key];
  }
};

const cellStyle = (width?: number) =>
  width ? { width } : { flexGrow: 1, flexBasis: 0, minWidth: 320 };

// One person (Creator / Owner column) — avatar + name, reusing the ids this
// table already fetched for the Assignees column rather than querying again.
function PersonCell({ id, people }: { id: string; people: Map<string, Person> }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <Avatar id={id} size={20} />
      <Text numberOfLines={1} className="flex-1 text-sm text-text-main">
        {people.get(id)?.name ?? '…'}
      </Text>
    </View>
  );
}

// ── Tree rows ───────────────────────────────────────────────────────────────
//
// The table is a tree: a task, and — once expanded — its subtasks, nested under
// it with guide lines (├ └) the way Asana / ClickUp / Linear draw hierarchy. Each
// open group ends with an "Add subtask" row. Subtasks load from the server the
// first time a row is expanded (lazy — see useTasksSync), with a loading row in
// the meantime.
//
// `guides` = for each ancestor column, whether its vertical line continues past
// this row (that ancestor still has siblings below). `last` = this row is the
// last in its group, so its own connector stops halfway (└ instead of ├).

type TaskRow = {
  kind: 'task';
  key: string;
  item: WorkItem;
  depth: number;
  guides: boolean[];
  last: boolean;
};
type Row =
  | TaskRow
  | { kind: 'loading'; key: string; depth: number; guides: boolean[] }
  | { kind: 'add'; key: string; parent: WorkItem; depth: number; guides: boolean[] };

const LEVEL_W = 22; // width of one indentation column
const ROW_H = 44;
const CHILD_ROW_H = 40;
const GROUP_ROW_H = 32; // loading / add-subtask rows

function buildRows(
  sorted: WorkItem[],
  expanded: ReadonlySet<string>,
  loading: ReadonlySet<string>,
  // False in a shared view without create access — no "Add subtask" rows.
  allowAdd: boolean,
): Row[] {
  const ids = new Set(sorted.map(i => i.id));
  const childrenOf = (id: string) => sorted.filter(i => i.parentId === id);
  const out: Row[] = [];
  const walk = (list: WorkItem[], depth: number, guides: boolean[], endsWithAddRow: boolean) => {
    list.forEach((item, idx) => {
      const last = idx === list.length - 1 && !endsWithAddRow;
      out.push({ kind: 'task', key: item.id, item, depth, guides, last });
      if (!hasSubtasks(item) || !expanded.has(item.id)) {
        return;
      }
      // Ancestor columns for the children: ours, plus whether *our* line continues.
      const childGuides = depth >= 2 ? [...guides, !last] : [];
      const kids = childrenOf(item.id);
      if (kids.length === 0 && loading.has(item.id)) {
        out.push({ kind: 'loading', key: `${item.id}:loading`, depth: depth + 1, guides: childGuides });
        return;
      }
      const canAdd = allowAdd && depth < MAX_DEPTH;
      walk(kids, depth + 1, childGuides, canAdd);
      if (canAdd) {
        out.push({ kind: 'add', key: `${item.id}:add`, parent: item, depth: depth + 1, guides: childGuides });
      }
    });
  };
  walk(sorted.filter(i => !i.parentId || !ids.has(i.parentId)), 1, [], false);
  return out;
}

// The indentation in front of a title: one column per ancestor (a straight line
// where that ancestor's group continues) and an elbow connector for this row.
function TreeGuides({ depth, guides, last }: { depth: number; guides: boolean[]; last: boolean }) {
  if (depth < 2) {
    return null;
  }
  const line = 'absolute bg-border-strong';
  return (
    <View className="flex-row self-stretch">
      {guides.map((continues, j) => (
        <View key={j} style={{ width: LEVEL_W }}>
          {continues ? (
            <View style={{ left: LEVEL_W / 2, width: 1 }} className={`${line} bottom-0 top-0`} />
          ) : null}
        </View>
      ))}
      <View style={{ width: LEVEL_W }}>
        <View
          style={{ left: LEVEL_W / 2, width: 1, height: last ? '50%' : '100%' }}
          className={`${line} top-0`}
        />
        <View style={{ left: LEVEL_W / 2, right: 2, height: 1, top: '50%' }} className={line} />
      </View>
    </View>
  );
}

export function TableView({ view }: { view: ProjectView }) {
  const items = useAtomValue(itemsAtom);
  const people = usePeople(
    items.flatMap(i => [...i.assigneeIds, i.createdById, i.ownerId]),
  );
  const tasksLoading = useAtomValue(tasksLoadingAtom);
  const setForm = useSetAtom(itemFormAtom);
  const select = useSetAtom(selectedItemIdAtom);
  const { loadChildren, subtasksEnabled } = useTaskMutations();
  const { canCreate } = useViewAccess(view);
  const c = useThemeColors();
  const columns = COLUMNS.filter(
    col => col.key === 'title' || showsField(view.fields, col.key),
  );
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'end', dir: 1 });
  // Collapsed by default; a row's subtasks load the first time it's expanded.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loadingRows, setLoadingRows] = useState<Set<string>>(new Set());
  const [loadedRows, setLoadedRows] = useState<Set<string>>(new Set());

  const sorted = [...items].sort((a, b) => {
    const x = sortValue(a, sort.key, people);
    const y = sortValue(b, sort.key, people);
    return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
  });
  // Views with show_subtasks off can't list subtasks (server rule) — nothing to expand.
  const rows = buildRows(
    sorted,
    subtasksEnabled ? expanded : new Set(),
    loadingRows,
    canCreate,
  );
  const roots = items.filter(i => !i.parentId);
  // Every loaded task that has subtasks (for Expand all) — the header counts only
  // top-level ones, so the number doesn't change as rows are expanded.
  const parents = items.filter(hasSubtasks);
  const rootParents = roots.filter(hasSubtasks).length;
  const toggleSort = (key: SortKey) =>
    setSort(s => ({ key, dir: s.key === key && s.dir === 1 ? -1 : 1 }));

  const without = (set: Set<string>, id: string) => {
    const next = new Set(set);
    next.delete(id);
    return next;
  };

  const fetchChildren = (id: string) => {
    if (loadedRows.has(id) || loadingRows.has(id)) {
      return;
    }
    setLoadingRows(prev => new Set(prev).add(id));
    loadChildren(id)
      .then(() => setLoadedRows(prev => new Set(prev).add(id)))
      .catch(err => {
        toast.error('Couldn’t load subtasks', {
          description: errorMessage(err, 'Please try again.'),
        });
        setExpanded(prev => without(prev, id));
      })
      .finally(() => setLoadingRows(prev => without(prev, id)));
  };

  const toggleRow = (id: string) => {
    if (expanded.has(id)) {
      setExpanded(prev => without(prev, id));
    } else {
      setExpanded(prev => new Set(prev).add(id));
      fetchChildren(id);
    }
  };

  const anyExpanded = parents.some(p => expanded.has(p.id));
  const expandAll = () => {
    setExpanded(new Set(parents.map(p => p.id)));
    parents.forEach(p => fetchChildren(p.id));
  };

  const addSubtask = (parent: WorkItem) => {
    setExpanded(prev => new Set(prev).add(parent.id));
    setForm({ mode: 'new', parentId: parent.id });
  };

  if (!tasksLoading && items.length === 0) {
    return (
      <EmptyState
        icon={ListTodo}
        title="No tasks yet"
        description="Tasks you create show up here as a sortable table, with subtasks nested under their parent."
        action={
          canCreate ? (
            <Button variant="primary" icon={Plus} onPress={() => setForm({ mode: 'new' })}>
              New task
            </Button>
          ) : undefined
        }
      />
    );
  }

  const titleCell = (row: TaskRow) => {
    const { item, depth, guides, last } = row;
    const kids = hasSubtasks(item) && subtasksEnabled;
    const open = expanded.has(item.id);
    return (
      <>
        <TreeGuides depth={depth} guides={guides} last={last} />
        <View className="w-6 items-center">
          {kids ? (
            <Press
              accessibilityRole="button"
              accessibilityLabel={open ? `Collapse ${item.title}` : `Expand ${item.title}`}
              accessibilityState={{ expanded: open }}
              onPress={() => toggleRow(item.id)}
              hitSlop={6}
              className="h-6 w-6 items-center justify-center rounded-md hover:bg-border-main"
            >
              <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
                <ChevronRight size={15} color={c.text} strokeWidth={2.25} />
              </View>
            </Press>
          ) : null}
        </View>
        <Text
          numberOfLines={1}
          className={`ml-1 shrink text-sm text-text-heading ${depth === 1 ? 'font-medium' : ''}`}
        >
          {item.title}
        </Text>
        {item.recurrence ? (
          <View className="ml-1.5">
            <RecurrenceIcon freq={item.recurrence} />
          </View>
        ) : null}
        {kids ? (
          <Press
            feedback="none"
            accessibilityRole="button"
            accessibilityLabel={`${item.totalSubtasks} subtasks`}
            onPress={() => toggleRow(item.id)}
            className="ml-2 rounded-md px-1.5 py-0.5 hover:bg-border-main"
          >
            <SubtaskBadge item={item} />
          </Press>
        ) : hasSubtasks(item) ? (
          <View className="ml-2 px-1.5">
            <SubtaskBadge item={item} />
          </View>
        ) : null}
        <View className="flex-1" />
        {subtasksEnabled && canCreate && depth < MAX_DEPTH ? (
          <View className="reveal-on-hover pr-1">
            <IconButton
              icon={Plus}
              size="sm"
              label={`Add subtask to ${item.title}`}
              onPress={() => addSubtask(item)}
            />
          </View>
        ) : null}
      </>
    );
  };

  const cell = (row: TaskRow, key: SortKey) => {
    const i = row.item;
    switch (key) {
      case 'title':
        return titleCell(row);
      case 'status':
        return <StatusBadge status={i.status} />;
      case 'assignee':
        return <AssigneeAvatars ids={i.assigneeIds} size={22} max={4} />;
      case 'creator':
        return <PersonCell id={i.createdById} people={people} />;
      case 'owner':
        return <PersonCell id={i.ownerId} people={people} />;
      case 'end':
        return <DueDate item={i} />;
      default:
        return null;
    }
  };

  // A row under a group (loading / add subtask): guides in the title column so the
  // tree lines stay unbroken, nothing in the other columns.
  const groupRow = (row: Exclude<Row, TaskRow>, content: React.ReactNode) => (
    <View
      key={row.key}
      style={{ height: GROUP_ROW_H }}
      className="flex-row border-b border-border-main bg-muted/40"
    >
      <View style={cellStyle(undefined)} className="flex-row items-center self-stretch pl-3">
        <TreeGuides depth={row.depth} guides={row.guides} last />
        <View className="w-6" />
        {content}
      </View>
    </View>
  );

  const renderRow = (row: Row) => {
    if (row.kind === 'loading') {
      return groupRow(
        row,
        <View className="ml-1 flex-row items-center gap-2">
          <Skeleton className="h-3 w-40 rounded" />
          <Text className="text-xs text-text-subtle">Loading subtasks…</Text>
        </View>,
      );
    }
    if (row.kind === 'add') {
      return groupRow(
        row,
        <Press
          feedback="none"
          accessibilityRole="button"
          accessibilityLabel={`Add subtask to ${row.parent.title}`}
          onPress={() => addSubtask(row.parent)}
          className="group ml-1 h-6 flex-row items-center gap-1.5 rounded-md px-1.5 hover:bg-hover"
        >
          <Plus size={13} color={c.subtle} />
          <Text className="text-xs font-medium text-text-subtle group-hover:text-accent">
            Add subtask
          </Text>
        </Press>,
      );
    }
    const child = row.depth > 1;
    return (
      <Press
        key={row.key}
        feedback="none"
        accessibilityRole="button"
        accessibilityLabel={row.item.title}
        onPress={() => select(row.item.id)}
        style={{ height: child ? CHILD_ROW_H : ROW_H }}
        className={`group flex-row border-b border-border-main hover:bg-hover ${
          child ? 'bg-muted/40' : ''
        }`}
      >
        {columns.map(col => (
          <View
            key={col.key}
            style={cellStyle(col.width)}
            className={
              col.key === 'title'
                ? 'flex-row items-center self-stretch pl-3'
                : 'justify-center px-3'
            }
          >
            {cell(row, col.key)}
          </View>
        ))}
      </Press>
    );
  };

  // Toolbar and column headers stay fixed; only the rows scroll vertically. The
  // header and rows share one horizontal scroller so columns stay aligned.
  return (
    <View className="flex-1 px-4 pb-4 pt-3 lg:px-6">
      <View className="mb-3 h-8 flex-row items-center justify-between">
        <Text className="text-sm text-text-main">
          <Text className="font-medium text-text-heading">{roots.length}</Text>
          {roots.length === 1 ? ' task' : ' tasks'}
          {rootParents > 0 ? (
            <Text className="text-text-subtle"> · {rootParents} with subtasks</Text>
          ) : null}
        </Text>
        {subtasksEnabled && parents.length > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            icon={anyExpanded ? ChevronsDownUp : ChevronsUpDown}
            onPress={anyExpanded ? () => setExpanded(new Set()) : expandAll}
          >
            {anyExpanded ? 'Collapse all' : 'Expand all'}
          </Button>
        ) : null}
      </View>

      <View className="flex-1 overflow-hidden rounded-xl border border-border-main bg-bg-card">
        <ScrollView horizontal contentContainerStyle={{ minWidth: '100%', height: '100%' }}>
          <View style={{ flexGrow: 1, minWidth: 940 }}>
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
                    className={`group flex-row items-center gap-1 ${
                      col.key === 'title' ? 'pl-[40px] pr-3' : 'px-3'
                    }`}
                  >
                    <Text
                      className={`text-2xs font-semibold uppercase tracking-wider ${
                        isSorted ? 'text-text-heading' : 'text-text-subtle group-hover:text-text-main'
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
              {tasksLoading && items.length === 0
                ? Array.from({ length: 8 }, (_, n) => (
                    <View
                      key={n}
                      className="h-11 flex-row items-center gap-6 border-b border-border-main pl-[40px] pr-3"
                    >
                      <Skeleton className={`h-3 rounded ${n % 2 ? 'w-64' : 'w-80'}`} />
                      <Skeleton className="h-3 w-20 rounded" />
                      <Skeleton className="h-3 w-16 rounded" />
                    </View>
                  ))
                : rows.map(renderRow)}
            </ScrollView>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
