import { useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  ScrollView,
  Text,
  View,
  type ViewInstance,
} from 'react-native';
import { CornerDownRight, Plus } from 'lucide-react-native';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  itemFormAtom,
  itemsAtom,
  selectedItemIdAtom,
  tasksLoadingAtom,
} from '../../atoms/project';
import { currentUserIdAtom } from '../../atoms/members';
import { allowedStatuses, statusInfo, tagInfo } from '../../data/constants';
import { errorMessage, toast } from '../../atoms/feedback';
import { useTaskMutations } from '../../hooks/useTaskMutations';
import { useViewAccess } from '../../hooks/useViews';
import type { ProjectView, Status, WorkItem } from '../../data/types';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Badge, IconButton, Press, Skeleton } from '../ui';
import {
  AssigneeAvatars,
  DueDate,
  RecurrenceIcon,
  StatusIcon,
  SubtaskBadge,
} from './shared';
import { DRAG_NEEDS_LONG_PRESS, GHOST_SHADOW } from './kanbanDrag';

type Rect = { x: number; y: number; width: number; height: number };

const measure = (v: ViewInstance | null): Promise<Rect | null> =>
  new Promise(resolve =>
    v
      ? v.measureInWindow(
          (x: number, y: number, width: number, height: number) =>
            resolve({ x, y, width, height }),
        )
      : resolve(null),
  );

// Pixels a card must travel (web) before a press turns into a drag.
const DRAG_SLOP = 6;

// One column per status the view allows. Drag a card onto another column to
// change its status (web: just drag; touch: long-press, then drag) — a floating
// copy follows the pointer and the column under it lights up. The move is saved
// to the server and the board re-reads (no optimistic update); order inside a
// column is the server's (by start date) — the API has nowhere to store a manual
// order, so there's no within-column reordering.
export function KanbanView({ view }: { view: ProjectView }) {
  // A card can't be created in, or moved to, a status outside the view's filter
  // (the server refuses it), so those columns don't exist here.
  const COLUMNS = allowedStatuses(view.statusFilter);
  const items = useAtomValue(itemsAtom);
  const loading = useAtomValue(tasksLoadingAtom);
  const select = useSetAtom(selectedItemIdAtom);
  const setForm = useSetAtom(itemFormAtom);
  const { editItem } = useTaskMutations();
  // Shared view: add / move only if the owner allowed it.
  const { canCreate, canEdit } = useViewAccess(view);
  const CURRENT_USER_ID = useAtomValue(currentUserIdAtom);
  // canEdit is the view's own coarse grant — the server also requires you to
  // actually be the card's own task owner or creator (an assignee dragging a
  // card they're only assigned to would be refused), so check both.
  const canMove = (item: WorkItem) =>
    canEdit &&
    (item.ownerId === CURRENT_USER_ID || item.createdById === CURRENT_USER_ID);
  // Top-level tasks only — subtasks load lazily (useTasksSync's header comment),
  // so showing them as their own cards would make the board depend on whatever
  // happened to get fetched elsewhere.
  const rootItems = items.filter(i => !i.parentId);

  const move = (item: WorkItem, status: Status) =>
    editItem({ ...item, status })
      .then(() =>
        toast.success(`Moved to ${statusInfo(status).label}`, {
          duration: 2200,
        }),
      )
      .catch(err =>
        toast.error('Couldn’t move the task', {
          description: errorMessage(err, 'Please try again.'),
        }),
      );

  // ── Drag state ─────────────────────────────────────────────────────────
  const rootRef = useRef<ViewInstance>(null);
  const columnRefs = useRef(new Map<Status, ViewInstance | null>());
  const ghost = useRef(new Animated.ValueXY()).current;
  // Window geometry captured when the drag starts (columns don't move during it).
  const geo = useRef<{
    root: Rect;
    columns: { key: Status; rect: Rect }[];
    grab: { dx: number; dy: number };
  } | null>(null);
  const [dragging, setDragging] = useState<{
    item: WorkItem;
    width: number;
  } | null>(null);
  const [over, setOver] = useState<Status | null>(null);
  const overRef = useRef<Status | null>(null);
  // A drag ends with a pointer-up over the card — don't let that also open it.
  const lastDragEnd = useRef(0);

  const columnAt = (pageX: number, pageY: number): Status | null =>
    geo.current?.columns.find(
      c =>
        pageX >= c.rect.x &&
        pageX <= c.rect.x + c.rect.width &&
        pageY >= c.rect.y &&
        pageY <= c.rect.y + c.rect.height,
    )?.key ?? null;

  const setOverColumn = (key: Status | null) => {
    if (overRef.current !== key) {
      overRef.current = key;
      setOver(key);
    }
  };

  const onDragStart = async (
    item: WorkItem,
    card: Rect,
    pageX: number,
    pageY: number,
  ) => {
    const [root, ...cols] = await Promise.all([
      measure(rootRef.current),
      ...COLUMNS.map(c => measure(columnRefs.current.get(c.key) ?? null)),
    ]);
    if (!root) {
      return;
    }
    geo.current = {
      root,
      columns: COLUMNS.flatMap((c, i) =>
        cols[i] ? [{ key: c.key, rect: cols[i]! }] : [],
      ),
      grab: { dx: pageX - card.x, dy: pageY - card.y },
    };
    ghost.setValue({ x: card.x - root.x, y: card.y - root.y });
    setDragging({ item, width: card.width });
    setOverColumn(item.status);
  };

  const onDragMove = (pageX: number, pageY: number) => {
    const g = geo.current;
    if (!g) {
      return;
    }
    ghost.setValue({
      x: pageX - g.grab.dx - g.root.x,
      y: pageY - g.grab.dy - g.root.y,
    });
    setOverColumn(columnAt(pageX, pageY));
  };

  const onDragEnd = (drop: boolean) => {
    const item = dragging?.item;
    const target = overRef.current;
    geo.current = null;
    lastDragEnd.current = Date.now();
    setDragging(null);
    setOverColumn(null);
    if (drop && item && target && target !== item.status) {
      move(item, target);
    }
  };

  const open = (id: string) => {
    if (Date.now() - lastDragEnd.current > 250) {
      select(id);
    }
  };

  // Column headers stay fixed; each column's cards scroll on their own.
  return (
    <View ref={rootRef} collapsable={false} className="flex-1">
      <ScrollView
        horizontal
        scrollEnabled={!dragging}
        contentContainerStyle={{ minWidth: '100%', height: '100%' }}
        contentContainerClassName="gap-3 p-4 lg:px-6"
      >
        {COLUMNS.map(col => {
          const list = rootItems.filter(i => i.status === col.key);
          const target =
            !!dragging && over === col.key && dragging.item.status !== col.key;
          return (
            <View
              key={col.key}
              ref={v => {
                columnRefs.current.set(col.key, v);
              }}
              collapsable={false}
              style={{
                flexGrow: 1,
                flexBasis: 0,
                minWidth: 280,
                maxWidth: 380,
              }}
              className={`overflow-hidden rounded-xl border ${
                target
                  ? 'border-accent bg-accent-soft'
                  : 'border-border-main bg-muted/60'
              }`}
            >
              <View className="h-11 flex-row items-center gap-2 pl-3 pr-1.5">
                <StatusIcon status={col.key} size={15} />
                <Text className="text-sm font-semibold text-text-heading">
                  {col.label}
                </Text>
                {list.length > 0 ? (
                  <Text className="text-sm text-text-subtle">
                    {list.length}
                  </Text>
                ) : null}
                <View className="flex-1" />
                {canCreate ? (
                  <IconButton
                    icon={Plus}
                    size="sm"
                    label={`Add task to ${col.label}`}
                    onPress={() => setForm({ mode: 'new', status: col.key })}
                  />
                ) : (
                  <View className="h-7" />
                )}
              </View>
              {loading && items.length === 0 ? (
                <View className="gap-2 px-2">
                  {[0, 1].map(n => (
                    <View
                      key={n}
                      className="gap-2 rounded-lg border border-border-main bg-bg-card p-3"
                    >
                      <Skeleton className="h-3 w-10 rounded" />
                      <Skeleton className="h-3.5 w-48 rounded" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </View>
                  ))}
                </View>
              ) : (
                <ScrollView
                  scrollEnabled={!dragging}
                  className="flex-1"
                  contentContainerStyle={{
                    gap: 8,
                    paddingHorizontal: 8,
                    paddingBottom: 80,
                  }}
                >
                  {list.map(item => (
                    <DraggableCard
                      key={item.id}
                      item={item}
                      items={items}
                      enabled={canMove(item)}
                      lifted={dragging?.item.id === item.id}
                      onOpen={() => open(item.id)}
                      onDragStart={onDragStart}
                      onDragMove={onDragMove}
                      onDragEnd={onDragEnd}
                    />
                  ))}
                  {list.length === 0 ? (
                    target ? (
                      <View className="h-20 items-center justify-center rounded-lg border border-dashed border-accent">
                        <Text className="text-xs font-medium text-accent">
                          Move to {col.label}
                        </Text>
                      </View>
                    ) : canCreate ? (
                      <Press
                        feedback="subtle"
                        accessibilityRole="button"
                        accessibilityLabel={`Add task to ${col.label}`}
                        onPress={() =>
                          setForm({ mode: 'new', status: col.key })
                        }
                        className="group h-20 items-center justify-center rounded-lg border border-dashed border-border-strong hover:bg-bg-card"
                      >
                        <Text className="text-xs text-text-subtle group-hover:text-text-main">
                          No tasks · click to add
                        </Text>
                      </Press>
                    ) : (
                      <View className="h-20 items-center justify-center rounded-lg border border-dashed border-border-main">
                        <Text className="text-xs text-text-subtle">
                          No tasks
                        </Text>
                      </View>
                    )
                  ) : null}
                </ScrollView>
              )}
            </View>
          );
        })}
      </ScrollView>

      {dragging ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: 0,
              top: 0,
              width: dragging.width,
              transform: [...ghost.getTranslateTransform(), { rotate: '2deg' }],
            },
          ]}
        >
          <View style={GHOST_SHADOW} className="rounded-lg">
            <KanbanCard
              item={dragging.item}
              items={items}
              lifted={false}
              ghost
            />
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

// A card that can be picked up. The pan responder only claims the gesture once
// it's clearly a drag (moved past DRAG_SLOP on web; after a long-press on touch),
// so taps still open the card and swipes still scroll.
function DraggableCard({
  item,
  items,
  enabled,
  lifted,
  onOpen,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  item: WorkItem;
  items: WorkItem[];
  // False in a shared view without edit access — the card can't be moved.
  enabled: boolean;
  lifted: boolean;
  onOpen: () => void;
  onDragStart: (
    item: WorkItem,
    card: Rect,
    pageX: number,
    pageY: number,
  ) => void;
  onDragMove: (pageX: number, pageY: number) => void;
  onDragEnd: (drop: boolean) => void;
}) {
  const ref = useRef<ViewInstance>(null);
  const armed = useRef(false);
  // Handlers read the latest props through this, so the responder is made once.
  const latest = useRef({ item, enabled, onDragStart, onDragMove, onDragEnd });
  latest.current = { item, enabled, onDragStart, onDragMove, onDragEnd };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_e, g) =>
          latest.current.enabled &&
          (DRAG_NEEDS_LONG_PRESS
            ? armed.current
            : Math.abs(g.dx) > DRAG_SLOP || Math.abs(g.dy) > DRAG_SLOP),
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e, g) => {
          const startX = e.nativeEvent.pageX - g.dx;
          const startY = e.nativeEvent.pageY - g.dy;
          ref.current?.measureInWindow(
            (x: number, y: number, width: number, height: number) =>
              latest.current.onDragStart(
                latest.current.item,
                { x, y, width, height },
                startX,
                startY,
              ),
          );
        },
        onPanResponderMove: e =>
          latest.current.onDragMove(e.nativeEvent.pageX, e.nativeEvent.pageY),
        onPanResponderRelease: () => {
          armed.current = false;
          latest.current.onDragEnd(true);
        },
        onPanResponderTerminate: () => {
          armed.current = false;
          latest.current.onDragEnd(false);
        },
      }),
    [],
  );

  return (
    <View ref={ref} collapsable={false} {...responder.panHandlers}>
      <KanbanCard
        item={item}
        items={items}
        lifted={lifted}
        onOpen={onOpen}
        onLongPress={
          enabled && DRAG_NEEDS_LONG_PRESS
            ? () => {
                armed.current = true;
              }
            : undefined
        }
        onPressOut={() => {
          if (DRAG_NEEDS_LONG_PRESS) {
            setTimeout(() => (armed.current = false), 0);
          }
        }}
      />
    </View>
  );
}

function KanbanCard({
  item,
  items,
  lifted,
  ghost = false,
  onOpen,
  onLongPress,
  onPressOut,
}: {
  item: WorkItem;
  items: WorkItem[];
  // The card's place in its column while its floating copy is being dragged.
  lifted: boolean;
  // The floating copy itself.
  ghost?: boolean;
  onOpen?: () => void;
  onLongPress?: () => void;
  onPressOut?: () => void;
}) {
  const c = useThemeColors();
  const parent = items.find(i => i.id === item.parentId);
  return (
    <Press
      feedback={ghost ? 'none' : 'subtle'}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      onPress={onOpen}
      onLongPress={onLongPress}
      onPressOut={onPressOut}
      delayLongPress={250}
      style={lifted ? { opacity: 0.35 } : undefined}
      className={`select-none gap-2 rounded-lg border bg-bg-card p-3 ${
        ghost
          ? 'border-accent'
          : 'border-border-main hover:border-border-strong'
      }`}
    >
      <View className="flex-row items-start gap-1.5">
        <Text
          numberOfLines={3}
          className="flex-1 text-sm font-medium text-text-heading"
        >
          {item.title}
        </Text>
        {item.recurrence ? (
          <View className="pt-0.5">
            <RecurrenceIcon freq={item.recurrence} />
          </View>
        ) : null}
      </View>
      {parent ? (
        <View className="flex-row items-center gap-1">
          <CornerDownRight size={12} color={c.subtle} />
          <Text numberOfLines={1} className="flex-1 text-xs text-text-subtle">
            {parent.title}
          </Text>
        </View>
      ) : null}
      <Badge
        label={tagInfo(item.tag).label}
        color={tagInfo(item.tag).color}
        size="sm"
        dot
      />
      <View className="mt-0.5 flex-row items-center gap-2.5">
        <AssigneeAvatars ids={item.assigneeIds} size={20} />
        <DueDate item={item} className="text-xs" />
        <SubtaskBadge item={item} />
      </View>
    </Press>
  );
}
