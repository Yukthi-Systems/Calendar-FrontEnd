import type { PressableProps } from 'react-native';

export interface PressProps extends PressableProps {
  className?: string;
  // 'scale': buttons, chips, icons. 'subtle': large rows/cards (a full scale
  // would look like the whole list jumps). 'none': handle it yourself.
  feedback?: 'scale' | 'subtle' | 'none';
}
