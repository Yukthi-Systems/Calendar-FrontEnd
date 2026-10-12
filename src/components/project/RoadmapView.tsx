import { useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  type ScrollViewInstance,
  Text,
  View,
} from 'react-native';
import { useAtomValue, useSetAtom } from 'jotai';
import { GanttChart, Plus } from 'lucide-react-native';
import type { WorkItem } from '../../data/types';
import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  format,
  getDaysInMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { itemFormAtom, itemsAtom, selectedItemIdAtom } from '../../atoms/project';
import { STATUSES, statusInfo } from '../../data/constants';
import { flattenTree } from '../../data/tree';
import { useThemeColors, useTone } from '../../hooks/useThemeColors';
import { mix } from '../../theme/color';
import { Button, EmptyState, Press, SegmentedControl } from '../ui';
import { AssigneeAvatars, StatusIcon } from './shared';

const ROW_H = 44;
const HEADER_H = 36;
const LABEL_W = 260;
const INDENT = 14;

type Zoom = 'day' | 'week' | 'month' | 'year';
const ZOOMS: { key: Zoom; label: string }[] = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
];

// Each zoom level is really just "how many pixels per day" plus how the
// header groups those days — the bars, grid and today-line all read off the
// same `dayWidth`, so zooming is one number, not a different layout.
const ZOOM_CONFIG: Record<
  Zoom,
  {
    dayWidth: number;
    groupBy: 'day' | 'week' | 'month';
    headerLabel: (d: Date) => string;
    padBefore: number;
    padAfter: number;
  }
> = {
  day: {
    dayWidth: 44,
    groupBy: 'day',
    headerLabel: d => format(d, 'EEE d'),
    padBefore: 3,
    padAfter: 7,
  },
  week: {
    dayWidth: 26,
    groupBy: 'week',
    headerLabel: d => format(d, 'MMM d'),
    padBefore: 7,
    padAfter: 14,
  },
  month: {
    dayWidth: 9,
    groupBy: 'month',
    headerLabel: d => format(d, 'MMM yyyy'),
    padBefore: 14,
    padAfter: 30,
  },
  year: {
    dayWidth: 2.4,
    groupBy: 'month',
    headerLabel: d => format(d, "MMM ''yy"),
    padBefore: 30,
    padAfter: 60,
  },
};

// Header/grid columns for the chosen zoom, each as {start, days} — days is how
// many calendar days that column spans (so its pixel width is days * dayWidth).
function buildColumns(
  groupBy: 'day' | 'week' | 'month',
  first: Date,
  last: Date,
) {
  if (groupBy === 'day') {
    return eachDayOfInterval({ start: first, end: last }).map(d => ({
      start: d,
      days: 1,
    }));
  }
  if (groupBy === 'week') {
    return eachWeekOfInterval(
      { start: first, end: last },
      { weekStartsOn: 1 },
    ).map(d => ({ start: d, days: 7 }));
  }
  return eachMonthOfInterval({ start: startOfMonth(first), end: last }).map(
    d => ({
      start: d,
      days: getDaysInMonth(d),
    }),
  );
}

// Timeline in tree order: each subtask sits under its parent, indented by level.
export function RoadmapView() {
  const items = useAtomValue(itemsAtom);
  if (items.length === 0) {
    return <RoadmapEmpty />;
  }
  return <RoadmapTimeline items={items} />;
}

// Nothing to lay out yet — the timeline's date range comes from the tasks, so an
// empty list has no range at all.
function RoadmapEmpty() {
  const setForm = useSetAtom(itemFormAtom);
  return (
    <EmptyState
      icon={GanttChart}
      title="Nothing on the roadmap"
      description="Tasks appear here as bars across their start and due dates, so you can see what overlaps."
      action={
        <Button variant="primary" icon={Plus} onPress={() => setForm({ mode: 'new' })}>
          New task
        </Button>
      }
    />
  );
}

function RoadmapTimeline({ items }: { items: WorkItem[] }) {
  const toneOf = useTone();
  const theme = useThemeColors();
  const headerRef = useRef<ScrollViewInstance>(null);
  const select = useSetAtom(selectedItemIdAtom);
  const [zoom, setZoom] = useState<Zoom>('week');
  const { dayWidth, groupBy, headerLabel, padBefore, padAfter } =
    ZOOM_CONFIG[zoom];

  const rows = flattenTree(
    [...items].sort((a, b) => a.start.localeCompare(b.start)),
  );
  const starts = items.map(i => i.start).sort();
  const ends = items.map(i => i.end).sort();
  const first = startOfWeek(addDays(parseISO(starts[0]), -padBefore), {
    weekStartsOn: 1,
  });
  const last = addDays(parseISO(ends[ends.length - 1]), padAfter);
  const columns = buildColumns(groupBy, first, last);
  const totalDays = differenceInCalendarDays(last, first);
  const totalW = totalDays * dayWidth;
  const todayX =
    differenceInCalendarDays(new Date(), first) * dayWidth + dayWidth / 2;

  const syncHeader = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    headerRef.current?.scrollTo({
      x: e.nativeEvent.contentOffset.x,
      animated: false,
    });

  // Legend + zoom switch and the header row stay fixed; rows scroll vertically.
  // The header's horizontal position follows the body's.
  return (
    <View className="flex-1 px-4 pb-4 pt-3 lg:px-6">
      <View className="mb-3 flex-row flex-wrap items-center justify-between gap-3">
        <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1">
          {STATUSES.map(s => (
            <View key={s.key} className="flex-row items-center gap-1.5">
              <StatusIcon status={s.key} size={13} />
              <Text className="text-xs text-text-main">{s.label}</Text>
            </View>
          ))}
          <View className="flex-row items-center gap-1.5">
            <View className="h-3 w-0.5 rounded-full bg-accent" />
            <Text className="text-xs text-text-main">Today</Text>
          </View>
        </View>
        <SegmentedControl options={ZOOMS} value={zoom} onChange={setZoom} />
      </View>

      <View className="flex-1 overflow-hidden rounded-xl border border-border-main bg-bg-card">
        <View className="flex-row border-b border-border-main bg-muted">
          <View
            style={{ width: LABEL_W, height: HEADER_H }}
            className="justify-center border-r border-border-main px-3"
          >
            <Text className="text-2xs font-semibold uppercase tracking-wider text-text-subtle">
              Task
            </Text>
          </View>
          <ScrollView
            ref={headerRef}
            horizontal
            scrollEnabled={false}
            showsHorizontalScrollIndicator={false}
            className="flex-1"
          >
            <View
              style={{ width: totalW, height: HEADER_H }}
              className="flex-row"
            >
              {columns.map(c => (
                <View
                  key={c.start.toISOString()}
                  style={{ width: c.days * dayWidth }}
                  className="justify-center border-l border-border-main px-2"
                >
                  <Text
                    numberOfLines={1}
                    className="text-2xs font-medium text-text-subtle"
                  >
                    {headerLabel(c.start)}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>

        <ScrollView className="flex-1" contentContainerClassName="pb-20">
          <View className="flex-row">
            <View
              style={{ width: LABEL_W }}
              className="border-r border-border-main"
            >
              {rows.map(({ item: i, depth }) => (
                <Press
                  key={i.id}
                  feedback="none"
                  accessibilityRole="button"
                  accessibilityLabel={i.title}
                  onPress={() => select(i.id)}
                  style={{
                    height: ROW_H,
                    paddingLeft: 12 + (depth - 1) * INDENT,
                  }}
                  className="flex-row items-center gap-2 border-b border-border-main pr-3 hover:bg-hover"
                >
                  <StatusIcon status={i.status} size={14} />
                  <Text
                    numberOfLines={1}
                    className={`flex-1 text-sm text-text-heading ${
                      depth === 1 ? 'font-medium' : ''
                    }`}
                  >
                    {i.title}
                  </Text>
                  <AssigneeAvatars ids={i.assigneeIds} size={20} max={2} />
                </Press>
              ))}
            </View>

            <ScrollView
              horizontal
              onScroll={syncHeader}
              scrollEventThrottle={16}
              className="flex-1"
            >
              <View style={{ width: totalW }}>
                {/* Grid and today marker first, so the bars paint over them. */}
                {columns.map(c => (
                  <View
                    key={`grid-${c.start.toISOString()}`}
                    pointerEvents="none"
                    style={{
                      left: differenceInCalendarDays(c.start, first) * dayWidth,
                    }}
                    className="absolute bottom-0 top-0 w-px bg-border-main"
                  />
                ))}
                <View
                  pointerEvents="none"
                  style={{ left: todayX }}
                  className="absolute bottom-0 top-0 w-0.5 bg-accent/70"
                />
                <View
                  pointerEvents="none"
                  style={{ left: todayX - 3 }}
                  className="absolute top-0 h-2 w-2 rounded-full bg-accent"
                />
                {rows.map(({ item: i, depth }) => {
                  const left =
                    differenceInCalendarDays(parseISO(i.start), first) *
                    dayWidth;
                  const width =
                    (differenceInCalendarDays(
                      parseISO(i.end),
                      parseISO(i.start),
                    ) +
                      1) *
                    dayWidth;
                  const color = statusInfo(i.status).color;
                  const t = toneOf(color);
                  return (
                    <View
                      key={i.id}
                      style={{ height: ROW_H }}
                      className="justify-center border-b border-border-main"
                    >
                      <Press
                        feedback="subtle"
                        accessibilityRole="button"
                        accessibilityLabel={i.title}
                        onPress={() => select(i.id)}
                        style={{
                          left,
                          width: Math.max(width - 2, 6),
                          // Opaque (tint mixed into the card colour) so the
                          // grid and today line don't show through.
                          backgroundColor: mix(theme.card, color, theme.dark ? 0.22 : 0.13),
                          borderColor: t.border,
                          borderLeftColor: color,
                          height: depth === 1 ? 26 : 20,
                        }}
                        className="absolute justify-center rounded-md border border-l-[3px] px-2 hover:opacity-80"
                      >
                        {width >= 36 ? (
                          <Text
                            numberOfLines={1}
                            style={{ color: t.fg }}
                            className="text-2xs font-medium"
                          >
                            {width >= 120 ? i.title : i.id}
                          </Text>
                        ) : null}
                      </Press>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
