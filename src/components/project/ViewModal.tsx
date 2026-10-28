import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Share2, Trash2 } from 'lucide-react-native';
import { useThemeColors } from '../../hooks/useThemeColors';
import {
  Button,
  Chip,
  Field,
  IconButton,
  Input,
  Press,
  Sheet,
  SheetBody,
  SheetFooter,
  SheetHeader,
  Switch,
} from '../ui';
import { STATUSES, TAGS, VIEW_TYPES } from '../../data/constants';
import { fieldOptionsFor } from '../../data/viewFields';
import type {
  ProjectView,
  Status,
  TaskTag,
  ViewField,
  ViewType,
} from '../../data/types';

const ALL_STATUSES = STATUSES.map(s => s.key);
const ALL_TAGS = TAGS.map(t => t.key);

const filterHint = (picked: number, total: number, one: string, many: string) =>
  picked === total
    ? `Every ${one} is shown.`
    : `Only the selected ${picked === 1 ? one : many} ${
        picked === 1 ? 'is' : 'are'
      } shown.`;

export interface ViewDraft {
  name: string;
  type: ViewType;
  description: string;
  fields: ViewField[] | undefined;
  statusFilter: Status[] | undefined;
  tagFilter: TaskTag[] | undefined;
  showRecurring: boolean;
  showComments: boolean;
  showSubtasks: boolean;
  showAssigned: boolean;
}

// Add (view === null) or edit a view: name, description, layout, the fields
// shown for Table/Calendar layouts, the status/content filters this view
// applies, and — when editing — share and delete.
export function ViewModal({
  visible,
  view,
  initial,
  onClose,
  onSave,
  onDelete,
  onShare,
}: {
  visible: boolean;
  view: ProjectView | null;
  // Starting point for a brand-new view (e.g. the "Create your first view"
  // quick picks) — a name and layout to open the form pre-filled with,
  // instead of either creating it outright or starting from a blank form.
  // Ignored once `view` is set (editing always starts from the view itself).
  initial?: { name?: string; type?: ViewType };
  onClose: () => void;
  onSave: (draft: ViewDraft) => void;
  onDelete: () => void;
  onShare: (view: ProjectView) => void;
}) {
  const c = useThemeColors();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ViewType>('table');
  const [fields, setFields] = useState<ViewField[]>([]);
  const [statusFilter, setStatusFilter] = useState<Status[]>([]);
  const [tagFilter, setTagFilter] = useState<TaskTag[]>([]);
  const [showRecurring, setShowRecurring] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showSubtasks, setShowSubtasks] = useState(true);
  const [showAssigned, setShowAssigned] = useState(false);

  useEffect(() => {
    if (visible) {
      const nextType = view?.type ?? initial?.type ?? 'table';
      setName(view?.name ?? initial?.name ?? '');
      setDescription(view?.description ?? '');
      setType(nextType);
      setFields(view?.fields ?? allFieldKeys(nextType));
      // The server stores "everything" as an empty filter; the form shows it as
      // every chip checked, which is what it means.
      setStatusFilter(
        view?.statusFilter?.length ? view.statusFilter : ALL_STATUSES,
      );
      setTagFilter(view?.tagFilter?.length ? view.tagFilter : ALL_TAGS);
      setShowRecurring(view?.showRecurring ?? false);
      setShowComments(view?.showComments ?? false);
      setShowSubtasks(view?.showSubtasks ?? true);
      setShowAssigned(view?.showAssigned ?? false);
    }
  }, [visible, view, initial]);

  const options = fieldOptionsFor(type);
  const trimmed = name.trim();
  // A filter with nothing checked would show no tasks at all.
  const filtersValid = statusFilter.length > 0 && tagFilter.length > 0;
  const canSave = !!trimmed && filtersValid;

  const pickType = (next: ViewType) => {
    setType(next);
    setFields(allFieldKeys(next));
  };

  const toggleField = (key: ViewField) =>
    setFields(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key],
    );

  const toggleStatus = (key: Status) =>
    setStatusFilter(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key],
    );

  const toggleTag = (key: TaskTag) =>
    setTagFilter(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key],
    );

  // Content toggles mirror Tasks-Main-API's task_views columns (show_recurring/
  // show_comments/show_subtasks/show_assigned) — inert until the /tasks API exists
  // to actually filter by them, but saved now so nothing is lost once it does.
  const visibilityToggles: {
    key: string;
    label: string;
    description?: string;
    on: boolean;
    set: (v: boolean) => void;
  }[] = [
    {
      key: 'recurring',
      label: 'Recurring tasks',
      on: showRecurring,
      set: setShowRecurring,
    },
    {
      key: 'subtasks',
      label: 'Subtasks',
      description:
        'Off: subtasks can’t be listed, added or edited in this view.',
      on: showSubtasks,
      set: setShowSubtasks,
    },
    {
      key: 'assigned',
      label: 'Tasks assigned to me',
      on: showAssigned,
      set: setShowAssigned,
    },
    {
      key: 'comments',
      label: 'Comments',
      on: showComments,
      set: setShowComments,
    },
  ];

  const save = () => {
    const allSelected = !!options && options.every(o => fields.includes(o.key));
    onSave({
      name: trimmed,
      type,
      description: description.trim(),
      fields: options && !allSelected ? fields : undefined,
      // All checked ⇒ no filter (saved as []), so statuses/tags added later are
      // included too. Sent in the canonical order either way.
      statusFilter:
        statusFilter.length < ALL_STATUSES.length
          ? ALL_STATUSES.filter(k => statusFilter.includes(k))
          : undefined,
      tagFilter:
        tagFilter.length < ALL_TAGS.length
          ? ALL_TAGS.filter(k => tagFilter.includes(k))
          : undefined,
      showRecurring,
      showComments,
      showSubtasks,
      showAssigned,
    });
  };

  return (
    <Sheet visible={visible} onClose={onClose} size="lg">
      <SheetHeader
        title={view ? 'Edit view' : 'New view'}
        description={
          view
            ? undefined
            : 'A saved layout of your tasks, with its own filters.'
        }
        onClose={onClose}
      />
      <SheetBody>
        <Field label="Name" required>
          <Input
            value={name}
            onChangeText={setName}
            placeholder="e.g. Sprint board"
            autoFocus={!view}
            onSubmitEditing={() => canSave && save()}
          />
        </Field>
        <Field label="Description">
          <Input
            value={description}
            onChangeText={setDescription}
            placeholder="What this view is for (optional)"
            multiline
            minHeight={56}
          />
        </Field>

        <Field label="Layout">
          <View className="flex-row flex-wrap gap-2">
            {VIEW_TYPES.map(t => {
              const active = t.key === type;
              return (
                <Press
                  key={t.key}
                  feedback="subtle"
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active, checked: active }}
                  onPress={() => pickType(t.key)}
                  // Two per row — the four layouts sit as a 2×2 grid.
                  style={{ flexBasis: '45%', flexGrow: 1 }}
                  className={`gap-2 rounded-xl border p-3 ${
                    active
                      ? 'border-accent bg-accent-soft'
                      : 'border-border-main bg-bg-card hover:border-border-strong hover:bg-hover'
                  }`}
                >
                  <t.icon size={18} color={active ? c.accent : c.text} />
                  <View>
                    <Text className="text-sm font-medium text-text-heading">
                      {t.label}
                    </Text>
                    <Text className="text-xs text-text-main">{t.blurb}</Text>
                  </View>
                </Press>
              );
            })}
          </View>
        </Field>

        {options ? (
          <Field label="Fields shown" hint="The task title is always shown.">
            <View className="flex-row flex-wrap gap-1.5">
              {options.map(o => (
                <Chip
                  key={o.key}
                  role="checkbox"
                  label={o.label}
                  active={fields.includes(o.key)}
                  onPress={() => toggleField(o.key)}
                />
              ))}
            </View>
          </Field>
        ) : null}

        <Field
          label="Status filter"
          hint={filterHint(
            statusFilter.length,
            ALL_STATUSES.length,
            'status',
            'statuses',
          )}
          error={
            statusFilter.length === 0 ? 'Pick at least one status.' : undefined
          }
        >
          <View className="flex-row flex-wrap gap-1.5">
            {STATUSES.map(st => (
              <Chip
                key={st.key}
                role="checkbox"
                label={st.label}
                color={st.color}
                active={statusFilter.includes(st.key)}
                onPress={() => toggleStatus(st.key)}
              />
            ))}
          </View>
        </Field>

        <Field
          label="Tag filter"
          hint={filterHint(tagFilter.length, ALL_TAGS.length, 'tag', 'tags')}
          error={tagFilter.length === 0 ? 'Pick at least one tag.' : undefined}
        >
          <View className="flex-row flex-wrap gap-1.5">
            {TAGS.map(t => (
              <Chip
                key={t.key}
                role="checkbox"
                label={t.label}
                color={t.color}
                active={tagFilter.includes(t.key)}
                onPress={() => toggleTag(t.key)}
              />
            ))}
          </View>
        </Field>

        <Field label="Also show" className="mb-0">
          <View className="rounded-xl border border-border-main px-3 py-1">
            {visibilityToggles.map((t, i) => (
              <View
                key={t.key}
                className={i > 0 ? 'border-t border-border-main' : ''}
              >
                <Switch
                  value={t.on}
                  onChange={t.set}
                  label={t.label}
                  description={t.description}
                />
              </View>
            ))}
          </View>
        </Field>
      </SheetBody>

      <SheetFooter
        left={
          view ? (
            <View className="flex-row items-center gap-1">
              <Button
                variant="destructive-ghost"
                icon={Trash2}
                onPress={onDelete}
              >
                Delete
              </Button>
              {!view.shared ? (
                <IconButton
                  icon={Share2}
                  label={`Share ${view.name}`}
                  onPress={() => onShare(view)}
                />
              ) : null}
            </View>
          ) : null
        }
      >
        <Button variant="ghost" onPress={onClose}>
          Cancel
        </Button>
        <Button variant="primary" disabled={!canSave} onPress={save}>
          {view ? 'Save' : 'Create view'}
        </Button>
      </SheetFooter>
    </Sheet>
  );
}

const allFieldKeys = (type: ViewType): ViewField[] =>
  (fieldOptionsFor(type) ?? []).map(o => o.key);
