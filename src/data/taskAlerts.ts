// Pure helpers for Task Alerts — the server's own create/edit rule
// (Tasks-Main-API's CreateTaskAlertDto::validate / EditTaskAlertDto::validate:
// "alert time must be at least 5 minutes from now"), mirrored here so the UI
// can refuse instantly instead of round-tripping to find out, plus the
// "editing a past alert is pointless" rule for a sent/past one.

export const MIN_LEAD_MINUTES = 5;

// A fresh Date each call (not a module-level constant) — this is checked
// live as someone picks a date/time, not once at form-open.
const minAlertAt = (): Date =>
  new Date(Date.now() + MIN_LEAD_MINUTES * 60 * 1000);

// For validating a date+time someone just picked, before it's ever sent.
export const isAlertTimeValid = (alertAt: Date): boolean =>
  alertAt.getTime() > minAlertAt().getTime();

// An existing alert is only worth editing while it's both still in the
// future and not yet sent — editing a fired or past-due one is "no point"
// per spec, even though the server's own rule (new_alert_at 5+ minutes out)
// would catch most of this anyway; this is the softer "don't even offer it"
// UI-side check, on the *current* alert_at, not a replacement value.
export const isAlertEditable = (
  alertAt: string,
  notificationSent: boolean,
): boolean => !notificationSent && new Date(alertAt).getTime() > Date.now();

export const isAlertPast = (alertAt: string): boolean =>
  new Date(alertAt).getTime() <= Date.now();
