import { useColorScheme } from 'react-native';

// For props that take a raw color instead of a className (e.g. ActivityIndicator's
// `color`). Keep in step with --accent in global.css.
export const useAccentColor = () =>
  useColorScheme() === 'dark' ? '#c084fc' : '#aa3bff';
