import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Platform, Text, View } from 'react-native';
import { Check, Lock } from 'lucide-react-native';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Press } from './Press';

const NATIVE_DRIVER = Platform.OS !== 'web';

// The box on its own (for custom rows). The check pops in with a small spring.
export function CheckboxBox({
  checked,
  locked = false,
  color,
}: {
  checked: boolean;
  locked?: boolean;
  color?: string;
}) {
  const c = useThemeColors();
  const scale = useRef(new Animated.Value(checked ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(scale, {
      toValue: checked ? 1 : 0,
      damping: 16,
      stiffness: 420,
      useNativeDriver: NATIVE_DRIVER,
    }).start();
  }, [checked, scale]);
  const fill = color ?? c.accent;
  return (
    <View
      style={checked ? { backgroundColor: fill, borderColor: fill } : undefined}
      className={`h-[18px] w-[18px] items-center justify-center rounded-[5px] border ${
        checked ? '' : 'border-border-strong bg-bg-card'
      }`}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {locked ? (
          <Lock size={10} color="#ffffff" strokeWidth={2.5} />
        ) : (
          <Check size={12} color="#ffffff" strokeWidth={3} />
        )}
      </Animated.View>
    </View>
  );
}

// Box + label, the whole row pressable.
export function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <Press
      feedback="none"
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      className={`flex-row items-start gap-2.5 py-1 ${disabled ? 'opacity-50' : ''}`}
    >
      <View className="pt-px">
        <CheckboxBox checked={checked} />
      </View>
      <View className="flex-1">
        {typeof label === 'string' ? (
          <Text className="text-sm text-text-heading">{label}</Text>
        ) : (
          label
        )}
        {description ? (
          <Text className="mt-0.5 text-xs text-text-main">{description}</Text>
        ) : null}
      </View>
    </Press>
  );
}

// On/off toggle with a sliding knob.
export function Switch({
  value,
  onChange,
  label,
  description,
  disabled = false,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  const c = useThemeColors();
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(anim, {
      toValue: value ? 1 : 0,
      damping: 22,
      stiffness: 380,
      useNativeDriver: false,
    }).start();
  }, [value, anim]);
  return (
    <Press
      feedback="none"
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      className={`flex-row items-center gap-3 py-1.5 ${disabled ? 'opacity-50' : ''}`}
    >
      <View className="flex-1">
        <Text className="text-sm text-text-heading">{label}</Text>
        {description ? (
          <Text className="mt-0.5 text-xs text-text-main">{description}</Text>
        ) : null}
      </View>
      <Animated.View
        style={{
          width: 32,
          height: 18,
          borderRadius: 9,
          padding: 2,
          backgroundColor: anim.interpolate({
            inputRange: [0, 1],
            outputRange: [c.borderStrong, c.accent],
          }),
        }}
      >
        <Animated.View
          style={{
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: '#ffffff',
            transform: [
              { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 14] }) },
            ],
          }}
        />
      </Animated.View>
    </Press>
  );
}
