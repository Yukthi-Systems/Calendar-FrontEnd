import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useAtom, useSetAtom } from 'jotai';
import { addDays, format, isValid, parse } from 'date-fns';
import { Plus, X } from 'lucide-react-native';
import {
  itemFormAtom,
  itemsAtom,
  selectedItemIdAtom,
} from '../../atoms/project';
import { PRIORITY_COLOR, STATUSES } from '../../data/constants';
import { CURRENT_USER_ID, MEMBERS } from '../../data/mockData';
import {
  RECURRENCE_LABEL,
  yearlyRecurrenceNeedsLeapWarning,
} from '../../data/recurrence';
import type {
  Priority,
  RecurrenceFreq,
  Reminder,
  Status,
  WorkItem,
} from '../../data/types';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Field, FormInput as Input, MultiSelectDropdown } from './shared';

const DATE_FMT = 'yyyy-MM-dd';
const PRIORITIES: Priority[] = ['low', 'medium', 'high'];
const RECURRENCES: RecurrenceFreq[] = [
  'weekly',
  'monthly',
  'quarterly',
  'yearly',
];
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
  const [items, setItems] = useAtom(itemsAtom);
  const setSelected = useSetAtom(selectedItemIdAtom);

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
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [labels, setLabels] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceFreq | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  // Must be explicitly ticked before saving a yearly recurrence anchored on
  // Feb 29 — see the warning banner below.
  const [leapAck, setLeapAck] = useState(false);
  const { text: textColor } = useThemeColors();

  // You can always add yourself, but never remove yourself — only someone
  // else can do that (see src/data/permissions.ts).
  const toggleAssignee = (id: string) =>
    setAssigneeIds(prev => {
      if (prev.includes(id)) {
        return id === CURRENT_USER_ID ? prev : prev.filter(x => x !== id);
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
    setAssigneeIds(editing ? editing.assigneeIds : parent?.assigneeIds ?? []);
    setStart(editing?.start ?? parent?.start ?? format(today, DATE_FMT));
    setEnd(editing?.end ?? parent?.end ?? format(addDays(today, 2), DATE_FMT));
    setLabels(editing?.labels.join(', ') ?? '');
    setRecurrence(editing?.recurrence ?? null);
    setReminders(editing?.reminders ?? []);
    setLeapAck(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  // A yearly recurrence anchored on Feb 29 needs an explicit confirmation
  // that non-leap years will land on Feb 28 instead — see the brief: "give a
  // warning... confirm that we do... before" (i.e. before saving, not after).
  const needsLeapWarning =
    recurrence === 'yearly' &&
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

  const errors = {
    title: title.trim() ? null : 'Title is required',
    start: validDate(start) ? null : 'Use YYYY-MM-DD',
    end: !validDate(end)
      ? 'Use YYYY-MM-DD'
      : validDate(start) && end < start
      ? 'End is before start'
      : null,
    reminders: reminders.some(r => !validTime(r.time)) ? 'Use HH:mm' : null,
  };
  const valid =
    !Object.values(errors).some(Boolean) && (!needsLeapWarning || leapAck);

  const save = () => {
    if (!valid) {
      return;
    }
    const fields = {
      title: title.trim(),
      description: description.trim(),
      status,
      priority,
      assigneeIds,
      start,
      end,
      labels: labels
        .split(',')
        .map(l => l.trim())
        .filter(Boolean),
      recurrence,
      reminders,
    };
    if (editing) {
      // createdById never changes via edit — who opened a task is fixed.
      setItems(prev =>
        prev.map(i => (i.id === editing.id ? { ...i, ...fields } : i)),
      );
    } else {
      const next =
        Math.max(100, ...items.map(i => Number(i.id.replace(/\D/g, '')) || 0)) +
        1;
      const created: WorkItem = {
        id: `YTC-${next}`,
        parentId: parent?.id ?? null,
        createdById: CURRENT_USER_ID,
        ...fields,
      };
      setItems(prev => [...prev, created]);
      setSelected(created.id);
    }
    close();
  };

  return (
    <Modal
      visible={!!form}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <Pressable
          accessibilityLabel="Close"
          onPress={close}
          className="flex-1 items-center justify-end bg-black/50 sm:justify-center"
        >
          <Pressable
            onPress={() => {}}
            className="max-h-[92%] w-full max-w-lg rounded-t-3xl bg-bg-card p-5 sm:rounded-3xl"
          >
            <Text className="mb-3 text-lg font-bold text-text-heading">
              {editing
                ? `Edit ${editing.id}`
                : parent
                ? `New subtask of ${parent.id}`
                : 'New item'}
            </Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Field label="Title *" error={title ? null : errors.title}>
                <Input
                  value={title}
                  onChangeText={setTitle}
                  placeholder="What needs doing?"
                />
              </Field>
              <Field label="Description">
                <Input
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Optional details"
                  multiline
                />
              </Field>

              <Field label="Status">
                <View className="flex-row flex-wrap gap-2">
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

              <Field label="Priority">
                <View className="flex-row flex-wrap gap-2">
                  {PRIORITIES.map(p => (
                    <Chip
                      key={p}
                      label={p}
                      color={PRIORITY_COLOR[p]}
                      active={priority === p}
                      onPress={() => setPriority(p)}
                    />
                  ))}
                </View>
              </Field>

              <Field
                label={`Assignees${
                  assigneeIds.length > 0 ? ` (${assigneeIds.length})` : ''
                }`}
              >
                <MultiSelectDropdown
                  label="Assignees"
                  options={MEMBERS.map(m => ({
                    id: m.id,
                    label: m.name,
                    color: m.color,
                    locked:
                      m.id === CURRENT_USER_ID && assigneeIds.includes(m.id),
                  }))}
                  selectedIds={assigneeIds}
                  onToggle={toggleAssignee}
                  placeholder="Select assignees"
                />
                {assigneeIds.length === 0 ? (
                  <Text className="mt-1 text-xs text-text-main">
                    Nobody selected — this task will be unassigned.
                  </Text>
                ) : assigneeIds.includes(CURRENT_USER_ID) ? (
                  <Text className="mt-1 text-xs text-text-main">
                    You're on this task — you can add others, but you can't
                    remove yourself.
                  </Text>
                ) : null}
              </Field>

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Field label="Start *" error={errors.start}>
                    <Input
                      value={start}
                      onChangeText={setStart}
                      placeholder="YYYY-MM-DD"
                    />
                  </Field>
                </View>
                <View className="flex-1">
                  <Field label="Due (End) *" error={errors.end}>
                    <Input
                      value={end}
                      onChangeText={setEnd}
                      placeholder="YYYY-MM-DD"
                    />
                  </Field>
                </View>
              </View>

              <Field label="Labels">
                <Input
                  value={labels}
                  onChangeText={setLabels}
                  placeholder="frontend, bug"
                />
              </Field>

              <Field label="Repeats">
                <View className="flex-row flex-wrap gap-2">
                  <Chip
                    label="Doesn't repeat"
                    active={recurrence === null}
                    onPress={() => setRecurrence(null)}
                  />
                  {RECURRENCES.map(r => (
                    <Chip
                      key={r}
                      label={RECURRENCE_LABEL[r]}
                      active={recurrence === r}
                      onPress={() => setRecurrence(r)}
                    />
                  ))}
                </View>
                {recurrence ? (
                  <Text className="mt-1.5 text-xs text-text-main">
                    {recurrence === 'weekly'
                      ? `Repeats every ${
                          validDate(start)
                            ? format(parseDate(start), 'EEEE')
                            : 'week'
                        }.`
                      : recurrence === 'monthly'
                      ? 'Repeats monthly, on this same date.'
                      : recurrence === 'quarterly'
                      ? 'Repeats every 3 months, on this same date.'
                      : 'Repeats yearly, on this same date.'}
                  </Text>
                ) : null}
                {needsLeapWarning ? (
                  <View className="mt-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
                    <Text className="mb-2 text-xs text-text-heading">
                      This date is Feb 29, which only exists in leap years. In
                      every other year this task will land on Feb 28 instead —
                      never March 1.
                    </Text>
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: leapAck }}
                      onPress={() => setLeapAck(a => !a)}
                      className="flex-row items-center gap-2"
                    >
                      <View
                        style={
                          leapAck ? { backgroundColor: '#d97706' } : undefined
                        }
                        className="h-5 w-5 items-center justify-center rounded-md border border-border-main"
                      >
                        {leapAck ? (
                          <Text className="text-xs text-white">✓</Text>
                        ) : null}
                      </View>
                      <Text className="flex-1 text-xs text-text-heading">
                        I understand — confirm to continue.
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </Field>

              <Field
                label={`Reminders${
                  reminders.length > 0
                    ? ` (${reminders.length}/${MAX_REMINDERS})`
                    : ''
                }`}
                error={errors.reminders}
              >
                <View className="gap-2">
                  {reminders.map(r => (
                    <View
                      key={r.id}
                      className="flex-row items-center gap-2 rounded-xl border border-border-main p-2"
                    >
                      <View className="flex-1">
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
                      <View className="w-20">
                        <Input
                          value={r.time}
                          onChangeText={t => updateReminder(r.id, { time: t })}
                          placeholder="HH:mm"
                        />
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Remove reminder"
                        onPress={() => removeReminder(r.id)}
                        className="h-8 w-8 items-center justify-center rounded-md active:opacity-60"
                      >
                        <X size={16} color={textColor} />
                      </Pressable>
                    </View>
                  ))}
                  {reminders.length < MAX_REMINDERS ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={addReminder}
                      className="flex-row items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-main py-2.5 active:opacity-70"
                    >
                      <Plus size={14} color={textColor} />
                      <Text className="text-sm text-text-main">
                        Add reminder
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </Field>
            </ScrollView>

            <View className="mt-3 flex-row gap-2">
              <Pressable
                accessibilityRole="button"
                onPress={close}
                className="flex-1 items-center rounded-2xl border border-border-main py-3 active:opacity-70"
              >
                <Text className="text-text-heading">Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !valid }}
                disabled={!valid}
                onPress={save}
                className={`flex-1 items-center rounded-2xl bg-accent py-3 active:opacity-80 ${
                  valid ? '' : 'opacity-40'
                }`}
              >
                <Text className="font-semibold text-accent-foreground">
                  {editing ? 'Save' : 'Create'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Chip({
  label,
  color,
  active,
  onPress,
  role = 'radio',
}: {
  label: string;
  color?: string;
  active: boolean;
  onPress: () => void;
  role?: 'radio' | 'checkbox';
}) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={
        role === 'checkbox' ? { checked: active } : { selected: active }
      }
      onPress={onPress}
      style={active ? { backgroundColor: color ?? '#6b7280' } : undefined}
      className="rounded-full border border-border-main px-3 py-1.5 active:opacity-70"
    >
      <Text className={active ? 'text-white' : 'text-text-heading'}>
        {label}
      </Text>
    </Pressable>
  );
}
