# Plan 062 P0 — Quiver web implementation plan

**Date:** 2026-07-29

**Status:** Planning complete; implementation and all external changes remain approval-gated

**Program source:** `../Brand-Vault/marketing/growth-ops/plans/062-return-log-subscribe-growth-plan.md`

**Scope:** Web-owned P0 work only: WP0.1, WP0.4, WP0.6b, R4, R5, and R6

## Outcome

Ship the web foundation for Plan 062 as seven small, independently revertible
slices:

1. Promote the already-committed implicit-preferences fix from `main` to `prod`.
2. Finish durable Resend delivery/open/click event measurement.
3. Add `List-Unsubscribe` headers to P0-owned engagement sends.
4. Consolidate welcome email rendering onto `lib/mailer/`, remove the retired
   conditions-alert route, and correct the email architecture documentation.
5. Register `acquisition_source_self_reported` across the web event contract and
   add the additive database constraint migration.
6. Close the stale `social_share` gap by standardizing on canonical `share_*`
   events, without adding `social_share` to the API taxonomy.
7. Leave one web `session_log_submit` emission point in client analytics and
   remove the two server-side `user_events` duplicates; `session_created`
   remains the only logged-session north star.

This document is not authorization to commit, push, merge, deploy, configure
Resend/Vercel, send email, or mutate any database.

## Source-of-truth and baseline findings

Implementers must read these before editing:

- `AGENTS.md`
- `CLAUDE.md`
- `docs/ARCHITECTURE.md`
- `docs/GIT_WORKFLOW.md`
- `docs/MIGRATION_SAFETY.md`
- `app/api/ARCHITECTURE.md` for API-route slices
- `supabase/ARCHITECTURE.md` for migration slices
- `docs/free-growth/north-star.md` for R6
- `docs/refactor-roadmap.md` for R5
- `../Brand-Vault/marketing/growth-ops/plans/062-return-log-subscribe-growth-plan.md`
- `../Brand-Vault/marketing/growth-ops/plans/060-trial-conversion-30-day-sprint.md`,
  Task 5, for WP0.6b

Repository inspection found two important pieces of drift from the program
source:

- `app/api/webhooks/resend/route.ts` already verifies Svix signatures and
  updates `email_send_log.delivered_at`, `opened_at`, `clicked_at`, and
  `bounced_at`. It also persists click details to `email_click_events`.
  WP0.4 must extend this consumer with durable per-webhook event rows; it must
  not add a second webhook endpoint or another parallel consumer.
- No production web source currently emits `social_share`. The current share
  surfaces emit `share_started`, `share_completed`, `share_link_copied`,
  `share_image_saved`, or `cam_share`. `docs/refactor-roadmap.md` is stale.
  R5 is therefore a characterization/doc-closure slice unless the clean target
  branch has drifted by execution time.

Git ancestry observed during planning:

- `git merge-base --is-ancestor eb32dc04a origin/main` exited `0`.
- `git merge-base --is-ancestor eb32dc04a origin/prod` exited `1`.
- The local `main` ref was stale; implementation must fetch and use
  `origin/main`/`origin/prod` as the authoritative refs.

## Global execution rules

- Do not use the current dirty worktree for implementation. Create a dedicated
  clean worktree and branch per slice.
- Before each slice:

  ```bash
  git fetch origin --prune
  git status --short
  source ~/.nvm/nvm.sh
  nvm use 22
  ```

- Branch all normal web slices from the latest `origin/main`. WP0.1 is the sole
  exception and branches from `origin/prod`.
- Before editing a directory, re-read its nearest `ARCHITECTURE.md`.
- Do not hand-edit `types/database.generated.ts`.
- Every migration is additive, wrapped in `BEGIN;`/`COMMIT;`, and requires the
  production-owner connection plus the PLAN → APPROVAL protocol.
- Before any production migration, inventory local/remote migration tracking.
  Abort if a dry run contains any migration outside the approved slice.
- Apply an additive schema migration before deploying code that requires the
  new table or constraint.
- GitHub Actions are unavailable. Local checks are the release gate.
- Do not touch:

  - `lib/mailer/templates/SessionPromptEmail.tsx`
  - `app/api/cron/session-prompt-email/route.ts`
  - tests whose only subject is the session-prompt template/cron, except to
    verify they remain unchanged
  - `.planning/STATE.md`
  - any GSD phase directory

- No E2E test is expected for these server/schema/taxonomy slices. If execution
  changes browser-visible share or session behavior beyond the plan, stop and
  add a targeted Playwright plan before proceeding.

## Slice map

| Slice | Branch | Scope | Dependency |
|---|---|---|---|
| S1 | `codex/plan-062-wp0-1-prod-slice` | WP0.1 targeted prod promotion | First |
| S2 | `codex/plan-062-wp0-4-email-events` | WP0.4 durable Resend events | After S1 approval lane is clear |
| S3 | `codex/plan-062-wp0-4-unsubscribe` | WP0.4 `List-Unsubscribe` headers | After S2 or independently from current `main` |
| S4 | `codex/plan-062-r4-email-consolidation` | R4 welcome stack, retired route, docs | Base on `main` after S3 to avoid welcome-route conflicts |
| S5 | `codex/plan-062-wp0-6b-acquisition-event` | WP0.6b web taxonomy + migration | Independent; serialize prod DB approval after S2 |
| S6 | `codex/plan-062-r5-share-taxonomy` | R5 canonical share events | Independent |
| S7 | `codex/plan-062-r6-session-submit` | R6 single submit emission | Independent |

Each slice gets its own PR and revert. Do not combine migration tracking,
email rendering, share taxonomy, and session analytics into one release commit.

---

## S1 — WP0.1 targeted production promotion

### Objective

Promote only commit `eb32dc04a` and its migration
`supabase/migrations/20260727230000_fix_implicit_preferences_centroid_rounding.sql`
from `main` to `prod`, verify the local production build, then use the
production-owner PLAN → APPROVAL protocol to apply exactly that migration.

### Files in the slice

Carried by the existing atomic commit:

- `supabase/migrations/20260727230000_fix_implicit_preferences_centroid_rounding.sql`
- `__tests__/migrations/implicit-preferences-centroid-rounding.test.ts`
- `CHANGELOG.md`

Reviewed but not modified:

- `app/api/cron/update-implicit-preferences/route.ts`
- `__tests__/app/api/cron/update-implicit-preferences.test.ts`
- `vercel.json`
- `supabase/migrations/20260723120000_optimize_implicit_preferences_batch.sql`

### Ordered steps

1. Verify authoritative ancestry after fetching:

   ```bash
   git fetch origin
   if ! git merge-base --is-ancestor eb32dc04a origin/main; then
     echo "eb32dc04a is not on origin/main"
     exit 1
   fi
   if git merge-base --is-ancestor eb32dc04a origin/prod; then
     echo "eb32dc04a is already on origin/prod"
     exit 1
   fi
   ```

   Expected: the commit is an ancestor of `origin/main` and is not an ancestor
   of `origin/prod`. If either result differs, stop and re-scope the slice.

2. Create a clean prod-slice worktree and branch:

   ```bash
   git worktree add ../quiver-plan-062-wp0-1-prod-slice \
     -b codex/plan-062-wp0-1-prod-slice origin/prod
   cd ../quiver-plan-062-wp0-1-prod-slice
   git cherry-pick eb32dc04a
   ```

   If the cherry-pick conflicts outside `CHANGELOG.md`, abort rather than
   broadening the release. A `CHANGELOG.md` conflict may be resolved by keeping
   both release histories and only the original WP0.1 entry.

3. Prove the slice contains only the intended commit payload:

   ```bash
   git log --oneline origin/prod..HEAD
   git diff --name-status origin/prod...HEAD
   git diff --check origin/prod...HEAD
   git diff eb32dc04a^ eb32dc04a -- \
     supabase/migrations/20260727230000_fix_implicit_preferences_centroid_rounding.sql \
     __tests__/migrations/implicit-preferences-centroid-rounding.test.ts \
     | git patch-id --stable
   git diff HEAD^ HEAD -- \
     supabase/migrations/20260727230000_fix_implicit_preferences_centroid_rounding.sql \
     __tests__/migrations/implicit-preferences-centroid-rounding.test.ts \
     | git patch-id --stable
   ```

   The two `git patch-id --stable` outputs must have the same patch ID. The
   diff must contain only the three files listed above. Scoping the patch-ID
   comparison to the migration and its test allows a mechanical
   `CHANGELOG.md` conflict resolution without weakening the code-equivalence
   check.

4. Run the focused and release checks:

   ```bash
   yarn test:unit --runInBand \
     __tests__/migrations/implicit-preferences-centroid-rounding.test.ts \
     __tests__/app/api/cron/update-implicit-preferences.test.ts
   npx eslint --max-warnings=0 \
     __tests__/migrations/implicit-preferences-centroid-rounding.test.ts \
     __tests__/app/api/cron/update-implicit-preferences.test.ts
   yarn typecheck
   yarn test:unit --bail=0
   VERCEL_ENV=production yarn build
   ```

5. Review the diff as a release PR. Confirm the function change is limited to
   casting the centroid ratios to `numeric` before `round(..., 6)` and that the
   migration remains `CREATE OR REPLACE FUNCTION`, not a destructive schema
   change.

6. **OPERATOR MERGE GATE:** Push/open/merge the PR to `prod` only after the
   operator reviews the targeted diff and local command results. Do not merge
   `main` wholesale and do not merge `prod` back into `main`.

### Production database PLAN → APPROVAL

7. Perform read-only preflight with the production-owner connection:

   - Confirm a fresh production backup exists from the last 24 hours.
   - Name the backup in the PLAN, for example
     `quiver-prod-pre-20260727230000-<UTC timestamp>.dump`.
   - Query migration tracking:

     ```sql
     SELECT version, name
     FROM supabase_migrations.schema_migrations
     WHERE version = '20260727230000';
     ```

   - Query the live function definition and confirm the fixed numeric casts are
     absent before application:

     ```sql
     SELECT pg_get_functiondef(
       'public.compute_implicit_preferences(uuid)'::regprocedure
     );
     ```

   - From the clean prod-slice worktree run:

     ```bash
     supabase migration list --linked
     supabase db push --linked --dry-run
     ```

     The dry run must show exactly migration `20260727230000`. Any additional
     pending version is a blocking drift investigation, not part of this slice.

8. **OPERATOR PLAN GATE:** Produce the exact PLAN text containing:

   - migration path and git commit;
   - target production project and production-owner role/connection;
   - object affected:
     `public.compute_implicit_preferences(uuid)`;
   - statement class: `CREATE OR REPLACE FUNCTION`;
   - backup artifact name and time;
   - the dry-run output proving only one pending migration;
   - verification queries;
   - rollback procedure below.

   Hash the final PLAN text. The approval token must be
   `APPROVE: <sha>` as required by `docs/MIGRATION_SAFETY.md`.

9. **OPERATOR APPROVAL GATE:** Only after the matching approval token, apply
   from the prod-slice worktree with the production-owner connection:

   ```bash
   supabase db push --linked
   ```

   Do not use `claude_migrator`, raw dashboard SQL, or an MCP migration call.

10. Verify immediately:

    ```sql
    SELECT version, name
    FROM supabase_migrations.schema_migrations
    WHERE version = '20260727230000';

    SELECT pg_get_functiondef(
      'public.compute_implicit_preferences(uuid)'::regprocedure
    );
    ```

    The tracking row must exist and the function must contain the two
    `)::numeric, 6` centroid-rounding casts.

### Scheduled post-fix acceptance

11. Wait for three consecutive scheduled executions at `03:30 UTC`; manual
    success does not substitute for the three scheduled successes.

12. After the third window, run the read-only verification:

    ```sql
    SELECT
      started_at,
      status,
      summary #>> '{data,processedUsers}' AS processed_users,
      summary #>> '{data,deletedExpiredEvents}' AS deleted_expired_events,
      error_message
    FROM public.cron_runs
    WHERE route = '/api/cron/update-implicit-preferences'
      AND started_at >= :migration_applied_at
    ORDER BY started_at DESC
    LIMIT 3;

    SELECT count(*) AS expired_events_remaining
    FROM public.user_events
    WHERE expires_at < now();
    ```

    Acceptance:

    - all three rows are scheduled invocations with `status = 'ok'`;
    - all three summaries contain `processedUsers`;
    - all three summaries contain `deletedExpiredEvents`, including a valid
      zero, proving `cleanup_expired_events` completed;
    - `expired_events_remaining = 0` at verification time;
    - no row contains the former
      `round(double precision, integer) does not exist` error.

    Correlate each `started_at` with the Vercel cron invocation history for the
    `03:30 UTC` schedule. `cron_runs` does not record trigger provenance, so a
    row created by a manual call cannot be counted solely because it falls
    inside the observation period.

### Rollback

- A git revert removes the migration file from a later code deployment but does
  not undo the already-applied database function.
- Never edit or delete the applied migration or its tracking row.
- If the new function causes an unexpected regression, pause the cron and
  prepare a separately reviewed compensating `CREATE OR REPLACE FUNCTION`
  migration using the last known function body. This is another PLAN →
  APPROVAL action. Reinstating the old body also reinstates the rounding bug, so
  it is an emergency containment action only.

---

## S2 — WP0.4 durable Resend delivery/open/click events

### Objective

Extend the existing signed Resend webhook so each delivery/open/click webhook
is durably stored per Resend message and remains queryable even when
`email_send_log` linkage races the webhook. Keep the existing first-event
summary timestamps and `email_click_events` link-detail table.

### Files to create

- `supabase/migrations/20260730120000_create_email_delivery_events.sql`
- `__tests__/migrations/email-delivery-events.test.ts`

### Files to modify

- `app/api/webhooks/resend/route.ts`
- `__tests__/app/api/webhooks/resend.test.ts`

Reviewed but intentionally retained:

- `supabase/migrations/20260210150000_add_resend_webhook_tracking.sql`
- `supabase/migrations/20260522150000_create_email_click_events.sql`
- `__tests__/migrations/email-click-events.test.ts`
- `lib/services/email-logging-service.ts`

### Target schema

Create `public.email_delivery_events` beside `email_send_log`:

- `id bigserial primary key`
- `email_send_log_id bigint null references public.email_send_log(id) on delete cascade`
- `resend_message_id text not null`
- `webhook_message_id text not null`
- `event_type text not null` constrained to the supported Resend values
  `email.delivered`, `email.opened`, `email.clicked`, and `email.bounced`
- `event_at timestamptz not null`
- `created_at timestamptz not null default now()`
- unique index on `webhook_message_id`
- indexes on `resend_message_id`, `email_send_log_id`, and
  `(event_type, event_at desc)`
- RLS enabled; no anon/authenticated policies; table and sequence privileges
  granted only to `service_role`
- no link, user-agent, raw-IP, or free-form metadata columns; click details
  remain in the existing `email_click_events` table

The additive migration must use `IF NOT EXISTS` where supported, add comments,
issue `NOTIFY pgrst, 'reload schema'`, and remain inside
`BEGIN;`/`COMMIT;`.

### Ordered steps

1. Add a migration characterization test that proves:

   - the migration is transactional;
   - the table is additive;
   - the FK and unique webhook-message index exist;
   - the event-type constraint includes delivery/open/click;
   - RLS and service-role-only grants exist;
   - no `DELETE`, `TRUNCATE`, core `DROP TABLE`, or raw IP storage appears.

2. Refactor the existing webhook handler, not its route or authentication:

   - preserve Svix verification and the `withRateLimit(..., "webhook-resend")`
     wrapper;
   - resolve `email_send_log.id` when available, but allow a null FK and retain
     `resend_message_id` when a webhook arrives before the log row;
   - insert one `email_delivery_events` row before updating the
     `email_send_log` summary timestamp;
   - use `svix-id` as `webhook_message_id`;
   - treat unique violation `23505` as an idempotent replay and continue;
   - return a retryable 5xx response when the durable event insert fails for a
     non-duplicate reason;
   - after a replay, continue the summary-timestamp update so a prior partial
     attempt can heal;
   - keep `email_click_events` insertion for link-level click analysis;
   - store click URL and user agent only in `email_click_events`, never the
     Resend IP field;
   - keep hard-bounce suppression behavior unchanged.

3. Extend webhook tests for:

   - delivery, open, and click event-row inserts;
   - linkage when `email_send_log` exists;
   - null linkage when it does not;
   - out-of-order webhook delivery;
   - duplicate `svix-id` replay;
   - durable insert failure returning a retryable error;
   - summary update failure after a durable insert not deleting the event;
   - click privacy: no raw IP persisted;
   - hard-bounce suppression parity.

4. Run:

   ```bash
   yarn test:unit --runInBand \
     __tests__/app/api/webhooks/resend.test.ts \
     __tests__/migrations/email-delivery-events.test.ts \
     __tests__/migrations/email-click-events.test.ts
   npx eslint --max-warnings=0 \
     app/api/webhooks/resend/route.ts \
     __tests__/app/api/webhooks/resend.test.ts \
     __tests__/migrations/email-delivery-events.test.ts
   yarn typecheck
   VERCEL_ENV=preview yarn build
   git diff --check
   ```

5. Review the diff and confirm no second webhook route, no changes to signature
   validation, and no raw-IP persistence.

6. **OPERATOR MERGE GATE:** Merge the main-targeted PR only after focused tests,
   typecheck, preview build, and migration review pass.

### Production approval and rollout

7. **OPERATOR PLAN GATE:** Inventory the production migration ledger, name a
   fresh backup, and run `supabase db push --linked --dry-run` from a clean
   branch containing this migration. The PLAN must show only
   `20260730120000`.

8. **OPERATOR APPROVAL GATE:** Apply the migration with the production-owner
   connection before promoting the webhook code to `prod`.

9. Verify the table, constraints, indexes, RLS, and grants through read-only
   catalog queries. Then promote the code through the normal `main → prod`
   release path.

10. Read-only verify that the Resend webhook subscription and production
    `RESEND_WEBHOOK_SECRET` already cover `email.delivered`, `email.opened`, and
    `email.clicked`.

11. **OPERATOR EXTERNAL-CONFIG GATE:** If the webhook event subscription or
    Vercel secret is missing, changing Resend/Vercel configuration requires a
    separate explicit approval. Do not rotate secrets during this slice unless
    the operator approves the rotation plan.

12. **OPERATOR SEND GATE:** A controlled real email/webhook test is an outbound
    send and requires explicit approval. If approved, use an operator-owned test
    recipient and confirm one send row plus matching delivery/open/click event
    rows. Do not send to a customer cohort.

### Measurement acceptance query

Use `email_send_log.resend_message_id` for provider events and
`email_send_log.meta->>'message_instance_id'` for native-open attribution:

```sql
WITH sends AS (
  SELECT
    esl.id,
    esl.email_type,
    esl.resend_message_id,
    esl.meta->>'message_instance_id' AS message_instance_id
  FROM public.email_send_log esl
  WHERE esl.sent_at >= :start_at
    AND esl.sent_at < :end_at
),
provider AS (
  SELECT
    s.email_type,
    s.id,
    bool_or(ede.event_type = 'email.delivered') AS delivered,
    bool_or(ede.event_type = 'email.opened') AS opened,
    bool_or(ede.event_type = 'email.clicked') AS clicked
  FROM sends s
  LEFT JOIN public.email_delivery_events ede
    ON ede.resend_message_id = s.resend_message_id
  GROUP BY s.email_type, s.id
),
native AS (
  SELECT DISTINCT ue.metadata->>'message_instance_id' AS message_instance_id
  FROM public.user_events ue
  WHERE ue.event_type = 'native_open_from_email'
    AND ue.created_at >= :start_at
    AND ue.created_at < :end_at
)
SELECT
  s.email_type,
  count(*) AS sends,
  count(*) FILTER (WHERE p.delivered) AS delivered,
  count(*) FILTER (WHERE p.opened) AS opened,
  count(*) FILTER (WHERE p.clicked) AS clicked,
  count(*) FILTER (WHERE n.message_instance_id IS NOT NULL) AS native_opens
FROM sends s
JOIN provider p ON p.id = s.id
LEFT JOIN native n ON n.message_instance_id = s.message_instance_id
GROUP BY s.email_type
ORDER BY s.email_type;
```

Acceptance: send→delivery→open→click is queryable by `email_type`; sends whose
links carry `message_instance_id` can additionally join to
`native_open_from_email`.

### Rollback

- Revert the handler change to stop writing new per-event rows. The existing
  `email_send_log` first-event timestamps and `email_click_events` remain.
- Do not drop `email_delivery_events` or its data during normal rollback.
  Removal requires a later destructive migration, retention decision, fresh
  backup, and separate PLAN → APPROVAL.

---

## S3 — WP0.4 `List-Unsubscribe` headers

### Objective

Provide one typed mailer entry point that can add a valid
`List-Unsubscribe: <https://...>` header without changing transactional sends
or the Phase 27-owned session-prompt email.

### Files to create

- `__tests__/lib/mailer/client.test.ts`

### Files to modify

- `lib/mailer/client.ts`
- `app/api/cron/welcome-email/route.ts`
- `app/api/internal/send-welcome-email/route.ts`
- `app/api/cron/weekly-recap-email/route.ts`
- `app/api/cron/first-session-nudge/route.ts`
- `app/api/cron/condition-alert-deliver/route.ts`
- `__tests__/api/cron/welcome-email.test.ts`
- `__tests__/api/internal/send-welcome-email.test.ts`
- `__tests__/app/api/cron/weekly-recap-email.test.ts`
- `__tests__/app/api/cron/first-session-nudge.test.ts`
- `__tests__/api/cron/condition-alert-deliver.test.ts`

Explicitly unchanged:

- `app/api/cron/session-prompt-email/route.ts`
- `lib/mailer/templates/SessionPromptEmail.tsx`
- `app/api/app-link-email/route.ts`
- `lib/mailer/android-beta.ts`

The last two are transactional messages and do not belong in the engagement
unsubscribe slice.

### Ordered steps

1. In `lib/mailer/client.ts`, retain the current lazy `resend` proxy and E2E
   suppression behavior. Add a typed `sendEmail` wrapper that:

   - accepts the same Resend send fields used by current callers;
   - accepts an optional `unsubscribeUrl` wrapper-only property;
   - removes `unsubscribeUrl` before calling Resend;
   - merges existing caller headers without overwriting them;
   - sets `List-Unsubscribe` to `<${unsubscribeUrl}>` when supplied;
   - rejects non-HTTPS unsubscribe URLs in production;
   - does not add `List-Unsubscribe-Post` in this slice because the existing
     endpoint implements GET, not RFC 8058 POST.

2. Reuse the existing HMAC mechanism:

   - call `generateEmailUnsubscribeToken(userId)`;
   - construct
     `/api/alerts/unsubscribe-email?user_id=<id>&token=<token>`;
   - pass that URL as `unsubscribeUrl` for welcome, weekly recap,
     first-session nudge, and condition-alert delivery.

   Do not invent a second preference table or unsubscribe route.

3. Replace only the listed engagement call sites with `sendEmail`. Leave the
   raw `resend` export available for transactional sends and for the untouched
   session-prompt owner.

4. Add tests proving:

   - existing headers survive;
   - the header value is angle-bracketed;
   - the wrapper-only property is not sent to Resend;
   - E2E send suppression still works;
   - each migrated engagement route supplies a signed unsubscribe URL;
   - condition-alert delivery preserves its existing body unsubscribe link;
   - no session-prompt source or test changed.

5. Run:

   ```bash
   yarn test:unit --runInBand \
     __tests__/lib/mailer/client.test.ts \
     __tests__/api/cron/welcome-email.test.ts \
     __tests__/api/internal/send-welcome-email.test.ts \
     __tests__/app/api/cron/weekly-recap-email.test.ts \
     __tests__/app/api/cron/first-session-nudge.test.ts \
     __tests__/api/cron/condition-alert-deliver.test.ts \
     __tests__/api/alerts/email-action-routes.test.ts
   npx eslint --max-warnings=0 \
     lib/mailer/client.ts \
     app/api/cron/welcome-email/route.ts \
     app/api/internal/send-welcome-email/route.ts \
     app/api/cron/weekly-recap-email/route.ts \
     app/api/cron/first-session-nudge/route.ts \
     app/api/cron/condition-alert-deliver/route.ts \
     __tests__/lib/mailer/client.test.ts
   yarn typecheck
   VERCEL_ENV=preview yarn build
   git diff --check
   ```

6. **OPERATOR MERGE GATE:** Review route-by-route recipient and URL generation
   before merge. No outbound validation email is authorized by the PR.

7. **OPERATOR SEND GATE:** If a real header inspection is required after prod
   deployment, obtain explicit approval for one operator-owned test send.

### Rollback

- Revert call sites to `resend.emails.send` and remove the wrapper.
- Body unsubscribe links and the master `notif_email_enabled` preference remain
  unchanged.
- Do not remove the existing unsubscribe endpoint as part of rollback.

---

## S4 — R4 email stack consolidation and architecture correction

### Objective

Move welcome email rendering to the React Email stack in `lib/mailer/`, delete
the two legacy welcome-template files after semantic parity, delete the already
retired `conditions-alert-email` route, and document the actual active email
system.

### Files to create

- `lib/mailer/templates/WelcomeEmail.tsx`
- `lib/mailer/welcome-email.tsx`
- `__tests__/lib/mailer/templates/WelcomeEmail.test.tsx`

### Files to modify

- `app/api/cron/welcome-email/route.ts`
- `app/api/internal/send-welcome-email/route.ts`
- `scripts/send-test-welcome.ts`
- `__tests__/api/cron/welcome-email.test.ts`
- `__tests__/api/internal/send-welcome-email.test.ts`
- `docs/ARCHITECTURE.md`

### Files to delete

- `lib/email/templates/welcome-email-html.ts`
- `lib/email/templates/welcome-email.ts`
- `__tests__/lib/email/welcome-email-html.test.ts`
- `app/api/cron/conditions-alert-email/route.ts`
- `__tests__/app/api/cron/conditions-alert-email.test.ts`

### Welcome parity contract

The React Email replacement must preserve:

- subject: `Your forecast is live`;
- home-beach and no-home-beach variants;
- the single primary CTA in each variant;
- `buildBeachEmailLink`/`buildAppEmailLink` attribution;
- `email_type=welcome`;
- `message_instance_id`;
- `utm_campaign=home_beach_set|no_home_beach`;
- the current forecast-first body meaning and Steven signoff;
- plain-text output;
- `email_send_log` fields and deduplication behavior.

Exact raw HTML parity is not required; semantic content, attribution, and email
client-safe rendering are.

### Ordered steps

1. Build `WelcomeEmail.tsx` from existing `lib/mailer/components.tsx` and
   `lib/mailer/theme.ts`. Keep URL construction outside visual markup.

2. Add `lib/mailer/welcome-email.tsx` as the welcome contract:

   - typed input props;
   - subject constant;
   - variant-specific CTA/link/copy derivation;
   - React element for Resend's `react` field;
   - plain-text alternative;
   - no unused `secret` parameter.

3. Write the new template test first by porting every meaningful assertion from
   `welcome-email-html.test.ts`. Render the React component in the test and
   verify visible content, CTA hrefs, message attribution, and text output for
   both variants.

4. Change both welcome routes to import only from
   `@/lib/mailer/welcome-email`. Remove `getEmailTokenSecret` imports/calls from
   those routes; keep authentication, candidate selection, auto-confirmation,
   suppression, deduplication, rate limiting, and delivery logging unchanged.

5. Update `scripts/send-test-welcome.ts` to the new React Email contract, but do
   not execute it during implementation. It is an outbound-send tool and
   remains operator-gated.

6. Delete the legacy welcome files only after new tests pass and
   `rg` shows no imports:

   ```bash
   rg -n 'welcome-email-html|lib/email/templates/welcome-email' \
     app lib scripts __tests__
   ```

7. Delete the retired `conditions-alert-email` route and its route-only test.
   Do not modify `condition-alert-deliver`; it is the canonical live
   replacement. Confirm `vercel.json` has no legacy cron entry before deletion.

8. Correct `docs/ARCHITECTURE.md`:

   - remove the nonexistent Forecast Digest from the active email table;
   - mark re-engagement and `conditions-alert-email` as retired historical
     paths, not active sends;
   - list active scheduled email delivery exactly as configured in
     `vercel.json`: welcome fallback (`0 */6 * * *`), weekly recap
     (`0 2 * * 1`), session prompt (`30 18 * * *`), first-session nudge
     (`30 */6 * * *`), and canonical condition-alert delivery
     (`0 * * * *`), all in UTC;
   - describe `email_send_log`, `email_delivery_events`, and
     `email_click_events`;
   - identify `app/api/webhooks/resend/route.ts` as the signed provider-event
     consumer;
   - update the later “Email Engagement” feature-status line so it no longer
     claims forecast digests or re-engagement are active;
   - retain the re-engagement design document only as historical/retired
     documentation.

9. Run:

   ```bash
   yarn test:unit --runInBand \
     __tests__/lib/mailer/templates/WelcomeEmail.test.tsx \
     __tests__/api/cron/welcome-email.test.ts \
     __tests__/api/internal/send-welcome-email.test.ts \
     __tests__/app/api/webhooks/resend.test.ts \
     __tests__/api/cron/condition-alert-deliver.test.ts
   npx eslint --max-warnings=0 \
     lib/mailer/templates/WelcomeEmail.tsx \
     lib/mailer/welcome-email.tsx \
     app/api/cron/welcome-email/route.ts \
     app/api/internal/send-welcome-email/route.ts \
     scripts/send-test-welcome.ts \
     __tests__/lib/mailer/templates/WelcomeEmail.test.tsx
   yarn typecheck
   VERCEL_ENV=preview yarn build
   git diff --check
   ```

10. Review the rendered HTML from the unit test fixture for both variants.
    Confirm the CTA remains singular and that no session-prompt file appears in
    the diff.

11. **OPERATOR MERGE GATE:** Merge only after semantic parity, build, and the
    deletion inventory pass.

12. **OPERATOR SEND GATE:** Do not run `scripts/send-test-welcome.ts` without
    explicit approval and an operator-provided recipient.

### Rollback

- Revert the slice as one commit to restore the legacy generator and retired
  route stub.
- Because S3 lands first, restored welcome routes must continue using the S3
  mailer wrapper/header contract after a partial R4 rollback. Resolve that
  mechanically; do not remove `List-Unsubscribe`.
- No database rollback is involved.

---

## S5 — WP0.6b acquisition self-report event contract

### Objective

Register `acquisition_source_self_reported` as an authenticated-only,
zero-weight web event and widen the production
`user_events_event_type_check` additively before the native prompt can ship.

### Files to create

- `supabase/migrations/20260730121000_add_acquisition_source_self_reported_event.sql`
- `__tests__/migrations/acquisition-source-self-reported.test.ts`

The stale proposed Task 5 filename
`20260716120000_add_acquisition_source_self_reported_event.sql` was never
created and predates many already-landed migrations. Use the new monotonic,
collision-free timestamp above; do not backdate a new migration.

### Files to modify

- `lib/analytics/event-taxonomy.ts`
- `types/implicit-preferences.ts`
- `__tests__/lib/analytics/event-taxonomy.test.ts`
- `__tests__/api/events-taxonomy-characterization.test.ts`
- `__tests__/api/events-allowlist-db-sync.test.ts`

Review only:

- `app/api/events/route.ts`

No route edit is expected because it already re-exports the shared arrays.

### Locked event contract

```ts
type AcquisitionSource =
  | "tiktok"
  | "app_store_search"
  | "google_or_web_search"
  | "friend"
  | "instagram"
  | "other";

interface AcquisitionSourcePayload {
  self_reported_source: AcquisitionSource;
  prompt_surface: "home_after_forecast_value";
  prompt_version: "v1";
}
```

Web rules:

- add `acquisition_source_self_reported` to `VALID_EVENTS`;
- add it to `EVENT_WEIGHTS` with weight `0`;
- do not add it to `ANONYMOUS_ALLOWED_EVENTS`;
- do not add it to `PRE_AUTH_ONLY_EVENTS`;
- do not classify it as external-analytics-only;
- preserve `ImplicitEventType = EventType`;
- do not implement the native prompt in this repo.

### Ordered steps

1. Add the taxonomy literal and zero weight.

2. Add focused tests that prove authenticated-only group membership, zero
   weight, route re-export identity, and updated event-set hash.

3. Add the migration using the current-check preservation pattern from
   `20260725121000_add_app_handoff_native_open_event.sql`:

   - read the current check with `pg_get_constraintdef`;
   - raise if the constraint is missing;
   - no-op if the exact event is already present;
   - drop/recreate only `user_events_event_type_check`;
   - combine the preserved current expression with the one missing event;
   - do not restate a stale full static allowlist;
   - `NOTIFY pgrst, 'reload schema'`;
   - wrap in `BEGIN;`/`COMMIT;`.

4. Add a migration test proving current-expression preservation,
   idempotent/no-op behavior, exact event spelling, transaction boundaries, and
   absence of data deletion.

5. Run the Plan 060 web gates plus migration coverage:

   ```bash
   yarn test:unit --runInBand \
     __tests__/lib/analytics/event-taxonomy.test.ts \
     __tests__/api/events-taxonomy-characterization.test.ts \
     __tests__/api/events-allowlist-db-sync.test.ts \
     __tests__/migrations/acquisition-source-self-reported.test.ts
   npx eslint --max-warnings=0 \
     lib/analytics/event-taxonomy.ts \
     types/implicit-preferences.ts \
     __tests__/lib/analytics/event-taxonomy.test.ts \
     __tests__/api/events-taxonomy-characterization.test.ts \
     __tests__/api/events-allowlist-db-sync.test.ts \
     __tests__/migrations/acquisition-source-self-reported.test.ts
   yarn typecheck
   VERCEL_ENV=preview yarn build
   git diff --check
   ```

6. **OPERATOR MERGE GATE:** Merge the web PR only after the four-layer
   taxonomy/DB-sync tests pass.

### Production PLAN → APPROVAL and native release gate

7. **OPERATOR PLAN GATE:** Review the exact SQL, backup artifact, preserved
   current constraint expression, dry-run output, and forward-only rollback.
   The dry run must contain only `20260730121000`.

8. **OPERATOR APPROVAL GATE:** Apply with the production-owner connection.

9. Verify:

   ```sql
   SELECT pg_get_constraintdef(oid)
   FROM pg_constraint
   WHERE conrelid = 'public.user_events'::regclass
     AND conname = 'user_events_event_type_check';
   ```

   The definition must contain `acquisition_source_self_reported`.

10. **OPERATOR CONTROLLED-EVENT GATE:** After approval, send one controlled
    authenticated event from an operator-selected test account with the locked
    payload and confirm it is accepted:

    ```sql
    SELECT event_type, count(*)
    FROM public.user_events
    WHERE event_type = 'acquisition_source_self_reported'
    GROUP BY event_type;
    ```

11. Native release is blocked until steps 9–10 pass. The native prompt must
    remain optional, post-forecast-value, dismissible, and outside onboarding;
    those native behaviors are not implemented by this web slice.

### Rollback

- Disable or hold the native prompt first.
- It is safe to leave the DB and API taxonomy permissive with weight `0`.
- Do not shrink the constraint while retained rows exist. Removal requires a
  later additive migration after a retention decision; never delete production
  event history to make rollback easier.

---

## S6 — R5 canonical share taxonomy closure

### Decision

Choose **re-point to canonical `share_*` events**, not
accept-with-migration.

Justification:

- the current share UI already emits action-specific canonical events;
- `share_completed` is accepted for anonymous and authenticated users;
- copy/save/native-share behaviors retain useful method/content metadata;
- accepting the coarse `social_share` name would create a second numerator,
  invite double counting, and require another API/DB taxonomy expansion;
- the database may retain `social_share` for historical/native backward
  compatibility without making it a current web API event.

### Files to modify

- `__tests__/components/share/share-sheet.test.tsx`
- `docs/refactor-roadmap.md`

Reviewed; no production edit expected:

- `components/share/share-sheet.tsx`
- `components/cams/cams-share-button.tsx`
- `components/tools/tool-share-button.tsx`
- `components/beach-detail/share-beach-button.tsx`
- `components/beach-detail/share-beach-pill.tsx`
- `lib/analytics/event-taxonomy.ts`

### Ordered steps

1. Re-run the source audit on the clean target branch:

   ```bash
   rg -n 'social_share' app actions components hooks lib
   rg -n 'share_started|share_completed|share_link_copied|share_image_saved|cam_share' \
     components app
   ```

   Expected: no production `social_share` emitter. If a live emitter appears
   after branch drift, stop and add that exact file to this slice before
   editing; map it to the action-appropriate canonical event rather than
   accepting `social_share`.

2. Extend `share-sheet.test.tsx` to prove:

   - native share emits/posts `share_completed`;
   - copy emits `share_link_copied`;
   - save emits `share_image_saved`;
   - no path posts or tracks `social_share`;
   - cancellation does not emit `share_completed`.

3. Update `docs/refactor-roadmap.md`:

   - remove `social_share` from Open Gaps and Next Actions;
   - record the canonical-event decision and the inspected emitter files;
   - state that the old DB literal is historical compatibility, not a web
     emitter contract.

4. Run:

   ```bash
   yarn test:unit --runInBand \
     __tests__/components/share/share-sheet.test.tsx \
     __tests__/components/cams/cams-share-button.test.tsx \
     __tests__/lib/analytics/event-taxonomy.test.ts
   npx eslint --max-warnings=0 \
     __tests__/components/share/share-sheet.test.tsx
   yarn typecheck
   git diff --check
   rg -n 'social_share' app actions components hooks lib
   ```

5. **OPERATOR MERGE GATE:** Review this as a behavior-characterization/doc
   closure. No migration and no production event-name addition are authorized.

### Rollback

- Revert the test/doc slice. Current production emitters remain canonical.
- If execution found and re-pointed a drifted emitter, revert only that emitter
  change if its user behavior regresses; do not add `social_share` as an
  emergency fallback.

---

## S7 — R6 one web `session_log_submit` emission point

### Decision

Demote `session_log_submit` to one client-side, external-analytics submit event
after a successful `createLoggedSession` response. Remove both server-side
`user_events` writes.

`session_created` remains the sole durable north-star event and continues to be
emitted after successful `sessions` inserts from:

- `actions/session-actions.ts` with source `web-session-form`;
- `actions/conditions-report-actions.ts` with source
  `web-conditions-report`.

Conditions-report backfill is not a session-form submit and must not emit
`session_log_submit`.

### Files to modify

- `actions/session-actions.ts`
- `actions/conditions-report-actions.ts`
- `app/sessions/new/useSessionSubmission.ts`
- `docs/free-growth/north-star.md`
- `__tests__/actions/session-actions-create-logged.test.ts`
- `__tests__/actions/conditions-report-actions.test.ts`
- `__tests__/app/sessions/use-session-submission.test.tsx`

Reviewed but unchanged:

- `lib/analytics/session-created.ts`
- `lib/analytics/event-taxonomy.ts`
- `types/implicit-preferences.ts`
- `__tests__/lib/analytics/session-created.test.ts`
- existing DB constraints/migrations that retain `session_log_submit` for
  native or historical compatibility

### Ordered steps

1. In `actions/session-actions.ts`, remove the fire-and-forget
   `user_events` insert whose event type is `session_log_submit`. Do not change
   the awaited `emitSessionCreatedEvent` call or session return behavior.

2. In `actions/conditions-report-actions.ts`, remove its
   `session_log_submit` insert. Keep:

   - `intel_post_created`;
   - session insert;
   - `session_created` after a successful session insert;
   - non-fatal behavior when the conditions-report session insert fails.

3. Keep the single `track("session_log_submit", ...)` call in
   `useSessionSubmission.ts` after the successful server action. Tighten its
   comment and test name to say it is submit-funnel telemetry only and never a
   session-count numerator. Do not add a `/api/events` call from this hook.

4. Update tests:

   - standard web session save inserts `session_created` and does not insert
     server-side `session_log_submit`;
   - mock/internal exclusion tests no longer expect
     `session_log_submit`;
   - conditions-report save inserts `intel_post_created` and
     `session_created`, not `session_log_submit`;
   - the client hook emits `session_log_submit` exactly once after success and
     never on failure;
   - the client hook does not post a duplicate Supabase event.

5. Update `docs/free-growth/north-star.md`:

   - change the existing taxonomy table to the one client emission point;
   - remove the statement that server-side submit events remain unchanged;
   - state explicitly that conditions reports never emit submit telemetry;
   - retain `session_created` as the only logged-session event;
   - identify retained registry/DB occurrences as compatibility, not
     north-star semantics.

6. Audit retained references:

   ```bash
   rg -n 'event_type:\s*"session_log_submit"|eventType:\s*"session_log_submit"' \
     actions app components hooks lib
   rg -n 'track\("session_log_submit"' app components hooks lib
   ```

   Expected:

   - zero server/API `user_events` emitters;
   - exactly one web client `track("session_log_submit")`;
   - registry constants may retain the literal.

7. Run:

   ```bash
   yarn test:unit --runInBand \
     __tests__/actions/session-actions-create-logged.test.ts \
     __tests__/actions/conditions-report-actions.test.ts \
     __tests__/app/sessions/use-session-submission.test.tsx \
     __tests__/lib/analytics/session-created.test.ts
   npx eslint --max-warnings=0 \
     actions/session-actions.ts \
     actions/conditions-report-actions.ts \
     app/sessions/new/useSessionSubmission.ts \
     __tests__/actions/session-actions-create-logged.test.ts \
     __tests__/actions/conditions-report-actions.test.ts \
     __tests__/app/sessions/use-session-submission.test.tsx
   yarn typecheck
   git diff --check
   ```

8. Review reports/dashboards that mention `session_log_submit`. Historical
   reports and submit-stage funnel fixtures may keep the literal, but no current
   session-count query may use it. Any discovered current session numerator
   must be changed to `session_created` in this slice or documented as a
   blocking follow-up before merge.

9. **OPERATOR MERGE GATE:** Review a source-audit transcript proving the single
   emission point and the unchanged `session_created` paths.

### Rollback

- Reverting the slice restores duplicate submit telemetry but does not affect
  session writes.
- If rolled back, dashboards must still count only `session_created`.
- No schema rollback is involved; retain the historical/native DB allowlist
  literal.

---

## Cross-slice release gates

Before each PR:

- focused Jest command passes;
- scoped ESLint passes;
- `yarn typecheck` passes;
- `git diff --check` passes;
- preview or production build passes where listed;
- self-review finds no unrelated file changes;
- the diff does not include the session-prompt template or cron;
- tests changed in the same slice as behavior;
- migration PRs include exact PLAN, verification, and rollback text.

After the focused ESLint command in the slice, run the repository lint gate
with the memory setting required by `AGENTS.md`:

```bash
NODE_OPTIONS="--max-old-space-size=8192" yarn lint
```

Before any `main → prod` release containing browser/API behavior:

```bash
source ~/.nvm/nvm.sh
nvm use 22
yarn typecheck
yarn test:unit --bail=0
VERCEL_ENV=production yarn build
```

Add the production smoke suite only if the release train includes other
browser-visible work:

```bash
BASE_URL=https://www.quiversurf.app \
  npx playwright test --grep @smoke --project=guest
```

Do not infer a pass from a mergeable PR; remote CI is disabled.

## Recommended execution order

1. **S1 / WP0.1 first.** It repairs the currently failing production job.
   Begin the three-scheduled-run observation window immediately after the
   approved database application.
2. **S2 / WP0.4 event durability.** Land the additive table, then deploy the
   handler so all later email work has trustworthy provider events.
3. **S3 / List-Unsubscribe.** Centralize the header contract before changing
   welcome rendering.
4. **S4 / R4 consolidation.** Base on S3, migrate welcome, delete the retired
   route, and correct architecture docs.
5. **S5 / WP0.6b.** Land and production-verify the web event contract before
   any native self-report prompt release.
6. **S6 / R5.** Close the stale share taxonomy gap with tests/docs only unless
   the target branch has drifted.
7. **S7 / R6.** Remove duplicate submit telemetry after confirming current
   dashboards use `session_created` for session counts.

S6 and S7 may be developed while S1's three-day observation window runs, but
production database applications remain serialized: finish and verify one
migration approval before starting the next.

## Risks and mitigations

1. **Dirty shared worktree.** The planning worktree already contains unrelated
   forecast changes. Use dedicated clean worktrees and inspect every diff
   against its branch base.
2. **Stale local refs.** Local `main` did not contain `eb32dc04a` while
   `origin/main` did. Fetch and use remote-tracking refs for ancestry and
   branching.
3. **Migration drift/concurrent schema work.** Plan 21 and other branches may
   add pending migrations. Every production dry run must show only the approved
   version. Unexpected pending versions block the slice.
4. **Git rollback is not database rollback.** Applied migrations and stored
   events survive code reverts. Use forward compensating migrations only after
   a new approval.
5. **Webhook/log race.** Provider events may arrive before
   `email_send_log`. Preserve `resend_message_id` with a nullable FK so the
   event is not discarded.
6. **Webhook retry semantics.** Returning 200 after a durable-insert failure
   loses measurement. Return a retryable failure for that case and make
   `svix-id` replay-safe.
7. **Email privacy bias.** Apple Mail Privacy Protection and link scanners can
   inflate opens/clicks. Treat delivery as operational truth; interpret
   open/click directionally and use native opens as the stronger action signal.
8. **Unsubscribe breadth.** The existing endpoint disables the master
   `notif_email_enabled` flag. Make that effect clear in copy and tests. Do not
   add a session-prompt-specific preference; native Phase 27 owns that work.
9. **Session-prompt ownership collision.** Central mailer changes must not
   modify the Phase 27 template or cron. Its eventual one-click preference work
   can adopt the shared wrapper later.
10. **Welcome parity regression.** React markup need not match byte-for-byte,
    but CTA destination, attribution, copy meaning, plain text, deduplication,
    and logging must remain stable before legacy deletion.
11. **Taxonomy partial rollout.** Releasing the native acquisition event before
    the DB constraint is verified will silently reject data. The native release
    is a hard downstream gate.
12. **Share double counting.** Adding `social_share` would create a second
    numerator beside `share_completed`; keep canonical action-specific events.
13. **Legacy session reports.** Historical reports and submit-stage funnel
    fixtures legitimately mention `session_log_submit`. They must not be
    mistaken for session-count numerators; current session counts use
    `session_created`.
14. **Small email cohorts.** Do not claim conversion lift from a handful of
    opens/clicks. The P0 goal is trustworthy instrumentation and deliverability,
    not a causal result.

## Completion criteria

- WP0.1 migration is on `prod`, tracked in production, and followed by three
  consecutive scheduled cron successes with cleanup confirmation.
- Resend delivery/open/click events are durably stored per provider message and
  queryable by template; native opens can join by `message_instance_id`.
- P0-owned engagement emails carry `List-Unsubscribe`; session prompt remains
  untouched.
- Welcome uses the React Email stack; the raw HTML template path and retired
  conditions-alert route are gone.
- `docs/ARCHITECTURE.md` no longer presents forecast digest, re-engagement, or
  the legacy conditions-alert cron as active email sends.
- `acquisition_source_self_reported` is authenticated-only, weight `0`, present
  in the production DB constraint, and verified with one controlled event
  before native release.
- No web source emits `social_share`; share UI is covered by canonical-event
  tests.
- Web server actions no longer persist `session_log_submit`; the successful
  client submit path is the one web emission point, and `session_created`
  remains the only session north star.
