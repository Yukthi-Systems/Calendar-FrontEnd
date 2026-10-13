import { useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react-native';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  isWeekend,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns';
import {
  itemFormAtom,
  itemsAtom,
  selectedItemIdAtom,
} from '../../atoms/project';
import { statusInfo } from '../../data/constants';
import { occurrencesInRange } from '../../data/recurrence';
import { showsField } from '../../data/viewFields';
import type { ProjectView, ViewField, WorkItem } from '../../data/types';
import { useThemeColors, useTone } from '../../hooks/useThemeColors';
import { useShortcuts } from '../../hooks/useShortcuts';
import { mix } from '../../theme/color';
import { Button, IconButton, Kbd, Press, SegmentedControl } from '../ui';
import {
  AssigneeAvatars,
  ItemRow,
  PriorityIcon,
  RecurrenceIcon,
  StatusIcon,
} from './shared';
import { Tooltip } from './Tooltip';

const WEEK = { weekStartsOn: 1 } as const;
const DATE_FMT = 'yyyy-MM-dd';
// Width at which the selected-day agenda sits beside the month grid.
const SPLIT = 1100;
// Below this, month cells are too narrow for titled bars — they show dots.
const NARROW = 640;

type CalMode = 'day' | 'week' | 'month' | 'year';
const MODES: { key: CalMode; label: string }[] = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
];

// One appearance of a task on the calendar. A recurring task yields one per
// repeat inside the visible range; everything else yields exactly one.
interface Occ {
  key: string;
  item: WorkItem;
  start: Date;
  end: Date;
}

const occurrencesBetween = (items: WorkItem[], from: Date, to: Date): Occ[] =>
  items.flatMap(item =>
    occurrencesInRange(
      parseISO(item.start),
      parseISO(item.end),
      item.recurrence,
      from,
      to,
    ).map(o => ({
      key: `${item.id}@${format(o.start, DATE_FMT)}`,
      item,
      start: startOfDay(o.start),
      end: startOfDay(o.end),
    })),
  );

const onDay = (occ: Occ[], day: Date) =>
  occ.filter(o => o.start <= day && o.end >= day);

// A task's slice of one week row: which columns it covers, which lane (row of
// bars) it sits in, and whether the task really starts/ends inside this week
// (rounded ends) or carries on from/into the neighbouring week (square ends).
interface Segment {
  occ: Occ;
  col: number;
  span: number;
  lane: number;
  isStart: boolean;
  isEnd: boolean;
}

function layoutWeek(occ: Occ[], weekStart: Date): Segment[] {
  const weekEnd = addDays(weekStart, 6);
  const parts = occ
    .filter(o => o.start <= weekEnd && o.end >= weekStart)
    .map(o => {
      const s = o.start < weekStart ? weekStart : o.start;
      const e = o.end > weekEnd ? weekEnd : o.end;
      return {
        occ: o,
        col: differenceInCalendarDays(s, weekStart),
        span: differenceInCalendarDays(e, s) + 1,
        lane: 0,
        isStart: o.start >= weekStart,
        isEnd: o.end <= weekEnd,
      };
    })
    // Earlier first, then longer first — long bars claim the top lanes.
    .sort((a, b) => a.col - b.col || b.span - a.span);
  const laneEnds: number[] = [];
  for (const p of parts) {
    let lane = laneEnds.findIndex(endCol => endCol < p.col);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = p.col + p.span - 1;
    p.lane = lane;
  }
  return parts;
}

export function CalendarView({ view }: { view: ProjectView }) {
  // Top-level tasks only — subtasks load lazily (useTasksSync's header comment)
  // and appear here only as whichever got fetched elsewhere happening to be in
  // itemsAtom, which would make the calendar's contents depend on prior
  // navigation. SubtaskBadge (shown inline on each event) covers them instead.
  const allItems = useAtomValue(itemsAtom);
  const items = useMemo(() => allItems.filter(i => !i.parentId), [allItems]);
  const fields = view.fields;
  const setForm = useSetAtom(itemFormAtom);
  const { width } = useWindowDimensions();
  const split = width >= SPLIT;
  const narrow = width < NARROW;

  const [mode, setMode] = useState<CalMode>('month');
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState(() => new Date());

  const goToday = () => {
    const today = new Date();
    setCursor(today);
    setSelected(today);
  };
  const step = (dir: 1 | -1) =>
    setCursor(d =>
      mode === 'day'
        ? addDays(d, dir)
        : mode === 'week'
        ? addWeeks(d, dir)
        : mode === 'year'
        ? addYears(d, dir)
        : addMonths(d, dir),
    );
  const openDay = (day: Date) => {
    setCursor(day);
    setSelected(day);
    setMode('day');
  };
  const newTaskOn = (day: Date) =>
    setForm({ mode: 'new', start: format(day, DATE_FMT) });

  useShortcuts({
    arrowleft: () => step(-1),
    arrowright: () => step(1),
    t: goToday,
    d: () => setMode('day'),
    w: () => setMode('week'),
    m: () => setMode('month'),
    y: () => setMode('year'),
  });

  // Swipe left/right on the grid to page (touch); a mouse drag works too.
  const stepRef = useRef(step);
  stepRef.current = step;
  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderRelease: (_, g) => {
        if (g.dx < -60) {
          stepRef.current(1);
        } else if (g.dx > 60) {
          stepRef.current(-1);
        }
      },
    }),
  ).current;

  const weekStart = startOfWeek(cursor, WEEK);
  const weekEnd = addDays(weekStart, 6);
  const title =
    mode === 'day' ? (
      <>
        {format(cursor, 'EEEE')}
        <Text className="font-normal text-text-subtle"> {format(cursor, 'MMM d, yyyy')}</Text>
      </>
    ) : mode === 'week' ? (
      <>
        {format(weekStart, 'MMM d')} – {format(weekEnd, isSameMonth(weekStart, weekEnd) ? 'd' : 'MMM d')}
        <Text className="font-normal text-text-subtle"> {format(weekEnd, 'yyyy')}</Text>
      </>
    ) : mode === 'year' ? (
      format(cursor, 'yyyy')
    ) : (
      <>
        {format(cursor, 'MMMM')}
        <Text className="font-normal text-text-subtle"> {format(cursor, 'yyyy')}</Text>
      </>
    );

  // Distinct tasks in the visible range, for the toolbar.
  const visibleCount = useMemo(() => {
    const [from, to] =
      mode === 'day'
        ? [startOfDay(cursor), startOfDay(cursor)]
        : mode === 'week'
        ? [startOfWeek(cursor, WEEK), addDays(startOfWeek(cursor, WEEK), 6)]
        : mode === 'year'
        ? [startOfYear(cursor), endOfYear(cursor)]
        : [startOfMonth(cursor), endOfMonth(cursor)];
    return new Set(occurrencesBetween(items, from, to).map(o => o.item.id)).size;
  }, [items, mode, cursor]);

  return (
    <View className="flex-1 px-4 lg:px-6">
      <View className="flex-row flex-wrap items-center gap-x-3 gap-y-2 py-3">
        <Text className="min-w-[170px] text-xl font-semibold text-text-heading">{title}</Text>
        <View className="flex-row items-center">
          <IconButton icon={ChevronLeft} label={`Previous ${mode} (←)`} onPress={() => step(-1)} />
          <IconButton icon={ChevronRight} label={`Next ${mode} (→)`} onPress={() => step(1)} />
        </View>
        <Button size="sm" onPress={goToday}>
          Today
        </Button>
        <View className="flex-1" />
        {!narrow ? (
          <Text className="text-xs text-text-subtle">
            {visibleCount} {visibleCount === 1 ? 'task' : 'tasks'}
          </Text>
        ) : null}
        <SegmentedControl options={MODES} value={mode} onChange={setMode} />
      </View>

      <View className="flex-1" {...swipe.panHandlers}>
        {mode === 'year' ? (
          <YearBody items={items} yearAnchor={cursor} onSelectDay={openDay} />
        ) : mode === 'day' ? (
          <DayBody day={cursor} items={items} fields={fields} onNewTask={newTaskOn} />
        ) : mode === 'week' ? (
          <WeekBody
            weekStart={weekStart}
            items={items}
            fields={fields}
            onOpenDay={openDay}
            onNewTask={newTaskOn}
          />
        ) : split ? (
          <View className="flex-1 flex-row gap-4 pb-4">
            <MonthGrid
              cursor={cursor}
              items={items}
              fields={fields}
              selected={selected}
              narrow={false}
              onSelectDay={setSelected}
              onOpenDay={openDay}
              onNewTask={newTaskOn}
            />
            <ScrollView className="w-[300px] grow-0" contentContainerClassName="pb-8">
              <AgendaPanel day={selected} items={items} fields={fields} onNewTask={newTaskOn} />
            </ScrollView>
          </View>
        ) : (
          <ScrollView contentContainerClassName="pb-10">
            <View style={{ height: narrow ? 360 : 540 }}>
              <MonthGrid
                cursor={cursor}
                items={items}
                fields={fields}
                selected={selected}
                narrow={narrow}
                onSelectDay={setSelected}
                onOpenDay={openDay}
                onNewTask={newTaskOn}
              />
            </View>
            <View className="pt-5">
              <AgendaPanel day={selected} items={items} fields={fields} onNewTask={newTaskOn} />
            </View>
          </ScrollView>
        )}
      </View>
    </View>
  );
}

// ── Month ────────────────────────────────────────────────────────────────────

const DATE_ROW_H = 30;
const BAR_H = 20;
const BAR_GAP = 2;
const MORE_H = 16;

const chunkWeeks = (days: Date[]) => {
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
};

function MonthGrid({
  cursor,
  items,
  fields,
  selected,
  narrow,
  onSelectDay,
  onOpenDay,
  onNewTask,
}: {
  cursor: Date;
  items: WorkItem[];
  fields?: ViewField[];
  selected: Date;
  narrow: boolean;
  onSelectDay: (d: Date) => void;
  onOpenDay: (d: Date) => void;
  onNewTask: (d: Date) => void;
}) {
  const weeks = useMemo(
    () =>
      chunkWeeks(
        eachDayOfInterval({
          start: startOfWeek(startOfMonth(cursor), WEEK),
          end: endOfWeek(endOfMonth(cursor), WEEK),
        }),
      ),
    [cursor],
  );
  const occ = useMemo(
    () => occurrencesBetween(items, weeks[0][0], weeks[weeks.length - 1][6]),
    [items, weeks],
  );
  const [rowH, setRowH] = useState(0);

  return (
    <View className="flex-1 overflow-hidden rounded-xl border border-border-main bg-bg-card">
      <View className="flex-row border-b border-border-main bg-muted/60">
        {weeks[0].map(d => (
          <View key={d.toISOString()} className="flex-1 items-center py-2">
            <Text className="text-2xs font-semibold uppercase tracking-wider text-text-subtle">
              {format(d, narrow ? 'EEEEE' : 'EEE')}
            </Text>
          </View>
        ))}
      </View>
      <View className="flex-1">
        {weeks.map((week, wi) => (
          <View
            key={week[0].toISOString()}
            onLayout={wi === 0 ? e => setRowH(e.nativeEvent.layout.height) : undefined}
            className={`flex-1 ${wi > 0 ? 'border-t border-border-main' : ''}`}
          >
            <WeekRow
              days={week}
              occ={occ}
              fields={fields}
              month={cursor}
              selected={selected}
              height={rowH}
              narrow={narrow}
              onSelectDay={onSelectDay}
              onOpenDay={onOpenDay}
              onNewTask={onNewTask}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

function WeekRow({
  days,
  occ,
  fields,
  month,
  selected,
  height,
  narrow,
  onSelectDay,
  onOpenDay,
  onNewTask,
}: {
  days: Date[];
  occ: Occ[];
  fields?: ViewField[];
  month: Date;
  selected: Date;
  height: number;
  narrow: boolean;
  onSelectDay: (d: Date) => void;
  onOpenDay: (d: Date) => void;
  onNewTask: (d: Date) => void;
}) {
  const c = useThemeColors();
  const segments = layoutWeek(occ, days[0]);
  const lanes = segments.reduce((m, s) => Math.max(m, s.lane + 1), 0);
  const pitch = BAR_H + BAR_GAP;
  const room = Math.max(0, height - DATE_ROW_H - 4);
  // Show every lane if they fit; otherwise keep a line free for "+N more".
  const maxLanes =
    lanes * pitch <= room ? lanes : Math.max(0, Math.floor((room - MORE_H) / pitch));
  const hiddenOn = (col: number) =>
    segments.filter(s => s.lane >= maxLanes && s.col <= col && s.col + s.span > col).length;
  const dimmed = mix(c.card, c.bg, c.dark ? 0.6 : 0.6);

  return (
    <View className="flex-1 flex-row">
      {days.map((day, col) => {
        const inMonth = isSameMonth(day, month);
        const today = isToday(day);
        const isSel = isSameDay(day, selected);
        const hidden = hiddenOn(col);
        const dayOcc = narrow ? onDay(occ, day) : [];
        return (
          <Press
            key={day.toISOString()}
            feedback="none"
            accessibilityRole="button"
            accessibilityLabel={format(day, 'EEEE, MMMM d')}
            accessibilityState={{ selected: isSel }}
            onPress={() => onSelectDay(day)}
            onLongPress={() => onOpenDay(day)}
            style={!isSel && (isWeekend(day) || !inMonth) ? { backgroundColor: dimmed } : undefined}
            className={`group flex-1 ${col > 0 ? 'border-l border-border-main' : ''} ${
              isSel ? 'bg-accent-soft' : 'hover:bg-hover/60'
            }`}
          >
            <View
              style={{ height: DATE_ROW_H }}
              className={`flex-row items-center px-1.5 ${
                narrow ? 'justify-center' : 'justify-between'
              }`}
            >
              <View
                className={`h-6 min-w-[24px] items-center justify-center rounded-full px-1.5 ${
                  today ? 'bg-accent' : ''
                }`}
              >
                <Text
                  className={`text-xs ${
                    today
                      ? 'font-semibold text-accent-foreground'
                      : inMonth
                      ? 'font-medium text-text-heading'
                      : 'text-text-subtle'
                  }`}
                >
                  {day.getDate() === 1 && !narrow ? format(day, 'MMM d') : format(day, 'd')}
                </Text>
              </View>
              {!narrow ? (
                <View className="reveal-on-hover">
                  <IconButton
                    icon={Plus}
                    size="sm"
                    label={`New task on ${format(day, 'MMM d')}`}
                    onPress={() => onNewTask(day)}
                  />
                </View>
              ) : null}
            </View>
            {narrow ? (
              <View className="flex-row flex-wrap justify-center gap-0.5 px-1">
                {dayOcc.slice(0, 3).map(o => (
                  <View
                    key={o.key}
                    style={{ backgroundColor: barColor(o.item, fields) }}
                    className="h-1.5 w-1.5 rounded-full"
                  />
                ))}
              </View>
            ) : hidden > 0 ? (
              <Press
                feedback="none"
                accessibilityRole="button"
                accessibilityLabel={`${hidden} more on ${format(day, 'MMM d')}`}
                onPress={() => onOpenDay(day)}
                style={{ top: DATE_ROW_H + maxLanes * pitch }}
                className="absolute left-1 right-1 h-4 justify-center rounded px-1.5 hover:bg-hover"
              >
                <Text className="text-2xs font-medium text-text-main">+{hidden} more</Text>
              </Press>
            ) : null}
          </Press>
        );
      })}

      {!narrow ? (
        <View pointerEvents="box-none" className="absolute inset-0">
          {segments
            .filter(s => s.lane < maxLanes)
            .map(s => (
              <EventBar
                key={`${s.occ.key}-${days[0].toISOString()}`}
                seg={s}
                fields={fields}
                top={DATE_ROW_H + s.lane * pitch}
                height={BAR_H}
              />
            ))}
        </View>
      ) : null}
    </View>
  );
}

const barColor = (item: WorkItem, fields?: ViewField[]) =>
  showsField(fields, 'status') ? statusInfo(item.status).color : '#9ca3af';

// One task bar across the columns of a week row. Continuations into the
// previous/next week get square ends and a ‹ / › hint.
function EventBar({
  seg,
  fields,
  top,
  height,
  detailed = false,
}: {
  seg: Segment;
  fields?: ViewField[];
  top: number;
  height: number;
  detailed?: boolean;
}) {
  const select = useSetAtom(selectedItemIdAtom);
  const toneOf = useTone();
  const c = useThemeColors();
  const { item } = seg.occ;
  const color = barColor(item, fields);
  const t = toneOf(color);
  const r = 5;
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top,
        height,
        left: `${(seg.col / 7) * 100}%`,
        width: `${(seg.span / 7) * 100}%`,
        paddingLeft: seg.isStart ? 4 : 0,
        paddingRight: seg.isEnd ? 4 : 0,
      }}
    >
      <Tooltip
        label={`${item.title} · ${format(seg.occ.start, 'MMM d')} – ${format(seg.occ.end, 'MMM d')}`}
      >
        <Press
          feedback="subtle"
          accessibilityRole="button"
          accessibilityLabel={item.title}
          onPress={() => select(item.id)}
          style={{
            flex: 1,
            // Opaque (tint mixed into the card) so grid lines don't show through.
            backgroundColor: mix(c.card, color, c.dark ? 0.24 : 0.14),
            borderLeftWidth: seg.isStart ? 3 : 0,
            borderLeftColor: color,
            borderTopLeftRadius: seg.isStart ? r : 0,
            borderBottomLeftRadius: seg.isStart ? r : 0,
            borderTopRightRadius: seg.isEnd ? r : 0,
            borderBottomRightRadius: seg.isEnd ? r : 0,
          }}
          className="flex-row items-center gap-1.5 px-1.5 hover:opacity-85"
        >
          {!seg.isStart ? <ChevronLeft size={10} color={t.fg} strokeWidth={2.5} /> : null}
          <Text
            numberOfLines={1}
            style={{ color: t.fg }}
            className={`flex-1 font-medium ${detailed ? 'text-xs' : 'text-2xs'}`}
          >
            {item.title}
          </Text>
          {item.recurrence ? <RecurrenceIcon freq={item.recurrence} size={10} /> : null}
          {detailed && showsField(fields, 'priority') ? (
            <PriorityIcon priority={item.priority} size={12} />
          ) : null}
          {detailed && showsField(fields, 'assignee') ? (
            <AssigneeAvatars ids={item.assigneeIds} size={16} max={2} />
          ) : null}
          {!seg.isEnd ? <ChevronRight size={10} color={t.fg} strokeWidth={2.5} /> : null}
        </Press>
      </Tooltip>
    </View>
  );
}

// ── Week ─────────────────────────────────────────────────────────────────────

const WEEK_BAR_H = 28;

function WeekBody({
  weekStart,
  items,
  fields,
  onOpenDay,
  onNewTask,
}: {
  weekStart: Date;
  items: WorkItem[];
  fields?: ViewField[];
  onOpenDay: (d: Date) => void;
  onNewTask: (d: Date) => void;
}) {
  const c = useThemeColors();
  const days = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
  const occ = useMemo(
    () => occurrencesBetween(items, weekStart, addDays(weekStart, 6)),
    [items, weekStart],
  );
  const segments = layoutWeek(occ, weekStart);
  const lanes = segments.reduce((m, s) => Math.max(m, s.lane + 1), 0);
  const pitch = WEEK_BAR_H + 4;
  const bodyH = Math.max(380, 12 + lanes * pitch + 48);
  const dimmed = mix(c.card, c.bg, 0.6);

  return (
    <View className="mb-4 flex-1 overflow-hidden rounded-xl border border-border-main bg-bg-card">
      <View className="flex-row border-b border-border-main">
        {days.map((d, col) => {
          const today = isToday(d);
          return (
            <Press
              key={d.toISOString()}
              feedback="none"
              accessibilityRole="button"
              accessibilityLabel={`Open ${format(d, 'EEEE, MMMM d')}`}
              onPress={() => onOpenDay(d)}
              className={`flex-1 items-center gap-1 py-2.5 hover:bg-hover/60 ${
                col > 0 ? 'border-l border-border-main' : ''
              }`}
            >
              <Text
                className={`text-2xs font-semibold uppercase tracking-wider ${
                  today ? 'text-accent' : 'text-text-subtle'
                }`}
              >
                {format(d, 'EEE')}
              </Text>
              <View
                className={`h-8 w-8 items-center justify-center rounded-full ${
                  today ? 'bg-accent' : ''
                }`}
              >
                <Text
                  className={`text-lg font-semibold ${
                    today ? 'text-accent-foreground' : 'text-text-heading'
                  }`}
                >
                  {format(d, 'd')}
                </Text>
              </View>
            </Press>
          );
        })}
      </View>
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ minHeight: bodyH, flexGrow: 1 }} className="flex-row">
          {days.map((d, col) => (
            <View
              key={d.toISOString()}
              style={isWeekend(d) ? { backgroundColor: dimmed } : undefined}
              className={`group flex-1 ${col > 0 ? 'border-l border-border-main' : ''}`}
            >
              <View className="reveal-on-hover absolute bottom-2 left-0 right-0 items-center">
                <Button size="sm" variant="ghost" icon={Plus} onPress={() => onNewTask(d)}>
                  Add
                </Button>
              </View>
            </View>
          ))}
          <View pointerEvents="box-none" className="absolute inset-0">
            {segments.map(s => (
              <EventBar
                key={s.occ.key}
                seg={s}
                fields={fields}
                top={12 + s.lane * pitch}
                height={WEEK_BAR_H}
                detailed
              />
            ))}
          </View>
          {segments.length === 0 ? (
            <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
              <CalendarCheck2 size={20} color={c.subtle} />
              <Text className="mt-2 text-sm text-text-subtle">Nothing scheduled this week</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

// ── Day ──────────────────────────────────────────────────────────────────────

const occOnDay = (items: WorkItem[], day: Date) => {
  const d = startOfDay(day);
  return onDay(occurrencesBetween(items, d, d), d);
};

function DayBody({
  day,
  items,
  fields,
  onNewTask,
}: {
  day: Date;
  items: WorkItem[];
  fields?: ViewField[];
  onNewTask: (d: Date) => void;
}) {
  const occ = occOnDay(items, day);
  const c = useThemeColors();
  return (
    <ScrollView contentContainerClassName="pb-10">
      <View className="mx-auto w-full max-w-[760px] gap-2">
        {occ.map(o => (
          <DayCard key={o.key} occ={o} day={day} fields={fields} />
        ))}
        {occ.length === 0 ? (
          <View className="items-center rounded-xl border border-dashed border-border-strong px-6 py-14">
            <CalendarCheck2 size={22} color={c.subtle} />
            <Text className="mt-3 text-base font-medium text-text-heading">Nothing scheduled</Text>
            <Text className="mt-1 text-sm text-text-main">
              {isToday(day) ? 'Your day is clear.' : `No tasks on ${format(day, 'EEEE, MMM d')}.`}
            </Text>
          </View>
        ) : null}
        <View className="mt-1 items-start">
          <Button variant="ghost" size="sm" icon={Plus} onPress={() => onNewTask(day)}>
            {`Add task on ${format(day, 'MMM d')}`}
          </Button>
        </View>
      </View>
    </ScrollView>
  );
}

function DayCard({ occ, day, fields }: { occ: Occ; day: Date; fields?: ViewField[] }) {
  const select = useSetAtom(selectedItemIdAtom);
  const { item } = occ;
  const total = differenceInCalendarDays(occ.end, occ.start) + 1;
  const nth = differenceInCalendarDays(startOfDay(day), occ.start) + 1;
  const color = barColor(item, fields);
  return (
    <Press
      feedback="subtle"
      accessibilityRole="button"
      accessibilityLabel={item.title}
      onPress={() => select(item.id)}
      style={{ borderLeftColor: color }}
      className="flex-row items-center gap-3 rounded-xl border border-l-[3px] border-border-main bg-bg-card px-4 py-3 hover:border-border-strong hover:bg-hover"
    >
      {showsField(fields, 'status') ? <StatusIcon status={item.status} size={16} /> : null}
      <View className="flex-1">
        <View className="flex-row items-center gap-1.5">
          <Text numberOfLines={1} className="shrink text-base font-medium text-text-heading">
            {item.title}
          </Text>
          {item.recurrence ? <RecurrenceIcon freq={item.recurrence} /> : null}
        </View>
        <Text className="mt-0.5 text-xs text-text-subtle">
          {total > 1
            ? `${format(occ.start, 'MMM d')} – ${format(occ.end, 'MMM d')} · day ${nth} of ${total}`
            : 'All day'}
        </Text>
      </View>
      {total > 1 ? (
        <View className="w-20">
          <View className="h-1 overflow-hidden rounded-full bg-muted">
            <View
              style={{ width: `${(nth / total) * 100}%`, backgroundColor: color }}
              className="h-1 rounded-full"
            />
          </View>
        </View>
      ) : null}
      {showsField(fields, 'priority') ? <PriorityIcon priority={item.priority} /> : null}
      {showsField(fields, 'assignee') ? (
        <AssigneeAvatars ids={item.assigneeIds} size={22} />
      ) : null}
    </Press>
  );
}

// ── Selected-day agenda (beside / below the month grid) ─────────────────────

function AgendaPanel({
  day,
  items,
  fields,
  onNewTask,
}: {
  day: Date;
  items: WorkItem[];
  fields?: ViewField[];
  onNewTask: (d: Date) => void;
}) {
  const agenda = occOnDay(items, day);
  const c = useThemeColors();
  return (
    <View>
      <View className="mb-3 flex-row items-center justify-between">
        <View>
          <Text className="text-2xs font-semibold uppercase tracking-wider text-text-subtle">
            {isToday(day) ? 'Today' : format(day, 'EEEE')}
          </Text>
          <Text className="text-lg font-semibold text-text-heading">{format(day, 'MMMM d')}</Text>
        </View>
        <IconButton
          icon={Plus}
          variant="outline"
          label={`New task on ${format(day, 'MMM d')}`}
          onPress={() => onNewTask(day)}
        />
      </View>
      <View className="gap-1.5">
        {agenda.map(o => (
          <ItemRow key={o.key} item={o.item} fields={fields} />
        ))}
        {agenda.length === 0 ? (
          <View className="items-center rounded-xl border border-dashed border-border-strong px-4 py-8">
            <CalendarCheck2 size={18} color={c.subtle} />
            <Text className="mt-2 text-sm text-text-subtle">Nothing scheduled</Text>
          </View>
        ) : null}
      </View>
      <View className="mt-5 flex-row flex-wrap items-center gap-x-3 gap-y-1.5">
        <Hint keys={['←', '→']} label="navigate" />
        <Hint keys={['T']} label="today" />
        <Hint keys={['D', 'W', 'M', 'Y']} label="view" />
      </View>
    </View>
  );
}

function Hint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <View className="flex-row items-center gap-1">
      {keys.map(k => (
        <Kbd key={k}>{k}</Kbd>
      ))}
      <Text className="text-2xs text-text-subtle">{label}</Text>
    </View>
  );
}

// ── Year ─────────────────────────────────────────────────────────────────────

// 12 compact months. Days with tasks get a dot that deepens with how busy the
// day is; tapping a day opens it in Day view.
function YearBody({
  items,
  yearAnchor,
  onSelectDay,
}: {
  items: WorkItem[];
  yearAnchor: Date;
  onSelectDay: (day: Date) => void;
}) {
  const year = yearAnchor.getFullYear();
  const months = useMemo(
    () =>
      eachMonthOfInterval({
        start: new Date(year, 0, 1),
        end: new Date(year, 11, 31),
      }),
    [year],
  );
  const occ = useMemo(
    () => occurrencesBetween(items, new Date(year, 0, 1), new Date(year, 11, 31)),
    [items, year],
  );
  return (
    <ScrollView contentContainerClassName="flex-row flex-wrap gap-3 pb-10">
      {months.map(m => (
        <MiniMonth key={m.toISOString()} month={m} occ={occ} onSelectDay={onSelectDay} />
      ))}
    </ScrollView>
  );
}

function MiniMonth({
  month,
  occ,
  onSelectDay,
}: {
  month: Date;
  occ: Occ[];
  onSelectDay: (day: Date) => void;
}) {
  const weeks = chunkWeeks(
    eachDayOfInterval({
      start: startOfWeek(startOfMonth(month), WEEK),
      end: endOfWeek(endOfMonth(month), WEEK),
    }),
  );
  const current = isSameMonth(month, new Date());
  return (
    <View
      style={{ minWidth: 220, flexGrow: 1, flexBasis: 220 }}
      className={`rounded-xl border bg-bg-card p-3 ${
        current ? 'border-accent/40' : 'border-border-main'
      }`}
    >
      <Text
        className={`mb-2 px-1 text-sm font-semibold ${
          current ? 'text-accent' : 'text-text-heading'
        }`}
      >
        {format(month, 'MMMM')}
      </Text>
      <View className="flex-row">
        {weeks[0].map(d => (
          <Text
            key={d.toISOString()}
            className="flex-1 pb-1 text-center text-2xs font-medium text-text-subtle"
          >
            {format(d, 'EEEEE')}
          </Text>
        ))}
      </View>
      {weeks.map(week => (
        <View key={week[0].toISOString()} className="flex-row">
          {week.map(day => {
            const inMonth = isSameMonth(day, month);
            const count = inMonth ? onDay(occ, day).length : 0;
            const today = isToday(day);
            return (
              <Press
                key={day.toISOString()}
                accessibilityRole="button"
                accessibilityLabel={`${format(day, 'EEEE, MMMM d')}${count ? `, ${count} tasks` : ''}`}
                onPress={() => onSelectDay(day)}
                style={{ flex: 1, minWidth: 0 }}
                className="items-center py-0.5"
              >
                <View
                  className={`h-6 w-6 items-center justify-center rounded-full ${
                    today ? 'bg-accent' : 'hover:bg-hover'
                  }`}
                >
                  <Text
                    className={`text-2xs ${
                      today
                        ? 'font-semibold text-accent-foreground'
                        : inMonth
                        ? 'text-text-heading'
                        : 'text-text-subtle opacity-40'
                    }`}
                  >
                    {format(day, 'd')}
                  </Text>
                </View>
                <View
                  style={{ opacity: count === 0 ? 0 : count === 1 ? 0.45 : count === 2 ? 0.7 : 1 }}
                  className="mt-px h-1 w-1 rounded-full bg-accent"
                />
              </Press>
            );
          })}
        </View>
      ))}
    </View>
  );
}
