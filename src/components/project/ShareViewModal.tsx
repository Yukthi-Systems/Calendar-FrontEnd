import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Plus from 'lucide-react-native/icons/plus';
import Search from 'lucide-react-native/icons/search';
import Users from 'lucide-react-native/icons/users';
import X from 'lucide-react-native/icons/x';
import { useAtomValue } from 'jotai';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { currentUserIdAtom } from '../../atoms/members';
import { errorMessage, toast } from '../../atoms/feedback';
import { useThemeColors } from '../../hooks/useThemeColors';
import {
  useFindPeopleByEmail,
  usePeople,
  usePerson,
  useUserSearch,
  type Person,
} from '../../hooks/useUsers';
import {
  shareFromServer,
  useShareMutations,
  useViewShares,
} from '../../hooks/useViews';
import type { ProjectView } from '../../data/types';
import type { SharedTaskViewDto } from '../../services/types';
import {
  Button,
  Callout,
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
// changing what each person may do (see useShareMutations — temporarily remove +
// re-add, backend bug #0c), revoking access (DELETE /shared/delete — with Undo),
// and sharing with one or many people at once (POST /shared/create each). Everything is read back from the server after each write.
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
  // Alphabetical by name, so rows don't jump when the server's order changes —
  // a permission change re-adds that person (see useShareMutations), which moves
  // them to the end of the server's list.
  const people = usePeople((shares.data ?? []).map(s => s.user_id));
  const nameOf = (id: string) => (people.get(id)?.name ?? '').toLowerCase();
  const list = [...(shares.data ?? [])].sort(
    (a, b) =>
      nameOf(a.user_id).localeCompare(nameOf(b.user_id)) ||
      a.user_id.localeCompare(b.user_id),
  );

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
              <ShareRow
                key={s.user_id}
                viewId={view!.id}
                share={s}
                first={i === 0}
              />
            ))}
          </View>
        )}

        {view ? (
          <AddPeople view={view} existing={list.map(s => s.user_id)} />
        ) : null}
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
      await updateShare({
        next: { ...current, [key]: !current[key] },
        prev: current,
      });
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
      className={`gap-2 px-3 py-2.5 ${
        first ? '' : 'border-t border-border-main'
      } ${busy ? 'opacity-60' : ''}`}
    >
      <View className="flex-row items-center gap-2.5">
        <InitialsAvatar
          color={person?.color ?? '#9ca3af'}
          initials={person?.initials ?? '?'}
          size={28}
        />
        <View className="flex-1">
          <Text
            numberOfLines={1}
            className="text-sm font-medium text-text-heading"
          >
            {person?.name ?? '…'}
          </Text>
          <Text numberOfLines={1} className="text-xs text-text-subtle">
            {person?.email}
            {share.shared_at
              ? ` · shared ${formatDistanceToNow(parseISO(share.shared_at), {
                  addSuffix: true,
                })}`
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
        <Text className="pl-[38px] text-xs italic text-text-main">
          “{share.share_notes}”
        </Text>
      ) : null}
    </View>
  );
}

// Emails in pasted text: "a@x.com, b@x.com" / one per line / with names around them.
const EMAIL = /[^\s,;<>"']+@[^\s,;<>"']+\.[^\s,;<>"']+/g;

// Pick one or many people, then share with all of them at once — same access and
// note for the group. Search and click to add (the search clears for the next),
// or paste a list of emails: each is looked up and added; any not in the
// organization is listed. One POST /shared/create per person; anyone who fails
// stays selected for another try.
function AddPeople({
  view,
  existing,
}: {
  view: ProjectView;
  existing: string[];
}) {
  const c = useThemeColors();
  const currentUserId = useAtomValue(currentUserIdAtom);
  const { addShare } = useShareMutations(view.id);
  const findByEmail = useFindPeopleByEmail();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Person[]>([]);
  const [perms, setPerms] = useState({
    canCreate: false,
    canEdit: false,
    canDelete: false,
  });
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [notFound, setNotFound] = useState<string[]>([]);
  // The note is required; its error shows after the first Share attempt.
  const [tried, setTried] = useState(false);
  const noteMissing = !notes.trim();

  const { people, isSearching } = useUserSearch(
    query.includes(',') || query.includes('\n') ? '' : query,
  );
  const taken = (id: string) =>
    id === currentUserId ||
    existing.includes(id) ||
    picked.some(p => p.id === id);
  const matches = people.filter(p => !taken(p.id));

  const add = (list: Person[]) =>
    setPicked(prev => [
      ...prev,
      ...list.filter(p => !taken(p.id) && !prev.some(q => q.id === p.id)),
    ]);
  const unpick = (id: string) =>
    setPicked(prev => prev.filter(p => p.id !== id));

  // Several emails typed or pasted at once → look each up.
  const onQuery = async (text: string) => {
    const emails = [
      ...new Set((text.match(EMAIL) ?? []).map(e => e.toLowerCase())),
    ];
    if (emails.length < 2 && !/[,;\n]/.test(text)) {
      setQuery(text);
      return;
    }
    setQuery('');
    setResolving(true);
    const { found, missing } = await findByEmail(emails);
    setResolving(false);
    add(found);
    setNotFound(missing);
  };

  const reset = () => {
    setQuery('');
    setPicked([]);
    setPerms({ canCreate: false, canEdit: false, canDelete: false });
    setNotes('');
    setTried(false);
    setNotFound([]);
  };

  const share = async () => {
    setTried(true);
    if (noteMissing || picked.length === 0) {
      return;
    }
    setSaving(true);
    const failed: Person[] = [];
    for (const p of picked) {
      await addShare({ userId: p.id, ...perms, notes: notes.trim() }).catch(
        () => failed.push(p),
      );
    }
    setSaving(false);
    const done = picked.length - failed.length;
    if (failed.length === 0) {
      toast.success(
        picked.length === 1
          ? `Shared with ${picked[0].name}`
          : `Shared with ${picked.length} people`,
      );
      reset();
    } else {
      toast.error(
        done > 0
          ? `Shared with ${done}, ${failed.length} failed`
          : 'Couldn’t share the view',
        {
          description: `Not shared: ${failed
            .map(f => f.name)
            .join(', ')}. They’re still selected — try again.`,
        },
      );
      setPicked(failed);
    }
  };

  const count = picked.length;
  return (
    <View className="rounded-xl border border-border-main bg-muted/40 p-3">
      <Text className="mb-2 text-xs font-medium text-text-heading">
        Add people
      </Text>

      {count > 0 ? (
        <View className="mb-2 flex-row flex-wrap gap-1.5">
          {picked.map(p => (
            <View
              key={p.id}
              className="h-7 flex-row items-center gap-1.5 rounded-full border border-border-main bg-bg-card pl-1 pr-0.5"
            >
              <InitialsAvatar color={p.color} initials={p.initials} size={20} />
              <Text
                numberOfLines={1}
                className="max-w-[160px] text-sm text-text-heading"
              >
                {p.name}
              </Text>
              <Press
                accessibilityRole="button"
                accessibilityLabel={`Remove ${p.name}`}
                onPress={() => unpick(p.id)}
                hitSlop={6}
                className="h-6 w-6 items-center justify-center rounded-full hover:bg-hover"
              >
                <X size={12} color={c.subtle} />
              </Press>
            </View>
          ))}
        </View>
      ) : null}

      <Input
        icon={Search}
        value={query}
        onChangeText={onQuery}
        placeholder={
          count
            ? 'Add more — search or paste emails'
            : 'Search by email, or paste several'
        }
        autoCapitalize="none"
        autoCorrect={false}
      />
      {resolving ? (
        <Text className="mt-1.5 text-xs text-text-subtle">
          Looking up emails…
        </Text>
      ) : null}
      {notFound.length > 0 ? (
        <Text className="mt-1.5 text-xs text-warning">
          Not in your organization: {notFound.join(', ')}
        </Text>
      ) : null}
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
                  accessibilityLabel={`Add ${u.name}`}
                  onPress={() => {
                    add([u]);
                    setQuery('');
                  }}
                  className="flex-row items-center gap-2.5 px-3 py-2 hover:bg-hover"
                >
                  <InitialsAvatar
                    color={u.color}
                    initials={u.initials}
                    size={24}
                  />
                  <View className="flex-1">
                    <Text className="text-sm text-text-heading">{u.name}</Text>
                    <Text
                      numberOfLines={1}
                      className="text-xs text-text-subtle"
                    >
                      {u.email}
                    </Text>
                  </View>
                  <Plus size={15} color={c.subtle} />
                </Press>
              ))}
            </ScrollView>
          )}
        </View>
      ) : null}

      {count > 0 ? (
        <View className="mt-3 gap-3 border-t border-border-main pt-3">
          <View className="flex-row flex-wrap items-center gap-1.5">
            <Text className="text-xs text-text-subtle">
              {count === 1 ? 'Can' : `All ${count} can`}
            </Text>
            {PERMS.map(p => (
              <Chip
                key={p.key}
                role="checkbox"
                label={p.label}
                active={perms[p.key]}
                onPress={() => setPerms(v => ({ ...v, [p.key]: !v[p.key] }))}
              />
            ))}
            <Text className="text-xs text-text-subtle">tasks</Text>
          </View>
          <Field
            label="Note"
            required
            className="mb-0"
            hint={
              count === 1
                ? `${picked[0].name} sees this at the top of the view.`
                : 'Everyone you add sees this at the top of the view.'
            }
            error={
              tried && noteMissing ? 'Add a short note so they know why.' : null
            }
          >
            <Input
              value={notes}
              onChangeText={setNotes}
              invalid={tried && noteMissing}
              placeholder="Why you're sharing this, e.g. “Please keep the launch tasks updated”"
              multiline
              minHeight={48}
            />
          </Field>
          <View className="flex-row justify-end gap-2">
            <Button variant="ghost" onPress={reset} disabled={saving}>
              Clear
            </Button>
            <Button variant="primary" onPress={share} loading={saving}>
              {count === 1
                ? `Share with ${picked[0].name}`
                : `Share with ${count} people`}
            </Button>
          </View>
        </View>
      ) : null}
    </View>
  );
}
