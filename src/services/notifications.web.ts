import type { WorkItem } from '../data/types';
import { nextReminderTrigger } from '../data/recurrence';

// Web: the browser Notification API, fired via setTimeout. Unlike the native
// build (notifications.native.ts, via Notifee), there's no service worker
// here, so this can only fire while the tab stays open — closing or even
// backgrounding the tab in some browsers stops it. That's a real platform
// limitation to disclose, not a bug to work around.

// setTimeout can't reliably hold a delay longer than ~24 days (browsers clamp
// or overflow above 2^31ms), so only reminders inside this window get a live
// timer. The periodic recheck below re-scans on this same cadence to pick up
// whatever has newly come into range.
const RECHECK_MS = 60 * 60 * 1000; // 1 hour

let timers: ReturnType<typeof setTimeout>[] = [];
let rescheduleTimer: ReturnType<typeof setInterval> | null = null;
let latestItems: WorkItem[] = [];

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') {
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  if (Notification.permission === 'denied') {
    return false;
  }
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function reminderLabel(offsetDays: number): string {
  return offsetDays === 0
    ? 'Due today'
    : `Due in ${offsetDays} day${offsetDays === 1 ? '' : 's'}`;
}

function fire(item: WorkItem, offsetDays: number) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return;
  }
  // `tag` lets a second schedule pass for the same reminder replace rather
  // than duplicate a still-pending browser notification.
  // eslint-disable-next-line no-new -- the constructor call itself is the display call
  new Notification(item.title, { body: reminderLabel(offsetDays), tag: item.id });
}

function scheduleWithinWindow(items: WorkItem[]) {
  timers.forEach(clearTimeout);
  timers = [];
  const now = new Date();
  for (const item of items) {
    for (const reminder of item.reminders ?? []) {
      const trigger = nextReminderTrigger(item, reminder, now);
      if (!trigger) {
        continue;
      }
      const delay = trigger.getTime() - now.getTime();
      if (delay <= RECHECK_MS) {
        timers.push(setTimeout(() => fire(item, reminder.offsetDays), Math.max(delay, 0)));
      }
    }
  }
}

export async function scheduleAllReminders(items: WorkItem[]): Promise<void> {
  latestItems = items;
  scheduleWithinWindow(latestItems);
  if (!rescheduleTimer) {
    rescheduleTimer = setInterval(() => scheduleWithinWindow(latestItems), RECHECK_MS);
  }
}
