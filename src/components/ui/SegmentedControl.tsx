import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Press } from './Press';

// Pill toggle between a few options, with an indicator that slides to the selected
// segment. Replaces the per-view mode/zoom switches.
export function SegmentedControl<K extends string>({
  options,
  value,
  onChange,
  size = 'md',
}: {
  options: { key: K; label: string; icon?: LucideIcon }[];
  value: K;
  onChange: (key: K) => void;
  size?: 'sm' | 'md';
}) {
  const c = useThemeColors();
  const [layouts, setLayouts] = useState<Record<string, { x: number; width: number }>>({});
  const x = useRef(new Animated.Value(0)).current;
  const w = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);

  useEffect(() => {
    const l = layouts[value];
    if (!l) {
      return;
    }
    if (!placed.current) {
      // First measurement: jump there, don't slide in from the left edge.
      x.setValue(l.x);
      w.setValue(l.width);
      placed.current = true;
      return;
    }
    const spring = { damping: 30, stiffness: 420, mass: 0.8, useNativeDriver: false };
    Animated.parallel([
      Animated.spring(x, { toValue: l.x, ...spring }),
      Animated.spring(w, { toValue: l.width, ...spring }),
    ]).start();
  }, [value, layouts, x, w]);

  const h = size === 'sm' ? 'h-6' : 'h-7';
  return (
    <View
      accessibilityRole="radiogroup"
      className="flex-row rounded-lg bg-muted p-0.5"
    >
      {layouts[value] ? (
        <Animated.View
          pointerEvents="none"
          style={[
            { position: 'absolute', top: 2, bottom: 2, left: x, width: w, borderRadius: 6 },
            { backgroundColor: c.card },
            Platform.OS === 'web'
              ? ({
                  boxShadow: c.dark
                    ? '0 0 0 1px rgba(255,255,255,0.06), 0 1px 2px rgba(0,0,0,0.4)'
                    : '0 0 0 1px rgba(20,20,40,0.06), 0 1px 2px rgba(20,20,40,0.1)',
                } as object)
              : { elevation: 1 },
          ]}
        />
      ) : null}
      {options.map(o => {
        const active = o.key === value;
        const Icon = o.icon;
        return (
          <Press
            key={o.key}
            feedback="none"
            accessibilityRole="radio"
            accessibilityState={{ selected: active, checked: active }}
            onPress={() => onChange(o.key)}
            onLayout={e => {
              const { x: lx, width } = e.nativeEvent.layout;
              setLayouts(prev => ({ ...prev, [o.key]: { x: lx, width } }));
            }}
            className={`${h} flex-row items-center justify-center gap-1.5 rounded-md px-2.5`}
          >
            {Icon ? (
              <Icon size={14} color={active ? c.heading : c.text} strokeWidth={2} />
            ) : null}
            <Text
              className={`text-xs font-medium ${
                active ? 'text-text-heading' : 'text-text-main hover:text-text-heading'
              }`}
            >
              {o.label}
            </Text>
          </Press>
        );
      })}
    </View>
  );
}
