# Phase 8 Channel Rules And Tracker Protocol

## Operating Boundary

No outbound action is authorized by this document. Before execution, the user must approve:

- exact recipients or handles,
- exact message copy,
- exact links/UTMs,
- send/post time,
- tracker write scope,
- any Play Console, TestFlight, Firebase, entitlement, or paid-founder action,
- and whether follow-up automation is allowed.

Until then, all artifacts are drafts.
Questions like "can we" are not approval.

## Priority Segments

1. **Warm rated-session users**: already gave product signal; ask for specific feedback or testimonial only after they reply.
2. **One-rating-from-threshold users**: nudge one more rated session only if the prior touch is stale and not unresolved.
3. **Native active pre-loggers**: ask what blocked the first log.
4. **Beginner/high-intent web users**: ask what Quiver needs to explain more clearly.
5. **Reviewer/Instagram warm leads**: manual one-by-one only, using exact hook phrase and no automation.
6. **Android Play beta replies**: only act when a user explicitly confirms the Google email to add.
7. **Public social audience**: founder posts and product proof only.
8. **Reddit**: comment-first only; no launch/sales posts without explicit reopening.

## Suppression Rules

Suppress a recipient if any are true:

- replied within the last 10 days and is waiting on a human answer,
- has an unresolved support/bug thread,
- asked not to be contacted,
- bounced, unsubscribed, rejected, or delivery failed,
- Apple private relay identity is ambiguous or mismatched,
- email uses `privaterelay.appleid.com`,
- recipient is a test/local/internal account,
- Android outreach target has known iOS evidence,
- no clear consent path exists for the channel,
- was already sent the same idea,
- belongs to an excluded current pass in the tracker,
- is marked `not_interested`, `needs-review`, `excluded_generic_author`, or equivalent terminal state,
- is a real user whose email should not be exposed in reports,
- or the draft contains a claim that is not verified for that recipient's platform.

Do not resend the May 20 founding-crew batch without a fresh personal reason.

## Stale Claim Checks

Before every batch:

- Recheck App Store status before changing `Open App Store` to `Download`.
- Recheck TestFlight if linking to beta.
- Recheck pricing gates before mentioning price, checkout, paid lifetime, or cross-platform unlock.
- Recheck whether the user already has Pro, promo Pro, or a native purchase before mentioning founding access.
- Recheck existing email threads before sending a new thread.

Avoid these without fresh verification:

- "launching this month"
- "iOS + Android live"
- "Play Store next"
- "feature-complete"
- "Android parity day one"
- "iOS TestFlight + Android Firebase open now"
- "Firebase beta" when the active path is Play beta
- "sessions save offline"
- "crew invites are open"
- "per-spot accuracy is published"
- "no card" or "14-day trial"
- any live pricing, paywall, paid lifetime, or checkout claim

## Tracker Columns

Use the existing warm-user tracker as the base:

| Field | Rule |
|---|---|
| `lead_id` | Stable id; do not reuse. |
| `source` | `quiver_user`, `native_user`, `session_logger`, `rated_session_user`, `mobile_web`, `ig_warm`, `reviewer`, `manual`. |
| `segment` | One current segment, not a comma list. |
| `email_or_handle` | Keep raw in tracker only; redact in reports. |
| `email_redacted` | Required for any shared report. |
| `outreach_step` | One of `source_review`, `first_log`, `session_memory`, `beginner_feedback`, `founding_waitlist`, `app_store_open`, `reviewer_dm`, `social_comment`, `hold`. |
| `email_status` | `not_started`, `drafted`, `approved_to_send`, `sent_waiting`, `responded_waiting_on_human`, `bounced`, `suppressed`, `hold`, `do_not_contact`. |
| `last_sent_at` | Timestamp with timezone. |
| `last_sent_subject` | Exact subject. |
| `last_response_at` | Timestamp with timezone. |
| `reply_theme` | `wrong_forecast`, `session_memory`, `first_log_friction`, `beginner_clarity`, `pricing`, `app_store`, `bug_report`, `testimonial`, `other`. |
| `next_action` | One concrete human action. |
| `installed_native` | `yes`, `no`, `unknown`. |
| `sessions_logged` | Current count at snapshot time. |
| `rated_sessions` | Current count at snapshot time. |
| `earned_lifetime` | `yes`, `no`, `unknown`; do not grant from this tracker alone. |
| `paid_ltd` | `yes`, `no`, `unknown`; remains no until paid path is verified. |
| `notes` | Short qualitative signal; no secrets. |

For Android Play beta rows, use the Android tracker fields:

| Field | Rule |
|---|---|
| `ios_evidence` | Suppress Android outreach when true or unresolved. |
| `gmail_message_id` | Required after approved email sends. |
| `reply_status` | One of `awaiting_reply`, `not_interested`, `google_email_received`, `approved_to_add`, `added_to_play`, `opt_in_link_sent`, `no_follow_up`. |
| `google_email_to_add` | Only filled from explicit user confirmation. |
| `play_console_status` | Play Console action state; no mutation without approval. |
| `next_action` | One concrete human action. |
| `notes` | Keep concise and redacted. |

Reviewer/Instagram rows need at minimum: `handle` or `review_id`, segment/tier, verbatim hook, channel, sent date, reply/install/paid status, and notes.

## Audit Log Requirements

For every approved outbound action, log:

- operator,
- timestamp,
- channel,
- recipient id or handle,
- redacted destination,
- source segment,
- approved copy file/section,
- subject or post title,
- URL and UTM,
- suppression checks performed,
- approval reference,
- send/post result,
- message id or platform URL if available,
- tracker row id,
- and follow-up date.

## Apple Relay And Bounce Hygiene

- Treat Apple relay emails as identity-sensitive. Do not assume they match a user's primary account.
- Apple relay addresses are not valid for Android/Play tester workflows. Do not infer a real Google email from one.
- If Apple relay and Google/email identities disagree, pause and verify account linkage before sending account-specific copy.
- If a relay bounces, mark `bounced` and suppress further email until the user gives a reachable address.
- If any bounce, rejection, unsubscribe, or negative reply occurs, transition the row to a terminal no-follow-up state unless the user later explicitly reopens the conversation.
- Do not mention purchase, Pro status, or entitlement state to an Apple relay recipient unless it has been verified against the same account id.

## Channel Rules

### Email

- Small batches only.
- One idea and one CTA.
- Reply-first over click-first.
- Internal/test send before real send.
- Tracker write after send.

### Instagram / DMs

- Manual only.
- Use exact observed hook phrase.
- Ask platform/link preference when unknown.
- No sponsorship, equity, paid incentive, or free-Pro promise unless separately approved.

### X / Threads / Public Founder Posts

- Founder voice, product truth, one clear idea.
- Use real product visuals.
- No competitor attack.
- Link sparingly; if linking, use UTM.

### Reddit

- Comment-first, value-first.
- No broad launch posts or sales posts.
- Do not use Reddit as a user-acquisition launch channel unless the user explicitly reopens it.
- If a removal occurs, log it and pause that sub for 14 days.

## Daily Review Questions

- Who replied?
- Who logged or rated a session?
- Who moved closer to five rated sessions?
- Which copy confused people?
- Which users need human support before another touch?
- Which claims or links changed?
- What is blocked?
