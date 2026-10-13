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
import { PRIORITY_COLOR, STATUSES, TAGS } from '../../data/constants';
import { currentUserIdAtom } from '../../atoms/members';
import { useMyProfile, usePeople, useUserSearch, type Person } from '../../hooks/useUsers';
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
import type { Priority, Reminder, Status, TaskTag } from '../../data/types';
import { useThemeColors } from '../../hooks/useThemeColors';
import { errorMessage, toast } from '../../atoms/feedback';
import {
  Button,
  Callout,
  Checkbox,
  Chip,
  DateField,
  Field,
  IconButton,
  Input,
  Press,
  Sheet,
  SheetBody,
  SheetFooter,
  SheetHeader,
} from '../ui';
import { MultiSelectDropdown, PRIORITY_LABEL } from './shared';

const DATE_FMT = 'yyyy-MM-dd';
const PRIORITIES: Priority[] = ['low', 'medium', 'high'];
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
  const {
    addItem,
    editItem,
    isServerBacked,
    unavailableReason,
  } = useTaskMutations();
  const [saving, setSaving] = useState(false);

  const editing =
    form?.mode === 'edit' ? items.find(i => i.id === form.id) : undefined;

  const parent =
    form?.mode === 'new' && form.parentId
      ? items.find(i => i.id === form.parentId)
      : undefined;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<Status>('not_started');
  const [priority, setPriority] = useState<Priority>('medium');
  const [tag, setTag] = useState<TaskTag>('other');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const selectedPeople = usePeople(assigneeIds);
  const pickablePeople: Person[] = [
    ...new Map(
      [me, ...selectedPeople.values(), ...searchHits].map(p => [p.id, p] as const),
    ).values(),
  ];
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
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
    setTitle(editing?.title ?? '');
    setDescription(editing?.description ?? '');
    setStatus(
      editing?.status ??
        (form.mode === 'new' ? form.status : undefined) ??
        'not_started',
    );
    setPriority(editing?.priority ?? 'medium');
    setTag(editing?.tag ?? 'other');
    setAssigneeIds(editing ? editing.assigneeIds : parent?.assigneeIds ?? []);
    const presetStart =
      form.mode === 'new' && form.start ? parseDate(form.start) : null;
    setStart(
      editing?.start ??
        parent?.start ??
        format(presetStart ?? today, DATE_FMT),
    );
    setEnd(
      editing?.end ??
        parent?.end ??
        format(addDays(presetStart ?? today, presetStart ? 0 : 2), DATE_FMT),
    );
    const savedRule = migrateRecurrence(editing?.recurrence);
    setRecurrence(savedRule);
    setCustomRule(
      !!savedRule && !RRULE_PRESETS.some(p => p.rule === safeNormalize(savedRule)),
    );
    setCustomText(savedRule ?? '');
    setReminders(editing?.reminders ?? []);
    setLeapAck(false);
    setAttempted(false);
    setMoreOpen(
      !!editing &&
        (!!editing.recurrence ||
          (editing.reminders ?? []).length > 0),
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
      priority,
      tag,
      // Assignees are never part of the task's own payload — the API assigns/
      // removes one person per call (`changes` below), separate from the task
      // fields. Server-backed: keep whatever's already confirmed here;
      // local-only: assigneeIds IS the task's assignee list, same as before.
      assigneeIds: isServerBacked ? editing?.assigneeIds ?? [] : assigneeIds,
      start,
      end,
      recurrence,
      reminders,
    };
    const changes = { add: toAssign, remove: toUnassign };
    setSaving(true);
    try {
      // Save, assign, then the list is re-read from the server (useTaskMutations).
      const { failedAssignees } = editing
        ? await editItem({ ...editing, ...fields }, changes)
        : await addItem({ parentId: parent?.id ?? null, ...fields }, changes).then(r => {
            setSelected(r.id);
            return r;
          });
      if (failedAssignees.length > 0) {
        toast.error(
          `Saved, but ${failedAssignees.length} assignee change${
            failedAssignees.length === 1 ? '' : 's'
          } were refused`,
          { description: 'You may not have permission to assign people on this task.' },
        );
      }
      close();
      toast.success(editing ? 'Changes saved' : 'Task created');
    } catch (err) {
      toast.error(editing ? 'Couldn’t save changes' : 'Couldn’t create the task', {
        description: errorMessage(err, 'Please try again.'),
      });
    } finally {
      setSaving(false);
    }
  };

  const show = (e: string | null) => (attempted ? e : null);
  const title_ = editing
    ? 'Edit task'
    : parent
    ? 'New subtask'
    : 'New task';
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

        <Field label="Status">
          <View className="flex-row flex-wrap gap-1.5">
            {STATUSES.map(s => (
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

        <View className="flex-row flex-wrap gap-x-6">
          <Field label="Priority">
            <View className="flex-row flex-wrap gap-1.5">
              {PRIORITIES.map(p => (
                <Chip
                  key={p}
                  label={PRIORITY_LABEL[p]}
                  color={PRIORITY_COLOR[p]}
                  active={priority === p}
                  onPress={() => setPriority(p)}
                />
              ))}
            </View>
          </Field>
          <Field label="Tag" required>
            <View className="flex-row flex-wrap gap-1.5">
              {TAGS.map(t => (
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
        </View>

        <Field
          label="Assignees"
          right={
            assigneeIds.length > 0 ? (
              <Text className="text-xs text-text-subtle">{assigneeIds.length} selected</Text>
            ) : null
          }
          hint={
            isServerBacked && (toAssign.length > 0 || toUnassign.length > 0)
              ? `${[
                  toAssign.length > 0 ? `${toAssign.length} to add` : null,
                  toUnassign.length > 0 ? `${toUnassign.length} to remove` : null,
                ]
                  .filter(Boolean)
                  .join(', ')} when you save. Removing someone needs permission on the task — it’ll be skipped (not blocked) if you don’t have it.`
              : assigneeIds.length === 0
              ? 'Nobody selected — this task will be unassigned.'
              : !isServerBacked && assigneeIds.includes(CURRENT_USER_ID)
              ? 'You’re on this task — you can add others, but not remove yourself.'
              : null
          }
        >
          <MultiSelectDropdown
            label="Assignees"
            options={pickablePeople.filter(
              m => !isServerBacked || m.id !== CURRENT_USER_ID,
            ).map(m => ({
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

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Field label="Start" required error={show(errors.start)}>
              <DateField
                value={start}
                onChange={changeStart}
                invalid={!!show(errors.start)}
                accessibilityLabel="Start date"
              />
            </Field>
          </View>
          <View className="flex-1">
            <Field label="Due" required error={show(errors.end) ?? (end && start && end < start ? errors.end : null)}>
              <DateField
                value={end}
                onChange={setEnd}
                min={validDate(start) ? start : undefined}
                invalid={!!(show(errors.end) || (end && start && end < start))}
                accessibilityLabel="Due date"
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
          {!moreOpen &&
          (recurrence || reminders.length > 0) ? (
            <Text className="text-xs text-text-subtle">
              ·{' '}
              {[
                recurrence && 'repeats',
                reminders.length > 0 && 'reminders',
              ]
                .filter(Boolean)
                .join(', ')}
            </Text>
          ) : null}
        </Press>

        {moreOpen ? (
          <View>
            <Field label="Repeats" error={show(errors.recurrence) ?? (customRule ? errors.recurrence : null)}>
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
                  <Callout kind="warning" title="Feb 29 only exists in leap years">
                    <Text className="mb-2 text-sm text-text-main">
                      In every other year this task will land on Feb 28 instead —
                      never March 1.
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
                          onPress={() => updateReminder(r.id, { offsetDays: o.days })}
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
