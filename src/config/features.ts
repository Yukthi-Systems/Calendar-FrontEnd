// When false: no SSO auto-login, no login screen, no SSO modal, and the app opens
// straight into the main view.
export const SSO_ENABLED = true;

// GET /tasks/list/{view_id} used to read any_of_task_status/any_of_task_tag as
// Vec<TaskStatus>/Vec<TaskTag> via actix's web::Query (backed by
// serde_urlencoded, which has no support for array query parameters in any
// encoding) — every call 400'd with "invalid type: string …, expected a
// sequence", which blocked every task action that needs a real task id
// (viewing, editing, deleting, or even just confirming one just created). Fixed
// server-side by moving that route to POST with the filter as a JSON body
// instead (see src/services/tasks.ts's listTasks) — on now that it works.
//
// GET /recurring/list/{view_id} has the same shape (a bare
// web::Query<Vec<TaskTag>>, no wrapping struct) and is NOT fixed — nothing in
// the UI calls it yet (src/services/recurringTasks.ts has wrappers only, no
// screen), so it doesn't block anything here, but don't assume it works.
//
// src/hooks/useTasksSync.ts and useTaskMutations.ts both read this.
export const TASKS_API_ENABLED = true;
