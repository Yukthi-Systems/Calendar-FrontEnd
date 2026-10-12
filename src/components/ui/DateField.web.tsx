import { useState } from 'react';
import { View } from 'react-native';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { DateFieldProps } from './DateField.types';

// Web: the browser's own date/time picker (<input type="date|time">), styled to
// match ui/Input. Values stay 'yyyy-MM-dd' / 'HH:mm' strings — exactly what the
// input element itself produces — so callers don't care which platform they're on.
// Native counterpart: DateField.native.tsx.
export function DateField({
  value,
  onChange,
  mode = 'date',
  invalid = false,
  min,
  max,
  accessibilityLabel,
}: DateFieldProps) {
  const c = useThemeColors();
  const [focused, setFocused] = useState(false);
  const border = invalid
    ? 'border-destructive'
    : focused
    ? 'border-accent'
    : 'border-border-main hover:border-border-strong';
  return (
    <View
      style={
        focused
          ? ({ boxShadow: `0 0 0 3px ${c.accent}26` } as object)
          : undefined
      }
      className={`min-h-[36px] flex-row items-center rounded-lg border bg-bg-card px-3 ${border}`}
    >
      <input
        type={mode}
        value={value}
        min={min}
        max={max}
        aria-label={accessibilityLabel}
        aria-invalid={invalid || undefined}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          color: value ? c.heading : c.subtle,
          fontSize: 14,
          lineHeight: '20px',
          padding: '7px 0',
        }}
      />
    </View>
  );
}
