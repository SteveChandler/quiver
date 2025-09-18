# Quiver Notifications — Architecture, Issues, and Realtime Plan

Status: Draft • Last updated: 2025-09-18

## Overview

Quiver currently supports multiple user-facing “notification-like” surfaces:

- In-app activities: `user_activities` drive the social/activity feed and hold certain event-style notifications (e.g., session invite created).
- Inbox invitations: `session_invitations` displayed in `/inbox` with accept/decline actions and a header badge count.
- Email notifications: transactional email for session invites via Resend.
- Toast notifications: gamification XP/badge toasts (user feedback, not inbox).
- Push notifications: not implemented (planned).

This document captures the current implementation, the breakage observed in production, and a proposal to tighten security, improve UX, and add realtime updates.

---

## Current Architecture

### Data Model

- `public.user_activities`

  - Purpose: Store activity feed items and certain in-app notifications.
  - Columns: `id, user_id, activity_type, entity_type, entity_id, metadata, created_at`.
  - Indexes: `user_id, created_at`, `activity_type, created_at`, `entity_type, entity_id`, `created_at`.
  - RLS: Enabled. Current policies allow global SELECT and INSERT of own rows.

- `public.profiles`

  - Includes notification preferences: `inapp_session_invites` (default true), `email_session_invites` (default true), `digest_session_invites` (default false), and other UX toggles not yet wired to senders.

- `public.session_invitations` (not fully documented here)
  - Purpose: Represents actionable invitations a user can accept/decline in `/inbox` and drives the header badge count.

### Server and RPC

- `public.create_activity` (PL/pgSQL; SECURITY DEFINER)

  - Creates a `user_activities` row for a specific user.

- `public.notify_session_invite(p_actor_id, p_recipient_id, p_session_id, p_payload jsonb)` (PL/pgSQL; SECURITY DEFINER)
  - Creates a `user_activities` row owned by the recipient with `activity_type = 'session_invite.created'` and `entity_type = 'session'`.
  - Granted to `authenticated`.

### API Route: Session Invitations

- `POST /api/session-planner/invitations`
  - Authenticates the caller; asserts ownership of the planned session.
  - For each invitee:
    - Checks `profiles` preferences for in-app/email toggles.
    - If in-app enabled: calls `notify_session_invite(...)` to create a recipient-owned activity row.
    - If email enabled and email present: sends a Resend email with CTA to `/inbox`.
  - Also creates/maintains `session_invitations` rows (see existing implementation) used by Inbox and header count.

### Client Surfaces

- `/inbox` page
  - Fetches `GET /api/session-planner/invitations?type=received`.
  - Renders pending invites with accept/decline.
- Header badge count
  - Fetches the same endpoint, counts `status === 'pending'`.
- Social/activity feed
  - Uses `user_activities` to display activities (distinct from Inbox).
- Gamification toasts
  - Uses `sonner` to show XP/badge UI feedback (not stored in Inbox or `user_activities`).

---

## Reported Breakage (Current Behavior)

Observation: A user created a planned session and added another user, but the invited user did not receive an in-app notification.

Implications:

- The expected in-app artifact is either:
  1. A `session_invitations` row (drives Inbox and header badge), and/or
  2. A `user_activities` row via `notify_session_invite` (recipient-owned activity) if in-app invites are enabled for the recipient.
- The reported case indicates one or both artifacts were not created or not visible to the recipient.

Likely root causes to investigate:

- Flow mismatch: Only the plan-session “Invite” flow triggers notifications. If the user “added another user” outside the invitation route (e.g., directly added as participant), no notifications are created by design. Architecture notes state: “Notifications are only generated from plan-session tagging flow.”
- Preferences gating: Recipient’s `inapp_session_invites` may be false; API would skip `notify_session_invite`. This would eliminate the recipient-owned activity row.
- Missing or incorrect recipient identity: If the invitee was specified by email only (no `inviteeUserId`), in-app activity is not created; only email is attempted.
- `session_invitations` row not created or filtered out: If the invitation upsert failed, `/inbox` and header count would show nothing.
- Visibility/RLS mismatch: If `user_activities` or `session_invitations` RLS or policies are misconfigured, the recipient may not see rows.
- RPC not executed: If the code path to `notify_session_invite` was short-circuited (e.g., session not “planned”, auth mismatch), the recipient would not get an activity.

Immediate triage checklist:

1. Confirm the user used the “Invite” UI (session planner) vs another add-user path.
2. In DB, verify a `session_invitations` row exists for the recipient with `status = 'pending'`.
3. In DB, verify a `user_activities` row exists for the recipient with `activity_type='session_invite.created'` and the correct `entity_id`.
4. Check recipient `profiles` toggles for `inapp_session_invites` and `email_session_invites`.
5. Review API logs for `POST /api/session-planner/invitations` for that session/user.
6. Verify the RPC executed (Supabase logs), and that it returned an activity id.

---

## Issues and Risks (Current)

Security

- RPC exposure: `notify_session_invite` is `SECURITY DEFINER` and granted to `authenticated`; any logged-in user could craft an RPC call to create activities for arbitrary recipients.
- Recommendation: Restrict EXECUTE to `service_role` only and call from server using the service client; or enforce `auth.uid()` checks inside the function to ensure `p_actor_id = auth.uid()` and that the actor owns the session.

Privacy

- `user_activities` has a permissive SELECT policy (global readable). Sensitive notifications (invites) might be visible in aggregate.
- Recommendation: Either move private notifications to a dedicated table with stricter RLS or tighten SELECT policies, limiting rows to the owner and allowed audiences.

Read-state

- `user_activities` has no `read_at`; Inbox uses `session_invitations.status` as actionable state. Activity-based notifications cannot be marked read.
- Recommendation: Add `read_at` to `user_activities` for notification-type events, or separate “notifications” table.

Realtime gaps

- Header count and `/inbox` do not subscribe to realtime changes, requiring manual refresh.
- Recommendation: Add Supabase realtime subscriptions for `session_invitations` (and optionally `user_activities`) and trigger `refetch`.

Email robustness

- Best-effort send; no idempotency or retry/backoff; compliance link only in template text.
- Recommendation: Add idempotency, structured error handling, and explicit manage-preferences link.

Inviter response notifications

- TODO present: inviter not notified on accept/decline.
- Recommendation: Create `user_activities` for the inviter on recipient response and optionally email.

Abuse control

- No explicit rate limiting on invites.
- Recommendation: Add per-user caps and basic heuristics.

---

## Proposed Changes

1. Harden `notify_session_invite` authorization

- Option A (preferred): Remove `EXECUTE` for `authenticated`; restrict to `service_role` only. Always invoke from server using the service client.
- Option B: Keep `EXECUTE` for `authenticated` but enforce checks inside the function:
  - `assert auth.uid() = p_actor_id`
  - Verify the actor owns `p_session_id` and session is `planned`.

2. Tighten `user_activities` SELECT policy

- Option A: Restrict to `user_id = auth.uid()` for private activity types like `session_invite.created`.
- Option B: Split private notifications into a `user_notifications` table with strict RLS and read-state.

3. Ensure Inbox rows are always created for actionable invites

- Standardize on `session_invitations` as the source of truth for Inbox and header count.
- Keep `user_activities` invite rows as optional/social-facing signal; they should not be required for Inbox visibility.

4. Add read-state (optional but recommended)

- Add `read_at` to notification-like rows so badges can represent “unread” rather than “pending only”.

5. Add realtime updates

- Subscribe to `session_invitations` changes for the current user and call `refetch()` on insert/update.
- Optionally subscribe to invite-related `user_activities` for the current user to keep any activity-based UI in sync.

6. Email resilience & compliance

- Add idempotency keys for invitation emails.
- Structured logging and retries (or at least clear surfacing when email send is skipped).
- Include explicit “Manage notification preferences” link in template.

7. Notify inviter on response

- On accept/decline, create an activity for the inviter and optionally send email if enabled.

8. Rate limiting

- Add per-user rate limit on invitation creation to prevent spam.

---

## Realtime Update Patterns (Client)

Pattern: Use Supabase channel subscriptions with cleanup and trigger `refetch` from the standard `useDataFetcher` hook.

Subscribe to `session_invitations` for the current user:

```typescript
useEffect(() => {
  if (!user?.id) return;
  const channel = supabase
    .channel(`session_invitations_${user.id}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "session_invitations",
        filter: `invitee_id=eq.${user.id}`,
      },
      () => refetch()
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}, [user?.id, refetch, supabase]);
```

Update header count by triggering `refetch` in the same manner; keep the `useCallback + useDataFetcher` pattern for the fetch function.

Optionally, subscribe to invite-related `user_activities`:

```typescript
useEffect(() => {
  if (!user?.id) return;
  const channel = supabase
    .channel(`user_activities_invites_${user.id}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "user_activities",
        filter: `user_id=eq.${user.id}`,
      },
      (payload) => {
        if (payload?.new?.activity_type === "session_invite.created") {
          refetch();
        }
      }
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}, [user?.id, refetch, supabase]);
```

Notes:

- Always clean up subscriptions in `useEffect` return.
- Avoid inline async in hooks; derive fetch via `useCallback` and hydrate with `useDataFetcher`.

---

## Implementation Notes and Gotchas

- Flow alignment: The invitation route is the canonical source for creating both the Inbox rows and in-app activity. Other ways of “adding” a user to a session may not trigger notifications.
- Preferences: In-app activity for invites is gated by the recipient’s `inapp_session_invites` flag. Email is gated by both `email_session_invites` and the presence of `profiles.email`.
- Session status: API will reject invitations unless the session is `planned`.
- CTA URLs: Email CTA links to `/inbox` with optional `activity` and `focus` query parameters.

---

## Rollout & Testing

- Unit tests: RPC auth guard (if kept public), activity creation logic, email template expansion.
- Integration tests: `POST /api/session-planner/invitations` happy path and preference gating; response notification to inviter.
- Component tests: Header badge updates via realtime; `/inbox` list updates via realtime.
- E2E: Full flow—from creating a planned session, inviting a user, observing header/inbox updates, and handling accept/decline with notifications back to inviter.

---

## Appendix — References

- Invitations API: `/app/api/session-planner/invitations/route.ts`
- Notifications lib: `/lib/notifications.ts`
- Mailer (Resend): `/lib/mailer/sessionInviteEmail.tsx`
- Inbox UI: `/app/inbox/page.tsx`
- Header badge: `/components/app-header.tsx`
- Activity feed: `/hooks/use-activity-feed.ts`, `/components/social/activity-feed.tsx`
