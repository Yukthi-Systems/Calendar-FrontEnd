/**
 * YTC — one App.tsx, three targets (iOS/Android via Metro, Web via webpack +
 * react-native-web). Platform differences belong in .native.tsx/.web.tsx file pairs
 * (see src/config/env.* for the pattern), not in branches inside shared components.
 * Styling is Tailwind via NativeWind (`className`, theme in tailwind.config.js +
 * global.css); app state is jotai atoms (src/atoms). Server calls go through
 * TanStack Query (src/services/queryClient.ts); the hooks under src/hooks that
 * fetch or mutate bridge their query/mutation results onto the relevant atom, so
 * existing atom-reading code doesn't need to know a query cache is involved.
 *
 * @format
 */

import './global.css';
import { useEffect } from 'react';
import { ActivityIndicator, StatusBar, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './src/services/queryClient';
import { bootAuth } from './src/services/authStore';
import { bootProject } from './src/services/projectStore';
import { bootNotifications } from './src/services/notificationStore';
import { bootWidgetSync } from './src/services/widgetSync';
import { useAuth } from './src/hooks/useAuth';
import { useSsoAutoLogin } from './src/hooks/useSsoAutoLogin';
import { useUserInfo } from './src/hooks/useUserInfo';
import { useSettingsSync } from './src/hooks/useSettingsSync';
import { useAccentColor } from './src/hooks/useAccentColor';
import { useResolvedTheme } from './src/hooks/useResolvedTheme';
import { LoginScreen } from './src/components/LoginScreen';
import { SsoLoginModal } from './src/components/SsoLoginModal';
import { ThemeRoot } from './src/components/ThemeRoot';
import { ProjectScreen } from './src/components/project/ProjectScreen';
import { SSO_ENABLED } from './src/config/features';

function App() {
  useEffect(() => {
    const signal = { cancelled: false };
    bootAuth(signal);
    bootProject();
    bootNotifications();
    bootWidgetSync();
    return () => {
      signal.cancelled = true;
    };
  }, []);

  return (
    // Required by react-native-gesture-handler (used for the Kanban board's
    // drag-and-drop) — must wrap the whole app, on every platform.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <ThemeRoot>
            <StatusBarForTheme />
            <AppContent />
            {SSO_ENABLED ? <SsoLoginModal /> : null}
          </ThemeRoot>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

// Follows the resolved theme (the user's light/dark/system choice), not the
// raw OS scheme directly — those only differ when the user overrides it.
function StatusBarForTheme() {
  const { dark } = useResolvedTheme();
  return <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />;
}

function AppContent() {
  const {
    isAuthenticated,
    isLoading: authLoading,
    errorMsg,
    loginWithSso,
    logout,
    clearError,
  } = useAuth();
  const sso = useSsoAutoLogin({
    isAuthenticated,
    authLoading,
    loginWithSso,
    clearError,
  });
  const accent = useAccentColor();
  useUserInfo();
  useSettingsSync();

  // While a sign-in window is open, keep the login screen (and its status) up.
  if (SSO_ENABLED && authLoading && !sso.ssoPending) {
    return (
      <SafeAreaView className="flex-1 bg-bg-main">
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <ActivityIndicator color={accent} size="large" />
          <Text className="font-medium text-text-main">
            Restoring secure session...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (SSO_ENABLED && !isAuthenticated) {
    return (
      <SafeAreaView className="flex-1 bg-bg-main">
        <LoginScreen
          errorMsg={errorMsg}
          ssoPending={sso.ssoPending}
          isLogoutParam={sso.isLogoutParam}
          onLogin={sso.handleManualLogin}
        />
      </SafeAreaView>
    );
  }

  return <ProjectScreen onSignOut={SSO_ENABLED ? logout : undefined} />;
}

export default App;
