# End-to-end lifecycle completion

Scope: web `orch/email-lifecycle-startup-20260911` and native `orch/email-offers-20260912`. Local implementation only; no production migration, provider handoff, scheduler installation or activation. Preserve the existing disabled approval gates.

1. Add an additive offer/automation migration: automatically enroll eligible consented recipients in approved programs, preserve historical five-session rewards, persist claim requests and safe retry times, and expose account-owned offers without manually distributed codes. Inactivity offers require an explicitly approved threshold; no default threshold grants anything.
2. Add versioned runtime API contracts and self-service enrollment/claiming. Claim acceptance is durable: a held claim resumes after existing access ends. Earned rewards survive email opt-out; marketing consent remains separate.
3. Fold offer invitations, progress and earned notices into the existing lifecycle evaluator and its reservation/cap/reply fence. Automatically refresh provider eligibility evidence; never manufacture consent or historical outreach evidence. One-time cutover review is distinct from routine automated operation.
4. Verify RevenueCat identity with its read-only v2 customer/alias APIs before v1 subscriber reads or grant handoff. Preserve unknown-outcome reconciliation without blind repeat grants.
5. Native: show account-owned offers in a feature module, use the authenticated API client, and force an account-pinned entitlement refresh on claim completion/foreground while a claim is pending.
6. Test producer/consumer JSON fixtures, real auth wrappers, database enrollment/replay/retry/exclusion, provider protocol failure paths, and web/native claim UI. Review existing E2E and offline outbox tests before extending them.
7. Run scoped tests first, then web typecheck/Jest/lint/build/Knip and native typecheck/Jest. Render web mobile/desktop. Report unavailable real Gmail/RevenueCat and device canaries explicitly.

Review: no plaintext code persistence, no opt-in inferred from default profile flags, no parallel reward email sender, no new queue infrastructure, no provider grant retry after an ambiguous handoff. One approved configuration and scheduler activation enables routine operation; incidents remain visible and fail closed. Native primary contains unrelated analytics edits; this isolated branch starts from committed HEAD and must preserve those edits during later integration.


## Implemented path (September 12, 2026)

This document supersedes the manual-pilot portions of `email-replies-offers.md`. Implementation is local and inactive. A one-time approved cutover/configuration is required; routine operation does not require manually issuing codes, selecting each five-session recipient, refreshing evidence, or retrying ordinary claims.

1. A user explicitly opts in through web/native lifecycle preferences, or affirmatively changes their existing Email updates setting from off to on. A default-enabled profile is **not consent**. Turning emails off removes consent; turning them back on never clears an unsubscribe suppression or reply pause.
2. The lifecycle job enrolls eligible contacts into the approved campaign after reviewed historical outreach or an approved cutover for genuinely new accounts. It refreshes RevenueCat identity/access evidence automatically. The initial admitted cohort remains bounded at 50; waiting enrollment is visible and alerts after 24 hours.
3. Approved offer programs enroll eligible accounts automatically within their frozen budgets. Five distinct, nondeleted completed session UUIDs, including historical sessions, earn one calendar month. Authenticated session replay cannot count twice. Users can also join this reward without consenting to marketing.
4. An optional approved inactivity rule can issue three calendar months to a non-entitled returning user. No threshold is enabled by this implementation. A pending return offer takes priority over an unearned/unclaimed session offer; the session award remains durable. Earned or already claimed rewards cannot be displaced.
5. All email content uses one evaluator and one reservation/handoff path. A ready reward replaces lower-priority lifecycle content. The email takes the user to their signed-in account; a manually distributed code is no longer needed. Legacy owner-bound codes remain supported.
6. The user explicitly accepts and saves the claim. Fulfillment is automatic from then on: wait for five sessions and for paid/trial/promo/lifetime access to end; reserve once, validate provider identity, hand off a fixed calendar expiry, independently verify the promotional receipt, and repair the web entitlement mirror. Explicitly creating a missing RevenueCat customer is allowed only after the saved user claim.
7. Native Settings shows the same account-owned offer, uses authenticated versioned APIs, and forces an identity-pinned RevenueCat refresh after fulfillment and when returning to the offer surface. Web reloads persisted status on visibility return. Neither client treats a pending response as granted access.
8. Gmail metadata polling records replies and pauses contact before advancing a durable checkpoint. Resend receipts and product activity remain joined to message instances. An authenticated offer-ready link can attribute its claim to the same user's accepted message; arbitrary or cross-account message IDs cannot acquire attribution.

## Lifecycle map and exclusions

| Priority / stage | Eligibility and timing | Exit / exclusion |
| --- | --- | --- |
| Trial support | Verified production trial event **and** matching fresh provider trial product/expiry; 24 hours after start, before trial end minus 24 hours, within first seven days | Target forecast action already taken, sandbox/ambiguous/stale evidence, reply/consent/cap fences |
| Paid or promotional access | Current local or provider access | No growth/offer email; reward can remain saved for later |
| Accepted earned claim | Persisted claim waiting on fulfillment | Quiet while pending; operations queue owns failures |
| Offer ready | Earned approved offer not yet accepted; notice window 30 days from earning | Higher-priority trial/access, existing attempt, acceptance, reply or consent suppression; award itself is retained after notice expiry |
| Day 0 founder welcome | Signup to 48 hours; no prior welcome/founder/trial-start history | Window expires or more relevant state wins |
| Activation | Zero completed sessions, day 3 to day 7 | Session completed, inactivity, higher-priority state; eligible five-session reward copy is included in this single message |
| Progress | One to four completed sessions, 72 hours after last completion, before day 21, recently active | Five reached, inactivity, existing stage attempt; includes historical-session reward explanation only if actually enrolled |
| Friction | Day 7 to day 10, fewer than five sessions, no meaningful use/completion for four days | Reply, resumed use, expiry; one reply CTA |
| Routine | Day 21 to day 28, at least two active days in the last 14, meaningful use in last seven | Inactive, already sent, entitled or otherwise suppressed |
| Reactivation / three-month offer | Only a separately approved meaningful inactivity rule, supported range 14–180 days; no default selected | Current access, conflicting earned/claimed offer, suppression, insufficient evidence or budget |

Founder context appears in the welcome and trial-support content before day 30. The seven-day founder story assets remain campaign material, not an additional scheduled blast. No generic automated reactivation sender or independent reward-notification sender is introduced.

Shared fences: confirmed unique real account; explicit consent/reference; reviewed history; fresh entitlement evidence (six-hour maximum); known timezone and 09:00–17:00 local window; at least 72 hours between contacts; maximum two per seven days and four per 30 days; seven-day manual-contact cooldown; global daily cap; once per job/episode; current approved campaign/version/content hash; healthy reply ingestion and no unresolved handoff. Provider refresh is bounded to six accounts per run; dispatch accepts at most five messages per run. Evidence staleness defers contact rather than guessing.

## Durable operations

| Job to install **after approval** | Cadence | Evidence and failure handling |
| --- | --- | --- |
| `/api/cron/email-replies` | Every minute | Authenticated; `cron_runs`, Gmail lease/cursor/receipt ledger, Sentry check-in. Transient HTTP/transport failures retry from the same cursor; expired history/auth/ambiguous reply evidence requires review and closes outbound eligibility. |
| `/api/cron/email-lifecycle` | Every 15 minutes | Persisted enrollment, decisions, reservations and handoff. Reply scan reused only if fresh. Missing provider evidence, backlog and unknown handoffs produce attention/error status. |
| `/api/cron/pro-offer-reconcile` | Every 15 minutes | Enroll, read-only reconciliation, two due saved claims. Held/pre-handoff failures use persisted exponential retry from 15 minutes up to 24 hours. Unknown handoffs never automatically repeat POST. Old unresolved receipts rotate fairly so they cannot starve other repairs. |

`/admin/email` exposes due/held recipients, reasons, offers, reply health, and recent job runs. No run history is displayed explicitly as **no demonstrated scheduler run**. First-due timestamps survive reevaluation; waiting due mail alerts after 30 minutes and unadmitted consented contacts after 24 hours. The dashboard and alerts need real scheduler/Sentry configuration at activation; code alone is not a deployed monitor.

`email_offer_outcomes` joins claim, award verification and web-mirror evidence to an accepted email instance. Existing delivery/click/reply and product-event ledgers remain authoritative; provider acceptance, delivery, open, click, reply and product outcome are distinct facts. Opens are not proof of human engagement. Neither preview nor tests establish an actual delivered email or native store receipt.

Dry runs: lifecycle `?mode=dry-run` evaluates read-only; offer worker `?mode=dry-run` reads queues with zero grants. `scripts/preview-email-lifecycle.ts` renders synthetic HTML/text without a provider. The new GitHub contract workflow is PR/manual **testing only**, not a send schedule.

## Approval and activation packet

1. Review both isolated diffs and the verification report. Web branch: `orch/email-lifecycle-startup-20260911`; native branch: `orch/email-offers-20260912`. Preserve unrelated native primary-checkout purchase analytics during integration. No commits were made here.
2. Validate the complete migration chain on a disposable/staging copy of the real schema, including contact policy, startup lifecycle, reply ingestion, offer fulfillment and `20260912040000_automated_lifecycle_offers.sql`. Local tests exercise the actual selected migrations against minimal dependencies; they do not certify the full historical schema or production data.
3. Approve exact campaign content hash from the preview manifest, campaign version/expiry, recipient cutover/history evidence, consent import, daily cap and bounded budgets. Default program capacity is 25 awards each (hard maximum 50). Set automatic enrollment, terms and any approved inactivity threshold **in the same approval update**: program fields freeze once approved, except `enabled`. Do not disable freeze triggers in production. Test fixtures do so only to exercise independent scenarios.
4. Configure server-only RevenueCat v1 grant credentials plus the v2 project/key with customer/alias read and explicit customer-create permissions. Verify the real entitlement name. Configure Gmail readonly OAuth, exact destination mailbox and reviewed initial history checkpoint; verify the existing alias forwarding and reply matching with approved test messages. Configure Resend receipts and required unsubscribe/cron secrets.
5. Provision missed-run/failure Sentry monitors before installing the three schedules above. Confirm first healthy reply run and a no-send dry run. Keep the retired legacy cron senders retired. Approve live email activation and promotional grants separately; only then enable environment flags and the approved database controls/programs.
6. Release web before the additive native consumer. Check the matching `contracts/pro-offers-v1.json` in both repositories. Run real authorized iOS/Android account-switch, deep-link, session replay, receipt/webhook, expiry and entitlement-refresh canaries. Current evidence is contract/component/browser testing, not a native device or provider canary.
7. Confirm a bounded live canary in the actual run, delivery, reply and product-outcome ledgers before increasing capacity. Three-month targeting stays off until its threshold is approved. Routine fulfillment needs no founder action; ambiguous external outcomes remain explicit incidents.

## Rollback

Disable lifecycle sending with `EMAIL_LIFECYCLE_ENABLED=false` and database contact controls; disable each offer program (`enabled=false`) to stop new enrollment/grant reservations while retaining read-only reconciliation of prior handoffs. Keep `PRO_OFFERS_ENABLED=true` only if that repair worker is intentionally retained; setting it false stops the entire offer worker. Keep reply polling active if other permitted sends depend on its suppression evidence. Remove/pause the corresponding schedules only through an approved operational change.

Never delete earned awards, claim requests, provider receipts or reply checkpoints; never reset `unknown` into a sendable state without independent provider evidence. Do not re-enable retired legacy email claims or revoke already verified customer access as a code rollback. The migration is additive; prefer feature/program rollback over destructive schema rollback.
