import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { useThemeColors } from '../../hooks/useThemeColors';
import { VIEW_TYPES } from '../../data/constants';
import { fieldOptionsFor } from '../../data/viewFields';
import type { ProjectView, ViewField, ViewType } from '../../data/types';

export interface ViewDraft {
  name: string;
  type: ViewType;
  description: string;
  fields: ViewField[] | undefined;
}

// Add (view === null) or edit a view: name, description, layout, the fields
// shown for Table/Calendar layouts, and — when editing — delete.
export function ViewModal({
  visible,
  view,
  onClose,
  onSave,
  onDelete,
}: {
  visible: boolean;
  view: ProjectView | null;
  onClose: () => void;
  onSave: (draft: ViewDraft) => void;
  onDelete: () => void;
}) {
  const { heading } = useThemeColors();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ViewType>('kanban');
  const [fields, setFields] = useState<ViewField[]>([]);

  useEffect(() => {
    if (visible) {
      const nextType = view?.type ?? 'kanban';
      setName(view?.name ?? '');
      setDescription(view?.description ?? '');
      setType(nextType);
      setFields(view?.fields ?? allFieldKeys(nextType));
    }
  }, [visible, view]);

  const options = fieldOptionsFor(type);
  const trimmed = name.trim();

  const pickType = (next: ViewType) => {
    setType(next);
    setFields(allFieldKeys(next));
  };

  const toggleField = (key: ViewField) =>
    setFields(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key],
    );

  const save = () => {
    const allSelected =
      !!options && options.every(o => fields.includes(o.key));
    onSave({
      name: trimmed,
      type,
      description: description.trim(),
      fields: options && !allSelected ? fields : undefined,
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        accessibilityLabel="Close"
        onPress={onClose}
        className="flex-1 items-center justify-end bg-black/50 sm:justify-center"
      >
        <Pressable
          onPress={() => {}}
          className="max-h-[92%] w-full max-w-lg rounded-t-3xl bg-bg-card p-5 sm:rounded-3xl"
        >
          <Text className="mb-4 text-lg font-bold text-text-heading">
            {view ? 'Edit view' : 'New view'}
          </Text>

          <ScrollView keyboardShouldPersistTaps="handled">
            <Text className="mb-1 text-xs font-semibold uppercase text-text-main">
              Name
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Sprint board"
              placeholderTextColor="#9ca3af"
              className="mb-4 rounded-xl border border-border-main px-3 py-2.5 text-text-heading"
            />

            <Text className="mb-1 text-xs font-semibold uppercase text-text-main">
              Description
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="What this view is for (optional)"
              placeholderTextColor="#9ca3af"
              multiline
              textAlignVertical="top"
              className="mb-4 min-h-[60px] rounded-xl border border-border-main px-3 py-2.5 text-text-heading"
            />

            <Text className="mb-2 text-xs font-semibold uppercase text-text-main">
              Layout
            </Text>
            <View className="mb-5 gap-2">
              {VIEW_TYPES.map(t => {
                const active = t.key === type;
                return (
                  <Pressable
                    key={t.key}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    onPress={() => pickType(t.key)}
                    className={`flex-row items-center gap-3 rounded-xl border px-3 py-2.5 ${
                      active ? 'border-accent bg-accent/10' : 'border-border-main'
                    }`}
                  >
                    <t.icon size={22} color={heading} />
                    <View className="flex-1">
                      <Text className="font-medium text-text-heading">
                        {t.label}
                      </Text>
                      <Text className="text-xs text-text-main">{t.blurb}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {options ? (
              <View className="mb-5">
                <Text className="mb-2 text-xs font-semibold uppercase text-text-main">
                  Fields shown
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {options.map(o => {
                    const on = fields.includes(o.key);
                    return (
                      <Pressable
                        key={o.key}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                        onPress={() => toggleField(o.key)}
                        className={`flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 ${
                          on ? 'border-accent bg-accent/10' : 'border-border-main'
                        }`}
                      >
                        {on ? <Check size={14} color={heading} /> : null}
                        <Text className="text-sm text-text-heading">{o.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text className="mt-2 text-xs text-text-main">
                  The task title is always shown.
                </Text>
              </View>
            ) : null}
          </ScrollView>

          <View className="mt-2 flex-row gap-2">
            {view ? (
              <Pressable
                accessibilityRole="button"
                onPress={onDelete}
                className="items-center rounded-2xl border border-red-500/40 px-4 py-3 active:opacity-70"
              >
                <Text className="font-semibold text-red-500">Delete</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              className="flex-1 items-center rounded-2xl border border-border-main py-3 active:opacity-70"
            >
              <Text className="text-text-heading">Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={!trimmed}
              onPress={save}
              className={`flex-1 items-center rounded-2xl bg-accent py-3 active:opacity-80 ${
                trimmed ? '' : 'opacity-40'
              }`}
            >
              <Text className="font-semibold text-white">
                {view ? 'Save' : 'Create'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const allFieldKeys = (type: ViewType): ViewField[] =>
  (fieldOptionsFor(type) ?? []).map(o => o.key);
