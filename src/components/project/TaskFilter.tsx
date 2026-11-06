import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import Filter from 'lucide-react-native/icons/funnel';
import X from 'lucide-react-native/icons/x';
import { useAtom } from 'jotai';
import { errorMessage, toast } from '../../atoms/feedback';
import {
  EMPTY_TASK_FILTERS,
  taskFiltersAtom,
  type TaskFilters,
} from '../../atoms/project';
import { allowedStatuses, allowedTags } from '../../data/constants';
import { passesTaskFilter, taskFilterCount } from '../../data/taskFilter';
import type { ProjectView, Status, TaskTag, WorkItem } from '../../data/types';
import { useThemeColors } from '../../hooks/useThemeColors';
import { usePeople, useUserSearch } from '../../hooks/useUsers';
import {
  useUpdateMySharedViewInfo,
  useViewMutations,
} from '../../hooks/useViews';
import { Button, Chip, DateField, Popover, Press } from '../ui';
import { MultiSelectDropdown } from './shared';
import type { tourTarget } from './tourTargets';

const filtersEqual = (a: TaskFilters, b: TaskFilters) =>
  JSON.stringify([...a.statuses].sort()) ===
    JSON.stringify([...b.statuses].sort()) &&
  JSON.stringify([...a.tags].sort()) === JSON.stringify([...b.tags].sort()) &&
  JSON.stringify([...a.assigneeIds].sort()) ===
    JSON.stringify([...b.assigneeIds].sort()) &&
  a.dueFrom === b.dueFrom &&
  a.dueTo === b.dueTo;

// The quick filter's state for one view (the Table and Calendar layouts): keeps
// taskFiltersAtom in step with the view's saved filter and saves changes back.
export function useTaskFilter(view: ProjectView) {
  const [filters, setFilters] = useAtom(taskFiltersAtom);
  const [open, setOpen] = useState(false);
  const { updateView } = useViewMutations();
  const updateMySharedViewInfo = useUpdateMySharedViewInfo();
  const count = taskFilterCount(filters);

  // Saves right away rather than waiting on the filter popover's open→close
  // (see the effect below) — "Clear filters" also appears outside the
  // popover, in the Table's no-matches EmptyState, where that close transition
  // never fires at all, so without this the cleared filter only ever updated
  // what was on screen, never what's saved for next time, in either a normal
  // or a shared view.
  const clear = () => {
    setFilters(EMPTY_TASK_FILTERS);
    const save = view.shared
      ? updateMySharedViewInfo(view.id, { filter: null })
      : updateView({ ...view, quickFilter: undefined });
    save.catch(err => {
      toast.error('Couldn’t save the filter', {
        description: errorMessage(err, 'Please try again.'),
      });
    });
  };

  // The filter atom is session-wide (taskFiltersAtom), not per view, so a
  // status/tag picked while looking at one view could silently keep filtering
  // another one that doesn't even offer it — load this view's own saved
  // filter (view.quickFilter, round-tripped through ui_info by viewSync.ts)
  // on every view change, instead of carrying over whatever was showing. For
  // a shared view, `view` itself starts out without the viewer's own
  // quickFilter and gets it a moment later once useMyShare resolves (see
  // useActiveView) — same view.id both times — so this also has to react to
  // the filter content arriving, not just to switching views, or a shared
  // view's saved filter never gets applied after a fresh page load.
  const quickFilterSignature = JSON.stringify(view.quickFilter ?? null);
  useEffect(() => {
    setFilters(view.quickFilter ?? EMPTY_TASK_FILTERS);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when switching views or when this view's saved filter content changes
  }, [view.id, quickFilterSignature]);

  // Save the filter back onto the view (so it's there again next time anyone
  // opens it) once someone's done adjusting it, not on every single chip
  // toggle — "done" being whenever the filter popover goes from open to
  // closed, however that happened (trigger button, backdrop, Escape).
  const wasOpen = useRef(open);
  useEffect(() => {
    if (wasOpen.current && !open) {
      const saved = view.quickFilter ?? EMPTY_TASK_FILTERS;
      if (!filtersEqual(filters, saved)) {
        const nextFilter = count > 0 ? filters : undefined;
        // My own (shared view) or the view's own (mine) — a shared view's
        // definition is the owner's alone to edit (see ViewMenuModal.tsx),
        // but saving just my own filter preference on it needs no edit grant
        // at all (see useUpdateMySharedViewInfo).
        const save = view.shared
          ? updateMySharedViewInfo(view.id, { filter: nextFilter ?? null })
          : updateView({ ...view, quickFilter: nextFilter });
        save.catch(err => {
          toast.error('Couldn’t save the filter', {
            description: errorMessage(err, 'Please try again.'),
          });
        });
      }
    }
    wasOpen.current = open;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the popover's own open/close
  }, [open]);

  return {
    filters,
    setFilters,
    open,
    setOpen,
    count,
    active: count > 0,
    passes: (i: WorkItem) => passesTaskFilter(i, filters),
    clear,
  };
}

// The Filter button and its popover. `children` go above the filter sections,
// for anything only one layout offers (the Table's "Fields shown").
export function TaskFilterPopover({
  view,
  filter,
  triggerRef,
  children,
}: {
  view: ProjectView;
  filter: ReturnType<typeof useTaskFilter>;
  // For the first-run tour; only the Table's filter has a tip.
  triggerRef?: ReturnType<typeof tourTarget>;
  children?: ReactNode;
}) {
  const c = useThemeColors();
  const { filters, setFilters, open, setOpen, count, clear } = filter;
  const [assigneeQuery, setAssigneeQuery] = useState('');
  const { people: assigneeSearchHits } = useUserSearch(assigneeQuery);
  const assigneePeople = usePeople(filters.assigneeIds);
  const assigneeOptions = [
    ...new Map(
      [...assigneePeople.values(), ...assigneeSearchHits].map(
        p => [p.id, p] as const,
      ),
    ).values(),
  ].map(p => ({ id: p.id, label: p.name, hint: p.email, color: p.color }));

  const toggleStatus = (key: Status) =>
    setFilters(f => ({
      ...f,
      statuses: f.statuses.includes(key)
        ? f.statuses.filter(s => s !== key)
        : [...f.statuses, key],
    }));
  const toggleTag = (key: TaskTag) =>
    setFilters(f => ({
      ...f,
      tags: f.tags.includes(key)
        ? f.tags.filter(t => t !== key)
        : [...f.tags, key],
    }));
  const toggleAssignee = (id: string) =>
    setFilters(f => ({
      ...f,
      assigneeIds: f.assigneeIds.includes(id)
        ? f.assigneeIds.filter(a => a !== id)
        : [...f.assigneeIds, id],
    }));

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      width={320}
      variant="menu"
      renderTrigger={ref => (
        <View ref={ref}>
          <View ref={triggerRef}>
            <Button
              variant={count > 0 ? 'secondary' : 'ghost'}
              size="sm"
              icon={Filter}
              onPress={() => setOpen(o => !o)}
            >
              {count > 0 ? `Filter (${count})` : 'Filter'}
            </Button>
          </View>
        </View>
      )}
    >
      <View className="gap-3 p-3">
        {children}
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
                onPress={() => toggleStatus(s.key)}
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
                onPress={() => toggleTag(t.key)}
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
            options={assigneeOptions}
            selectedIds={filters.assigneeIds}
            onToggle={toggleAssignee}
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
                onChange={dueFrom => setFilters(f => ({ ...f, dueFrom }))}
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
                onChange={dueTo => setFilters(f => ({ ...f, dueTo }))}
                min={filters.dueFrom || undefined}
                clearable
                placeholder="To"
                accessibilityLabel="Due to"
              />
            </View>
          </View>
        </View>
        {count > 0 ? (
          <Press
            feedback="none"
            accessibilityRole="button"
            onPress={clear}
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
  );
}
