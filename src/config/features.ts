// When false: no SSO auto-login, no login screen, no SSO modal, and the app opens
// straight into the main view.
export const SSO_ENABLED = true;

// Off: GET /tasks/list/{view_id} (and GET /recurring/list/{view_id}, same shape)
// reads any_of_task_status/any_of_task_tag as Vec<TaskStatus>/Vec<TaskTag> via
// actix's web::Query, which is backed by serde_urlencoded — a crate with no
// support for array query parameters in any encoding. Every call 400s with
// "invalid type: string …, expected a sequence", regardless of what the UI
// sends. Every task action that needs an existing task's real id — viewing,
// editing, deleting, selecting it after creating it — ultimately depends on
// that same broken call, directly or (for a freshly created task) via
// addItem's own id-lookup, so all of them stay off here. See
// TASK_CREATE_ENABLED just below for the one piece that doesn't.
// src/hooks/useTasksSync.ts and useTaskMutations.ts both read this. Flip to
// true once GET /tasks/list/{view_id} works.
export const TASKS_API_ENABLED = false;

// On, independently of TASKS_API_ENABLED: POST /tasks/create/{view_id} itself
// is a plain JSON body, not a web::Query call, so it isn't hit by the bug
// above — creating a task actually reaches and is saved by the server right
// now. What doesn't work yet is confirming it: addItem still tries the same
// broken list call afterwards to learn the new task's id and show it, and
// when that fails (which it will, until the fix above lands) it doesn't
// treat that as the create having failed — the task was saved either way —
// it just can't select or display it yet. See addItem's own comment in
// useTaskMutations.ts. Flip off only if POST /tasks/create itself turns out
// to need gating too (e.g. if its own permission checks are found to be broken).
export const TASK_CREATE_ENABLED = true;
