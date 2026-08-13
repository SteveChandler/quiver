# Community spot photos runbook

Community spot photos launch behind two independent, fail-closed layers:

- Database `community_photo_feature_config.read_enabled` and
  `writes_enabled`. The migration defaults both to `false`; production
  verification on 2026-08-13 found both `true`, with the row updated on
  2026-08-11.
- Runtime `COMMUNITY_PHOTOS_READ_ENABLED` and
  `COMMUNITY_PHOTOS_WRITE_ENABLED`, both disabled unless exactly `true`.
  Runtime writes are effective only while runtime reads are enabled.
- `COMMUNITY_PHOTOS_CANARY_USER_IDS` optionally contains an exact
  comma-separated UUID allowlist. Listed authenticated users receive reads and,
  only when the runtime write flag is on, writes before global reads turn on.

`lib/community-photos/contracts.ts` is the runtime source of truth. It ignores
allowlist values that are not UUIDs, enables reads for a listed user when the
global read flag is off, and computes `writeEnabled` as
`readEnabled && COMMUNITY_PHOTOS_WRITE_ENABLED === "true"`. A canary user
therefore gets writes only when the runtime write flag is on; a non-canary user
gets neither read nor write access while the global read flag is off. The
database RPCs independently require their database flags, so the runtime
allowlist does not bypass the database gate.

## Current status

Production verification on 2026-08-13 found zero rows in both
`community_spot_photos` and `beach_photo_submissions`. The reason was a missing
client entry point, not a missing server pipeline: `lib/community-photos/repository.ts`
already implemented preflight, reservation/storage upload, and completion, and
the admin moderation queue already existed. Before `feat/ugc-media-upload-ui`,
no client component called `/api/community-photos/upload`. That branch adds
`components/media/community-photo-upload.tsx` and mounts it in the beach and
post-session surfaces. The canary and rollout procedure below is therefore
executable for the first time once that UI is deployed.

## Deployment order

1. Apply `20260725230000_create_community_spot_photos.sql` on a branch
   database and execute `supabase/tests/community_spot_photos_integration.sql`.
2. Deploy APIs, gated image reads, admin moderation, retention, and this
   monitoring contract while both database flags remain off.
3. Verify the private `community-spot-photos` bucket, service-role-only grants,
   15 MB request support at the proxy, cron secret, and an active admin
   operator.
4. Publish the matching Terms and Privacy version `2026-07-25`.
5. Enable database reads/writes, keep global runtime reads off, set the staff
   UUID canary allowlist, and enable runtime writes. Validate simulator, API,
   database, and browser contracts. Expand only after the production metrics
   below stay healthy.

This rollout uses simulator, API, database, and browser validation. A physical
device is optional when a platform behavior cannot be represented there.

## Legacy inventory

The migration removes authenticated insert/update/delete policies and grants
from `beach_photo_submissions` and `beach_photo_submission_votes`, but preserves
their rows for rollback and audit. Before applying it, record counts by
submission status, the oldest and newest submission timestamps, vote count,
and every legacy object prefix referenced by a submission. After migration,
confirm those counts are unchanged and both legacy tables reject client writes.
Do not copy legacy objects or rows into the canonical model without a separate
review of consent, ownership, moderation status, and retention eligibility.

The exact rollback artifact is
`scripts/db/restore-community-legacy-photo-writes.sql`. It restores the four
removed policy definitions and the `INSERT`, `UPDATE`, and `DELETE` grants for
`anon` and `authenticated`; it does not change legacy or canonical rows,
votes, moderation events, holds, or storage objects. Verify it on disposable
local PostgreSQL before requesting any production migration approval:

```bash
scripts/db/run-community-legacy-policy-restoration-smoke.sh
```

## Production monitoring

Every community public, image, mutation, admin, and retention route emits
`community_photo_route_outcome`. Its properties are limited to normalized
route, method, status, duration, normalized platform/build or `unknown`,
bounded result class, rollout eligibility, and deployment SHA. The distinct
ID is the constant `community-photo-route`; the event never includes request
or response bodies, image content or URLs, EXIF/GPS, tokens, user or reporter
identity, IDs, filenames, storage paths, IPs, or report text. Metrics capture
is best effort after the route outcome is known and cannot replace or weaken
authentication, authorization, moderation audit, or retention behavior.

Executable release queries:

- `docs/analytics/community-photo-upload-5xx.hogql`
- `docs/analytics/community-photo-upload-p95.hogql`
- `docs/analytics/community-photo-stuck-processing.sql`
- `docs/analytics/community-photo-retention-backlog.sql`
- `docs/analytics/community-photo-private-media-zero-tolerance.hogql`

Run the `.hogql` files as PostHog SQL insights and the `.sql` files read-only
against Supabase. Each file records its source, numerator, denominator,
rolling window, minimum sample, owner, and rollback action.

Track these outcomes without storing image content, coordinates, voter
identity, or reporter identity in telemetry:

- upload starts, 201/200 success, processing latency, 413/415 validation,
  preflight/reservation/storage/DB compensation failures, and 429 rate limits;
- overlapping same-key uploads return HTTP 409 `upload_in_progress` with
  `retryable: true`; a failed processing key is terminal and returns HTTP 409
  `upload_attempt_failed` with `retryable: false`, so the client must create a
  new UUID before retrying;
- rate limits, disabled features, and network failures before reservation do
  not consume an attempt; clients retain the same UUID for those retries;
- rows stuck in `processing` or `cleanup`, upload action-ledger mismatch, and private
  bucket objects without a database row;
- vote/report failures, severe-report hide latency, three-reporter quality-hide
  latency, and attempts to read hidden/removed/private images;
- canonical resolver fallback rate, pinned-photo eligibility failures, and
  gallery error rate;
- moderation audit failures, active investigation holds, recoverable removals,
  daily purge count, purge releases, and inaccessible orphan objects.

Alert immediately on an audit write failure, a private or removed image served
to a non-owner, metadata found in an output WebP, or hidden media returned from
the ordinary image route without its owner-recovery exception. Hidden media is
available to admins only from the separately authenticated and audited admin
image route. Alert on sustained upload 5xx above 1%, P95 processing above 5
seconds, or any retention backlog older than 31 days without a hold.

## Daily checks

Use the admin queue endpoint and database aggregates. Never export
`community_photo_votes.voter_id` or `community_photo_reports.reporter_id`.
The PII-free aggregate endpoint is
`GET /api/admin/community-photos/monitoring?since=<ISO-8601>`.
Confirm every returned community image URL is
`/api/community-photos/<uuid>/image`, never a storage path or signed URL.

The retention cron claims expired rows, deletes the object, then finalizes the
database purge. Storage failures release the claim to `removed` for the next
run. A crashed claim is reclaimable after 15 minutes. Investigation holds
always exclude a row from claim. The same cron claims processing reservations
stuck for 15 minutes and reconciles private-bucket objects older than 15
minutes that have no canonical database row. Failed storage cleanup releases a
processing claim for retry.

Authenticated contributors discover their own recoverable removals through
`GET /api/community-photos/mine?status=removed`. During the 30-day window the
ordinary image route serves removed media only to the owning authenticated
viewer. Recovery requires runtime and database writes, visible moderation
status, a valid current target, and no investigation hold.

## Rollback

Disable runtime writes first, then database writes. Remove the canary and
disable runtime reads after active uploads have drained, then disable database
reads. Keep tables and the private bucket in place during
rollback so contributor recovery windows and investigation holds remain
enforceable. Schema removal is a separate approval-gated destructive migration.
