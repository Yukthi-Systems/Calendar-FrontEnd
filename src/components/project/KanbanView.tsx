import { Pressable, ScrollView, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react-native';
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import { useAtom, useSetAtom } from 'jotai';
import {
  itemFormAtom,
  itemsAtom,
  selectedItemIdAtom,
} from '../../atoms/project';
import { PRIORITY_COLOR, STATUSES } from '../../data/constants';
import { depthOf } from '../../data/tree';
import type { Status, WorkItem } from '../../data/types';
import { useThemeColors } from '../../hooks/useThemeColors';
import { AssigneeAvatars, Pill, RecurrenceIcon, SubtaskBadge } from './shared';

// Dragging (long-press a card) reorders it within its own column — real,
// spring-animated drag-and-drop via react-native-draggable-flatlist, which
// works the same on web, iOS and Android since it's built on
// react-native-gesture-handler + Reanimated, not per-platform gesture code.
//
// The library only reorders within one list; it doesn't support dragging
// between two separate lists. So moving a card to a different status still
// uses the ‹ › buttons — that part hasn't changed.
export function KanbanView() {
  const [items, setItems] = useAtom(itemsAtom);
  const select = useSetAtom(selectedItemIdAtom);
  const setForm = useSetAtom(itemFormAtom);
  const { heading } = useThemeColors();

  const move = (id: string, status: Status) =>
    setItems(prev => prev.map(i => (i.id === id ? { ...i, status } : i)));

  // Only the relative order of this status's items changes; nothing else in
  // the app reads cross-status order, so it's safe to just move them as a
  // block within the array.
  const reorder = (status: Status, newOrder: WorkItem[]) =>
    setItems(prev => [...prev.filter(i => i.status !== status), ...newOrder]);

  // Column headers stay fixed; each column's cards scroll (and reorder) on their own.
  return (
    <View className="flex-1 p-4">
      <ScrollView
        horizontal
        contentContainerStyle={{ minWidth: '100%', height: '100%' }}
        showsHorizontalScrollIndicator={false}
      >
        <View className="flex-1 flex-row gap-3">
          {STATUSES.map((col, colIdx) => {
            const list = items.filter(i => i.status === col.key);
            return (
              <View
                key={col.key}
                style={{ flexGrow: 1, flexBasis: 0, minWidth: 272 }}
                className="overflow-hidden rounded-2xl border border-border-main bg-bg-main"
              >
                <View className="flex-row items-center gap-2 border-b border-border-main px-3 py-3">
                  <View
                    style={{ backgroundColor: col.color }}
                    className="h-3 w-3 rounded-full"
                  />
                  <Text className="font-semibold text-text-heading">
                    {col.label}
                  </Text>
                  <View className="rounded-full bg-border-main px-2 py-0.5">
                    <Text className="text-[11px] text-text-main">
                      {list.length}
                    </Text>
                  </View>
                  <View className="flex-1" />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Add item to ${col.label}`}
                    onPress={() => setForm({ mode: 'new', status: col.key })}
                    className="h-8 w-8 items-center justify-center rounded-md active:opacity-70"
                  >
                    <Plus size={18} color={heading} />
                  </Pressable>
                </View>
                <DraggableFlatList
                  data={list}
                  keyExtractor={item => item.id}
                  containerStyle={{ flex: 1 }}
                  contentContainerStyle={{
                    gap: 8,
                    padding: 8,
                    paddingBottom: 80,
                  }}
                  onDragEnd={({ data }) => reorder(col.key, data)}
                  ListEmptyComponent={
                    <Text className="px-2 py-6 text-center text-xs text-text-main">
                      No items
                    </Text>
                  }
                  renderItem={({
                    item,
                    drag,
                    isActive,
                  }: RenderItemParams<WorkItem>) => (
                    <ScaleDecorator>
                      <KanbanCard
                        item={item}
                        items={items}
                        isActive={isActive}
                        onOpen={() => select(item.id)}
                        onDrag={drag}
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
              </View>
            );
          })}
        </View>
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
}: {
  item: WorkItem;
  items: WorkItem[];
  isActive: boolean;
  onOpen: () => void;
  onDrag: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const parent = items.find(i => i.id === item.parentId);
  const depth = depthOf(items, item);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onOpen}
      onLongPress={onDrag}
      disabled={isActive}
      className={`rounded-xl border p-3 active:opacity-70 ${
        isActive
          ? 'border-accent bg-bg-card shadow-lg'
          : 'border-border-main bg-bg-card'
      }`}
    >
      <View className="mb-1 flex-row items-center justify-between">
        <Text className="text-[11px] text-text-main">{item.id}</Text>
        {depth > 1 ? (
          <Text className="text-[10px] text-text-main">Level {depth}</Text>
        ) : null}
      </View>
      <View className="mb-2 flex-row items-center gap-1">
        <Text className="shrink text-sm font-medium text-text-heading">
          {item.title}
        </Text>
        {item.recurrence ? <RecurrenceIcon freq={item.recurrence} /> : null}
      </View>
      {parent ? (
        <Text numberOfLines={1} className="mb-2 text-[11px] text-accent">
          ↳ {parent.title}
        </Text>
      ) : null}
      <View className="mb-3 flex-row flex-wrap gap-1">
        {item.labels.map(l => (
          <Pill key={l} text={l} />
        ))}
        <Pill text={item.priority} color={PRIORITY_COLOR[item.priority]} />
      </View>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <AssigneeAvatars ids={item.assigneeIds} size={22} />
          <SubtaskBadge id={item.id} />
        </View>
        <View className="flex-row gap-1">
          <MoveButton icon={ChevronLeft} label="Move left" onPress={onPrev} />
          <MoveButton icon={ChevronRight} label="Move right" onPress={onNext} />
        </View>
      </View>
    </Pressable>
  );
}

function MoveButton({
  icon: Icon,
  label,
  onPress,
}: {
  icon: typeof ChevronLeft;
  label: string;
  onPress?: () => void;
}) {
  const { heading } = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={!onPress}
      onPress={onPress}
      className={`h-8 w-8 items-center justify-center rounded-md border border-border-main active:opacity-70 ${
        onPress ? '' : 'opacity-30'
      }`}
    >
      <Icon size={16} color={heading} />
    </Pressable>
  );
}
