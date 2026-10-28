import { CalendarCheck2, ShieldCheck } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { useThemeColors } from '../hooks/useThemeColors';
import { Button, Callout } from './ui';

// Same states as YFS-FrontEnd's components/auth/LoginScreen.tsx: error, SSO window
// pending, just-logged-out.
export function LoginScreen({
  errorMsg,
  ssoPending,
  isLogoutParam,
  sessionEnded = false,
  onLogin,
}: {
  errorMsg: string | null;
  ssoPending: boolean;
  isLogoutParam: boolean;
  // Signed out by the hourly SSO check, not by the user.
  sessionEnded?: boolean;
  onLogin: () => void;
}) {
  const c = useThemeColors();

  return (
    <View className="flex-1 items-center justify-center bg-bg-main p-6">
      <View className="w-full max-w-[380px]">
        <View className="mb-8 items-center">
          <View className="mb-5 h-12 w-12 items-center justify-center rounded-xl bg-accent">
            <CalendarCheck2 size={24} color={c.accentForeground} strokeWidth={2.25} />
          </View>
          <Text className="text-2xl font-semibold text-text-heading">Sign in to YTC</Text>
          <Text className="mt-2 text-center text-base text-text-main">
            Plan, schedule and track your team’s work in one place.
          </Text>
        </View>

        <View className="gap-4 rounded-2xl border border-border-main bg-bg-card p-6">
          {errorMsg ? (
            <Callout kind="error" title="Couldn’t sign you in">
              {errorMsg}
            </Callout>
          ) : ssoPending ? (
            <Callout kind="info" title="Waiting for SSO">
              Finish signing in in the window that just opened.
            </Callout>
          ) : sessionEnded ? (
            <Callout kind="warning" title="Your session has ended">
              You were signed out of Yukthi SSO, or your session expired. Sign in again to
              continue.
            </Callout>
          ) : isLogoutParam ? (
            <Callout kind="info">You’ve been signed out.</Callout>
          ) : null}

          <Button
            variant="primary"
            size="lg"
            onPress={onLogin}
            loading={ssoPending}
            className="w-full"
          >
            {ssoPending ? 'Waiting for verification…' : 'Continue with Yukthi SSO'}
          </Button>

          <View className="flex-row items-center justify-center gap-1.5">
            <ShieldCheck size={13} color={c.subtle} />
            <Text className="text-xs text-text-subtle">
              Secured with your organization’s single sign-on
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
