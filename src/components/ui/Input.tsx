import { useState, type ReactNode } from 'react';
import { Text, TextInput, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useThemeColors } from '../../hooks/useThemeColors';

type InputProps = React.ComponentProps<typeof TextInput> & {
  icon?: LucideIcon;
  // Rendered inside the field on the right (a clear button, a unit, a Kbd hint…).
  right?: ReactNode;
  invalid?: boolean;
  size?: 'sm' | 'md';
  // Multiline only: starting height in px (grows with content on web).
  minHeight?: number;
  // No box at all — for a field that sits inside its own container (search bars).
  bare?: boolean;
};

// Text field with a visible focus state (accent border + soft ring on web) and an
// optional leading icon. All app text inputs go through this.
export function Input({
    icon: Icon,
    right,
    invalid = false,
    size = 'md',
    multiline,
    onFocus,
    onBlur,
    style,
    minHeight = 84,
    bare = false,
  ...props
}: InputProps) {
  const c = useThemeColors();
  const [focused, setFocused] = useState(false);
  const border = invalid
    ? 'border-destructive'
    : focused
    ? 'border-accent'
    : 'border-border-main hover:border-border-strong';
  if (bare) {
    return (
      <View className="flex-1 flex-row items-center">
        <TextInput
          placeholderTextColor={c.subtle}
          style={[{ outlineStyle: 'none' } as object, style]}
          className="flex-1 py-1.5 text-base text-text-heading"
          {...props}
        />
        {right}
      </View>
    );
  }
  return (
    <View
      style={
        focused
          ? ({
              boxShadow: `0 0 0 3px ${
                invalid ? `${c.destructive}26` : `${c.accent}26`
              }`,
            } as object)
          : undefined
      }
      className={`flex-row rounded-lg border bg-bg-card ${border} ${
        multiline ? 'items-start' : 'items-center'
      } ${size === 'sm' ? 'min-h-[30px] px-2.5' : 'min-h-[36px] px-3'}`}
    >
      {Icon ? (
        <View className={multiline ? 'pt-2.5' : ''}>
          <Icon size={15} color={focused ? c.heading : c.subtle} />
        </View>
      ) : null}
      <TextInput
        placeholderTextColor={c.subtle}
        textAlignVertical={multiline ? 'top' : 'center'}
        multiline={multiline}
        onFocus={e => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={e => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          { outlineStyle: 'none' } as object,
          multiline ? { minHeight } : null,
          style,
        ]}
        className={`flex-1 text-text-heading ${
          size === 'sm' ? 'py-1 text-sm' : 'py-2 text-base'
        } ${Icon ? 'ml-2' : ''}`}
        {...props}
      />
      {right}
    </View>
  );
}

// Label + control + hint/error, stacked. Used by every form in the app.
export function Field({
  label,
  hint,
  error,
  required,
  right,
  children,
  className = 'mb-4',
}: {
  label: string;
  hint?: string | null;
  error?: string | null;
  required?: boolean;
  // Aligned with the label on the right — a counter, a "Clear" link…
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <View className={className}>
      <View className="mb-1.5 flex-row items-center justify-between gap-2">
        <Text className="text-xs font-medium text-text-heading">
          {label}
          {required ? <Text className="text-destructive"> *</Text> : null}
        </Text>
        {right}
      </View>
      {children}
      {error ? (
        <Text className="mt-1.5 text-xs text-destructive">{error}</Text>
      ) : hint ? (
        <Text className="mt-1.5 text-xs text-text-subtle">{hint}</Text>
      ) : null}
    </View>
  );
}
