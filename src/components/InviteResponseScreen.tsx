import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { format, parseISO } from 'date-fns';
import CalendarCheck2 from 'lucide-react-native/icons/calendar-check-2';
import CircleCheck from 'lucide-react-native/icons/circle-check';
import CircleHelp from 'lucide-react-native/icons/circle-question-mark';
import CircleX from 'lucide-react-native/icons/circle-x';
import ClockIcon from 'lucide-react-native/icons/clock';
import { errorMessage, toast } from '../atoms/feedback';
import {
  statusInfo,
  tagInfo,
  STATUS_FROM_BACKEND,
  TAG_FROM_BACKEND,
} from '../data/constants';
import {
  INVITE_STATUS_INFO,
  parsePreviousStatus,
  parseResponseHistory,
} from '../data/inviteResponse';
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
import { Badge, Button, Callout, Field, Input } from './ui';

const TimingRow = ({ label, value }: { label: string; value: string }) => (
  <View className="flex-row items-center justify-between gap-3">
    <Text className="text-2xs text-text-subtle">{label}</Text>
    <Text className="text-2xs text-text-heading">{value}</Text>
  </View>
);

const formatTiming = (iso: string) =>
  format(parseISO(iso), 'MMM d, yyyy · h:mm a');

const RESPONSES: {
  key: Exclude<InviteResponseStatus, 'PENDING'>;
  label: string;
  icon: typeof CircleCheck;
  variant: 'primary' | 'secondary';
}[] = [
  { key: 'ACCEPTED', label: 'Accept', icon: CircleCheck, variant: 'primary' },
  { key: 'MAYBE', label: 'Maybe', icon: CircleHelp, variant: 'secondary' },
  { key: 'DECLINED', label: 'Decline', icon: CircleX, variant: 'secondary' },
];

// Current response, called out in the colour it actually means — rather than
// one flat "info" notice for every status — so accepting reads as settled,
// declining reads as final, and maybe reads as open. Also drives the
// confirmation screen shown right after responding.
const RESPONSE_BANNER: Record<
  Exclude<InviteResponseStatus, 'PENDING'>,
  {
    icon: typeof CircleCheck;
    box: string;
    tone: 'success' | 'warning' | 'destructive';
    heading: string;
    message: string;
  }
> = {
  ACCEPTED: {
    icon: CircleCheck,
    box: 'border-success/25 bg-success/10',
    tone: 'success',
    heading: 'You’re in',
    message: 'We’ve let them know you’ll be there.',
  },
  MAYBE: {
    icon: CircleHelp,
    box: 'border-warning/30 bg-warning/10',
    tone: 'warning',
    heading: 'Marked as maybe',
    message: 'We’ve let them know you might make it.',
  },
  DECLINED: {
    icon: CircleX,
    box: 'border-destructive/30 bg-destructive/10',
    tone: 'destructive',
    heading: 'Response recorded',
    message: 'We’ve let them know you can’t make it.',
  },
};

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
  // MAYBE/DECLINED ask for optional details first — this is which one is
  // mid-ask (null once confirmed or cancelled). ACCEPTED has nothing to ask,
  // so it never goes through this state.
  const [pendingStatus, setPendingStatus] = useState<
    'MAYBE' | 'DECLINED' | null
  >(null);
  const [percentage, setPercentage] = useState('');
  const [reason, setReason] = useState('');

  const clearPending = () => {
    setPendingStatus(null);
    setPercentage('');
    setReason('');
  };

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

  const respond = async (
    status: InviteResponseStatus,
    extra?: { percentage?: number; reason?: string },
  ) => {
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
      const trimmedReason = extra?.reason?.trim();
      const entry: Record<string, unknown> = { status, at: respondedAt };
      if (extra?.percentage !== undefined) {
        entry.percentage = extra.percentage;
      }
      if (trimmedReason) {
        entry.reason = trimmedReason;
      }
      const responseInfo: Record<string, unknown> = {
        responded_at: respondedAt,
        responses: [...prevHistory, entry],
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
      clearPending();
    } catch (err) {
      toast.error('Couldn’t save your response', {
        description: errorMessage(err, 'Please try again.'),
      });
    } finally {
      setResponding(null);
    }
  };

  // Accept has nothing to ask, so it saves right away; Maybe/Decline open the
  // optional-details panel below instead of saving immediately.
  const startResponse = (key: Exclude<InviteResponseStatus, 'PENDING'>) => {
    if (key === 'ACCEPTED') {
      respond('ACCEPTED');
      return;
    }
    setPendingStatus(key);
    setPercentage('');
    setReason('');
  };

  const confirmPending = () => {
    if (!pendingStatus) {
      return;
    }
    const pct = percentage.trim() ? Number(percentage) : undefined;
    respond(pendingStatus, {
      percentage:
        pct !== undefined && Number.isFinite(pct)
          ? Math.min(100, Math.max(0, Math.round(pct)))
          : undefined,
      reason,
    });
  };

  const task = info?.task_info;
  const tag = task ? tagInfo(TAG_FROM_BACKEND[task.task_tag]) : null;
  const status = task
    ? statusInfo(STATUS_FROM_BACKEND[task.task_status])
    : null;
  const currentResponse = info?.event_info.response_status;
  // Full history of every response this invitee has made, from both this
  // session's writes and whatever was already on the server (same shape as
  // EventInviteesSection's owner-side view — see data/inviteResponse.ts).
  const history = parseResponseHistory(
    info?.event_info.response_info.responses,
  );
  const previousStatus = parsePreviousStatus(
    info?.event_info.response_info.previous_status,
  );
  const showUndatedPrevious = previousStatus !== null && history.length <= 1;
  const hasHistory = history.length > 0 || previousStatus !== null;
  // The percentage/reason behind the current response, if any — the history
  // entry respond() just wrote (or one from a prior visit/session).
  const latestEntry = history.length > 0 ? history[history.length - 1] : null;
  const currentDetails =
    latestEntry?.status === currentResponse ? latestEntry : null;

  const banner =
    currentResponse && currentResponse !== 'PENDING'
      ? RESPONSE_BANNER[currentResponse]
      : null;
  // No response yet → show the pick-a-response form. Once there's one, the
  // confirmation screen takes over, with the other two options still
  // reachable as buttons — no separate "edit" mode to drop into. Either way,
  // a pending MAYBE/DECLINED ask for details takes over both.
  const showForm = !banner;

  return (
    <View className="flex-1 items-center justify-center bg-bg-main p-6">
      <View className="w-full max-w-[420px]">
        <View className="mb-7 items-center">
          <View className="mb-5 h-12 w-12 items-center justify-center rounded-xl bg-accent shadow-sm">
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

        <View className="gap-5 rounded-2xl border border-border-main bg-bg-card p-6 shadow-sm">
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
                <Text className="text-xl font-semibold text-text-heading">
                  {task.title}
                </Text>
                {task.description ? (
                  <Text className="text-sm text-text-main">
                    {task.description}
                  </Text>
                ) : null}
                <View className="mt-1.5 flex-row flex-wrap items-center gap-1.5">
                  {tag ? (
                    <Badge label={tag.label} color={tag.color} dot />
                  ) : null}
                  {status ? (
                    <Badge label={status.label} color={status.color} dot />
                  ) : null}
                  {task.total_sub_tasks > 0 ? (
                    <Text className="text-2xs text-text-subtle">
                      {task.total_sub_tasks} subtask
                      {task.total_sub_tasks === 1 ? '' : 's'}
                    </Text>
                  ) : null}
                </View>
              </View>

              {pendingStatus ? (
                <View className="gap-3 rounded-lg border border-border-main p-3">
                  <View className="flex-row items-center gap-2">
                    {pendingStatus === 'MAYBE' ? (
                      <CircleHelp size={16} color={c.warning} />
                    ) : (
                      <CircleX size={16} color={c.destructive} />
                    )}
                    <Text className="text-sm font-semibold text-text-heading">
                      {pendingStatus === 'MAYBE'
                        ? 'A couple more details'
                        : 'Let them know why (optional)'}
                    </Text>
                  </View>

                  {pendingStatus === 'MAYBE' ? (
                    <Field label="How likely are you to make it?" className="">
                      <Input
                        keyboardType="numeric"
                        value={percentage}
                        onChangeText={t =>
                          setPercentage(t.replace(/[^0-9]/g, '').slice(0, 3))
                        }
                        placeholder="e.g. 60"
                        right={
                          <Text className="text-sm text-text-subtle">%</Text>
                        }
                      />
                    </Field>
                  ) : null}

                  <Field label="Reason (optional)" className="">
                    <Input
                      value={reason}
                      onChangeText={setReason}
                      placeholder={
                        pendingStatus === 'MAYBE'
                          ? 'What’s uncertain?'
                          : 'Why can’t you make it?'
                      }
                      multiline
                      minHeight={56}
                    />
                  </Field>

                  <View className="flex-row gap-2">
                    <Button
                      variant="secondary"
                      size="md"
                      disabled={responding !== null}
                      onPress={clearPending}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      variant={
                        pendingStatus === 'DECLINED' ? 'destructive' : 'primary'
                      }
                      size="md"
                      loading={responding === pendingStatus}
                      disabled={responding !== null}
                      onPress={confirmPending}
                      className="flex-1"
                    >
                      Confirm {pendingStatus === 'MAYBE' ? 'maybe' : 'decline'}
                    </Button>
                  </View>
                </View>
              ) : showForm ? (
                <View className="gap-2">
                  <Button
                    variant="primary"
                    size="lg"
                    icon={CircleCheck}
                    loading={responding === 'ACCEPTED'}
                    disabled={responding !== null}
                    onPress={() => startResponse('ACCEPTED')}
                    className="w-full"
                  >
                    Accept
                  </Button>
                  <View className="flex-row gap-2">
                    <Button
                      variant="secondary"
                      size="lg"
                      icon={CircleHelp}
                      loading={responding === 'MAYBE'}
                      disabled={responding !== null}
                      onPress={() => startResponse('MAYBE')}
                      className="flex-1"
                    >
                      Maybe
                    </Button>
                    <Button
                      variant="secondary"
                      size="lg"
                      icon={CircleX}
                      loading={responding === 'DECLINED'}
                      disabled={responding !== null}
                      onPress={() => startResponse('DECLINED')}
                      className="flex-1"
                    >
                      Decline
                    </Button>
                  </View>
                </View>
              ) : banner ? (
                <View className="items-center gap-3 py-2">
                  <View
                    className="h-14 w-14 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: `${c[banner.tone]}26` }}
                  >
                    <banner.icon
                      size={28}
                      color={c[banner.tone]}
                      strokeWidth={2}
                    />
                  </View>
                  <View className="items-center gap-1">
                    <Text className="text-lg font-semibold text-text-heading">
                      {banner.heading}
                    </Text>
                    <Text className="text-center text-sm text-text-subtle">
                      {banner.message}
                    </Text>
                    {currentDetails?.percentage !== undefined ? (
                      <Text className="text-center text-sm text-text-subtle">
                        {currentDetails.percentage}% likely
                      </Text>
                    ) : null}
                    {currentDetails?.reason ? (
                      <Text className="mt-1 text-center text-sm text-text-main">
                        “{currentDetails.reason}”
                      </Text>
                    ) : null}
                  </View>
                  <View className="w-full flex-row gap-2">
                    {RESPONSES.filter(r => r.key !== currentResponse).map(r => (
                      <Button
                        key={r.key}
                        variant="secondary"
                        size="md"
                        icon={r.icon}
                        loading={responding === r.key}
                        disabled={responding !== null}
                        onPress={() => startResponse(r.key)}
                        className="flex-1"
                      >
                        {r.label}
                      </Button>
                    ))}
                  </View>
                </View>
              ) : null}

              <View className="gap-2 rounded-lg bg-muted px-3 py-2.5">
                <View className="flex-row items-center gap-1.5">
                  <ClockIcon size={13} color={c.subtle} />
                  <Text className="text-2xs font-semibold text-text-subtle">
                    Details
                  </Text>
                </View>
                <View className="gap-1">
                  {task.start_at === task.end_at ? (
                    <TimingRow
                      label="When"
                      value={formatTiming(task.start_at)}
                    />
                  ) : (
                    <>
                      <TimingRow
                        label="Starts"
                        value={formatTiming(task.start_at)}
                      />
                      <TimingRow
                        label="Ends"
                        value={formatTiming(task.end_at)}
                      />
                    </>
                  )}
                  <TimingRow
                    label="Task created"
                    value={formatTiming(task.created_at)}
                  />
                  <TimingRow
                    label="Last updated"
                    value={formatTiming(task.updated_at)}
                  />
                  {info?.event_info.invited_at ? (
                    <TimingRow
                      label="Invited"
                      value={formatTiming(info.event_info.invited_at)}
                    />
                  ) : null}
                  {typeof info?.event_info.response_info.responded_at ===
                  'string' ? (
                    <TimingRow
                      label="Last responded"
                      value={formatTiming(
                        info.event_info.response_info.responded_at as string,
                      )}
                    />
                  ) : null}
                </View>

                {hasHistory ? (
                  <View className="gap-1.5 border-t border-border-main pt-2">
                    <Text className="text-2xs font-semibold text-text-subtle">
                      Response history
                    </Text>
                    <View className="gap-1">
                      {showUndatedPrevious && previousStatus ? (
                        <View className="flex-row items-center gap-2">
                          <Badge
                            label={INVITE_STATUS_INFO[previousStatus].label}
                            color={INVITE_STATUS_INFO[previousStatus].color}
                            dot
                          />
                          <Text className="text-2xs text-text-subtle">
                            Earlier (exact time not recorded)
                          </Text>
                        </View>
                      ) : null}
                      {history.map((h, idx) => {
                        const entryStatus = INVITE_STATUS_INFO[h.status];
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
                  </View>
                ) : null}
              </View>
            </>
          )}
        </View>
      </View>
    </View>
  );
}
