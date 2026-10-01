import { getDefaultStore } from 'jotai';
import { itemsAtom } from '../atoms/project';
import { requestNotificationPermission, scheduleAllReminders } from './notifications';

// Boots the reminder system: asks for notification permission once, then
// keeps scheduled reminders in step with the item list for as long as the
// app runs. The actual scheduling mechanics (and how much they can promise)
// differ per platform — see notifications.native.ts vs notifications.web.ts.
//
// Permission denial isn't treated as an error: reminders just silently don't
// fire, same as a user who's turned off notifications for any other app.

const store = getDefaultStore();
let subscribed = false;

export const bootNotifications = async () => {
  await requestNotificationPermission();
  await scheduleAllReminders(store.get(itemsAtom));
  if (!subscribed) {
    subscribed = true;
    store.sub(itemsAtom, () => {
      scheduleAllReminders(store.get(itemsAtom));
    });
  }
};
