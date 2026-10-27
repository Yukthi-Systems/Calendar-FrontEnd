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
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react-native';
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
import { yearlyRecurrenceNeedsLeapWarning } from '../../data/recurrence';
import {
  RRULE_PRESETS,
  RRuleError,
  describeRRule,
  expandRRule,
  migrateRecurrence,
  normalizeRRule,
  parseRRule,
} from '../../data/rrule';
import type { Reminder, Status, TaskTag } from '../../data/types';
import { useThemeColors } from '../../hooks/useThemeColors';
import { errorMessage, toast } from '../../atoms/feedback';
import {
  Button,
  Callout,
  Checkbox,
  Chip,
  DateField,
  DateTimeField,
  Field,
  IconButton,
  Input,
  Press,
  Sheet,
  SheetBody,
  SheetFooter,
  SheetHeader,
} from '../ui';
import { MultiSelectDropdown } from './shared';

const DATE_FMT = 'yyyy-MM-dd';
const REMINDER_OFFSETS = [
  { days: 0, label: 'On due date' },
  { days: 1, label: '1 day before' },
  { days: 2, label: '2 days before' },
  { days: 3, label: '3 days before' },
  { days: 7, label: '1 week before' },
];
const MAX_REMINDERS = 2;
const DEFAULT_REMINDER_TIME = '09:00';

const parseDate = (s: string) => parse(s, DATE_FMT, new Date());
const validDate = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) && isValid(parseDate(s));
const validTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

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
  const statusOptions = allowedStatuses(activeView?.statusFilter);
  const tagOptions = allowedTags(activeView?.tagFilter);

  const parent =
    form?.mode === 'new' && form.parentId
      ? items.find(i => i.id === form.parentId)
      : undefined;

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
  // Stored as an RRULE string. Presets set it directly; "Custom" edits the raw text.
  const [recurrence, setRecurrence] = useState<string | null>(null);
  const [customRule, setCustomRule] = useState(false);
  const [customText, setCustomText] = useState('');
  const [reminders, setReminders] = useState<Reminder[]>([]);
  // Must be explicitly ticked before saving a yearly recurrence anchored on
  // Feb 29 — see the warning banner below.
  const [leapAck, setLeapAck] = useState(false);
  // Errors stay quiet until the first save attempt — no red text on a form
  // you've only just opened.
  const [attempted, setAttempted] = useState(false);
  // Labels / repeats / reminders live behind "More options" unless in use.
  const [moreOpen, setMoreOpen] = useState(false);
  const c = useThemeColors();

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
    // Prefilled from a recurring template's "Create task" action — title,
    // description, tag and time of day, same fields the template itself has.
    const fromTemplate = form.mode === 'new' ? form.fromTemplate : undefined;
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
    setStart(
      editing?.start ?? parent?.start ?? format(presetStart ?? today, DATE_FMT),
    );
    setEnd(
      editing?.end ?? parent?.end ?? format(presetStart ?? today, DATE_FMT),
    );
    // Editing keeps the task's own times (none = all day); a subtask starts with
    // its parent's; a template's time of day (if it set one) carries over to
    // both ends; anything else brand new defaults to all day — a time is only
    // ever set if the person (or the template) actually gave one.
    const source = editing ?? parent;
    setStartTime(source?.startTime ?? fromTemplate?.time ?? '');
    setEndTime(source?.endTime ?? fromTemplate?.time ?? '');
    const savedRule = migrateRecurrence(editing?.recurrence);
    setRecurrence(savedRule);
    setCustomRule(
      !!savedRule &&
        !RRULE_PRESETS.some(p => p.rule === safeNormalize(savedRule)),
    );
    setCustomText(savedRule ?? '');
    setReminders(editing?.reminders ?? []);
    setLeapAck(false);
    setAttempted(false);
    setMoreOpen(
      !!editing &&
        (!!editing.recurrence || (editing.reminders ?? []).length > 0),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  // A yearly recurrence anchored on Feb 29 needs an explicit confirmation
  // that non-leap years will land on Feb 28 instead — see the brief: "give a
  // warning... confirm that we do... before" (i.e. before saving, not after).
  const parsedRule = (() => {
    if (!recurrence) {
      return null;
    }
    try {
      return parseRRule(recurrence);
    } catch {
      return null;
    }
  })();
  // Free-typed rule text is validated as you type; the saved value only follows once valid.
  const customError = (() => {
    if (!customRule || !customText.trim()) {
      return customRule ? 'Enter an RRULE, e.g. FREQ=WEEKLY;BYDAY=MO,FR' : null;
    }
    try {
      parseRRule(customText);
      return null;
    } catch (err) {
      return err instanceof RRuleError ? err.message : 'Invalid rule';
    }
  })();
  const needsLeapWarning =
    parsedRule?.freq === 'YEARLY' &&
    !parsedRule.byMonthDay &&
    !parsedRule.byDay &&
    validDate(start) &&
    yearlyRecurrenceNeedsLeapWarning(parseDate(start));

  const addReminder = () =>
    setReminders(prev =>
      prev.length >= MAX_REMINDERS
        ? prev
        : [
            ...prev,
            {
              id: `rem-${Date.now()}`,
              offsetDays: 0,
              time: DEFAULT_REMINDER_TIME,
            },
          ],
    );
  const updateReminder = (id: string, patch: Partial<Reminder>) =>
    setReminders(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
  const removeReminder = (id: string) =>
    setReminders(prev => prev.filter(r => r.id !== id));

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

  const errors = {
    title: title.trim() ? null : 'Title is required',
    start: validDate(start) ? null : 'Use YYYY-MM-DD',
    end: !validDate(end)
      ? 'Use YYYY-MM-DD'
      : validDate(start) && end < start
      ? 'Due date is before the start'
      : end === start && startTime && endTime && endTime < startTime
      ? 'Due time is before the start'
      : null,
    reminders: reminders.some(r => !validTime(r.time)) ? 'Use HH:mm' : null,
    recurrence: customError,
  };
  const valid =
    !Object.values(errors).some(Boolean) && (!needsLeapWarning || leapAck);
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
      if (errors.recurrence || errors.reminders || needsLeapWarning) {
        setMoreOpen(true);
      }
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
      recurrence,
      reminders,
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

        <Press
          feedback="none"
          accessibilityRole="button"
          accessibilityState={{ expanded: moreOpen }}
          onPress={() => setMoreOpen(o => !o)}
          className="mb-3 flex-row items-center gap-1.5 self-start rounded-md py-1 pr-2"
        >
          {moreOpen ? (
            <ChevronDown size={15} color={c.text} />
          ) : (
            <ChevronRight size={15} color={c.text} />
          )}
          <Text className="text-sm font-medium text-text-main hover:text-text-heading">
            More options
          </Text>
          {!moreOpen && (recurrence || reminders.length > 0) ? (
            <Text className="text-xs text-text-subtle">
              ·{' '}
              {[recurrence && 'repeats', reminders.length > 0 && 'reminders']
                .filter(Boolean)
                .join(', ')}
            </Text>
          ) : null}
        </Press>

        {moreOpen ? (
          <View>
            <Field
              label="Repeats"
              error={
                show(errors.recurrence) ??
                (customRule ? errors.recurrence : null)
              }
            >
              <View className="flex-row flex-wrap gap-1.5">
                <Chip
                  label="Doesn’t repeat"
                  active={recurrence === null && !customRule}
                  onPress={() => {
                    setRecurrence(null);
                    setCustomRule(false);
                  }}
                />
                {RRULE_PRESETS.map(p => (
                  <Chip
                    key={p.rule}
                    label={p.label}
                    active={!customRule && recurrence === p.rule}
                    onPress={() => {
                      setRecurrence(p.rule);
                      setCustomRule(false);
                      setCustomText(p.rule);
                    }}
                  />
                ))}
                <Chip
                  label="Custom"
                  active={customRule}
                  onPress={() => {
                    setCustomRule(true);
                    setCustomText(recurrence ?? 'FREQ=WEEKLY;BYDAY=MO');
                    setRecurrence(
                      safeNormalize(recurrence ?? 'FREQ=WEEKLY;BYDAY=MO'),
                    );
                  }}
                />
              </View>
              {customRule ? (
                <View className="mt-2">
                  <Input
                    value={customText}
                    onChangeText={(t: string) => {
                      setCustomText(t);
                      setRecurrence(safeNormalize(t));
                    }}
                    placeholder="FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,FR"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    invalid={!!customError}
                  />
                  <Text className="mt-1.5 text-xs text-text-subtle">
                    RFC 5545 RRULE: FREQ, INTERVAL, COUNT or UNTIL, BYDAY,
                    BYMONTHDAY, BYMONTH, BYSETPOS, WKST.
                  </Text>
                </View>
              ) : null}
              {parsedRule ? (
                <Text className="mt-2 text-xs text-text-main">
                  {describeRRule(parsedRule)}
                  {validDate(start)
                    ? ` · next: ${nextDates(parsedRule, start)}`
                    : ''}
                </Text>
              ) : null}
              {needsLeapWarning ? (
                <View className="mt-3">
                  <Callout
                    kind="warning"
                    title="Feb 29 only exists in leap years"
                  >
                    <Text className="mb-2 text-sm text-text-main">
                      In every other year this task will land on Feb 28 instead
                      — never March 1.
                    </Text>
                    <Checkbox
                      checked={leapAck}
                      onChange={setLeapAck}
                      label="I understand — confirm to continue"
                    />
                  </Callout>
                </View>
              ) : null}
            </Field>

            <Field
              label="Reminders"
              right={
                <Text className="text-xs text-text-subtle">
                  {reminders.length}/{MAX_REMINDERS}
                </Text>
              }
              error={show(errors.reminders)}
            >
              <View className="gap-2">
                {reminders.map(r => (
                  <View
                    key={r.id}
                    className="gap-2 rounded-lg border border-border-main bg-muted/50 p-2.5"
                  >
                    <View className="flex-row items-center gap-2">
                      <View className="w-28">
                        <DateField
                          mode="time"
                          value={r.time}
                          onChange={t => updateReminder(r.id, { time: t })}
                          invalid={!validTime(r.time) && attempted}
                          accessibilityLabel="Reminder time"
                        />
                      </View>
                      <View className="flex-1" />
                      <IconButton
                        icon={X}
                        size="sm"
                        label="Remove reminder"
                        onPress={() => removeReminder(r.id)}
                      />
                    </View>
                    <View className="flex-row flex-wrap gap-1.5">
                      {REMINDER_OFFSETS.map(o => (
                        <Chip
                          key={o.days}
                          label={o.label}
                          active={r.offsetDays === o.days}
                          onPress={() =>
                            updateReminder(r.id, { offsetDays: o.days })
                          }
                        />
                      ))}
                    </View>
                  </View>
                ))}
                {reminders.length < MAX_REMINDERS ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Plus}
                    onPress={addReminder}
                    className="self-start"
                  >
                    Add reminder
                  </Button>
                ) : null}
              </View>
            </Field>
          </View>
        ) : null}
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

// Canonical text for a rule, or null when it doesn't parse yet (mid-typing).
function safeNormalize(text: string | null): string | null {
  if (!text) {
    return null;
  }
  try {
    return normalizeRRule(text);
  } catch {
    return null;
  }
}

// First few upcoming occurrence dates, for the form's preview line.
function nextDates(rule: ReturnType<typeof parseRRule>, start: string): string {
  const anchor = parse(start, DATE_FMT, new Date());
  const hits = expandRRule(rule, anchor, anchor, addDays(anchor, 366 * 3));
  return (
    hits
      .slice(0, 3)
      .map(h => format(h.date, 'MMM d'))
      .join(', ') || '—'
  );
}
