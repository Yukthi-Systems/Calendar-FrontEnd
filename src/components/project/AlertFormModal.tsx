import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { format, parseISO } from 'date-fns';
import { errorMessage, toast } from '../../atoms/feedback';
import {
  isAlertTimeValid,
  minAlertAt,
  MIN_LEAD_MINUTES,
} from '../../data/taskAlerts';
import type { AlertFormState } from '../../atoms/alerts';
import {
  Button,
  DateField,
  Field,
  Sheet,
  SheetBody,
  SheetFooter,
  SheetHeader,
  Switch,
} from '../ui';

const DATE_FMT = 'yyyy-MM-dd';
const TIME_FMT = 'HH:mm';

export interface AlertSaveDraft {
  alertAt: string;
  notifyViaEmail: boolean;
  notifyViaPush: boolean;
}

// Create/edit one alert for a task — an exact date + time (converted to the
// device's local timezone on the way in and out; the server just stores the
// resulting instant, see taskAlerts.ts), and which channels to notify
// through. No "fetch one alert" route exists server-side, so edit always
// carries the full alert it's editing in (see AlertFormState) rather than
// looking anything up by id.
export function AlertFormModal({
  visible,
  form,
  onClose,
  onSave,
}: {
  visible: boolean;
  form: AlertFormState;
  onClose: () => void;
  onSave: (draft: AlertSaveDraft) => Promise<void>;
}) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notifyViaEmail, setNotifyViaEmail] = useState(true);
  const [notifyViaPush, setNotifyViaPush] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (!visible || !form) {
      return;
    }
    if (form.mode === 'edit') {
      const at = parseISO(form.alert.alert_at);
      setDate(format(at, DATE_FMT));
      setTime(format(at, TIME_FMT));
      setNotifyViaEmail(form.alert.notify_via_email);
      setNotifyViaPush(form.alert.notify_via_push);
    } else {
      setDate('');
      setTime('');
      setNotifyViaEmail(true);
      setNotifyViaPush(true);
    }
    setAttempted(false);
  }, [visible, form]);

  const alertAt = date && time ? new Date(`${date}T${time}`) : null;
  const timeError =
    !date || !time
      ? 'Pick a date and time.'
      : !alertAt || !isAlertTimeValid(alertAt)
      ? `Must be at least ${MIN_LEAD_MINUTES} minutes from now.`
      : null;
  const channelError =
    !notifyViaEmail && !notifyViaPush
      ? 'Choose at least one way to be notified.'
      : null;
  const valid = !timeError && !channelError;

  const close = () => {
    if (!saving) {
      onClose();
    }
  };

  const save = async () => {
    if (!valid || !alertAt) {
      setAttempted(true);
      return;
    }
    setSaving(true);
    try {
      await onSave({
        alertAt: alertAt.toISOString(),
        notifyViaEmail,
        notifyViaPush,
      });
      close();
    } catch (err) {
      toast.error('Couldn’t save the alert', {
        description: errorMessage(err, 'Please try again.'),
      });
    } finally {
      setSaving(false);
    }
  };

  const title = form?.mode === 'edit' ? 'Edit alert' : 'New alert';

  return (
    <Sheet visible={visible} onClose={close} size="sm" dismissable={!saving}>
      <SheetHeader
        title={title}
        description={form ? `For “${form.taskTitle}”` : undefined}
        onClose={close}
      />
      <SheetBody>
        <Field
          label="Alert at"
          required
          error={attempted ? timeError : null}
          hint={`At least ${MIN_LEAD_MINUTES} minutes from now.`}
        >
          <View className="flex-row gap-2">
            <View className="flex-1">
              <DateField
                mode="date"
                value={date}
                onChange={setDate}
                min={format(minAlertAt(), DATE_FMT)}
                invalid={attempted && !!timeError}
                placeholder="Date"
                accessibilityLabel="Alert date"
              />
            </View>
            <View className="w-28">
              <DateField
                mode="time"
                value={time}
                onChange={setTime}
                // Earliest allowed date: no point offering a time earlier
                // than the lead-time floor. Any later date: every time is
                // still ahead of it.
                min={
                  date === format(minAlertAt(), DATE_FMT)
                    ? format(minAlertAt(), TIME_FMT)
                    : undefined
                }
                invalid={attempted && !!timeError}
                placeholder="Time"
                accessibilityLabel="Alert time"
              />
            </View>
          </View>
        </Field>
        <Field
          label="Notify me via"
          required
          error={attempted ? channelError : null}
        >
          <View className="rounded-xl border border-border-main px-3 py-1">
            <Switch
              value={notifyViaEmail}
              onChange={setNotifyViaEmail}
              label="Email"
            />
            <View className="border-t border-border-main">
              <Switch
                value={notifyViaPush}
                onChange={setNotifyViaPush}
                label="Push notification"
              />
            </View>
          </View>
        </Field>
        {form?.mode === 'edit' && form.alert.notification_sent ? (
          <Text className="text-xs text-text-subtle">
            This alert already fired — editing it schedules a new one; it
            doesn’t resend the original.
          </Text>
        ) : null}
      </SheetBody>
      <SheetFooter>
        <Button variant="ghost" onPress={close} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" onPress={save} loading={saving}>
          {form?.mode === 'edit' ? 'Save' : 'Create'}
        </Button>
      </SheetFooter>
    </Sheet>
  );
}
