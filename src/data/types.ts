export type Status = 'todo' | 'in_progress' | 'in_review' | 'done';
export type Priority = 'low' | 'medium' | 'high';
export type ViewType = 'table' | 'team' | 'kanban' | 'roadmap' | 'calendar';

export interface Member {
  id: string;
  name: string;
  initials: string;
  color: string;
  role: string;
  // Max number of items this person can carry at once, for the workload bar.
  capacity: number;
}

export interface WorkItem {
  id: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  // Zero or more members; [] means unassigned.
  assigneeIds: string[];
  // Parent task; null for top-level. Nesting is limited to MAX_DEPTH levels.
  parentId: string | null;
  // yyyy-MM-dd
  start: string;
  end: string;
  labels: string[];
}

export interface ProjectView {
  id: string;
  name: string;
  type: ViewType;
}

// Author fields are captured at post time rather than referencing a member id —
// the poster might be the account profile (not one of MEMBERS) or a member who's
// since changed their name/color, and a comment should keep the attribution it
// had when posted either way.
export interface Comment {
  id: string;
  itemId: string;
  authorName: string;
  authorInitials: string;
  authorColor: string;
  text: string;
  // ISO timestamp.
  createdAt: string;
}
