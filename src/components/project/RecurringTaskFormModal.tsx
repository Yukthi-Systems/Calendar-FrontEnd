import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useAtom } from 'jotai';
import { allowedTags } from '../../data/constants';
import {
  RRULE_PRESETS,
  RRuleError,
  describeRRule,
  normalizeRRule,
  parseRRule,
} from '../../data/rrule';
import { errorMessage, toast } from '../../atoms/feedback';
import { recurringFormAtom } from '../../atoms/project';
import {
  useRecurringTaskMutations,
  type TemplateDraft,
} from '../../hooks/useRecurringTasks';
import type { RecurringTemplate } from '../../data/recurringTemplate';
import type { ProjectView, TaskTag } from '../../data/types';
import {
  Button,
  Chip,
  DateField,
  Field,
  Input,
  MarkdownEditor,
  Sheet,
  SheetBody,
  SheetFooter,
  SheetHeader,
} from '../ui';

// Canonical text for a rule, or null when it doesn't parse yet (mid-typing).
const safeNormalize = (text: string): string | null => {
  try {
    return normalizeRRule(text);
  } catch {
    return null;
  }
};

// Create/edit one recurring task template: title, tag and a rule — no dates, no
// "doesn't repeat" option (a template's whole point is the rule), no "next
// occurrences" preview (there's no anchor date to count from; see
// services/recurringTasks.ts).
export function RecurringTaskFormModal({
  visible,
  view,
  template,
  onClose,
  onSave,
}: {
  visible: boolean;
  view: ProjectView | undefined;
  // null = creating.
  template: RecurringTemplate | null;
  onClose: () => void;
  onSave: (draft: TemplateDraft) => Promise<void>;
}) {
  const tagOptions = allowedTags(view?.tagFilter);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tag, setTag] = useState<TaskTag>('work');
  const [customText, setCustomText] = useState<string>(RRULE_PRESETS[0].rule);
  const [time, setTime] = useState('');
  // No picker: a new one gets the default, an existing one keeps its own.
  const [icon, setIcon] = useState('repeat');
  const [saving, setSaving] = useState(false);
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setTitle(template?.title ?? '');
    setDescription(template?.description ?? '');
    setTag(template?.tag ?? tagOptions[0]?.key ?? 'work');
    setCustomText(template?.rrule ?? RRULE_PRESETS[0].rule);
    setTime(template?.time ?? '');
    setIcon(template?.icon ?? 'repeat');
    setAttempted(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, template]);

  const rule = (() => {
    try {
      return parseRRule(customText);
    } catch {
      return null;
    }
  })();
  const ruleError = (() => {
    if (!customText.trim()) {
      return 'Pick how often this repeats.';
    }
    try {
      parseRRule(customText);
      return null;
    } catch (err) {
      return err instanceof RRuleError ? err.message : 'Invalid rule';
    }
  })();
  // A rule none of the chips stand for (made before the rule box was hidden) is
  // kept as it is when saving, so it's spelled out rather than looking unset.
  const isPreset = RRULE_PRESETS.some(
    p => p.rule === safeNormalize(customText),
  );
  const titleError = title.trim() ? null : 'Name is required';
  const valid = !titleError && !ruleError;

  const close = () => {
    if (!saving) {
      onClose();
    }
  };

  const save = async () => {
    if (!valid) {
      setAttempted(true);
      return;
    }
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        tag,
        rrule: safeNormalize(customText) ?? customText.trim(),
        time,
        icon,
      });
      close();
    } catch (err) {
      toast.error('Couldn’t save the Recurring Event', {
        description: errorMessage(err, 'Please try again.'),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={close} size="sm" dismissable={!saving}>
      <SheetHeader
        title={template ? 'Edit Recurring Event' : 'New Recurring Event'}
        onClose={close}
      />
      <SheetBody>
        <Field label="Name" required error={attempted ? titleError : null}>
          <Input
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Weekly design review"
            invalid={attempted && !!titleError}
            autoFocus
          />
        </Field>
        <Field label="Description" hint="Optional.">
          <MarkdownEditor
            value={description}
            onChangeText={setDescription}
            placeholder="What this Recurring Event is for"
            minHeight={60}
          />
        </Field>
        <Field label="Tag" required>
          <View className="flex-row flex-wrap gap-1.5">
            {tagOptions.map(t => (
              <Chip
                key={t.key}
                label={t.label}
                color={t.color}
                active={tag === t.key}
                onPress={() => {
                  setTag(t.key);
                  // Only Event occurrences have a time of day — switching
                  // away drops whatever time was picked so it doesn't
                  // silently ride along hidden.
                  if (t.key !== 'event') {
                    setTime('');
                  }
                }}
              />
            ))}
          </View>
        </Field>
        <Field label="Repeats" required error={attempted ? ruleError : null}>
          <View className="flex-row flex-wrap gap-1.5">
            {RRULE_PRESETS.map(p => (
              <Chip
                key={p.rule}
                label={p.label}
                active={safeNormalize(customText) === p.rule}
                onPress={() => setCustomText(p.rule)}
              />
            ))}
          </View>
          {rule && !isPreset ? (
            <Text className="mt-1.5 text-sm text-text-heading">
              {describeRRule(rule)}
            </Text>
          ) : null}
        </Field>
        {tag === 'event' ? (
          <Field label="Time" hint="Optional — what time of day this is for.">
            <View className="w-32">
              <DateField
                mode="time"
                value={time}
                onChange={setTime}
                clearable
                placeholder="Any time"
                accessibilityLabel="Time of day"
              />
            </View>
          </Field>
        ) : null}
      </SheetBody>
      <SheetFooter>
        <Button variant="ghost" onPress={close} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" onPress={save} loading={saving}>
          {template ? 'Save' : 'Create'}
        </Button>
      </SheetFooter>
    </Sheet>
  );
}

// The form as the whole workspace opens it (recurringFormAtom): the Recurring
// tab's rows and buttons, and the navbar's "New" menu on any tab.
export function RecurringFormHost({ view }: { view: ProjectView | undefined }) {
  const [form, setForm] = useAtom(recurringFormAtom);
  const { createTemplate, updateTemplate } = useRecurringTaskMutations(view);
  return (
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
  );
}
