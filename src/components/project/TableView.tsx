import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import ArrowDown from 'lucide-react-native/icons/arrow-down';
import ArrowUp from 'lucide-react-native/icons/arrow-up';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import ChevronsDownUp from 'lucide-react-native/icons/chevrons-down-up';
import ChevronsUpDown from 'lucide-react-native/icons/chevrons-up-down';
import Filter from 'lucide-react-native/icons/funnel';
import ListTodo from 'lucide-react-native/icons/list-todo';
import Plus from 'lucide-react-native/icons/plus';
import Repeat from 'lucide-react-native/icons/repeat';
import X from 'lucide-react-native/icons/x';
import {
  EMPTY_TASK_FILTERS,
  itemFormAtom,
  itemsAtom,
  selectedItemIdAtom,
  selectedTemplateIdAtom,
  taskFiltersAtom,
  tasksLoadingAtom,
  type TaskFilters,
} from '../../atoms/project';
import { allowedStatuses, allowedTags } from '../../data/constants';
import { MAX_DEPTH, hasSubtasks } from '../../data/tree';
import { showsField } from '../../data/viewFields';
import {
  isVirtualRecurringId,
  nextVirtualOccurrences,
  parseVirtualRecurringId,
  templateFormPrefill,
  withoutCreatedOccurrences,
} from '../../data/recurringOccurrences';
import { useTaskMutations } from '../../hooks/useTaskMutations';
import { useRecurringTasks } from '../../hooks/useRecurringTasks';
import { useViewAccess, useViewMutations } from '../../hooks/useViews';
import { errorMessage, toast } from '../../atoms/feedback';
import type { ProjectView, Status, TaskTag, WorkItem } from '../../data/types';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useUserSearch, usePeople, type Person } from '../../hooks/useUsers';
import {
  Button,
  Chip,
  DateField,
  EmptyState,
  IconButton,
  Popover,
  Press,
  Skeleton,
} from '../ui';
import {
  AssigneeAvatars,
  Avatar,
  DueDate,
  MultiSelectDropdown,
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
function PersonCell({
  id,
  people,
}: {
  id: string;
  people: Map<string, Person>;
}) {
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
  | {
      kind: 'add';
      key: string;
      parent: WorkItem;
      depth: number;
      guides: boolean[];
    };

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
  const walk = (
    list: WorkItem[],
    depth: number,
    guides: boolean[],
    endsWithAddRow: boolean,
  ) => {
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
        out.push({
          kind: 'loading',
          key: `${item.id}:loading`,
          depth: depth + 1,
          guides: childGuides,
        });
        return;
      }
      const canAdd = allowAdd && depth < MAX_DEPTH;
      walk(kids, depth + 1, childGuides, canAdd);
      if (canAdd) {
        out.push({
          kind: 'add',
          key: `${item.id}:add`,
          parent: item,
          depth: depth + 1,
          guides: childGuides,
        });
      }
    });
  };
  walk(
    sorted.filter(i => !i.parentId || !ids.has(i.parentId)),
    1,
    [],
    false,
  );
  return out;
}

// The indentation in front of a title: one column per ancestor (a straight line
// where that ancestor's group continues) and an elbow connector for this row.
function TreeGuides({
  depth,
  guides,
  last,
}: {
  depth: number;
  guides: boolean[];
  last: boolean;
}) {
  if (depth < 2) {
    return null;
  }
  const line = 'absolute bg-border-strong';
  return (
    <View className="flex-row self-stretch">
      {guides.map((continues, j) => (
        <View key={j} style={{ width: LEVEL_W }}>
          {continues ? (
            <View
              style={{ left: LEVEL_W / 2, width: 1 }}
              className={`${line} bottom-0 top-0`}
            />
          ) : null}
        </View>
      ))}
      <View style={{ width: LEVEL_W }}>
        <View
          style={{ left: LEVEL_W / 2, width: 1, height: last ? '50%' : '100%' }}
          className={`${line} top-0`}
        />
        <View
          style={{ left: LEVEL_W / 2, right: 2, height: 1, top: '50%' }}
          className={line}
        />
      </View>
    </View>
  );
}

export function TableView({ view }: { view: ProjectView }) {
  const allItems = useAtomValue(itemsAtom);
  const [filters, setFilters] = useAtom(taskFiltersAtom);
  const filterActive =
    filters.statuses.length > 0 ||
    filters.tags.length > 0 ||
    filters.assigneeIds.length > 0 ||
    !!filters.dueFrom ||
    !!filters.dueTo;
  const passesFilter = (i: WorkItem) =>
    (filters.statuses.length === 0 || filters.statuses.includes(i.status)) &&
    (filters.tags.length === 0 || filters.tags.includes(i.tag)) &&
    (filters.assigneeIds.length === 0 ||
      i.assigneeIds.some(id => filters.assigneeIds.includes(id))) &&
    (!filters.dueFrom || i.end >= filters.dueFrom) &&
    (!filters.dueTo || i.end <= filters.dueTo);
  // Each task — root or subtask — is judged on its own fields, not just
  // whether its root happens to match: a subtask now shows only when it (or
  // one of its own loaded descendants) actually passes the filter. A
  // non-matching ancestor still shows alongside a matching descendant,
  // though, so that descendant keeps its place in the tree instead of being
  // promoted to a top-level "orphan" row (buildRows treats a missing parent
  // as top level). Subtasks that haven't been fetched yet (a row never
  // expanded) can only be judged by their root, same as before — there's
  // nothing else loaded to check.
  const matchesFilter = (i: WorkItem): boolean =>
    passesFilter(i) ||
    allItems.some(x => x.parentId === i.id && matchesFilter(x));
  const items = filterActive ? allItems.filter(matchesFilter) : allItems;

  // Each recurring template's own next occurrence, shown as one extra row
  // sorted into the table by that date like a real task — see
  // recurringOccurrences.ts. Synthetic, never written to itemsAtom; same
  // quick filters apply to them (a template's tag/status/assignee reads the
  // same way a real task's would).
  const { templates: recurringTemplates } = useRecurringTasks(
    view.showRecurring === false ? undefined : view,
  );
  const virtualOccurrences =
    view.showRecurring === false
      ? []
      : withoutCreatedOccurrences(
          nextVirtualOccurrences(recurringTemplates),
          allItems,
        ).filter(v => (filterActive ? passesFilter(v.item) : true));
  const displayItems = [...items, ...virtualOccurrences.map(v => v.item)];

  const people = usePeople(
    displayItems.flatMap(i => [...i.assigneeIds, i.createdById, i.ownerId]),
  );
  const tasksLoading = useAtomValue(tasksLoadingAtom);
  const setForm = useSetAtom(itemFormAtom);
  const select = useSetAtom(selectedItemIdAtom);
  const selectTemplate = useSetAtom(selectedTemplateIdAtom);
  const { loadChildren, subtasksEnabled } = useTaskMutations();
  const { canCreate, canEdit: canEditView } = useViewAccess(view);
  const { updateView } = useViewMutations();
  const c = useThemeColors();
  const columns = COLUMNS.filter(
    col => col.key === 'title' || showsField(view.fields, col.key),
  );
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({
    key: 'end',
    dir: 1,
  });
  // Collapsed by default; a row's subtasks load the first time it's expanded.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loadingRows, setLoadingRows] = useState<Set<string>>(new Set());
  const [loadedRows, setLoadedRows] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const [assigneeQuery, setAssigneeQuery] = useState('');
  const { people: assigneeSearchHits } = useUserSearch(assigneeQuery);
  const filterAssigneePeople = usePeople(filters.assigneeIds);
  const filterAssigneeOptions = [
    ...new Map(
      [...filterAssigneePeople.values(), ...assigneeSearchHits].map(
        p => [p.id, p] as const,
      ),
    ).values(),
  ].map(p => ({ id: p.id, label: p.name, hint: p.email, color: p.color }));
  const toggleStatusFilter = (key: Status) =>
    setFilters(f => ({
      ...f,
      statuses: f.statuses.includes(key)
        ? f.statuses.filter(s => s !== key)
        : [...f.statuses, key],
    }));
  const toggleTagFilter = (key: TaskTag) =>
    setFilters(f => ({
      ...f,
      tags: f.tags.includes(key)
        ? f.tags.filter(t => t !== key)
        : [...f.tags, key],
    }));
  const toggleAssigneeFilter = (id: string) =>
    setFilters(f => ({
      ...f,
      assigneeIds: f.assigneeIds.includes(id)
        ? f.assigneeIds.filter(a => a !== id)
        : [...f.assigneeIds, id],
    }));
  const setDueFrom = (dueFrom: string) => setFilters(f => ({ ...f, dueFrom }));
  const setDueTo = (dueTo: string) => setFilters(f => ({ ...f, dueTo }));
  const clearFilters = () => setFilters(EMPTY_TASK_FILTERS);
  const filterCount =
    filters.statuses.length +
    filters.tags.length +
    filters.assigneeIds.length +
    (filters.dueFrom || filters.dueTo ? 1 : 0);

  // The filter atom is session-wide (taskFiltersAtom), not per view, so a
  // status/tag picked while looking at one view could silently keep filtering
  // another one that doesn't even offer it — load this view's own saved
  // filter (view.quickFilter, round-tripped through ui_info by viewSync.ts)
  // on every view change, instead of carrying over whatever was showing.
  useEffect(() => {
    setFilters(view.quickFilter ?? EMPTY_TASK_FILTERS);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the active view changes
  }, [view.id]);

  // Save the filter back onto the view (so it's there again next time anyone
  // opens it) once someone's done adjusting it, not on every single chip
  // toggle — "done" being whenever the filter popover goes from open to
  // closed, however that happened (trigger button, backdrop, Escape).
  const quickFilterEqual = (a: TaskFilters, b: TaskFilters) =>
    JSON.stringify([...a.statuses].sort()) ===
      JSON.stringify([...b.statuses].sort()) &&
    JSON.stringify([...a.tags].sort()) === JSON.stringify([...b.tags].sort()) &&
    JSON.stringify([...a.assigneeIds].sort()) ===
      JSON.stringify([...b.assigneeIds].sort()) &&
    a.dueFrom === b.dueFrom &&
    a.dueTo === b.dueTo;
  const wasFilterOpen = useRef(filterOpen);
  useEffect(() => {
    if (wasFilterOpen.current && !filterOpen && canEditView) {
      const saved = view.quickFilter ?? EMPTY_TASK_FILTERS;
      if (!quickFilterEqual(filters, saved)) {
        updateView({
          ...view,
          quickFilter: filterCount > 0 ? filters : undefined,
        }).catch(err => {
          toast.error('Couldn’t save the filter', {
            description: errorMessage(err, 'Please try again.'),
          });
        });
      }
    }
    wasFilterOpen.current = filterOpen;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the popover's own open/close
  }, [filterOpen]);

  const sorted = [...displayItems].sort((a, b) => {
    const x = sortValue(a, sort.key, people);
    const y = sortValue(b, sort.key, people);
    // Title/assignee/creator/owner are strings — plain < / > is case-sensitive
    // (every uppercase letter sorts before any lowercase one in ASCII), so
    // "Zebra" would land before "apple". localeCompare's base sensitivity
    // ignores case (and accents); numeric also orders embedded numbers
    // naturally ("Task 2" before "Task 10"). Status/Due stay as plain
    // number/string compares — status is already a rank, and Due's
    // 'yyyy-MM-dd HH:mm' string sorts correctly either way.
    const cmp =
      typeof x === 'string' && typeof y === 'string'
        ? x.localeCompare(y, undefined, { sensitivity: 'base', numeric: true })
        : x < y
        ? -1
        : x > y
        ? 1
        : 0;
    return cmp * sort.dir;
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

  // A recurring-occurrence row isn't a real task to open — clicking the row
  // itself opens the event's own detail sheet (RecurringTaskViewModal, same
  // one the Recurring tab's list opens), same as a real task row opens
  // ItemModal. The row's dedicated "Create task" icon stays a direct
  // shortcut into the normal "new task" form, prefilled from the template
  // and dated to this occurrence (see recurringOccurrences.ts).
  const openTemplateDetail = (virtualId: string) => {
    const parsed = parseVirtualRecurringId(virtualId);
    if (!parsed) {
      return;
    }
    selectTemplate(parsed.templateId);
  };
  const openVirtual = (virtualId: string) => {
    if (!canCreate) {
      return;
    }
    const parsed = parseVirtualRecurringId(virtualId);
    const template = parsed
      ? recurringTemplates.find(t => t.id === parsed.templateId)
      : undefined;
    if (!parsed || !template) {
      return;
    }
    setForm({
      mode: 'new',
      start: parsed.date,
      fromTemplate: templateFormPrefill(template),
    });
  };

  if (
    !tasksLoading &&
    allItems.length === 0 &&
    virtualOccurrences.length === 0
  ) {
    return (
      <EmptyState
        icon={ListTodo}
        title="No tasks yet"
        description="Tasks you create show up here as a sortable table, with subtasks nested under their parent."
        action={
          canCreate ? (
            <Button
              variant="primary"
              icon={Plus}
              onPress={() => setForm({ mode: 'new' })}
            >
              New task
            </Button>
          ) : undefined
        }
      />
    );
  }

  const titleCell = (row: TaskRow) => {
    const { item, depth, guides, last } = row;
    const virtual = isVirtualRecurringId(item.id);
    const kids = !virtual && hasSubtasks(item) && subtasksEnabled;
    const open = expanded.has(item.id);
    return (
      <>
        <TreeGuides depth={depth} guides={guides} last={last} />
        <View className="w-6 items-center">
          {kids ? (
            <Press
              accessibilityRole="button"
              accessibilityLabel={
                open ? `Collapse ${item.title}` : `Expand ${item.title}`
              }
              accessibilityState={{ expanded: open }}
              onPress={() => toggleRow(item.id)}
              hitSlop={6}
              className="h-6 w-6 items-center justify-center rounded-md hover:bg-border-main"
            >
              <View
                style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}
              >
                <ChevronRight size={15} color={c.text} strokeWidth={2.25} />
              </View>
            </Press>
          ) : null}
        </View>
        <Text
          numberOfLines={1}
          className={`ml-1 shrink text-sm ${
            virtual ? 'text-text-subtle' : 'text-text-heading'
          } ${depth === 1 ? 'font-medium' : ''}`}
        >
          {item.title}
        </Text>
        {item.recurrence ? (
          <View className="ml-1.5">
            <RecurrenceIcon freq={item.recurrence} />
          </View>
        ) : virtual ? (
          <View className="ml-1.5 flex-row items-center gap-1 rounded-md bg-muted px-1.5 py-0.5">
            <Repeat size={10} color={c.subtle} />
            <Text className="text-2xs font-medium text-text-subtle">
              Recurring
            </Text>
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
        {virtual && canCreate ? (
          <View className="reveal-on-hover pr-1">
            <IconButton
              icon={Plus}
              size="sm"
              label={`Create task from ${item.title}`}
              onPress={() => openVirtual(item.id)}
            />
          </View>
        ) : subtasksEnabled && canCreate && depth < MAX_DEPTH ? (
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
      <View
        style={cellStyle(undefined)}
        className="flex-row items-center self-stretch pl-3"
      >
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
    const virtual = isVirtualRecurringId(row.item.id);
    return (
      <Press
        key={row.key}
        feedback="none"
        accessibilityRole="button"
        accessibilityLabel={virtual ? `Open ${row.item.title}` : row.item.title}
        onPress={() =>
          virtual ? openTemplateDetail(row.item.id) : select(row.item.id)
        }
        style={{ height: child ? CHILD_ROW_H : ROW_H }}
        className={`group flex-row border-b border-border-main hover:bg-hover ${
          child ? 'bg-muted/40' : ''
        } ${virtual ? 'border-dashed bg-muted/20' : ''}`}
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
            <Text className="text-text-subtle">
              {' '}
              · {rootParents} with subtasks
            </Text>
          ) : null}
          {filterActive && allItems.length !== items.length ? (
            <Text className="text-text-subtle"> · filtered</Text>
          ) : null}
        </Text>
        <View className="flex-row items-center gap-1.5">
          <Popover
            open={filterOpen}
            onClose={() => setFilterOpen(false)}
            width={320}
            variant="menu"
            renderTrigger={ref => (
              <View ref={ref}>
                <Button
                  variant={filterCount > 0 ? 'secondary' : 'ghost'}
                  size="sm"
                  icon={Filter}
                  onPress={() => setFilterOpen(o => !o)}
                >
                  {filterCount > 0 ? `Filter (${filterCount})` : 'Filter'}
                </Button>
              </View>
            )}
          >
            <View className="gap-3 p-3">
              <View>
                <Text className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-text-subtle">
                  Status
                </Text>
                <View className="flex-row flex-wrap gap-1.5">
                  {allowedStatuses(view.statusFilter).map(s => (
                    <Chip
                      key={s.key}
                      label={s.label}
                      color={s.color}
                      active={filters.statuses.includes(s.key)}
                      onPress={() => toggleStatusFilter(s.key)}
                    />
                  ))}
                </View>
              </View>
              <View>
                <Text className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-text-subtle">
                  Tag
                </Text>
                <View className="flex-row flex-wrap gap-1.5">
                  {allowedTags(view.tagFilter).map(t => (
                    <Chip
                      key={t.key}
                      label={t.label}
                      color={t.color}
                      active={filters.tags.includes(t.key)}
                      onPress={() => toggleTagFilter(t.key)}
                    />
                  ))}
                </View>
              </View>
              <View>
                <Text className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-text-subtle">
                  Assignee
                </Text>
                <MultiSelectDropdown
                  label="Filter by assignee"
                  placeholder="Anyone"
                  options={filterAssigneeOptions}
                  selectedIds={filters.assigneeIds}
                  onToggle={toggleAssigneeFilter}
                  onQueryChange={setAssigneeQuery}
                />
              </View>
              <View>
                <Text className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-text-subtle">
                  Due date
                </Text>
                <View className="flex-row items-center gap-1.5">
                  <View className="flex-1">
                    <DateField
                      mode="date"
                      value={filters.dueFrom}
                      onChange={setDueFrom}
                      max={filters.dueTo || undefined}
                      clearable
                      placeholder="From"
                      accessibilityLabel="Due from"
                    />
                  </View>
                  <View className="flex-1">
                    <DateField
                      mode="date"
                      value={filters.dueTo}
                      onChange={setDueTo}
                      min={filters.dueFrom || undefined}
                      clearable
                      placeholder="To"
                      accessibilityLabel="Due to"
                    />
                  </View>
                </View>
              </View>
              {filterCount > 0 ? (
                <Press
                  feedback="none"
                  accessibilityRole="button"
                  onPress={clearFilters}
                  className="flex-row items-center gap-1 self-start rounded-md py-1"
                >
                  <X size={13} color={c.accent} />
                  <Text className="text-sm font-medium text-accent">
                    Clear filters
                  </Text>
                </Press>
              ) : null}
            </View>
          </Popover>
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
      </View>

      {filterActive && displayItems.length === 0 ? (
        <EmptyState
          compact
          icon={Filter}
          title="No tasks match your filters"
          description="Try removing a filter."
          action={
            <Button variant="ghost" onPress={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <View className="flex-1 overflow-hidden rounded-xl border border-border-main bg-bg-card">
          <ScrollView
            horizontal
            contentContainerStyle={{ minWidth: '100%', height: '100%' }}
          >
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
                          isSorted
                            ? 'text-text-heading'
                            : 'text-text-subtle group-hover:text-text-main'
                        }`}
                      >
                        {col.label}
                      </Text>
                      {isSorted ? (
                        sort.dir === 1 ? (
                          <ArrowUp
                            size={11}
                            color={c.heading}
                            strokeWidth={2.5}
                          />
                        ) : (
                          <ArrowDown
                            size={11}
                            color={c.heading}
                            strokeWidth={2.5}
                          />
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
                        <Skeleton
                          className={`h-3 rounded ${n % 2 ? 'w-64' : 'w-80'}`}
                        />
                        <Skeleton className="h-3 w-20 rounded" />
                        <Skeleton className="h-3 w-16 rounded" />
                      </View>
                    ))
                  : rows.map(renderRow)}
              </ScrollView>
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
}
