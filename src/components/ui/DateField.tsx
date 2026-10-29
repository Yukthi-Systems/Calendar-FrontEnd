import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  Text,
  useWindowDimensions,
  View,
  type ScrollViewInstance,
  type ViewInstance,
} from 'react-native';
import DateTimePicker, { type DateType } from 'react-native-ui-datepicker';
import dayjs from 'dayjs';
import {
  addDays,
  differenceInCalendarDays,
  format,
  isValid,
  nextMonday,
  parse,
} from 'date-fns';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Clock from 'lucide-react-native/icons/clock';
import X from 'lucide-react-native/icons/x';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { ThemeTokens } from '../../theme/tokens';
import { Popover } from './Popover';
import { Press } from './Press';
import type { DateFieldProps } from './DateField.types';

export type { DateFieldProps } from './DateField.types';

const DATE_FMT = 'yyyy-MM-dd';
const parseDate = (s: string) => {
  const d = parse(s, DATE_FMT, new Date());
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && isValid(d) ? d : null;
};

// Date or time field: a field-styled trigger that opens a calendar (dates) or a
// list of times (times) in a popover — a bottom sheet on phones. Built on
// react-native-ui-datepicker (pure JS: identical on web, iOS and Android),
// themed from the app's tokens. Values stay 'yyyy-MM-dd' / 'HH:mm' strings.
export function DateField(props: DateFieldProps) {
  return props.mode === 'time' ? (
    <TimeField {...props} />
  ) : (
    <DatePickerField {...props} />
  );
}

function Trigger({
  icon: Icon,
  label,
  placeholder,
  open,
  invalid,
  onPress,
  onClear,
  accessibilityLabel,
  triggerRef,
}: {
  icon: typeof Clock;
  label: string | null;
  placeholder: string;
  open: boolean;
  invalid: boolean;
  onPress: () => void;
  onClear?: () => void;
  accessibilityLabel?: string;
  triggerRef: React.RefObject<ViewInstance | null>;
}) {
  const c = useThemeColors();
  const border = invalid
    ? 'border-destructive'
    : open
    ? 'border-accent'
    : 'border-border-main hover:border-border-strong';
  return (
    <View ref={triggerRef} collapsable={false}>
      <Press
        feedback="none"
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded: open }}
        onPress={onPress}
        style={
          open
            ? ({ boxShadow: `0 0 0 3px ${c.accent}26` } as object)
            : undefined
        }
        className={`min-h-[36px] flex-row items-center gap-2 rounded-lg border bg-bg-card pl-3 ${
          onClear ? 'pr-1' : 'pr-3'
        } ${border}`}
      >
        <Icon size={15} color={open ? c.accent : c.subtle} />
        <Text
          numberOfLines={1}
          className={`flex-1 py-2 text-base ${
            label ? 'text-text-heading' : 'text-text-subtle'
          }`}
        >
          {label ?? placeholder}
        </Text>
        {onClear ? (
          <Press
            accessibilityRole="button"
            accessibilityLabel="Clear"
            onPress={onClear}
            hitSlop={6}
            className="h-7 w-7 items-center justify-center rounded-md hover:bg-hover"
          >
            <X size={14} color={c.subtle} />
          </Press>
        ) : null}
      </Press>
    </View>
  );
}

// "Today", "Tomorrow", "Yesterday", "in 3 days", "2 days ago" — a quick read of
// how far away the picked date is, shown after it in the trigger.
const relative = (d: Date) => {
  const n = differenceInCalendarDays(d, new Date());
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n > 1 && n < 14) return `in ${n} days`;
  if (n < -1 && n > -14) return `${-n} days ago`;
  return null;
};

function DatePickerField({
  value,
  onChange,
  invalid = false,
  min,
  max,
  clearable = false,
  placeholder = 'Pick a date',
  accessibilityLabel,
}: DateFieldProps) {
  const c = useThemeColors();
  const [open, setOpen] = useState(false);
  const selected = parseDate(value);
  const minD = min ? parseDate(min) : null;
  const maxD = max ? parseDate(max) : null;
  const styles = useMemo(() => calendarStyles(c), [c]);

  const pick = (d: Date) => {
    onChange(format(d, DATE_FMT));
    setOpen(false);
  };
  const inRange = (d: Date) =>
    (!minD || format(d, DATE_FMT) >= format(minD, DATE_FMT)) &&
    (!maxD || format(d, DATE_FMT) <= format(maxD, DATE_FMT));

  const today = new Date();
  const quick = [
    { label: 'Today', date: today },
    { label: 'Tomorrow', date: addDays(today, 1) },
    { label: 'Next week', date: nextMonday(today) },
  ].filter(q => inRange(q.date));

  const rel = selected ? relative(selected) : null;
  const label = selected
    ? `${format(selected, 'EEE, MMM d, yyyy')}${rel ? `  ·  ${rel}` : ''}`
    : null;

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      width={296}
      renderTrigger={ref => (
        <Trigger
          triggerRef={ref}
          icon={CalendarDays}
          label={label}
          placeholder={placeholder}
          open={open}
          invalid={invalid}
          onPress={() => setOpen(true)}
          onClear={clearable && value ? () => onChange('') : undefined}
          accessibilityLabel={accessibilityLabel}
        />
      )}
    >
      <View style={{ width: 272 }}>
        <DateTimePicker
          mode="single"
          date={selected ?? undefined}
          // Opens on the selected month, or the earliest allowed one.
          month={(selected ?? minD ?? today).getMonth()}
          year={(selected ?? minD ?? today).getFullYear()}
          minDate={minD ?? undefined}
          maxDate={maxD ?? undefined}
          onChange={({ date }: { date: DateType }) => {
            if (date) {
              pick(dayjs(date).toDate());
            }
          }}
          firstDayOfWeek={1}
          showOutsideDays
          navigationPosition="right"
          weekdaysFormat="min"
          monthCaptionFormat="full"
          containerHeight={252}
          weekdaysHeight={28}
          styles={styles}
          classNames={{
            day: 'hover:bg-hover',
            month: 'hover:bg-hover',
            year: 'hover:bg-hover',
            button_prev: 'hover:bg-hover',
            button_next: 'hover:bg-hover',
          }}
          components={{
            IconPrev: <ChevronLeft size={16} color={c.text} />,
            IconNext: <ChevronRight size={16} color={c.text} />,
          }}
        />
        {quick.length > 0 ? (
          <View className="mt-2 flex-row gap-1.5 border-t border-border-main pt-2.5">
            {quick.map(q => {
              const active =
                !!selected &&
                format(selected, DATE_FMT) === format(q.date, DATE_FMT);
              return (
                <Press
                  key={q.label}
                  accessibilityRole="button"
                  onPress={() => pick(q.date)}
                  className={`h-7 flex-1 items-center justify-center rounded-md border ${
                    active
                      ? 'border-accent/40 bg-accent-soft'
                      : 'border-border-main hover:border-border-strong hover:bg-hover'
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      active ? 'text-accent' : 'text-text-heading'
                    }`}
                  >
                    {q.label}
                  </Text>
                </Press>
              );
            })}
          </View>
        ) : null}
      </View>
    </Popover>
  );
}

// The library's style slots, filled from the theme so every palette (and dark
// mode) gets a matching calendar.
function calendarStyles(c: ThemeTokens) {
  const label = { fontSize: 13, color: c.heading };
  const caption = {
    fontSize: 14,
    fontWeight: '600' as const,
    color: c.heading,
  };
  return {
    header: { marginBottom: 2, paddingLeft: 4 },
    month_selector_label: caption,
    year_selector_label: { ...caption, color: c.text },
    button_prev: { borderRadius: 6, padding: 6 },
    button_next: { borderRadius: 6, padding: 6 },
    weekday_label: {
      fontSize: 11,
      fontWeight: '500' as const,
      color: c.subtle,
      textTransform: 'uppercase' as const,
    },
    day_cell: { padding: 1.5 },
    day: { borderRadius: 8 },
    day_label: label,
    today: { borderWidth: 1, borderColor: c.accent },
    today_label: { color: c.accent, fontWeight: '600' as const },
    selected: { backgroundColor: c.accent, borderColor: c.accent },
    selected_label: { color: c.accentForeground, fontWeight: '600' as const },
    outside_label: { color: c.subtle, opacity: 0.6 },
    disabled_label: { color: c.subtle, opacity: 0.35 },
    month: { borderRadius: 8, borderWidth: 0 },
    month_label: label,
    selected_month: { backgroundColor: c.accent, borderColor: c.accent },
    selected_month_label: {
      color: c.accentForeground,
      fontWeight: '600' as const,
    },
    year: { borderRadius: 8, borderWidth: 0 },
    year_label: label,
    active_year: { backgroundColor: c.accentSoft, borderColor: c.accentSoft },
    active_year_label: { color: c.accent, fontWeight: '600' as const },
    selected_year: { backgroundColor: c.accent, borderColor: c.accent },
    selected_year_label: {
      color: c.accentForeground,
      fontWeight: '600' as const,
    },
  };
}

// Every 15 minutes, 00:00–23:45, then 23:59 — "end of day", the default due
// time for a new task, so it can always be picked again.
const TIME_SLOTS = [
  ...Array.from({ length: 96 }, (_, i) => {
    const h = String(Math.floor(i / 4)).padStart(2, '0');
    const m = String((i % 4) * 15).padStart(2, '0');
    return `${h}:${m}`;
  }),
  '23:59',
];
const SLOT_H = 32;

function TimeField({
  value,
  onChange,
  invalid = false,
  clearable = false,
  placeholder = 'Pick a time',
  accessibilityLabel,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const scroller = useRef<ScrollViewInstance>(null);
  // A saved time that isn't on the 15-minute grid still shows (and stays
  // selected) in the list.
  const slots = useMemo(
    () =>
      value && !TIME_SLOTS.includes(value)
        ? [...TIME_SLOTS, value].sort()
        : TIME_SLOTS,
    [value],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    const target = value || '09:00';
    const i = Math.max(
      0,
      slots.findIndex(s => s >= target),
    );
    // Wait a frame for the list to lay out, then centre the current time.
    const t = setTimeout(
      () =>
        scroller.current?.scrollTo({
          y: Math.max(0, (i - 3) * SLOT_H),
          animated: false,
        }),
      16,
    );
    return () => clearTimeout(t);
  }, [open, value, slots]);

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      width={168}
      renderTrigger={ref => (
        <Trigger
          triggerRef={ref}
          icon={Clock}
          label={value || null}
          placeholder={placeholder}
          open={open}
          invalid={invalid}
          onPress={() => setOpen(true)}
          onClear={clearable && value ? () => onChange('') : undefined}
          accessibilityLabel={accessibilityLabel}
        />
      )}
    >
      <ScrollView ref={scroller} style={{ maxHeight: 7 * SLOT_H, width: 144 }}>
        {slots.map(s => {
          const active = s === value;
          return (
            <Press
              key={s}
              feedback="none"
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => {
                onChange(s);
                setOpen(false);
              }}
              style={{ height: SLOT_H }}
              className={`justify-center rounded-md px-2.5 ${
                active ? 'bg-accent' : 'hover:bg-hover'
              }`}
            >
              <Text
                className={`text-sm ${
                  active
                    ? 'font-semibold text-accent-foreground'
                    : 'text-text-heading'
                }`}
              >
                {s}
              </Text>
            </Press>
          );
        })}
      </ScrollView>
    </Popover>
  );
}

// ── Date + time in one picker ───────────────────────────────────────────────

export interface DateTimeValue {
  // 'yyyy-MM-dd'
  date: string;
  // 'HH:mm', or '' for all day
  time: string;
}

// "Today, Oct 15 · 11:45" · "Mon, Oct 26 · 23:59" · "Wed, Jan 6, 2027" — the
// actual date always shows (a relative word only replaces the weekday), and the
// trigger stays short enough for two of these side by side.
const dateTimeLabel = ({ date, time }: DateTimeValue) => {
  const d = parseDate(date);
  if (!d) {
    return null;
  }
  const n = differenceInCalendarDays(d, new Date());
  const rel =
    n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n === -1 ? 'Yesterday' : null;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const day = `${rel ?? format(d, 'EEE')}, ${format(
    d,
    sameYear ? 'MMM d' : 'MMM d, yyyy',
  )}`;
  return time ? `${day} · ${time}` : day;
};

// One field for a date and its time: the calendar and a time column side by side
// in one popover (stacked on narrow phones). Picking a day keeps it open so the
// time can follow; picking a time (or "All day") applies both and closes it.
export function DateTimeField({
  value,
  onChange,
  min,
  invalid = false,
  clearable = false,
  allDayLabel = 'All day',
  accessibilityLabel,
  placeholder = 'Pick a date',
}: {
  value: DateTimeValue;
  onChange: (next: DateTimeValue) => void;
  // 'yyyy-MM-dd' — days before it are disabled.
  min?: string;
  invalid?: boolean;
  // An ✕ that empties it (date and time) — for optional fields like search.
  clearable?: boolean;
  // The "no time" option's name — "All day" for a task, "Any time" for a filter.
  allDayLabel?: string;
  accessibilityLabel?: string;
  placeholder?: string;
}) {
  const c = useThemeColors();
  const { width: screenW } = useWindowDimensions();
  const stacked = screenW < 460;
  const [open, setOpen] = useState(false);
  // The day picked in this session of the popover, before a time is chosen.
  const [draftDate, setDraftDate] = useState(value.date);
  const scroller = useRef<ScrollViewInstance>(null);
  const styles = useMemo(() => calendarStyles(c), [c]);
  const selected = parseDate(draftDate);
  const minD = min ? parseDate(min) : null;
  const today = new Date();
  const slots = useMemo(
    () =>
      value.time && !TIME_SLOTS.includes(value.time)
        ? [...TIME_SLOTS, value.time].sort()
        : TIME_SLOTS,
    [value.time],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    setDraftDate(value.date);
    const target = value.time || '09:00';
    const i = Math.max(
      0,
      slots.findIndex(s => s >= target),
    );
    const t = setTimeout(() => {
      const offset = Math.max(0, (i - 3) * SLOT_H);
      scroller.current?.scrollTo(
        stacked
          ? { x: i * 64, animated: false }
          : { y: offset, animated: false },
      );
    }, 16);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on open
  }, [open]);

  const pickDay = (d: Date) => {
    const date = format(d, DATE_FMT);
    setDraftDate(date);
    onChange({ date, time: value.time });
  };
  const pickTime = (time: string) => {
    // A time with no day yet means today.
    onChange({
      date: draftDate || value.date || format(new Date(), DATE_FMT),
      time,
    });
    setOpen(false);
  };

  const quick = [
    { label: 'Today', date: today },
    { label: 'Tomorrow', date: addDays(today, 1) },
    { label: 'Next week', date: nextMonday(today) },
  ].filter(q => !minD || format(q.date, DATE_FMT) >= format(minD, DATE_FMT));

  // The calendar already hides past days (via `min`) — a day with no time left
  // to pick needs the same treatment: once the chosen day is today, every slot
  // already behind the clock is disabled too (unless it's the value already
  // saved there, so re-opening an existing past time doesn't lock it out).
  const todayStr = format(today, DATE_FMT);
  const isToday = (draftDate || todayStr) === todayStr;
  const nowHM = format(new Date(), 'HH:mm');
  const timeOption = (s: string, label = s) => {
    const active = s === value.time;
    const disabled = isToday && !!s && s < nowHM && s !== value.time;
    return (
      <Press
        key={s || 'all-day'}
        feedback="none"
        accessibilityRole="button"
        accessibilityState={{ selected: active, disabled }}
        disabled={disabled}
        onPress={() => pickTime(s)}
        style={stacked ? { height: 30 } : { height: SLOT_H }}
        className={`justify-center rounded-md px-2.5 ${
          active ? 'bg-accent' : disabled ? '' : 'hover:bg-hover'
        }`}
      >
        <Text
          numberOfLines={1}
          className={`text-sm ${
            active
              ? 'font-semibold text-accent-foreground'
              : disabled
              ? 'text-text-subtle opacity-40'
              : 'text-text-heading'
          }`}
        >
          {label}
        </Text>
      </Press>
    );
  };

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      width={stacked ? 296 : 404}
      renderTrigger={ref => (
        <Trigger
          triggerRef={ref}
          icon={CalendarDays}
          label={dateTimeLabel(value)}
          onClear={
            clearable && value.date
              ? () => onChange({ date: '', time: '' })
              : undefined
          }
          placeholder={placeholder}
          open={open}
          invalid={invalid}
          onPress={() => setOpen(true)}
          accessibilityLabel={accessibilityLabel}
        />
      )}
    >
      {/* Stacked: pinned to the calendar's width — the horizontal time strip would
          otherwise size to all its slots and push the calendar off-centre. */}
      <View
        className={stacked ? 'gap-2' : 'flex-row gap-3'}
        style={stacked ? { width: 272 } : undefined}
      >
        <View style={{ width: 272 }}>
          <DateTimePicker
            mode="single"
            date={selected ?? undefined}
            month={(selected ?? minD ?? today).getMonth()}
            year={(selected ?? minD ?? today).getFullYear()}
            minDate={minD ?? undefined}
            onChange={({ date }: { date: DateType }) => {
              if (date) {
                pickDay(dayjs(date).toDate());
              }
            }}
            firstDayOfWeek={1}
            showOutsideDays
            navigationPosition="right"
            weekdaysFormat="min"
            monthCaptionFormat="full"
            containerHeight={252}
            weekdaysHeight={28}
            styles={styles}
            classNames={{
              day: 'hover:bg-hover',
              month: 'hover:bg-hover',
              year: 'hover:bg-hover',
              button_prev: 'hover:bg-hover',
              button_next: 'hover:bg-hover',
            }}
            components={{
              IconPrev: <ChevronLeft size={16} color={c.text} />,
              IconNext: <ChevronRight size={16} color={c.text} />,
            }}
          />
          <View className="mt-2 flex-row gap-1.5 border-t border-border-main pt-2.5">
            {quick.map(q => {
              const active = draftDate === format(q.date, DATE_FMT);
              return (
                <Press
                  key={q.label}
                  accessibilityRole="button"
                  onPress={() => pickDay(q.date)}
                  className={`h-7 flex-1 items-center justify-center rounded-md border ${
                    active
                      ? 'border-accent/40 bg-accent-soft'
                      : 'border-border-main hover:border-border-strong hover:bg-hover'
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      active ? 'text-accent' : 'text-text-heading'
                    }`}
                  >
                    {q.label}
                  </Text>
                </Press>
              );
            })}
          </View>
        </View>

        <View
          className={
            stacked
              ? 'border-t border-border-main pt-2'
              : 'border-l border-border-main pl-3'
          }
          style={stacked ? undefined : { width: 96 }}
        >
          <View className="mb-1.5 flex-row items-center gap-1.5 px-1">
            <Clock size={13} color={c.subtle} />
            <Text className="text-xs font-medium text-text-subtle">Time</Text>
          </View>
          {timeOption('', allDayLabel)}
          <ScrollView
            ref={scroller}
            horizontal={stacked}
            showsHorizontalScrollIndicator={false}
            style={stacked ? undefined : { maxHeight: 9 * SLOT_H }}
            contentContainerClassName={stacked ? 'gap-1' : undefined}
          >
            {slots.map(s => timeOption(s))}
          </ScrollView>
        </View>
      </View>
    </Popover>
  );
}
