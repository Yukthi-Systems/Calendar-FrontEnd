import { BACKEND_TAG, TAG_FROM_BACKEND } from './constants';
import type { TaskTag } from './types';
import type {
  BackendTaskTag,
  CreateRecurringTaskPayload,
  RecurringTaskDto,
  UpdateRecurringTaskPayload,
} from '../services/types';

// A recurring_tasks row, as this app edits it — see services/recurringTasks.ts's
// header comment for how this differs from a task's own `recurrence` field.
// No anchor date, no status, no assignees, no subtasks: just a name and a rule.
export interface RecurringTemplate {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  tag: TaskTag;
  rrule: string;
  // 'yyyy-MM-dd', like WorkItem.start/end — see taskSync.ts's fromTimestamp.
  createdAt: string;
}

export function templateFromServer(dto: RecurringTaskDto): RecurringTemplate {
  return {
    id: String(dto.recurring_task_id),
    ownerId: dto.owner_id,
    title: dto.title,
    description: dto.description,
    tag: TAG_FROM_BACKEND[dto.task_tag] ?? 'other',
    rrule: dto.rrule,
    createdAt: dto.created_at.slice(0, 10),
  };
}

export function templateToCreatePayload(
  t: Omit<RecurringTemplate, 'id' | 'ownerId' | 'createdAt'>,
): CreateRecurringTaskPayload {
  return {
    title: t.title,
    description: t.description,
    details: {},
    rrule: t.rrule,
    task_tag: BACKEND_TAG[t.tag],
  };
}

export function templateToUpdatePayload(
  t: Omit<RecurringTemplate, 'ownerId' | 'createdAt'>,
): UpdateRecurringTaskPayload {
  return {
    recurring_task_id: Number(t.id),
    title: t.title,
    description: t.description,
    details: {},
    rrule: t.rrule,
    task_tag: BACKEND_TAG[t.tag],
  };
}

const ALL_TAGS: TaskTag[] = [
  'work',
  'important',
  'urgent',
  'optional',
  'personal',
  'other',
];

// POST /recurring/list/{view_id} body — like /tasks/list, an empty tag list
// matches nothing server-side (WHERE task_tag = ANY('{}') is always false), so
// "no filter" means spelling out every tag the view allows, never omitting them.
export function allTemplateTags(
  view: { tagFilter?: TaskTag[] } | undefined,
): BackendTaskTag[] {
  return (view?.tagFilter?.length ? view.tagFilter : ALL_TAGS).map(t => BACKEND_TAG[t]);
}
