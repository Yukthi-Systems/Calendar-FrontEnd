import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAtomValue, useSetAtom } from 'jotai';
import { currentUserIdAtom } from '../atoms/members';
import { TIPS_SHOWN_KEY_PREFIX } from '../services/deviceKeys';
import { storage } from '../services/runtime';
import { activeViewIdAtom } from '../atoms/project';
import { errorMessage, toast } from '../atoms/feedback';
import { STATUSES, TAGS } from '../data/constants';
import { CALENDAR_FIELDS, TABLE_FIELDS } from '../data/viewFields';
import { viewFromServer } from '../data/viewSync';
import type { TaskTag } from '../data/types';
import type { TaskViewDbDto } from '../services/types';
import { useMe, useUpdateMyInfo } from './useUsers';
import {
  useViewList,
  useViewMutations,
  viewsKey,
  type ViewDraftFields,
} from './useViews';

// First-run setup, tracked in the signed-in user's private_info (and on this
// device — see deviceKey below):
//   onboarding { tips_shown: number }
// A brand-new account (private_info is `{}`) gets three starter views — only if
// it has none of its own yet — and the help tips. The tips come back on the next
// app load too, then never again: each load that shows them adds one to
// tips_shown, and "Don't show again" jumps it straight to the limit.

export const TIPS_LIMIT = 2;

interface OnboardingInfo {
  tips_shown: number;
}

const ALL_STATUSES = STATUSES.map(s => s.key);
const tags = (keys: TaskTag[]) =>
  TAGS.filter(t => keys.includes(t.key)).map(t => t.key);
const defaultFields = (opts: typeof TABLE_FIELDS) =>
  opts.filter(o => o.defaultOn).map(o => o.key);

// Created in this order, so the first is the one the workspace opens on.
const STARTER_VIEWS: ViewDraftFields[] = [
  {
    name: 'Work & Priorities',
    description: 'Work, important, urgent and other tasks.',
    type: 'table',
    fields: defaultFields(TABLE_FIELDS),
    statusFilter: ALL_STATUSES,
    tagFilter: tags(['work', 'important', 'urgent', 'other']),
  },
  {
    name: 'Events Calendar',
    description: 'Meetings and events by day, week, month and year.',
    type: 'calendar',
    fields: defaultFields(CALENDAR_FIELDS),
    statusFilter: ALL_STATUSES,
    tagFilter: tags(['event']),
  },
  {
    name: 'All Tasks',
    description: 'Every task, whatever its tag.',
    type: 'table',
    fields: defaultFields(TABLE_FIELDS),
    statusFilter: ALL_STATUSES,
    tagFilter: TAGS.map(t => t.key),
    showRecurring: true,
  },
].map(v => ({
  showSubtasks: true,
  showAssigned: true,
  showComments: true,
  showRecurring: false,
  ...v,
})) as ViewDraftFields[];

const readOnboarding = (
  priv: Record<string, unknown> | undefined,
): OnboardingInfo | null => {
  const o = priv?.onboarding as Partial<OnboardingInfo> | undefined;
  return o && typeof o.tips_shown === 'number'
    ? { tips_shown: o.tips_shown }
    : null;
};

// private_info alone can't hold the count: POST /auth/login currently resets it to
// {} on every sign-in (Tasks-Main-API's create_user_session), which would make
// everyone look brand new each time. So it's also kept in:
// - the ui_info of the user's own views, which sign-in leaves alone — that's what
//   carries it to another device. Lost only if all of those views are deleted.
// - this device, where signing out leaves it in place (see deviceKeys.ts).
// The highest of the three wins, and any copy behind it is written back. Once the
// backend stops resetting private_info, the other two can go.
const VIEWS_HOLDING_COUNT = 3;
const deviceKey = (userId: string) => `${TIPS_SHOWN_KEY_PREFIX}${userId}`;
const readDeviceCount = async (userId: string) => {
  const n = Number(await storage.getItem(deviceKey(userId)));
  return Number.isFinite(n) ? n : 0;
};

// Once per app load for each signed-in user, whatever remounts — so a re-render
// or StrictMode's double effect can't create the views twice or count one visit
// as two, while signing in as someone else in the same tab still gets checked.
let handledUserId: string | null = null;

export function useOnboarding() {
  const me = useMe();
  const userId = useAtomValue(currentUserIdAtom);
  const { myViews, ready, error } = useViewList();
  const { createView, updateView } = useViewMutations();
  const queryClient = useQueryClient();
  const updateMyInfo = useUpdateMyInfo();
  const setActiveId = useSetAtom(activeViewIdAtom);
  const [settingUp, setSettingUp] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [resolved, setResolved] = useState(handledUserId === userId);

  const priv = me.data?.private_info;
  const isEmpty = !!me.data && Object.keys(priv ?? {}).length === 0;

  const record = (tipsShown: number) => {
    storage.setItem(deviceKey(userId), String(tipsShown));
    // From the cache, not `myViews`: a new account's views were only just created.
    const views = (
      queryClient.getQueryData<TaskViewDbDto[]>(viewsKey('mine')) ?? []
    ).map(row => viewFromServer(row));
    views
      .slice(0, VIEWS_HOLDING_COUNT)
      .filter(view => (view.tipsShown ?? 0) < tipsShown)
      .forEach(view =>
        updateView({ ...view, tipsShown }).catch(() => undefined),
      );
    return updateMyInfo
      .mutateAsync({
        isPublic: false,
        patch: { onboarding: { tips_shown: tipsShown } },
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    if (handledUserId === userId || !me.data || !ready) {
      return;
    }
    handledUserId = userId;

    const setUpNewAccount = async () => {
      // Only when the list of my views really is empty — not when it failed.
      if (myViews.length === 0 && !error) {
        setSettingUp(true);
        try {
          let firstId = '';
          for (const draft of STARTER_VIEWS) {
            const id = await createView(draft);
            firstId ||= id;
          }
          if (firstId) {
            setActiveId(firstId);
          }
        } catch (err) {
          // Nothing recorded, so the next load tries again (a view that did get
          // created is skipped then — names are unique per owner).
          toast.error('Couldn’t set up your starter views', {
            description: errorMessage(err, 'Please reload to try again.'),
          });
          return;
        } finally {
          setSettingUp(false);
        }
      }
      setTipsOpen(true);
      record(1);
    };

    (async () => {
      const saved = readOnboarding(priv);
      const onDevice = await readDeviceCount(userId);
      const inViews = Math.max(0, ...myViews.map(v => v.tipsShown ?? 0));
      const shown = Math.max(saved?.tips_shown ?? 0, onDevice, inViews);
      setResolved(true);
      // Something else in private_info and no count anywhere: an account from
      // before the tips existed, which never gets them.
      if (!isEmpty && shown === 0) {
        return;
      }
      if (shown >= TIPS_LIMIT) {
        if (
          (saved?.tips_shown ?? 0) < shown ||
          onDevice < shown ||
          inViews < shown
        ) {
          record(shown);
        }
        return;
      }
      if (shown > 0) {
        // A returning visit that still gets the tips.
        setTipsOpen(true);
        record(shown + 1);
        return;
      }
      await setUpNewAccount();
    })();
    // Runs once the user record and the view lists have both loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.data, ready, userId]);

  return {
    // True while a brand-new account's views are being made — or while it is
    // still unknown whether they will be — so the "Create your first view"
    // screen doesn't flash up first.
    settingUp:
      settingUp ||
      (myViews.length === 0 && (me.isLoading || (isEmpty && !resolved))),
    tipsOpen,
    closeTips: () => setTipsOpen(false),
    // "Don't show again": skip any visits left.
    dismissTips: () => {
      setTipsOpen(false);
      record(TIPS_LIMIT);
    },
  };
}
