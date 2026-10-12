import { Text, View } from 'react-native';
import { Check, type LucideIcon } from 'lucide-react-native';
import { useThemeColors, useTone } from '../../hooks/useThemeColors';
import { Press } from './Press';

// Selectable pill (single- or multi-select option). With `color`, the selected
// state is tinted in that colour (status/priority/tag); without, it uses the accent.
export function Chip({
  label,
  color,
  active,
  onPress,
  role = 'radio',
  icon: Icon,
  dot = !!color,
}: {
  label: string;
  color?: string;
  active: boolean;
  onPress: () => void;
  role?: 'radio' | 'checkbox';
  icon?: LucideIcon;
  // A small colour dot before the label — on by default when `color` is set.
  dot?: boolean;
}) {
  const c = useThemeColors();
  const toneOf = useTone();
  const t = active ? toneOf(color ?? c.accent) : null;
  return (
    <Press
      accessibilityRole={role}
      accessibilityState={
        role === 'checkbox' ? { checked: active } : { selected: active }
      }
      onPress={onPress}
      style={t ? { backgroundColor: t.bg, borderColor: t.border } : undefined}
      className={`h-7 flex-row items-center gap-1.5 rounded-full border px-2.5 ${
        active ? '' : 'border-border-main bg-bg-card hover:border-border-strong hover:bg-hover'
      }`}
    >
      {role === 'checkbox' && active ? (
        <Check size={12} color={t?.fg ?? c.accent} strokeWidth={2.5} />
      ) : Icon ? (
        <Icon size={13} color={t?.fg ?? c.text} />
      ) : dot && color ? (
        <View style={{ backgroundColor: color }} className="h-2 w-2 rounded-full" />
      ) : null}
      <Text
        style={t ? { color: t.fg } : undefined}
        className={`text-xs font-medium ${active ? '' : 'text-text-heading'}`}
      >
        {label}
      </Text>
    </Press>
  );
}

// Read-only tinted label: status, priority, tag, free-form labels.
export function Badge({
  label,
  color,
  dot = false,
  size = 'md',
  capitalize = false,
}: {
  label: string;
  // No colour → neutral grey badge.
  color?: string;
  dot?: boolean;
  size?: 'sm' | 'md';
  capitalize?: boolean;
}) {
  const toneOf = useTone();
  const t = color ? toneOf(color) : null;
  return (
    <View
      style={t ? { backgroundColor: t.bg } : undefined}
      className={`flex-row items-center gap-1 self-start rounded-md ${
        size === 'sm' ? 'h-[18px] px-1.5' : 'h-5 px-2'
      } ${t ? '' : 'bg-muted'}`}
    >
      {dot && color ? (
        <View style={{ backgroundColor: color }} className="h-1.5 w-1.5 rounded-full" />
      ) : null}
      <Text
        numberOfLines={1}
        style={t ? { color: t.fg } : undefined}
        className={`${size === 'sm' ? 'text-2xs' : 'text-xs'} font-medium ${
          t ? '' : 'text-text-main'
        } ${capitalize ? 'capitalize' : ''}`}
      >
        {label}
      </Text>
    </View>
  );
}
