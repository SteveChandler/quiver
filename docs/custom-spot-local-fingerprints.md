# Custom-spot local fingerprints

Custom spots keep `nearest_beach_id` as their observation, forecast, and tide-station anchor. A background job derives a local geometric overlay from the custom coordinate and uses it only when the stored model version and terrain result are current.

## Scientific boundary

The `custom_spot_terrain_v1` model reuses Quiver's `dem_horizon_v1` terrain pipeline. It derives 72 five-degree swell-access and wind-exposure bins from AWS Terrarium zoom-12 elevation tiles, then derives the dominant open-water window, facing direction, offshore direction, and exposure class. Every required tile must load; incomplete coverage fails closed to nearby-beach defaults instead of treating missing elevation as open water. It does not infer tide preference, skill suitability, shoaling calibration, or a scalar deep-water decay factor. Quiver's existing bathymetry spike is a documented no-go for production writes, so custom spots intentionally use no unvalidated bathymetric amplification claim. Those fields remain nearest-beach fallbacks until defensible evidence or independent review exists.

Forecast serving performs no geographic requests. Discovery keeps the nearest beach's forecast row and scales its height by a terrain ratio: the same swell components run through the wave-height transformer once with the spot's access factors and once with the anchor's, and the anchor height is multiplied by the quotient (bounded to 0.5–1.5, no change within ±3%). The anchor's calibration, offsets and provenance stay in the result. It applies only when the spot's terrain is `ok` at the current model version, the anchor beach has terrain of its own (otherwise the comparison is not like-for-like), and the global terrain kill switch allows it. Scorers are unchanged; the spot's modeled facing, offshore direction and swell window reach scoring through the existing custom-spot beach fields.

## Lifecycle and priority

Inserts and coordinate or break-type changes queue analysis without delaying the save. Workers claim bounded batches with `FOR UPDATE SKIP LOCKED`, retry with backoff, and reclaim stale locks. Coordinate and model hashes make repeats idempotent. Optimistic writes and claim timestamps prevent an old worker from replacing a newer save or job.

Field priority is:

1. user corrected
2. independently reviewed
3. current modeled value
4. nearest canonical beach fallback

Analysis failures retain existing custom values and nearest-beach fallback. Legacy `user_set` rows are treated as user corrections even when they predate field-level provenance. Completion and terminal failure update the spot and its leased job in one database transaction; a reclaimed worker cannot write through an expired claim.

## Privacy and product state

The job table and worker RPCs are service-role only. Authenticated row updates cannot set model arrays, debug data, hashes, model metadata, or independent-review state; the database trigger preserves those fields and records permitted geometry, tide, and skill edits as user corrections. Provider requests contain coordinates only; logs, job errors, debug data, and provenance omit private names and precise coordinates. Native public-spot reads use an explicit projection that excludes internal provenance, hashes, parameters, and debug data. No client shows analysis state yet.

This feature does not grant SEO eligibility. SEO remains a separate editorial decision.

## Schedule

`/api/cron/custom-spot-analysis` runs once a day (11:30 UTC) and claims up to 25 jobs. Spots are added a few per week, so one run clears the queue; a measured pass over all 40 live spots took ~27 s. Failed attempts retry on the next run, up to 3 attempts.

## Rollout and rollback

1. Schema: `20260829150000_reconcile_custom_spot_local_fingerprints.sql` (already applied).
2. Deploy the worker. New and moved spots queue themselves through the trigger.
3. Existing spots are queued once at release with a single insert into `custom_spot_analysis_jobs` (see the release pool); the daily run works through them. `scripts/backfill-custom-spot-fingerprints.ts` remains local-only.

To roll back behavior, remove the custom-spot analysis cron and deploy the prior application version, or set the terrain kill switch off. Nullable columns and queued results can remain unused. Do not drop the additive schema during an incident; a later reviewed migration can remove it if necessary.
