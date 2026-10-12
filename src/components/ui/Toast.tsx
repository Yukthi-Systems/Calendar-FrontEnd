import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAtomValue } from 'jotai';
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react-native';
import {
  openSheetsAtom,
  toast,
  toastsAtom,
  type ToastData,
} from '../../atoms/feedback';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Press } from './Press';
import { DOCK_BREAKPOINT } from './layout';

const NATIVE_DRIVER = Platform.OS !== 'web';

// Renders the toast stack — bottom-centre on phones, bottom-right on desktop.
// Mounted once in App.tsx (`inSheet` false), and by whichever Sheet is on top
// (`inSheet` true): only one of them draws at a time, so toasts always sit above
// any open dialog.
export function ToastHost({ inSheet = false }: { inSheet?: boolean }) {
  const toasts = useAtomValue(toastsAtom);
  const sheets = useAtomValue(openSheetsAtom);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const docked = width < DOCK_BREAKPOINT;
  if (toasts.length === 0 || (!inSheet && sheets.length > 0)) {
    return null;
  }
  return (
    <View
      pointerEvents="box-none"
      style={{ bottom: insets.bottom + 20 }}
      className={`absolute gap-2 ${
        docked ? 'inset-x-0 items-center px-4' : 'right-5 items-end'
      }`}
    >
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </View>
  );
}

function ToastItem({ toast: t }: { toast: ToastData }) {
  const c = useThemeColors();
  const anim = useRef(new Animated.Value(0)).current;
  const closing = useRef(false);

  const dismiss = () => {
    if (closing.current) {
      return;
    }
    closing.current = true;
    Animated.timing(anim, {
      toValue: 0,
      duration: 140,
      easing: Easing.in(Easing.quad),
      useNativeDriver: NATIVE_DRIVER,
    }).start(() => toast.dismiss(t.id));
  };

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      damping: 24,
      stiffness: 340,
      useNativeDriver: NATIVE_DRIVER,
    }).start();
    const timer = setTimeout(dismiss, t.duration);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per toast
  }, []);

  const Icon = t.kind === 'success' ? CircleCheck : t.kind === 'error' ? CircleAlert : Info;
  const iconColor =
    t.kind === 'success' ? c.success : t.kind === 'error' ? c.destructive : c.info;

  return (
    <Animated.View
      accessibilityLiveRegion={t.kind === 'error' ? 'assertive' : 'polite'}
      style={{
        opacity: anim,
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
          { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
        ],
      }}
    >
      <View
        style={
          Platform.OS === 'web'
            ? ({
                boxShadow: c.dark
                  ? '0 12px 32px -8px rgba(0,0,0,0.7)'
                  : '0 12px 32px -10px rgba(20,20,40,0.3), 0 1px 3px rgba(20,20,40,0.08)',
              } as object)
            : { elevation: 8 }
        }
        className="w-[360px] max-w-full flex-row items-start gap-2.5 rounded-xl border border-border-main bg-bg-card py-2.5 pl-3 pr-2"
      >
        <View className="pt-0.5">
          <Icon size={16} color={iconColor} strokeWidth={2} />
        </View>
        <View className="flex-1 py-px">
          <Text className="text-sm font-medium text-text-heading">{t.message}</Text>
          {t.description ? (
            <Text className="mt-0.5 text-xs text-text-main">{t.description}</Text>
          ) : null}
        </View>
        {t.action ? (
          <Press
            accessibilityRole="button"
            onPress={() => {
              t.action?.onPress();
              dismiss();
            }}
            className="h-6 justify-center rounded-md px-2 hover:bg-hover"
          >
            <Text className="text-xs font-semibold text-accent">{t.action.label}</Text>
          </Press>
        ) : null}
        <Press
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          onPress={dismiss}
          className="h-6 w-6 items-center justify-center rounded-md hover:bg-hover"
        >
          <X size={14} color={c.subtle} />
        </Press>
      </View>
    </Animated.View>
  );
}
