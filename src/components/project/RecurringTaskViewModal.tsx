import { Text, View } from 'react-native';
import { useAtom, useSetAtom } from 'jotai';
import { format, parseISO } from 'date-fns';
import { Pencil, Repeat, Trash2 } from 'lucide-react-native';
import { recurringFormAtom, selectedTemplateIdAtom } from '../../atoms/project';
import { confirm, errorMessage, toast } from '../../atoms/feedback';
import { tagInfo } from '../../data/constants';
import { describeRecurrence } from '../../data/rrule';
import { useActiveView, useViewAccess } from '../../hooks/useViews';
import { useRecurringTaskMutations, useRecurringTasks } from '../../hooks/useRecurringTasks';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Badge, IconButton, Sheet, SheetBody, SheetHeader } from '../ui';
import { PersonRow, Property } from './shared';

// Detail sheet for one recurring template, opened from RecurringTasksView's
// rows — same split as ItemModal/ItemFormModal: this is read-only plus
// Edit/Delete, the actual edit form lives in RecurringTaskFormModal
// (recurringFormAtom), opened from here.
export function RecurringTaskViewModal() {
  const c = useThemeColors();
  const [selectedId, setSelectedId] = useAtom(selectedTemplateIdAtom);
  const setForm = useSetAtom(recurringFormAtom);
  const view = useActiveView();
  const { templates } = useRecurringTasks(view);
  const { deleteTemplate } = useRecurringTaskMutations(view);
  const { canEdit, canDelete } = useViewAccess(view);
  const template = templates.find(t => t.id === selectedId);
  const close = () => setSelectedId(null);

  const remove = async () => {
    if (!template) {
      return;
    }
    const ok = await confirm({
      title: `Delete “${template.title}”?`,
      message: 'This only removes the template — it won’t touch any tasks already made from it.',
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
              <Text className="text-xl font-semibold text-text-heading">
                {template.title}
              </Text>
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
              <Text className="mb-5 text-base text-text-main">{template.description}</Text>
            ) : null}
            <View className="rounded-xl border border-border-main">
              <Property label="ID" first>
                <Text className="text-sm text-text-heading">{template.id}</Text>
              </Property>
              <Property label="Tag">
                <Badge label={tagInfo(template.tag).label} color={tagInfo(template.tag).color} dot />
              </Property>
              <Property label="Repeats">
                <View className="flex-row items-center gap-1.5">
                  <Repeat size={13} color={c.text} />
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
