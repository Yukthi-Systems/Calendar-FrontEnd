import { Platform, ScrollView, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight, CornerDownRight, Plus } from 'lucide-react-native';
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  itemFormAtom,
  itemsAtom,
  selectedItemIdAtom,
  tasksLoadingAtom,
} from '../../atoms/project';
import { STATUSES, statusInfo, tagInfo } from '../../data/constants';
import { errorMessage, toast } from '../../atoms/feedback';
import { useTaskMutations } from '../../hooks/useTaskMutations';
import type { Status, WorkItem } from '../../data/types';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Badge, IconButton, Press, Skeleton } from '../ui';
import {
  AssigneeAvatars,
  DueDate,
  PriorityIcon,
  RecurrenceIcon,
  StatusIcon,
  SubtaskBadge,
} from './shared';

// Shown on card hover on web (web/web.css); always visible on touch.
const HOVER_REVEAL = 'reveal-on-hover';

// Dragging (long-press a card) reorders it within its own column — real,
// spring-animated drag-and-drop via react-native-draggable-flatlist, which
// works the same on web, iOS and Android since it's built on
// react-native-gesture-handler + Reanimated, not per-platform gesture code.
//
// The library only reorders within one list; it doesn't support dragging
// between two separate lists. So moving a card to a different status uses the
// ‹ › buttons on the card.
export function KanbanView() {
  const [items, setItems] = useAtom(itemsAtom);
  const loading = useAtomValue(tasksLoadingAtom);
  const select = useSetAtom(selectedItemIdAtom);
  const setForm = useSetAtom(itemFormAtom);
  const { editItem } = useTaskMutations();
  // Top-level tasks only — subtasks load lazily (useTasksSync's header comment),
  // so showing them as their own cards here would mean the board's contents
  // depend on whatever happened to get fetched elsewhere. `items` itself (used
  // by `move`/`reorder` below) stays unfiltered, so reordering a column doesn't
  // drop any subtask this device has already loaded.
  const rootItems = items.filter(i => !i.parentId);

  const move = (id: string, status: Status) => {
    const item = items.find(i => i.id === id);
    if (!item) {
      return;
    }
    // Not optimistic — the card only actually moves once the server confirms
    // it (see useTaskMutations' header comment). On failure it stays put and
    // says so.
    editItem({ ...item, status })
      .then(() => toast.success(`Moved to ${statusInfo(status).label}`, { duration: 2200 }))
      .catch(err => toast.error('Couldn’t move the task', { description: errorMessage(err, 'Please try again.') }));
  };

  // Only the relative order of this status's items changes; nothing else in the
  // app reads cross-status order, so it's fine to just move them as a block
  // within the array. Local-only, by necessity — the API has no field to persist
  // a manual order in, so this resets the next time the task list refetches.
  const reorder = (status: Status, newOrder: WorkItem[]) =>
    setItems(prev => [...prev.filter(i => i.status !== status), ...newOrder]);

  // Column headers stay fixed; each column's cards scroll (and reorder) on their own.
  return (
    <View className="flex-1">
      <ScrollView
        horizontal
        contentContainerStyle={{ minWidth: '100%', height: '100%' }}
        contentContainerClassName="gap-3 p-4 lg:px-6"
      >
        {STATUSES.map((col, colIdx) => {
          const list = rootItems.filter(i => i.status === col.key);
          return (
            <View
              key={col.key}
              style={{ flexGrow: 1, flexBasis: 0, minWidth: 280, maxWidth: 380 }}
              className="overflow-hidden rounded-xl border border-border-main bg-muted/60"
            >
              <View className="h-11 flex-row items-center gap-2 pl-3 pr-1.5">
                <StatusIcon status={col.key} size={15} />
                <Text className="text-sm font-semibold text-text-heading">
                  {col.label}
                </Text>
                <Text className="text-sm text-text-subtle">{list.length}</Text>
                <View className="flex-1" />
                <IconButton
                  icon={Plus}
                  size="sm"
                  label={`Add task to ${col.label}`}
                  onPress={() => setForm({ mode: 'new', status: col.key })}
                />
              </View>
              {loading && items.length === 0 ? (
                <View className="gap-2 px-2">
                  {[0, 1].map(n => (
                    <View key={n} className="gap-2 rounded-lg border border-border-main bg-bg-card p-3">
                      <Skeleton className="h-3 w-10 rounded" />
                      <Skeleton className="h-3.5 w-48 rounded" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </View>
                  ))}
                </View>
              ) : (
                <DraggableFlatList
                  data={list}
                  keyExtractor={item => item.id}
                  containerStyle={{ flex: 1 }}
                  contentContainerStyle={{
                    gap: 8,
                    paddingHorizontal: 8,
                    paddingBottom: 80,
                  }}
                  onDragEnd={({ data }) => reorder(col.key, data)}
                  ListEmptyComponent={
                    <Press
                      feedback="subtle"
                      accessibilityRole="button"
                      accessibilityLabel={`Add task to ${col.label}`}
                      onPress={() => setForm({ mode: 'new', status: col.key })}
                      className="group h-20 items-center justify-center rounded-lg border border-dashed border-border-strong hover:bg-bg-card"
                    >
                      <Text className="text-xs text-text-subtle group-hover:text-text-main">
                        No tasks · click to add
                      </Text>
                    </Press>
                  }
                  renderItem={({
                    item,
                    drag,
                    isActive,
                  }: RenderItemParams<WorkItem>) => (
                    <ScaleDecorator activeScale={1.03}>
                      <KanbanCard
                        item={item}
                        items={items}
                        isActive={isActive}
                        onOpen={() => select(item.id)}
                        onDrag={drag}
                        prevLabel={colIdx > 0 ? STATUSES[colIdx - 1].label : undefined}
                        nextLabel={
                          colIdx < STATUSES.length - 1 ? STATUSES[colIdx + 1].label : undefined
                        }
                        onPrev={
                          colIdx > 0
                            ? () => move(item.id, STATUSES[colIdx - 1].key)
                            : undefined
                        }
                        onNext={
                          colIdx < STATUSES.length - 1
                            ? () => move(item.id, STATUSES[colIdx + 1].key)
                            : undefined
                        }
                      />
                    </ScaleDecorator>
                  )}
                />
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function KanbanCard({
  item,
  items,
  isActive,
  onOpen,
  onDrag,
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
}: {
  item: WorkItem;
  items: WorkItem[];
  isActive: boolean;
  onOpen: () => void;
  onDrag: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  prevLabel?: string;
  nextLabel?: string;
}) {
  const c = useThemeColors();
  const parent = items.find(i => i.id === item.parentId);
  return (
    <Press
      feedback="subtle"
      accessibilityRole="button"
      accessibilityLabel={item.title}
      onPress={onOpen}
      onLongPress={onDrag}
      delayLongPress={220}
      disabled={isActive}
      style={
        isActive && Platform.OS === 'web'
          ? ({ boxShadow: '0 16px 32px -12px rgba(0,0,0,0.35)' } as object)
          : undefined
      }
      className={`group gap-2 rounded-lg border bg-bg-card p-3 ${
        isActive ? 'border-accent' : 'border-border-main hover:border-border-strong'
      }`}
    >
      <View className="flex-row items-center gap-1.5">
        <Text className="flex-1 text-2xs font-medium text-text-subtle">{item.id}</Text>
        {item.recurrence ? <RecurrenceIcon freq={item.recurrence} /> : null}
        <PriorityIcon priority={item.priority} size={14} />
      </View>
      <Text numberOfLines={3} className="text-sm font-medium text-text-heading">
        {item.title}
      </Text>
      {parent ? (
        <View className="flex-row items-center gap-1">
          <CornerDownRight size={12} color={c.subtle} />
          <Text numberOfLines={1} className="flex-1 text-xs text-text-subtle">
            {parent.title}
          </Text>
        </View>
      ) : null}
      <Badge label={tagInfo(item.tag).label} color={tagInfo(item.tag).color} size="sm" dot />
      <View className="mt-0.5 flex-row items-center gap-2.5">
        <AssigneeAvatars ids={item.assigneeIds} size={20} />
        <DueDate item={item} className="text-xs" />
        <SubtaskBadge item={item} />
        <View className="flex-1" />
        <View className={`flex-row ${HOVER_REVEAL}`}>
          <IconButton
            icon={ChevronLeft}
            size="sm"
            label={prevLabel ? `Move to ${prevLabel}` : 'Move left'}
            disabled={!onPrev}
            onPress={onPrev}
          />
          <IconButton
            icon={ChevronRight}
            size="sm"
            label={nextLabel ? `Move to ${nextLabel}` : 'Move right'}
            disabled={!onNext}
            onPress={onNext}
          />
        </View>
      </View>
    </Press>
  );
}
