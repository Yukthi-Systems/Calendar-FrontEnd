import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Platform, Text, View } from 'react-native';
import AlertTriangle from 'lucide-react-native/icons/triangle-alert';
import CircleAlert from 'lucide-react-native/icons/circle-alert';
import Info from 'lucide-react-native/icons/info';
import type { LucideIcon } from 'lucide-react-native';
import { useThemeColors } from '../../hooks/useThemeColors';

const NATIVE_DRIVER = Platform.OS !== 'web';

// Centred "nothing here" block: icon tile, title, one line of help, optional action.
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  const c = useThemeColors();
  return (
    <View
      className={`items-center justify-center px-6 ${
        compact ? 'py-8' : 'flex-1 py-16'
      }`}
    >
      <View className="mb-4 h-11 w-11 items-center justify-center rounded-xl border border-border-main bg-bg-card">
        <Icon size={20} color={c.text} strokeWidth={1.75} />
      </View>
      <Text className="text-center text-base font-semibold text-text-heading">
        {title}
      </Text>
      {description ? (
        <Text className="mt-1 max-w-[340px] text-center text-sm text-text-main">
          {description}
        </Text>
      ) : null}
      {action ? <View className="mt-5">{action}</View> : null}
    </View>
  );
}

// Shimmering placeholder block. Size/shape via className (h-4 w-32 rounded-md…).
export function Skeleton({
  className = 'h-4 w-full rounded-md',
}: {
  className?: string;
}) {
  const pulse = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: NATIVE_DRIVER,
        }),
        Animated.timing(pulse, {
          toValue: 0.55,
          duration: 700,
          useNativeDriver: NATIVE_DRIVER,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View style={{ opacity: pulse }}>
      <View className={`bg-muted ${className}`} />
    </Animated.View>
  );
}

const CALLOUT = {
  info: { icon: Info, box: 'border-info/25 bg-info/10', color: 'info' },
  warning: {
    icon: AlertTriangle,
    box: 'border-warning/30 bg-warning/10',
    color: 'warning',
  },
  error: {
    icon: CircleAlert,
    box: 'border-destructive/30 bg-destructive/10',
    color: 'destructive',
  },
} as const;

// Inline notice inside a form/sheet.
export function Callout({
  kind = 'info',
  title,
  children,
}: {
  kind?: keyof typeof CALLOUT;
  title?: string;
  children: ReactNode;
}) {
  const c = useThemeColors();
  const k = CALLOUT[kind];
  const Icon = k.icon;
  return (
    <View className={`flex-row gap-2.5 rounded-lg border px-3 py-2.5 ${k.box}`}>
      <View className="pt-px">
        <Icon size={15} color={c[k.color]} strokeWidth={2} />
      </View>
      <View className="flex-1 gap-0.5">
        {title ? (
          <Text className="text-sm font-medium text-text-heading">{title}</Text>
        ) : null}
        {typeof children === 'string' ? (
          <Text className="text-sm text-text-main">{children}</Text>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

// Keyboard shortcut hint — web/desktop only; renders nothing on native.
export function Kbd({ children }: { children: string }) {
  if (Platform.OS !== 'web') {
    return null;
  }
  return (
    <View className="h-[18px] min-w-[18px] items-center justify-center rounded border border-border-main bg-muted px-1">
      <Text className="text-2xs font-medium text-text-subtle">{children}</Text>
    </View>
  );
}
