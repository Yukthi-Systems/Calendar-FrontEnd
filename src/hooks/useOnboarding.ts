import { useEffect, useState } from 'react';
import { useSetAtom } from 'jotai';
import { activeViewIdAtom } from '../atoms/project';
import { errorMessage, toast } from '../atoms/feedback';
import { STATUSES, TAGS } from '../data/constants';
import { CALENDAR_FIELDS, TABLE_FIELDS } from '../data/viewFields';
import type { TaskTag } from '../data/types';
import { useMe, useUpdateMyInfo } from './useUsers';
import {
  useViewList,
  useViewMutations,
  type ViewDraftFields,
} from './useViews';

// First-run setup, tracked in the signed-in user's private_info:
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

// Once per app load, whatever remounts — so a re-render or StrictMode's double
// effect can't create the views twice or count one visit as two.
let handledThisLoad = false;

export function useOnboarding() {
  const me = useMe();
  const { myViews, ready, error } = useViewList();
  const { createView } = useViewMutations();
  const updateMyInfo = useUpdateMyInfo();
  const setActiveId = useSetAtom(activeViewIdAtom);
  const [settingUp, setSettingUp] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);

  const priv = me.data?.private_info;
  const isNewUser = !!me.data && Object.keys(priv ?? {}).length === 0;

  useEffect(() => {
    if (handledThisLoad || !me.data || !ready) {
      return;
    }
    const saved = readOnboarding(priv);
    if (!isNewUser && (!saved || saved.tips_shown >= TIPS_LIMIT)) {
      handledThisLoad = true;
      return;
    }
    handledThisLoad = true;

    const record = (tipsShown: number) =>
      updateMyInfo
        .mutateAsync({
          isPublic: false,
          patch: { onboarding: { tips_shown: tipsShown } },
        })
        .catch(() => undefined);

    if (saved) {
      // A returning visit that still gets the tips.
      setTipsOpen(true);
      record(saved.tips_shown + 1);
      return;
    }

    (async () => {
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
    })();
    // Runs once the user record and the view lists have both loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.data, ready]);

  return {
    // True while a brand-new account's views are being made — or while it is
    // still unknown whether they will be — so the "Create your first view"
    // screen doesn't flash up first.
    settingUp:
      settingUp ||
      (myViews.length === 0 &&
        (me.isLoading || (isNewUser && !handledThisLoad))),
    tipsOpen,
    closeTips: () => setTipsOpen(false),
    // "Don't show again": skip any visits left.
    dismissTips: () => {
      setTipsOpen(false);
      updateMyInfo
        .mutateAsync({
          isPublic: false,
          patch: { onboarding: { tips_shown: TIPS_LIMIT } },
        })
        .catch(() => undefined);
    },
  };
}
