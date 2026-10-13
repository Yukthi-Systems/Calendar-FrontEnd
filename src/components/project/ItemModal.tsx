import { useEffect, useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { format, parseISO } from 'date-fns';
import {
  ArrowRight,
  Bell,
  ChevronRight,
  ListTree,
  Pencil,
  Plus,
  Repeat,
  Trash2,
} from 'lucide-react-native';
import {
  itemFormAtom,
  itemsAtom,
  selectedItemIdAtom,
} from '../../atoms/project';
import { STATUSES, tagInfo } from '../../data/constants';
import { currentUserIdAtom } from '../../atoms/members';
import { confirm, errorMessage, toast } from '../../atoms/feedback';
import { canDelete, canEditFields, roleFor } from '../../data/permissions';
import { useTaskMutations } from '../../hooks/useTaskMutations';
import { isServerTaskId } from '../../data/taskSync';
import { describeRecurrence } from '../../data/rrule';
import {
  MAX_DEPTH,
  ancestorsOf,
  canAddSubtask,
  depthOf,
  descendantsOf,
  flattenTree,
  subtaskProgress,
} from '../../data/tree';
import { useThemeColors } from '../../hooks/useThemeColors';
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
import {
  AssigneeAvatars,
  DueDate,
  PriorityBadge,
  StatusIcon,
  AssigneeNames,
} from './shared';

// Detail sheet for any work item, opened from every view.
export function ItemModal() {
  const [selectedId, setSelectedId] = useAtom(selectedItemIdAtom);
  const items = useAtomValue(itemsAtom);
  const CURRENT_USER_ID = useAtomValue(currentUserIdAtom);
  const setForm = useSetAtom(itemFormAtom);
  const { editItem, removeItem, loadSubtree, isServerBacked, unavailableReason } =
    useTaskMutations();
  const c = useThemeColors();
  const item = items.find(i => i.id === selectedId);
  const close = () => setSelectedId(null);
  const open = (id: string) => setSelectedId(id);

  // Subtasks load lazily (see useTasksSync's header comment) — a server-backed
  // task's full nested subtree is fetched here, on open, rather than up front
  // for the whole view. Local-only tasks already have everything in itemsAtom,
  // so loadSubtree is a no-op for them.
  const [loadingSubtasks, setLoadingSubtasks] = useState(false);
  useEffect(() => {
    if (!item || !isServerTaskId(item.id)) {
      return;
    }
    let active = true;
    setLoadingSubtasks(true);
    loadSubtree(item.id)
      .catch(err =>
        toast.error('Couldn’t load subtasks', {
          description: errorMessage(err, 'Please try again.'),
        }),
      )
      .finally(() => {
        if (active) {
          setLoadingSubtasks(false);
        }
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the open task changes, not on every loadSubtree identity change
  }, [item?.id]);

  const crumbs = item ? ancestorsOf(items, item) : [];
  const depth = item ? depthOf(items, item) : 1;
  const subtasks = item ? flattenTree(descendantsOf(items, item.id)) : [];
  const progress = item ? subtaskProgress(items, item) : null;
  const canAdd = item ? canAddSubtask(items, item) : false;
  // An assignee who isn't also the creator is limited to status, comments and
  // subtasks — Edit/Delete simply aren't offered to them.
  const role = item ? roleFor(item, CURRENT_USER_ID) : 'other';
  const editable = item ? canEditFields(item, CURRENT_USER_ID) : false;
  const deletable = item ? canDelete(item, CURRENT_USER_ID) : false;

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
      title: `Delete ${item.id}?`,
      message: kids
        ? `“${item.title}” and its ${kids} subtask${kids === 1 ? '' : 's'} will be deleted. This can’t be undone.`
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
                      <Text className="text-xs font-medium text-text-main hover:text-accent">
                        {cr.id}
                      </Text>
                    </Press>
                    <ChevronRight size={12} color={c.subtle} />
                  </View>
                ))}
                <Text className="text-xs font-medium text-text-subtle">{item.id}</Text>
                {depth > 1 ? (
                  <Text className="text-xs text-text-subtle">
                    {' '}· level {depth} of {MAX_DEPTH}
                  </Text>
                ) : null}
              </View>
            }
            title={
              <Text className="text-xl font-semibold text-text-heading">
                {item.title}
              </Text>
            }
            actions={
              <>
                {editable ? (
                  <IconButton
                    icon={Pencil}
                    label="Edit task"
                    onPress={() => {
                      setForm({ mode: 'edit', id: item.id });
                      close();
                    }}
                  />
                ) : null}
                {deletable ? (
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
              <Text className="mb-5 text-base text-text-main">{item.description}</Text>
            ) : null}

            {!isServerBacked && unavailableReason ? (
              <View className="mb-4">
                <Callout kind="warning">{unavailableReason}</Callout>
              </View>
            ) : null}
            {role === 'assignee' ? (
              <View className="mb-4">
                <Callout kind="info">
                  You’re assigned to this task — you can comment, change its status
                  and manage subtasks. Only its creator can edit details or delete it.
                </Callout>
              </View>
            ) : null}

            <View className="mb-5 flex-row flex-wrap gap-1.5">
              {STATUSES.map(s => (
                <Chip
                  key={s.key}
                  label={s.label}
                  color={s.color}
                  active={s.key === item.status}
                  onPress={() => setStatus(s.key)}
                />
              ))}
            </View>

            <View className="mb-6 rounded-xl border border-border-main">
              <Property label="Priority" first>
                <PriorityBadge priority={item.priority} />
              </Property>
              <Property label="Tag">
                {tag ? <Badge label={tag.label} color={tag.color} dot /> : null}
              </Property>
              <Property label="Assignees">
                <View className="flex-1 flex-row items-center gap-2">
                  <AssigneeAvatars ids={item.assigneeIds} size={22} max={5} />
                  <AssigneeNames
                    ids={item.assigneeIds}
                    className="flex-1 text-sm text-text-heading"
                  />
                </View>
              </Property>
              <Property label="Dates">
                <View className="flex-row items-center gap-2">
                  <Text className="text-sm text-text-heading">
                    {format(parseISO(item.start), 'MMM d')}
                  </Text>
                  <ArrowRight size={13} color={c.subtle} />
                  <DueDate item={item} />
                  <Text className="text-sm text-text-subtle">
                    {format(parseISO(item.end), 'yyyy')}
                  </Text>
                </View>
              </Property>
              {item.recurrence ? (
                <Property label="Repeats">
                  <View className="flex-row items-center gap-1.5">
                    <Repeat size={13} color={c.text} />
                    <Text className="text-sm text-text-heading">
                      {describeRecurrence(item.recurrence) || item.recurrence}
                    </Text>
                  </View>
                </Property>
              ) : null}
              {(item.reminders ?? []).length > 0 ? (
                <Property label="Reminders">
                  <View className="flex-row flex-wrap items-center gap-1.5">
                    <Bell size={13} color={c.text} />
                    <Text className="text-sm text-text-heading">
                      {item.reminders
                        .map(
                          r =>
                            `${r.offsetDays === 0 ? 'On the day' : `${r.offsetDays}d before`} at ${r.time}`,
                        )
                        .join(' · ')}
                    </Text>
                  </View>
                </Property>
              ) : null}
              {item.labels.length > 0 ? (
                <Property label="Labels">
                  <View className="flex-row flex-wrap gap-1">
                    {item.labels.map(l => (
                      <Badge key={l} label={l} />
                    ))}
                  </View>
                </Property>
              ) : null}
            </View>

            <View className="mb-6">
              <View className="mb-2 flex-row items-center gap-2">
                <ListTree size={15} color={c.text} />
                <Text className="text-sm font-semibold text-text-heading">Subtasks</Text>
                {progress && progress.total > 0 ? (
                  <Text className="text-sm text-text-subtle">
                    {progress.done}/{progress.total}
                  </Text>
                ) : null}
                <View className="flex-1" />
                {canAdd ? (
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
              {progress && progress.total > 0 ? (
                <View className="mb-2 h-1 overflow-hidden rounded-full bg-muted">
                  <View
                    style={{ width: `${(progress.done / progress.total) * 100}%` }}
                    className="h-1 rounded-full bg-success"
                  />
                </View>
              ) : null}
              {subtasks.length === 0 ? (
                <Text className="py-1 text-sm text-text-subtle">
                  {loadingSubtasks ? 'Loading subtasks…' : 'No subtasks yet'}
                </Text>
              ) : (
                <View className="overflow-hidden rounded-xl border border-border-main">
                  {subtasks.map(({ item: s, depth: d }, idx) => (
                    <Press
                      key={s.id}
                      feedback="none"
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${s.title}`}
                      onPress={() => open(s.id)}
                      style={{ paddingLeft: 12 + (d - 1) * 16 }}
                      className={`flex-row items-center gap-2.5 py-2 pr-3 hover:bg-hover ${
                        idx > 0 ? 'border-t border-border-main' : ''
                      }`}
                    >
                      <StatusIcon status={s.status} size={14} />
                      <Text className="text-2xs text-text-subtle">{s.id}</Text>
                      <Text numberOfLines={1} className="flex-1 text-sm text-text-heading">
                        {s.title}
                      </Text>
                      <AssigneeAvatars ids={s.assigneeIds} size={18} />
                    </Press>
                  ))}
                </View>
              )}
            </View>

            <CommentsSection itemId={item.id} />
          </SheetBody>
        </>
      ) : null}
    </Sheet>
  );
}

// One label/value row in the properties panel.
function Property({
  label,
  first = false,
  children,
}: {
  label: string;
  first?: boolean;
  children: ReactNode;
}) {
  return (
    <View
      className={`min-h-[40px] flex-row items-center gap-3 px-3 py-2 ${
        first ? '' : 'border-t border-border-main'
      }`}
    >
      <Text className="w-24 text-sm text-text-subtle">{label}</Text>
      <View className="flex-1 flex-row items-center">{children}</View>
    </View>
  );
}
