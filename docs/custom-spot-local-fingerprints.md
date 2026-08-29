# Custom-spot local fingerprints

Custom spots keep `nearest_beach_id` as their observation, forecast, and tide-station anchor. A background job derives a local geometric overlay from the custom coordinate and uses it only when the stored model version and terrain result are current.

## Scientific boundary

The `custom_spot_terrain_v1` model reuses Quiver's `dem_horizon_v1` terrain pipeline. It derives 72 five-degree swell-access and wind-exposure bins from AWS Terrarium zoom-12 elevation tiles, then derives the dominant open-water window, facing direction, offshore direction, and exposure class. Every required tile must load; incomplete coverage fails closed to nearby-beach defaults instead of treating missing elevation as open water. It does not infer tide preference, skill suitability, shoaling calibration, or a scalar deep-water decay factor. Quiver's existing bathymetry spike is a documented no-go for production writes, so custom spots intentionally use no unvalidated bathymetric amplification claim. Those fields remain nearest-beach fallbacks until defensible evidence or independent review exists.

Forecast serving performs no geographic requests. It reads the persisted arrays, keeps the nearest forecast row, and applies the custom access factors through the existing wave-height transformer and scoring engine only when terrain status is `ok`, the per-spot terrain flag is enabled, and the web global terrain kill switch allows it.

## Lifecycle and priority

Inserts and coordinate or break-type changes queue analysis without delaying the save. Workers claim bounded batches with `FOR UPDATE SKIP LOCKED`, retry with backoff, and reclaim stale locks. Coordinate and model hashes make repeats idempotent. Optimistic writes and claim timestamps prevent an old worker from replacing a newer save or job.

Field priority is:

1. user corrected
2. independently reviewed
3. current modeled value
4. nearest canonical beach fallback

Analysis failures retain existing custom values and nearest-beach fallback. Legacy `user_set` rows are treated as user corrections even when they predate field-level provenance. Completion and terminal failure update the spot and its leased job in one database transaction; a reclaimed worker cannot write through an expired claim.

## Privacy and product state

The job table and worker RPCs are service-role only. Authenticated row updates cannot set model arrays, debug data, hashes, model metadata, or independent-review state; the database trigger preserves those fields and records permitted geometry, tide, and skill edits as user corrections. Provider requests contain coordinates only; logs, job errors, debug data, and provenance omit private names and precise coordinates. Native public-spot reads use an explicit projection that excludes internal provenance, hashes, parameters, and debug data. Owner-facing state is summarized as Analyzing location, Modeled from location, Independently reviewed, Customized by you, Using nearby beach defaults, or Analysis unavailable.

This feature does not grant SEO eligibility. SEO remains a separate editorial decision.

## Rollout and rollback

1. Apply `20260828120000_add_custom_spot_local_fingerprints.sql` before deploying web/native code.
2. Deploy the worker and clients. Confirm new saves queue and complete in a non-production environment.
3. Dry-run the bounded backfill. Execution is intentionally limited to local development; do not run it against production.
4. Request an independent scientific/privacy review before enabling any future production backfill.

To roll back behavior, remove the custom-spot analysis cron and deploy the prior application version. Nullable columns and queued results can remain unused. Do not drop the additive schema during an incident; a later reviewed migration can remove it if necessary.
