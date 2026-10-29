export interface DateFieldProps {
  // 'yyyy-MM-dd' for mode 'date', 'HH:mm' for mode 'time'. '' when empty.
  value: string;
  onChange: (value: string) => void;
  mode?: 'date' | 'time';
  invalid?: boolean;
  // Same format as `value`: in date mode, days outside are disabled; in time
  // mode, `min` ('HH:mm') hides slots earlier than it (the value itself still
  // shows even if now below `min` — see DateField.tsx's TimeField).
  min?: string;
  max?: string;
  // Show a clear (×) button when there's a value — for optional fields.
  clearable?: boolean;
  placeholder?: string;
  accessibilityLabel?: string;
}
