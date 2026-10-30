import type { ViewField, ViewType } from './types';

// defaultOn: whether a brand-new view (or an existing one with no explicit
// field filter) starts with this field checked in the "Fields shown" form —
// see allFieldKeys in ViewModal.tsx. The original five stay on by default;
// the rest are opt-in so existing/new views don't suddenly grow columns.
//
// Order: Task ID first (it isn't on the creation form at all, but it's the
// row's identity), then Status/Tag/Assignees, then Creator/Owner (who's on
// the task), then Start/Due, then Created/Last updated.
export const TABLE_FIELDS: {
  key: ViewField;
  label: string;
  defaultOn: boolean;
}[] = [
  { key: 'taskId', label: 'Task ID', defaultOn: false },
  { key: 'status', label: 'Status', defaultOn: true },
  { key: 'tag', label: 'Tag', defaultOn: false },
  { key: 'assignee', label: 'Assignees', defaultOn: true },
  { key: 'creator', label: 'Creator', defaultOn: true },
  { key: 'owner', label: 'Owner', defaultOn: true },
  { key: 'start', label: 'Start date', defaultOn: false },
  { key: 'end', label: 'Due date', defaultOn: true },
  { key: 'created', label: 'Created', defaultOn: false },
  { key: 'updated', label: 'Last updated', defaultOn: false },
];

// Calendar events are already placed by their dates, so only the per-event
// details are optional here.
export const CALENDAR_FIELDS: {
  key: ViewField;
  label: string;
  defaultOn: boolean;
}[] = [
  { key: 'status', label: 'Status colour', defaultOn: true },
  { key: 'assignee', label: 'Assignees', defaultOn: true },
];

export const fieldOptionsFor = (type: ViewType) =>
  type === 'table'
    ? TABLE_FIELDS
    : type === 'calendar'
    ? CALENDAR_FIELDS
    : null;

export const showsField = (fields: ViewField[] | undefined, key: ViewField) =>
  !fields || fields.includes(key);
