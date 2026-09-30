import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useThemeColors } from '../../hooks/useThemeColors';
import { VIEW_TYPES } from '../../data/constants';
import type { ProjectView, ViewType } from '../../data/types';

// Add (view === null) or edit a view: name, type, and — when editing — delete.
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
  onSave: (name: string, type: ViewType) => void;
  onDelete: () => void;
}) {
  const { heading } = useThemeColors();
  const [name, setName] = useState('');
  const [type, setType] = useState<ViewType>('kanban');

  useEffect(() => {
    if (visible) {
      setName(view?.name ?? '');
      setType(view?.type ?? 'kanban');
    }
  }, [visible, view]);

  const trimmed = name.trim();

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
          className="w-full max-w-lg rounded-t-3xl bg-bg-card p-5 sm:rounded-3xl"
        >
          <Text className="mb-4 text-lg font-bold text-text-heading">
            {view ? 'Edit view' : 'New view'}
          </Text>

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
                  onPress={() => setType(t.key)}
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

          <View className="flex-row gap-2">
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
              onPress={() => onSave(trimmed, type)}
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
