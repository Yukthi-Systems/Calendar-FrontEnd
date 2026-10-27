import { Text, View } from 'react-native';
import { useAtom, useSetAtom } from 'jotai';
import { format, parseISO } from 'date-fns';
import { Clock, Pencil, Plus, Repeat, Trash2 } from 'lucide-react-native';
import {
  itemFormAtom,
  recurringFormAtom,
  selectedTemplateIdAtom,
} from '../../atoms/project';
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
import {
  Badge,
  Button,
  IconButton,
  Sheet,
  SheetBody,
  SheetFooter,
  SheetHeader,
} from '../ui';
import { PersonRow, Property } from './shared';

const DATE_FMT = 'yyyy-MM-dd';

// Detail sheet for one recurring template, opened from RecurringTasksView's
// rows — same split as ItemModal/ItemFormModal: this is read-only plus
// Edit/Delete, the actual edit form lives in RecurringTaskFormModal
// (recurringFormAtom), opened from here.
export function RecurringTaskViewModal() {
  const c = useThemeColors();
  const toneOf = useTone();
  const [selectedId, setSelectedId] = useAtom(selectedTemplateIdAtom);
  const setForm = useSetAtom(recurringFormAtom);
  const setItemForm = useSetAtom(itemFormAtom);
  const view = useActiveView();
  const { templates } = useRecurringTasks(view);
  const { deleteTemplate } = useRecurringTaskMutations(view);
  const { canCreate, canEdit, canDelete } = useViewAccess(view);
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
        'This only removes the template — it won’t touch any tasks already made from it.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) {
      return;
    }
    try {
      await deleteTemplate(template);
      close();
      toast.success('Template deleted');
    } catch (err) {
      toast.error('Couldn’t delete the template', {
        description: errorMessage(err, 'Please try again.'),
      });
    }
  };

  return (
    <Sheet visible={!!template} onClose={close} size="sm">
      {template ? (
        <>
          <SheetHeader
            onClose={close}
            title={
              <View className="flex-row items-center gap-2.5">
                <View
                  style={{ backgroundColor: tone?.bg }}
                  className="h-7 w-7 items-center justify-center rounded-lg"
                >
                  <Icon size={14} color={tone?.fg} />
                </View>
                <Text className="text-xl font-semibold text-text-heading">
                  {template.title}
                </Text>
              </View>
            }
            actions={
              <>
                {canEdit ? (
                  <IconButton
                    icon={Pencil}
                    label="Edit template"
                    onPress={() => {
                      setForm({ mode: 'edit', template });
                      close();
                    }}
                  />
                ) : null}
                {canDelete ? (
                  <IconButton
                    icon={Trash2}
                    label="Delete template"
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
            <View className="rounded-xl border border-border-main">
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
                  <Repeat size={13} color={tone?.fg ?? c.text} />
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
          {canCreate ? (
            <SheetFooter>
              <Button variant="primary" icon={Plus} onPress={createTask}>
                Create task
              </Button>
            </SheetFooter>
          ) : null}
        </>
      ) : null}
    </Sheet>
  );
}
