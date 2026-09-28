import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useAccentColor } from '../hooks/useAccentColor';

// Same card and states as YFS-FrontEnd's components/auth/LoginScreen.tsx.
export function LoginScreen({
  errorMsg,
  ssoPending,
  isLogoutParam,
  onLogin,
}: {
  errorMsg: string | null;
  ssoPending: boolean;
  isLogoutParam: boolean;
  onLogin: () => void;
}) {
  const accent = useAccentColor();

  return (
    <View className="flex-1 items-center justify-center bg-bg-main p-6">
      <View className="w-full max-w-md items-center rounded-3xl border border-border-main bg-bg-card p-10 shadow-lg">
        <View className="mb-6 h-[60px] w-[60px] items-center justify-center rounded-2xl border border-accent/50 bg-accent/10">
          <Text className="text-3xl">🛡️</Text>
        </View>
        <Text className="mb-2 text-3xl font-bold tracking-tight text-text-heading">
          YTC
        </Text>
        <Text className="mb-8 text-center text-sm leading-relaxed text-text-main">
          Access your secure organization workspace and tools using Single
          Sign-On (SSO).
        </Text>

        {errorMsg ? (
          <View className="mb-6 self-stretch rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
            <Text className="mb-0.5 text-xs font-semibold text-red-600">
              Authentication Notice
            </Text>
            <Text className="text-xs text-red-500">{errorMsg}</Text>
          </View>
        ) : ssoPending ? (
          <View className="mb-6 self-stretch rounded-2xl border border-accent/50 bg-accent/10 p-4">
            <Text className="mb-0.5 text-xs font-semibold text-accent">
              SSO Authentication Active
            </Text>
            <Text className="text-xs text-text-heading">
              Please complete the login verification in the SSO window.
            </Text>
          </View>
        ) : null}

        {ssoPending && (
          <ActivityIndicator color={accent} size="large" className="mb-6" />
        )}

        <Pressable
          accessibilityRole="button"
          onPress={onLogin}
          disabled={ssoPending}
          className={`w-full items-center rounded-2xl px-6 py-3.5 active:opacity-80 ${
            ssoPending ? 'bg-border-main' : 'bg-accent shadow-md'
          }`}
        >
          <Text
            className={`font-semibold ${
              ssoPending ? 'text-text-main' : 'text-white'
            }`}
          >
            {ssoPending
              ? 'Awaiting SSO Verification...'
              : 'Continue with Yukthi SSO'}
          </Text>
        </Pressable>

        {isLogoutParam && (
          <Text className="mt-6 text-xs text-text-main">
            You have been logged out successfully.
          </Text>
        )}
      </View>
    </View>
  );
}
