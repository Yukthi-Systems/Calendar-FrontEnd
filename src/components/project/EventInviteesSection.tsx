import { useState } from 'react';
import { Text, View } from 'react-native';
import { format, parseISO } from 'date-fns';
import Mail from 'lucide-react-native/icons/mail';
import Plus from 'lucide-react-native/icons/plus';
import RotateCw from 'lucide-react-native/icons/rotate-cw';
import Trash2 from 'lucide-react-native/icons/trash';
import { confirm, errorMessage, toast } from '../../atoms/feedback';
import { isServerTaskId } from '../../data/taskSync';
import {
  useEventInviteeMutations,
  useEventInvitees,
} from '../../hooks/useEventInvitees';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { InviteResponseStatus } from '../../services/types';
import { Badge, Button, IconButton, Input } from '../ui';

const STATUS_INFO: Record<
  InviteResponseStatus,
  { label: string; color: string }
> = {
  PENDING: { label: 'Pending', color: '#9ca3af' },
  MAYBE: { label: 'Maybe', color: '#d97706' },
  ACCEPTED: { label: 'Accepted', color: '#059669' },
  DECLINED: { label: 'Declined', color: '#dc2626' },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const [busyEmail, setBusyEmail] = useState<string | null>(null);

  if (!isServerTaskId(taskId)) {
    return null;
  }

  const invite = async () => {
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) {
      toast.error('Enter a valid e-mail address');
      return;
    }
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
          <View className="flex-1">
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="person@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          <Button
            variant="primary"
            icon={Plus}
            onPress={invite}
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
            return (
              <View
                key={inv.invitee_email}
                className="flex-row items-center gap-2 rounded-lg border border-border-main px-3 py-2"
              >
                <View className="flex-1">
                  <Text className="text-sm text-text-heading">
                    {inv.invitee_email}
                  </Text>
                  <Text className="mt-0.5 text-2xs text-text-subtle">
                    Invited {format(parseISO(inv.invited_at), 'MMM d, yyyy')}
                  </Text>
                </View>
                <Badge label={status.label} color={status.color} dot />
                {canInvite ? (
                  <IconButton
                    icon={RotateCw}
                    label={`Resend invite to ${inv.invitee_email}`}
                    size="sm"
                    disabled={busy}
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
            );
          })}
        </View>
      )}
    </View>
  );
}
