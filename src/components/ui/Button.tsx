import type { ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Tooltip } from '../project/Tooltip';
import { Press } from './Press';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'destructive'
  | 'destructive-ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

const BOX: Record<ButtonVariant, string> = {
  primary: 'bg-accent hover:bg-accent/90 shadow-sm',
  secondary:
    'bg-bg-card border border-border-main hover:bg-hover hover:border-border-strong',
  ghost: 'hover:bg-hover',
  destructive: 'bg-destructive hover:bg-destructive/90 shadow-sm',
  'destructive-ghost': 'hover:bg-destructive/10',
};

const LABEL: Record<ButtonVariant, string> = {
  primary: 'text-accent-foreground',
  secondary: 'text-text-heading',
  ghost: 'text-text-heading',
  destructive: 'text-destructive-foreground',
  'destructive-ghost': 'text-destructive',
};

const SIZE: Record<ButtonSize, { box: string; text: string; icon: number }> = {
  sm: { box: 'h-7 px-2.5 gap-1.5 rounded-md', text: 'text-xs', icon: 14 },
  md: { box: 'h-[34px] px-3 gap-1.5 rounded-lg', text: 'text-sm', icon: 16 },
  lg: { box: 'h-10 px-4 gap-2 rounded-lg', text: 'text-base', icon: 18 },
};

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  disabled = false,
  onPress,
  className = '',
  accessibilityLabel,
}: {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  // Layout only (flex-1, w-full, self-start…) — the look comes from variant/size.
  className?: string;
  accessibilityLabel?: string;
}) {
  const c = useThemeColors();
  const iconColor = {
    primary: c.accentForeground,
    secondary: c.heading,
    ghost: c.text,
    destructive: c.destructiveForeground,
    'destructive-ghost': c.destructive,
  }[variant];
  const s = SIZE[size];
  const inactive = disabled || loading;
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      className={`flex-row items-center justify-center ${s.box} ${BOX[variant]} ${
        disabled ? 'opacity-50' : ''
      } ${className}`}
    >
      {loading ? (
        <ActivityIndicator size="small" color={iconColor} />
      ) : Icon ? (
        <Icon size={s.icon} color={iconColor} strokeWidth={2} />
      ) : null}
      {children != null ? (
        <Text
          numberOfLines={1}
          className={`font-medium ${s.text} ${LABEL[variant]}`}
        >
          {children}
        </Text>
      ) : null}
      {IconRight && !loading ? (
        <IconRight size={s.icon} color={iconColor} strokeWidth={2} />
      ) : null}
    </Press>
  );
}

const ICON_SIZE = {
  sm: { box: 'h-7 w-7 rounded-md', icon: 15 },
  md: { box: 'h-8 w-8 rounded-lg', icon: 17 },
  lg: { box: 'h-9 w-9 rounded-lg', icon: 18 },
};

// Square icon-only button. `label` is required: it's the accessible name and the
// hover tooltip on web.
export function IconButton({
  icon: Icon,
  label,
  onPress,
  size = 'md',
  variant = 'ghost',
  color,
  disabled = false,
  active = false,
}: {
  icon: LucideIcon;
  label: string;
  onPress?: () => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'ghost' | 'outline' | 'primary';
  color?: string;
  disabled?: boolean;
  active?: boolean;
}) {
  const c = useThemeColors();
  const s = ICON_SIZE[size];
  const box =
    variant === 'primary'
      ? 'bg-accent hover:bg-accent/90 shadow-sm'
      : variant === 'outline'
      ? 'border border-border-main bg-bg-card hover:bg-hover hover:border-border-strong'
      : active
      ? 'bg-hover'
      : 'hover:bg-hover';
  const iconColor =
    color ??
    (variant === 'primary' ? c.accentForeground : active ? c.heading : c.text);
  return (
    <Tooltip label={label}>
      <Press
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        hitSlop={6}
        className={`items-center justify-center ${s.box} ${box} ${
          disabled ? 'opacity-40' : ''
        }`}
      >
        <View pointerEvents="none">
          <Icon size={s.icon} color={iconColor} strokeWidth={2} />
        </View>
      </Press>
    </Tooltip>
  );
}
