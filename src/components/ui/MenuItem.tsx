import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Press } from './Press';

// One row in an action sheet / menu.
export function MenuItem({
  icon: Icon,
  label,
  description,
  onPress,
  destructive = false,
  chevron = false,
  right,
  disabled = false,
}: {
  icon?: LucideIcon;
  label: string;
  description?: string;
  onPress: () => void;
  destructive?: boolean;
  chevron?: boolean;
  right?: ReactNode;
  disabled?: boolean;
}) {
  const c = useThemeColors();
  return (
    <Press
      feedback="subtle"
      accessibilityRole="menuitem"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-[38px] flex-row items-center gap-3 rounded-lg px-2.5 py-2 ${
        destructive ? 'hover:bg-destructive/10' : 'hover:bg-hover'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      {Icon ? (
        <Icon size={16} color={destructive ? c.destructive : c.text} strokeWidth={2} />
      ) : null}
      <View className="flex-1">
        <Text
          className={`text-sm font-medium ${
            destructive ? 'text-destructive' : 'text-text-heading'
          }`}
        >
          {label}
        </Text>
        {description ? (
          <Text className="text-xs text-text-main">{description}</Text>
        ) : null}
      </View>
      {right}
      {chevron ? <ChevronRight size={15} color={c.subtle} /> : null}
    </Press>
  );
}

export function MenuSeparator() {
  return <View className="mx-2.5 my-1 h-px bg-border-main" />;
}

export function MenuLabel({ children }: { children: string }) {
  return (
    <Text className="px-2.5 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wider text-text-subtle">
      {children}
    </Text>
  );
}
