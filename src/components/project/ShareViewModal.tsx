import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Check } from 'lucide-react-native';
import { useAtomValue } from 'jotai';
import { tokenAtom } from '../../atoms/auth';
import { currentUserIdAtom } from '../../atoms/members';
import { directoryAtom } from '../../atoms/userInfo';
import { createSharedTaskView } from '../../services/views';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useUserSearch } from '../../hooks/useUserSearch';
import type { ProjectView } from '../../data/types';
import type { UserSearchResult } from '../../services/types';

// Shares one of the caller's own views with a colleague (POST /shared/create) —
// opened from ViewModal's Share button. Picking a colleague searches GET
// /user/search, same debounced TanStack Query hook as the assignee picker in
// ItemFormModal.
export function ShareViewModal({
  visible,
  view,
  onClose,
}: {
  visible: boolean;
  view: ProjectView | null;
  onClose: () => void;
}) {
  const token = useAtomValue(tokenAtom);
  const currentUserId = useAtomValue(currentUserIdAtom);
  const directory = useAtomValue(directoryAtom);
  const { heading } = useThemeColors();

  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<UserSearchResult | null>(null);
  const [notes, setNotes] = useState('');
  const [canCreate, setCanCreate] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  useUserSearch(query);

  const reset = () => {
    setQuery('');
    setPicked(null);
    setNotes('');
    setCanCreate(false);
    setCanEdit(false);
    setCanDelete(false);
    setSaving(false);
    setError(null);
    setDone(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const search = (text: string) => {
    setQuery(text);
    setPicked(null);
  };

  const matches = directory.filter(
    u =>
      u.user_id !== currentUserId &&
      u.email.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const share = async () => {
    if (!token || !view || !picked) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createSharedTaskView(token, {
        view_id: Number(view.id),
        user_id: picked.user_id,
        share_notes: notes.trim(),
        ui_info: {},
        can_create: canCreate,
        can_edit: canEdit,
        can_delete: canDelete,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not share the view');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable
        accessibilityLabel="Close"
        onPress={close}
        className="flex-1 items-center justify-end bg-black/50 sm:justify-center"
      >
        <Pressable
          onPress={() => {}}
          className="max-h-[92%] w-full max-w-md rounded-t-3xl bg-bg-card p-5 sm:rounded-3xl"
        >
          <Text className="mb-1 text-lg font-bold text-text-heading">
            Share "{view?.name}"
          </Text>

          {done ? (
            <View className="items-center gap-3 py-6">
              <Text className="text-center text-text-heading">
                Shared with {picked?.email}.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={close}
                className="rounded-2xl bg-accent px-5 py-3 active:opacity-80"
              >
                <Text className="font-semibold text-accent-foreground">Done</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text className="mb-3 text-xs text-text-main">
                Only people in your organization can be found.
              </Text>

              <Text className="mb-1 text-xs font-semibold uppercase text-text-main">
                Colleague's email
              </Text>
              <TextInput
                value={query}
                onChangeText={search}
                placeholder="Start typing an email"
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                autoCorrect={false}
                className="mb-2 rounded-xl border border-border-main px-3 py-2.5 text-text-heading"
              />

              {picked ? (
                <View className="mb-4 flex-row items-center justify-between rounded-xl border border-accent/50 bg-accent/10 px-3 py-2.5">
                  <Text className="text-text-heading">{picked.email}</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setPicked(null)}
                  >
                    <Text className="text-xs text-accent">Change</Text>
                  </Pressable>
                </View>
              ) : query.trim().length >= 2 ? (
                <View className="mb-4 max-h-40 gap-1 rounded-xl border border-border-main p-1.5">
                  {matches.length === 0 ? (
                    <Text className="px-2 py-2 text-xs text-text-main">
                      No matches yet — keep typing, or they may not exist in this
                      organization.
                    </Text>
                  ) : (
                    <ScrollView>
                      {matches.map(u => (
                        <Pressable
                          key={u.user_id}
                          accessibilityRole="button"
                          onPress={() => setPicked(u)}
                          className="rounded-lg px-2 py-2 active:opacity-70"
                        >
                          <Text className="text-text-heading">{u.email}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  )}
                </View>
              ) : null}

              <Text className="mb-1 text-xs font-semibold uppercase text-text-main">
                Note (optional)
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Why you're sharing this"
                placeholderTextColor="#9ca3af"
                multiline
                textAlignVertical="top"
                className="mb-4 min-h-[50px] rounded-xl border border-border-main px-3 py-2.5 text-text-heading"
              />

              <Text className="mb-2 text-xs font-semibold uppercase text-text-main">
                Their permissions
              </Text>
              <View className="mb-2 flex-row flex-wrap gap-2">
                {[
                  { label: 'Can create tasks', on: canCreate, set: setCanCreate },
                  { label: 'Can edit tasks', on: canEdit, set: setCanEdit },
                  { label: 'Can delete tasks', on: canDelete, set: setCanDelete },
                ].map(t => (
                  <Pressable
                    key={t.label}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: t.on }}
                    onPress={() => t.set(!t.on)}
                    className={`flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 ${
                      t.on ? 'border-accent bg-accent/10' : 'border-border-main'
                    }`}
                  >
                    {t.on ? <Check size={14} color={heading} /> : null}
                    <Text className="text-sm text-text-heading">{t.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Text className="mb-2 text-xs text-text-main">
                They can always view the view itself and anything it shows.
              </Text>

              {error ? (
                <Text className="mb-2 text-xs text-destructive">{error}</Text>
              ) : null}
            </ScrollView>
          )}

          {!done ? (
            <View className="mt-2 flex-row gap-2">
              <Pressable
                accessibilityRole="button"
                onPress={close}
                className="flex-1 items-center rounded-2xl border border-border-main py-3 active:opacity-70"
              >
                <Text className="text-text-heading">Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={!picked || saving}
                onPress={share}
                className={`flex-1 items-center rounded-2xl bg-accent py-3 active:opacity-80 ${
                  picked && !saving ? '' : 'opacity-40'
                }`}
              >
                {saving ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text className="font-semibold text-accent-foreground">Share</Text>
                )}
              </Pressable>
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
