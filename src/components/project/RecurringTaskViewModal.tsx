import { Text, View } from 'react-native';
import { useAtom, useSetAtom } from 'jotai';
import { format, parseISO } from 'date-fns';
import Clock from 'lucide-react-native/icons/clock';
import Pencil from 'lucide-react-native/icons/pencil';
import Repeat from 'lucide-react-native/icons/repeat';
import Trash2 from 'lucide-react-native/icons/trash';
import { itemFormAtom, selectedTemplateIdAtom } from '../../atoms/project';
import { confirm, errorMessage, toast } from '../../atoms/feedback';
import { tagInfo } from '../../data/constants';
import {
  describeRecurrence,
  nextOccurrence,
  rruleColor,
} from '../../data/rrule';
import { recurringIcon } from '../../data/recurringIcons';
import { templateFormPrefill } from '../../data/recurringOccurrences';
import { useActiveView, useViewAccess } from '../../hooks/useViews';
import {
  useRecurringTaskMutations,
  useRecurringTasks,
} from '../../hooks/useRecurringTasks';
import { useThemeColors, useTone } from '../../hooks/useThemeColors';
import { Badge, IconButton, Sheet, SheetBody, SheetHeader } from '../ui';
import { PersonRow, Property } from './shared';

const DATE_FMT = 'yyyy-MM-dd';

// Detail sheet for one recurring event, opened from RecurringTasksView's
// rows — read-only plus Create/Delete. Editing the event's own definition
// (title, rule, tag…) isn't offered here — that stays on the row's own
// pencil icon in the list (RecurringTasksView, via recurringFormAtom), so
// this sheet's actions only ever turn the event into a task or remove the
// event itself, never something that merely looks like editing one.
export function RecurringTaskViewModal() {
  const c = useThemeColors();
  const toneOf = useTone();
  const [selectedId, setSelectedId] = useAtom(selectedTemplateIdAtom);
  const setItemForm = useSetAtom(itemFormAtom);
  const view = useActiveView();
  const { templates } = useRecurringTasks(view);
  const { deleteTemplate } = useRecurringTaskMutations(view);
  const { canCreate, canDelete } = useViewAccess(view);
  const template = templates.find(t => t.id === selectedId);
  const close = () => setSelectedId(null);
  const tone = template ? toneOf(rruleColor(template.rrule)) : null;
  const Icon = template ? recurringIcon(template.icon) : Repeat;
  // No anchor date (see recurringTemplate.ts), so "next" counts forward from
  // today — null once the rule has already run out (a past UNTIL/COUNT).
  const next = template
    ? nextOccurrence(template.rrule, parseISO(template.createdAt))
    : null;

  // The schema's own comment: a template only ever becomes a real task
  // through the UI explicitly making one, never on its own — so this just
  // opens the normal "new task" form, prefilled, on the next (or today's)
  // date. The result is a plain task from then on, same as creating one any
  // other way; nothing ties it back to the template afterward.
  const createTask = () => {
    if (!template) {
      return;
    }
    setItemForm({
      mode: 'new',
      start: format(next ?? new Date(), DATE_FMT),
      fromTemplate: templateFormPrefill(template),
    });
    close();
  };

  const remove = async () => {
    if (!template) {
      return;
    }
    const ok = await confirm({
      title: `Delete “${template.title}”?`,
      message:
        'This only removes the event — it won’t touch any tasks already made from it.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) {
      return;
    }
    try {
      await deleteTemplate(template);
      close();
      toast.success('Event deleted');
    } catch (err) {
      toast.error('Couldn’t delete the event', {
        description: errorMessage(err, 'Please try again.'),
      });
    }
  };

  return (
    <Sheet visible={!!template} onClose={close} size="lg">
      {template ? (
        <>
          <SheetHeader
            onClose={close}
            title={
              <Text className="text-xl font-semibold text-text-heading">
                {template.title}
              </Text>
            }
            actions={
              <>
                {canCreate ? (
                  <IconButton
                    icon={Pencil}
                    label="Create task"
                    onPress={createTask}
                  />
                ) : null}
                {canDelete ? (
                  <IconButton
                    icon={Trash2}
                    label="Delete event"
                    color={c.destructive}
                    onPress={remove}
                  />
                ) : null}
              </>
            }
          />
          <SheetBody>
            {template.description ? (
              <Text className="mb-5 text-base text-text-main">
                {template.description}
              </Text>
            ) : null}
            <View className="mb-6 rounded-xl border border-border-main">
              <Property label="ID" first>
                <Text className="text-sm text-text-heading">{template.id}</Text>
              </Property>
              <Property label="Tag">
                <Badge
                  label={tagInfo(template.tag).label}
                  color={tagInfo(template.tag).color}
                  dot
                />
              </Property>
              <Property label="Repeats">
                <View className="flex-row items-center gap-1.5">
                  <Icon size={13} color={tone?.fg ?? c.text} />
                  <Text className="text-sm text-text-heading">
                    {describeRecurrence(template.rrule) || template.rrule}
                  </Text>
                </View>
              </Property>
              <Property label="RRULE">
                <Text selectable className="flex-1 text-xs text-text-subtle">
                  {template.rrule}
                </Text>
              </Property>
              <Property label="Next">
                <Text className="text-sm text-text-heading">
                  {next
                    ? `${format(next, 'EEE, MMM d, yyyy')}${
                        template.time ? ` · ${template.time}` : ''
                      }`
                    : 'No upcoming date'}
                </Text>
              </Property>
              {template.time ? (
                <Property label="Time">
                  <View className="flex-row items-center gap-1.5">
                    <Clock size={13} color={c.text} />
                    <Text className="text-sm text-text-heading">
                      {template.time}
                    </Text>
                  </View>
                </Property>
              ) : null}
              {/* No separate creator column on recurring_tasks — owner is the only identity. */}
              <Property label="Owner">
                <PersonRow id={template.ownerId} />
              </Property>
              <Property label="Created">
                <Text className="text-sm text-text-heading">
                  {format(parseISO(template.createdAt), 'MMM d, yyyy')}
                </Text>
              </Property>
            </View>
          </SheetBody>
        </>
      ) : null}
    </Sheet>
  );
}
