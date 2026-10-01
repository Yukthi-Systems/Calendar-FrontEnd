import { useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  Text,
  View,
} from 'react-native';
import { useAtomValue, useSetAtom } from 'jotai';
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
import { itemsAtom, selectedItemIdAtom } from '../../atoms/project';
import { STATUSES, statusInfo } from '../../data/constants';
import { flattenTree } from '../../data/tree';
import { AssigneeAvatars } from './shared';

const ROW_H = 46;
const HEADER_H = 40;
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
    <View className="flex-1 p-4">
      <View className="mb-3 flex-row flex-wrap items-center justify-between gap-3">
        <View className="flex-row flex-wrap items-center gap-4">
          {STATUSES.map(s => (
            <View key={s.key} className="flex-row items-center gap-1.5">
              <View
                style={{ backgroundColor: s.color }}
                className="h-2.5 w-2.5 rounded-sm"
              />
              <Text className="text-xs text-text-main">{s.label}</Text>
            </View>
          ))}
          <View className="flex-row items-center gap-1.5">
            <View className="h-3 w-px bg-accent" />
            <Text className="text-xs text-text-main">Today</Text>
          </View>
        </View>
        <ZoomSwitch zoom={zoom} onChange={setZoom} />
      </View>

      <View className="flex-1 overflow-hidden rounded-2xl border border-border-main bg-bg-card">
        <View className="flex-row border-b border-border-main bg-bg-main">
          <View
            style={{ width: LABEL_W, height: HEADER_H }}
            className="justify-center border-r border-border-main px-3"
          >
            <Text className="text-[11px] font-semibold uppercase tracking-wide text-text-main">
              Item
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
                    className="text-[11px] font-medium text-text-main"
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
                <Pressable
                  key={i.id}
                  accessibilityRole="button"
                  onPress={() => select(i.id)}
                  style={{
                    height: ROW_H,
                    paddingLeft: 12 + (depth - 1) * INDENT,
                  }}
                  className="flex-row items-center gap-2 border-b border-border-main pr-3 active:bg-accent/10"
                >
                  <AssigneeAvatars ids={i.assigneeIds} size={22} />
                  <Text
                    numberOfLines={1}
                    className={`flex-1 text-xs text-text-heading ${
                      depth === 1 ? 'font-semibold' : ''
                    }`}
                  >
                    {i.title}
                  </Text>
                </Pressable>
              ))}
            </View>

            <ScrollView
              horizontal
              onScroll={syncHeader}
              scrollEventThrottle={16}
              className="flex-1"
            >
              <View style={{ width: totalW }}>
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
                  return (
                    <View
                      key={i.id}
                      style={{ height: ROW_H }}
                      className="justify-center border-b border-border-main"
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={i.title}
                        onPress={() => select(i.id)}
                        style={{
                          left,
                          width: Math.max(width - 2, 4),
                          backgroundColor: color,
                          height: depth === 1 ? 28 : 22,
                        }}
                        className="absolute justify-center rounded-lg px-2 active:opacity-70"
                      >
                        {width >= 28 ? (
                          <Text
                            numberOfLines={1}
                            className="text-[11px] font-medium text-white"
                          >
                            {width >= 120 ? i.title : i.id}
                          </Text>
                        ) : null}
                      </Pressable>
                    </View>
                  );
                })}
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
                  className="absolute bottom-0 top-0 w-0.5 bg-accent"
                />
              </View>
            </ScrollView>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

function ZoomSwitch({
  zoom,
  onChange,
}: {
  zoom: Zoom;
  onChange: (z: Zoom) => void;
}) {
  return (
    <View className="flex-row rounded-lg border border-border-main p-0.5">
      {ZOOMS.map(z => {
        const active = z.key === zoom;
        return (
          <Pressable
            key={z.key}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(z.key)}
            className={`rounded-md px-3 py-1.5 active:opacity-70 ${
              active ? 'bg-accent' : ''
            }`}
          >
            <Text
              className={`text-xs font-medium ${
                active ? 'text-white' : 'text-text-main'
              }`}
            >
              {z.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
