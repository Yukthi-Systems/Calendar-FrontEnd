import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Check,
  ChevronDown,
  ListTree,
  Lock,
  Repeat,
  Search,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useAtomValue, useSetAtom } from 'jotai';
import { itemsAtom, selectedItemIdAtom } from '../../atoms/project';
import { PRIORITY_COLOR, statusInfo } from '../../data/constants';
import { useThemeColors } from '../../hooks/useThemeColors';
import { MEMBERS } from '../../data/mockData';
import { RECURRENCE_LABEL } from '../../data/recurrence';
import { subtaskProgress } from '../../data/tree';
import type { RecurrenceFreq, WorkItem } from '../../data/types';
import { Tooltip } from './Tooltip';

export const memberById = (id: string | null) =>
  MEMBERS.find(m => m.id === id) ?? null;

// A colour + initials circle, decoupled from the team-member lookup below —
// also used for the account profile avatar, which isn't one of MEMBERS.
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
        borderWidth: ring ? 2 : 0,
      }}
      className={`items-center justify-center ${ring ? 'border-bg-card' : ''}`}
    >
      <Text style={{ fontSize: size * 0.4 }} className="font-bold text-white">
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
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1.5,
          borderStyle: 'dashed',
        }}
        className="items-center justify-center border-border-main"
      />
    );
  }
  const shown = ids.slice(0, max);
  const rest = ids.length - shown.length;
  return (
    <View className="flex-row items-center">
      {shown.map((id, i) => (
        <View key={id} style={{ marginLeft: i === 0 ? 0 : -size * 0.3 }}>
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
              marginLeft: -size * 0.3,
            }}
            className="items-center justify-center bg-border-main"
          >
            <Text
              style={{ fontSize: size * 0.38 }}
              className="font-bold text-text-heading"
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
  freq: RecurrenceFreq;
  size?: number;
}) {
  const { text } = useThemeColors();
  return (
    <Tooltip label={`Repeats ${RECURRENCE_LABEL[freq].toLowerCase()}`}>
      <Repeat size={size} color={text} />
    </Tooltip>
  );
}

export function StatusDot({ status }: { status: WorkItem['status'] }) {
  return (
    <View
      style={{ backgroundColor: statusInfo(status).color }}
      className="h-2.5 w-2.5 rounded-full"
    />
  );
}

export function Pill({ text, color }: { text: string; color?: string }) {
  return (
    <View
      style={color ? { backgroundColor: `${color}22` } : undefined}
      className={`rounded-full px-2 py-0.5 ${color ? '' : 'bg-border-main'}`}
    >
      <Text
        style={color ? { color } : undefined}
        className="text-[11px] text-text-main"
      >
        {text}
      </Text>
    </View>
  );
}

// Compact row used by the team, calendar and kanban views.
export function ItemRow({
  item,
  showAssignee = true,
}: {
  item: WorkItem;
  showAssignee?: boolean;
}) {
  const select = useSetAtom(selectedItemIdAtom);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => select(item.id)}
      className="flex-row items-center gap-2 rounded-xl border border-border-main bg-bg-card px-3 py-2 active:opacity-70"
    >
      <StatusDot status={item.status} />
      <View className="flex-1">
        <View className="flex-row items-center gap-1">
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
        <View className="flex-row items-center gap-2">
          <Text className="text-[11px] text-text-main">{item.id}</Text>
          <SubtaskBadge id={item.id} />
        </View>
      </View>
      <View
        style={{ backgroundColor: PRIORITY_COLOR[item.priority] }}
        className="h-2 w-2 rounded-full"
      />
      {showAssignee ? (
        <AssigneeAvatars ids={item.assigneeIds} size={22} />
      ) : null}
    </Pressable>
  );
}

export function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <Text className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-text-main">
      {children}
    </Text>
  );
}

export function IconButton({
  icon: Icon,
  label,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
}) {
  const { heading } = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="h-9 w-9 items-center justify-center rounded-lg border border-border-main active:opacity-70"
    >
      <Icon size={18} color={heading} />
    </Pressable>
  );
}

// Content column for scrolling pages: the ScrollView spans the window (so its
// scrollbar sits at the edge) while the content stays centred and readable.
export const PAGE_STYLE = {
  width: '100%',
  maxWidth: 1120,
  alignSelf: 'center',
} as const;

// Labeled form field with an optional inline error — used by every text-input
// form in the app (item create/edit, profile edit).
export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-4">
      <Text className="mb-1 text-xs font-semibold uppercase text-text-main">
        {label}
      </Text>
      {children}
      {error ? (
        <Text className="mt-1 text-xs text-red-500">{error}</Text>
      ) : null}
    </View>
  );
}

export function FormInput(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      placeholderTextColor="#9ca3af"
      textAlignVertical={props.multiline ? 'top' : 'center'}
      {...props}
      className={`rounded-xl border border-border-main px-3 py-2.5 text-text-heading ${
        props.multiline ? 'min-h-[72px]' : ''
      }`}
    />
  );
}

// Multi-select dropdown: a trigger showing the current selection, and — while
// open — the option list inline underneath it (not an overlay/portal, so it
// works the same inside a ScrollView on every platform, with no z-index or
// clipping concerns). Used for the item form's Assignees field.
export function MultiSelectDropdown({
  label,
  options,
  selectedIds,
  onToggle,
  placeholder,
}: {
  // Sheet title, shown while the picker is open. Falls back to `placeholder`.
  label?: string;
  // `locked`: shown checked (if it is) but can't be toggled off — e.g. you
  // can never remove yourself as an assignee, only add yourself.
  options: { id: string; label: string; color?: string; locked?: boolean }[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { text, heading } = useThemeColors();
  const selected = options.filter(o => selectedIds.includes(o.id));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter(o => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        className="flex-row items-center justify-between rounded-xl border border-border-main px-3 py-2.5"
      >
        <Text
          numberOfLines={1}
          className={`flex-1 ${
            selected.length ? 'text-text-heading' : 'text-text-main'
          }`}
        >
          {selected.length
            ? selected.map(o => o.label).join(', ')
            : placeholder}
        </Text>
        <ChevronDown size={16} color={text} />
      </Pressable>

      {/* A real picker sheet, not an inline expansion — a list of 100+ options
          would otherwise push the rest of the form far down the screen. It
          floats over the form and scrolls on its own, with a search box so a
          long list is still fast to use. */}
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <Pressable
          accessibilityLabel="Close"
          onPress={close}
          className="flex-1 items-center justify-end bg-black/50 sm:justify-center"
        >
          <Pressable
            onPress={() => {}}
            className="max-h-[80%] w-full max-w-md rounded-t-3xl bg-bg-card p-4 sm:rounded-3xl"
          >
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-base font-bold text-text-heading">
                {label ?? placeholder}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={close}
                className="h-8 w-8 items-center justify-center rounded-lg active:opacity-70"
              >
                <X size={18} color={text} />
              </Pressable>
            </View>

            <View className="mb-3 flex-row items-center gap-2 rounded-xl border border-border-main px-3 py-2">
              <Search size={16} color={text} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search…"
                placeholderTextColor="#9ca3af"
                className="flex-1 text-text-heading"
              />
            </View>

            <ScrollView
              className="max-h-[360px]"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {filtered.map((o, i) => {
                const checked = selectedIds.includes(o.id);
                return (
                  <Pressable
                    key={o.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked, disabled: o.locked }}
                    disabled={o.locked}
                    onPress={() => onToggle(o.id)}
                    className={`flex-row items-center gap-2.5 rounded-lg px-2 py-2.5 active:opacity-70 ${
                      i > 0 ? 'border-t border-border-main' : ''
                    } ${checked ? 'bg-accent/10' : ''}`}
                  >
                    <View
                      style={{
                        borderColor: checked ? o.color ?? heading : undefined,
                        backgroundColor: checked
                          ? o.color ?? heading
                          : undefined,
                      }}
                      className="h-5 w-5 items-center justify-center rounded-md border border-border-main"
                    >
                      {o.locked ? (
                        <Lock size={10} color="#ffffff" />
                      ) : checked ? (
                        <Check size={13} color="#ffffff" />
                      ) : null}
                    </View>
                    <Text className="flex-1 text-text-heading">{o.label}</Text>
                    {o.locked ? (
                      <Text className="text-[11px] text-text-main">You</Text>
                    ) : null}
                  </Pressable>
                );
              })}
              {filtered.length === 0 ? (
                <Text className="py-6 text-center text-sm text-text-main">
                  No matches.
                </Text>
              ) : null}
            </ScrollView>

            <Pressable
              accessibilityRole="button"
              onPress={close}
              className="mt-3 items-center rounded-2xl bg-accent py-3 active:opacity-80"
            >
              <Text className="font-semibold text-white">
                Done{selected.length ? ` (${selected.length})` : ''}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// "2/5" chip with a tree icon; renders nothing for tasks without subtasks.
export function SubtaskBadge({ id }: { id: string }) {
  const items = useAtomValue(itemsAtom);
  const { text } = useThemeColors();
  const { done, total } = subtaskProgress(items, id);
  if (total === 0) {
    return null;
  }
  return (
    <View className="flex-row items-center gap-1">
      <ListTree size={12} color={text} />
      <Text className="text-[11px] text-text-main">
        {done}/{total}
      </Text>
    </View>
  );
}
