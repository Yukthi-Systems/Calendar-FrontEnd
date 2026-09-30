import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  Calendar,
  type CalendarTouchableOpacityProps,
  type EventRenderer,
  type ICalendarEventBase,
  type Mode as CalendarLibMode,
} from 'react-native-big-calendar';
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns';
import { itemsAtom, selectedItemIdAtom } from '../../atoms/project';
import { STATUS_BY_KEY } from '../../data/constants';
import type { WorkItem } from '../../data/types';
import { useThemeColors } from '../../hooks/useThemeColors';
import { AssigneeAvatars, IconButton, ItemRow, SubtaskBadge } from './shared';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SPLIT = 1000; // width where the day agenda moves beside the grid instead of below it
const ROOMY = 700; // width where Month cells have room for a 3rd visible event

type CalMode = 'day' | 'week' | 'month' | 'year';
const MODES: { key: CalMode; label: string }[] = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
];
// Fixed calendar height on narrow screens for Month, which pairs the grid
// with an agenda list below it. Day/Week/Year fill the available space instead.
const MONTH_MOBILE_HEIGHT = 420;
// Month's compact event cell height — kept in step with the `eventMinHeightForMonthView`
// prop passed to <Calendar> below, so the grid reserves exactly this much room per row.
const EVENT_CELL_HEIGHT = 20;

// react-native-big-calendar's own event shape, plus the WorkItem it represents.
interface CalEvent extends ICalendarEventBase {
  workItem: WorkItem;
}

const itemsOn = (items: WorkItem[], day: Date) =>
  items.filter(i => parseISO(i.start) <= day && parseISO(i.end) >= day);

// Splits a flat list of days into weeks of 7, so the Year mini-months render
// one explicit flex-row per week (each cell `flex: 1`) rather than relying on
// flex-wrap with percentage-width cells — that rounds unpredictably on RN's
// Android renderer and was dropping the 7th (Sunday) column to the next line.
const chunkWeeks = (days: Date[]) => {
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
};

export function CalendarView() {
  const items = useAtomValue(itemsAtom);
  const select = useSetAtom(selectedItemIdAtom);
  const { text, heading, accent, border } = useThemeColors();
  const { width } = useWindowDimensions();
  const split = width >= SPLIT;
  const roomy = width >= ROOMY;

  const [mode, setMode] = useState<CalMode>('month');
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState(() => new Date());
  const [bodyHeight, setBodyHeight] = useState(0);

  const goToday = () => {
    const today = new Date();
    setCursor(today);
    setSelected(today);
  };
  const step = (dir: 1 | -1) =>
    setCursor(c => {
      switch (mode) {
        case 'day':
          return addDays(c, dir);
        case 'week':
          return addWeeks(c, dir);
        case 'year':
          return addYears(c, dir);
        default:
          return addMonths(c, dir);
      }
    });
  // From the Year view, jump straight into that day's detail.
  const openDayDetail = (day: Date) => {
    setCursor(day);
    setSelected(day);
    setMode('day');
  };
  // Tapping a date in Month/Week (an empty cell, the date number, or a day
  // header) picks it as the agenda focus, without changing the visible range.
  const pickDay = (day: Date) => setSelected(day);

  const title =
    mode === 'day'
      ? format(cursor, 'EEEE, MMM d, yyyy')
      : mode === 'week'
      ? `${format(
          startOfWeek(cursor, { weekStartsOn: 1 }),
          'MMM d',
        )} – ${format(endOfWeek(cursor, { weekStartsOn: 1 }), 'MMM d, yyyy')}`
      : mode === 'year'
      ? format(cursor, 'yyyy')
      : format(cursor, 'MMMM yyyy');

  // Date-only tasks, mapped to react-native-big-calendar's all-day event shape
  // (both start and end at midnight — that's how the library recognises an
  // event as all-day/multi-day instead of a timed one).
  const calEvents: CalEvent[] = items.map(i => ({
    start: startOfDay(parseISO(i.start)),
    end: addDays(startOfDay(parseISO(i.end)), 1),
    title: i.title,
    workItem: i,
  }));

  // Month's row height is fixed (the grid divides the box evenly, it doesn't
  // grow to fit taller content), so its cells stay single-line to fit inside
  // it — a taller cell just overflows into the row below instead of pushing
  // it down. Week has room to spare, so it keeps the fuller cell.
  const renderEvent: EventRenderer<CalEvent> = (
    event,
    touchableOpacityProps,
  ) => (
    <EventCell
      event={event}
      touchableOpacityProps={touchableOpacityProps}
      compact={mode === 'month'}
    />
  );

  const calendarBox = (
    <View
      className="flex-1 overflow-hidden rounded-2xl border border-border-main"
      onLayout={e => setBodyHeight(e.nativeEvent.layout.height)}
    >
      {bodyHeight > 0 ? (
        <Calendar<CalEvent>
          events={calEvents}
          height={bodyHeight}
          mode={mode as CalendarLibMode}
          date={cursor}
          weekStartsOn={1}
          onPressEvent={e => select(e.workItem.id)}
          onPressCell={pickDay}
          onPressDateHeader={pickDay}
          onSwipeEnd={setCursor}
          renderEvent={renderEvent}
          eventMinHeightForMonthView={EVENT_CELL_HEIGHT}
          maxVisibleEventCount={roomy ? 3 : 2}
          calendarCellStyle={{ overflow: 'hidden' }}
          showAdjacentMonths
          theme={{
            palette: {
              primary: { main: accent, contrastText: '#ffffff' },
              gray: {
                100: border,
                200: border,
                300: border,
                500: text,
                800: heading,
              },
              nowIndicator: accent,
              moreLabel: text,
            },
          }}
        />
      ) : null}
    </View>
  );

  // Full-bleed: no max-width, so the grid uses all the space the screen gives it.
  return (
    <View className="flex-1 px-4">
      <View className="flex-row flex-wrap items-center justify-between gap-3 py-4">
        <Text className="text-lg font-bold text-text-heading">{title}</Text>
        <View className="flex-row items-center gap-2">
          <ModeSwitch mode={mode} onChange={setMode} />
          <Pressable
            accessibilityRole="button"
            onPress={goToday}
            className="rounded-lg border border-border-main px-3 py-2 active:opacity-70"
          >
            <Text className="text-xs text-text-heading">Today</Text>
          </Pressable>
          <IconButton
            icon={ChevronLeft}
            label={`Previous ${mode}`}
            onPress={() => step(-1)}
          />
          <IconButton
            icon={ChevronRight}
            label={`Next ${mode}`}
            onPress={() => step(1)}
          />
        </View>
      </View>

      {mode === 'year' ? (
        <YearBody
          items={items}
          yearAnchor={cursor}
          onSelectDay={openDayDetail}
        />
      ) : mode === 'day' ? (
        // A plain scrollable list, not the calendar library's day grid: our
        // tasks are date ranges, not timed events, so every one of them is an
        // "all-day" entry to it — its all-day row has no cap or scroll of its
        // own, so a day with more than a couple of tasks overflows that fixed-
        // height row and visually blocks the hour grid underneath. A list has
        // no such ceiling.
        <ScrollView contentContainerClassName="pb-8">
          <AgendaPanel day={cursor} items={items} />
        </ScrollView>
      ) : mode === 'week' ? (
        // Same reasoning as Day, one section per day of the week.
        <WeekAgenda
          weekStart={startOfWeek(cursor, { weekStartsOn: 1 })}
          items={items}
        />
      ) : split ? (
        <View className="flex-1 flex-row items-stretch gap-4">
          {calendarBox}
          <ScrollView className="w-80 grow-0" contentContainerClassName="pb-8">
            <AgendaPanel day={selected} items={items} />
          </ScrollView>
        </View>
      ) : (
        <View className="flex-1">
          <View style={{ height: MONTH_MOBILE_HEIGHT }}>{calendarBox}</View>
          <ScrollView className="flex-1" contentContainerClassName="pt-4 pb-8">
            <AgendaPanel day={selected} items={items} />
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function WeekAgenda({
  weekStart,
  items,
}: {
  weekStart: Date;
  items: WorkItem[];
}) {
  const days = eachDayOfInterval({
    start: weekStart,
    end: addDays(weekStart, 6),
  });
  return (
    <ScrollView contentContainerClassName="gap-5 pb-8">
      {days.map(day => {
        const agenda = itemsOn(items, day);
        return (
          <View key={day.toISOString()}>
            <Text
              className={`mb-2 text-sm font-bold ${
                isToday(day) ? 'text-accent' : 'text-text-heading'
              }`}
            >
              {format(day, 'EEEE, MMM d')}
              {isToday(day) ? ' · Today' : ''}
            </Text>
            <View className="gap-2">
              {agenda.map(i => (
                <ItemRow key={i.id} item={i} />
              ))}
              {agenda.length === 0 ? (
                <Text className="text-xs text-text-main">
                  Nothing scheduled.
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

function AgendaPanel({ day, items }: { day: Date; items: WorkItem[] }) {
  const agenda = itemsOn(items, day);
  return (
    <View>
      <Text className="mb-1 text-base font-bold text-text-heading">
        {format(day, 'EEEE, MMM d')}
      </Text>
      <Text className="mb-3 text-xs text-text-main">
        {agenda.length} {agenda.length === 1 ? 'item' : 'items'}
      </Text>
      <View className="gap-2">
        {agenda.map(i => (
          <ItemRow key={i.id} item={i} />
        ))}
        {agenda.length === 0 ? (
          <Text className="text-sm text-text-main">Nothing scheduled.</Text>
        ) : null}
      </View>
    </View>
  );
}

// Renders one task inside a calendar cell — a status-tinted, left-accented bar
// with the title, a subtask count, and its assignees. `touchableOpacityProps`
// carries the library's own press handling plus (for multi-day bars in Month
// view) the absolute position/width it computed, which we keep and layer our
// look on top of.
function EventCell({
  event,
  touchableOpacityProps,
  compact,
}: {
  event: CalEvent;
  touchableOpacityProps: CalendarTouchableOpacityProps;
  compact: boolean;
}) {
  const { key, style, onPress, disabled } = touchableOpacityProps;
  const { workItem } = event;
  const color = STATUS_BY_KEY[workItem.status].color;
  return (
    <Pressable
      key={key}
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={[
        style,
        {
          height: compact ? EVENT_CELL_HEIGHT : undefined,
          backgroundColor: `${color}26`,
          borderLeftColor: color,
          borderLeftWidth: 3,
          borderRadius: 6,
          paddingHorizontal: 6,
          paddingVertical: compact ? 0 : 2,
          justifyContent: 'center',
        },
      ]}
    >
      <Text
        numberOfLines={1}
        className="text-[11px] font-medium text-text-heading"
      >
        {workItem.title}
      </Text>
      {!compact ? (
        <View className="mt-0.5 flex-row items-center gap-1">
          <AssigneeAvatars ids={workItem.assigneeIds} size={14} max={2} />
          <SubtaskBadge id={workItem.id} />
        </View>
      ) : null}
    </Pressable>
  );
}

function ModeSwitch({
  mode,
  onChange,
}: {
  mode: CalMode;
  onChange: (m: CalMode) => void;
}) {
  return (
    <View className="flex-row rounded-lg border border-border-main p-0.5">
      {MODES.map(m => {
        const active = m.key === mode;
        return (
          <Pressable
            key={m.key}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(m.key)}
            className={`rounded-md px-3 py-1.5 active:opacity-70 ${
              active ? 'bg-accent' : ''
            }`}
          >
            <Text
              className={`text-xs font-medium ${
                active ? 'text-white' : 'text-text-main'
              }`}
            >
              {m.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// 12 compact months in a wrapping grid. Each day with items gets a status-colour
// dot; tapping a day jumps straight to its Day view. Kept custom since the
// calendar library has no year mode.
function YearBody({
  items,
  yearAnchor,
  onSelectDay,
}: {
  items: WorkItem[];
  yearAnchor: Date;
  onSelectDay: (day: Date) => void;
}) {
  const months = eachMonthOfInterval({
    start: startOfYear(yearAnchor),
    end: endOfYear(yearAnchor),
  });
  return (
    <View className="flex-1 flex-row flex-wrap gap-4 p-4">
      {months.map(m => (
        <MiniMonth
          key={m.toISOString()}
          month={m}
          items={items}
          onSelectDay={onSelectDay}
        />
      ))}
    </View>
  );
}

function MiniMonth({
  month,
  items,
  onSelectDay,
}: {
  month: Date;
  items: WorkItem[];
  onSelectDay: (day: Date) => void;
}) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });
  return (
    <View
      style={{ minWidth: 220, flexGrow: 1, flexBasis: 220 }}
      className="rounded-2xl border border-border-main bg-bg-card p-3"
    >
      <Text className="mb-2 text-sm font-semibold text-text-heading">
        {format(month, 'MMMM')}
      </Text>
      <View className="flex-row">
        {WEEKDAYS.map(w => (
          <Text
            key={w}
            className="flex-1 text-center text-[9px] font-semibold uppercase text-text-main"
          >
            {w[0]}
          </Text>
        ))}
      </View>
      <View>
        {chunkWeeks(days).map(week => (
          <View key={week[0].toISOString()} className="flex-row">
            {week.map(day => {
              const count = itemsOn(items, day).length;
              const inMonth = isSameMonth(day, month);
              return (
                <Pressable
                  key={day.toISOString()}
                  accessibilityRole="button"
                  accessibilityLabel={format(day, 'EEEE, MMMM d')}
                  onPress={() => onSelectDay(day)}
                  style={{ flex: 1, minWidth: 0 }}
                  className="items-center gap-0.5 py-1 active:opacity-60"
                >
                  <View
                    className={`h-5 w-5 items-center justify-center rounded-full ${
                      isToday(day) ? 'bg-accent' : ''
                    }`}
                  >
                    <Text
                      className={`text-[10px] ${
                        isToday(day)
                          ? 'font-bold text-white'
                          : inMonth
                          ? 'text-text-heading'
                          : 'text-text-main opacity-30'
                      }`}
                    >
                      {format(day, 'd')}
                    </Text>
                  </View>
                  <View
                    style={{ opacity: count > 0 ? 1 : 0 }}
                    className="h-1 w-1 rounded-full bg-accent"
                  />
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}
