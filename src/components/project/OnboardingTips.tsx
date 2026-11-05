import { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import X from 'lucide-react-native/icons/x';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Button, IconButton } from '../ui';
import {
  measureTarget,
  type TargetRect,
  type TourTargetKey,
} from './tourTargets';

// The first-run help (see useOnboarding.ts): a guided tour that dims the page,
// rings one control at a time and puts its tip in a bubble right next to it.
// Steps whose control isn't on screen are skipped; if none are (a phone
// layout), the tips show as a plain centred card instead.
const TIPS: { target: TourTargetKey; title: string; body: string }[] = [
  {
    target: 'views',
    title: 'Your views',
    body: 'We’ve set up three views for you: Work & Priorities (work, important, urgent and other tasks), Events Calendar (your meetings and events by day, week, month and year) and All Tasks (everything). Switch between them here.',
  },
  {
    target: 'newView',
    title: 'Make your own view',
    body: 'Create a table, board, roadmap or calendar with its own status and tag filters.',
  },
  {
    target: 'tabs',
    title: 'Tasks and Recurring Events',
    body: 'Tasks shows the view’s tasks. When a view has Recurring Event turned on, this tab lists the ones that repeat.',
  },
  {
    target: 'newTask',
    title: 'Add something new',
    body: 'Add a task here. When the view allows them, you can also choose New Event or New Recurring Event. Events have start and due times and you can invite people. Tasks are by date; set a time under Advanced options if you need one.',
  },
  {
    target: 'filter',
    title: 'Filter the table',
    body: 'Narrow the list by status, tag, assignee or due date, and pick which columns are shown. Your choices are saved with the view.',
  },
  {
    target: 'search',
    title: 'Search',
    body: 'Find any task by its name.',
  },
  {
    target: 'alerts',
    title: 'Alerts',
    body: 'All the reminders you’ve set on tasks, in one place.',
  },
  {
    target: 'profile',
    title: 'Profile and appearance',
    body: 'Edit your name and phone, change the theme, or sign out.',
  },
];

const KEYS_TIP = 'Shortcuts: N new task, / search, V new view, R refresh.';

const BUBBLE_W = 320;
const MARGIN = 12;
const GAP = 12;
// How far the ring sits outside the control.
const PAD = 4;

type Step = { tip: (typeof TIPS)[number]; rect: TargetRect | null };

export function OnboardingTips({
  visible,
  onClose,
  onDismiss,
}: {
  visible: boolean;
  onClose: () => void;
  // "Don't show again".
  onDismiss: () => void;
}) {
  const c = useThemeColors();
  const win = useWindowDimensions();
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [index, setIndex] = useState(0);
  const [bubbleH, setBubbleH] = useState(0);

  const measureAll = useCallback(async () => {
    const rects = await Promise.all(TIPS.map(t => measureTarget(t.target)));
    const found = TIPS.map((tip, i) => ({ tip, rect: rects[i] })).filter(
      s => s.rect,
    );
    setSteps(found.length ? found : TIPS.map(tip => ({ tip, rect: null })));
  }, []);

  // Give the workspace a moment to lay out (it may have only just got its
  // views), then find the controls. Measured again when the window resizes.
  useEffect(() => {
    if (!visible) {
      setSteps(null);
      setIndex(0);
      return;
    }
    const id = setTimeout(measureAll, 300);
    return () => clearTimeout(id);
  }, [visible, measureAll, win.width, win.height]);

  if (!visible || !steps) {
    return null;
  }
  const step = steps[Math.min(index, steps.length - 1)];
  const last = index >= steps.length - 1;
  const rect = step.rect;
  const w = Math.min(BUBBLE_W, win.width - MARGIN * 2);

  // Below the control if it fits, else above; centred on it, kept on screen.
  let bubble: { left: number; top: number; arrowX: number; above: boolean };
  if (rect) {
    const cx = rect.x + rect.width / 2;
    const left = Math.max(MARGIN, Math.min(cx - w / 2, win.width - w - MARGIN));
    const below = rect.y + rect.height + PAD + GAP;
    const above = !!bubbleH && below + bubbleH > win.height - MARGIN;
    bubble = {
      left,
      top: above ? rect.y - PAD - GAP - bubbleH : below,
      arrowX: Math.max(16, Math.min(cx - left, w - 16)),
      above,
    };
  } else {
    bubble = {
      left: (win.width - w) / 2,
      top: Math.max(MARGIN, (win.height - bubbleH) / 2),
      arrowX: 0,
      above: false,
    };
  }

  // The dim layer is four panels around the ringed control, so it stays lit.
  const hole = rect && {
    x: rect.x - PAD,
    y: rect.y - PAD,
    w: rect.width + PAD * 2,
    h: rect.height + PAD * 2,
  };
  const dim = 'absolute bg-black/55';

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View className="flex-1" accessibilityViewIsModal>
        {hole ? (
          <>
            <Pressable
              onPress={onClose}
              className={`${dim} inset-x-0 top-0`}
              style={{ height: Math.max(0, hole.y) }}
            />
            <Pressable
              onPress={onClose}
              className={`${dim} inset-x-0 bottom-0`}
              style={{ top: hole.y + hole.h }}
            />
            <Pressable
              onPress={onClose}
              className={`${dim} left-0`}
              style={{
                top: hole.y,
                width: Math.max(0, hole.x),
                height: hole.h,
              }}
            />
            <Pressable
              onPress={onClose}
              className={`${dim} right-0`}
              style={{
                left: hole.x + hole.w,
                top: hole.y,
                height: hole.h,
              }}
            />
            <View
              pointerEvents="none"
              className="absolute rounded-lg border-2"
              style={{
                left: hole.x,
                top: hole.y,
                width: hole.w,
                height: hole.h,
                borderColor: c.accent,
              }}
            />
          </>
        ) : (
          <Pressable onPress={onClose} className={`${dim} inset-0`} />
        )}

        <View
          onLayout={e => setBubbleH(e.nativeEvent.layout.height)}
          className="absolute rounded-xl border border-border-main bg-bg-card shadow-lg"
          style={{ left: bubble.left, top: bubble.top, width: w }}
        >
          {rect ? (
            <View
              className="absolute h-3 w-3 rotate-45 border-border-main bg-bg-card"
              style={{
                left: bubble.arrowX - 6,
                ...(bubble.above
                  ? { bottom: -6, borderRightWidth: 1, borderBottomWidth: 1 }
                  : { top: -6, borderLeftWidth: 1, borderTopWidth: 1 }),
              }}
            />
          ) : null}
          <View className="flex-row items-start gap-2 px-4 pt-3">
            <View className="flex-1">
              <Text className="text-xs font-medium text-text-subtle">
                {index + 1} of {steps.length}
              </Text>
              <Text className="mt-0.5 text-base font-semibold text-text-heading">
                {step.tip.title}
              </Text>
            </View>
            <IconButton
              icon={X}
              label="Close tips"
              size="sm"
              onPress={onClose}
            />
          </View>
          <View className="gap-2 px-4 pb-3 pt-1.5">
            <Text className="text-sm leading-5 text-text-main">
              {step.tip.body}
            </Text>
            {last && Platform.OS === 'web' ? (
              <Text className="text-xs text-text-subtle">{KEYS_TIP}</Text>
            ) : null}
          </View>
          <View className="flex-row items-center gap-2 border-t border-border-main px-3 py-2.5">
            <Button variant="ghost" size="sm" onPress={onDismiss}>
              Don’t show again
            </Button>
            <View className="flex-1" />
            {index > 0 ? (
              <Button size="sm" onPress={() => setIndex(i => i - 1)}>
                Back
              </Button>
            ) : null}
            <Button
              variant="primary"
              size="sm"
              onPress={() => (last ? onClose() : setIndex(i => i + 1))}
            >
              {last ? 'Got it' : 'Next'}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}
