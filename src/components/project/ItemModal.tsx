import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import ArrowRight from 'lucide-react-native/icons/arrow-right';
import Bell from 'lucide-react-native/icons/bell';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import ListTree from 'lucide-react-native/icons/list-tree';
import Pencil from 'lucide-react-native/icons/pencil';
import Plus from 'lucide-react-native/icons/plus';
import Repeat from 'lucide-react-native/icons/repeat';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import Trash2 from 'lucide-react-native/icons/trash';
import {
  itemFormAtom,
  itemsAtom,
  selectedItemIdAtom,
} from '../../atoms/project';
import { currentUserIdAtom } from '../../atoms/members';
import { STATUSES, tagInfo, allowedStatuses } from '../../data/constants';
import { confirm, errorMessage, toast } from '../../atoms/feedback';
import { useTaskMutations } from '../../hooks/useTaskMutations';
import { inviteesKey } from '../../hooks/useEventInvitees';
import { usePeople, useUserSearch, type Person } from '../../hooks/useUsers';
import type { WorkItem } from '../../data/types';
import { describeRecurrence } from '../../data/rrule';
import {
  MAX_DEPTH,
  ancestorsOf,
  canAddSubtask,
  descendantsOf,
  flattenTree,
  hasSubtasks,
  subtaskProgress,
} from '../../data/tree';
import { useThemeColors } from '../../hooks/useThemeColors';
import {
  useActiveView,
  useViewAccess,
  useViewMutations,
} from '../../hooks/useViews';
import {
  Badge,
  Button,
  Callout,
  Chip,
  IconButton,
  Press,
  Sheet,
  SheetBody,
  SheetHeader,
} from '../ui';
import { CommentsSection } from './CommentsSection';
import { EventInviteesSection } from './EventInviteesSection';
import { TaskAlertsSection } from './TaskAlertsSection';
import {
  AssigneeAvatars,
  DueDate,
  MultiSelectDropdown,
  PersonRow,
  Property,
  StatusBadge,
  StatusIcon,
  AssigneeNames,
} from './shared';

// Detail sheet for any work item, opened from every view.
export function ItemModal() {
  const [selectedId, setSelectedId] = useAtom(selectedItemIdAtom);
  const items = useAtomValue(itemsAtom);
  const setForm = useSetAtom(itemFormAtom);
  const {
    editItem,
    removeItem,
    loadChildren,
    refreshLevelOf,
    isServerBacked,
    unavailableReason,
    subtasksEnabled,
  } = useTaskMutations();
  const activeView = useActiveView();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const { updateView } = useViewMutations();
  // In a shared view, only what the owner granted is offered (the server's share
  // record); my own views allow everything.
  const { canCreate, canEdit, canDelete } = useViewAccess(activeView);
  const CURRENT_USER_ID = useAtomValue(currentUserIdAtom);
  const [enablingSubtasks, setEnablingSubtasks] = useState(false);
  // Views with show_subtasks off: the server refuses subtasks through them. The
  // owner can switch it on right here; anyone else just sees why.
  const turnOnSubtasks = async () => {
    if (!activeView) {
      return;
    }
    setEnablingSubtasks(true);
    try {
      await updateView({ ...activeView, showSubtasks: true });
      toast.success(`Subtasks turned on for “${activeView.name}”`);
    } catch (err) {
      toast.error('Couldn’t change the view', {
        description: errorMessage(err, 'Please try again.'),
      });
    } finally {
      setEnablingSubtasks(false);
    }
  };
  const c = useThemeColors();
  const item = items.find(i => i.id === selectedId);
  const close = () => setSelectedId(null);
  const open = (id: string) => setSelectedId(id);
  // Two independent ways in: the view's canEdit/canDelete/canCreate (the
  // coarse, view-wide grant a shared view's owner handed out) OR your own
  // relationship to this specific task — its owner or creator can always
  // edit or delete it, and an assignee can always add a sub-task under it,
  // even without the matching blanket grant (mirrors Tasks-Main-API's
  // TaskOwnershipInfo.can_edit/can_delete/can_create — owner||creator for
  // edit/delete, owner||assignee||creator for create). Whichever one applies.
  const isTaskOwnerOrCreator =
    !!item &&
    (item.ownerId === CURRENT_USER_ID || item.createdById === CURRENT_USER_ID);
  const isTaskAssignee = !!item && item.assigneeIds.includes(CURRENT_USER_ID);
  const canEditTask = canEdit || isTaskOwnerOrCreator;
  const canDeleteTask = canDelete || isTaskOwnerOrCreator;
  const canCreateSubtask = canCreate || isTaskOwnerOrCreator || isTaskAssignee;
  // The server's own invite permission (event_invitees::can_invite/
  // can_delete_invite) checks task ownership only, not the view's grant — an
  // assignee on someone else's shared view can still invite/see invitees,
  // same as they could directly against the API.
  const canSeeInvitees = isTaskOwnerOrCreator || isTaskAssignee;

  // Subtasks stay collapsed until asked for — and that's per level, not just
  // the task itself: expanding this task only fetches its direct children
  // (loadChildren), same as any of those children expanding fetches *their*
  // direct children, same as TableView's own row-expand. A deep subtree never
  // gets pulled in all at once just because the task was opened.
  const [expandedSubtasks, setExpandedSubtasks] = useState<Set<string>>(
    new Set(),
  );
  const [loadingSubtaskRows, setLoadingSubtaskRows] = useState<Set<string>>(
    new Set(),
  );
  const [loadedSubtaskRows, setLoadedSubtaskRows] = useState<Set<string>>(
    new Set(),
  );
  // Collapses again each time a different task opens, so it doesn't carry
  // over from the last one.
  useEffect(() => {
    setExpandedSubtasks(new Set());
    setLoadingSubtaskRows(new Set());
    setLoadedSubtaskRows(new Set());
  }, [item?.id]);

  const withoutId = (set: Set<string>, id: string) => {
    const next = new Set(set);
    next.delete(id);
    return next;
  };

  const fetchSubtaskChildren = (id: string) => {
    if (loadedSubtaskRows.has(id) || loadingSubtaskRows.has(id)) {
      return;
    }
    setLoadingSubtaskRows(prev => new Set(prev).add(id));
    loadChildren(id)
      .then(() => setLoadedSubtaskRows(prev => new Set(prev).add(id)))
      .catch(err => {
        toast.error('Couldn’t load subtasks', {
          description: errorMessage(err, 'Please try again.'),
        });
        setExpandedSubtasks(prev => withoutId(prev, id));
      })
      .finally(() => setLoadingSubtaskRows(prev => withoutId(prev, id)));
  };

  const toggleSubtask = (id: string) => {
    if (expandedSubtasks.has(id)) {
      setExpandedSubtasks(prev => withoutId(prev, id));
      return;
    }
    setExpandedSubtasks(prev => new Set(prev).add(id));
    fetchSubtaskChildren(id);
  };

  const crumbs = item ? ancestorsOf(items, item) : [];
  // Only ever as deep as what's actually been expanded — descendantsOf(items, …)
  // itself only ever holds whatever loadChildren has fetched so far.
  const loadedDescendants = item ? descendantsOf(items, item.id) : [];
  const collapsedSubtaskIds = new Set(
    loadedDescendants.filter(d => !expandedSubtasks.has(d.id)).map(d => d.id),
  );
  const subtasks = item
    ? flattenTree(loadedDescendants, collapsedSubtaskIds)
    : [];
  const progress = item ? subtaskProgress(items, item) : null;
  const canAdd = item ? canAddSubtask(items, item) : false;
  const subtasksOpen = item ? expandedSubtasks.has(item.id) : false;
  const loadingTopSubtasks = item ? loadingSubtaskRows.has(item.id) : false;

  const setStatus = (status: (typeof STATUSES)[number]['key']) => {
    if (!item || item.status === status) {
      return;
    }
    editItem({ ...item, status }).catch(err =>
      toast.error('Couldn’t update the status', {
        description: errorMessage(err, 'Please try again.'),
      }),
    );
  };

  const remove = async () => {
    if (!item) {
      return;
    }
    const kids = progress?.total ?? 0;
    const ok = await confirm({
      title: 'Delete this task?',
      message: kids
        ? `“${item.title}” and its ${kids} subtask${
            kids === 1 ? '' : 's'
          } will be deleted. This can’t be undone.`
        : `“${item.title}” will be deleted. This can’t be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) {
      return;
    }
    try {
      await removeItem(item);
      close();
      toast.success('Task deleted');
    } catch (err) {
      toast.error('Couldn’t delete the task', {
        description: errorMessage(err, 'Please try again.'),
      });
    }
  };

  // Re-reads this task's own fields and its invitee list straight from the
  // server — the level this task lives on already flows back into itemsAtom
  // (see useTaskMutations' refreshLevelOf), so nothing here copies data by
  // hand; the invitees query just needs its own explicit invalidation.
  const refresh = async () => {
    if (!item) {
      return;
    }
    setRefreshing(true);
    try {
      await refreshLevelOf(item.parentId);
      if (activeView) {
        await queryClient.invalidateQueries({
          queryKey: inviteesKey(Number(activeView.id), item.id),
        });
      }
    } catch (err) {
      toast.error('Couldn’t refresh this task', {
        description: errorMessage(err, 'Please try again.'),
      });
    } finally {
      setRefreshing(false);
    }
  };

  const tag = item ? tagInfo(item.tag) : null;

  return (
    <Sheet visible={!!item} onClose={close} size="lg">
      {item ? (
        <>
          <SheetHeader
            onClose={close}
            eyebrow={
              <View className="flex-row flex-wrap items-center gap-1">
                {crumbs.map(cr => (
                  <View key={cr.id} className="flex-row items-center gap-1">
                    <Press
                      feedback="none"
                      accessibilityRole="link"
                      accessibilityLabel={`Open ${cr.title}`}
                      onPress={() => open(cr.id)}
                      className="rounded px-0.5"
                    >
                      <Text
                        numberOfLines={1}
                        className="max-w-[160px] text-xs font-medium text-text-main hover:text-accent"
                      >
                        {cr.title}
                      </Text>
                    </Press>
                    <ChevronRight size={12} color={c.subtle} />
                  </View>
                ))}
              </View>
            }
            title={
              <Text className="text-xl font-semibold text-text-heading">
                {item.title}
              </Text>
            }
            actions={
              <>
                <IconButton
                  icon={RefreshCw}
                  label="Refresh this task"
                  disabled={refreshing}
                  onPress={refresh}
                />
                {canEditTask ? (
                  <IconButton
                    icon={Pencil}
                    label="Edit task"
                    onPress={() => {
                      setForm({ mode: 'edit', id: item.id });
                      close();
                    }}
                  />
                ) : null}
                {canDeleteTask ? (
                  <IconButton
                    icon={Trash2}
                    label="Delete task"
                    color={c.destructive}
                    onPress={remove}
                  />
                ) : null}
              </>
            }
          />
          <SheetBody>
            {item.description ? (
              <Text className="mb-5 text-base text-text-main">
                {item.description}
              </Text>
            ) : null}

            {!isServerBacked && unavailableReason ? (
              <View className="mb-4">
                <Callout kind="warning">{unavailableReason}</Callout>
              </View>
            ) : null}

            {canEdit ? (
              <View className="mb-5 flex-row flex-wrap gap-1.5">
                {allowedStatuses(activeView?.statusFilter).map(s => (
                  <Chip
                    key={s.key}
                    label={s.label}
                    color={s.color}
                    active={s.key === item.status}
                    onPress={() => setStatus(s.key)}
                  />
                ))}
              </View>
            ) : (
              <View className="mb-5 flex-row items-center gap-2">
                <StatusBadge status={item.status} />
                {activeView?.shared ? (
                  <Text className="text-xs text-text-subtle">
                    {canDelete
                      ? 'You can’t edit tasks in this view'
                      : 'View only'}
                  </Text>
                ) : null}
              </View>
            )}

            <View className="mb-6 rounded-xl border border-border-main">
              <Property label="ID" first>
                <Text className="text-sm text-text-heading">{item.id}</Text>
              </Property>
              <Property label="Tag">
                {tag ? <Badge label={tag.label} color={tag.color} dot /> : null}
              </Property>
              <Property label="Assignees">
                {canEdit ? (
                  <AssigneeQuickAdd
                    item={item}
                    canRemove={isTaskOwnerOrCreator}
                  />
                ) : (
                  <View className="flex-1 flex-row items-center gap-2">
                    <AssigneeAvatars ids={item.assigneeIds} size={22} max={5} />
                    <AssigneeNames
                      ids={item.assigneeIds}
                      className="flex-1 text-sm text-text-heading"
                    />
                  </View>
                )}
              </Property>
              <Property label="Creator">
                <PersonRow id={item.createdById} />
              </Property>
              <Property label="Owner">
                <PersonRow id={item.ownerId} />
              </Property>
              <Property label="Dates">
                <View className="flex-row items-center gap-2">
                  <Text className="text-sm text-text-heading">
                    {format(parseISO(item.start), 'MMM d')}
                    {item.startTime ? ` ${item.startTime}` : ''}
                  </Text>
                  <ArrowRight size={13} color={c.subtle} />
                  <DueDate item={item} />
                  <Text className="text-sm text-text-subtle">
                    {format(parseISO(item.end), 'yyyy')}
                  </Text>
                </View>
              </Property>
              {item.recurrence ? (
                <>
                  <Property label="Repeats">
                    <View className="flex-row items-center gap-1.5">
                      <Repeat size={13} color={c.text} />
                      <Text className="text-sm text-text-heading">
                        {describeRecurrence(item.recurrence) || item.recurrence}
                      </Text>
                    </View>
                  </Property>
                  <Property label="RRULE">
                    <Text
                      selectable
                      className="flex-1 text-xs text-text-subtle"
                    >
                      {item.recurrence}
                    </Text>
                  </Property>
                </>
              ) : null}
              {(item.reminders ?? []).length > 0 ? (
                <Property label="Reminders">
                  <View className="flex-row flex-wrap items-center gap-1.5">
                    <Bell size={13} color={c.text} />
                    <Text className="text-sm text-text-heading">
                      {item.reminders
                        .map(
                          r =>
                            `${
                              r.offsetDays === 0
                                ? 'On the day'
                                : `${r.offsetDays}d before`
                            } at ${r.time}`,
                        )
                        .join(' · ')}
                    </Text>
                  </View>
                </Property>
              ) : null}
            </View>

            {/* Nothing a shared viewer can do about subtasks being off (only
                the owner's "Turn on for this view" button, below, can) —
                showing the section just to say so is clutter for them, so
                it's left out entirely for a shared view; the owner still
                sees it, as the way to turn subtasks on. */}
            {subtasksEnabled || !activeView?.shared ? (
              <View className="mb-6">
                <View className="mb-2 flex-row items-center gap-2">
                  <ListTree size={15} color={c.text} />
                  <Text className="text-sm font-semibold text-text-heading">
                    Subtasks
                  </Text>
                  {progress && progress.total > 0 ? (
                    <Text className="text-sm text-text-subtle">
                      {progress.loaded
                        ? `${progress.done}/${progress.total}`
                        : progress.total}
                    </Text>
                  ) : null}
                  <View className="flex-1" />
                  {!subtasksEnabled || !canCreateSubtask ? null : canAdd ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={Plus}
                      onPress={() => {
                        setForm({ mode: 'new', parentId: item.id });
                        close();
                      }}
                    >
                      Add subtask
                    </Button>
                  ) : (
                    <Text className="text-xs text-text-subtle">
                      Max depth ({MAX_DEPTH}) reached
                    </Text>
                  )}
                </View>
                {!subtasksEnabled ? (
                  <Callout
                    kind="info"
                    title="Subtasks are turned off in this view"
                  >
                    <View className="gap-2">
                      <Text className="text-sm text-text-main">
                        {activeView && !activeView.shared
                          ? 'Turn them on to see and add subtasks here.'
                          : 'Only the view’s owner can turn them on.'}
                      </Text>
                      {activeView && !activeView.shared ? (
                        <View className="self-start">
                          <Button
                            size="sm"
                            loading={enablingSubtasks}
                            onPress={turnOnSubtasks}
                          >
                            Turn on for this view
                          </Button>
                        </View>
                      ) : null}
                    </View>
                  </Callout>
                ) : null}
                {subtasksEnabled &&
                progress &&
                progress.total > 0 &&
                progress.loaded ? (
                  <View className="mb-2 h-1 overflow-hidden rounded-full bg-muted">
                    <View
                      style={{
                        width: `${(progress.done / progress.total) * 100}%`,
                      }}
                      className="h-1 rounded-full bg-success"
                    />
                  </View>
                ) : null}
                {!subtasksEnabled || !progress || progress.total === 0 ? (
                  subtasksEnabled ? (
                    <Text className="py-1 text-sm text-text-subtle">
                      No subtasks yet
                    </Text>
                  ) : null
                ) : !subtasksOpen ? (
                  <Press
                    accessibilityRole="button"
                    accessibilityState={{ expanded: false }}
                    accessibilityLabel={`Show ${progress.total} subtasks`}
                    onPress={() => toggleSubtask(item.id)}
                    className="flex-row items-center gap-1.5 self-start rounded-lg border border-border-main px-3 py-1.5 hover:bg-hover"
                  >
                    <ChevronRight size={14} color={c.text} strokeWidth={2.25} />
                    <Text className="text-sm text-text-heading">
                      Show {progress.total} subtask
                      {progress.total === 1 ? '' : 's'}
                    </Text>
                  </Press>
                ) : (
                  <>
                    <Press
                      accessibilityRole="button"
                      accessibilityState={{ expanded: true }}
                      accessibilityLabel="Hide subtasks"
                      onPress={() => toggleSubtask(item.id)}
                      className="mb-1.5 flex-row items-center gap-1.5 self-start rounded-lg px-1 py-0.5 hover:bg-hover"
                    >
                      <View style={{ transform: [{ rotate: '90deg' }] }}>
                        <ChevronRight
                          size={14}
                          color={c.text}
                          strokeWidth={2.25}
                        />
                      </View>
                      <Text className="text-sm text-text-heading">
                        Hide subtasks
                      </Text>
                    </Press>
                    {loadingTopSubtasks && subtasks.length === 0 ? (
                      <Text className="py-1 text-sm text-text-subtle">
                        Loading subtasks…
                      </Text>
                    ) : (
                      <View className="overflow-hidden rounded-xl border border-border-main">
                        {subtasks.map(({ item: s, depth: d }, idx) => {
                          // Same per-level lazy load as the task itself: a subtask
                          // with its own children gets its own chevron, and only
                          // fetches them (loadChildren) the first time it's opened.
                          const kids = hasSubtasks(s);
                          const rowExpanded = expandedSubtasks.has(s.id);
                          const rowLoading = loadingSubtaskRows.has(s.id);
                          const rowChildrenShown = subtasks.some(
                            r => r.item.parentId === s.id,
                          );
                          return (
                            <View key={s.id}>
                              <Press
                                feedback="none"
                                accessibilityRole="button"
                                accessibilityLabel={`Open ${s.title}`}
                                onPress={() => open(s.id)}
                                style={{ paddingLeft: 4 + (d - 1) * 16 }}
                                className={`flex-row items-center gap-2 py-2 pr-3 hover:bg-hover ${
                                  idx > 0 ? 'border-t border-border-main' : ''
                                }`}
                              >
                                <View className="h-5 w-5 items-center justify-center">
                                  {kids ? (
                                    <Press
                                      accessibilityRole="button"
                                      accessibilityLabel={
                                        rowExpanded
                                          ? `Collapse ${s.title}`
                                          : `Expand ${s.title}`
                                      }
                                      accessibilityState={{
                                        expanded: rowExpanded,
                                      }}
                                      onPress={() => toggleSubtask(s.id)}
                                      hitSlop={6}
                                      className="h-5 w-5 items-center justify-center rounded-md hover:bg-border-main"
                                    >
                                      <View
                                        style={{
                                          transform: [
                                            {
                                              rotate: rowExpanded
                                                ? '90deg'
                                                : '0deg',
                                            },
                                          ],
                                        }}
                                      >
                                        <ChevronRight
                                          size={13}
                                          color={c.text}
                                          strokeWidth={2.25}
                                        />
                                      </View>
                                    </Press>
                                  ) : null}
                                </View>
                                <StatusIcon status={s.status} size={14} />
                                <Text
                                  numberOfLines={1}
                                  className="flex-1 text-sm text-text-heading"
                                >
                                  {s.title}
                                </Text>
                                <AssigneeAvatars
                                  ids={s.assigneeIds}
                                  size={18}
                                />
                              </Press>
                              {rowExpanded &&
                              rowLoading &&
                              !rowChildrenShown ? (
                                <Text
                                  style={{ paddingLeft: 4 + d * 16 }}
                                  className="border-t border-border-main py-1.5 text-xs text-text-subtle"
                                >
                                  Loading…
                                </Text>
                              ) : null}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </>
                )}
              </View>
            ) : null}

            <View className="mb-6">
              <TaskAlertsSection taskId={item.id} taskTitle={item.title} />
            </View>

            {canSeeInvitees && activeView ? (
              <View className="mb-6">
                <EventInviteesSection
                  viewId={Number(activeView.id)}
                  taskId={item.id}
                  canInvite={canSeeInvitees}
                  canRemove={isTaskOwnerOrCreator}
                />
              </View>
            ) : null}

            <CommentsSection taskId={item.id} />
          </SheetBody>
        </>
      ) : null}
    </Sheet>
  );
}

// Anyone with edit access on the view can assign new people to a task or
// sub-task — the server's own rule is looser than editing the task's other
// fields (owner/creator only there; see ItemModal's canEditTask). Removing
// one, though, is the task's own owner or creator only (canRemove) — same
// bar as canEditTask/canDeleteTask — so everyone else still sees an
// already-assigned person locked, add-only.
function AssigneeQuickAdd({
  item,
  canRemove,
}: {
  item: WorkItem;
  canRemove: boolean;
}) {
  const CURRENT_USER_ID = useAtomValue(currentUserIdAtom);
  const { assignItem } = useTaskMutations();
  const [query, setQuery] = useState('');
  const { people: searchHits } = useUserSearch(query);
  const selectedPeople = usePeople(item.assigneeIds);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const options: Person[] = [
    ...new Map(
      [...selectedPeople.values(), ...searchHits].map(p => [p.id, p] as const),
    ).values(),
  ];

  const toggle = async (id: string) => {
    const assigned = item.assigneeIds.includes(id);
    setPendingIds(prev => new Set(prev).add(id));
    try {
      const { failedAssignees } = await assignItem(
        item,
        assigned ? { add: [], remove: [id] } : { add: [id], remove: [] },
      );
      if (failedAssignees.length > 0) {
        toast.error(
          assigned
            ? 'Couldn’t remove that person'
            : 'Couldn’t assign that person',
          {
            description:
              'You may not have permission to assign people on this task.',
          },
        );
      }
    } catch (err) {
      toast.error(
        assigned
          ? 'Couldn’t remove that person'
          : 'Couldn’t assign that person',
        { description: errorMessage(err, 'Please try again.') },
      );
    } finally {
      setPendingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <MultiSelectDropdown
      label="Assignees"
      placeholder="Select people"
      selectedIds={item.assigneeIds}
      onQueryChange={setQuery}
      onToggle={toggle}
      // Not a component definition the rule needs to guard — MultiSelectDropdown
      // calls trigger(open) directly and splices the result in, it's never
      // rendered as <Trigger/>, so there's no new "component type" each render.
      // eslint-disable-next-line react/no-unstable-nested-components
      trigger={open => (
        <View className="flex-1 flex-row items-center gap-2">
          <AssigneeAvatars ids={item.assigneeIds} size={22} max={5} />
          <AssigneeNames
            ids={item.assigneeIds}
            className="flex-1 text-sm text-text-heading"
          />
          <IconButton
            icon={Plus}
            label="Add assignee"
            size="sm"
            onPress={open}
          />
        </View>
      )}
      options={options
        // The owner/creator already have full access on their own — being an
        // assignee too would be redundant — and you can't assign yourself.
        .filter(
          p =>
            p.id !== CURRENT_USER_ID &&
            p.id !== item.ownerId &&
            p.id !== item.createdById,
        )
        .map(p => {
          const assigned = item.assigneeIds.includes(p.id);
          const pending = pendingIds.has(p.id);
          return {
            id: p.id,
            label: p.name,
            hint: p.email,
            color: p.color,
            locked: pending || (assigned && !canRemove),
            lockedLabel: pending
              ? assigned
                ? 'Removing…'
                : 'Adding…'
              : assigned && !canRemove
              ? 'Assigned'
              : undefined,
          };
        })}
    />
  );
}
