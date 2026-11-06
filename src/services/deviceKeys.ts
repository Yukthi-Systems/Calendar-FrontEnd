// Stored per user id. All that sign-out leaves on the device (clearDeviceData in
// runtime.*.ts): sign-in also resets private_info, so these would otherwise be lost.
// The tips must only ever show twice (see useOnboarding.ts), and the Calendar should
// come back on the layout last picked (see CalendarView.tsx).
export const TIPS_SHOWN_KEY_PREFIX = 'onboarding.tipsShown.';
export const CALENDAR_MODE_KEY_PREFIX = 'calendar.mode.';

export const keptOnSignOut = (key: string) =>
  key.startsWith(TIPS_SHOWN_KEY_PREFIX) ||
  key.startsWith(CALENDAR_MODE_KEY_PREFIX);
