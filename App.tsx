/**
 * YTC — one App.tsx, three targets (iOS/Android via Metro, Web via webpack +
 * react-native-web). Platform differences belong in .native.tsx/.web.tsx file pairs
 * (see src/config/env.* for the pattern), not in branches inside shared components.
 * Styling is Tailwind via NativeWind (`className`, theme in tailwind.config.js +
 * global.css); app state is jotai atoms (src/atoms).
 *
 * @format
 */

import './global.css';
import { useEffect } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StatusBar,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { bootAuth } from './src/services/authStore';
import { useAuth } from './src/hooks/useAuth';
import { useSsoAutoLogin } from './src/hooks/useSsoAutoLogin';
import { useAccentColor } from './src/hooks/useAccentColor';
import { LoginScreen } from './src/components/LoginScreen';
import { SsoLoginModal } from './src/components/SsoLoginModal';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  useEffect(() => {
    const signal = { cancelled: false };
    bootAuth(signal);
    return () => {
      signal.cancelled = true;
    };
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppContent />
      <SsoLoginModal />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const {
    user,
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

  // While a sign-in window is open, keep the login screen (and its status) up.
  if (authLoading && !sso.ssoPending) {
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

  if (!isAuthenticated) {
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

  return (
    <SafeAreaView className="flex-1 bg-bg-main">
      <View className="flex-1 items-center justify-center gap-2 px-6">
        <Text className="text-3xl font-bold text-text-heading">YTC</Text>
        <Text className="text-sm text-text-main">
          Signed in as {user?.username} ({user?.email})
        </Text>
        {user?.organization_name ? (
          <Text className="text-sm text-text-main">
            {user.organization_name}
          </Text>
        ) : null}
        <Text className="mt-4 text-xs text-text-main">
          Running on {Platform.OS}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={logout}
          className="mt-6 rounded-xl border border-border-main px-5 py-2.5 active:opacity-80"
        >
          <Text className="text-text-heading">Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export default App;
