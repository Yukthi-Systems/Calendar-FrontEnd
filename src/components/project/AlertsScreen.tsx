import { ScrollView, Text, View } from 'react-native';
import { useAtomValue, useSetAtom } from 'jotai';
import { format, parseISO } from 'date-fns';
import {
  Bell,
  CloudOff,
  Mail,
  Pencil,
  Smartphone,
  Trash2,
} from 'lucide-react-native';
import { itemsAtom, selectedItemIdAtom } from '../../atoms/project';
import { alertFormAtom } from '../../atoms/alerts';
import { confirm, errorMessage, toast } from '../../atoms/feedback';
import { isAlertEditable, isAlertPast } from '../../data/taskAlerts';
import {
  useAllTaskAlerts,
  useTaskAlertMutations,
} from '../../hooks/useTaskAlerts';
import { useThemeColors } from '../../hooks/useThemeColors';
import { EmptyState, IconButton, Press, Skeleton } from '../ui';
import type { TaskAlertDto } from '../../services/types';

// Every alert across every task, for the left-menu "Alerts" entry — this is
// deliberately not scoped to the active view (alerts have nothing to do
// with views; see taskAlerts.ts). The server doesn't join in a task's
// title/tag (list-all-alerts' own row shape is just the raw task_alerts
// columns), so a title only shows up here when that task happens to already
// be loaded from whatever view was last open — otherwise it's "Task #<id>",
// honestly, rather than pretending to know more than the API gives us.
export function AlertsScreen() {
  const items = useAtomValue(itemsAtom);
  const select = useSetAtom(selectedItemIdAtom);
  const setForm = useSetAtom(alertFormAtom);
  const { alerts, isLoading, error } = useAllTaskAlerts();
  const { deleteAlert } = useTaskAlertMutations();

  const titleFor = (taskId: number) =>
    items.find(i => i.id === String(taskId))?.title;

  const remove = async (a: TaskAlertDto) => {
    const ok = await confirm({
      title: 'Delete this alert?',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) {
      return;
    }
    try {
      await deleteAlert({ taskId: a.task_id, alertAt: a.alert_at });
      toast.success('Alert deleted');
    } catch (err) {
      toast.error('Couldn’t delete the alert', {
        description: errorMessage(err, 'Please try again.'),
      });
    }
  };

  const upcoming = alerts.filter(a => !isAlertPast(a.alert_at));
  const past = alerts.filter(a => isAlertPast(a.alert_at));

  if (isLoading) {
    return (
      <View className="flex-1 gap-2 p-6">
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </View>
    );
  }
  if (error) {
    return (
      <EmptyState
        icon={CloudOff}
        title="Couldn’t load your alerts"
        description={errorMessage(error, 'The server didn’t respond.')}
      />
    );
  }
  if (alerts.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="No alerts yet"
        description="Add one from any task’s detail view — you’ll be notified by email, push, or both, at an exact time you choose."
      />
    );
  }

  return (
    <ScrollView contentContainerClassName="gap-6 px-4 pb-10 pt-4 lg:px-6">
      {upcoming.length > 0 ? (
        <AlertGroup
          label="Upcoming"
          alerts={upcoming}
          titleFor={titleFor}
          onOpenTask={id => select(id)}
          onEdit={(a, taskTitle) =>
            setForm({
              mode: 'edit',
              taskId: String(a.task_id),
              taskTitle,
              alert: a,
            })
          }
          onDelete={remove}
        />
      ) : null}
      {past.length > 0 ? (
        <AlertGroup
          label="Past"
          alerts={past}
          titleFor={titleFor}
          onOpenTask={id => select(id)}
          onEdit={(a, taskTitle) =>
            setForm({
              mode: 'edit',
              taskId: String(a.task_id),
              taskTitle,
              alert: a,
            })
          }
          onDelete={remove}
        />
      ) : null}
    </ScrollView>
  );
}

function AlertGroup({
  label,
  alerts,
  titleFor,
  onOpenTask,
  onEdit,
  onDelete,
}: {
  label: string;
  alerts: TaskAlertDto[];
  titleFor: (taskId: number) => string | undefined;
  onOpenTask: (id: string) => void;
  onEdit: (alert: TaskAlertDto, taskTitle: string) => void;
  onDelete: (alert: TaskAlertDto) => void;
}) {
  const c = useThemeColors();
  return (
    <View>
      <Text className="mb-2 px-1 text-2xs font-semibold uppercase tracking-wider text-text-subtle">
        {label}
      </Text>
      <View className="gap-2">
        {alerts.map(a => {
          const title = titleFor(a.task_id);
          const editable = isAlertEditable(a.alert_at, a.notification_sent);
          return (
            <View
              key={`${a.task_id}:${a.alert_at}`}
              className="flex-row items-center gap-3 rounded-xl border border-border-main bg-bg-card px-3.5 py-3"
            >
              <View className="flex-1">
                <Press
                  feedback="none"
                  disabled={!title}
                  accessibilityRole={title ? 'button' : undefined}
                  accessibilityLabel={title ? `Open ${title}` : undefined}
                  onPress={() => onOpenTask(String(a.task_id))}
                >
                  <Text
                    numberOfLines={1}
                    className={`text-sm font-medium ${
                      title ? 'text-accent' : 'text-text-heading'
                    }`}
                  >
                    {title ?? `Task #${a.task_id}`}
                  </Text>
                </Press>
                <Text className="mt-0.5 text-sm text-text-heading">
                  {format(parseISO(a.alert_at), 'EEE, MMM d, yyyy · h:mm a')}
                </Text>
                <View className="mt-1 flex-row items-center gap-2.5">
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
                  ) : null}
                </View>
              </View>
              {editable ? (
                <IconButton
                  icon={Pencil}
                  label="Edit alert"
                  size="sm"
                  onPress={() => onEdit(a, title ?? `Task #${a.task_id}`)}
                />
              ) : null}
              <IconButton
                icon={Trash2}
                label="Delete alert"
                size="sm"
                onPress={() => onDelete(a)}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}
