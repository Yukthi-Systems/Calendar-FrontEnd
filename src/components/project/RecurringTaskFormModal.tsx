import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { allowedTags } from '../../data/constants';
import {
  RRULE_PRESETS,
  RRuleError,
  describeRRule,
  normalizeRRule,
  parseRRule,
  rruleColor,
} from '../../data/rrule';
import { RECURRING_ICONS } from '../../data/recurringIcons';
import { errorMessage, toast } from '../../atoms/feedback';
import { useThemeColors, useTone } from '../../hooks/useThemeColors';
import type { TemplateDraft } from '../../hooks/useRecurringTasks';
import type { RecurringTemplate } from '../../data/recurringTemplate';
import type { ProjectView, TaskTag } from '../../data/types';
import {
  Button,
  Chip,
  DateField,
  Field,
  Input,
  Press,
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
  const c = useThemeColors();
  const toneOf = useTone();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tag, setTag] = useState<TaskTag>('work');
  const [customText, setCustomText] = useState<string>(RRULE_PRESETS[0].rule);
  const [time, setTime] = useState('');
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
      toast.error('Couldn’t save the event', {
        description: errorMessage(err, 'Please try again.'),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={close} size="sm" dismissable={!saving}>
      <SheetHeader
        title={template ? 'Edit event' : 'New event'}
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
          <Input
            value={description}
            onChangeText={setDescription}
            placeholder="What this event is for"
            multiline
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
                onPress={() => setTag(t.key)}
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
          <View className="mt-2">
            <Input
              value={customText}
              onChangeText={setCustomText}
              placeholder="FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,FR"
              autoCapitalize="characters"
              autoCorrect={false}
              invalid={attempted && !!ruleError}
            />
            <Text className="mt-1 text-xs text-text-subtle">
              RFC 5545 RRULE: FREQ, INTERVAL, COUNT or UNTIL, BYDAY, BYMONTHDAY,
              BYMONTH, BYSETPOS, WKST.
            </Text>
          </View>
          {rule ? (
            <Text className="mt-1.5 text-sm text-text-heading">
              {describeRRule(rule)}
            </Text>
          ) : null}
        </Field>
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
        <Field label="Icon">
          <View className="flex-row flex-wrap gap-1.5">
            {RECURRING_ICONS.map(({ key, icon: Icon, label }) => {
              const active = icon === key;
              const tone = toneOf(rruleColor(customText));
              return (
                <Press
                  key={key}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={label}
                  onPress={() => setIcon(key)}
                  style={
                    active
                      ? { backgroundColor: tone.bg, borderColor: tone.bg }
                      : undefined
                  }
                  className={`h-9 w-9 items-center justify-center rounded-lg border ${
                    active
                      ? ''
                      : 'border-border-main bg-bg-card hover:border-border-strong hover:bg-hover'
                  }`}
                >
                  <Icon size={16} color={active ? tone.fg : c.text} />
                </Press>
              );
            })}
          </View>
        </Field>
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
