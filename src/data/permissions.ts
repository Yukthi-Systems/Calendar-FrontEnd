import type { Comment, WorkItem } from './types';

// Permission rules (from the brief):
//   - Anyone can assign people, edit a task's fields, and create subtasks.
//   - The creator can delete the task; an assignee who isn't the creator cannot.
//   - An assignee who isn't the creator is limited to: comments, status
//     updates, and subtask CRUD — not the task's other fields.
//   - Anyone can add themselves as an assignee, but can never remove
//     themselves — only someone else can.
//   - A comment can only be edited or deleted by whoever posted it.

export type Role = 'creator' | 'assignee' | 'other';

export const roleFor = (item: WorkItem, userId: string): Role => {
  if (item.createdById === userId) {
    return 'creator';
  }
  if (item.assigneeIds.includes(userId)) {
    return 'assignee';
  }
  return 'other';
};

// False only for an assignee who isn't also the creator — everyone else
// (the creator, or someone with no stake in the task at all) can edit it.
export const canEditFields = (item: WorkItem, userId: string) =>
  roleFor(item, userId) !== 'assignee';

export const canDelete = (item: WorkItem, userId: string) =>
  roleFor(item, userId) === 'creator';

// Status, comments and subtask creation are open to everyone regardless of
// role — named here mainly so call sites read like the rule they implement.
export const canChangeStatus = (_item: WorkItem, _userId: string) => true;
export const canComment = (_item: WorkItem, _userId: string) => true;
export const canCreateSubtask = (_item: WorkItem, _userId: string) => true;

// You can remove any assignee except yourself.
export const canRemoveAssignee = (candidateId: string, userId: string) =>
  candidateId !== userId;

export const canEditComment = (comment: Comment, userId: string) =>
  comment.authorId === userId;

export const canDeleteComment = (comment: Comment, userId: string) =>
  comment.authorId === userId;
