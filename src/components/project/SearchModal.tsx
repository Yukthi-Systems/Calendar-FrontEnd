import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useAtom, useSetAtom } from 'jotai';
import { format, parseISO } from 'date-fns';
import { Search, SearchX, X } from 'lucide-react-native';
import {
  itemsAtom,
  searchOpenAtom,
  searchTitleAtom,
  selectedItemIdAtom,
} from '../../atoms/project';
import { allowedStatuses, allowedTags, tagInfo } from '../../data/constants';
import { searchableTitle } from '../../data/taskSync';
import type { Status, TaskTag, WorkItem } from '../../data/types';
import { useActiveView } from '../../hooks/useViews';
import { useTaskSearch } from '../../hooks/useTaskSearch';
import { useThemeColors } from '../../hooks/useThemeColors';
import { errorMessage } from '../../atoms/feedback';
import {
  Badge,
  Button,
  Chip,
  DateTimeField,
  type DateTimeValue,
  EmptyState,
  IconButton,
  Input,
  Kbd,
  Press,
  Sheet,
  Skeleton,
} from '../ui';
import { AssigneeAvatars, StatusIcon } from './shared';

// Search the active view's top-level tasks on the server — exactly what
// POST /tasks/list supports: title contains, any of the statuses, any of the
// tags, and a date range the task lies wholly inside. Statuses/tags offered are
// the view's own (the API refuses anything else); all are on by default.
export function SearchModal() {
  const [open, setOpen] = useAtom(searchOpenAtom);
  const setItems = useSetAtom(itemsAtom);
  const setSelectedId = useSetAtom(selectedItemIdAtom);
  const view = useActiveView();
  const c = useThemeColors();

  const statusOptions = allowedStatuses(view?.statusFilter);
  const tagOptions = allowedTags(view?.tagFilter);

  const [title, setTitle] = useAtom(searchTitleAtom);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [tags, setTags] = useState<TaskTag[]>([]);
  // Date + time ('' time = the whole day); '' date = open-ended.
  const [from, setFrom] = useState<DateTimeValue>({ date: '', time: '' });
  const [to, setTo] = useState<DateTimeValue>({ date: '', time: '' });

  // A different view allows different values — start from all of them.
  const viewId = view?.id;
  useEffect(() => {
    setStatuses(allowedStatuses(view?.statusFilter).map(s => s.key));
    setTags(allowedTags(view?.tagFilter).map(t => t.key));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewId]);

  const toggle = <T,>(list: T[], key: T) =>
    list.includes(key) ? list.filter(k => k !== key) : [...list, key];

  const rangeError =
    from.date &&
    to.date &&
    `${from.date} ${from.time || '00:00'}` > `${to.date} ${to.time || '23:59'}`
      ? '“From” is after “To”.'
      : null;
  const { results, isSearching, isLoading, error, hasMore, loadMore, loadingMore } =
    useTaskSearch(
      view,
      { title, statuses, tags, from: from.date, to: to.date, fromTime: from.time, toTime: to.time },
      open,
    );

  const close = () => setOpen(false);
  const openItem = (item: WorkItem) => {
    // Results are the view's root tasks, normally already listed; if this one
    // isn't (yet), add the server's copy so the detail sheet can show it.
    setItems(prev => (prev.some(i => i.id === item.id) ? prev : [...prev, item]));
    setOpen(false);
    setSelectedId(item.id);
  };

  const typed = title.trim();
  const cleaned = searchableTitle(title);
  const titleNote =
    typed && cleaned !== typed
      ? cleaned
        ? `Searching for “${cleaned}” — only letters, numbers and spaces are matched.`
        : 'Only letters, numbers and spaces are matched — showing every title.'
      : null;

  const blocker =
    statuses.length === 0
      ? 'Pick at least one status.'
      : tags.length === 0
        ? 'Pick at least one tag.'
        : rangeError;

  return (
    <Sheet visible={open} onClose={close} size="lg">
      <View className="flex-row items-center gap-2 border-b border-border-main px-4 py-3">
        <Search size={18} color={c.subtle} />
        <Input
          accessibilityLabel="Title contains"
          value={title}
          onChangeText={setTitle}
          placeholder={view ? `Search “${view.name}” by title…` : 'Search tasks by title…'}
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
          {titleNote ? <Text className="text-xs text-text-subtle">{titleNote}</Text> : null}

          <View>
            <Text className="mb-1.5 text-xs font-medium text-text-heading">Status</Text>
            <View className="flex-row flex-wrap gap-1.5">
              {statusOptions.map(st => (
                <Chip
                  key={st.key}
                  role="checkbox"
                  label={st.label}
                  color={st.color}
                  active={statuses.includes(st.key)}
                  onPress={() => setStatuses(prev => toggle(prev, st.key))}
                />
              ))}
            </View>
          </View>

          <View>
            <Text className="mb-1.5 text-xs font-medium text-text-heading">Tag</Text>
            <View className="flex-row flex-wrap gap-1.5">
              {tagOptions.map(t => (
                <Chip
                  key={t.key}
                  role="checkbox"
                  label={t.label}
                  color={t.color}
                  active={tags.includes(t.key)}
                  onPress={() => setTags(prev => toggle(prev, t.key))}
                />
              ))}
            </View>
          </View>

          <View>
            <View className="flex-row flex-wrap gap-3">
              <View style={{ flexBasis: 150, flexGrow: 1 }}>
                <Text className="mb-1.5 text-xs font-medium text-text-heading">From</Text>
                <DateTimeField
                  value={from}
                  onChange={setFrom}
                  clearable
                  allDayLabel="Any time"
                  placeholder="Any date"
                  accessibilityLabel="From"
                />
              </View>
              <View style={{ flexBasis: 150, flexGrow: 1 }}>
                <Text className="mb-1.5 text-xs font-medium text-text-heading">To</Text>
                <DateTimeField
                  value={to}
                  onChange={setTo}
                  clearable
                  allDayLabel="Any time"
                  placeholder="Any date"
                  min={from.date || undefined}
                  invalid={!!rangeError}
                  accessibilityLabel="To"
                />
              </View>
            </View>
            <Text className="mt-1.5 text-xs text-text-subtle">
              Tasks that start and end within this range. No time = the whole day.
            </Text>
          </View>
        </View>

        <View className="px-3 pt-3">
          {blocker ? (
            <EmptyState compact icon={SearchX} title={blocker} description="Adjust the filters above to search." />
          ) : !view ? (
            <EmptyState compact icon={Search} title="Open a view to search" description="Search looks through the current view’s tasks." />
          ) : error ? (
            <EmptyState
              compact
              icon={SearchX}
              title="Search failed"
              description={errorMessage(error, 'Please try again.')}
            />
          ) : isLoading ? (
            <View className="gap-2 px-2 py-1">
              <Skeleton className="h-9 w-full rounded-lg" />
              <Skeleton className="h-9 w-full rounded-lg" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </View>
          ) : results.length === 0 ? (
            <EmptyState
              compact
              icon={SearchX}
              title={isSearching ? 'Searching…' : 'No matching tasks'}
              description={isSearching ? undefined : 'Try another title or loosen the filters.'}
            />
          ) : (
            <>
              <Text className="mb-1 px-2 text-2xs font-semibold uppercase tracking-wider text-text-subtle">
                {results.length}
                {hasMore ? '+' : ''} {results.length === 1 ? 'result' : 'results'} in {view.name}
                {isSearching ? ' · updating…' : ''}
              </Text>
              {results.map(item => (
                <ResultRow key={item.id} item={item} onPress={() => openItem(item)} />
              ))}
              {hasMore ? (
                <View className="items-center pt-2">
                  <Button size="sm" variant="secondary" loading={loadingMore} onPress={loadMore}>
                    Load more
                  </Button>
                </View>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </Sheet>
  );
}

// "Oct 14 09:00" — with the time when the task has one.
const day = (d: string, time: string | null) =>
  `${format(parseISO(d), 'MMM d')}${time ? ` ${time}` : ''}`;

function ResultRow({ item, onPress }: { item: WorkItem; onPress: () => void }) {
  const tag = tagInfo(item.tag);
  return (
    <Press
      feedback="subtle"
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.title}`}
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-lg px-2 py-2 hover:bg-hover"
    >
      <StatusIcon status={item.status} />
      <Text numberOfLines={1} className="flex-1 text-sm font-medium text-text-heading">
        {item.title}
      </Text>
      {tag ? <Badge label={tag.label} color={tag.color} size="sm" /> : null}
      <Text className="w-40 text-right text-xs text-text-subtle">
        {item.start === item.end && !item.startTime && !item.endTime
          ? day(item.start, null)
          : `${day(item.start, item.startTime)} – ${day(item.end, item.endTime)}`}
      </Text>
      <AssigneeAvatars ids={item.assigneeIds} size={20} />
    </Press>
  );
}
