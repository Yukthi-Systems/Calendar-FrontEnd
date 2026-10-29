import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
  type ViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import X from 'lucide-react-native/icons/x';
import { useAtomValue, useSetAtom } from 'jotai';
import { newSheetId, openSheetsAtom } from '../../atoms/feedback';
import { useThemeColors } from '../../hooks/useThemeColors';
import { IconButton } from './Button';
import { ToastHost } from './Toast';

import { DOCK_BREAKPOINT } from './layout';

export { DOCK_BREAKPOINT };

const WIDTH = { sm: 400, md: 520, lg: 640, xl: 760 } as const;
const NATIVE_DRIVER = Platform.OS !== 'web';

// react-native-web's <Modal> always renders its <ModalPortal>, which appends a new
// <div> straight to document.body the first time it renders — not when it opens
// (visible only toggles what's inside). A Sheet that's always mounted (every sheet
// in this app — callers pass visible={someCondition}, never conditionally render
// the Sheet itself) gets its portal div appended at MOUNT time, not open time.
// Stacking across separate portal divs has no z-index involved anywhere in
// react-native-web's Modal — it's plain DOM order, last sibling on top — so
// whichever Sheet happened to mount first stays visually underneath forever,
// regardless of which one a person actually opened more recently. ConfirmHost and
// ToastHost are mounted as siblings of the whole signed-in app (App.tsx), so they
// exist before anything inside ProjectScreen does — meaning every ordinary panel
// (ItemModal, ViewModal, …) ends up with a portal appended *after* theirs, and so
// paints on top of a confirm dialog or toast raised from inside it.
// Fix: move this Sheet's own portal div to the very end of <body> every time it
// opens. appendChild on a node already in the DOM relocates it rather than
// duplicating it, so the most-recently-opened sheet is always the last child of
// <body> — always on top — independent of mount order. Native ignores this
// entirely; the OS's own modal presentation already layers correctly.
export function bringPortalToFront(node: unknown) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return;
  }
  let el = node as HTMLElement | null;
  while (el && el.parentElement && el.parentElement !== document.body) {
    el = el.parentElement;
  }
  if (el && el.parentElement === document.body) {
    document.body.appendChild(el);
  }
}

// The one modal shell every dialog/sheet in the app uses: animated backdrop + panel
// (spring in, quick ease out), bottom-sheet on phones, centred dialog elsewhere,
// Esc / back / backdrop to dismiss. Compose the inside with SheetHeader,
// SheetBody and SheetFooter.
export function Sheet({
  visible,
  onClose,
  size = 'md',
  dismissable = true,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  size?: keyof typeof WIDTH;
  // false: backdrop taps and Esc don't close it (unsaved / in-flight work).
  dismissable?: boolean;
  children: ReactNode;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { dark } = useThemeColors();
  const docked = width < DOCK_BREAKPOINT;
  const anim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  const [sheetId] = useState(newSheetId);
  const setOpenSheets = useSetAtom(openSheetsAtom);
  const openSheets = useAtomValue(openSheetsAtom);
  const onTop = openSheets[openSheets.length - 1] === sheetId;
  const rootRef = useRef<ViewInstance | null>(null);

  // See bringPortalToFront's comment above: without this, which sheet visually
  // wins is decided by mount order, not open order.
  useEffect(() => {
    if (visible) {
      bringPortalToFront(rootRef.current);
    }
  }, [visible]);

  // Register while open, so the topmost sheet can host the toasts.
  useEffect(() => {
    if (!visible) {
      return;
    }
    setOpenSheets(prev => [...prev.filter(i => i !== sheetId), sheetId]);
    return () => setOpenSheets(prev => prev.filter(i => i !== sheetId));
  }, [visible, sheetId, setOpenSheets]);

  // Keep showing the last content while the exit animation runs — callers often
  // render nothing (e.g. the selected item became null) the moment they close.
  const lastChildren = useRef(children);
  if (visible) {
    lastChildren.current = children;
  }

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.spring(anim, {
        toValue: 1,
        damping: 28,
        stiffness: 380,
        mass: 0.9,
        useNativeDriver: NATIVE_DRIVER,
      }).start();
    } else {
      Animated.timing(anim, {
        toValue: 0,
        duration: 150,
        easing: Easing.out(Easing.quad),
        useNativeDriver: NATIVE_DRIVER,
      }).start(({ finished }) => finished && setMounted(false));
    }
  }, [visible, anim]);

  const requestClose = () => {
    if (dismissable) {
      onClose();
    }
  };

  const panelMotion = docked
    ? {
        opacity: anim.interpolate({
          inputRange: [0, 0.4, 1],
          outputRange: [0, 1, 1],
        }),
        transform: [
          {
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [48, 0],
            }),
          },
        ],
      }
    : {
        opacity: anim,
        transform: [
          {
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [10, 0],
            }),
          },
          {
            scale: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.97, 1],
            }),
          },
        ],
      };

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={requestClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View
          ref={rootRef}
          style={{ flex: 1 }}
          className={docked ? 'justify-end' : 'items-center justify-center p-6'}
        >
          <Animated.View
            pointerEvents={visible ? 'auto' : 'none'}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: dark ? 'rgba(0,0,0,0.6)' : 'rgba(15,15,25,0.32)',
              opacity: anim,
            }}
          >
            <Pressable
              accessibilityLabel="Close"
              onPress={requestClose}
              style={{ flex: 1, cursor: 'default' } as object}
            />
          </Animated.View>
          <Animated.View
            pointerEvents={visible ? 'auto' : 'none'}
            style={[
              {
                width: '100%',
                maxWidth: docked ? undefined : WIDTH[size],
                maxHeight: docked ? height * 0.92 : height * 0.86,
              },
              panelMotion,
            ]}
          >
            <View
              accessibilityViewIsModal
              style={[
                {
                  maxHeight: '100%',
                  paddingBottom: docked ? insets.bottom : 0,
                },
                Platform.OS === 'web'
                  ? ({
                      boxShadow: dark
                        ? '0 24px 64px -12px rgba(0,0,0,0.7)'
                        : '0 24px 64px -16px rgba(20,20,40,0.28), 0 2px 6px rgba(20,20,40,0.06)',
                    } as object)
                  : { elevation: 16 },
              ]}
              className={`overflow-hidden border-border-main bg-bg-card ${
                docked ? 'rounded-t-2xl border-t' : 'rounded-2xl border'
              }`}
            >
              {docked ? (
                <View className="items-center pb-1 pt-2">
                  <View className="h-1 w-9 rounded-full bg-border-strong" />
                </View>
              ) : null}
              {lastChildren.current}
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
      {onTop ? <ToastHost inSheet /> : null}
    </Modal>
  );
}

export function SheetHeader({
  title,
  description,
  onClose,
  eyebrow,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  onClose?: () => void;
  // Small line above the title (an id, a breadcrumb…).
  eyebrow?: ReactNode;
  // Extra icon buttons, left of the close button.
  actions?: ReactNode;
}) {
  return (
    <View className="flex-row items-start gap-3 px-5 pb-3 pt-4">
      <View className="flex-1">
        {eyebrow ? <View className="mb-1">{eyebrow}</View> : null}
        {typeof title === 'string' ? (
          <Text className="text-lg font-semibold text-text-heading">
            {title}
          </Text>
        ) : (
          title
        )}
        {description ? (
          typeof description === 'string' ? (
            <Text className="mt-1 text-sm text-text-main">{description}</Text>
          ) : (
            description
          )
        ) : null}
      </View>
      <View className="-mr-1.5 -mt-0.5 flex-row items-center gap-0.5">
        {actions}
        {onClose ? (
          <IconButton icon={X} label="Close" onPress={onClose} />
        ) : null}
      </View>
    </View>
  );
}

export function SheetBody({
  children,
  scroll = true,
  className = '',
}: {
  children: ReactNode;
  scroll?: boolean;
  className?: string;
}) {
  if (!scroll) {
    return <View className={`px-5 pb-4 ${className}`}>{children}</View>;
  }
  return (
    <ScrollView
      style={{ flexGrow: 0, flexShrink: 1 }}
      contentContainerClassName={`px-5 pb-5 ${className}`}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

export function SheetFooter({
  children,
  left,
}: {
  children: ReactNode;
  // Pinned to the left edge — usually a destructive action.
  left?: ReactNode;
}) {
  return (
    <View className="flex-row items-center gap-2 border-t border-border-main bg-bg-card px-5 py-3">
      {left}
      <View className="flex-1" />
      {children}
    </View>
  );
}
