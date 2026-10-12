import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import {
  ChevronDown,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CirclePause,
  CircleX,
  ListTree,
  Repeat,
  Search,
  SignalHigh,
  SignalLow,
  SignalMedium,
  type LucideIcon,
} from 'lucide-react-native';
import { useAtomValue, useSetAtom } from 'jotai';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { itemsAtom, selectedItemIdAtom } from '../../atoms/project';
import { PRIORITY_COLOR, statusInfo } from '../../data/constants';
import { useThemeColors } from '../../hooks/useThemeColors';
import { memberById } from '../../atoms/members';
import { describeRecurrence } from '../../data/rrule';
import { subtaskProgress } from '../../data/tree';
import { showsField } from '../../data/viewFields';
import type { Priority, Status, ViewField, WorkItem } from '../../data/types';
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
  // A card-colour border so stacked avatars (AssigneeAvatars) read as separate circles.
  ring?: boolean;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        borderWidth: ring ? 1.5 : 0,
      }}
      className={`items-center justify-center ${ring ? 'border-bg-card' : ''}`}
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
  ring?: boolean;
}) {
  const m = memberById(id);
  return (
    <Tooltip label={m?.name ?? 'Unassigned'}>
      <InitialsAvatar
        color={m?.color ?? '#9ca3af'}
        initials={m?.initials ?? '?'}
        size={size}
        ring={ring}
      />
    </Tooltip>
  );
}

// Overlapping avatars for an item's assignee list, capped at `max` with a
// "+N" tail. Renders a dashed "unassigned" placeholder when the list is empty.
export function AssigneeAvatars({
  ids,
  size = 22,
  max = 3,
}: {
  ids: string[];
  size?: number;
  max?: number;
}) {
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
          <Avatar id={id} size={size} ring />
        </View>
      ))}
      {rest > 0 ? (
        <Tooltip
          label={ids
            .slice(max)
            .map(id => memberById(id)?.name ?? '?')
            .join(', ')}
        >
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

// Comma-separated names for an assignee list, e.g. for table cells.
export const assigneeNames = (ids: string[]) =>
  ids.length === 0
    ? 'Unassigned'
    : ids.map(id => memberById(id)?.name ?? '?').join(', ');

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

const PRIORITY_ICON: Record<Priority, LucideIcon> = {
  low: SignalLow,
  medium: SignalMedium,
  high: SignalHigh,
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export function PriorityIcon({
  priority,
  size = 15,
}: {
  priority: Priority;
  size?: number;
}) {
  const Icon = PRIORITY_ICON[priority] ?? SignalMedium;
  return (
    <Tooltip label={`${PRIORITY_LABEL[priority]} priority`}>
      <Icon size={size} color={PRIORITY_COLOR[priority]} strokeWidth={2.5} />
    </Tooltip>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <PriorityIcon priority={priority} size={14} />
      <Text className="text-sm text-text-main">
        {PRIORITY_LABEL[priority]}
      </Text>
    </View>
  );
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
  const days = differenceInCalendarDays(parseISO(item.end), new Date());
  const tint = done
    ? 'text-text-main'
    : days < 0
    ? 'text-destructive'
    : days <= 1
    ? 'text-warning'
    : 'text-text-main';
  return (
    <Tooltip
      label={
        done
          ? `Due ${format(parseISO(item.end), 'PP')}`
          : days < 0
          ? `Overdue by ${-days} day${days === -1 ? '' : 's'}`
          : days === 0
          ? 'Due today'
          : `Due in ${days} day${days === 1 ? '' : 's'}`
      }
    >
      <Text numberOfLines={1} className={`${className} ${tint}`}>
        {format(parseISO(item.end), 'MMM d')}
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
  return (
    <Press
      feedback="subtle"
      accessibilityRole="button"
      onPress={onPress ?? (() => select(item.id))}
      className="flex-row items-center gap-2.5 rounded-lg border border-border-main bg-bg-card px-3 py-2 hover:border-border-strong hover:bg-hover"
    >
      {showsField(fields, 'status') ? <StatusIcon status={item.status} /> : null}
      <View className="flex-1">
        <View className="flex-row items-center gap-1.5">
          <Text
            numberOfLines={1}
            className="shrink text-sm font-medium text-text-heading"
          >
            {item.title}
          </Text>
          {item.recurrence ? (
            <RecurrenceIcon freq={item.recurrence} size={11} />
          ) : null}
        </View>
        <View className="mt-0.5 flex-row items-center gap-2">
          {showsField(fields, 'id') ? (
            <Text className="text-2xs text-text-subtle">{item.id}</Text>
          ) : null}
          <DueDate item={item} className="text-2xs" />
          <SubtaskBadge id={item.id} />
        </View>
      </View>
      {showsField(fields, 'priority') ? (
        <PriorityIcon priority={item.priority} size={14} />
      ) : null}
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
}: {
  // Called as the search box changes, for pickers that also search remotely.
  onQueryChange?: (query: string) => void;
  // Sheet title, shown while the picker is open. Falls back to `placeholder`.
  label?: string;
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
            o.label.toLowerCase().includes(q) || o.id.toLowerCase().includes(q),
        )
      : options;
  }, [options, query]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <View>
      <Press
        feedback="none"
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        className="min-h-[36px] flex-row items-center gap-2 rounded-lg border border-border-main bg-bg-card px-3 py-1.5 hover:border-border-strong"
      >
        {selected.length > 0 ? (
          <View className="flex-1 flex-row items-center gap-2">
            <AssigneeAvatars ids={selected.map(o => o.id)} size={20} max={4} />
            <Text numberOfLines={1} className="flex-1 text-base text-text-heading">
              {selected.map(o => o.label).join(', ')}
            </Text>
          </View>
        ) : (
          <Text className="flex-1 text-base text-text-subtle">{placeholder}</Text>
        )}
        <ChevronDown size={15} color={c.subtle} />
      </Press>

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
            placeholder="Search people…"
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
                <Text className="flex-1 text-sm text-text-heading">{o.label}</Text>
                {o.locked ? (
                  <Text className="text-xs text-text-subtle">
                    {o.lockedLabel ?? 'You'}
                  </Text>
                ) : null}
              </Press>
            );
          })}
          {filtered.length === 0 ? (
            <Text className="py-8 text-center text-sm text-text-main">
              No one matches “{query}”.
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

// "2/5" chip with a tree icon; renders nothing for tasks without subtasks.
export function SubtaskBadge({ id }: { id: string }) {
  const items = useAtomValue(itemsAtom);
  const { subtle } = useThemeColors();
  const { done, total } = subtaskProgress(items, id);
  if (total === 0) {
    return null;
  }
  return (
    <Tooltip label={`${done} of ${total} subtasks done`}>
      <View className="flex-row items-center gap-1">
        <ListTree size={12} color={subtle} />
        <Text className="text-2xs text-text-subtle">
          {done}/{total}
        </Text>
      </View>
    </Tooltip>
  );
}
