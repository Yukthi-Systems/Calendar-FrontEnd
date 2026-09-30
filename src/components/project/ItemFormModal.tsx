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
import {
  itemFormAtom,
  itemsAtom,
  selectedItemIdAtom,
} from '../../atoms/project';
import { PRIORITY_COLOR, STATUSES } from '../../data/constants';
import { MEMBERS } from '../../data/mockData';
import type { Priority, Status, WorkItem } from '../../data/types';
import { Field, FormInput as Input, MultiSelectDropdown } from './shared';

const DATE_FMT = 'yyyy-MM-dd';
const PRIORITIES: Priority[] = ['low', 'medium', 'high'];

const parseDate = (s: string) => parse(s, DATE_FMT, new Date());
const validDate = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) && isValid(parseDate(s));

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
  const [status, setStatus] = useState<Status>('todo');
  const [priority, setPriority] = useState<Priority>('medium');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [labels, setLabels] = useState('');

  const toggleAssignee = (id: string) =>
    setAssigneeIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );

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
        'todo',
    );
    setPriority(editing?.priority ?? 'medium');
    setAssigneeIds(editing ? editing.assigneeIds : parent?.assigneeIds ?? []);
    setStart(editing?.start ?? parent?.start ?? format(today, DATE_FMT));
    setEnd(editing?.end ?? parent?.end ?? format(addDays(today, 2), DATE_FMT));
    setLabels(editing?.labels.join(', ') ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  const close = () => setForm(null);

  const errors = {
    title: title.trim() ? null : 'Title is required',
    start: validDate(start) ? null : 'Use YYYY-MM-DD',
    end: !validDate(end)
      ? 'Use YYYY-MM-DD'
      : validDate(start) && end < start
      ? 'End is before start'
      : null,
  };
  const valid = !Object.values(errors).some(Boolean);

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
    };
    if (editing) {
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
              <Field label="Title" error={title ? null : errors.title}>
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
                  }))}
                  selectedIds={assigneeIds}
                  onToggle={toggleAssignee}
                  placeholder="Select assignees"
                />
                {assigneeIds.length === 0 ? (
                  <Text className="mt-1 text-xs text-text-main">
                    Nobody selected — this task will be unassigned.
                  </Text>
                ) : null}
              </Field>

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Field label="Start" error={errors.start}>
                    <Input
                      value={start}
                      onChangeText={setStart}
                      placeholder="YYYY-MM-DD"
                    />
                  </Field>
                </View>
                <View className="flex-1">
                  <Field label="End" error={errors.end}>
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
                <Text className="font-semibold text-white">
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
