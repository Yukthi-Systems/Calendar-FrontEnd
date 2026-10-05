import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { format, isValid, parseISO } from 'date-fns';
import { ChevronDown, X } from 'lucide-react-native';
import {
  itemsAtom,
  searchOpenAtom,
  searchTitleAtom,
  selectedItemIdAtom,
} from '../../atoms/project';
import { STATUSES } from '../../data/constants';
import { CURRENT_USER_ID, MEMBERS } from '../../data/mockData';
import type { SearchCriteria } from '../../data/search';
import { searchItems } from '../../data/search';
import type { WorkItem } from '../../data/types';
import { useThemeColors } from '../../hooks/useThemeColors';
import {
  AssigneeAvatars,
  Field,
  FormInput,
  StatusDot,
  assigneeNames,
} from './shared';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const isIsoDate = (s: string) =>
  DATE_PATTERN.test(s) && isValid(parseISO(s));

// Search for your own top-level tasks. Status is mandatory; everything else
// narrows the results further.
export function SearchModal() {
  const [open, setOpen] = useAtom(searchOpenAtom);
  const items = useAtomValue(itemsAtom);
  const setSelectedId = useSetAtom(selectedItemIdAtom);
  const { text, accent } = useThemeColors();

  const [title, setTitle] = useAtom(searchTitleAtom);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [assigneeQuery, setAssigneeQuery] = useState('');
  const [status, setStatus] = useState<SearchCriteria['status'] | null>(null);
  const [dueFrom, setDueFrom] = useState('');
  const [dueTo, setDueTo] = useState('');
  const [oldUnfinishedOnly, setOldUnfinishedOnly] = useState(false);

  const close = () => setOpen(false);
  const openItem = (item: WorkItem) => {
    setOpen(false);
    setSelectedId(item.id);
  };

  const fromError =
    dueFrom && !isIsoDate(dueFrom) ? 'Use YYYY-MM-DD' : null;
  const toError = dueTo && !isIsoDate(dueTo) ? 'Use YYYY-MM-DD' : null;
  const rangeError =
    !fromError && !toError && dueFrom && dueTo && dueFrom > dueTo
      ? 'From is after To'
      : null;
  const dateError = fromError ?? toError ?? rangeError;

  const results = useMemo(() => {
    if (!status || dateError) {
      return null;
    }
    return searchItems(
      items,
      CURRENT_USER_ID,
      {
        title,
        assigneeId,
        status,
        dueFrom: dueFrom || null,
        dueTo: dueTo || null,
        oldUnfinishedOnly,
      },
      format(new Date(), 'yyyy-MM-dd'),
    );
  }, [items, title, assigneeId, status, dueFrom, dueTo, oldUnfinishedOnly, dateError]);

  const assigneeOptions = MEMBERS.filter(m =>
    m.name.toLowerCase().includes(assigneeQuery.trim().toLowerCase()),
  );
  const selectedAssignee = MEMBERS.find(m => m.id === assigneeId);

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
      <Pressable
        accessibilityLabel="Close"
        onPress={close}
        className="flex-1 items-center justify-end bg-black/50 sm:justify-center"
      >
        <Pressable
          onPress={() => {}}
          className="max-h-[92%] w-full max-w-lg rounded-t-3xl bg-bg-card p-5 sm:rounded-3xl"
        >
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-lg font-bold text-text-heading">Search</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close search"
              onPress={close}
              className="rounded-md p-1 active:opacity-70"
            >
              <X size={18} color={text} />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            <Field label="Title contains">
              <FormInput
                accessibilityLabel="Title contains"
                value={title}
                onChangeText={setTitle}
                placeholder="Search by title"
              />
            </Field>

            <Field label="Assignee (one)">
              <Pressable
                accessibilityRole="button"
                onPress={() => setAssigneeOpen(o => !o)}
                className="flex-row items-center justify-between rounded-xl border border-border-main px-3 py-2.5 active:opacity-70"
              >
                <Text
                  className={selectedAssignee ? 'text-text-heading' : 'text-text-main'}
                >
                  {selectedAssignee ? selectedAssignee.name : 'Anyone'}
                </Text>
                <ChevronDown size={16} color={text} />
              </Pressable>
              {assigneeOpen ? (
                <View className="mt-2 rounded-xl border border-border-main p-2">
                  <FormInput
                    value={assigneeQuery}
                    onChangeText={setAssigneeQuery}
                    placeholder="Filter people"
                  />
                  <ScrollView className="mt-2 max-h-48">
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        setAssigneeId(null);
                        setAssigneeOpen(false);
                      }}
                      className="rounded-lg px-2 py-2 active:opacity-70"
                    >
                      <Text className="text-text-main">Anyone</Text>
                    </Pressable>
                    {assigneeOptions.map(m => (
                      <Pressable
                        key={m.id}
                        accessibilityRole="button"
                        onPress={() => {
                          setAssigneeId(m.id);
                          setAssigneeOpen(false);
                          setAssigneeQuery('');
                        }}
                        className="flex-row items-center gap-2 rounded-lg px-2 py-2 active:opacity-70"
                      >
                        <AssigneeAvatars ids={[m.id]} size={20} />
                        <Text className="text-text-heading">{m.name}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </Field>

            <Field label="Status *">
              <View className="flex-row flex-wrap gap-2">
                {STATUSES.map(s => {
                  const active = s.key === status;
                  return (
                    <Pressable
                      key={s.key}
                      accessibilityRole="button"
                      onPress={() => setStatus(s.key)}
                      style={active ? { backgroundColor: s.color } : undefined}
                      className="rounded-full border border-border-main px-3 py-1.5 active:opacity-70"
                    >
                      <Text className={active ? 'text-white' : 'text-text-heading'}>
                        {s.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {!status ? (
                <Text className="mt-1 text-xs text-text-main">
                  Pick a status to see results.
                </Text>
              ) : null}
            </Field>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Field label="Due from" error={fromError}>
                  <FormInput
                    value={dueFrom}
                    onChangeText={setDueFrom}
                    placeholder="YYYY-MM-DD"
                    editable={!oldUnfinishedOnly}
                  />
                </Field>
              </View>
              <View className="flex-1">
                <Field label="Due to" error={toError ?? rangeError}>
                  <FormInput
                    value={dueTo}
                    onChangeText={setDueTo}
                    placeholder="YYYY-MM-DD"
                    editable={!oldUnfinishedOnly}
                  />
                </Field>
              </View>
            </View>

            <View className="mb-4 flex-row items-center justify-between gap-3">
              <Text className="flex-1 text-sm text-text-heading">
                Show old unfinished tasks
                <Text className="text-xs text-text-main">
                  {' '}(due before today, not completed or rejected; ignores the due range)
                </Text>
              </Text>
              <Switch
                value={oldUnfinishedOnly}
                onValueChange={setOldUnfinishedOnly}
                trackColor={{ true: accent }}
              />
            </View>

            <Text className="mb-2 text-xs font-semibold uppercase text-text-main">
              Results{results ? ` (${results.length})` : ''}
            </Text>
            {dateError ? (
              <Text className="mb-4 text-sm text-text-main">
                Fix the due dates to see results.
              </Text>
            ) : results === null ? (
              <Text className="mb-4 text-sm text-text-main">
                Choose a status to start searching.
              </Text>
            ) : results.length === 0 ? (
              <Text className="mb-4 text-sm text-text-main">No matching tasks.</Text>
            ) : (
              <View className="mb-4 gap-2">
                {results.map(item => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    onPress={() => openItem(item)}
                    className="flex-row items-center gap-2 rounded-xl border border-border-main px-3 py-2 active:opacity-70"
                  >
                    <StatusDot status={item.status} />
                    <View className="flex-1">
                      <Text numberOfLines={1} className="text-sm font-medium text-text-heading">
                        {item.title}
                      </Text>
                      <Text className="text-[11px] text-text-main">
                        {item.id} · due {item.end} · {assigneeNames(item.assigneeIds) || 'Unassigned'}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
