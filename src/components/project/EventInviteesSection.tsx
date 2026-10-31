import { useEffect, useRef, useState } from 'react';
import { Platform, Text, View, type ViewInstance } from 'react-native';
import { format, parseISO } from 'date-fns';
import { validate as isValidEmail } from 'email-validator';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Clock from 'lucide-react-native/icons/clock';
import Mail from 'lucide-react-native/icons/mail';
import Plus from 'lucide-react-native/icons/plus';
import Trash2 from 'lucide-react-native/icons/trash';
import { confirm, errorMessage, toast } from '../../atoms/feedback';
import { isServerTaskId } from '../../data/taskSync';
import {
  INVITE_STATUS_INFO as STATUS_INFO,
  parsePreviousStatus,
  parseResponseHistory as parseHistory,
} from '../../data/inviteResponse';
import {
  useEventInviteeMutations,
  useEventInvitees,
} from '../../hooks/useEventInvitees';
import { useUserSearch, type Person } from '../../hooks/useUsers';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Badge, Button, IconButton, Input, Press } from '../ui';
import { Avatar } from './shared';
import { SuggestPortal } from './SuggestPortal';

// Below this many characters, a search is too unspecific to be worth a
// round-trip (and would just flash a noisy "no matches" dropdown).
const SEARCH_MIN_CHARS = 3;

// How long "Resend" is locked after a click — session-local only (nothing on
// the server records when an invite was last resent, so this doesn't survive
// closing and reopening the task).
const RESEND_COOLDOWN_MS = 5 * 60_000;

const formatRemaining = (ms: number) => {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// A task's invitees — people invited by e-mail to this task's event, who
// aren't necessarily app members: they respond from their own link, with no
// sign-in (see InviteResponseScreen.tsx / Tasks-Main-API's /public/event/invite
// routes). Mirrors TaskAlertsSection/CommentsSection's shape (header, rows, an
// add affordance). canInvite/canRemove mirror the server's own split: anyone
// who's the task's owner/assignee/creator can invite, resend, or see the
// list; only the owner/creator can remove an invitee.
export function EventInviteesSection({
  viewId,
  taskId,
  canInvite,
  canRemove,
}: {
  viewId: number;
  taskId: string;
  canInvite: boolean;
  canRemove: boolean;
}) {
  const c = useThemeColors();
  const { invitees, isLoading } = useEventInvitees(viewId, taskId);
  const { inviteByEmail, resendInvite, removeInvite } =
    useEventInviteeMutations(viewId, taskId);
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const trimmedEmail = email.trim();
  const searchQuery =
    trimmedEmail.length >= SEARCH_MIN_CHARS ? trimmedEmail : '';
  const { people: searchHits, isSearching } = useUserSearch(searchQuery);
  // Inline dropdown, portaled to document.body on web (not a Popover/Modal —
  // react-native-web's Modal traps focus, which was stealing it right out of
  // the input the moment a suggestion appeared, making the field look
  // uneditable; and rendering it nested in place, even with a high z-index,
  // could still lose to a later, unrelated sibling subtree — see
  // SuggestPortal's comment). Closed by a plain outside-click listener,
  // scoped to this field's own container plus the portaled panel itself.
  const suggestBoxRef = useRef<ViewInstance | null>(null);
  const suggestPanelRef = useRef<ViewInstance | null>(null);
  const [anchor, setAnchor] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  useEffect(() => {
    if (!suggestOpen) {
      return;
    }
    suggestBoxRef.current?.measureInWindow((x, y, width, height) =>
      setAnchor({ x, y, width, height }),
    );
  }, [suggestOpen]);
  useEffect(() => {
    if (!suggestOpen || Platform.OS !== 'web') {
      return;
    }
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      const box = suggestBoxRef.current as unknown as HTMLElement | null;
      const panel = suggestPanelRef.current as unknown as HTMLElement | null;
      if (!box?.contains(target) && !panel?.contains(target)) {
        setSuggestOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [suggestOpen]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (inviteeEmail: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(inviteeEmail)) {
        next.delete(inviteeEmail);
      } else {
        next.add(inviteeEmail);
      }
      return next;
    });
  const [resendLockedUntil, setResendLockedUntil] = useState<
    Record<string, number>
  >({});
  const [now, setNow] = useState(() => Date.now());
  // Self-terminating: only ticks while some lock is still counting down, and
  // stops scheduling the next tick once none are.
  useEffect(() => {
    if (!Object.values(resendLockedUntil).some(until => until > now)) {
      return;
    }
    const id = setTimeout(() => setNow(Date.now()), 1000);
    return () => clearTimeout(id);
  }, [resendLockedUntil, now]);

  if (!isServerTaskId(taskId)) {
    return null;
  }

  const invite = async (overrideEmail?: string) => {
    const value = (overrideEmail ?? email).trim().toLowerCase();
    if (!isValidEmail(value)) {
      toast.error('Enter a valid e-mail address');
      return;
    }
    setSuggestOpen(false);
    setInviting(true);
    try {
      await inviteByEmail(value);
      setEmail('');
      toast.success('Invite sent');
    } catch (err) {
      toast.error('Couldn’t send the invite', {
        description: errorMessage(err, 'Please try again.'),
      });
    } finally {
      setInviting(false);
    }
  };

  const resend = async (inviteeEmail: string) => {
    setBusyEmail(inviteeEmail);
    try {
      await resendInvite(inviteeEmail);
      toast.success('Invite resent');
      setResendLockedUntil(prev => ({
        ...prev,
        [inviteeEmail]: Date.now() + RESEND_COOLDOWN_MS,
      }));
    } catch (err) {
      toast.error('Couldn’t resend the invite', {
        description: errorMessage(err, 'Please try again.'),
      });
    } finally {
      setBusyEmail(null);
    }
  };

  const remove = async (inviteeEmail: string) => {
    const ok = await confirm({
      title: `Remove ${inviteeEmail}?`,
      message:
        'They’ll no longer be able to respond from their existing invite link.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) {
      return;
    }
    setBusyEmail(inviteeEmail);
    try {
      await removeInvite(inviteeEmail);
      toast.success('Invite removed');
    } catch (err) {
      toast.error('Couldn’t remove the invite', {
        description: errorMessage(err, 'Please try again.'),
      });
    } finally {
      setBusyEmail(null);
    }
  };

  // Someone already invited isn't worth re-suggesting.
  const invitedEmails = new Set(
    invitees.map(inv => inv.invitee_email.toLowerCase()),
  );
  const suggestions = searchHits.filter(
    p => !invitedEmails.has(p.email.toLowerCase()),
  );
  const showSuggestions =
    suggestOpen && searchQuery.length > 0 && (Platform.OS !== 'web' || !!anchor);

  const selectSuggestion = (person: Person) => invite(person.email);

  return (
    <View>
      <View className="mb-3 flex-row items-center gap-2">
        <Mail size={15} color={c.text} />
        <Text className="text-sm font-semibold text-text-heading">
          Invitees{invitees.length ? ` (${invitees.length})` : ''}
        </Text>
      </View>

      {canInvite ? (
        <View className="mb-3 flex-row items-end gap-2">
          <View ref={suggestBoxRef} style={{ position: 'relative', flex: 1 }}>
            <Input
              value={email}
              onChangeText={text => {
                setEmail(text);
                setSuggestOpen(text.trim().length >= SEARCH_MIN_CHARS);
              }}
              onFocus={() =>
                setSuggestOpen(trimmedEmail.length >= SEARCH_MIN_CHARS)
              }
              onSubmitEditing={() => {
                if (trimmedEmail) {
                  invite();
                }
              }}
              placeholder="person@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="done"
            />
            {showSuggestions ? (
              <SuggestPortal>
                {/* Positioning/background/border/stacking are all inline
                    (not Tailwind classes) for the same reason this is
                    portaled at all: it has to float reliably above
                    whatever's behind it, with no ambiguity about whether a
                    class resolved or which stacking context it landed in. */}
                <View
                  ref={suggestPanelRef}
                  style={[
                    Platform.OS === 'web'
                      ? {
                          position: 'fixed' as const,
                          left: anchor?.x ?? 0,
                          top: (anchor?.y ?? 0) + (anchor?.height ?? 0) + 4,
                          width: anchor?.width,
                          zIndex: 9999,
                        }
                      : {
                          position: 'absolute' as const,
                          left: 0,
                          right: 0,
                          top: '100%',
                          marginTop: 4,
                          zIndex: 50,
                          elevation: 12,
                        },
                    {
                      backgroundColor: c.card,
                      borderColor: c.border,
                      borderWidth: 1,
                      borderRadius: 12,
                      overflow: 'hidden',
                      padding: 6,
                    },
                    Platform.OS === 'web'
                      ? ({
                          boxShadow: c.dark
                            ? '0 16px 40px -8px rgba(0,0,0,0.7)'
                            : '0 16px 40px -12px rgba(20,20,40,0.28), 0 2px 6px rgba(20,20,40,0.06)',
                        } as object)
                      : null,
                  ]}
                >
                  {isSearching ? (
                    <Text className="px-2 py-1.5 text-sm text-text-subtle">
                      Searching…
                    </Text>
                  ) : suggestions.length > 0 ? (
                    <View className="gap-0.5">
                      {suggestions.map(p => (
                        <Press
                          key={p.id}
                          accessibilityRole="button"
                          accessibilityLabel={`Invite ${p.name} (${p.email})`}
                          onPress={() => selectSuggestion(p)}
                          className="flex-row items-center gap-2 rounded-md px-2 py-1.5 hover:bg-hover"
                        >
                          <Avatar id={p.id} size={22} />
                          <View className="flex-1">
                            <Text
                              numberOfLines={1}
                              className="text-sm text-text-heading"
                            >
                              {p.name}
                            </Text>
                            <Text
                              numberOfLines={1}
                              className="text-2xs text-text-subtle"
                            >
                              {p.email}
                            </Text>
                          </View>
                        </Press>
                      ))}
                    </View>
                  ) : (
                    <Text className="px-2 py-1.5 text-sm text-text-subtle">
                      No matching members — press Invite to add “
                      {trimmedEmail}” by e-mail anyway.
                    </Text>
                  )}
                </View>
              </SuggestPortal>
            ) : null}
          </View>
          <Button
            variant="primary"
            icon={Plus}
            onPress={() => invite()}
            loading={inviting}
            disabled={!email.trim()}
          >
            Invite
          </Button>
        </View>
      ) : null}

      {isLoading ? (
        <Text className="text-sm text-text-main">Loading invitees…</Text>
      ) : invitees.length === 0 ? (
        <Text className="text-sm text-text-main">
          No one’s been invited yet.
        </Text>
      ) : (
        <View className="gap-2">
          {invitees.map(inv => {
            const status = STATUS_INFO[inv.response_status];
            const busy = busyEmail === inv.invitee_email;
            // Written by the invitee's own browser when they clicked a
            // response button (see InviteResponseScreen.tsx) — their own
            // open `response_info` slot, so it's only ever there once
            // they've actually responded. `responses` is their full history
            // (every time they've changed their mind), not just the latest —
            // but only from the point this history tracking started; an
            // invitee whose first-ever response predates it has a
            // `previous_status` with no matching entry in `responses` (still
            // real evidence of a change, just not a timestamped one), so the
            // chevron/expand can't rely on `responses.length` alone.
            const respondedAt = inv.response_info.responded_at;
            const history = parseHistory(inv.response_info.responses);
            const previousStatus = parsePreviousStatus(
              inv.response_info.previous_status,
            );
            const showUndatedPrevious =
              previousStatus !== null && history.length <= 1;
            const hasHistory = history.length > 1 || previousStatus !== null;
            const isOpen = expanded.has(inv.invitee_email);
            const lockUntil = resendLockedUntil[inv.invitee_email] ?? 0;
            const resendLocked = lockUntil > now;
            return (
              <View
                key={inv.invitee_email}
                className="rounded-lg border border-border-main"
              >
                <View className="flex-row items-center gap-2 px-3 py-2">
                  <View className="flex-1">
                    <Text className="text-sm text-text-heading">
                      {inv.invitee_email}
                    </Text>
                    <Text className="mt-0.5 text-2xs text-text-subtle">
                      Invited {format(parseISO(inv.invited_at), 'MMM d, yyyy')}
                      {typeof respondedAt === 'string'
                        ? ` · Responded ${format(
                            parseISO(respondedAt),
                            'MMM d, yyyy',
                          )}`
                        : ''}
                    </Text>
                  </View>
                  <Badge label={status.label} color={status.color} dot />
                  {hasHistory ? (
                    <Press
                      accessibilityRole="button"
                      accessibilityLabel={
                        isOpen
                          ? 'Hide response history'
                          : 'Show response history'
                      }
                      accessibilityState={{ expanded: isOpen }}
                      onPress={() => toggleExpanded(inv.invitee_email)}
                      hitSlop={6}
                      className="h-7 w-7 items-center justify-center rounded-md hover:bg-hover"
                    >
                      <View
                        style={{
                          transform: [{ rotate: isOpen ? '90deg' : '0deg' }],
                        }}
                      >
                        <ChevronRight
                          size={15}
                          color={c.subtle}
                          strokeWidth={2.25}
                        />
                      </View>
                    </Press>
                  ) : null}
                  {canInvite ? (
                    <IconButton
                      icon={resendLocked ? Clock : Mail}
                      size="sm"
                      disabled={busy || resendLocked}
                      label={
                        resendLocked
                          ? `Resend invite to ${
                              inv.invitee_email
                            } again in ${formatRemaining(lockUntil - now)}`
                          : `Resend invite to ${inv.invitee_email}`
                      }
                      onPress={() => resend(inv.invitee_email)}
                    />
                  ) : null}
                  {canRemove ? (
                    <IconButton
                      icon={Trash2}
                      label={`Remove ${inv.invitee_email}`}
                      size="sm"
                      disabled={busy}
                      onPress={() => remove(inv.invitee_email)}
                    />
                  ) : null}
                </View>
                {isOpen && hasHistory ? (
                  <View className="gap-1.5 border-t border-border-main px-3 py-2">
                    {showUndatedPrevious && previousStatus ? (
                      <View className="flex-row items-center gap-2">
                        <Badge
                          label={STATUS_INFO[previousStatus].label}
                          color={STATUS_INFO[previousStatus].color}
                          dot
                        />
                        <Text className="text-2xs text-text-subtle">
                          Earlier (exact time not recorded)
                        </Text>
                      </View>
                    ) : null}
                    {history.map((h, idx) => {
                      const entryStatus = STATUS_INFO[h.status];
                      return (
                        <View key={`${h.at}:${idx}`} className="gap-0.5">
                          <View className="flex-row items-center gap-2">
                            <Badge
                              label={entryStatus.label}
                              color={entryStatus.color}
                              dot
                            />
                            <Text className="text-2xs text-text-subtle">
                              {format(parseISO(h.at), 'MMM d, yyyy · h:mm a')}
                            </Text>
                            {h.percentage !== undefined ? (
                              <Text className="text-2xs text-text-subtle">
                                · {h.percentage}% likely
                              </Text>
                            ) : null}
                          </View>
                          {h.reason ? (
                            <Text className="text-2xs italic text-text-subtle">
                              “{h.reason}”
                            </Text>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
