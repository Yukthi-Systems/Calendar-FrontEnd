import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { CalendarCheck2, ChevronLeft, ChevronRight } from 'lucide-react-native';
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
import { statusInfo } from '../../data/constants';
import { occurrencesInRange } from '../../data/recurrence';
import { showsField } from '../../data/viewFields';
import type { ProjectView, ViewField, WorkItem } from '../../data/types';
import { useThemeColors, useTone } from '../../hooks/useThemeColors';
import { Button, IconButton, Press, SegmentedControl } from '../ui';
import {
  AssigneeAvatars,
  ItemRow,
  PriorityIcon,
  RecurrenceIcon,
  SubtaskBadge,
} from './shared';

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

// Items active on `day`, counting each repeat of a recurring task as if it
// were present — e.g. a weekly task shows up every week it recurs into, not
// only in the week it was created. The task itself is still one WorkItem;
// this only decides what to *display*, same as `occurrencesInRange` it reads.
const itemsOn = (items: WorkItem[], day: Date) =>
  items.filter(
    i =>
      occurrencesInRange(
        parseISO(i.start),
        parseISO(i.end),
        i.recurrence,
        day,
        day,
      ).length > 0,
  );

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

export function CalendarView({ view }: { view: ProjectView }) {
  const items = useAtomValue(itemsAtom);
  const fields = view.fields;
  const select = useSetAtom(selectedItemIdAtom);
  const c = useThemeColors();
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
    setCursor(d => {
      switch (mode) {
        case 'day':
          return addDays(d, dir);
        case 'week':
          return addWeeks(d, dir);
        case 'year':
          return addYears(d, dir);
        default:
          return addMonths(d, dir);
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
  // event as all-day/multi-day instead of a timed one). Only consumed by
  // Month mode, so expanding recurring tasks just across the padded month
  // grid (not open-ended) keeps this bounded regardless of how old the task is.
  const monthRangeStart = startOfWeek(startOfMonth(cursor), {
    weekStartsOn: 1,
  });
  const monthRangeEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
  const calEvents: CalEvent[] = items.flatMap(i =>
    occurrencesInRange(
      parseISO(i.start),
      parseISO(i.end),
      i.recurrence,
      monthRangeStart,
      monthRangeEnd,
    ).map(occ => ({
      start: startOfDay(occ.start),
      end: addDays(startOfDay(occ.end), 1),
      title: i.title,
      workItem: i,
    })),
  );

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
      fields={fields}
    />
  );

  const calendarBox = (
    <View
      className="flex-1 overflow-hidden rounded-xl border border-border-main bg-bg-card"
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
              primary: { main: c.accent, contrastText: c.accentForeground },
              gray: {
                100: c.border,
                200: c.border,
                300: c.border,
                500: c.subtle,
                800: c.heading,
              },
              nowIndicator: c.accent,
              moreLabel: c.text,
            },
            typography: {
              xs: { fontSize: 11, fontWeight: '500' },
              sm: { fontSize: 12, fontWeight: '500' },
              xl: { fontSize: 15, fontWeight: '600' },
            },
          }}
        />
      ) : null}
    </View>
  );

  // Full-bleed: no max-width, so the grid uses all the space the screen gives it.
  return (
    <View className="flex-1 px-4 lg:px-6">
      <View className="flex-row flex-wrap items-center gap-3 py-3">
        <View className="flex-row items-center gap-1">
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
        <Text className="text-lg font-semibold text-text-heading">{title}</Text>
        <View className="flex-1" />
        <Button size="sm" onPress={goToday}>
          Today
        </Button>
        <SegmentedControl options={MODES} value={mode} onChange={setMode} />
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
          <AgendaPanel day={cursor} items={items} fields={fields} />
        </ScrollView>
      ) : mode === 'week' ? (
        // Same reasoning as Day, one section per day of the week.
        <WeekAgenda
          weekStart={startOfWeek(cursor, { weekStartsOn: 1 })}
          items={items}
          fields={fields}
        />
      ) : split ? (
        <View className="flex-1 flex-row items-stretch gap-4">
          {calendarBox}
          <ScrollView className="w-80 grow-0" contentContainerClassName="pb-8">
            <AgendaPanel day={selected} items={items} fields={fields} />
          </ScrollView>
        </View>
      ) : (
        <View className="flex-1">
          <View style={{ height: MONTH_MOBILE_HEIGHT }}>{calendarBox}</View>
          <ScrollView className="flex-1" contentContainerClassName="pt-4 pb-8">
            <AgendaPanel day={selected} items={items} fields={fields} />
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function WeekAgenda({
  weekStart,
  items,
  fields,
}: {
  weekStart: Date;
  items: WorkItem[];
  fields?: ViewField[];
}) {
  const days = eachDayOfInterval({
    start: weekStart,
    end: addDays(weekStart, 6),
  });
  return (
    <ScrollView contentContainerClassName="gap-3 pb-10">
      {days.map(day => {
        const agenda = itemsOn(items, day);
        const today = isToday(day);
        return (
          <View
            key={day.toISOString()}
            className={`flex-row gap-4 rounded-xl border bg-bg-card p-3 ${
              today ? 'border-accent/40' : 'border-border-main'
            }`}
          >
            <View className="w-14 items-center pt-0.5">
              <Text
                className={`text-2xs font-semibold uppercase tracking-wider ${
                  today ? 'text-accent' : 'text-text-subtle'
                }`}
              >
                {format(day, 'EEE')}
              </Text>
              <View
                className={`mt-1 h-8 w-8 items-center justify-center rounded-full ${
                  today ? 'bg-accent' : ''
                }`}
              >
                <Text
                  className={`text-lg font-semibold ${
                    today ? 'text-accent-foreground' : 'text-text-heading'
                  }`}
                >
                  {format(day, 'd')}
                </Text>
              </View>
            </View>
            <View className="flex-1 justify-center gap-1.5">
              {agenda.map(i => (
                <ItemRow key={i.id} item={i} fields={fields} />
              ))}
              {agenda.length === 0 ? (
                <Text className="text-sm text-text-subtle">Nothing scheduled</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

function AgendaPanel({
  day,
  items,
  fields,
}: {
  day: Date;
  items: WorkItem[];
  fields?: ViewField[];
}) {
  const agenda = itemsOn(items, day);
  const c = useThemeColors();
  return (
    <View>
      <View className="mb-3 flex-row items-baseline justify-between">
        <Text className="text-base font-semibold text-text-heading">
          {isToday(day) ? 'Today' : format(day, 'EEEE')}
          <Text className="font-normal text-text-subtle">
            {'  '}
            {format(day, 'MMM d')}
          </Text>
        </Text>
        <Text className="text-xs text-text-subtle">
          {agenda.length} {agenda.length === 1 ? 'task' : 'tasks'}
        </Text>
      </View>
      <View className="gap-1.5">
        {agenda.map(i => (
          <ItemRow key={i.id} item={i} fields={fields} />
        ))}
        {agenda.length === 0 ? (
          <View className="items-center rounded-xl border border-dashed border-border-strong px-4 py-8">
            <CalendarCheck2 size={18} color={c.subtle} />
            <Text className="mt-2 text-sm text-text-subtle">Nothing scheduled</Text>
          </View>
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
  fields,
}: {
  event: CalEvent;
  touchableOpacityProps: CalendarTouchableOpacityProps;
  compact: boolean;
  fields?: ViewField[];
}) {
  const { key, style, onPress, disabled } = touchableOpacityProps;
  const { workItem } = event;
  const toneOf = useTone();
  const color = showsField(fields, 'status')
    ? statusInfo(workItem.status).color
    : '#9ca3af';
  const t = toneOf(color);
  return (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityLabel={workItem.title}
      onPress={onPress}
      disabled={disabled}
      style={[
        style,
        {
          height: compact ? EVENT_CELL_HEIGHT : undefined,
          backgroundColor: t.bg,
          borderLeftColor: color,
          borderLeftWidth: 2.5,
          borderRadius: 4,
          paddingHorizontal: 5,
          paddingVertical: compact ? 0 : 3,
          justifyContent: 'center',
        },
      ]}
      className="hover:opacity-80"
    >
      <View className="flex-row items-center gap-1">
        <Text
          numberOfLines={1}
          style={{ color: t.fg }}
          className="shrink text-2xs font-medium"
        >
          {workItem.title}
        </Text>
        {workItem.recurrence ? (
          <RecurrenceIcon freq={workItem.recurrence} size={9} />
        ) : null}
      </View>
      {!compact ? (
        <View className="mt-0.5 flex-row items-center gap-1.5">
          {showsField(fields, 'id') ? (
            <Text className="text-2xs text-text-subtle">{workItem.id}</Text>
          ) : null}
          {showsField(fields, 'priority') ? (
            <PriorityIcon priority={workItem.priority} size={11} />
          ) : null}
          {showsField(fields, 'assignee') ? (
            <AssigneeAvatars ids={workItem.assigneeIds} size={14} max={2} />
          ) : null}
          <SubtaskBadge id={workItem.id} />
        </View>
      ) : null}
    </Pressable>
  );
}

// 12 compact months in a wrapping grid. Days with tasks get an accent dot;
// tapping a day jumps straight to its Day view. Kept custom since the calendar
// library has no year mode.
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
    <ScrollView contentContainerClassName="flex-row flex-wrap gap-3 pb-10">
      {months.map(m => (
        <MiniMonth
          key={m.toISOString()}
          month={m}
          items={items}
          onSelectDay={onSelectDay}
        />
      ))}
    </ScrollView>
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
        {WEEKDAYS.map(w => (
          <Text
            key={w}
            className="flex-1 pb-1 text-center text-2xs font-medium text-text-subtle"
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
              const today = isToday(day);
              return (
                <Press
                  key={day.toISOString()}
                  feedback="scale"
                  accessibilityRole="button"
                  accessibilityLabel={`${format(day, 'EEEE, MMMM d')}${
                    count ? `, ${count} tasks` : ''
                  }`}
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
                    style={{ opacity: count > 0 && inMonth ? 1 : 0 }}
                    className="mt-px h-1 w-1 rounded-full bg-accent"
                  />
                </Press>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}
