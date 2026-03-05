# One-Tap Session Logging from Email

**Date:** 2026-03-04
**Status:** Design approved, ready for implementation

## Problem

Session prompt emails have a 0% click rate (36% open rate). Users open the email but don't click "Log Your Session" because it links to a multi-section form — too much friction for a "did you surf yesterday?" question.

## Solution

Replace the session prompt email CTA with a conversational "Were you out there?" prompt. Tapping "Yes, I surfed!" instantly creates a minimal session via a token-authenticated GET request. No login required, no form, one tap.

## Design

### Email Redesign

Redesign `SessionPromptEmail.tsx` from a "Log Your Session" CTA to:

- **Header:** "{BeachName} was {conditionLabel} yesterday"
- **Subheader:** Conditions score badge (e.g., "7/10")
- **Body:** 1-2 sentences about conditions (reuse existing `surfDescription`)
- **CTA row:** Two buttons side by side:
  - Primary: "Yes, I surfed!" → `GET /session/confirm?token=JWT&beach_id=X&date=YESTERDAY`
  - Secondary/text: "Nah, missed it" → `GET /session/skip?token=JWT`
- **Footer:** Existing unsubscribe/preferences link

Token generated in cron job using existing `generateEmailActionToken()` with purpose `'log_session'`. Embeds userId and beachId. 7-day expiry.

### Confirm Route (`GET /session/confirm`)

Query params: `token`, `beach_id`, `date` (YYYY-MM-DD)

Flow:
1. Verify token via `verifyEmailActionToken(token, 'log_session')` → get userId
2. Dedup: check `sessions` for user + beach + date. If exists, show "Already logged!" page
3. Create minimal session using service role client:
   - `beach_id` from param
   - `arrival_time` = date at 8:00 AM local
   - `status` = `'completed'`
   - `user_id` from token
   - `source` = `'email_one_tap'` (for tracking)
   - No rating, notes, or board
4. Render success page (server-rendered HTML via `renderEmailActionPage()`)

Success page content:
- "Nice! Session logged at {BeachName}"
- "Add rating & details" → `/sessions/{sessionId}/edit`
- "Check today's forecast" → beach page

### Skip Route (`GET /session/skip`)

Query params: `token`

Flow:
1. Verify token (prevent abuse)
2. Render: "No worries! We'll let you know when conditions fire up again."
3. "Check today's forecast" → user's home beach page

### Cron Job Changes

In `/api/cron/session-prompt-email/route.ts`:
- Generate `log_session` token per candidate
- Pass `confirmUrl` and `skipUrl` to email template
- Remove old `logSessionUrl` prop

**No changes to:** candidate selection logic, send schedule, rate limiting, dedup.

## Infrastructure

All infrastructure already exists:
- Token system: `lib/utils/email-token.ts` (JOSE JWT, `'log_session'` purpose already defined)
- Service role pattern: `createSupabaseServiceRoleClient()` for unauthenticated writes
- Email action page renderer: `renderEmailActionPage()` (used by window save route)
- Test token helpers: `e2e/utils/email-token-helpers.ts`

## Testing

- Unit: token generation + verification round-trip
- Integration: `GET /session/confirm` creates session, dedup prevents double-create
- Integration: `GET /session/skip` renders correctly
- E2E: test confirm/skip routes with generated test tokens

## Success Metrics

- Session prompt email click rate: 0% → >10%
- Sessions created via email: track `source: 'email_one_tap'`
- Retention: do one-tap loggers come back and log more sessions?

## Files to Change

1. `lib/mailer/templates/SessionPromptEmail.tsx` — redesign email template
2. `app/api/cron/session-prompt-email/route.ts` — generate tokens, pass new URLs
3. `app/session/confirm/route.ts` — NEW: handle one-tap session creation
4. `app/session/skip/route.ts` — NEW: handle skip/dismiss
5. Tests for the new routes
