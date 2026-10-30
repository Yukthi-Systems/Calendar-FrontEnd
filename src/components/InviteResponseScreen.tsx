import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { format, parseISO } from 'date-fns';
import CalendarCheck2 from 'lucide-react-native/icons/calendar-check-2';
import CircleCheck from 'lucide-react-native/icons/circle-check';
import CircleHelp from 'lucide-react-native/icons/circle-question-mark';
import CircleX from 'lucide-react-native/icons/circle-x';
import { errorMessage, toast } from '../atoms/feedback';
import {
  statusInfo,
  tagInfo,
  STATUS_FROM_BACKEND,
  TAG_FROM_BACKEND,
} from '../data/constants';
import {
  getPublicInviteInfo,
  respondToInvite,
} from '../services/eventInvitees';
import type {
  InviteResponseStatus,
  PublicInviteInfoResponse,
} from '../services/types';
import { useThemeColors } from '../hooks/useThemeColors';
import type { InviteRouteParams } from '../hooks/useInviteRoute';
import { Badge, Button, Callout } from './ui';

const RESPONSES: {
  key: InviteResponseStatus;
  label: string;
  icon: typeof CircleCheck;
  variant: 'primary' | 'secondary' | 'destructive';
}[] = [
  { key: 'ACCEPTED', label: 'Accept', icon: CircleCheck, variant: 'primary' },
  { key: 'MAYBE', label: 'Maybe', icon: CircleHelp, variant: 'secondary' },
  { key: 'DECLINED', label: 'Decline', icon: CircleX, variant: 'destructive' },
];

// The page an invitee opens from their e-mailed link to respond to a task's
// event — no sign-in: the validation code in the URL is their credential
// (see Tasks-Main-API's /public/event/invite routes). Rendered by App.tsx in
// place of the signed-in app entirely when the URL carries invite params
// (useInviteRoute.ts) — never behind the auth gate.
export function InviteResponseScreen({ route }: { route: InviteRouteParams }) {
  const c = useThemeColors();
  const [info, setInfo] = useState<PublicInviteInfoResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<InviteResponseStatus | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    getPublicInviteInfo(route.validationCode, route.taskId, route.inviteeEmail)
      .then(data => {
        if (!cancelled) {
          setInfo(data);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setLoadError(
            errorMessage(err, 'This invite link is invalid or has expired.'),
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [route.validationCode, route.taskId, route.inviteeEmail]);

  const respond = async (status: InviteResponseStatus) => {
    setResponding(status);
    try {
      // response_info is the schema's own open slot for "additional
      // information about the response (e.g. reason for decline, time of
      // response)" (see Tasks-Main-API's event_invites table). The whole
      // column is replaced on every write (no server-side merge — see
      // update_invite_response), so the full history is carried forward
      // from what was already there each time, not just this one click.
      const respondedAt = new Date().toISOString();
      const prevResponseInfo = info?.event_info.response_info ?? {};
      const prevHistory = Array.isArray(prevResponseInfo.responses)
        ? prevResponseInfo.responses
        : [];
      const prevStatus = info?.event_info.response_status;
      const responseInfo: Record<string, unknown> = {
        responded_at: respondedAt,
        responses: [...prevHistory, { status, at: respondedAt }],
        // Only meaningful once they've actually responded before — the
        // initial PENDING default isn't a response to have changed from.
        ...(prevStatus && prevStatus !== 'PENDING'
          ? { previous_status: prevStatus }
          : {}),
      };
      await respondToInvite(
        route.validationCode,
        route.taskId,
        route.inviteeEmail,
        { status, info: responseInfo },
      );
      setInfo(prev =>
        prev
          ? {
              ...prev,
              event_info: {
                ...prev.event_info,
                response_status: status,
                response_info: responseInfo,
              },
            }
          : prev,
      );
    } catch (err) {
      toast.error('Couldn’t save your response', {
        description: errorMessage(err, 'Please try again.'),
      });
    } finally {
      setResponding(null);
    }
  };

  const task = info?.task_info;
  const tag = task ? tagInfo(TAG_FROM_BACKEND[task.task_tag]) : null;
  const status = task
    ? statusInfo(STATUS_FROM_BACKEND[task.task_status])
    : null;
  const currentResponse = info?.event_info.response_status;

  return (
    <View className="flex-1 items-center justify-center bg-bg-main p-6">
      <View className="w-full max-w-[420px]">
        <View className="mb-8 items-center">
          <View className="mb-5 h-12 w-12 items-center justify-center rounded-xl bg-accent">
            <CalendarCheck2
              size={24}
              color={c.accentForeground}
              strokeWidth={2.25}
            />
          </View>
          <Text className="text-2xl font-semibold text-text-heading">
            Event invite
          </Text>
          <Text className="mt-2 text-center text-base text-text-main">
            {route.inviteeEmail}
          </Text>
        </View>

        <View className="gap-4 rounded-2xl border border-border-main bg-bg-card p-6">
          {loading ? (
            <View className="items-center py-4">
              <ActivityIndicator color={c.accent} />
            </View>
          ) : loadError || !task ? (
            <Callout kind="error" title="Couldn’t open this invite">
              {loadError ?? 'Something went wrong. Please try again.'}
            </Callout>
          ) : (
            <>
              <View className="gap-1.5">
                <Text className="text-lg font-semibold text-text-heading">
                  {task.title}
                </Text>
                {task.description ? (
                  <Text className="text-sm text-text-main">
                    {task.description}
                  </Text>
                ) : null}
                <Text className="text-sm text-text-subtle">
                  {format(parseISO(task.start_at), 'EEE, MMM d, yyyy · h:mm a')}
                </Text>
                <View className="mt-1 flex-row flex-wrap gap-1.5">
                  {tag ? (
                    <Badge label={tag.label} color={tag.color} dot />
                  ) : null}
                  {status ? (
                    <Badge label={status.label} color={status.color} dot />
                  ) : null}
                </View>
              </View>

              {currentResponse && currentResponse !== 'PENDING' ? (
                <Callout kind="info">
                  You responded “
                  {RESPONSES.find(r => r.key === currentResponse)?.label ??
                    currentResponse}
                  ”. You can change your response below.
                </Callout>
              ) : null}

              <View className="gap-2">
                {RESPONSES.map(r => (
                  <Button
                    key={r.key}
                    variant={r.variant}
                    size="lg"
                    icon={r.icon}
                    loading={responding === r.key}
                    disabled={responding !== null}
                    onPress={() => respond(r.key)}
                    className={`w-full ${
                      currentResponse === r.key ? 'opacity-100' : ''
                    }`}
                  >
                    {currentResponse === r.key ? `${r.label} ✓` : r.label}
                  </Button>
                ))}
              </View>
            </>
          )}
        </View>
      </View>
    </View>
  );
}
