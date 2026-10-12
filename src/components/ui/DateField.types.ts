export interface DateFieldProps {
  // 'yyyy-MM-dd' for mode 'date', 'HH:mm' for mode 'time'. '' when empty.
  value: string;
  onChange: (value: string) => void;
  mode?: 'date' | 'time';
  invalid?: boolean;
  // Same format as `value` (date mode only): days outside are disabled.
  min?: string;
  max?: string;
  // Show a clear (×) button when there's a value — for optional fields.
  clearable?: boolean;
  placeholder?: string;
  accessibilityLabel?: string;
}
