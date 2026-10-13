import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { CircleCheck, Search } from 'lucide-react-native';
import { useAtomValue } from 'jotai';
import { tokenAtom } from '../../atoms/auth';
import { currentUserIdAtom } from '../../atoms/members';
import { createSharedTaskView } from '../../services/views';
import { withAuthRetry } from '../../services/authRetry';
import { useThemeColors } from '../../hooks/useThemeColors';
import { toast } from '../../atoms/feedback';
import {
  Button,
  Callout,
  Checkbox,
  Field,
  Input,
  Press,
  Sheet,
  SheetBody,
  SheetFooter,
  SheetHeader,
} from '../ui';
import { InitialsAvatar } from './shared';
import { useUserSearch, type Person } from '../../hooks/useUsers';
import type { ProjectView } from '../../data/types';

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
  const c = useThemeColors();

  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Person | null>(null);
  const [notes, setNotes] = useState('');
  const [canCreate, setCanCreate] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const { people: searchHits, isSearching } = useUserSearch(query);

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

  // GET /user/search hits for what's typed, minus yourself.
  const matches = searchHits.filter(u => u.id !== currentUserId);

  const share = async () => {
    if (!token || !view || !picked) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await withAuthRetry(token, t =>
        createSharedTaskView(t, {
          view_id: Number(view.id),
          user_id: picked.id,
          share_notes: notes.trim(),
          ui_info: {},
          can_create: canCreate,
          can_edit: canEdit,
          can_delete: canDelete,
        }),
      );
      setDone(true);
      toast.success(`Shared with ${picked.name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not share the view');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={close} size="md" dismissable={!saving}>
      <SheetHeader
        title={`Share “${view?.name ?? ''}”`}
        description="Only people in your organization can be found."
        onClose={close}
      />
      {done ? (
        <SheetBody scroll={false}>
          <View className="items-center py-6">
            <View className="mb-3 h-11 w-11 items-center justify-center rounded-full bg-success/15">
              <CircleCheck size={22} color={c.success} />
            </View>
            <Text className="text-base font-semibold text-text-heading">View shared</Text>
            <Text className="mt-1 text-sm text-text-main">{picked?.email} can open it now.</Text>
          </View>
        </SheetBody>
      ) : (
        <SheetBody>
          <Field label="Colleague">
            {picked ? (
              <View className="h-10 flex-row items-center gap-2.5 rounded-lg border border-accent/50 bg-accent-soft px-3">
                <InitialsAvatar color={picked.color} initials={picked.initials} size={22} />
                <Text numberOfLines={1} className="flex-1 text-sm text-text-heading">
                  {picked.name} <Text className="text-text-subtle">· {picked.email}</Text>
                </Text>
                <Button size="sm" variant="ghost" onPress={() => setPicked(null)}>Change</Button>
              </View>
            ) : (
              <Input
                icon={Search}
                value={query}
                onChangeText={search}
                placeholder="Start typing an email"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
            )}
            {!picked && query.trim().length >= 2 ? (
              <View className="mt-1.5 overflow-hidden rounded-lg border border-border-main bg-bg-card">
                {matches.length === 0 ? (
                  <Text className="px-3 py-3 text-sm text-text-subtle">
                    {isSearching
                      ? 'Searching…'
                      : 'No one found — they may not be in your organization.'}
                  </Text>
                ) : (
                  <ScrollView className="max-h-44">
                    {matches.map(u => (
                      <Press
                        key={u.id}
                        feedback="none"
                        accessibilityRole="button"
                        onPress={() => setPicked(u)}
                        className="flex-row items-center gap-2.5 px-3 py-2 hover:bg-hover"
                      >
                        <InitialsAvatar color={u.color} initials={u.initials} size={24} />
                        <View className="flex-1">
                          <Text className="text-sm text-text-heading">{u.name}</Text>
                          <Text numberOfLines={1} className="text-xs text-text-subtle">
                            {u.email}
                          </Text>
                        </View>
                      </Press>
                    ))}
                  </ScrollView>
                )}
              </View>
            ) : null}
          </Field>

          <Field label="Note">
            <Input
              value={notes}
              onChangeText={setNotes}
              placeholder="Why you're sharing this (optional)"
              multiline
              minHeight={56}
            />
          </Field>

          <Field label="Their permissions" hint="They can always open the view and see what it shows." className="mb-1">
            <View className="gap-1">
              <Checkbox checked={canCreate} onChange={setCanCreate} label="Can create tasks" />
              <Checkbox checked={canEdit} onChange={setCanEdit} label="Can edit tasks" />
              <Checkbox checked={canDelete} onChange={setCanDelete} label="Can delete tasks" />
            </View>
          </Field>

          {error ? (
            <View className="mt-3">
              <Callout kind="error">{error}</Callout>
            </View>
          ) : null}
        </SheetBody>
      )}
      <SheetFooter>
        {done ? (
          <Button variant="primary" onPress={close}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onPress={close} disabled={saving}>Cancel</Button>
            <Button variant="primary" onPress={share} disabled={!picked} loading={saving}>
              Share
            </Button>
          </>
        )}
      </SheetFooter>
    </Sheet>
  );
}
