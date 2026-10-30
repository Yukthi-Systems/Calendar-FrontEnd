import type { InviteResponseStatus } from '../services/types';

// Shared between the owner's invitee list (EventInviteesSection) and the
// invitee's own public RSVP page (InviteResponseScreen) — both render the
// same response_info shape.
export const INVITE_STATUS_INFO: Record<
  InviteResponseStatus,
  { label: string; color: string }
> = {
  PENDING: { label: 'Pending', color: '#9ca3af' },
  MAYBE: { label: 'Maybe', color: '#d97706' },
  ACCEPTED: { label: 'Accepted', color: '#059669' },
  DECLINED: { label: 'Declined', color: '#dc2626' },
};

export interface ResponseHistoryEntry {
  status: InviteResponseStatus;
  at: string;
  // Only ever set on a MAYBE entry — how likely the invitee said they are to
  // attend (0–100).
  percentage?: number;
  // Free-text note the invitee gave with a MAYBE or DECLINED response.
  reason?: string;
}

// response_info.responses — written by the invitee's own browser on every
// click, so it's untrusted shape-wise; only well-formed entries are kept.
// percentage/reason are optional even on a well-formed entry (older entries,
// or an ACCEPTED one, never had them).
export const parseResponseHistory = (raw: unknown): ResponseHistoryEntry[] =>
  Array.isArray(raw)
    ? raw.flatMap((e): ResponseHistoryEntry[] => {
        const entry = e as {
          status?: unknown;
          at?: unknown;
          percentage?: unknown;
          reason?: unknown;
        } | null;
        if (
          !entry ||
          typeof entry.status !== 'string' ||
          !(entry.status in INVITE_STATUS_INFO) ||
          typeof entry.at !== 'string'
        ) {
          return [];
        }
        return [
          {
            status: entry.status as InviteResponseStatus,
            at: entry.at,
            ...(typeof entry.percentage === 'number' &&
            entry.percentage >= 0 &&
            entry.percentage <= 100
              ? { percentage: entry.percentage }
              : {}),
            ...(typeof entry.reason === 'string' && entry.reason.trim()
              ? { reason: entry.reason.trim() }
              : {}),
          },
        ];
      })
    : [];

// `previous_status` is real evidence of an earlier response even when it
// predates history tracking (so has no matching `responses` entry) — safe
// lookup against an unknown/possibly-stale value.
export const parsePreviousStatus = (
  raw: unknown,
): InviteResponseStatus | null =>
  typeof raw === 'string' && raw in INVITE_STATUS_INFO
    ? (raw as InviteResponseStatus)
    : null;
