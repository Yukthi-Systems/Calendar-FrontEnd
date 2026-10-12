export interface DateFieldProps {
  // 'yyyy-MM-dd' for mode 'date', 'HH:mm' for mode 'time'. '' when empty.
  value: string;
  onChange: (value: string) => void;
  mode?: 'date' | 'time';
  invalid?: boolean;
  // Same format as `value`; web only (the native picker has no bounds yet).
  min?: string;
  max?: string;
  accessibilityLabel?: string;
}
