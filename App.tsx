/**
 * YTC — one App.tsx, three targets (iOS/Android via Metro, Web via webpack +
 * react-native-web). Platform differences belong in .native.tsx/.web.tsx file pairs
 * (see src/config/env.* for the pattern), not in branches inside shared components.
 *
 * @format
 */

import { Platform, StatusBar, StyleSheet, Text, useColorScheme, View } from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';
import { getEnv } from './src/config/env';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppContent isDarkMode={isDarkMode} />
    </SafeAreaProvider>
  );
}

function AppContent({ isDarkMode }: { isDarkMode: boolean }) {
  const apiUrl = getEnv('API_URL');

  return (
    <SafeAreaView style={[styles.container, isDarkMode && styles.containerDark]}>
      <View style={styles.content}>
        <Text style={[styles.title, isDarkMode && styles.textDark]}>YTC</Text>
        <Text style={[styles.subtitle, isDarkMode && styles.textDark]}>
          Running on {Platform.OS}
        </Text>
        <Text style={[styles.configLine, isDarkMode && styles.textDark]}>
          API_URL: {apiUrl || '(not set — copy .env.example to .env)'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  containerDark: {
    backgroundColor: '#0b0b0f',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111111',
  },
  subtitle: {
    fontSize: 14,
    color: '#555555',
  },
  configLine: {
    marginTop: 16,
    fontSize: 12,
    color: '#888888',
    textAlign: 'center',
  },
  textDark: {
    color: '#f2f2f2',
  },
});

export default App;
