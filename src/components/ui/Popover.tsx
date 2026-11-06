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
import { MODAL_BACKDROP_SELECTOR, Sheet, bringPortalToFront } from './Sheet';

const NATIVE_DRIVER = Platform.OS !== 'web';
const GAP = 6;
const MARGIN = 12;
// A wheel event measured in lines rather than pixels (deltaMode 1).
const WHEEL_LINE_PX = 16;

type Anchor = { x: number; y: number; width: number; height: number };

// What the mouse wheel would be scrolling at this point if `backdrop` weren't in
// the way, or null if that's nothing, or something behind a Sheet.
function scrollerBehind(backdrop: HTMLElement, x: number, y: number) {
  for (const el of document.elementsFromPoint(x, y)) {
    if (backdrop.contains(el)) {
      continue;
    }
    if (el.closest(MODAL_BACKDROP_SELECTOR)) {
      return null;
    }
    for (
      let node: HTMLElement | null = el as HTMLElement;
      node;
      node = node.parentElement
    ) {
      const { overflowY } = getComputedStyle(node);
      if (
        (overflowY === 'auto' || overflowY === 'scroll') &&
        node.scrollHeight > node.clientHeight
      ) {
        return node;
      }
    }
  }
  return null;
}

// A floating panel anchored under (or, without room, above) its trigger —
// date/time pickers, small menus. On phones it becomes a bottom Sheet instead,
// since a dropdown under a field is cramped on a small screen.
//
// The trigger is either rendered by the Popover (`renderTrigger`, which gets the
// ref to attach) or lives elsewhere (`anchorRef` — e.g. one menu opened from
// several buttons). With neither, or no element behind the ref, it shows as a
// bottom Sheet. `variant="menu"`: tighter padding, full-width rows when docked.
export function Popover({
  open,
  onClose,
  renderTrigger,
  anchorRef,
  width = 300,
  variant = 'panel',
  children,
}: {
  open: boolean;
  onClose: () => void;
  renderTrigger?: (ref: React.RefObject<ViewInstance | null>) => ReactNode;
  anchorRef?: React.RefObject<ViewInstance | null> | null;
  width?: number;
  variant?: 'panel' | 'menu';
  children: ReactNode;
}) {
  const c = useThemeColors();
  const window = useWindowDimensions();
  const ownRef = useRef<ViewInstance | null>(null);
  const triggerRef = anchorRef ?? ownRef;
  const docked =
    window.width < DOCK_BREAKPOINT || (!renderTrigger && !anchorRef?.current);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [panelH, setPanelH] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;
  const backdropRef = useRef<ViewInstance | null>(null);

  // Same fix as Sheet's (see bringPortalToFront's comment there) — this Popover's
  // own <Modal> is just as liable to mount before whatever Sheet it's opened from
  // (e.g. a reaction picker inside an already-open task panel), landing behind it.
  useEffect(() => {
    if (open && !docked) {
      bringPortalToFront(backdropRef.current);
    }
  }, [open, docked]);

  // The invisible backdrop would otherwise swallow the wheel for the whole page.
  // Scrolling what's behind it closes the panel, since its trigger may be moving
  // away; the wheel then reaches the page directly.
  useEffect(() => {
    const backdrop = backdropRef.current as unknown as HTMLElement | null;
    if (Platform.OS !== 'web' || !open || docked || !backdrop) {
      return;
    }
    const onWheel = (e: WheelEvent) => {
      const scroller = scrollerBehind(backdrop, e.clientX, e.clientY);
      if (scroller) {
        const unit = e.deltaMode === 1 ? WHEEL_LINE_PX : 1;
        scroller.scrollBy({ left: e.deltaX * unit, top: e.deltaY * unit });
        onClose();
      }
    };
    backdrop.addEventListener('wheel', onWheel, { passive: true });
    return () => backdrop.removeEventListener('wheel', onWheel);
  }, [open, docked, onClose]);

  useEffect(() => {
    if (!open || docked) {
      setAnchor(null);
      setPanelH(0);
      anim.setValue(0);
      return;
    }
    triggerRef.current?.measureInWindow(
      (x: number, y: number, w: number, h: number) =>
        setAnchor({ x, y, width: w, height: h }),
    );
  }, [open, docked, anim, triggerRef]);

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
        {renderTrigger?.(triggerRef)}
        <Sheet visible={open} onClose={onClose} size="sm">
          <View
            className={
              variant === 'menu' ? 'p-2' : 'items-center px-4 pb-4 pt-1'
            }
          >
            {children}
          </View>
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
  // Clamped the same way as `left`: picking "below" only means it's the
  // better of two options, not that it actually fits — a trigger sitting low
  // inside a tall outer popover (or just a short window) can leave no room
  // either way, and without this the panel ran straight past the bottom edge
  // with no scroll to reach the rest of it (e.g. the quick-pick row under a
  // date picker's calendar).
  const top = anchor
    ? Math.min(
        Math.max(
          MARGIN,
          below ? anchor.y + anchor.height + GAP : anchor.y - GAP - panelH,
        ),
        window.height - panelH - MARGIN,
      )
    : 0;

  return (
    <>
      {renderTrigger?.(triggerRef)}
      <Modal
        visible={open}
        transparent
        animationType="none"
        onRequestClose={onClose}
      >
        <Pressable
          ref={backdropRef}
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
                  {
                    scale: anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.97, 1],
                    }),
                  },
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
              className={`overflow-hidden rounded-xl border border-border-main bg-bg-card ${
                variant === 'menu' ? 'p-1.5' : 'p-3'
              }`}
            >
              {children}
            </View>
          </Animated.View>
        ) : null}
      </Modal>
    </>
  );
}
