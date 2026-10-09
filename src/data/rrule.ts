import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  differenceInCalendarWeeks,
  differenceInCalendarYears,
  format,
  getDaysInMonth,
  parseISO,
  startOfDay,
} from 'date-fns';

// RFC 5545 §3.3.10 RECUR value — parser, writer and expander. Tasks carry dates
// only (no time of day), so the subset is the date-level one:
//   FREQ=DAILY|WEEKLY|MONTHLY|YEARLY, INTERVAL, COUNT, UNTIL, WKST,
//   BYMONTH, BYMONTHDAY (incl. negatives), BYDAY (incl. ordinals like 2MO / -1FR),
//   BYSETPOS.
// Sub-day frequencies and BYSECOND/BYMINUTE/BYHOUR/BYWEEKNO/BYYEARDAY are rejected
// with an RRuleError rather than silently ignored.

export type RRuleFreq = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export type Weekday = 'SU' | 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA';

export const WEEKDAYS: Weekday[] = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

export interface ByDay {
  // Ordinal within the month/year: 1 = first, -1 = last. Absent = every such weekday.
  n?: number;
  day: Weekday;
}

export interface RRule {
  freq: RRuleFreq;
  interval: number;
  count?: number;
  // yyyy-MM-dd, inclusive.
  until?: string;
  wkst: Weekday;
  byMonth?: number[];
  byMonthDay?: number[];
  byDay?: ByDay[];
  bySetPos?: number[];
}

export class RRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RRuleError';
  }
}

const FREQS: RRuleFreq[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];
const UNSUPPORTED_PARTS = [
  'BYSECOND',
  'BYMINUTE',
  'BYHOUR',
  'BYWEEKNO',
  'BYYEARDAY',
];

// ---------------------------------------------------------------- parse

const parseIntStrict = (raw: string, name: string): number => {
  if (!/^[+-]?\d+$/.test(raw)) {
    throw new RRuleError(`${name} must be an integer, got "${raw}"`);
  }
  return parseInt(raw, 10);
};

const parseIntList = (
  raw: string,
  name: string,
  min: number,
  max: number,
  allowNegative: boolean,
): number[] =>
  raw.split(',').map(part => {
    const n = parseIntStrict(part, name);
    const abs = Math.abs(n);
    if (n === 0 || abs < min || abs > max || (!allowNegative && n < 0)) {
      throw new RRuleError(`${name} value "${part}" is out of range`);
    }
    return n;
  });

const parseUntil = (raw: string): string => {
  // DATE (YYYYMMDD) or DATE-TIME (YYYYMMDDTHHMMSS[Z]); only the date matters here.
  const m = /^(\d{4})(\d{2})(\d{2})(T\d{6}Z?)?$/.exec(raw);
  if (!m) {
    throw new RRuleError(`UNTIL "${raw}" is not a valid date`);
  }
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  const d = parseISO(iso);
  if (Number.isNaN(d.getTime()) || format(d, 'yyyy-MM-dd') !== iso) {
    throw new RRuleError(`UNTIL "${raw}" is not a valid date`);
  }
  return iso;
};

const parseByDay = (raw: string): ByDay[] =>
  raw.split(',').map(part => {
    const m = /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/.exec(part);
    if (!m) {
      throw new RRuleError(`BYDAY value "${part}" is not valid`);
    }
    if (m[1] === undefined) {
      return { day: m[2] as Weekday };
    }
    const n = parseInt(m[1], 10);
    if (n === 0 || Math.abs(n) > 53) {
      throw new RRuleError(`BYDAY ordinal in "${part}" is out of range`);
    }
    return { n, day: m[2] as Weekday };
  });

// Accepts "FREQ=…;…", optionally prefixed with "RRULE:" (case-insensitive keys).
export function parseRRule(text: string): RRule {
  const body = text
    .trim()
    .replace(/^RRULE:/i, '')
    .trim();
  if (!body) {
    throw new RRuleError('Rule is empty');
  }

  const parts = new Map<string, string>();
  for (const segment of body.split(';')) {
    if (!segment) {
      continue;
    }
    const eq = segment.indexOf('=');
    if (eq < 1 || eq === segment.length - 1) {
      throw new RRuleError(`"${segment}" is not NAME=VALUE`);
    }
    const key = segment.slice(0, eq).toUpperCase();
    if (parts.has(key)) {
      throw new RRuleError(`${key} appears more than once`);
    }
    parts.set(key, segment.slice(eq + 1).toUpperCase());
  }

  for (const key of UNSUPPORTED_PARTS) {
    if (parts.has(key)) {
      throw new RRuleError(`${key} is not supported (tasks have no time of day)`);
    }
  }

  const freqRaw = parts.get('FREQ');
  if (!freqRaw) {
    throw new RRuleError('FREQ is required');
  }
  if (!FREQS.includes(freqRaw as RRuleFreq)) {
    throw new RRuleError(`FREQ=${freqRaw} is not supported`);
  }

  if (parts.has('COUNT') && parts.has('UNTIL')) {
    throw new RRuleError('COUNT and UNTIL cannot both be set');
  }

  const known = new Set([
    'FREQ',
    'INTERVAL',
    'COUNT',
    'UNTIL',
    'WKST',
    'BYMONTH',
    'BYMONTHDAY',
    'BYDAY',
    'BYSETPOS',
  ]);
  for (const key of parts.keys()) {
    if (!known.has(key)) {
      throw new RRuleError(`${key} is not a recognised rule part`);
    }
  }

  const rule: RRule = {
    freq: freqRaw as RRuleFreq,
    interval: 1,
    wkst: 'MO',
  };

  const interval = parts.get('INTERVAL');
  if (interval !== undefined) {
    rule.interval = parseIntStrict(interval, 'INTERVAL');
    if (rule.interval < 1) {
      throw new RRuleError('INTERVAL must be at least 1');
    }
  }
  const count = parts.get('COUNT');
  if (count !== undefined) {
    rule.count = parseIntStrict(count, 'COUNT');
    if (rule.count < 1) {
      throw new RRuleError('COUNT must be at least 1');
    }
  }
  const until = parts.get('UNTIL');
  if (until !== undefined) {
    rule.until = parseUntil(until);
  }
  const wkst = parts.get('WKST');
  if (wkst !== undefined) {
    if (!WEEKDAYS.includes(wkst as Weekday)) {
      throw new RRuleError(`WKST=${wkst} is not a weekday`);
    }
    rule.wkst = wkst as Weekday;
  }

  const byMonth = parts.get('BYMONTH');
  if (byMonth !== undefined) {
    rule.byMonth = parseIntList(byMonth, 'BYMONTH', 1, 12, false);
  }
  const byMonthDay = parts.get('BYMONTHDAY');
  if (byMonthDay !== undefined) {
    rule.byMonthDay = parseIntList(byMonthDay, 'BYMONTHDAY', 1, 31, true);
  }
  const byDay = parts.get('BYDAY');
  if (byDay !== undefined) {
    rule.byDay = parseByDay(byDay);
    // RFC: numeric BYDAY is only valid for MONTHLY and YEARLY.
    if (
      rule.byDay.some(d => d.n !== undefined) &&
      (rule.freq === 'DAILY' || rule.freq === 'WEEKLY')
    ) {
      throw new RRuleError(
        'BYDAY with a number (e.g. 2MO) only works with MONTHLY or YEARLY',
      );
    }
  }
  const bySetPos = parts.get('BYSETPOS');
  if (bySetPos !== undefined) {
    rule.bySetPos = parseIntList(bySetPos, 'BYSETPOS', 1, 366, true);
    if (!rule.byDay && !rule.byMonthDay && !rule.byMonth) {
      throw new RRuleError('BYSETPOS needs another BY… part to select from');
    }
  }
  if (rule.byMonthDay && rule.freq === 'WEEKLY') {
    throw new RRuleError('BYMONTHDAY cannot be used with WEEKLY');
  }

  return rule;
}

// Non-throwing variant for places (rendering, stored data) that must degrade quietly.
export function tryParseRRule(text: string | null | undefined): RRule | null {
  if (!text) {
    return null;
  }
  try {
    return parseRRule(text);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- write

const byDayText = (d: ByDay) => `${d.n ?? ''}${d.day}`;

// Canonical RFC 5545 text (no "RRULE:" prefix; INTERVAL=1 and WKST=MO omitted).
export function writeRRule(rule: RRule): string {
  const out = [`FREQ=${rule.freq}`];
  if (rule.interval !== 1) {
    out.push(`INTERVAL=${rule.interval}`);
  }
  if (rule.count !== undefined) {
    out.push(`COUNT=${rule.count}`);
  }
  if (rule.until) {
    out.push(`UNTIL=${rule.until.replace(/-/g, '')}`);
  }
  if (rule.wkst !== 'MO') {
    out.push(`WKST=${rule.wkst}`);
  }
  if (rule.byMonth?.length) {
    out.push(`BYMONTH=${rule.byMonth.join(',')}`);
  }
  if (rule.byMonthDay?.length) {
    out.push(`BYMONTHDAY=${rule.byMonthDay.join(',')}`);
  }
  if (rule.byDay?.length) {
    out.push(`BYDAY=${rule.byDay.map(byDayText).join(',')}`);
  }
  if (rule.bySetPos?.length) {
    out.push(`BYSETPOS=${rule.bySetPos.join(',')}`);
  }
  return out.join(';');
}

// Round-trips a rule string into canonical form; throws RRuleError when invalid.
export const normalizeRRule = (text: string): string =>
  writeRRule(parseRRule(text));

// ---------------------------------------------------------------- legacy + presets

// Tasks saved before RRULE support stored one of these words.
const LEGACY: Record<string, string> = {
  weekly: 'FREQ=WEEKLY',
  monthly: 'FREQ=MONTHLY',
  quarterly: 'FREQ=MONTHLY;INTERVAL=3',
  yearly: 'FREQ=YEARLY',
};

export const migrateRecurrence = (value: unknown): string | null => {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  return LEGACY[value.trim().toLowerCase()] ?? value.trim();
};

export const RRULE_PRESETS = [
  { label: 'Daily', rule: 'FREQ=DAILY' },
  { label: 'Weekly', rule: 'FREQ=WEEKLY' },
  { label: 'Monthly', rule: 'FREQ=MONTHLY' },
  { label: 'Quarterly', rule: 'FREQ=MONTHLY;INTERVAL=3' },
  { label: 'Yearly', rule: 'FREQ=YEARLY' },
] as const;

// ---------------------------------------------------------------- expand

const dayIndex = (d: Weekday) => WEEKDAYS.indexOf(d);

// Date at `day` of the month containing `monthStart`, or null if it doesn't exist.
const dayInMonth = (year: number, month: number, day: number): Date | null => {
  const dim = getDaysInMonth(new Date(year, month, 1));
  const d = day > 0 ? day : dim + day + 1;
  return d < 1 || d > dim ? null : new Date(year, month, d);
};

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

// Dates in [from, to] (inclusive, day granularity) whose weekday is `day`.
const weekdaysIn = (from: Date, to: Date, day: Weekday): Date[] => {
  const out: Date[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (d.getDay() === dayIndex(day)) {
      out.push(d);
    }
  }
  return out;
};

// BYDAY entries applied to one span (a month, or a year for YEARLY): plain entries
// match every such weekday, ordinal entries pick the nth (negative: from the end).
const byDayInSpan = (byDay: ByDay[], from: Date, to: Date): Date[] => {
  const out: Date[] = [];
  for (const entry of byDay) {
    const all = weekdaysIn(from, to, entry.day);
    if (entry.n === undefined) {
      out.push(...all);
    } else {
      const picked = entry.n > 0 ? all[entry.n - 1] : all[all.length + entry.n];
      if (picked) {
        out.push(picked);
      }
    }
  }
  return out;
};

const monthCandidates = (
  rule: RRule,
  anchor: Date,
  year: number,
  month: number,
): Date[] => {
  const first = new Date(year, month, 1);
  const last = new Date(year, month, getDaysInMonth(first));
  let days: Date[];

  if (rule.byDay) {
    days = byDayInSpan(rule.byDay, first, last);
    if (rule.byMonthDay) {
      days = days.filter(d =>
        rule.byMonthDay!.some(n => {
          const t = dayInMonth(year, month, n);
          return t ? sameDay(t, d) : false;
        }),
      );
    }
  } else if (rule.byMonthDay) {
    days = rule.byMonthDay
      .map(n => dayInMonth(year, month, n))
      .filter((d): d is Date => d !== null);
  } else {
    // No explicit day: use the anchor's. A day the month lacks (the 31st, Feb 29)
    // clamps to the month's last day, never rolls into the next month.
    days = [new Date(year, month, Math.min(anchor.getDate(), getDaysInMonth(first)))];
  }
  return days;
};

const sortUnique = (dates: Date[]): Date[] => {
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  return sorted.filter((d, i) => i === 0 || !sameDay(d, sorted[i - 1]));
};

const applySetPos = (dates: Date[], setPos?: number[]): Date[] => {
  if (!setPos?.length) {
    return dates;
  }
  const picked = setPos
    .map(p => (p > 0 ? dates[p - 1] : dates[dates.length + p]))
    .filter((d): d is Date => d !== undefined);
  return sortUnique(picked);
};

// Candidate dates for period `k` (0 = the period holding the anchor), before the
// anchor/COUNT/UNTIL cut-offs.
function periodDates(rule: RRule, anchor: Date, k: number): Date[] {
  const step = k * rule.interval;
  const monthOk = (d: Date) =>
    !rule.byMonth || rule.byMonth.includes(d.getMonth() + 1);

  switch (rule.freq) {
    case 'DAILY': {
      const d = addDays(anchor, step);
      const dayOk =
        (!rule.byDay || rule.byDay.some(b => dayIndex(b.day) === d.getDay())) &&
        (!rule.byMonthDay ||
          rule.byMonthDay.some(n => {
            const t = dayInMonth(d.getFullYear(), d.getMonth(), n);
            return t ? sameDay(t, d) : false;
          }));
      return dayOk && monthOk(d) ? [d] : [];
    }
    case 'WEEKLY': {
      const wkstIdx = dayIndex(rule.wkst);
      const back = (anchor.getDay() - wkstIdx + 7) % 7;
      const weekStart = addWeeks(addDays(anchor, -back), step);
      const days = rule.byDay
        ? rule.byDay.map(b => addDays(weekStart, (dayIndex(b.day) - wkstIdx + 7) % 7))
        : [addDays(weekStart, back)];
      return applySetPos(sortUnique(days.filter(monthOk)), rule.bySetPos);
    }
    case 'MONTHLY': {
      const base = addMonths(new Date(anchor.getFullYear(), anchor.getMonth(), 1), step);
      const days = monthCandidates(rule, anchor, base.getFullYear(), base.getMonth());
      return applySetPos(sortUnique(days.filter(monthOk)), rule.bySetPos);
    }
    case 'YEARLY': {
      const year = anchor.getFullYear() + step;
      // BYDAY with no month/month-day narrows the whole year (e.g. 20MO = 20th Monday).
      if (rule.byDay && !rule.byMonth && !rule.byMonthDay) {
        const days = byDayInSpan(rule.byDay, new Date(year, 0, 1), new Date(year, 11, 31));
        return applySetPos(sortUnique(days), rule.bySetPos);
      }
      const months = rule.byMonth?.map(m => m - 1) ?? [anchor.getMonth()];
      const days = months.flatMap(m => monthCandidates(rule, anchor, year, m));
      return applySetPos(sortUnique(days), rule.bySetPos);
    }
  }
}

// How many whole periods lie between the anchor and `target` — used to skip ahead
// when the rule has no COUNT (COUNT forces a walk from the first occurrence).
function periodsBetween(rule: RRule, anchor: Date, target: Date): number {
  let raw: number;
  switch (rule.freq) {
    case 'DAILY':
      raw = differenceInCalendarDays(target, anchor);
      break;
    case 'WEEKLY':
      raw = differenceInCalendarWeeks(target, anchor, {
        weekStartsOn: dayIndex(rule.wkst) as 0 | 1 | 2 | 3 | 4 | 5 | 6,
      });
      break;
    case 'MONTHLY':
      raw = differenceInCalendarMonths(target, anchor);
      break;
    case 'YEARLY':
      raw = differenceInCalendarYears(target, anchor);
      break;
  }
  return Math.max(0, Math.floor(raw / rule.interval));
}

const MAX_PERIODS = 5000; // runaway guard (e.g. an impossible BYMONTHDAY/BYMONTH combo)

// Start dates of every occurrence in [rangeStart, rangeEnd] (day granularity,
// inclusive), in order. `anchor` is the task's own start date and is always the
// first occurrence (RFC: DTSTART counts as one even if the rule wouldn't produce it).
export function expandRRule(
  rule: RRule,
  anchorInput: Date,
  rangeStart: Date,
  rangeEnd: Date,
): { date: Date; index: number }[] {
  const anchor = startOfDay(anchorInput);
  const from = startOfDay(rangeStart);
  const to = startOfDay(rangeEnd);
  const until = rule.until ? parseISO(rule.until) : null;
  const hardEnd = until && until < to ? until : to;
  if (hardEnd < anchor) {
    return [];
  }

  const out: { date: Date; index: number }[] = [];
  let produced = 0;
  let k = 0;
  if (rule.count === undefined) {
    // Skip periods that end before the range; stay one back as slack for
    // rules whose candidates fall earlier than the period's nominal start.
    k = Math.max(0, periodsBetween(rule, anchor, from) - 1);
  }

  for (let n = 0; n < MAX_PERIODS; n++, k++) {
    const dates = periodDates(rule, anchor, k).filter(d => d >= anchor);
    // The anchor itself is occurrence 0 even when the rule wouldn't generate it.
    if (k === 0 && !dates.some(d => sameDay(d, anchor))) {
      dates.unshift(anchor);
    }
    if (dates.length === 0) {
      // Past the end with nothing left to find? Candidates only move forward.
      if (periodStartAfter(rule, anchor, k) > hardEnd) {
        break;
      }
      continue;
    }
    for (const date of dates) {
      if (rule.count !== undefined && produced >= rule.count) {
        return out;
      }
      if (date > hardEnd) {
        return out;
      }
      if (date >= from) {
        out.push({ date, index: produced });
      }
      produced++;
    }
    if (periodStartAfter(rule, anchor, k + 1) > hardEnd) {
      break;
    }
  }
  return out;
}

// Earliest date period `k` could produce (its nominal start) — for stop checks.
function periodStartAfter(rule: RRule, anchor: Date, k: number): Date {
  const step = k * rule.interval;
  switch (rule.freq) {
    case 'DAILY':
      return addDays(anchor, step);
    case 'WEEKLY':
      return addWeeks(anchor, step - 1);
    case 'MONTHLY':
      return new Date(addMonths(new Date(anchor.getFullYear(), anchor.getMonth(), 1), step));
    case 'YEARLY':
      return new Date(addYears(new Date(anchor.getFullYear(), 0, 1), step));
  }
}

// ---------------------------------------------------------------- describe

const DAY_NAME: Record<Weekday, string> = {
  SU: 'Sunday',
  MO: 'Monday',
  TU: 'Tuesday',
  WE: 'Wednesday',
  TH: 'Thursday',
  FR: 'Friday',
  SA: 'Saturday',
};
const MONTH_NAME = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const ordinal = (n: number): string => {
  if (n === -1) {
    return 'last';
  }
  if (n < 0) {
    return `${ordinal(-n)} from last`;
  }
  const v = n % 100;
  if (v >= 11 && v <= 13) {
    return `${n}th`;
  }
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
};

const joinList = (items: string[]) =>
  items.length <= 1
    ? items.join('')
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

// Plain-English summary, e.g. "Every 2 weeks on Monday and Friday, 10 times".
export function describeRRule(rule: RRule): string {
  const unit = { DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month', YEARLY: 'year' }[
    rule.freq
  ];
  let text =
    rule.interval === 1
      ? { DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly', YEARLY: 'Yearly' }[
          rule.freq
        ]
      : `Every ${rule.interval} ${unit}s`;
  if (rule.freq === 'MONTHLY' && rule.interval === 3 && !hasBy(rule)) {
    text = 'Quarterly';
  }

  if (rule.byDay?.length) {
    text += ` on ${joinList(
      rule.byDay.map(d =>
        d.n === undefined ? DAY_NAME[d.day] : `the ${ordinal(d.n)} ${DAY_NAME[d.day]}`,
      ),
    )}`;
  }
  if (rule.byMonthDay?.length) {
    text += ` on the ${joinList(rule.byMonthDay.map(ordinal))}`;
  }
  if (rule.byMonth?.length) {
    text += ` in ${joinList(rule.byMonth.map(m => MONTH_NAME[m - 1]))}`;
  }
  if (rule.bySetPos?.length) {
    text += ` (occurrence ${rule.bySetPos.join(', ')} of each set)`;
  }
  if (rule.count !== undefined) {
    text += `, ${rule.count} time${rule.count === 1 ? '' : 's'}`;
  }
  if (rule.until) {
    text += `, until ${format(parseISO(rule.until), 'MMM d, yyyy')}`;
  }
  return text;
}

const hasBy = (rule: RRule) =>
  !!(rule.byDay || rule.byMonth || rule.byMonthDay || rule.bySetPos);

// Label for any stored recurrence value (legacy words included); '' when invalid.
export function describeRecurrence(value: string | null | undefined): string {
  const rule = tryParseRRule(migrateRecurrence(value));
  return rule ? describeRRule(rule) : '';
}
