import { Text, View } from 'react-native';
import { useSetAtom } from 'jotai';
import { format, parseISO } from 'date-fns';
import {
  Bell,
  Mail,
  Pencil,
  Plus,
  Smartphone,
  Trash2,
} from 'lucide-react-native';
import { alertFormAtom } from '../../atoms/alerts';
import { confirm, errorMessage, toast } from '../../atoms/feedback';
import { isAlertEditable, isAlertPast } from '../../data/taskAlerts';
import { isServerTaskId } from '../../data/taskSync';
import {
  useTaskAlertMutations,
  useTaskAlerts,
} from '../../hooks/useTaskAlerts';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Button, IconButton } from '../ui';

// A task's own alerts — mirrors CommentsSection.tsx's shape (header, rows,
// an add affordance) but each row has its own edit/delete, not just a list.
// Entirely self-scoped (see taskAlerts.ts): these are *your* alerts on this
// task, not something assignees/owner/creator share or see each other's.
export function TaskAlertsSection({
  taskId,
  taskTitle,
}: {
  taskId: string;
  taskTitle: string;
}) {
  const c = useThemeColors();
  const { alerts, isLoading } = useTaskAlerts(taskId);
  const { deleteAlert } = useTaskAlertMutations();
  const setForm = useSetAtom(alertFormAtom);

  const remove = async (alertAt: string) => {
    const ok = await confirm({
      title: 'Delete this alert?',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) {
      return;
    }
    try {
      await deleteAlert({ taskId: Number(taskId), alertAt });
      toast.success('Alert deleted');
    } catch (err) {
      toast.error('Couldn’t delete the alert', {
        description: errorMessage(err, 'Please try again.'),
      });
    }
  };

  const header = (
    <View className="mb-3 flex-row items-center gap-2">
      <Bell size={15} color={c.text} />
      <Text className="text-sm font-semibold text-text-heading">
        Alerts{alerts.length ? ` (${alerts.length})` : ''}
      </Text>
      <View className="flex-1" />
      {isServerTaskId(taskId) ? (
        <Button
          size="sm"
          variant="ghost"
          icon={Plus}
          onPress={() => setForm({ mode: 'new', taskId, taskTitle })}
        >
          Add alert
        </Button>
      ) : null}
    </View>
  );

  if (!isServerTaskId(taskId)) {
    return (
      <View>
        {header}
        <Text className="text-sm text-text-main">
          Save this task before adding alerts.
        </Text>
      </View>
    );
  }

  return (
    <View>
      {header}
      {isLoading ? (
        <Text className="text-sm text-text-main">Loading alerts…</Text>
      ) : alerts.length === 0 ? (
        <Text className="text-sm text-text-main">
          No alerts yet — you’ll only be notified about this task if you add
          one.
        </Text>
      ) : (
        <View className="gap-2">
          {alerts.map(a => {
            const past = isAlertPast(a.alert_at);
            const editable = isAlertEditable(a.alert_at, a.notification_sent);
            return (
              <View
                key={a.alert_at}
                className="flex-row items-center gap-2 rounded-lg border border-border-main px-3 py-2"
              >
                <View className="flex-1">
                  <Text
                    className={`text-sm ${
                      past ? 'text-text-subtle' : 'text-text-heading'
                    }`}
                  >
                    {format(parseISO(a.alert_at), 'EEE, MMM d, yyyy · h:mm a')}
                  </Text>
                  <View className="mt-0.5 flex-row items-center gap-2.5">
                    {a.notify_via_email ? (
                      <View className="flex-row items-center gap-1">
                        <Mail size={11} color={c.subtle} />
                        <Text className="text-2xs text-text-subtle">Email</Text>
                      </View>
                    ) : null}
                    {a.notify_via_push ? (
                      <View className="flex-row items-center gap-1">
                        <Smartphone size={11} color={c.subtle} />
                        <Text className="text-2xs text-text-subtle">Push</Text>
                      </View>
                    ) : null}
                    {a.notification_sent ? (
                      <Text className="text-2xs text-text-subtle">Sent</Text>
                    ) : past ? (
                      <Text className="text-2xs text-text-subtle">Past</Text>
                    ) : null}
                  </View>
                </View>
                {editable ? (
                  <IconButton
                    icon={Pencil}
                    label="Edit alert"
                    size="sm"
                    onPress={() =>
                      setForm({ mode: 'edit', taskId, taskTitle, alert: a })
                    }
                  />
                ) : null}
                <IconButton
                  icon={Trash2}
                  label="Delete alert"
                  size="sm"
                  onPress={() => remove(a.alert_at)}
                />
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
