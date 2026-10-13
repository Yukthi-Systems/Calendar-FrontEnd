import { getDefaultStore } from 'jotai';
import { addDays, format } from 'date-fns';
import { itemsAtom } from '../atoms/project';
import { directoryAtom } from '../atoms/userInfo';
import { currentUserIdAtom } from '../atoms/members';
import type { Priority, Status, TaskTag, WorkItem } from '../data/types';

// Dev-only sample workspace for reviewing layouts with realistic data, since the
// tasks API is switched off (TASKS_API_ENABLED) and every view is otherwise empty.
// Web + development build + `?demo=1` only; nothing is persisted or sent anywhere.
// See CLAUDE.md "Dev-only demo data".

const TEAM = [
  { user_id: 'demo-ana', name: 'Ana Ruiz', role: 'Design' },
  { user_id: 'demo-kai', name: 'Kai Chen', role: 'Frontend' },
  { user_id: 'demo-sam', name: 'Sam Okafor', role: 'Backend' },
  { user_id: 'demo-lea', name: 'Lea Novak', role: 'QA' },
];

type Seed = [
  id: string,
  title: string,
  status: Status,
  priority: Priority,
  tag: TaskTag,
  startOffset: number,
  days: number,
  assignees: string[],
  parentId?: string,
  extra?: Partial<WorkItem>,
];

const SEEDS: Seed[] = [
  ['T-101', 'Redesign onboarding flow', 'in_progress', 'high', 'work', -6, 12, ['me', 'demo-ana']],
  ['T-102', 'Audit current sign-up drop-off', 'completed', 'medium', 'work', -6, 3, ['demo-ana'], 'T-101'],
  ['T-103', 'Wireframes for new welcome screens', 'in_progress', 'high', 'work', -2, 5, ['demo-ana'], 'T-101'],
  ['T-104', 'Implement welcome carousel', 'not_started', 'medium', 'work', 3, 4, ['demo-kai'], 'T-101'],
  ['T-105', 'Migrate task list endpoint to POST body', 'in_progress', 'high', 'urgent', -3, 6, ['demo-sam'], undefined, { labels: ['api', 'bug'] }],
  ['T-106', 'Calendar sync with Google', 'not_started', 'medium', 'important', 4, 10, ['demo-kai', 'demo-sam']],
  ['T-107', 'Weekly design review', 'not_started', 'low', 'work', 0, 0, ['me', 'demo-ana', 'demo-kai'], undefined, { recurrence: 'FREQ=WEEKLY;BYDAY=MO' }],
  ['T-108', 'Regression pass for release 2.4', 'on_hold', 'medium', 'work', -1, 3, ['demo-lea']],
  ['T-109', 'Fix timezone bug in reminders', 'completed', 'high', 'urgent', -9, 2, ['demo-sam'], undefined, { labels: ['bug'] }],
  ['T-110', 'Dark mode contrast pass', 'in_progress', 'medium', 'work', -1, 4, ['me']],
  ['T-111', 'Drop legacy CSV export', 'rejected', 'low', 'optional', -12, 2, []],
  ['T-112', 'Accessibility audit (WCAG AA)', 'not_started', 'high', 'important', 6, 7, ['demo-lea', 'me']],
  ['T-113', 'Write release notes', 'not_started', 'low', 'work', 8, 1, []],
  ['T-114', 'Book team offsite venue', 'not_started', 'medium', 'personal', 1, 0, ['me']],
  ['T-115', 'Performance budget for web bundle', 'not_started', 'medium', 'work', 10, 5, ['demo-kai'], undefined, { labels: ['perf'] }],
];

export function seedDemoIfRequested() {
  if (!__DEV__ || typeof window === 'undefined' || !window.location?.search) {
    return;
  }
  if (!new URLSearchParams(window.location.search).has('demo')) {
    return;
  }
  const store = getDefaultStore();
  store.set(
    directoryAtom,
    TEAM.map(t => ({
      user_id: t.user_id,
      email: `${t.user_id}@example.com`,
      public_info: { name: t.name, role: t.role },
    })) as never,
  );

  const seed = () => {
    const me = store.get(currentUserIdAtom) || 'me';
    const today = new Date();
    const day = (n: number) => format(addDays(today, n), 'yyyy-MM-dd');
    store.set(
      itemsAtom,
      SEEDS.map(([id, title, status, priority, tag, off, days, who, parentId, extra]) => ({
        id,
        title,
        description:
          'Sample task for reviewing the layout. Edit or delete it freely — nothing here is saved.',
        status,
        priority,
        tag,
        assigneeIds: who.map(w => (w === 'me' ? me : w)),
        createdById: me,
        parentId: parentId ?? null,
        // Real tasks get this from the server (total_sub_tasks); demo seeds derive
        // it the same way — direct children only, by counting the other seeds.
        totalSubtasks: SEEDS.filter(s => s[8] === id).length,
        start: day(off),
        end: day(off + days),
        labels: [],
        recurrence: null,
        reminders: [],
        ...extra,
      })),
    );
  };
  seed();
  // Re-seed once the session's user id is known, so "you" own the sample tasks.
  const unsub = store.sub(currentUserIdAtom, () => {
    if (store.get(currentUserIdAtom)) {
      seed();
      unsub();
    }
  });
}
