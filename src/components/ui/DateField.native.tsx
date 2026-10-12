import { CalendarDays, Clock } from 'lucide-react-native';
import { Input } from './Input';
import type { DateFieldProps } from './DateField.types';

// iOS/Android: a typed field with the expected format as its placeholder — there's
// no date-picker dependency in the native build yet. Web counterpart:
// DateField.web.tsx (the browser's own picker).
export function DateField({
  value,
  onChange,
  mode = 'date',
  invalid = false,
  accessibilityLabel,
}: DateFieldProps) {
  return (
    <Input
      icon={mode === 'date' ? CalendarDays : Clock}
      value={value}
      onChangeText={onChange}
      invalid={invalid}
      placeholder={mode === 'date' ? 'YYYY-MM-DD' : 'HH:mm'}
      accessibilityLabel={accessibilityLabel}
      autoCorrect={false}
      keyboardType="numbers-and-punctuation"
    />
  );
}
