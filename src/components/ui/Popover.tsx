import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  useWindowDimensions,
  View,
  type ViewInstance,
} from 'react-native';
import { useThemeColors } from '../../hooks/useThemeColors';
import { DOCK_BREAKPOINT } from './layout';
import { Sheet } from './Sheet';

const NATIVE_DRIVER = Platform.OS !== 'web';
const GAP = 6;
const MARGIN = 12;

type Anchor = { x: number; y: number; width: number; height: number };

// A floating panel anchored under (or, without room, above) its trigger —
// date/time pickers, small menus. On phones it becomes a bottom Sheet instead,
// since a dropdown under a field is cramped on a small screen.
//
// `children` is the trigger; it gets `open()` via `renderTrigger`.
export function Popover({
  open,
  onClose,
  renderTrigger,
  width = 300,
  children,
}: {
  open: boolean;
  onClose: () => void;
  renderTrigger: (ref: React.RefObject<ViewInstance | null>) => ReactNode;
  width?: number;
  children: ReactNode;
}) {
  const c = useThemeColors();
  const window = useWindowDimensions();
  const docked = window.width < DOCK_BREAKPOINT;
  const triggerRef = useRef<ViewInstance | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [panelH, setPanelH] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!open || docked) {
      setAnchor(null);
      setPanelH(0);
      anim.setValue(0);
      return;
    }
    triggerRef.current?.measureInWindow((x: number, y: number, w: number, h: number) =>
      setAnchor({ x, y, width: w, height: h }),
    );
  }, [open, docked, anim]);

  // Animate in once we know where it goes (anchor) and how tall it is (panelH).
  useEffect(() => {
    if (anchor && panelH) {
      Animated.spring(anim, {
        toValue: 1,
        damping: 26,
        stiffness: 420,
        mass: 0.7,
        useNativeDriver: NATIVE_DRIVER,
      }).start();
    }
  }, [anchor, panelH, anim]);

  if (docked) {
    return (
      <>
        {renderTrigger(triggerRef)}
        <Sheet visible={open} onClose={onClose} size="sm">
          <View className="items-center px-4 pb-4 pt-1">{children}</View>
        </Sheet>
      </>
    );
  }

  // Below the trigger if it fits, otherwise above; clamped inside the window.
  const below = anchor
    ? anchor.y + anchor.height + GAP + panelH <= window.height - MARGIN ||
      anchor.y - GAP - panelH < MARGIN
    : true;
  const left = anchor
    ? Math.min(Math.max(MARGIN, anchor.x), window.width - width - MARGIN)
    : 0;
  const top = anchor
    ? below
      ? anchor.y + anchor.height + GAP
      : anchor.y - GAP - panelH
    : 0;

  return (
    <>
      {renderTrigger(triggerRef)}
      <Modal visible={open} transparent animationType="none" onRequestClose={onClose}>
        <Pressable
          accessibilityLabel="Close"
          onPress={onClose}
          style={{ flex: 1, cursor: 'default' } as object}
        />
        {anchor ? (
          <Animated.View
            onLayout={e => setPanelH(e.nativeEvent.layout.height)}
            style={[
              {
                position: 'absolute',
                left,
                top,
                width,
                opacity: panelH ? anim : 0,
                transform: [
                  {
                    translateY: anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [below ? -6 : 6, 0],
                    }),
                  },
                  { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
                ],
              },
            ]}
          >
            <View
              style={
                Platform.OS === 'web'
                  ? ({
                      boxShadow: c.dark
                        ? '0 16px 40px -8px rgba(0,0,0,0.7)'
                        : '0 16px 40px -12px rgba(20,20,40,0.28), 0 2px 6px rgba(20,20,40,0.06)',
                    } as object)
                  : { elevation: 12 }
              }
              className="overflow-hidden rounded-xl border border-border-main bg-bg-card p-3"
            >
              {children}
            </View>
          </Animated.View>
        ) : null}
      </Modal>
    </>
  );
}
