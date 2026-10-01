import notifee, {
  AndroidImportance,
  AuthorizationStatus,
  TriggerType,
} from '@notifee/react-native';
import type { WorkItem } from '../data/types';
import { nextReminderTrigger } from '../data/recurrence';

// Native (iOS/Android): real OS-level local notifications via Notifee — these
// fire even if the app is backgrounded or closed. Web counterpart
// (notifications.web.ts) can only fire while its tab stays open; this is the
// platform that actually delivers on the "Local Notifications" requirement.

const CHANNEL_ID = 'ytc-reminders';

// How many of a recurring reminder's future occurrences to pre-schedule at
// once. Rescheduling only happens when `scheduleAllReminders` runs again (on
// boot, and whenever the item list changes), so without this lookahead a
// reminder on a recurring task would stop firing after its first occurrence
// if the app isn't reopened in between.
const LOOKAHEAD_OCCURRENCES = 6;

let channelReady: Promise<void> | null = null;

function ensureChannel(): Promise<void> {
  if (!channelReady) {
    channelReady = notifee
      .createChannel({
        id: CHANNEL_ID,
        name: 'Task reminders',
        importance: AndroidImportance.HIGH,
      })
      .then(() => undefined);
  }
  return channelReady;
}

export async function requestNotificationPermission(): Promise<boolean> {
  const settings = await notifee.requestPermission();
  return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
}

function reminderLabel(offsetDays: number): string {
  return offsetDays === 0
    ? 'Due today'
    : `Due in ${offsetDays} day${offsetDays === 1 ? '' : 's'}`;
}

export async function scheduleAllReminders(items: WorkItem[]): Promise<void> {
  await ensureChannel();
  // Cancelling and recreating everything on every call is simplest and cheap
  // enough at this scale — there's no partial-diff bookkeeping to keep in
  // sync when a task's reminders/recurrence/dates change or a task is deleted.
  await notifee.cancelTriggerNotifications();

  for (const item of items) {
    for (const reminder of item.reminders ?? []) {
      let from = new Date();
      for (let i = 0; i < LOOKAHEAD_OCCURRENCES; i++) {
        const trigger = nextReminderTrigger(item, reminder, from);
        if (!trigger) break;
        await notifee.createTriggerNotification(
          {
            id: `${item.id}:${reminder.id}:${trigger.getTime()}`,
            title: item.title,
            body: reminderLabel(reminder.offsetDays),
            android: { channelId: CHANNEL_ID },
          },
          { type: TriggerType.TIMESTAMP, timestamp: trigger.getTime() },
        );
        // Next loop iteration looks past this occurrence for the recurring
        // task's following one; a non-recurring task's second call finds
        // nothing and the inner loop exits via the `!trigger` check above.
        from = new Date(trigger.getTime() + 1);
      }
    }
  }
}
