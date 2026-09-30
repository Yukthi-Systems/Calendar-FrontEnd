import { addDays, format, startOfWeek, subHours } from 'date-fns';
import type {
  Comment,
  Member,
  ProjectView,
  Priority,
  Status,
  WorkItem,
} from './types';

// Dates are relative to the current week so the mock data always looks current.
const base = startOfWeek(new Date(), { weekStartsOn: 1 });
const d = (offset: number) => format(addDays(base, offset), 'yyyy-MM-dd');

export const MEMBERS: Member[] = [
  {
    id: 'm1',
    name: 'Aarav Nair',
    initials: 'AN',
    color: '#8b5cf6',
    role: 'Tech Lead',
    capacity: 5,
  },
  {
    id: 'm2',
    name: 'Meera Iyer',
    initials: 'MI',
    color: '#ec4899',
    role: 'Designer',
    capacity: 4,
  },
  {
    id: 'm3',
    name: 'Rohan Das',
    initials: 'RD',
    color: '#0ea5e9',
    role: 'Frontend',
    capacity: 6,
  },
  {
    id: 'm4',
    name: 'Sana Khan',
    initials: 'SK',
    color: '#10b981',
    role: 'Backend',
    capacity: 6,
  },
  {
    id: 'm5',
    name: 'Vikram Rao',
    initials: 'VR',
    color: '#f97316',
    role: 'QA',
    capacity: 4,
  },
];

const item = (
  n: number,
  title: string,
  status: Status,
  priority: Priority,
  assigneeIds: string[],
  start: number,
  end: number,
  labels: string[],
  description = '',
  parentId: string | null = null,
): WorkItem => ({
  id: `YTC-${n}`,
  title,
  description:
    description || `Details for "${title}". Replace with real content later.`,
  status,
  priority,
  assigneeIds,
  parentId,
  start: d(start),
  end: d(end),
  labels,
});

export const MOCK_ITEMS: WorkItem[] = [
  item(101, 'Design calendar month grid', 'done', 'medium', ['m2'], -9, -5, [
    'design',
  ]),
  item(102, 'Set up project boards API', 'done', 'high', ['m4'], -8, -3, [
    'backend',
  ]),
  item(
    103,
    'Team planning workload view',
    'in_progress',
    'high',
    ['m3', 'm1'],
    -2,
    4,
    ['frontend'],
  ),
  item(
    104,
    'Kanban board interactions',
    'in_progress',
    'medium',
    ['m3'],
    0,
    6,
    ['frontend'],
  ),
  item(
    105,
    'Recurring events model',
    'in_progress',
    'high',
    ['m4', 'm1'],
    -1,
    5,
    ['backend'],
  ),
  item(106, 'Roadmap timeline spec', 'in_review', 'medium', ['m1'], -3, 1, [
    'docs',
  ]),
  item(107, 'Onboarding illustrations', 'in_review', 'low', ['m2'], -2, 2, [
    'design',
  ]),
  item(108, 'Push notification service', 'todo', 'high', ['m4', 'm5'], 3, 10, [
    'backend',
  ]),
  item(109, 'Dark mode QA pass', 'todo', 'low', ['m5'], 4, 7, ['qa']),
  item(110, 'Invite teammates flow', 'todo', 'medium', ['m1', 'm2'], 5, 12, [
    'frontend',
    'growth',
  ]),
  item(111, 'Timezone edge cases', 'todo', 'high', ['m5'], 1, 8, ['qa', 'bug']),
  item(112, 'Accessibility audit', 'todo', 'medium', ['m2', 'm5'], 7, 14, [
    'design',
    'qa',
  ]),
  item(113, 'Offline sync research', 'todo', 'low', [], 9, 16, ['research']),
  item(114, 'Public release checklist', 'todo', 'high', ['m1'], 14, 20, [
    'release',
  ]),
  item(115, 'iOS + Android smoke tests', 'todo', 'medium', ['m5'], 12, 18, [
    'qa',
    'mobile',
  ]),
  item(116, 'Sprint retro notes', 'done', 'low', ['m1'], -6, -6, ['docs']),

  // Subtasks. YTC-103 → 122 is a full 7-level chain (the maximum depth).
  item(
    117,
    'Capacity calculation',
    'in_progress',
    'high',
    ['m3'],
    -2,
    3,
    ['frontend'],
    '',
    'YTC-103',
  ),
  item(
    118,
    'Distribute load by week overlap',
    'in_review',
    'medium',
    ['m3'],
    -2,
    2,
    ['frontend'],
    '',
    'YTC-117',
  ),
  item(
    119,
    'Handle multi-week items',
    'todo',
    'medium',
    ['m3'],
    0,
    2,
    ['frontend'],
    '',
    'YTC-118',
  ),
  item(
    120,
    'Weekend exclusion rule',
    'todo',
    'low',
    ['m3'],
    1,
    2,
    ['frontend'],
    '',
    'YTC-119',
  ),
  item(
    121,
    'Public holiday calendar',
    'todo',
    'low',
    ['m3'],
    1,
    3,
    ['frontend'],
    '',
    'YTC-120',
  ),
  item(
    122,
    'Regional holiday overrides',
    'todo',
    'low',
    ['m3'],
    2,
    3,
    ['frontend'],
    '',
    'YTC-121',
  ),
  item(
    123,
    'Member workload card UI',
    'done',
    'medium',
    ['m3', 'm2'],
    -2,
    0,
    ['frontend'],
    '',
    'YTC-103',
  ),
  item(
    124,
    'RRULE parser',
    'in_progress',
    'high',
    ['m4'],
    -1,
    3,
    ['backend'],
    '',
    'YTC-105',
  ),
  item(
    125,
    'Exception dates',
    'todo',
    'medium',
    ['m4'],
    2,
    5,
    ['backend'],
    '',
    'YTC-124',
  ),
  item(
    126,
    'APNs integration',
    'todo',
    'high',
    ['m4', 'm5'],
    3,
    7,
    ['backend', 'mobile'],
    '',
    'YTC-108',
  ),
  item(
    127,
    'FCM integration',
    'todo',
    'high',
    ['m4', 'm5'],
    6,
    10,
    ['backend', 'mobile'],
    '',
    'YTC-108',
  ),
];

const ago = (hours: number) => subHours(new Date(), hours).toISOString();

const comment = (
  n: number,
  itemId: string,
  authorId: string,
  text: string,
  hoursAgo: number,
): Comment => {
  const author = MEMBERS.find(m => m.id === authorId);
  return {
    id: `c${n}`,
    itemId,
    authorName: author?.name ?? 'Unknown',
    authorInitials: author?.initials ?? '?',
    authorColor: author?.color ?? '#9ca3af',
    text,
    createdAt: ago(hoursAgo),
  };
};

// A couple of items (including a subtask, YTC-117) get a small seeded thread
// so "multiple comments" and "comments on a subtask" both have something to
// show right away.
export const MOCK_COMMENTS: Comment[] = [
  comment(
    1,
    'YTC-103',
    'm1',
    "Let's ship the desktop rail first, mobile can follow once the layout settles.",
    30,
  ),
  comment(
    2,
    'YTC-103',
    'm3',
    'Agreed — rail is basically done, working on the workload bars now.',
    26,
  ),
  comment(
    3,
    'YTC-103',
    'm1',
    'Nice, ping me for a review once the bars are in.',
    4,
  ),
  comment(
    4,
    'YTC-108',
    'm4',
    'APNs cert is provisioned. Waiting on FCM keys before I can test end to end.',
    20,
  ),
  comment(5, 'YTC-108', 'm5', "I'll get the FCM keys over today.", 18),
  comment(
    6,
    'YTC-117',
    'm3',
    'Prorating by day overlap seems to match what Team planning already assumes — reusing that helper.',
    10,
  ),
];

export const DEFAULT_VIEWS: ProjectView[] = [
  { id: 'v-table', name: 'Table', type: 'table' },
  { id: 'v-team', name: 'Team planning', type: 'team' },
  { id: 'v-calendar', name: 'Calendar', type: 'calendar' },
];
