import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useAtom, useSetAtom } from 'jotai';
import { format, parseISO } from 'date-fns';
import {
  CloudOff,
  Pencil,
  Plus,
  Repeat,
  Search,
  SearchX,
  Trash2,
  X,
} from 'lucide-react-native';
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
import { useViewAccess } from '../../hooks/useViews';
import { usePerson } from '../../hooks/useUsers';
import {
  useRecurringTaskMutations,
  useRecurringTasks,
} from '../../hooks/useRecurringTasks';
import { useTone } from '../../hooks/useThemeColors';
import type { RecurringTemplate } from '../../data/recurringTemplate';
import type { ProjectView } from '../../data/types';
import {
  Badge,
  Button,
  EmptyState,
  IconButton,
  Input,
  Press,
  Skeleton,
} from '../ui';
import { Avatar } from './shared';
import { RecurringTaskFormModal } from './RecurringTaskFormModal';
import { RecurringTaskViewModal } from './RecurringTaskViewModal';

// A library of reusable recurrence rules for this view (/recurring) — separate
// from a task's own "Repeats" field, which already covers one task repeating on
// its own; see services/recurringTasks.ts for the distinction. Nothing here
// generates an actual task — the backend has no schedule that turns a template
// into real rows yet, so this is purely the library itself: name it, tag it, set
// its rule, done.
export function RecurringTasksView({
  view,
}: {
  view: ProjectView | undefined;
}) {
  const toneOf = useTone();
  const { templates, isLoading, error, enabled } = useRecurringTasks(view);
  const { createTemplate, updateTemplate, deleteTemplate } =
    useRecurringTaskMutations(view);
  const { canCreate, canEdit, canDelete } = useViewAccess(view);
  // Global, not local: the navbar's "New template" (ProjectScreen) opens this
  // same modal, not just the rows/empty-state here.
  const [form, setForm] = useAtom(recurringFormAtom);
  // Same idea: a row click opens RecurringTaskViewModal, which is where
  // Edit/Delete actually live (ItemModal/ItemFormModal's split, for templates).
  const setSelectedId = useSetAtom(selectedTemplateIdAtom);
  const setItemForm = useSetAtom(itemFormAtom);
  // Client-side, not server-side: /recurring/list takes only a tag list, no title
  // filter (unlike /tasks/list) — and a view's whole template library is one small
  // list fetched in one shot anyway, so filtering what's already loaded is enough.
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const visible = q
    ? templates.filter(
        t =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q),
      )
    : templates;

  if (!view) {
    return (
      <EmptyState
        icon={Repeat}
        title="Open a view"
        description="Pick a view to see its recurring templates."
      />
    );
  }
  if (view.showRecurring === false) {
    return (
      <EmptyState
        icon={Repeat}
        title="Recurring templates are off for this view"
        description={
          view.shared
            ? 'Ask the view’s owner to turn them on.'
            : 'Turn them on from the view’s Edit menu.'
        }
      />
    );
  }

  const remove = async (t: RecurringTemplate) => {
    const ok = await confirm({
      title: `Delete “${t.title}”?`,
      message:
        'This only removes the template — it won’t touch any tasks already made from it.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) {
      return;
    }
    try {
      await deleteTemplate(t);
      toast.success('Template deleted');
    } catch (err) {
      toast.error('Couldn’t delete the template', {
        description: errorMessage(err, 'Please try again.'),
      });
    }
  };

  return (
    <View className="flex-1">
      <ScrollView contentContainerClassName="px-4 pb-10 pt-4 lg:px-6">
        <Text className="mb-3 text-sm text-text-subtle">
          {templates.length === 0
            ? 'No templates yet'
            : q
            ? `${visible.length} of ${templates.length} template${
                templates.length === 1 ? '' : 's'
              }`
            : `${templates.length} template${
                templates.length === 1 ? '' : 's'
              }`}
        </Text>

        {templates.length > 0 ? (
          <View className="mb-4">
            <Input
              icon={Search}
              value={query}
              onChangeText={setQuery}
              placeholder="Search templates by name…"
              right={
                query ? (
                  <IconButton
                    icon={X}
                    label="Clear search"
                    size="sm"
                    onPress={() => setQuery('')}
                  />
                ) : undefined
              }
            />
          </View>
        ) : null}

        {isLoading ? (
          <View className="gap-2">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </View>
        ) : error ? (
          <EmptyState
            icon={CloudOff}
            title="Couldn’t load templates"
            description={errorMessage(error, 'The server didn’t respond.')}
          />
        ) : !enabled ? (
          <EmptyState icon={Repeat} title="This view isn’t synced yet" />
        ) : templates.length === 0 ? (
          <EmptyState
            icon={Repeat}
            title="No recurring templates"
            description="A template is a reusable rule — name, tag and an RFC 5545 schedule — for the kind of thing that repeats."
            action={
              canCreate ? (
                <Button
                  variant="primary"
                  icon={Plus}
                  onPress={() => setForm({ mode: 'new' })}
                >
                  New template
                </Button>
              ) : undefined
            }
          />
        ) : visible.length === 0 ? (
          <EmptyState
            compact
            icon={SearchX}
            title="No matching templates"
            description="Try another name."
          />
        ) : (
          <View className="gap-2">
            {visible.map(t => {
              const tone = toneOf(rruleColor(t.rrule));
              const Icon = recurringIcon(t.icon);
              // No anchor date (see recurringTemplate.ts), so "next" counts
              // forward from today — null once the rule has already run out
              // (a past UNTIL/COUNT).
              const next = nextOccurrence(t.rrule, parseISO(t.createdAt));
              return (
                <Press
                  key={t.id}
                  feedback="subtle"
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${t.title}`}
                  onPress={() => setSelectedId(t.id)}
                  className="flex-row items-center gap-3 rounded-xl border border-border-main bg-bg-card px-3.5 py-3"
                >
                  <View
                    style={{ backgroundColor: tone.bg }}
                    className="h-9 w-9 items-center justify-center rounded-lg"
                  >
                    <Icon size={16} color={tone.fg} />
                  </View>
                  <View className="flex-1">
                    <Text
                      numberOfLines={1}
                      className="text-sm font-medium text-text-heading"
                    >
                      {t.title}
                    </Text>
                    <Text
                      numberOfLines={1}
                      className="text-xs text-text-subtle"
                    >
                      {describeRecurrence(t.rrule) || t.rrule}
                      {t.time ? ` at ${t.time}` : ''}
                      {next ? ` · Next ${format(next, 'MMM d')}` : ''} · Created{' '}
                      {format(parseISO(t.createdAt), 'MMM d')}
                    </Text>
                  </View>
                  <OwnerCell id={t.ownerId} />
                  <View className="self-center">
                    <Badge
                      label={tagInfo(t.tag).label}
                      color={tagInfo(t.tag).color}
                    />
                  </View>
                  {canCreate ? (
                    <IconButton
                      icon={Plus}
                      label={`Create task from ${t.title}`}
                      size="sm"
                      onPress={() =>
                        setItemForm({
                          mode: 'new',
                          start: format(next ?? new Date(), 'yyyy-MM-dd'),
                          fromTemplate: templateFormPrefill(t),
                        })
                      }
                    />
                  ) : null}
                  {canEdit ? (
                    <IconButton
                      icon={Pencil}
                      label={`Edit ${t.title}`}
                      size="sm"
                      onPress={() => setForm({ mode: 'edit', template: t })}
                    />
                  ) : null}
                  {canDelete ? (
                    <IconButton
                      icon={Trash2}
                      label={`Delete ${t.title}`}
                      size="sm"
                      onPress={() => remove(t)}
                    />
                  ) : null}
                </Press>
              );
            })}
          </View>
        )}
      </ScrollView>

      <RecurringTaskFormModal
        visible={!!form}
        view={view}
        template={form?.mode === 'edit' ? form.template : null}
        onClose={() => setForm(null)}
        onSave={async draft => {
          if (form?.mode === 'edit') {
            await updateTemplate({ id: form.template.id, ...draft });
          } else {
            await createTemplate(draft);
          }
          setForm(null);
        }}
      />
      <RecurringTaskViewModal />
    </View>
  );
}

// Owner avatar + name for a row — recurring_tasks has no separate creator
// column (unlike tasks), just owner_id, so this is the one identity shown.
function OwnerCell({ id }: { id: string }) {
  const person = usePerson(id);
  return (
    <View className="hidden w-[108px] flex-row items-center gap-1.5 self-center sm:flex">
      <Avatar id={id} size={18} />
      <Text numberOfLines={1} className="flex-1 text-xs text-text-subtle">
        {person?.name ?? '…'}
      </Text>
    </View>
  );
}
