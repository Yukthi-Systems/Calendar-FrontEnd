import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Search, Users, X } from 'lucide-react-native';
import { useAtomValue } from 'jotai';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { currentUserIdAtom } from '../../atoms/members';
import { errorMessage, toast } from '../../atoms/feedback';
import { useThemeColors } from '../../hooks/useThemeColors';
import { usePerson, useUserSearch, type Person } from '../../hooks/useUsers';
import {
  shareFromServer,
  useShareMutations,
  useViewShares,
  type ShareDraft,
} from '../../hooks/useViews';
import type { ProjectView } from '../../data/types';
import type { SharedTaskViewDto } from '../../services/types';
import {
  Button,
  Callout,
  Checkbox,
  Chip,
  Field,
  IconButton,
  Input,
  Press,
  Sheet,
  SheetBody,
  SheetFooter,
  SheetHeader,
  Skeleton,
} from '../ui';
import { InitialsAvatar } from './shared';

// "Share & access" for one of my views: who it's shared with (GET /shared/list),
// changing what each person may do (PATCH /shared/update), revoking access
// (DELETE /shared/delete — with Undo), and sharing with someone new
// (POST /shared/create). Everything is read back from the server after each write.
export function ShareViewModal({
  visible,
  view,
  onClose,
}: {
  visible: boolean;
  view: ProjectView | null;
  onClose: () => void;
}) {
  const c = useThemeColors();
  const shares = useViewShares(visible ? view : null);
  const list = shares.data ?? [];

  return (
    <Sheet visible={visible} onClose={onClose} size="md">
      <SheetHeader
        title={`Share “${view?.name ?? ''}”`}
        description="People you share with see this view and its tasks."
        onClose={onClose}
      />
      <SheetBody>
        <Text className="mb-2 text-xs font-medium text-text-heading">
          People with access{list.length ? ` · ${list.length}` : ''}
        </Text>
        {shares.isLoading ? (
          <View className="mb-5 gap-2">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </View>
        ) : shares.error ? (
          <View className="mb-5">
            <Callout kind="error" title="Couldn’t load who has access">
              {errorMessage(shares.error, 'Please try again.')}
            </Callout>
          </View>
        ) : list.length === 0 ? (
          <View className="mb-5 flex-row items-center gap-2.5 rounded-lg border border-dashed border-border-strong px-3 py-3">
            <Users size={16} color={c.subtle} />
            <Text className="flex-1 text-sm text-text-main">
              Only you can see this view.
            </Text>
          </View>
        ) : (
          <View className="mb-5 overflow-hidden rounded-xl border border-border-main">
            {list.map((s, i) => (
              <ShareRow key={s.user_id} viewId={view!.id} share={s} first={i === 0} />
            ))}
          </View>
        )}

        {view ? <AddPerson view={view} existing={list.map(s => s.user_id)} /> : null}
      </SheetBody>
      <SheetFooter>
        <Button variant="primary" onPress={onClose}>
          Done
        </Button>
      </SheetFooter>
    </Sheet>
  );
}

const PERMS: { key: 'canCreate' | 'canEdit' | 'canDelete'; label: string }[] = [
  { key: 'canCreate', label: 'Create' },
  { key: 'canEdit', label: 'Edit' },
  { key: 'canDelete', label: 'Delete' },
];

function ShareRow({
  viewId,
  share,
  first,
}: {
  viewId: string;
  share: SharedTaskViewDto;
  first: boolean;
}) {
  const person = usePerson(share.user_id);
  const { addShare, updateShare, removeShare } = useShareMutations(viewId);
  const [busy, setBusy] = useState(false);
  const current = shareFromServer(share);

  const toggle = async (key: (typeof PERMS)[number]['key']) => {
    setBusy(true);
    try {
      await updateShare({ ...current, [key]: !current[key] });
    } catch (err) {
      toast.error('Couldn’t change access', {
        description: errorMessage(err, 'Please try again.'),
      });
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    setBusy(true);
    try {
      await removeShare(share.user_id);
      toast.info(`${person?.name ?? 'They'} no longer has access`, {
        action: {
          label: 'Undo',
          onPress: () =>
            addShare(current).catch(err =>
              toast.error('Couldn’t restore access', {
                description: errorMessage(err, 'Please try again.'),
              }),
            ),
        },
      });
    } catch (err) {
      toast.error('Couldn’t remove access', {
        description: errorMessage(err, 'Please try again.'),
      });
      setBusy(false);
    }
  };

  return (
    <View
      className={`gap-2 px-3 py-2.5 ${first ? '' : 'border-t border-border-main'} ${
        busy ? 'opacity-60' : ''
      }`}
    >
      <View className="flex-row items-center gap-2.5">
        <InitialsAvatar
          color={person?.color ?? '#9ca3af'}
          initials={person?.initials ?? '?'}
          size={28}
        />
        <View className="flex-1">
          <Text numberOfLines={1} className="text-sm font-medium text-text-heading">
            {person?.name ?? '…'}
          </Text>
          <Text numberOfLines={1} className="text-xs text-text-subtle">
            {person?.email}
            {share.shared_at
              ? ` · shared ${formatDistanceToNow(parseISO(share.shared_at), { addSuffix: true })}`
              : ''}
          </Text>
        </View>
        <IconButton
          icon={X}
          size="sm"
          label={`Remove ${person?.name ?? 'access'}`}
          disabled={busy}
          onPress={revoke}
        />
      </View>
      <View className="flex-row flex-wrap items-center gap-1.5 pl-[38px]">
        <Text className="text-xs text-text-subtle">Can</Text>
        {PERMS.map(p => (
          <Chip
            key={p.key}
            role="checkbox"
            label={p.label}
            active={current[p.key]}
            onPress={() => !busy && toggle(p.key)}
          />
        ))}
        <Text className="text-xs text-text-subtle">tasks</Text>
      </View>
      {share.share_notes ? (
        <Text className="pl-[38px] text-xs italic text-text-main">“{share.share_notes}”</Text>
      ) : null}
    </View>
  );
}

function AddPerson({ view, existing }: { view: ProjectView; existing: string[] }) {
  const currentUserId = useAtomValue(currentUserIdAtom);
  const { addShare } = useShareMutations(view.id);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Person | null>(null);
  const [draft, setDraft] = useState<Omit<ShareDraft, 'userId'>>({
    notes: '',
    canCreate: false,
    canEdit: false,
    canDelete: false,
  });
  const [saving, setSaving] = useState(false);
  // The note is required; its error shows after the first Share attempt.
  const [tried, setTried] = useState(false);
  const noteMissing = !draft.notes.trim();
  const { people, isSearching } = useUserSearch(query);
  // Not yourself, and not someone who already has access (edit them above).
  const matches = people.filter(p => p.id !== currentUserId && !existing.includes(p.id));

  const reset = () => {
    setQuery('');
    setPicked(null);
    setDraft({ notes: '', canCreate: false, canEdit: false, canDelete: false });
    setTried(false);
  };

  const share = async () => {
    if (!picked) {
      return;
    }
    setTried(true);
    if (noteMissing) {
      return;
    }
    setSaving(true);
    try {
      await addShare({ userId: picked.id, ...draft, notes: draft.notes.trim() });
      toast.success(`Shared with ${picked.name}`);
      reset();
    } catch (err) {
      toast.error('Couldn’t share the view', {
        description: errorMessage(err, 'Please try again.'),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="rounded-xl border border-border-main bg-muted/40 p-3">
      <Text className="mb-2 text-xs font-medium text-text-heading">Add people</Text>
      {picked ? (
        <View className="gap-3">
          <View className="h-10 flex-row items-center gap-2.5 rounded-lg border border-accent/50 bg-accent-soft px-3">
            <InitialsAvatar color={picked.color} initials={picked.initials} size={22} />
            <Text numberOfLines={1} className="flex-1 text-sm text-text-heading">
              {picked.name} <Text className="text-text-subtle">· {picked.email}</Text>
            </Text>
            <Button size="sm" variant="ghost" onPress={() => setPicked(null)}>
              Change
            </Button>
          </View>
          <View className="gap-1">
            <Checkbox
              checked={draft.canCreate}
              onChange={v => setDraft(d => ({ ...d, canCreate: v }))}
              label="Can create tasks"
            />
            <Checkbox
              checked={draft.canEdit}
              onChange={v => setDraft(d => ({ ...d, canEdit: v }))}
              label="Can edit tasks"
            />
            <Checkbox
              checked={draft.canDelete}
              onChange={v => setDraft(d => ({ ...d, canDelete: v }))}
              label="Can delete tasks"
            />
          </View>
          <Field
            label="Note"
            required
            className="mb-0"
            hint={`${picked.name} sees this at the top of the view.`}
            error={tried && noteMissing ? 'Add a short note so they know why.' : null}
          >
            <Input
              value={draft.notes}
              onChangeText={notes => setDraft(d => ({ ...d, notes }))}
              invalid={tried && noteMissing}
              placeholder="Why you're sharing this, e.g. “Please keep the launch tasks updated”"
              multiline
              minHeight={48}
            />
          </Field>
          <View className="flex-row justify-end gap-2">
            <Button variant="ghost" onPress={reset} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onPress={share} loading={saving}>
              Share
            </Button>
          </View>
        </View>
      ) : (
        <>
          <Input
            icon={Search}
            value={query}
            onChangeText={setQuery}
            placeholder="Search by email"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.trim().length >= 2 ? (
            <View className="mt-1.5 overflow-hidden rounded-lg border border-border-main bg-bg-card">
              {matches.length === 0 ? (
                <Text className="px-3 py-3 text-sm text-text-subtle">
                  {isSearching
                    ? 'Searching…'
                    : 'No one found — they may not be in your organization, or already have access.'}
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
        </>
      )}
    </View>
  );
}
