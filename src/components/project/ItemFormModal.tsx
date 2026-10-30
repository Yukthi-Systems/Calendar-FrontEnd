import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  addDays,
  differenceInCalendarDays,
  format,
  isValid,
  parse,
} from 'date-fns';
import {
  itemFormAtom,
  itemsAtom,
  selectedItemIdAtom,
} from '../../atoms/project';
import { allowedStatuses, allowedTags } from '../../data/constants';
import { useActiveView } from '../../hooks/useViews';
import { currentUserIdAtom } from '../../atoms/members';
import {
  useMyProfile,
  usePeople,
  useUserSearch,
  type Person,
} from '../../hooks/useUsers';
import { useTaskMutations } from '../../hooks/useTaskMutations';
import type { Status, TaskTag } from '../../data/types';
import { errorMessage, toast } from '../../atoms/feedback';
import {
  Button,
  Callout,
  Chip,
  DateTimeField,
  Field,
  Input,
  Sheet,
  SheetBody,
  SheetFooter,
  SheetHeader,
} from '../ui';
import { MultiSelectDropdown } from './shared';

const DATE_FMT = 'yyyy-MM-dd';

const parseDate = (s: string) => parse(s, DATE_FMT, new Date());
const validDate = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) && isValid(parseDate(s));

// Create or edit a work item. Opened via itemFormAtom from the "+" button, Kanban
// columns and the item detail sheet.
export function ItemFormModal() {
  const [form, setForm] = useAtom(itemFormAtom);
  const items = useAtomValue(itemsAtom);
  const CURRENT_USER_ID = useAtomValue(currentUserIdAtom);
  // Assignee options: whoever is already picked (resolved by id) plus the current
  // org email-search hits — nothing accumulated between searches.
  const [assigneeQuery, setAssigneeQuery] = useState('');
  const { people: searchHits } = useUserSearch(assigneeQuery);
  const me = useMyProfile();
  const setSelected = useSetAtom(selectedItemIdAtom);
  const { addItem, editItem, isServerBacked, unavailableReason } =
    useTaskMutations();
  const [saving, setSaving] = useState(false);

  const editing =
    form?.mode === 'edit' ? items.find(i => i.id === form.id) : undefined;

  // Only what the active view's filters allow — anything else the server refuses.
  const activeView = useActiveView();

  // The task's owner/creator already have full access on their own, so being
  // an assignee too would be redundant — keep them out of the picker rather
  // than let someone add a no-op assignee. Editing: read straight off the
  // task. Creating: the owner will be the view's owner (same one the server
  // assigns a new task to); the creator will be CURRENT_USER_ID, already
  // excluded below.
  const taskOwnerId = editing?.ownerId ?? activeView?.ownerId;
  const taskCreatorId = editing?.createdById;
  const statusOptions = allowedStatuses(activeView?.statusFilter);
  const tagOptions = allowedTags(activeView?.tagFilter);

  const parent =
    form?.mode === 'new' && form.parentId
      ? items.find(i => i.id === form.parentId)
      : undefined;
  // Prefilled from a recurring event's "Create task" action (a template row
  // in Table/Calendar, or its own view sheet) — this form is otherwise
  // visually identical to editing a real task, so without this there's
  // nothing on screen telling you it's about to create a brand new task
  // rather than change anything that already exists.
  const fromTemplate = form?.mode === 'new' ? form.fromTemplate : undefined;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<Status>('not_started');
  const [tag, setTag] = useState<TaskTag>('other');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const selectedPeople = usePeople(assigneeIds);
  const pickablePeople: Person[] = [
    ...new Map(
      [me, ...selectedPeople.values(), ...searchHits].map(
        p => [p.id, p] as const,
      ),
    ).values(),
  ];
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  // 'HH:mm' or '' — '' = all day (see WorkItem.startTime).
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  // Errors stay quiet until the first save attempt — no red text on a form
  // you've only just opened.
  const [attempted, setAttempted] = useState(false);

  // Server-backed: adding and removing are their own API calls
  // (POST /assignees/create, DELETE /assignees/remove), sent by addItem/editItem
  // right after the task itself saves — so freely toggle here, and let Save reconcile the difference
  // against what the task actually has. Nobody can touch their own assignment
  // either way (the server 403s a self-assign or self-remove), so the current
  // user is left out of the option list entirely below rather than offered and
  // then rejected.
  // Local-only (signed out, or the API unavailable): the old rule applies
  // instead — you can always add yourself, but never remove yourself, same as
  // before any of this existed.
  const confirmedAssigneeIds = isServerBacked ? editing?.assigneeIds ?? [] : [];
  const toggleAssignee = (id: string) =>
    setAssigneeIds(prev => {
      if (prev.includes(id)) {
        const locked = !isServerBacked && id === CURRENT_USER_ID;
        return locked ? prev : prev.filter(x => x !== id);
      }
      return [...prev, id];
    });

  // Reset the fields each time the form opens.
  useEffect(() => {
    if (!form) {
      return;
    }
    const today = new Date();
    setTitle(editing?.title ?? fromTemplate?.title ?? '');
    setDescription(editing?.description ?? fromTemplate?.description ?? '');
    const pick = <K extends string>(
      wanted: K | undefined,
      options: { key: K }[],
    ) =>
      wanted && options.some(o => o.key === wanted) ? wanted : options[0].key;
    setStatus(
      pick(
        editing?.status ??
          (form.mode === 'new' ? form.status : undefined) ??
          'not_started',
        statusOptions,
      ),
    );
    setTag(pick(editing?.tag ?? fromTemplate?.tag ?? 'other', tagOptions));
    setAssigneeIds(editing ? editing.assigneeIds : parent?.assigneeIds ?? []);
    const presetStart =
      form.mode === 'new' && form.start ? parseDate(form.start) : null;
    const todayStr = format(today, DATE_FMT);
    // A brand-new task/subtask never defaults into the past — whatever would
    // otherwise be guessed (a clicked calendar day, a template's next
    // occurrence, a parent's own dates) only applies as-is when it's today
    // or later; anything earlier falls back to today instead. Editing an
    // existing task keeps its own real dates untouched either way.
    const clampToToday = (dateStr: string) =>
      dateStr < todayStr ? todayStr : dateStr;
    // A new subtask's Start: if the parent hasn't started yet (a future
    // date), start the subtask on that same date — otherwise (the parent's
    // either currently active or already overdue), today is the useful
    // default.
    const subtaskStart = parent
      ? parent.start > todayStr
        ? parent.start
        : todayStr
      : null;
    setStart(
      editing?.start ??
        clampToToday(subtaskStart ?? format(presetStart ?? today, DATE_FMT)),
    );
    setEnd(
      editing?.end ??
        clampToToday(parent?.end ?? format(presetStart ?? today, DATE_FMT)),
    );
    // Editing keeps the task's own times (none = all day); a subtask starts with
    // its parent's; a template's time of day (if it set one) carries over to
    // both ends; anything else brand new defaults to all day — a time is only
    // ever set if the person (or the template) actually gave one.
    const source = editing ?? parent;
    setStartTime(source?.startTime ?? fromTemplate?.time ?? '');
    setEndTime(source?.endTime ?? fromTemplate?.time ?? '');
    setAttempted(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  const close = () => setForm(null);

  // Moving the start past the due date drags the due date along, keeping the
  // task's length — instead of leaving an error to fix by hand.
  const changeStart = (next: string) => {
    if (validDate(start) && validDate(end) && validDate(next) && next > end) {
      const length = differenceInCalendarDays(parseDate(end), parseDate(start));
      setEnd(format(addDays(parseDate(next), length), DATE_FMT));
    }
    setStart(next);
  };

  // A new subtask's title can't match an existing sibling's — case/whitespace
  // insensitive, checked only when actually creating one (editing a subtask's
  // own title obviously matches itself, and this isn't a rule for top-level
  // tasks). Caught here, before Save ever calls the API, not after a 409 or
  // some other server-side rejection.
  const isDuplicateSiblingTitle =
    !editing &&
    !!parent &&
    !!title.trim() &&
    items.some(
      i =>
        i.parentId === parent.id &&
        i.title.trim().toLowerCase() === title.trim().toLowerCase(),
    );

  const errors = {
    title: !title.trim()
      ? 'Title is required'
      : isDuplicateSiblingTitle
      ? 'A subtask with this name already exists'
      : null,
    start: validDate(start) ? null : 'Use YYYY-MM-DD',
    end: !validDate(end)
      ? 'Use YYYY-MM-DD'
      : validDate(start) && end < start
      ? 'Due date is before the start'
      : end === start && startTime && endTime && endTime < startTime
      ? 'Due time is before the start'
      : null,
  };
  const valid = !Object.values(errors).some(Boolean);
  const canSaveNow = !unavailableReason;

  // What Save needs to actually tell the API, in each direction — newly
  // toggled-on people (minus yourself; the server rejects self-assignment
  // outright) to add, and toggled-off previously-confirmed people to remove.
  const toAssign = isServerBacked
    ? assigneeIds.filter(
        id => !confirmedAssigneeIds.includes(id) && id !== CURRENT_USER_ID,
      )
    : [];
  const toUnassign = isServerBacked
    ? confirmedAssigneeIds.filter(id => !assigneeIds.includes(id))
    : [];

  const save = async () => {
    if (!valid) {
      setAttempted(true);
      return;
    }
    if (!canSaveNow || saving) {
      return;
    }
    const fields = {
      title: title.trim(),
      description: description.trim(),
      status,
      tag,
      // Assignees are never part of the task's own payload — the API assigns/
      // removes one person per call (`changes` below), separate from the task
      // fields. Server-backed: keep whatever's already confirmed here;
      // local-only: assigneeIds IS the task's assignee list, same as before.
      assigneeIds: isServerBacked ? editing?.assigneeIds ?? [] : assigneeIds,
      start,
      end,
      startTime: startTime || null,
      endTime: endTime || null,
      // Recurrence and reminders are no longer editable from this form (see
      // the removed Repeats/Reminders fields) — pass through whatever an
      // existing task already has rather than wipe it on an unrelated edit.
      recurrence: editing?.recurrence ?? null,
      reminders: editing?.reminders ?? [],
    };
    const changes = { add: toAssign, remove: toUnassign };
    setSaving(true);
    try {
      // Save, assign, then the list is re-read from the server (useTaskMutations).
      const { failedAssignees } = editing
        ? await editItem({ ...editing, ...fields }, changes)
        : await addItem(
            { parentId: parent?.id ?? null, ...fields },
            changes,
          ).then(r => {
            setSelected(r.id);
            return r;
          });
      if (failedAssignees.length > 0) {
        toast.error(
          `Saved, but ${failedAssignees.length} assignee change${
            failedAssignees.length === 1 ? '' : 's'
          } were refused`,
          {
            description:
              'You may not have permission to assign people on this task.',
          },
        );
      }
      close();
      toast.success(editing ? 'Changes saved' : 'Task created');
    } catch (err) {
      toast.error(
        editing ? 'Couldn’t save changes' : 'Couldn’t create the task',
        {
          description: errorMessage(err, 'Please try again.'),
        },
      );
    } finally {
      setSaving(false);
    }
  };

  const show = (e: string | null) => (attempted ? e : null);
  // Ordering problems between start and due show straight away.
  const ordering =
    errors.end === 'Due date is before the start' ||
    errors.end === 'Due time is before the start';
  const endError = ordering ? errors.end : show(errors.end);
  const title_ = editing ? 'Edit task' : parent ? 'New subtask' : 'New task';
  const subtitle = editing
    ? undefined
    : parent
    ? `Under “${parent.title}”`
    : fromTemplate
    ? `From “${fromTemplate.title}” — creates a new task, the recurring event itself is unchanged`
    : undefined;

  return (
    <Sheet visible={!!form} onClose={close} size="lg" dismissable={!saving}>
      <SheetHeader title={title_} description={subtitle} onClose={close} />
      <SheetBody>
        {!canSaveNow && unavailableReason ? (
          <View className="mb-4">
            <Callout kind="warning">{unavailableReason}</Callout>
          </View>
        ) : null}

        <Field label="Title" required error={show(errors.title)}>
          <Input
            value={title}
            onChangeText={setTitle}
            placeholder="What needs doing?"
            invalid={!!show(errors.title)}
            autoFocus={!editing}
            onSubmitEditing={save}
            returnKeyType="done"
          />
        </Field>
        <Field label="Description">
          <Input
            value={description}
            onChangeText={setDescription}
            placeholder="Add details, links or context (optional)"
            multiline
          />
        </Field>

        <Field
          label="Status"
          hint={
            statusOptions.length < 5
              ? `“${activeView?.name}” only shows these statuses.`
              : null
          }
        >
          <View className="flex-row flex-wrap gap-1.5">
            {statusOptions.map(s => (
              <Chip
                key={s.key}
                label={s.label}
                color={s.color}
                active={status === s.key}
                onPress={() => setStatus(s.key)}
              />
            ))}
          </View>
        </Field>

        <Field
          label="Tag"
          required
          hint={
            tagOptions.length < 6
              ? `“${activeView?.name}” only shows these tags.`
              : null
          }
        >
          <View className="flex-row flex-wrap gap-1.5">
            {tagOptions.map(t => (
              <Chip
                key={t.key}
                label={t.label}
                color={t.color}
                active={tag === t.key}
                onPress={() => setTag(t.key)}
              />
            ))}
          </View>
        </Field>

        <Field
          label="Assignees"
          right={
            assigneeIds.length > 0 ? (
              <Text className="text-xs text-text-subtle">
                {assigneeIds.length} selected
              </Text>
            ) : null
          }
          hint={
            isServerBacked && (toAssign.length > 0 || toUnassign.length > 0)
              ? `${[
                  toAssign.length > 0 ? `${toAssign.length} to add` : null,
                  toUnassign.length > 0
                    ? `${toUnassign.length} to remove`
                    : null,
                ]
                  .filter(Boolean)
                  .join(
                    ', ',
                  )} when you save. Removing someone needs permission on the task — it’ll be skipped (not blocked) if you don’t have it.`
              : assigneeIds.length === 0
              ? 'Nobody selected — this task will be unassigned.'
              : !isServerBacked && assigneeIds.includes(CURRENT_USER_ID)
              ? 'You’re on this task — you can add others, but not remove yourself.'
              : null
          }
        >
          <MultiSelectDropdown
            label="Assignees"
            options={pickablePeople
              .filter(m => !isServerBacked || m.id !== CURRENT_USER_ID)
              .filter(m => m.id !== taskOwnerId && m.id !== taskCreatorId)
              .map(m => ({
                id: m.id,
                label: m.name,
                hint: m.email,
                color: m.color,
                locked: !isServerBacked && m.id === CURRENT_USER_ID,
                lockedLabel: 'You',
              }))}
            selectedIds={assigneeIds}
            onToggle={toggleAssignee}
            onQueryChange={setAssigneeQuery}
            placeholder="Select people"
          />
        </Field>

        {/* Start and due side by side, each one picker for its date and time
            (empty time = all day). Ordering errors show at once — they're caused
            by the other field, not by typing. */}
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Field label="Start" required error={show(errors.start)}>
              <DateTimeField
                value={{ date: start, time: startTime }}
                onChange={v => {
                  if (v.date !== start) {
                    changeStart(v.date);
                  }
                  setStartTime(v.time);
                }}
                invalid={!!show(errors.start)}
                accessibilityLabel="Start"
              />
            </Field>
          </View>
          <View className="flex-1">
            <Field label="Due" required error={endError}>
              <DateTimeField
                value={{ date: end, time: endTime }}
                onChange={v => {
                  setEnd(v.date);
                  setEndTime(v.time);
                }}
                min={validDate(start) ? start : undefined}
                invalid={!!endError}
                accessibilityLabel="Due"
              />
            </Field>
          </View>
        </View>
      </SheetBody>

      <SheetFooter>
        <Button variant="ghost" onPress={close} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onPress={save}
          loading={saving}
          disabled={!canSaveNow || (attempted && !valid)}
        >
          {editing ? 'Save changes' : parent ? 'Create subtask' : 'Create task'}
        </Button>
      </SheetFooter>
    </Sheet>
  );
}
