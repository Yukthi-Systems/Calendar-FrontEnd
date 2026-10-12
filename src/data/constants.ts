import {
  CalendarDays,
  Columns3,
  Map as MapIcon,
  Table2,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import type { Priority, Status, TaskTag, ViewType } from './types';
import type { BackendTaskStatus, BackendTaskTag } from '../services/types';

export const STATUSES: { key: Status; label: string; color: string }[] = [
  { key: 'not_started', label: 'Not Started', color: '#6b7280' },
  { key: 'in_progress', label: 'In Progress', color: '#f59e0b' },
  { key: 'completed', label: 'Completed', color: '#10b981' },
  { key: 'rejected', label: 'Rejected', color: '#ef4444' },
  { key: 'on_hold', label: 'On Hold', color: '#8b5cf6' },
];

export const STATUS_BY_KEY = Object.fromEntries(
  STATUSES.map(s => [s.key, s]),
) as Record<Status, (typeof STATUSES)[number]>;

// Safe lookup: a status value that predates a schema change (e.g. stale data
// in local storage from before this status set changed) falls back to
// STATUSES[0] instead of crashing whatever's rendering it.
export const statusInfo = (status: Status) =>
  STATUS_BY_KEY[status] ?? STATUSES[0];

// Tasks-Main-API's task_status enum uses different names/values (and merges
// "rejected" into CANCELLED) — translate at the service boundary only. Same
// casing both ways (request and response) — see BackendTaskStatus's own comment.
export const BACKEND_STATUS: Record<Status, BackendTaskStatus> = {
  not_started: 'PENDING',
  in_progress: 'IN_PROGRESS',
  completed: 'COMPLETED',
  rejected: 'CANCELLED',
  on_hold: 'ON_HOLD',
};

export const TAGS: { key: TaskTag; label: string; color: string }[] = [
  { key: 'work', label: 'Work', color: '#0ea5e9' },
  { key: 'important', label: 'Important', color: '#8b5cf6' },
  { key: 'urgent', label: 'Urgent', color: '#ef4444' },
  { key: 'optional', label: 'Optional', color: '#6b7280' },
  { key: 'personal', label: 'Personal', color: '#ec4899' },
  { key: 'other', label: 'Other', color: '#f59e0b' },
];

export const TAG_BY_KEY = Object.fromEntries(
  TAGS.map(t => [t.key, t]),
) as Record<TaskTag, (typeof TAGS)[number]>;

export const tagInfo = (tag: TaskTag) => TAG_BY_KEY[tag] ?? TAGS[0];

export const BACKEND_TAG: Record<TaskTag, BackendTaskTag> = {
  work: 'WORK',
  important: 'IMPORTANT',
  urgent: 'URGENT',
  optional: 'OPTIONAL',
  personal: 'PERSONAL',
  other: 'OTHER',
};

export const TAG_FROM_BACKEND: Record<BackendTaskTag, TaskTag> = {
  WORK: 'work',
  IMPORTANT: 'important',
  URGENT: 'urgent',
  OPTIONAL: 'optional',
  PERSONAL: 'personal',
  OTHER: 'other',
};

export const STATUS_FROM_BACKEND: Record<BackendTaskStatus, Status> = {
  PENDING: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'rejected',
  ON_HOLD: 'on_hold',
};

export const PRIORITY_COLOR: Record<Priority, string> = {
  low: '#6b7280',
  medium: '#f59e0b',
  high: '#ef4444',
};

export const VIEW_TYPES: {
  key: ViewType;
  label: string;
  icon: LucideIcon;
  blurb: string;
}[] = [
  {
    key: 'table',
    label: 'Table',
    icon: Table2,
    blurb: 'Sortable spreadsheet of all items',
  },
  {
    key: 'team',
    label: 'Team planning',
    icon: Users,
    blurb: 'Workload per person, week by week',
  },
  {
    key: 'kanban',
    label: 'Kanban',
    icon: Columns3,
    blurb: 'Columns by status',
  },
  {
    key: 'roadmap',
    label: 'Roadmap',
    icon: MapIcon,
    blurb: 'Timeline of work items',
  },
  {
    key: 'calendar',
    label: 'Calendar',
    icon: CalendarDays,
    blurb: 'Month grid of due work',
  },
];
