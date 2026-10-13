import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { format, isValid, parseISO } from 'date-fns';
import { ChevronDown, Search, SearchX, X } from 'lucide-react-native';
import {
  itemsAtom,
  searchOpenAtom,
  searchTitleAtom,
  selectedItemIdAtom,
} from '../../atoms/project';
import { STATUSES } from '../../data/constants';
import { currentUserIdAtom } from '../../atoms/members';
import { useMyProfile, usePerson, useUserSearch } from '../../hooks/useUsers';
import type { SearchCriteria } from '../../data/search';
import { searchItems } from '../../data/search';
import type { WorkItem } from '../../data/types';
import { useThemeColors } from '../../hooks/useThemeColors';
import {
  Chip,
  DateField,
  EmptyState,
  IconButton,
  Input,
  Kbd,
  Press,
  Sheet,
  Switch,
} from '../ui';
import { Avatar, AssigneeAvatars, DueDate, StatusIcon } from './shared';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const isIsoDate = (s: string) =>
  DATE_PATTERN.test(s) && isValid(parseISO(s));

// Search for your own top-level tasks. Status is mandatory; everything else
// narrows the results further.
export function SearchModal() {
  const [open, setOpen] = useAtom(searchOpenAtom);
  const items = useAtomValue(itemsAtom);
  const CURRENT_USER_ID = useAtomValue(currentUserIdAtom);
  const setSelectedId = useSetAtom(selectedItemIdAtom);
  const c = useThemeColors();

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
  }, [
    items,
    CURRENT_USER_ID,
    title,
    assigneeId,
    status,
    dueFrom,
    dueTo,
    oldUnfinishedOnly,
    dateError,
  ]);

  // Me first, then org email-search hits for what's typed (GET /user/search).
  const me = useMyProfile();
  const { people: searchHits } = useUserSearch(assigneeQuery);
  const assigneeOptions = [me, ...searchHits.filter(p => p.id !== me.id)].filter(
    p =>
      !assigneeQuery.trim() ||
      p.id !== me.id ||
      p.name.toLowerCase().includes(assigneeQuery.trim().toLowerCase()),
  );
  const selectedAssignee = usePerson(assigneeId);

  return (
    <Sheet visible={open} onClose={close} size="lg">
      <View className="flex-row items-center gap-2 border-b border-border-main px-4 py-3">
        <Search size={18} color={c.subtle} />
        <Input
          accessibilityLabel="Title contains"
          value={title}
          onChangeText={setTitle}
          placeholder="Search your tasks by title…"
          bare
          autoFocus
          returnKeyType="search"
          style={{ fontSize: 16 }}
          right={<Kbd>esc</Kbd>}
        />
        <IconButton icon={X} label="Close search" onPress={close} />
      </View>

      <ScrollView
        style={{ flexGrow: 0, flexShrink: 1 }}
        contentContainerClassName="pb-4"
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-3 border-b border-border-main bg-muted/40 px-5 py-4">
          <View>
            <Text className="mb-1.5 text-xs font-medium text-text-heading">
              Status <Text className="text-text-subtle">· required</Text>
            </Text>
            <View className="flex-row flex-wrap gap-1.5">
              {STATUSES.map(st => (
                <Chip
                  key={st.key}
                  label={st.label}
                  color={st.color}
                  active={st.key === status}
                  onPress={() => setStatus(prev => (prev === st.key ? null : st.key))}
                />
              ))}
            </View>
          </View>

          <View className="flex-row flex-wrap gap-3">
            <View style={{ flexBasis: 200, flexGrow: 1 }}>
              <Text className="mb-1.5 text-xs font-medium text-text-heading">Assignee</Text>
              <Press
                feedback="none"
                accessibilityRole="button"
                accessibilityState={{ expanded: assigneeOpen }}
                onPress={() => setAssigneeOpen(o => !o)}
                className="h-9 flex-row items-center gap-2 rounded-lg border border-border-main bg-bg-card px-3 hover:border-border-strong"
              >
                {selectedAssignee ? <Avatar id={selectedAssignee.id} size={18} /> : null}
                <Text
                  numberOfLines={1}
                  className={`flex-1 text-sm ${
                    selectedAssignee ? 'text-text-heading' : 'text-text-subtle'
                  }`}
                >
                  {selectedAssignee ? selectedAssignee.name : 'Anyone'}
                </Text>
                <ChevronDown size={15} color={c.subtle} />
              </Press>
            </View>
            <View style={{ flexBasis: 130, flexGrow: 1 }}>
              <Text className="mb-1.5 text-xs font-medium text-text-heading">Due from</Text>
              <DateField
                value={dueFrom}
                onChange={setDueFrom}
                clearable
                placeholder="Any date"
                invalid={!!fromError}
                accessibilityLabel="Due from"
              />
            </View>
            <View style={{ flexBasis: 130, flexGrow: 1 }}>
              <Text className="mb-1.5 text-xs font-medium text-text-heading">Due to</Text>
              <DateField
                value={dueTo}
                onChange={setDueTo}
                clearable
                placeholder="Any date"
                min={dueFrom || undefined}
                invalid={!!(toError ?? rangeError)}
                accessibilityLabel="Due to"
              />
            </View>
          </View>

          {assigneeOpen ? (
            <View className="rounded-lg border border-border-main bg-bg-card p-1.5">
              <Input
                size="sm"
                icon={Search}
                value={assigneeQuery}
                onChangeText={setAssigneeQuery}
                placeholder="Search people by email…"
                autoFocus
              />
              <ScrollView className="mt-1.5 max-h-48">
                <Press
                  feedback="none"
                  accessibilityRole="button"
                  onPress={() => {
                    setAssigneeId(null);
                    setAssigneeOpen(false);
                  }}
                  className="rounded-md px-2 py-1.5 hover:bg-hover"
                >
                  <Text className="text-sm text-text-main">Anyone</Text>
                </Press>
                {assigneeOptions.map(m => (
                  <Press
                    key={m.id}
                    feedback="none"
                    accessibilityRole="button"
                    onPress={() => {
                      setAssigneeId(m.id);
                      setAssigneeOpen(false);
                      setAssigneeQuery('');
                    }}
                    className={`flex-row items-center gap-2 rounded-md px-2 py-1.5 hover:bg-hover ${
                      m.id === assigneeId ? 'bg-hover' : ''
                    }`}
                  >
                    <Avatar id={m.id} size={20} />
                    <Text className="text-sm text-text-heading">{m.name}</Text>
                  </Press>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {dateError ? <Text className="text-xs text-destructive">{dateError}</Text> : null}

          <Switch
            value={oldUnfinishedOnly}
            onChange={setOldUnfinishedOnly}
            label="Only overdue, unfinished tasks"
            description="Due before today and not completed or rejected — ignores the due range."
          />
        </View>

        <View className="px-3 pt-3">
          {results && results.length > 0 ? (
            <Text className="mb-1 px-2 text-2xs font-semibold uppercase tracking-wider text-text-subtle">
              {results.length} {results.length === 1 ? 'result' : 'results'}
            </Text>
          ) : null}
          {dateError ? (
            <EmptyState compact icon={SearchX} title="Check the due dates" description="Fix the date range above to see results." />
          ) : results === null ? (
            <EmptyState compact icon={Search} title="Pick a status to search" description="Searches the top-level tasks you created. Narrow it down with title, assignee and due dates." />
          ) : results.length === 0 ? (
            <EmptyState compact icon={SearchX} title="No matching tasks" description="Try another status or loosen the filters." />
          ) : (
            results.map(item => (
              <Press
                key={item.id}
                feedback="subtle"
                accessibilityRole="button"
                accessibilityLabel={`Open ${item.title}`}
                onPress={() => openItem(item)}
                className="flex-row items-center gap-3 rounded-lg px-2 py-2 hover:bg-hover"
              >
                <StatusIcon status={item.status} />
                <View className="flex-1">
                  <Text numberOfLines={1} className="text-sm font-medium text-text-heading">
                    {item.title}
                  </Text>
                </View>
                <DueDate item={item} className="text-xs" />
                <AssigneeAvatars ids={item.assigneeIds} size={20} />
              </Press>
            ))
          )}
        </View>
      </ScrollView>
    </Sheet>
  );
}
