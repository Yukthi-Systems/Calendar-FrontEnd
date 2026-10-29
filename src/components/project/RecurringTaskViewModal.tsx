import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { format, parseISO } from 'date-fns';
import Bell from 'lucide-react-native/icons/bell';
import Clock from 'lucide-react-native/icons/clock';
import MessageSquare from 'lucide-react-native/icons/message-square';
import Pencil from 'lucide-react-native/icons/pencil';
import Plus from 'lucide-react-native/icons/plus';
import Repeat from 'lucide-react-native/icons/repeat';
import Trash2 from 'lucide-react-native/icons/trash';
import {
  itemFormAtom,
  selectedItemIdAtom,
  selectedTemplateIdAtom,
} from '../../atoms/project';
import { alertFormAtom } from '../../atoms/alerts';
import { currentUserIdAtom } from '../../atoms/members';
import { tokenAtom } from '../../atoms/auth';
import { confirm, errorMessage, toast } from '../../atoms/feedback';
import { allowedStatuses, tagInfo } from '../../data/constants';
import type { Status } from '../../data/types';
import type { WorkItem } from '../../data/types';
import {
  describeRecurrence,
  nextOccurrence,
  rruleColor,
} from '../../data/rrule';
import { recurringIcon } from '../../data/recurringIcons';
import { templateFormPrefill } from '../../data/recurringOccurrences';
import { createComment } from '../../services/comments';
import { withAuthRetry } from '../../services/authRetry';
import { useActiveView, useViewAccess } from '../../hooks/useViews';
import {
  useTaskMutations,
  type AssigneeChanges,
} from '../../hooks/useTaskMutations';
import {
  useRecurringTaskMutations,
  useRecurringTasks,
} from '../../hooks/useRecurringTasks';
import { usePeople, useUserSearch, type Person } from '../../hooks/useUsers';
import { useThemeColors, useTone } from '../../hooks/useThemeColors';
import {
  Badge,
  Button,
  Chip,
  IconButton,
  Input,
  Sheet,
  SheetBody,
  SheetHeader,
} from '../ui';
import { CommentsSection } from './CommentsSection';
import { TaskAlertsSection } from './TaskAlertsSection';
import {
  AssigneeAvatars,
  AssigneeNames,
  MultiSelectDropdown,
  PersonRow,
  Property,
  StatusBadge,
} from './shared';

const DATE_FMT = 'yyyy-MM-dd';

// Detail sheet for one recurring event, styled and laid out like ItemModal's
// task detail view (status, properties, alerts, comments) — but a template
// isn't a real task (see recurringTemplate.ts's own schema comment: one never
// becomes a task on its own). So those three sections work on a task that
// doesn't exist yet: the first time the user actually changes the status, or
// adds an alert or a comment, that action silently creates a real task from
// the template first (same fields "Create task" prefills), then performs the
// change on it. Every action after that first one reuses the same created
// task instead of making another.
export function RecurringTaskViewModal() {
  const c = useThemeColors();
  const toneOf = useTone();
  const [selectedId, setSelectedId] = useAtom(selectedTemplateIdAtom);
  const setItemForm = useSetAtom(itemFormAtom);
  const setAlertForm = useSetAtom(alertFormAtom);
  const openFullTask = useSetAtom(selectedItemIdAtom);
  const token = useAtomValue(tokenAtom);
  const CURRENT_USER_ID = useAtomValue(currentUserIdAtom);
  const view = useActiveView();
  const { templates } = useRecurringTasks(view);
  const { deleteTemplate } = useRecurringTaskMutations(view);
  const { addItem, editItem, assignItem } = useTaskMutations();
  const { canCreate, canDelete } = useViewAccess(view);
  const template = templates.find(t => t.id === selectedId);
  const tone = template ? toneOf(rruleColor(template.rrule)) : null;
  const Icon = template ? recurringIcon(template.icon) : Repeat;
  // No anchor date (see recurringTemplate.ts), so "next" counts forward from
  // today — null once the rule has already run out (a past UNTIL/COUNT).
  const next = template
    ? nextOccurrence(template.rrule, parseISO(template.createdAt))
    : null;

  // The task made (if any) from this open template, this sheet session only.
  const [createdItem, setCreatedItem] = useState<WorkItem | null>(null);
  const [postingComment, setPostingComment] = useState(false);
  const creating = useRef<Promise<WorkItem> | null>(null);

  // A different event opened, or the sheet closed — the next one starts fresh;
  // it should never reuse a task made from a previous template.
  useEffect(() => {
    setCreatedItem(null);
    creating.current = null;
  }, [selectedId]);

  const close = () => setSelectedId(null);

  const ensureTask = (): Promise<WorkItem> => {
    if (createdItem) {
      return Promise.resolve(createdItem);
    }
    if (creating.current) {
      return creating.current;
    }
    if (!template) {
      return Promise.reject(new Error('No event selected'));
    }
    const date = format(next ?? new Date(), DATE_FMT);
    const prefill = templateFormPrefill(template);
    const draft = {
      parentId: null,
      title: prefill.title,
      description: prefill.description,
      status: 'not_started' as Status,
      tag: prefill.tag,
      start: date,
      end: date,
      startTime: prefill.time || null,
      endTime: prefill.time || null,
      recurrence: null,
      reminders: [],
    };
    const promise = addItem(draft)
      .then(({ id }) => {
        const item: WorkItem = {
          ...draft,
          id,
          assigneeIds: [],
          createdById: CURRENT_USER_ID,
          ownerId: CURRENT_USER_ID,
          totalSubtasks: 0,
        };
        setCreatedItem(item);
        return item;
      })
      .finally(() => {
        creating.current = null;
      });
    creating.current = promise;
    return promise;
  };

  // The pencil still opens the normal "new task" form prefilled, for
  // reviewing/editing fields before anything is saved — but once one of the
  // quick actions below has already made a task, re-opening that form would
  // make a second one, so from then on the pencil opens the task it already
  // made instead.
  const createTask = () => {
    if (!template) {
      return;
    }
    setItemForm({
      mode: 'new',
      start: format(next ?? new Date(), DATE_FMT),
      fromTemplate: templateFormPrefill(template),
    });
    close();
  };
  const editCreatedTask = () => {
    if (!createdItem) {
      return;
    }
    openFullTask(createdItem.id);
    close();
  };

  const setStatus = async (status: Status) => {
    try {
      const item = await ensureTask();
      if (item.status === status) {
        return;
      }
      await editItem({ ...item, status });
      setCreatedItem({ ...item, status });
    } catch (err) {
      toast.error('Couldn’t update the status', {
        description: errorMessage(err, 'Please try again.'),
      });
    }
  };

  const addAssignee = async (id: string) => {
    try {
      const item = await ensureTask();
      const changes: AssigneeChanges = { add: [id], remove: [] };
      const { failedAssignees } = await assignItem(item, changes);
      if (failedAssignees.length > 0) {
        toast.error('Couldn’t assign that person', {
          description:
            'You may not have permission to assign people on this task.',
        });
        return;
      }
      setCreatedItem({ ...item, assigneeIds: [...item.assigneeIds, id] });
    } catch (err) {
      toast.error('Couldn’t assign that person', {
        description: errorMessage(err, 'Please try again.'),
      });
    }
  };

  const addAlert = async () => {
    try {
      const item = await ensureTask();
      setAlertForm({ mode: 'new', taskId: item.id, taskTitle: item.title });
    } catch (err) {
      toast.error('Couldn’t create the task', {
        description: errorMessage(err, 'Please try again.'),
      });
    }
  };

  const postComment = async (content: string) => {
    if (!content || !view) {
      return;
    }
    setPostingComment(true);
    try {
      const item = await ensureTask();
      await withAuthRetry(token, t =>
        createComment(t, Number(view.id), Number(item.id), content),
      );
    } catch (err) {
      toast.error('Couldn’t post your comment', {
        description: errorMessage(err, 'Please try again.'),
      });
    } finally {
      setPostingComment(false);
    }
  };

  const remove = async () => {
    if (!template) {
      return;
    }
    const ok = await confirm({
      title: `Delete “${template.title}”?`,
      message:
        'This only removes the event — it won’t touch any tasks already made from it.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) {
      return;
    }
    try {
      await deleteTemplate(template);
      close();
      toast.success('Event deleted');
    } catch (err) {
      toast.error('Couldn’t delete the event', {
        description: errorMessage(err, 'Please try again.'),
      });
    }
  };

  return (
    <Sheet visible={!!template} onClose={close} size="lg">
      {template ? (
        <>
          <SheetHeader
            onClose={close}
            title={
              <Text className="text-xl font-semibold text-text-heading">
                {template.title}
              </Text>
            }
            actions={
              <>
                {canCreate ? (
                  <IconButton
                    icon={Pencil}
                    label={createdItem ? 'Edit task' : 'Create task'}
                    onPress={createdItem ? editCreatedTask : createTask}
                  />
                ) : null}
                {canDelete ? (
                  <IconButton
                    icon={Trash2}
                    label="Delete event"
                    color={c.destructive}
                    onPress={remove}
                  />
                ) : null}
              </>
            }
          />
          <SheetBody>
            {template.description ? (
              <Text className="mb-5 text-base text-text-main">
                {template.description}
              </Text>
            ) : null}

            {canCreate ? (
              <View className="mb-5 flex-row flex-wrap gap-1.5">
                {allowedStatuses(view?.statusFilter).map(s => (
                  <Chip
                    key={s.key}
                    label={s.label}
                    color={s.color}
                    active={s.key === (createdItem?.status ?? 'not_started')}
                    onPress={() => setStatus(s.key)}
                  />
                ))}
              </View>
            ) : (
              <View className="mb-5 flex-row items-center gap-2">
                <StatusBadge status={createdItem?.status ?? 'not_started'} />
                <Text className="text-xs text-text-subtle">
                  You can’t create tasks in this view
                </Text>
              </View>
            )}

            <View className="mb-6 rounded-xl border border-border-main">
              <Property label="ID" first>
                <Text className="text-sm text-text-heading">{template.id}</Text>
              </Property>
              <Property label="Tag">
                <Badge
                  label={tagInfo(template.tag).label}
                  color={tagInfo(template.tag).color}
                  dot
                />
              </Property>
              <Property label="Assignees">
                {canCreate ? (
                  <RecurringAssigneeQuickAdd
                    assigneeIds={createdItem?.assigneeIds ?? []}
                    onAdd={addAssignee}
                  />
                ) : (
                  <View className="flex-1 flex-row items-center gap-2">
                    <AssigneeAvatars
                      ids={createdItem?.assigneeIds ?? []}
                      size={22}
                      max={5}
                    />
                    <AssigneeNames
                      ids={createdItem?.assigneeIds ?? []}
                      className="flex-1 text-sm text-text-heading"
                    />
                  </View>
                )}
              </Property>
              <Property label="Repeats">
                <View className="flex-row items-center gap-1.5">
                  <Icon size={13} color={tone?.fg ?? c.text} />
                  <Text className="text-sm text-text-heading">
                    {describeRecurrence(template.rrule) || template.rrule}
                  </Text>
                </View>
              </Property>
              <Property label="RRULE">
                <Text selectable className="flex-1 text-xs text-text-subtle">
                  {template.rrule}
                </Text>
              </Property>
              <Property label="Next">
                <Text className="text-sm text-text-heading">
                  {next
                    ? `${format(next, 'EEE, MMM d, yyyy')}${
                        template.time ? ` · ${template.time}` : ''
                      }`
                    : 'No upcoming date'}
                </Text>
              </Property>
              {template.time ? (
                <Property label="Time">
                  <View className="flex-row items-center gap-1.5">
                    <Clock size={13} color={c.text} />
                    <Text className="text-sm text-text-heading">
                      {template.time}
                    </Text>
                  </View>
                </Property>
              ) : null}
              {/* No separate creator column on recurring_tasks — owner is the only identity. */}
              <Property label="Owner">
                <PersonRow id={template.ownerId} />
              </Property>
              <Property label="Created">
                <Text className="text-sm text-text-heading">
                  {format(parseISO(template.createdAt), 'MMM d, yyyy')}
                </Text>
              </Property>
            </View>

            {canCreate ? (
              <View className="mb-6">
                {createdItem ? (
                  <TaskAlertsSection
                    taskId={createdItem.id}
                    taskTitle={createdItem.title}
                  />
                ) : (
                  <View>
                    <View className="mb-3 flex-row items-center gap-2">
                      <Bell size={15} color={c.text} />
                      <Text className="text-sm font-semibold text-text-heading">
                        Alerts
                      </Text>
                      <View className="flex-1" />
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={Plus}
                        onPress={addAlert}
                      >
                        Add alert
                      </Button>
                    </View>
                    <Text className="text-sm text-text-main">
                      No alerts yet — adding one creates a task from this event.
                    </Text>
                  </View>
                )}
              </View>
            ) : null}

            {canCreate && view?.showComments ? (
              createdItem ? (
                <CommentsSection taskId={createdItem.id} />
              ) : (
                <PendingComments
                  onSubmit={postComment}
                  posting={postingComment}
                />
              )
            ) : null}
          </SheetBody>
        </>
      ) : null}
    </Sheet>
  );
}

// Mirrors ItemModal's own AssigneeQuickAdd — add-only (removing stays in the
// full edit form, once a task exists to open it on) — but works the same
// whether or not a task has been made from this template yet: onAdd (see
// addAssignee above) creates one first if it hasn't been already.
function RecurringAssigneeQuickAdd({
  assigneeIds,
  onAdd,
}: {
  assigneeIds: string[];
  onAdd: (id: string) => Promise<void>;
}) {
  const CURRENT_USER_ID = useAtomValue(currentUserIdAtom);
  const [query, setQuery] = useState('');
  const { people: searchHits } = useUserSearch(query);
  const selectedPeople = usePeople(assigneeIds);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const options: Person[] = [
    ...new Map(
      [...selectedPeople.values(), ...searchHits].map(p => [p.id, p] as const),
    ).values(),
  ];

  const add = async (id: string) => {
    setPendingIds(prev => new Set(prev).add(id));
    try {
      await onAdd(id);
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
      selectedIds={assigneeIds}
      onQueryChange={setQuery}
      onToggle={add}
      // eslint-disable-next-line react/no-unstable-nested-components
      trigger={open => (
        <View className="flex-1 flex-row items-center gap-2">
          <AssigneeAvatars ids={assigneeIds} size={22} max={5} />
          <AssigneeNames
            ids={assigneeIds}
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
        .filter(p => p.id !== CURRENT_USER_ID)
        .map(p => ({
          id: p.id,
          label: p.name,
          hint: p.email,
          color: p.color,
          locked: assigneeIds.includes(p.id) || pendingIds.has(p.id),
          lockedLabel: assigneeIds.includes(p.id)
            ? 'Assigned'
            : pendingIds.has(p.id)
            ? 'Adding…'
            : undefined,
        }))}
    />
  );
}

// Mirrors CommentsSection's own header + composer for a template that hasn't
// made a task yet — posting creates the task first (see postComment above),
// then the real CommentsSection takes over on the next render.
function PendingComments({
  onSubmit,
  posting,
}: {
  onSubmit: (content: string) => void;
  posting: boolean;
}) {
  const c = useThemeColors();
  const [draft, setDraft] = useState('');

  const submit = () => {
    const content = draft.trim();
    if (!content) {
      return;
    }
    onSubmit(content);
    setDraft('');
  };

  return (
    <View>
      <View className="mb-3 flex-row items-center gap-2">
        <MessageSquare size={15} color={c.text} />
        <Text className="text-sm font-semibold text-text-heading">
          Comments
        </Text>
      </View>
      <View className="flex-row items-end gap-2">
        <View className="flex-1">
          <Input
            value={draft}
            onChangeText={setDraft}
            placeholder="Write a comment…"
            multiline
            minHeight={40}
          />
        </View>
        <Button
          variant="primary"
          onPress={submit}
          disabled={!draft.trim()}
          loading={posting}
        >
          Post
        </Button>
      </View>
    </View>
  );
}
