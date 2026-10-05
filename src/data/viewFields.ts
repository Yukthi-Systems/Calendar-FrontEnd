import type { ViewField, ViewType } from './types';

export const TABLE_FIELDS: { key: ViewField; label: string }[] = [
  { key: 'id', label: 'ID' },
  { key: 'status', label: 'Status' },
  { key: 'assignee', label: 'Assignees' },
  { key: 'priority', label: 'Priority' },
  { key: 'start', label: 'Start date' },
  { key: 'end', label: 'Due date' },
];

// Calendar events are already placed by their dates, so only the per-event
// details are optional here.
export const CALENDAR_FIELDS: { key: ViewField; label: string }[] = [
  { key: 'id', label: 'ID' },
  { key: 'status', label: 'Status colour' },
  { key: 'assignee', label: 'Assignees' },
  { key: 'priority', label: 'Priority' },
];

export const fieldOptionsFor = (type: ViewType) =>
  type === 'table' ? TABLE_FIELDS : type === 'calendar' ? CALENDAR_FIELDS : null;

export const showsField = (fields: ViewField[] | undefined, key: ViewField) =>
  !fields || fields.includes(key);
