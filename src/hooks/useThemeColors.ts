import { useColorScheme } from 'react-native';

// Raw colors for props that can't take a className (svg icons, placeholders,
// third-party components that take a theme object). Keep in step with global.css.
export const useThemeColors = () => {
  const dark = useColorScheme() === 'dark';
  return {
    heading: dark ? '#f3f4f6' : '#08060d',
    text: dark ? '#9ca3af' : '#6b6375',
    accent: dark ? '#c084fc' : '#aa3bff',
    border: dark ? '#2e303a' : '#e5e4e7',
    card: dark ? '#1f2028' : '#ffffff',
    bg: dark ? '#16171d' : '#ffffff',
  };
};
