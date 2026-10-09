import type { ProjectView } from './types';

// Views are local workspace layout, not server data — the API has no views endpoint.
export const DEFAULT_VIEWS: ProjectView[] = [
  { id: 'v-table', name: 'Table', type: 'table' },
  { id: 'v-team', name: 'Team planning', type: 'team' },
  { id: 'v-calendar', name: 'Calendar', type: 'calendar' },
];
