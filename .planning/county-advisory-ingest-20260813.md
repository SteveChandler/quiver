# San Diego County live beach-advisory ingest

Date: 2026-08-13
Status: implementation prepared; migration intentionally unapplied

## Source and endpoints

The implementation uses the County of San Diego DEHQ `sdbeachinfo` source:

- Source attribution: **County of San Diego DEHQ**
- Public source URL: `https://www.sdbeachinfo.com/`
- OutSystems host: `https://cosdapps.sandiegocounty.gov/sdbeachinfo`
- Manifest: `GET /moduleservices/moduleinfo?latest`
- Notification action: `POST /screenservices/CoSD_Beach_Water_CW/MainFlow/HomeBlockNew/ActionGetSitesByTypeNotification`
- Event identifiers: `1=advisory`, `2=closure`, `3=warning`

The referenced `.planning/county-feed-research-20260813.md` was not present in this checkout. The
endpoint details in the task were used as the contract, and the live endpoint was probed only enough
to capture the current shape and fixtures.

The screen-service request body is:

```json
{
  "versionInfo": {
    "moduleVersion": "<manifest.versionToken>",
    "apiVersion": "o4RRlyKnDa4BnchjWGU0oQ"
  },
  "viewName": "MainFlow.Home",
  "inputParameters": { "EventTypeIdentifier": 1 }
}
```

Headers sent:

- `Accept: application/json`
- `Content-Type: application/json; charset=UTF-8`
- `User-Agent: Quiver Beach Advisories/1.0 (https://www.quiversurf.app/about)`
- `X-CSRFToken: T6C+9iB49TLra4jEsMeSckDMNhQ=`

The CSRF header is required by OutSystems anonymous screen-service calls. A request without it
returned HTTP 403 during the bounded probe; the same request with it succeeded. No browser-only
headers, cookies, `Origin`, `Referer`, or per-beach requests are sent.

The bounded live probe observed `versionSequence=6304` and captured:

- advisory: 12 coordinate rows
- closure: 8 coordinate rows
- warning: 0 rows

The screen service returns active coordinate lists, not site names or validity dates. The stable
County site identity is therefore the normalized six-decimal coordinate pair. The raw JSON response
and SHA-256 hash are stored for each normalized row.

## Polling and failure controls

- Vercel cron: `/api/cron/county-beach-advisories`, `*/30 * * * *`.
- Each run makes one manifest request and at most one sequential request for each of the three event
  types. There is no retry loop and no per-beach fan-out.
- Request timeout: 10 seconds per County request.
- Minimum poll interval: 30 minutes, persisted in the ingest-state row as a second defense against
  duplicate invocations.
- Consecutive transient failure threshold: 3.
- Backoff: 30 minutes after failure 1, then 60 minutes after failure 2. Failure 3 opens the circuit.
- Shape changes and version mismatches open the circuit immediately; they do not use retries.
- An open circuit makes scheduled invocations read only our state table and return a `circuit_open`
  skipped result; it makes no County request. The transition that opened the circuit emits the Sentry
  alert and persists the error state, while later ticks do not repeat the alert.
- The circuit remains open until an operator validates the new contract and resets it. This avoids a
  redeploy or API change turning into an unattended retry storm.

## Version and snapshot handling

The manifest's `versionToken` and `versionSequence` are stored as both the accepted and observed
version. The first observed bootstrap records the accepted version before event calls; a completed
snapshot is still required before any advisory is served. A later mismatch, an OutSystems version
change flag, an HTTP failure, or an unexpected response shape is a failed run.

Advisories are written under a new run ID. The run is marked `completed` only after all three event
types have been fetched, normalized, matched, and inserted. Hold resolution reads only the newest
completed run. A failed or interrupted run cannot replace the last completed snapshot.

The unapplied migration is:

`supabase/migrations/20260813170000_create_county_beach_advisory_ingest.sql`

It creates the ingest-state, run, and advisory tables, stores source attribution, raw payload hashes,
match distance, optional validity dates, and `fetched_at`, and grants access only to `service_role`.
No migration was applied and generated database types were not edited.

## Matching and coverage reporting

County coordinates are matched to the nearest Quiver beach with coordinates within 500 meters. Every
County row is retained, including an unmatched row with `beach_id = NULL`; unmatched rows are never
silently discarded. Each completed run exposes:

- unique County sites seen
- matched sites
- unmatched sites
- `matchRate`
- advisory/closure/warning record counts

The captured live fixture contains 20 unique coordinate sites across its advisory and closure lists
(12 advisory, 8 closure, 0 warning). A production match rate was not claimed from this checkout: no
production `beaches` read was performed while the migration is unapplied. The first cron result will
provide the authoritative `matchedSites / totalSites` rate and persist every unmatched site for
operator review. The normalizer regression fixture also proves a 1/2 (50%) match is reported as one
matched and one retained unmatched row.

Any nonzero unmatched count emits an operator warning with the exact matched and unmatched counts.

## Hold resolution and staleness policy

Fresh County advisory, closure, and warning rows are live water-quality holds. They are combined with
the existing `water_quality_held_beaches` table; County data never replaces or deletes the owner-
curated chronic list.

The max staleness window is **2 hours**. With a fixed 30-minute poll, that allows four scheduled
opportunities (including a delayed invocation or a short County outage) while avoiding indefinite
reliance on a public-health status that may have changed. The window is deliberately longer than one
poll but shorter than a typical workday.

At or beyond two hours, the County signal is unavailable:

- Inside ranking/discovery, the resolver is unresolved and candidates are excluded, per ADR 002.
- Known chronic owner holds remain held even while the live signal is unresolved.
- Outside ranking/discovery, the canonical beach page and other user-chosen beach surfaces remain
  visible, per ADR 002; the outage does not blank a beach page. Notification policy remains
  surface-specific: explicitly user-configured alert types are exempt, while Quiver-initiated
  notifications continue to use the hold resolver.

## Operator response to a County API change

1. Check the Sentry alert and the `county_beach_advisory_ingest_state` row. Do not increase the cron
   frequency or add retries.
2. Confirm the change with County DEHQ before changing endpoint assumptions. Capture a new manifest
   and one response fixture for each event type, staying within the agreed request rate.
3. Update the parser/client and fixtures, add or update a regression test for the new shape, and run
   the full local gate.
4. If the module version changed, reset the accepted version only after the new parser is deployed.
   If only a transient outage occurred, reset the circuit without changing the accepted version.
5. The reset is an owner-operated database action, for example:

```sql
UPDATE public.county_beach_advisory_ingest_state
SET accepted_version_token = '<validated-token>',
    accepted_version_sequence = <validated-sequence>,
    observed_version_token = '<validated-token>',
    observed_version_sequence = <validated-sequence>,
    consecutive_failures = 0,
    circuit_open = false,
    next_attempt_at = NULL,
    last_error = NULL,
    updated_at = now()
WHERE source_identifier = 'county-san-diego-dehq-sdbeachinfo';
```

This SQL is documentation only; it was not run.

## County agreement items to confirm in writing

The permission should explicitly cover automated access to the undocumented OutSystems
`moduleservices` and `screenservices` endpoints, the 30-minute schedule and four-request maximum per
run, the identifying User-Agent/contact URL, storage of raw response payloads and hashes, derived
matching to Quiver beaches, DEHQ attribution, retention expectations, and the operator procedure for
version changes and outages. It should also state whether Quiver may display derived live holds and
status copy, and approve the exact attribution wording used in the product.
