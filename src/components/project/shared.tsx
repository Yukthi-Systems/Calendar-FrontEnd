import { useMemo, useState, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import CircleCheck from 'lucide-react-native/icons/circle-check';
import CircleDashed from 'lucide-react-native/icons/circle-dashed';
import CircleDot from 'lucide-react-native/icons/circle-dot';
import CirclePause from 'lucide-react-native/icons/circle-pause';
import CircleX from 'lucide-react-native/icons/circle-x';
import ListTree from 'lucide-react-native/icons/list-tree';
import Repeat from 'lucide-react-native/icons/repeat';
import Search from 'lucide-react-native/icons/search';
import type { LucideIcon } from 'lucide-react-native';
import { useAtomValue, useSetAtom } from 'jotai';
import { differenceInCalendarDays, endOfDay, format, parseISO } from 'date-fns';
import { itemsAtom, selectedItemIdAtom } from '../../atoms/project';
import { currentUserIdAtom } from '../../atoms/members';
import { statusInfo } from '../../data/constants';
import { useThemeColors } from '../../hooks/useThemeColors';
import { usePeople, usePerson, type Person } from '../../hooks/useUsers';
import { describeRecurrence } from '../../data/rrule';
import { isVirtualRecurringId } from '../../data/recurringOccurrences';
import { subtaskProgress } from '../../data/tree';
import { showsField } from '../../data/viewFields';
import type { Status, ViewField, WorkItem } from '../../data/types';
import { Tooltip } from './Tooltip';
import {
  Badge,
  Button,
  CheckboxBox,
  Input,
  Press,
  Sheet,
  SheetFooter,
  SheetHeader,
} from '../ui';

// A colour + initials circle, decoupled from the team-member lookup below —
// also used for the account profile avatar, which isn't necessarily a member.
export function InitialsAvatar({
  color,
  initials,
  size = 24,
  ring = false,
}: {
  color: string;
  initials: string;
  size?: number;
  // A card-colour border so stacked avatars (AssigneeAvatars) read as separate circles;
  // 'accent' marks the signed-in user.
  ring?: boolean | 'accent';
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        borderWidth: ring === 'accent' ? 2 : ring ? 1.5 : 0,
      }}
      className={`items-center justify-center ${
        ring === 'accent' ? 'border-accent' : ring ? 'border-bg-card' : ''
      }`}
    >
      <Text
        style={{ fontSize: Math.max(9, size * 0.38), lineHeight: size }}
        className="font-semibold text-white"
      >
        {initials}
      </Text>
    </View>
  );
}

export function Avatar({
  id,
  size = 24,
  ring = false,
}: {
  id: string | null;
  size?: number;
  ring?: boolean | 'accent';
}) {
  const m = usePerson(id);
  const me = useAtomValue(currentUserIdAtom);
  return (
    <Tooltip
      label={
        id && id === me ? `You (${m?.name ?? '…'})` : m?.name ?? 'Unassigned'
      }
    >
      <InitialsAvatar
        color={m?.color ?? '#9ca3af'}
        initials={m?.initials ?? '?'}
        size={size}
        ring={ring}
      />
    </Tooltip>
  );
}

// Me first, then everyone else in their original order.
const meFirst = (ids: string[], me: string) =>
  ids.includes(me) ? [me, ...ids.filter(id => id !== me)] : ids;

// Overlapping avatars for an item's assignee list, capped at `max` with a
// "+N" tail. If I'm assigned, I come first with an accent ring — so tasks of
// mine stand out in every view. Renders a dashed "unassigned" placeholder when
// the list is empty.
export function AssigneeAvatars({
  ids: given,
  size = 22,
  max = 3,
}: {
  ids: string[];
  size?: number;
  max?: number;
}) {
  const me = useAtomValue(currentUserIdAtom);
  const ids = meFirst(given, me);
  const people = usePeople(ids.slice(max));
  if (ids.length === 0) {
    return (
      <Tooltip label="Unassigned">
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 1.5,
            borderStyle: 'dashed',
          }}
          className="border-border-strong"
        />
      </Tooltip>
    );
  }
  const shown = ids.slice(0, max);
  const rest = ids.length - shown.length;
  return (
    <View className="flex-row items-center">
      {shown.map((id, i) => (
        <View key={id} style={{ marginLeft: i === 0 ? 0 : -size * 0.28 }}>
          <Avatar id={id} size={size} ring={id === me ? 'accent' : true} />
        </View>
      ))}
      {rest > 0 ? (
        <Tooltip label={namesOf(ids.slice(max), people)}>
          <View
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              marginLeft: -size * 0.28,
              borderWidth: 1.5,
            }}
            className="items-center justify-center border-bg-card bg-muted"
          >
            <Text
              style={{ fontSize: Math.max(9, size * 0.36) }}
              className="font-semibold text-text-main"
            >
              +{rest}
            </Text>
          </View>
        </Tooltip>
      ) : null}
    </View>
  );
}

// Comma-separated names for an assignee list, given people resolved with
// usePeople (table sorting, detail sheet).
// With `me`, I'm listed first, as "You".
export const namesOf = (
  ids: string[],
  people: Map<string, Person>,
  me?: string,
) =>
  ids.length === 0
    ? 'Unassigned'
    : (me ? meFirst(ids, me) : ids)
        .map(id => (me && id === me ? 'You' : people.get(id)?.name ?? '…'))
        .join(', ');

export function AssigneeNames({
  ids,
  className = 'text-sm text-text-heading',
}: {
  ids: string[];
  className?: string;
}) {
  const people = usePeople(ids);
  const me = useAtomValue(currentUserIdAtom);
  return (
    <Text numberOfLines={1} className={className}>
      {namesOf(ids, people, me)}
    </Text>
  );
}

// Small badge marking a task as recurring — used anywhere a title shows
// (ItemRow, Table, Kanban). Wrapped in a Tooltip naming the frequency, since
// the icon alone doesn't say which.
export function RecurrenceIcon({
  freq,
  size = 12,
}: {
  freq: string;
  size?: number;
}) {
  const { subtle } = useThemeColors();
  return (
    <Tooltip label={describeRecurrence(freq) || 'Repeats'}>
      <Repeat size={size} color={subtle} strokeWidth={2} />
    </Tooltip>
  );
}

const STATUS_ICON: Record<Status, LucideIcon> = {
  not_started: CircleDashed,
  in_progress: CircleDot,
  completed: CircleCheck,
  rejected: CircleX,
  on_hold: CirclePause,
};

// Shape + colour per status (Linear-style), readable without relying on colour alone.
export function StatusIcon({
  status,
  size = 15,
}: {
  status: Status;
  size?: number;
}) {
  const s = statusInfo(status);
  const Icon = STATUS_ICON[status] ?? CircleDashed;
  return (
    <Tooltip label={s.label}>
      <Icon size={size} color={s.color} strokeWidth={2.25} />
    </Tooltip>
  );
}

// Kept for call sites that only have room for a dot.
export function StatusDot({ status }: { status: Status }) {
  return (
    <View
      style={{ backgroundColor: statusInfo(status).color }}
      className="h-2 w-2 rounded-full"
    />
  );
}

export function StatusBadge({ status }: { status: Status }) {
  const s = statusInfo(status);
  return <Badge label={s.label} color={s.color} dot />;
}

// "Oct 14", tinted red when it's past and the task isn't finished, amber when due
// within a day.
export function DueDate({
  item,
  className = 'text-sm',
}: {
  item: WorkItem;
  className?: string;
}) {
  const done = item.status === 'completed' || item.status === 'rejected';
  const now = new Date();
  const days = differenceInCalendarDays(parseISO(item.end), now);
  // With a due time, overdue is exact; an all-day task is due by the day's end.
  const dueAt = item.endTime
    ? parseISO(`${item.end}T${item.endTime}`)
    : endOfDay(parseISO(item.end));
  const overdue = dueAt < now;
  const tint = !done && overdue ? 'text-destructive' : 'text-text-main';
  return (
    <Tooltip
      label={
        done
          ? `Due ${format(parseISO(item.end), 'PP')}`
          : overdue
          ? days < 0
            ? `Overdue by ${-days} day${days === -1 ? '' : 's'}`
            : `Overdue since ${item.endTime}`
          : days === 0
          ? item.endTime
            ? `Due today at ${item.endTime}`
            : 'Due today'
          : `Due in ${days} day${days === 1 ? '' : 's'}`
      }
    >
      <Text numberOfLines={1} className={`${className} ${tint}`}>
        {format(parseISO(item.end), 'MMM d')}
        {item.endTime ? ` ${item.endTime}` : ''}
      </Text>
    </Tooltip>
  );
}

// Compact row used by the team, calendar and search views.
export function ItemRow({
  item,
  showAssignee = true,
  fields,
  onPress,
}: {
  item: WorkItem;
  showAssignee?: boolean;
  fields?: ViewField[];
  onPress?: () => void;
}) {
  const select = useSetAtom(selectedItemIdAtom);
  const c = useThemeColors();
  const virtual = isVirtualRecurringId(item.id);
  return (
    <Press
      feedback="subtle"
      accessibilityRole="button"
      onPress={onPress ?? (() => select(item.id))}
      className={`flex-row items-center gap-2.5 rounded-lg border bg-bg-card px-3 py-2 hover:border-border-strong hover:bg-hover ${
        virtual
          ? 'border-dashed border-border-main opacity-80'
          : 'border-border-main'
      }`}
    >
      {showsField(fields, 'status') && !virtual ? (
        <StatusIcon status={item.status} />
      ) : null}
      <View className="flex-1">
        <View className="flex-row items-center gap-1.5">
          <Text
            numberOfLines={1}
            className={`shrink text-sm font-medium ${
              virtual ? 'text-text-subtle' : 'text-text-heading'
            }`}
          >
            {item.title}
          </Text>
          {item.recurrence ? (
            <RecurrenceIcon freq={item.recurrence} size={11} />
          ) : virtual ? (
            <Repeat size={11} color={c.subtle} />
          ) : null}
        </View>
        <View className="mt-0.5 flex-row items-center gap-2">
          <DueDate item={item} className="text-2xs" />
          <SubtaskBadge item={item} />
        </View>
      </View>
      {showAssignee && showsField(fields, 'assignee') ? (
        <AssigneeAvatars ids={item.assigneeIds} size={20} />
      ) : null}
    </Press>
  );
}

// Content column for scrolling pages: the ScrollView spans the window (so its
// scrollbar sits at the edge) while the content stays centred and readable.
export const PAGE_STYLE = {
  width: '100%',
  maxWidth: 1120,
  alignSelf: 'center',
} as const;

// Multi-select picker: a trigger showing the current selection that opens a
// searchable sheet — a list of 100+ options would otherwise push the rest of the
// form far down the screen. Used for the item form's Assignees field.
export function MultiSelectDropdown({
  label,
  options,
  selectedIds,
  onToggle,
  placeholder,
  onQueryChange,
  trigger,
}: {
  // Called as the search box changes, for pickers that also search remotely.
  onQueryChange?: (query: string) => void;
  // Sheet title, shown while the picker is open. Falls back to `placeholder`.
  label?: string;
  // Replaces the default "chip row + chevron" trigger (e.g. an avatar list
  // with its own "+" button) — called with the function that opens the sheet.
  // The sheet/search/list themselves are unchanged either way.
  trigger?: (open: () => void) => ReactNode;
  // `locked`: shown checked (if it is) but can't be toggled off — e.g. you can
  // never remove yourself as an assignee, only add yourself; or (once a task is
  // server-backed) nobody can be unassigned at all, since the API only has an
  // endpoint to add one. `lockedLabel` names why; defaults to "You" since that
  // was the only case this covered originally.
  options: {
    id: string;
    label: string;
    color?: string;
    locked?: boolean;
    lockedLabel?: string;
    // Secondary line (an email) — also matched by the search box.
    hint?: string;
  }[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const c = useThemeColors();
  const selected = options.filter(o => selectedIds.includes(o.id));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? options.filter(
          o =>
            o.label.toLowerCase().includes(q) ||
            (o.hint ?? '').toLowerCase().includes(q) ||
            o.id.toLowerCase().includes(q),
        )
      : options;
  }, [options, query]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <View>
      {trigger ? (
        trigger(() => setOpen(true))
      ) : (
        <Press
          feedback="none"
          accessibilityRole="button"
          onPress={() => setOpen(true)}
          className="min-h-[36px] flex-row items-center gap-2 rounded-lg border border-border-main bg-bg-card px-3 py-1.5 hover:border-border-strong"
        >
          {selected.length > 0 ? (
            <View className="flex-1 flex-row items-center gap-2">
              <AssigneeAvatars
                ids={selected.map(o => o.id)}
                size={20}
                max={4}
              />
              <Text
                numberOfLines={1}
                className="flex-1 text-base text-text-heading"
              >
                {selected.map(o => o.label).join(', ')}
              </Text>
            </View>
          ) : (
            <Text className="flex-1 text-base text-text-subtle">
              {placeholder}
            </Text>
          )}
          <ChevronDown size={15} color={c.subtle} />
        </Press>
      )}

      <Sheet visible={open} onClose={close} size="sm">
        <SheetHeader title={label ?? placeholder} onClose={close} />
        <View className="px-5 pb-2">
          <Input
            icon={Search}
            value={query}
            onChangeText={q => {
              setQuery(q);
              onQueryChange?.(q);
            }}
            placeholder="Search people by name or email…"
            autoFocus
          />
        </View>
        <ScrollView
          style={{ flexGrow: 0, flexShrink: 1, maxHeight: 360 }}
          contentContainerClassName="px-3 pb-2"
          keyboardShouldPersistTaps="handled"
        >
          {filtered.map(o => {
            const checked = selectedIds.includes(o.id);
            return (
              <Press
                key={o.id}
                feedback="subtle"
                accessibilityRole="checkbox"
                accessibilityState={{ checked, disabled: o.locked }}
                disabled={o.locked}
                onPress={() => onToggle(o.id)}
                className="flex-row items-center gap-3 rounded-lg px-2 py-2 hover:bg-hover"
              >
                <CheckboxBox checked={checked} locked={o.locked} />
                <Avatar id={o.id} size={22} />
                <View className="flex-1">
                  <Text className="text-sm text-text-heading">{o.label}</Text>
                  {o.hint ? (
                    <Text
                      numberOfLines={1}
                      className="text-xs text-text-subtle"
                    >
                      {o.hint}
                    </Text>
                  ) : null}
                </View>
                {o.locked ? (
                  <Text className="text-xs text-text-subtle">
                    {o.lockedLabel ?? 'You'}
                  </Text>
                ) : null}
              </Press>
            );
          })}
          {filtered.length === 0 ? (
            // Nothing typed yet → say how to find people; too short for the
            // people search (2+ characters) → keep typing; else a real "no match".
            <Text className="py-8 text-center text-sm text-text-main">
              {!query.trim()
                ? 'Type a name or email to find people.'
                : onQueryChange && query.trim().length < 2
                ? 'Keep typing — at least 2 characters.'
                : `No one matches “${query.trim()}”.`}
            </Text>
          ) : null}
        </ScrollView>
        <SheetFooter>
          <Button variant="primary" onPress={close}>
            {`Done${selected.length ? ` · ${selected.length}` : ''}`}
          </Button>
        </SheetFooter>
      </Sheet>
    </View>
  );
}

// "2/3" chip with a tree icon (direct children only); renders nothing for tasks
// without subtasks. `total` is always known (item.totalSubtasks, straight from
// the server); `done` only reflects children loaded so far — shows "–/3" rather
// than a possibly-wrong "0/3" until they're actually fetched (expand the row, or
// open the task).
export function SubtaskBadge({ item }: { item: WorkItem }) {
  const items = useAtomValue(itemsAtom);
  const { subtle } = useThemeColors();
  const { done, total, loaded } = subtaskProgress(items, item);
  if (total === 0) {
    return null;
  }
  return (
    <Tooltip
      label={
        loaded
          ? `${done} of ${total} subtasks done`
          : `${total} subtask${total === 1 ? '' : 's'}`
      }
    >
      <View className="flex-row items-center gap-1">
        <ListTree size={12} color={subtle} />
        <Text className="text-2xs text-text-subtle">
          {loaded ? `${done}/${total}` : total}
        </Text>
      </View>
    </Tooltip>
  );
}

// Avatar + name for a Property row's Creator/Owner value.
export function PersonRow({ id }: { id: string }) {
  const person = usePerson(id);
  return (
    <View className="flex-row items-center gap-2">
      <Avatar id={id} size={22} />
      <Text className="text-sm text-text-heading">{person?.name ?? '…'}</Text>
    </View>
  );
}

// One label/value row in a detail sheet's properties panel — ItemModal's Tag/
// Assignees/Creator/… rows, and RecurringTaskViewModal's Tag/Repeats rows.
export function Property({
  label,
  first = false,
  children,
}: {
  label: string;
  first?: boolean;
  children: ReactNode;
}) {
  return (
    <View
      className={`min-h-[40px] flex-row items-center gap-3 px-3 py-2 ${
        first ? '' : 'border-t border-border-main'
      }`}
    >
      <Text className="w-24 text-sm text-text-subtle">{label}</Text>
      <View className="flex-1 flex-row items-center">{children}</View>
    </View>
  );
}
