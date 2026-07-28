# Phase 21: Multi-Forecaster Forecast Adjustment and Production Ingestion - Research

**Researched:** 2026-07-27
**Domain:** Private multi-source surf-forecast ingestion, deterministic authority selection, bounded forecast adjustment, and atomic audit persistence
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

## Implementation Decisions

### Source ingestion

- **D-01:** Production Seaside ingestion covers all 10 WaveCast regions plus the seven endpoints currently listed by `surf-forecast-ingestion`: NWS Hawaii SRF, Surf Institute PNW, Stormsurf PNW report links, Stormsurf PNW buoy forecast, Stormsurf NY shortcast, NJ Beach Cams reports, and The Surfers View NJ.
- **D-02:** Every source gets a source-specific parser. The existing generic relevant-line collector is evidence for research only and is not a production normalizer.
- **D-03:** A source without a parseable publication time, local valid date/window, unambiguous height basis, and valid surf range is rejected. `fetched_at` never substitutes for publication time.
- **D-04:** Ingestion runs every six hours with bounded transient retry and HTTPS redirect restrictions. Partial source success is persisted, but any enabled source failure makes the aggregate job unhealthy.

### Provider identity and evidence classes

- **D-05:** NJ Beach Cams and The Surfers View share one provider lineage and cannot count as independent votes.
- **D-06:** All Stormsurf endpoints share one provider lineage. Multiple endpoints cannot create multiple Stormsurf votes for one beach/day.
- **D-07:** Stormsurf's PNW buoy forecast is model or buoy evidence, not a human-authored face-height authority.
- **D-08:** Any source whose surf-height scale cannot be deterministically converted to breaking face-height feet remains evidence-only until a versioned conversion is approved and covered by fixtures.

### Coverage-aware authority

- **D-09:** Authority precedence is fresh compatible spot WaveCast, regional WaveCast, then the highest-priority validated regional authority when no fresh compatible WaveCast issue exists.
- **D-10:** A single valid configured authority activates immediately; universal two-source consensus is not required.
- **D-11:** Where independent authorities overlap, range separation above 1.00 ft blocks the adjustment and creates a durable alert. At or below 1.00 ft, the primary range remains unchanged and other providers are evidence only.
- **D-12:** Spot guidance supersedes regional guidance. Exposure compatibility is mandatory; NNW and SSW ranges are never unioned.
- **D-13:** There is exactly one decision per beach/local day and each forecast slot can be claimed by at most one decision.

### Adjustment behavior

- **D-14:** Compare the trusted local-day maximum range with Quiver's local-day maximum after base face transform, handoff blend, and beach offset.
- **D-15:** Inside-range and sub-0.50 ft discrepancies are no-ops. Magnitudes from 0.50 through 0.749 ft move 0.25 ft toward the range; magnitudes of 0.75 ft or greater move 0.50 ft toward the range. Preserve sign and cap at ±0.50 ft.
- **D-16:** Trusted adjustments apply only to snapshot-eligible forecast horizons from 0 through 168 hours.
- **D-17:** Session-feedback adjustment does not stack when a trusted forecast adjustment applies.

### Persistence and failure handling

- **D-18:** Normalized issues, decisions, applications, alerts, and build receipts are append-only. Existing `ml_predictions_log` snapshots remain first-write-wins.
- **D-19:** One database RPC atomically persists decisions, applications, alerts, new prediction snapshots, and a build receipt.
- **D-20:** The database recomputes SHA-256 from canonical payload content. A repeated build key is idempotent only when payload hash and exact durable counts match.
- **D-21:** A definite transactional rejection may serve baseline. After any transport-ambiguous persistence attempt, only a matching durable receipt may serve adjusted output; missing, mismatched, or unreadable receipt state returns a retriable forecast-generation error.
- **D-22:** Direct alert evidence mutation is forbidden. A service-role-only acknowledgement RPC may update only acknowledgement status, actor, and timestamp.

### Privacy, flags, and rollout

- **D-23:** Forecaster ranges, narratives, URLs, attribution, source hashes, parser metadata, provider evidence, and internal decision IDs remain absent from public APIs, UI payloads, and client analytics.
- **D-24:** Eligible ingestion and serving default enabled after deployment. Explicit `false` values remain independent immediate kill switches.
- **D-25:** Rollout order is schema, production Seaside ingestion, live parser and parity verification, Quiver serving, audit verification, then local launchd retirement.
- **D-26:** Database migration, production deploys, production writes, and local launchd removal remain explicit approval gates.

### the agent's Discretion

- Exact module boundaries, helper names, fixture organization, bounded retry
  timing, and code-level provider policy representation, provided every locked
  decision and requirement remains directly testable.

### Deferred Ideas (OUT OF SCOPE)

- Forecast horizons beyond 168 hours.
- Public display of external forecaster content or attribution.
- Model training, automatic calibration promotion, or session-feedback-derived height changes.
- New confidence UI or public disagreement labels.
- Additional providers not present in the current 17-endpoint inventory.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MFA-01 | Seaside ingests all 10 WaveCast regions and seven additional forecast endpoints every six hours with source-specific freshness, retry, redirect, and parser-failure controls. | The source contract matrix, ingestion state machine, scheduler pattern, and fixture/live gates define the implementation. [VERIFIED: `.planning/REQUIREMENTS.md`, `21-CONTEXT.md`, Seaside `crons/fetch_wavecast_forecasts.py`] |
| MFA-02 | Normalized issues are immutable and retain independent provider lineage, issue time, local valid date/window, region or beach, exposure, direction, period, face-height range, measurement basis, parser version, and source hash. | The normalized issue schema and revision identity below include every required field and append-only enforcement. [VERIFIED: `.planning/REQUIREMENTS.md`, migration draft review] |
| MFA-03 | Provider identity prevents mirrors or shared upstream content from counting as independent evidence; model and buoy pages never count as human forecaster votes. | The provider matrix assigns lineage and evidence class before authority selection. [VERIFIED: `21-CONTEXT.md`, local source inventory, live endpoint inspection] |
| MFA-04 | Coverage-aware authority prefers spot WaveCast, then regional WaveCast, then a validated regional caster when WaveCast has no fresh compatible issue; overlapping independent sources corroborate or block separations over 1.00 ft. | The deterministic precedence, exposure policy, lineage deduplication, and nearest-edge conflict algorithm below implement this behavior. [VERIFIED: `21-CONTEXT.md`, decision draft review] |
| MFA-05 | Eligible forecasts move exactly 0.25 or 0.50 ft toward the authority range, remain unchanged inside the range or below the 0.50 ft deadband, never exceed ±0.50 ft, and apply only at 0-168 hour horizons. | The explicit signed-band algorithm and boundary test matrix cover every threshold. [VERIFIED: `21-CONTEXT.md`, adjustment draft review] |
| MFA-06 | Decisions, applications, alerts, prediction snapshots, and server-verified build receipts persist atomically without violating first-write-wins prediction history; unresolved ambiguous commits return a retriable error instead of unaudited output. | The single-RPC schema, immutable receipt protocol, snapshot conflict behavior, and client reconciliation state machine below provide the required contract. [VERIFIED: `21-CONTEXT.md`, `ml_predictions_log` writer review, regional hold RPC precedent] |
| MFA-07 | Source ranges, narratives, URLs, attribution, parser metadata, evidence, and internal decision identities remain absent from public APIs, UI payloads, and client analytics. | The private-boundary design and negative contract tests cover serialization, analytics, and grants. [VERIFIED: `21-CONTEXT.md`, forecast builder and public contract review] |
| MFA-08 | Focused and full Seaside, Quiver, database, privacy, and live-ingestion gates pass before default-on serving; the local launchd scraper is retired only after production parity is verified. | The validation architecture, rollout gates, and runtime-state retirement inventory below define exact proof and approval points. [VERIFIED: `21-CONTEXT.md`, Quiver/Seaside `AGENTS.md`, launchd inspection] |
</phase_requirements>

## Summary

The phase should replace the current two-table mutable draft with a private append-only event model and a single database-owned commit protocol. Seaside should ingest every configured endpoint through a source-specific parser, record per-source outcomes, and store immutable issue revisions. Quiver should resolve one authority per beach/local day from a versioned coverage policy, compute an explicit signed `applied_delta_ft`, and persist the complete build before any adjusted forecast is eligible to leave the builder. [VERIFIED: `21-CONTEXT.md`, canonical draft review]

The largest draft defects are semantic, not cosmetic: `fetched_at` currently substitutes for missing publication time; redirects are unrestricted; regional exposure parsing can discard the NNW clause; conflict detection uses midpoint spread and unions ranges; negative half-step rounding is asymmetric; decisions can reach beyond 168 hours; persistence mutates decisions and first-write prediction rows; and an ambiguous RPC result has no durable receipt reconciliation. The current focused tests pass but encode several of those incorrect behaviors. [VERIFIED: Seaside `crons/fetch_wavecast_forecasts.py`, Quiver trusted adjustment/builder/logging drafts, focused test run on 2026-07-27]

**Primary recommendation:** Plan five ordered workstreams—schema/RPC first, complete Seaside ingestion second, deterministic authority engine third, builder/privacy integration fourth, and database/live rollout verification plus launchd retirement last. [VERIFIED: `21-CONTEXT.md` D-25]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fetch, retry, redirect control, source parsing | API / Backend (Seaside) | External provider boundary | Seaside owns scheduled network ingestion and parser health; provider responses are untrusted input. [VERIFIED: Seaside scheduler/cron architecture] |
| Immutable normalized issue storage | Database / Storage | API / Backend (Seaside) | The database enforces append-only history; Seaside supplies normalized revisions. [VERIFIED: D-18, Supabase architecture] |
| Provider lineage, evidence class, coverage policy | API / Backend (Quiver) | Database / Storage | Versioned server policy chooses compatible authority; persisted rows capture the policy result. [VERIFIED: D-05–D-13] |
| Baseline and bounded height decision | API / Backend (Quiver forecast builder) | Database / Storage | Quiver owns the display-height pipeline; the database audits but does not recompute forecast transforms. [VERIFIED: `forecast-builder.ts`, D-14] |
| Atomic decisions/applications/alerts/snapshots/receipt | Database / Storage | API / Backend (Quiver) | Only one SQL transaction can make the durable set all-or-none and serialize a build key. [VERIFIED: D-19–D-21, regional hold RPC precedent] |
| Public forecast response and analytics privacy | API / Backend (Quiver) | Browser / Client | Server DTOs must omit private fields so clients never receive them. [VERIFIED: D-23] |
| Operational health and rollout | API / Backend + Operations | Database / Storage | Seaside job health, private audit queries, flags, and launchd state jointly prove parity. [VERIFIED: D-24–D-26] |

## Project Constraints (from AGENTS.md)

- Use TypeScript-first Quiver modules with explicit function signatures, early returns, existing repository patterns, and minimal scoped edits. [VERIFIED: Quiver `AGENTS.md`]
- Use Node 22 and Yarn 1.x for Quiver commands; GitHub Actions are not an available merge gate, so local verification is authoritative. [VERIFIED: Quiver `AGENTS.md`, `package.json`]
- Supabase migrations in Quiver are the sole production schema ledger; Seaside may consume the contract but must not deploy a mirror. Do not hand-edit generated database types. [VERIFIED: Quiver and Seaside `AGENTS.md`]
- Preserve `ml_predictions_log` first-write-wins semantics for `(beach_id, predicted_at)` and use `forecast_at`, not `forecast_time`. [VERIFIED: Quiver and Seaside `AGENTS.md`, `log-display-prediction.ts`]
- Keep service-role credentials server-side, enable RLS on new tables, revoke broad defaults, validate all inputs, and never expose secrets or private source evidence. [VERIFIED: Quiver `AGENTS.md`]
- Seaside runs Python 3.11; use its lazy `get_supabase()` singleton and wrap synchronous `supabase-py` calls with `asyncio.to_thread()`. [VERIFIED: Seaside `AGENTS.md`, `requirements.txt`]
- `scheduler.py` is the source of truth for active jobs. Forecast/parser/cron work requires a focused pytest target, then the full local suite, plus a representative live upstream trace when practical. [VERIFIED: Seaside `AGENTS.md`]
- Database migrations, deploys, production writes, secrets changes, and local launchd removal require explicit approval; this research performs none of them. [VERIFIED: both repositories' `AGENTS.md`, `21-CONTEXT.md` D-26]

## Current Draft Assessment

| Surface | Keep | Must Replace or Correct |
|---------|------|-------------------------|
| Seaside scheduler | Six-hour `AsyncIOScheduler` job shape, stable ID, `max_instances=1`, partial-row persistence before aggregate failure. [VERIFIED: Seaside `scheduler.py`, ingestion draft] | Expand the WaveCast-only job to the complete configured source inventory; add bounded retry, manual redirect validation, per-source durable status, and a default-on phase flag with explicit-false semantics. [VERIFIED: `21-CONTEXT.md` D-01/D-04/D-24] |
| Seaside source normalization | Immutable insert intent, `ZoneInfo`, parser fixtures, and `asyncio.to_thread()` Supabase writes. [VERIFIED: Seaside draft/tests] | Remove `fetched_at` issue-time fallback; fix split-exposure parsing; add stable issue identity/revisions; parse all seven additional endpoints; reject ambiguous basis/date/range. [VERIFIED: Seaside draft and live fixture inspection] |
| Authority engine | Pure decision helper boundary and post-beach-offset baseline hook. [VERIFIED: `trusted-forecast-adjustment.ts`, `forecast-builder.ts`] | Replace UTC-window grouping, midpoint conflict, range union, two-provider union type, mutable upsert, and rounding with local-day, lineage, exposure, nearest-edge, explicit band, and receipt-aware logic. [VERIFIED: canonical draft review] |
| Builder integration | Base face transform → handoff blend → beach offset is already the correct baseline order. [VERIFIED: `forecast-builder.ts`, D-14] | Filter exact 0–168-hour slots before decision generation; decide trusted adjustment before feedback; persist atomically before exposing adjusted rows; throw on unresolved ambiguous state. [VERIFIED: `forecast-builder.ts`, D-16/D-17/D-21] |
| Database draft | Private table direction, UUID keys, checks, indexes, RLS intent. [VERIFIED: `20260727231500_create_trusted_external_forecast_adjustments.sql`] | Replace mutable adjustment rows and prediction sidecar updates with immutable issues/decisions/applications/alerts/receipts, append-only triggers, service-role-only RPCs, server canonical hash, exact counts, and first-write snapshot preservation. [VERIFIED: migration draft review, D-18–D-22] |
| Tests | The four current Quiver focused suites run successfully: 4 suites, 50 tests. [VERIFIED: local Jest run 2026-07-27] | Rewrite assertions that currently bless midpoint conflict, range union, mutable sidecar updates, and regex-only schema presence; add real Postgres and ambiguous-transport coverage. [VERIFIED: focused test source review] |

## Standard Stack

### Core

| Library / Facility | Version | Purpose | Why Standard |
|--------------------|---------|---------|--------------|
| Python | 3.11 | Seaside scheduled ingestion runtime | Locked by Seaside deployment stack. [VERIFIED: Seaside `AGENTS.md`, local `python3.11 --version` = 3.11.15] |
| `httpx` | `>=0.24,<0.28` | Async fetches with explicit timeout and manual redirect handling | Already installed by Seaside; clients provide pooling and shared configuration. [VERIFIED: Seaside `requirements.txt`; CITED: https://www.python-httpx.org/advanced/clients/] |
| `zoneinfo` | Python stdlib | Publication and validity conversion using IANA zones | Handles local calendar boundaries and DST without a new dependency. [CITED: https://docs.python.org/3/library/zoneinfo.html] |
| APScheduler | `>=3.10,<4` | Six-hour Seaside job | Existing scheduler standard; `max_instances`, coalescing, and misfire policy are supported. [VERIFIED: Seaside `requirements.txt`; CITED: https://apscheduler.readthedocs.io/en/3.x/userguide.html] |
| `supabase-py` | `>=2.3,<3` | Seaside private inserts/RPC calls | Existing singleton client contract. [VERIFIED: Seaside `requirements.txt`, `supabase_client.py`] |
| TypeScript | `^5.6.3` on Node 22 | Quiver authority engine and builder integration | Existing Quiver server stack. [VERIFIED: Quiver `package.json`, `AGENTS.md`] |
| `@supabase/supabase-js` | `^2.98.0` | Service-role RPC and receipt reads | Existing server database client exposes Postgres function calls through `.rpc()`. [VERIFIED: Quiver `package.json`; CITED: https://supabase.com/docs/reference/javascript/rpc] |
| PostgreSQL JSONB, `digest`, advisory transaction locks | Existing Supabase Postgres | Canonical payload, SHA-256, serialization, and atomic persistence | Existing repository migration precedent uses these facilities for a server-verified idempotent RPC. [VERIFIED: `20260717170000_create_regional_recommendation_holds.sql`; CITED: https://www.postgresql.org/docs/current/functions-json.html] |

### Supporting

| Library / Tool | Version | Purpose | When to Use |
|----------------|---------|---------|-------------|
| Jest | `^29.7.0` | Quiver unit, contract, and mocked transport tests | Pure decision boundaries, builder order, privacy, and receipt state machine. [VERIFIED: Quiver `package.json`] |
| pytest | Repository environment | Seaside parser, scheduler, retry, and partial-success tests | Every source parser and ingestion outcome. [VERIFIED: Seaside test layout and `AGENTS.md`] |
| pgTAP through Supabase CLI | CLI 2.98.2 locally | Real database privilege, trigger, transaction, and idempotency tests | Required because regex migration tests cannot prove runtime semantics. [VERIFIED: `supabase/tests/database/claim_surf_alert_slot.test.sql`, local CLI probe; CITED: https://supabase.com/docs/guides/local-development/cli/getting-started] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Existing HTTPX | Add a new retry package | Do not add it; bounded retry and redirect validation are small policy loops, while a package would add supply-chain and exception-classification surface. [VERIFIED: existing HTTPX dependency and D-04] |
| PostgreSQL canonical receipt RPC | Several client writes or a client-generated hash | Rejected because they cannot prove all-or-none durability or database-owned canonical content. [VERIFIED: D-19/D-20] |
| Versioned coverage policy in server code/data | Infer exposure ad hoc from prose or union regional ranges | Rejected because decisions must be reproducible and D-12 forbids NNW/SSW union. [VERIFIED: D-12, current migration swell-window policy precedent] |

**Installation:** No new external package is required. [VERIFIED: both dependency manifests and recommended architecture]

## Package Legitimacy Audit

Not applicable: the recommended plan installs no external packages, so the package legitimacy gate has no package targets. [VERIFIED: Standard Stack]

## Source Contract and Provider Matrix

Use an explicit configuration entry for every endpoint: source key, URL, provider lineage, parser key/version, evidence class, region/spot, IANA timezone, freshness policy, and enabled flag. An HTTP 200 with no valid issue is a parser failure, not a successful authority issue. [VERIFIED: D-01–D-08]

| Configured source | Parser contract | Provider lineage | Initial evidence class | Authority use |
|-------------------|-----------------|------------------|------------------------|---------------|
| 10 WaveCast regional/spot targets | Separate WaveCast regional, split-exposure, SoCal index/discovery, and spot-chart variants; require a real publication marker and local day/range. [VERIFIED: live pages, Seaside fixtures/draft] | `wavecast` | Approved human face-height authority | Spot first, then regional; same lineage never self-corroborates. [VERIFIED: D-09/D-12] |
| NWS Hawaii SRF | Parse product issue time, island/exposure sections, local day labels, and face-height ranges. [VERIFIED: live NWS SRF inspection] | `nws_hfo` | Official human face-height authority | Validated regional fallback when no fresh compatible WaveCast issue. [VERIFIED: NWS product basis, D-09] |
| Surf Institute PNW | Fetch its JSON API rather than treating the JavaScript shell as a forecast; normalize only fields with a proven basis. [VERIFIED: live HTML and `/api/regions/pnw` inspection] | `surf_institute` | Evidence-only initially | No vote until a versioned face-height conversion and fixtures exist. [VERIFIED: D-08; current API exposes buoy/model-oriented measurements] |
| Stormsurf PNW report links | Source-specific portal parser records health/evidence without fabricating a range. [VERIFIED: live endpoint inspection] | `stormsurf` | Evidence-only initially | No human vote from a links/observational portal. [VERIFIED: D-06/D-08] |
| Stormsurf PNW buoy forecast | Parse as model/buoy evidence. [VERIFIED: live endpoint and D-07] | `stormsurf` | Model/buoy evidence | Never a human authority vote. [VERIFIED: D-07] |
| Stormsurf NY shortcast | Parse updated time, daily maximum face-height table/ranges, direction, and period when present. [VERIFIED: live endpoint inspection] | `stormsurf` | Human face-height authority | Regional fallback; dedupe against every other Stormsurf endpoint. [VERIFIED: D-06/D-09] |
| NJ Beach Cams reports | Record mirror/source health; do not infer ranges absent an unambiguous breaking-face basis. [VERIFIED: live endpoint inspection] | `surfers_view` | Evidence-only initially | Shares a vote with The Surfers View and cannot independently corroborate it. [VERIFIED: D-05/D-08] |
| The Surfers View NJ | Parse source health/evidence only unless a future approved conversion yields breaking-face feet. [VERIFIED: live endpoint inspection] | `surfers_view` | Evidence-only initially | Same lineage as NJ Beach Cams. [VERIFIED: D-05/D-08] |

The exact WaveCast region keys are `socal`, `hawaii`, `new_england`, `new_york`, `new_jersey`, `north_carolina`, `florida_east_coast`, `norcal`, `central_california`, and `baja`. The seven additional source keys are `nws_hawaii_srf`, `surf_institute_pnw`, `stormsurf_pnw_links`, `stormsurf_pnw_buoy`, `stormsurf_ny_shortcast`, `nj_beach_cams_reports`, and `surfers_view_nj`. Preserve these stable keys in source results and fixtures. [VERIFIED: local `surf-forecast-ingestion/ingest_forecasts.py`]

The configured source inventory is fixed at 17 phase sources even though a WaveCast index can expose additional chart links. Discovery may validate configured links, but it must not silently expand the provider inventory beyond D-01. [VERIFIED: D-01 and deferred providers fence]

## Architecture Patterns

### System Architecture Diagram

```text
17 configured HTTPS endpoints
        |
        v
Seaside scheduler (every 6h, one active instance)
        |
        +--> fetch attempt -> transient? -> bounded retry
        |                         |
        |                         +--> redirect? -> validate HTTPS + allowlist each hop
        v
source-specific parser
        |
        +--> invalid issue time / local window / basis / range
        |         -> durable source failure + aggregate job unhealthy
        |
        +--> valid normalized issue revision
                  -> append-only issue + ingest-run/source-result rows
                                   |
                                   v
Quiver forecast builder: base -> handoff -> beach offset
                                   |
                                   v
versioned coverage + lineage policy
        -> one primary authority per beach/local day
        -> independent overlap gap > 1.00? ---- yes ---> blocked decision + alert
                                   | no
                                   v
explicit 0 / +/-0.25 / +/-0.50 delta for slots 0..168h
                                   |
                                   v
single service-role RPC
        decisions + applications + alerts + new first-write snapshots + receipt
                                   |
               +-------------------+------------------+
               |                                      |
          definite reject                         response ambiguous
               |                                      |
       baseline may continue                    read receipt by build key
                                                      |
                                  matching hash + exact counts?
                                      | yes                 | no/unreadable
                                      v                     v
                               serve adjusted       retriable generation error
```

[VERIFIED: D-01–D-25, existing Seaside/Quiver architecture]

### Recommended Project Structure

```text
seaside/
├── crons/fetch_trusted_forecasts.py       # orchestration and aggregate health
├── trusted_forecasts/
│   ├── sources.py                         # fixed source/provider policy
│   ├── fetch.py                           # timeout/retry/manual redirect controls
│   ├── models.py                          # normalized issue/result types
│   └── parsers/                           # one source-family parser module each
├── scripts/verify_trusted_forecast_ingestion.py
├── tests/fixtures/trusted_forecasts/
└── tests/test_fetch_trusted_forecasts.py

quiver/
├── lib/services/forecast/
│   ├── trusted-forecast-policy.ts          # lineage, coverage, precedence
│   ├── trusted-forecast-adjustment.ts      # pure local-day decision math
│   ├── trusted-forecast-persistence.ts     # RPC and receipt reconciliation
│   └── forecast-builder.ts                 # ordered integration only
├── supabase/migrations/
│   └── 20260727231500_create_trusted_external_forecast_adjustments.sql
├── supabase/tests/database/
│   └── trusted_external_forecast_adjustments.test.sql
└── lib/services/forecast/__tests__/
```

[RECOMMENDED: module boundaries are within the agent's discretion and preserve existing repository separation]

### Pattern 1: Fetch → Validate → Parse → Persist Result

**What:** Treat transport success, parser success, and authority eligibility as separate statuses. Persist successful normalized rows and every enabled source outcome, then raise once if any enabled source failed. [VERIFIED: D-03/D-04]

**When to use:** Every scheduled ingestion run.

**Required fetch policy:**

- Reuse one `httpx.AsyncClient` with explicit connect/read/write/pool timeouts. [CITED: https://www.python-httpx.org/advanced/clients/; CITED: https://www.python-httpx.org/advanced/timeouts/]
- Disable automatic redirect following. For each redirect, resolve the location, require `https`, require the source's configured hostname allowlist, cap hop count, and never forward credentials. [VERIFIED: D-04; RECOMMENDED security contract]
- Retry only bounded transient categories: connection/timeouts, 408, 429, and 5xx; do not retry parser rejection or other deterministic 4xx responses. [RECOMMENDED: retry timing is within discretion]
- Cap response size and validate expected content type before parsing. [RECOMMENDED: untrusted input control]

### Pattern 2: Immutable Issue Identity and Revision

**What:** Separate a stable logical issue identity from an immutable parsed revision. [VERIFIED: MFA-02, D-18]

**Recommended fields:**

| Group | Fields |
|-------|--------|
| Identity | `provider_lineage`, `source_key`, `issued_at`, `valid_local_date`, `valid_timezone`, `valid_start_at`, `valid_end_at`, `scope_type`, `region_key`, `beach_id`, `exposure`, `measurement_basis` |
| Forecast | `min_face_ft`, `max_face_ft`, nullable `direction_deg`/direction band, nullable `period_seconds` |
| Revision | `parser_version`, `source_hash`, `revision_hash`, nullable `supersedes_issue_id`, `authority_eligible`, `evidence_class` |
| Operations | `ingest_run_id`, `fetched_at`, `created_at` |

[VERIFIED: MFA-02 and canonical decision-engine lineage design]

`issue_identity_key` should hash canonical identity fields; `revision_hash` should additionally cover normalized content, parser version, and source hash. A parser correction inserts a new row linked by `supersedes_issue_id`; it never updates the old row. [RECOMMENDED: append-only revision pattern derived from D-18]

### Pattern 3: Local-Calendar Validity

**What:** Parse the publication marker in the source timezone, derive the stated valid local date from the publication context, and build `[local midnight, next local midnight)` using `ZoneInfo`. Never assume 24 hours and never anchor a year to fetch time when the publication time is available. [VERIFIED: D-03; current parser review; CITED: https://docs.python.org/3/library/zoneinfo.html]

**When to use:** Parsing issues, grouping Quiver baselines, and deciding slot eligibility.

Publication-time parsing must validate weekday/date consistency, plausible horizon, and ambiguity. DST fixture tests must prove 23-hour spring-forward and 25-hour fall-back local days. [RECOMMENDED: boundary controls required by local-day semantics]

### Pattern 4: Deterministic Authority Selection

For each build, beach, and beach-local date:

1. Load an existing durable `(beach_id, local_date)` decision first. If one exists, reuse it exactly; do not recompute a second decision from a later issue or build. [VERIFIED: D-13/D-18]
2. When no daily decision exists, filter issues by freshness, authority eligibility, date/window overlap, beach/region coverage, exposure compatibility, and approved measurement basis. [VERIFIED: D-03/D-08/D-09/D-12]
3. Dedupe by provider lineage before corroboration. Within WaveCast, spot supersedes regional; they never become two votes. [VERIFIED: D-05/D-06/D-09/D-12]
4. Pick primary by fixed precedence: compatible spot WaveCast → compatible regional WaveCast → configured validated regional authority priority → freshest issue → stable issue key. [VERIFIED: D-09; RECOMMENDED deterministic tie-breaks]
5. Form the primary local-day maximum range from the primary row with the largest `max_face_ft`; preserve that row's min/max pair rather than independently unioning bounds. [RECOMMENDED: direct interpretation of D-14 without fabricating a wider range]
6. Compare each compatible independent lineage using nearest-edge separation:

```typescript
function separationFt(
  left: { minFt: number; maxFt: number },
  right: { minFt: number; maxFt: number }
): number {
  return Math.max(
    0,
    Math.max(left.minFt, right.minFt) -
      Math.min(left.maxFt, right.maxFt)
  );
}
```

[VERIFIED: D-11 range-separation semantics; source is the approved phase rule]

Any separation `> 1.00` blocks and emits one durable alert. At `<= 1.00`, keep the primary range unchanged; corroborators never widen, average, or union it. [VERIFIED: D-11]

### Pattern 5: Explicit Signed Adjustment Bands

Store `applied_delta_ft` with intuitive addition semantics: positive raises the baseline and negative lowers it. Do not use `Math.round()` to derive the band. [RECOMMENDED: avoids JavaScript negative-half asymmetry found in the draft]

```typescript
function appliedDeltaFt(
  baselineMaxFt: number,
  authority: { minFt: number; maxFt: number }
): number {
  const signedGapFt: number =
    baselineMaxFt < authority.minFt
      ? authority.minFt - baselineMaxFt
      : baselineMaxFt > authority.maxFt
        ? authority.maxFt - baselineMaxFt
        : 0;
  const magnitudeFt: number = Math.abs(signedGapFt);

  if (magnitudeFt < 0.5) return 0;
  const stepFt: number = magnitudeFt < 0.75 ? 0.25 : 0.5;
  return Math.sign(signedGapFt) * stepFt;
}
```

[VERIFIED: D-15; code is a direct transcription of the approved thresholds]

Eligibility uses raw timestamps: `0 <= (forecast_at - build_anchor) / hour <= 168`. Do not round the horizon before filtering, because rounding can admit a slot beyond 168 hours. [VERIFIED: D-16; current builder uses rounded horizons]

### Pattern 6: One Database-Owned Build Commit

The migration should create these private objects:

| Object | Contract |
|--------|----------|
| `trusted_forecast_ingest_runs` and source results | Append-only run/source outcome records proving coverage, parser rejection, retry/redirect outcome, and aggregate health. [RECOMMENDED: required operational proof for MFA-01/MFA-08] |
| `trusted_forecast_issues` | Append-only normalized issue revisions with all MFA-02 fields. [VERIFIED: D-18/MFA-02] |
| `trusted_forecast_decisions` | Append-only one row per `(beach_id, local_date)`, including status, primary issue, baseline max, trusted range, gap, delta, and policy version. Later builds reuse the same daily decision rather than creating a second one. [VERIFIED: D-13/D-18] |
| `trusted_forecast_applications` | Append-only one row per adjusted `(beach_id, forecast_at)`, referencing its one daily decision and resolved prediction snapshot identity. Later builds may reference the existing application but cannot claim the slot with a different decision. [VERIFIED: D-13/D-18] |
| `trusted_forecast_alerts` | Immutable evidence body; acknowledgement fields are writable only by the acknowledgement RPC. [VERIFIED: D-18/D-22] |
| `trusted_forecast_build_receipts` | Immutable unique `build_key`, database canonical hash, exact expected counts, inserted/reused decision/application/snapshot counts, durable alert count, schema/policy version, and committed timestamp. [VERIFIED: D-20; RECOMMENDED count decomposition for first-write reuse] |

`persist_trusted_forecast_build(payload jsonb)` should:

1. Reject unknown/missing keys and invalid shapes before inserting. [RECOMMENDED: strict RPC input contract]
2. Acquire `pg_advisory_xact_lock` for the build key. [VERIFIED: existing regional recommendation hold RPC pattern]
3. Canonicalize timestamps, scaled numerics, explicit nulls, schema/policy version, and sorted decision/application/alert/snapshot arrays in SQL. [RECOMMENDED: deterministic content contract]
4. Compute SHA-256 in the database; ignore or verify—but never trust—a client hash. [VERIFIED: D-20]
5. If a receipt exists, return it only when canonical hash and every exact count match; otherwise raise an idempotency collision. [VERIFIED: D-20]
6. Insert or exactly reuse the one daily decision and each already-claimed application; a conflict whose existing content references a different decision is a hard collision. Insert only missing first-write snapshot rows. Existing `(beach_id, predicted_at)` snapshot content remains byte-for-byte unchanged. [VERIFIED: D-13/D-18/D-19]
7. Insert the receipt last and return it. Any SQL error rolls back the complete set. [VERIFIED: D-19]

Grant execution only to `service_role`; revoke table and function access from `public`, `anon`, and `authenticated`, enable RLS, and add append-only UPDATE/DELETE triggers. [VERIFIED: Quiver database security rules, D-18/D-22]

### Pattern 7: Ambiguous Commit Reconciliation

Client persistence has three outcomes:

| Outcome | Required behavior |
|---------|-------------------|
| Matching RPC receipt returned | Apply trusted deltas and return adjusted output. [VERIFIED: D-21] |
| Structured database rejection received | The transaction is definitely rejected; baseline may continue. [VERIFIED: D-21] |
| Timeout, connection reset, abort, missing response, or uncertain dispatch | Read receipt by build key using the service-role path. Only matching hash and exact counts authorize adjusted output. [VERIFIED: D-21] |
| Receipt missing, mismatched, or unreadable after ambiguity | Throw a retriable forecast-generation error; do not store or return adjusted forecasts. [VERIFIED: D-21] |

If error classification is uncertain, classify it as ambiguous. [RECOMMENDED: safe failure rule]

### Pattern 8: Builder Order and Privacy Boundary

The serving order should be:

```text
base face transform
  -> handoff blend
  -> beach offset
  -> compute trusted local-day decision on exact 0..168h slots
  -> if trusted applies: suppress session feedback for claimed slots
     else: session feedback may apply normally
  -> atomic trusted persistence/receipt reconciliation
  -> expose/store adjusted output only after matching receipt
```

[VERIFIED: D-14/D-16/D-17/D-21 and current builder pipeline]

Keep provider data, issue IDs, decision IDs, ranges, source URLs/hashes, narratives, and parser fields in server-private types. The public forecast value may change, but public DTOs and analytics events must have no trusted-source sidecar. [VERIFIED: D-23]

### Anti-Patterns to Avoid

- **`fetched_at` as issue time:** It turns stale or undated content into apparently fresh authority. Reject instead. [VERIFIED: current Seaside draft violates D-03]
- **Automatic redirects:** `follow_redirects=True` cannot enforce scheme/host policy on every hop. Follow manually. [VERIFIED: current Seaside draft and D-04]
- **Generic “relevant line” parsing:** It cannot prove publication time, local validity, basis, or range. Use source-specific parsers. [VERIFIED: D-02/D-03]
- **Midpoint conflict checks:** Equal midpoints can conceal disjoint or wide ranges. Use nearest-edge range separation. [VERIFIED: current Quiver draft versus D-11]
- **Unioning evidence ranges:** It mutates the primary authority and can erase disagreement. Preserve the primary range. [VERIFIED: current Quiver draft versus D-11]
- **Rounding a half-step:** JavaScript rounding is asymmetric around negative halves. Use explicit magnitude bands and sign. [VERIFIED: current adjustment draft]
- **Grouping by exact UTC windows:** It splits or misassigns beach-local days, especially at DST. Group by IANA local date. [VERIFIED: current adjustment draft versus D-13/D-14]
- **Updating `ml_predictions_log` with trusted sidecars:** It violates first-write-wins. Link append-only applications to existing or newly inserted snapshot identity. [VERIFIED: current logging draft versus D-18]
- **Returning adjusted output before durable proof:** A caught snapshot/RPC error creates unaudited output. Require a matching receipt first. [VERIFIED: current builder/logging draft versus D-21]
- **Static regex migration tests only:** They prove text exists, not grants, triggers, rollback, idempotency, or immutable rows. Add pgTAP/runtime database tests. [VERIFIED: current migration test review]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Time-zone offsets and DST | Fixed UTC offsets or `+ 24 hours` | `zoneinfo.ZoneInfo` and next local midnight | Calendar days can be 23 or 25 hours. [CITED: https://docs.python.org/3/library/zoneinfo.html] |
| Multi-table atomicity | Client-side compensating writes | One PostgreSQL RPC transaction | Only the database can atomically commit all durable rows. [VERIFIED: D-19] |
| Cryptographic digest | Custom checksum | PostgreSQL `digest(..., 'sha256')` over canonical JSONB | D-20 requires database-recomputed SHA-256. [VERIFIED: D-20, existing RPC precedent] |
| Concurrency/idempotency lock | In-memory mutex | PostgreSQL advisory transaction lock plus unique receipt key | Quiver instances do not share process memory. [VERIFIED: existing regional hold RPC pattern] |
| HTTP connection management | One socket per request | Existing `httpx.AsyncClient` | HTTPX client pooling is supported and already installed. [CITED: https://www.python-httpx.org/advanced/clients/] |
| Retry of deterministic parser errors | Generic retry decorator over the full job | Small bounded transport/status retry loop | Parser rejection is not transient and should make source health explicit. [VERIFIED: D-03/D-04] |
| Exposure inference from display strings | String matching or range union | Versioned beach/region/exposure policy | Authority selection must be reproducible and exposure-compatible. [VERIFIED: D-12] |

**Key insight:** The complex part is not adding 0.25 ft; it is proving exactly which private issue authorized the adjustment and proving the complete audit set committed before the adjusted forecast escaped. [VERIFIED: D-18–D-23]

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | The local scheduled scraper retains timestamped snapshots under `~/Library/Application Support/Quiver/surf-forecast-ingestion/data/`; the latest inspected 2026-07-26 run contains all 17 endpoint outcomes and 208 WaveCast normalized rows. Workspace snapshots also exist and are older. [VERIFIED: filesystem inspection and `21-CONTEXT.md`] | No production data migration is required from these files. Preserve them read-only as parity evidence; do not delete them during launchd retirement without separate approval. [RECOMMENDED: D-25/D-26] |
| Live service config | Seaside production scheduling is gated by the primary scheduler role and will need a trusted-ingestion flag; Quiver needs an independent serving flag. Actual deployed values were not queried. [VERIFIED: Seaside `scheduler.py`, D-24] | Add independent server-only flags with default-on behavior after their rollout step and explicit string `false` kill switches; verify live values read-only after approved deploys. [VERIFIED: D-24/D-26] |
| OS-registered state | `gui/501/com.quiver.surf-forecast-ingest` is loaded in launchd, backed by `/Users/stevenchandler/Library/LaunchAgents/com.quiver.surf-forecast-ingest.plist`, with Sun/Tue/Thu 12:10 triggers; it was not running when inspected. [VERIFIED: `launchctl print` and plist inspection 2026-07-27] | After production parity and explicit approval, `bootout` that exact service, move the plist to a recoverable archive/trash, verify `launchctl print` no longer finds it, and verify no later local snapshot appears. [VERIFIED: D-25/D-26] |
| Secrets/env vars | The local runner does not require a new provider credential in the inspected source inventory. Production persistence uses existing Supabase service-role access; the two feature flags are new configuration names. No secret values were read. [VERIFIED: local runner README/source, both repositories' env contracts] | Add names/examples only; set deployed values only at the approved rollout gates. Never expose the service key to public/browser code. [VERIFIED: project security rules] |
| Build artifacts / installed packages | The local Application Support copy is independent of the source workspace and will remain installed after repository edits. Seaside's deployed container is Python 3.11; local Python 3.11 exists but lacks pytest. [VERIFIED: filesystem/runtime probes] | Do not attempt to update the local installed scraper as part of production ingestion. Retire its launchd registration after parity; retain artifacts until a separately approved cleanup. Use the Seaside project/container test environment for Python verification. [RECOMMENDED: D-25/D-26] |

## Common Pitfalls

### Pitfall 1: Publication Marker Confusion

**What goes wrong:** A page fetch time or embedded model-data timestamp is accepted as the forecaster's publication time. [VERIFIED: current Seaside fallback and live WaveCast pages]

**Why it happens:** Several pages contain multiple dates, including chart data timestamps, while the existing parser falls back to `fetched_at`. [VERIFIED: parser/live inspection]

**How to avoid:** Give each parser an explicit publication-marker grammar and reject invalid, absent, or ambiguous markers. [VERIFIED: D-03]

**Warning signs:** `issued_at == fetched_at`, impossible clock text, or a parser passing after the publication header is deleted from its fixture. [RECOMMENDED: validation signal]

### Pitfall 2: Split-Exposure Clause Loss

**What goes wrong:** A WaveCast sentence with NNW guidance before “around NNW facing breaks” can lose the first range while retaining SSW. [VERIFIED: current regional parser and live sentence shape]

**How to avoid:** Parse each exposure clause independently with full-sentence fixtures; assert NNW and SSW remain separate rows and are never unioned. [VERIFIED: D-12]

### Pitfall 3: Provider Double Voting

**What goes wrong:** WaveCast spot/regional rows, several Stormsurf pages, or NJ mirror sites look like independent corroboration. [VERIFIED: source inventory and D-05/D-06]

**How to avoid:** Assign lineage at source configuration/normalization time and dedupe lineages before overlap checks. [VERIFIED: D-05/D-06]

### Pitfall 4: Threshold and Sign Boundary Drift

**What goes wrong:** Exactly 0.50 or 0.75 ft, negative discrepancies, or floating-point values near thresholds produce the wrong step. [VERIFIED: current `Math.round` implementation]

**How to avoid:** Use explicit `< 0.50`, `< 0.75`, and `else` branches, apply sign separately, and store fixed-scale numeric values. [VERIFIED: D-15]

**Warning signs:** Raise and lower tests are not mirror images or no tests exist for 0.499, 0.500, 0.749, 0.750. [RECOMMENDED: boundary matrix]

### Pitfall 5: Horizon Rounding Leakage

**What goes wrong:** A forecast later than 168 hours is rounded down and adjusted. [VERIFIED: builder draft uses rounded horizon values]

**How to avoid:** Filter using raw milliseconds before any stored/display horizon rounding. [VERIFIED: D-16]

### Pitfall 6: “Atomic” Side Writes

**What goes wrong:** The decision RPC succeeds but forecast snapshots are written later and errors are swallowed, or existing snapshots are updated with trusted metadata. [VERIFIED: current builder and `log-display-prediction.ts` drafts]

**How to avoid:** Move all required durable rows into one RPC and preserve pre-existing prediction rows unchanged. [VERIFIED: D-18/D-19]

### Pitfall 7: Ambiguous Failure Misclassified as Rejection

**What goes wrong:** A network timeout after commit is treated as “not committed,” so baseline or a different retry result is served without reconciling the receipt. [VERIFIED: D-21]

**How to avoid:** Implement an explicit error classifier and receipt lookup state machine; uncertainty is ambiguous. [RECOMMENDED: safe client protocol]

### Pitfall 8: Default-On Before Dependency Order

**What goes wrong:** Ingestion or serving starts before its schema/RPC exists, or local launchd is removed before parity. [VERIFIED: D-25]

**How to avoid:** Treat each D-25 transition as a verified rollout gate, not one combined deploy. [VERIFIED: D-25/D-26]

## Code Examples

### Manual HTTPS Redirect Validation

```python
# Source: phase D-04 plus HTTPX redirect/history API
async def fetch_source(
    client: httpx.AsyncClient,
    source: SourceConfig,
) -> httpx.Response:
    url: httpx.URL = httpx.URL(source.url)

    for _hop in range(source.max_redirects + 1):
        if url.scheme != "https" or url.host not in source.allowed_hosts:
            raise PermanentSourceError("redirect target is not allowed")

        response: httpx.Response = await client.get(
            url,
            follow_redirects=False,
        )
        if not response.is_redirect:
            response.raise_for_status()
            return response

        location: str | None = response.headers.get("location")
        if location is None:
            raise PermanentSourceError("redirect missing location")
        url = url.join(location)

    raise PermanentSourceError("redirect limit exceeded")
```

[CITED: https://www.python-httpx.org/quickstart/#redirection-and-history; RECOMMENDED: allowlist policy]

### First-Write Snapshot Insert Inside the RPC

```sql
-- Source: ml_predictions_log first-write-wins contract and D-19.
insert into public.ml_predictions_log (
  beach_id,
  predicted_at,
  forecast_m,
  corrected_forecast_m,
  model_version
)
select
  snapshot.beach_id,
  snapshot.predicted_at,
  snapshot.forecast_m,
  snapshot.corrected_forecast_m,
  snapshot.model_version
from jsonb_to_recordset(canonical_payload -> 'snapshots') as snapshot(
  beach_id uuid,
  predicted_at timestamptz,
  forecast_m double precision,
  corrected_forecast_m double precision,
  model_version text
)
on conflict (beach_id, predicted_at) do nothing;
```

[VERIFIED: existing first-write writer pattern; final column list must match the live schema]

### Receipt Collision Check

```sql
-- Source: D-20 and the repository's regional recommendation hold RPC pattern.
select *
into existing_receipt
from public.trusted_forecast_build_receipts
where build_key = requested_build_key;

if found then
  if existing_receipt.payload_sha256 <> canonical_sha256
     or existing_receipt.decision_count <> expected_decision_count
     or existing_receipt.application_count <> expected_application_count
     or existing_receipt.alert_count <> expected_alert_count
     or existing_receipt.snapshot_count <> expected_snapshot_count then
    raise exception 'trusted forecast build idempotency collision'
      using errcode = '23505';
  end if;
  return existing_receipt;
end if;
```

[VERIFIED: D-20; `20260717170000_create_regional_recommendation_holds.sql`]

## State of the Art

| Old / Current Draft Approach | Required Current Approach | When Changed | Impact |
|------------------------------|---------------------------|--------------|--------|
| Local 17-endpoint launchd evidence collector | Production Seaside scheduled ingestion with source-specific parsers and durable health | Phase 21 approved context, 2026-07-27 | Production owns freshness and audit; local job retires only after parity. [VERIFIED: D-01–D-04/D-25] |
| WaveCast-only normalized production draft | Fixed 17-source inventory with provider lineage and evidence class | Phase 21 approved context, 2026-07-27 | Mirrors/model sources cannot create false votes. [VERIFIED: D-05–D-08] |
| Midpoint spread plus unioned ranges | Primary-range nearest-edge separation; corroborators never mutate primary | Phase 21 approved context, 2026-07-27 | Conflict behavior matches the approved 1.00-ft rule. [VERIFIED: D-11] |
| Mutable adjustment upsert and prediction sidecar updates | Append-only events, immutable receipts, first-write snapshots | Phase 21 approved context, 2026-07-27 | Audit history and replay semantics become enforceable. [VERIFIED: D-18–D-20] |
| Best-effort logging after serving | Receipt-gated serving with ambiguous-commit reconciliation | Phase 21 approved context, 2026-07-27 | Adjusted output cannot exist without durable attribution. [VERIFIED: D-21] |

**Deprecated/outdated:**

- `WAVECAST_INGEST_ENABLED` as the sole phase flag is too narrow for a 17-source job; replace or alias it through a migration-safe `TRUSTED_FORECAST_INGEST_ENABLED` contract. [RECOMMENDED: D-01/D-24]
- Direct `trusted_*` updates on `ml_predictions_log` are incompatible with first-write-wins and should not be part of the final migration/API. [VERIFIED: D-18]
- The generic local relevant-line collector remains research evidence only. [VERIFIED: D-02]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | No `[ASSUMED]` factual claims are used. Provider eligibility is limited to what the approved context and inspected source basis currently prove; uncertain sources remain evidence-only by D-08. | Entire document | None requiring user confirmation before planning. |

## Open Questions (RESOLVED)

1. **RESOLVED — No blocking product decision remains.**
   - What we know: Authority, thresholds, persistence semantics, privacy, flags, rollout order, and approval gates are locked in `21-CONTEXT.md`. [VERIFIED: `21-CONTEXT.md`]
   - What's unclear: Live third-party markup can change between fixture capture and rollout, and deployed flag values were intentionally not queried. [VERIFIED: live-source nature and D-26]
   - Recommendation: Treat fixture refresh, read-only live dry-run, and deployed configuration verification as implementation/rollout gates, not as reasons to reopen approved behavior. [RECOMMENDED]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node | Quiver test/typecheck | ✓ | 22.23.1 | Use `nvm use 22`. [VERIFIED: local probe] |
| Yarn | Quiver commands | ✓ | 1.22.17 | None needed. [VERIFIED: local probe, `package.json`] |
| Python 3.11 | Seaside runtime parity | ✓ | 3.11.15 | Use `/opt/homebrew/bin/uv run --isolated --python 3.11 --with-requirements requirements.txt --with pytest==8.3.5 ...` for every validation command. [VERIFIED: local probe; approved Wave-0 fallback] |
| pytest in Python 3.11 | Seaside tests | ✓ via isolated uv | 8.3.5 pinned | Use the same exact isolated uv command; do not create a repository venv or change manifests. [VERIFIED: approved Wave-0 fallback] |
| Supabase CLI | Real database tests | ✓ | 2.98.2 | None if Docker is running. [VERIFIED: local probe] |
| Docker daemon | Local Supabase services | ✗ | CLI 20.10.21; daemon unavailable | Start Docker before the database gate. [VERIFIED: local probe] |
| PostgreSQL client | Diagnostic SQL | ✓ | 14.17 | Supabase CLI remains the standard local stack. [VERIFIED: local probe] |
| Context7 CLI/MCP | Documentation lookup | ✗ | — | Official documentation was used. [VERIFIED: `ctx7` probe] |
| Local launchd service | Retirement target | ✓ loaded | `gui/501/com.quiver.surf-forecast-ingest` | Retirement remains approval-gated. [VERIFIED: `launchctl print`] |

**Missing dependencies with no fallback:**

- A running Docker daemon is required for the real local Supabase/pgTAP gate; without it, MFA-06 cannot be validated locally. [VERIFIED: Supabase local architecture and local probe]

**Missing dependencies with fallback:**

- Local Python has no pytest; every Seaside validation uses `/opt/homebrew/bin/uv run --isolated --python 3.11 --with-requirements requirements.txt --with pytest==8.3.5 ...` without a repository venv or manifest edit. [VERIFIED: local probe; approved Wave-0 fallback]

## Validation Architecture

### Test Framework

| Property | Quiver | Seaside | Database |
|----------|--------|---------|----------|
| Framework | Jest 29.7 [VERIFIED: `package.json`] | pytest [VERIFIED: repository tests/AGENTS] | pgTAP via Supabase CLI [VERIFIED: existing `supabase/tests/database`] |
| Config file | `jest.config.js` [VERIFIED: repository] | `pytest.ini`/repository defaults as present [VERIFIED: repository inspection] | `supabase/config.toml` [VERIFIED: repository] |
| Quick run command | Focused four-suite command below | Focused parser/scheduler command below | `supabase test db supabase/tests/database/trusted_external_forecast_adjustments.test.sql` after local reset [RECOMMENDED: existing pgTAP layout] |
| Full suite command | `yarn test:unit --bail=0` | `/opt/homebrew/bin/uv run --isolated --python 3.11 --with-requirements requirements.txt --with pytest==8.3.5 python -m pytest tests/ -v --tb=short` | `supabase test db` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| MFA-01 | All 17 configured sources, retry/redirect/freshness/parser failure, partial success, unhealthy aggregate | Python unit + read-only live dry-run | `/opt/homebrew/bin/uv run --isolated --python 3.11 --with-requirements requirements.txt --with pytest==8.3.5 python -m pytest tests/test_fetch_trusted_forecasts.py tests/test_scheduler_registration.py -q` | ❌ Wave 0; current WaveCast-only test is insufficient |
| MFA-02 | Complete immutable issue revisions and parser correction lineage | Python unit + pgTAP | Focused Seaside command plus `supabase test db supabase/tests/database/trusted_external_forecast_adjustments.test.sql` | ❌ Wave 0 |
| MFA-03 | Mirror/shared lineage dedupe and model/buoy exclusion | Python + TypeScript unit | Seaside focused command plus Quiver focused command | ❌ Wave 0 |
| MFA-04 | Spot/regional precedence, exposure, one decision/day, independent nearest-edge block | TypeScript unit | Quiver focused command | ⚠️ Existing file must be rewritten/expanded |
| MFA-05 | Exact signed thresholds and raw 0..168-hour eligibility | TypeScript unit | Quiver focused command | ⚠️ Existing file lacks required boundary coverage |
| MFA-06 | Atomic rollback, server hash, count collision, first-write rows, receipt reconciliation, exact-target production abort-before-write | pgTAP + TypeScript transport/smoke unit | Database focused command plus Quiver focused command including the smoke-runner tests | ❌ Wave 0 |
| MFA-07 | No private fields in DTOs, analytics, or public grants | Jest contract + pgTAP privilege tests | Quiver focused command plus database focused command | ⚠️ Existing string check is insufficient |
| MFA-08 | Focused/full gates, live parity, flags, clean authorized-SHA worktrees, production deployment provenance, and approved launchd retirement | Test suites + operational checklist | Full commands, read-only live verifier, and exact-target/provenance smoke checks below | ❌ Wave 0 verifier/smoke/checklist |

### Required Focused Quiver Command

```bash
source ~/.nvm/nvm.sh
nvm use 22
yarn test:unit --runInBand --runTestsByPath \
  lib/services/forecast/__tests__/trusted-forecast-adjustment.test.ts \
  lib/services/forecast/__tests__/trusted-forecast-persistence.test.ts \
  lib/services/forecast/__tests__/forecast-builder.height-offset.test.ts \
  lib/services/forecast/__tests__/log-display-prediction.test.ts \
  scripts/__tests__/trusted-forecast-production-smoke.test.ts \
  __tests__/migrations/trusted-external-forecast-adjustments.test.ts
```

[RECOMMENDED: smallest behavioral Quiver gate]

### Required Focused Seaside Command

```bash
PYTHONDONTWRITEBYTECODE=1 /opt/homebrew/bin/uv run --isolated --python 3.11 \
  --with-requirements requirements.txt --with pytest==8.3.5 \
  python -m pytest -p no:cacheprovider \
  tests/test_fetch_trusted_forecasts.py \
  tests/test_scheduler_registration.py \
  -q
```

[RECOMMENDED: smallest behavioral Seaside gate]

### Required Real Database Gate

With Docker running and a disposable local Supabase project:

```bash
yarn db:reset
supabase test db supabase/tests/database/trusted_external_forecast_adjustments.test.sql
```

[RECOMMENDED: local-only database verification; CITED: https://supabase.com/docs/guides/local-development/cli/getting-started]

The pgTAP test must prove:

- UPDATE/DELETE is blocked on issues, decisions, applications, receipts, and alert evidence. [VERIFIED: D-18/D-22]
- Invalid payload rolls back all tables; no partial receipt or application remains. [VERIFIED: D-19]
- Database canonical hash is independent of a claimed client hash. [VERIFIED: D-20]
- Same key/hash/exact counts returns the same receipt, while changed content or any changed count raises collision. [VERIFIED: D-20]
- A pre-existing `ml_predictions_log` row is byte-for-byte unchanged and a missing row is inserted once. [VERIFIED: D-18]
- Uniqueness enforces one decision per beach/local day and one decision claim per beach/forecast slot across all builds; later builds may only reuse the identical durable rows. [VERIFIED: D-13/D-18]
- Only `service_role` can call persistence/acknowledgement; acknowledgement changes only status, actor, and timestamp. [VERIFIED: D-22]
- `anon` and `authenticated` cannot read private tables or execute private RPCs. [VERIFIED: project security rules and D-23]

### Required Decision Boundary Matrix

| Case | Expected |
|------|----------|
| Inside range | `0` |
| Gap `0.499` | `0` |
| Gap `+0.500`, `+0.749` | `+0.25` |
| Gap `+0.750` and larger | `+0.50` |
| Gap `-0.500`, `-0.749` | `-0.25` |
| Gap `-0.750` and larger | `-0.50` |
| Horizon `<0` or `>168` raw hours | Ineligible |
| Horizon exactly `0` or `168` | Eligible |
| Independent separation exactly `1.00` | Primary unchanged, not blocked |
| Independent separation `1.001` | Blocked plus durable alert |
| Same-lineage disagreement | Not an independent conflict vote |
| NNW and SSW rows for same day | Never unioned |

[VERIFIED: D-11/D-12/D-15/D-16]

### Required Transport State Matrix

Mock `.rpc()` and receipt reads for: returned receipt, definite SQL error, timeout then matching receipt, timeout then missing receipt, timeout then mismatched hash, timeout then mismatched count, timeout then receipt-read error, and uncertain exception class. Only the first three matching-success paths may return adjusted output; definite SQL rejection may return baseline; every unresolved ambiguous path throws retriable. [VERIFIED: D-21]

### Required Parser Fixtures and Live Gate

Fixtures must cover every source family, publication-marker deletion, stale issue, invalid weekday/year, invalid range/order/unit, redirect hop policy, transient retry exhaustion, partial success, WaveCast split exposure, and 23/25-hour local days. [VERIFIED: D-01–D-04/D-12]

Add a read-only verifier such as:

```bash
PYTHONDONTWRITEBYTECODE=1 /opt/homebrew/bin/uv run --isolated --python 3.11 \
  --with-requirements requirements.txt --with pytest==8.3.5 python \
  scripts/verify_trusted_forecast_ingestion.py --live --no-write
```

The verifier must enumerate all 17 configured sources, report final URL/status/parser version/issue counts/freshness/evidence class without printing narratives or source content, and exit nonzero for any enabled source failure. [RECOMMENDED: MFA-01/MFA-07/MFA-08 rollout proof]

### Broader Gates

```bash
# Quiver
yarn typecheck
yarn typecheck:forecast-gate
NODE_OPTIONS="--max-old-space-size=8192" yarn lint
yarn test:unit --bail=0
VERCEL_ENV=preview yarn build

# Seaside
PYTHONDONTWRITEBYTECODE=1 /opt/homebrew/bin/uv run --isolated --python 3.11 \
  --with-requirements requirements.txt --with pytest==8.3.5 \
  python -m pytest -p no:cacheprovider \
  tests/ -v --tb=short

# Database
supabase test db
```

[VERIFIED: repository command conventions; RECOMMENDED phase gate]

No browser E2E is the primary test for this private server-only phase. Public route/analytics privacy is better proven by deterministic server contract tests; run existing Playwright smoke only if implementation changes a route/UI surface beyond the scoped forecast value. [RECOMMENDED: scope-aligned validation]

### Sampling Rate

- **Per task commit:** The smallest affected parser/decision/RPC focused command. [RECOMMENDED]
- **Per wave merge:** Both focused repository gates plus the real database test when schema/RPC changes. [RECOMMENDED]
- **Phase gate:** Full Quiver + full Seaside + full database suites green, live read-only 17-source parity, privacy audit, then approval-gated serving/audit from clean `DEPLOYED_PROD_SHA` worktrees after proving authorized main/previous-prod ancestry, the authorized merge tree, and matching Vercel project/deployment/commit provenance, followed by launchd retirement. [VERIFIED: MFA-08/D-25/D-26]

### Wave 0 Gaps

- [ ] `seaside/tests/test_fetch_trusted_forecasts.py` and complete 17-source fixture tree. [VERIFIED: missing]
- [ ] `seaside/scripts/verify_trusted_forecast_ingestion.py` read-only live verifier. [VERIFIED: missing]
- [ ] `scripts/trusted-forecast-production-smoke.ts` and focused tests require explicit beach ID/local date/expected build key plus production confirmation and prove missing/mismatched targets abort before write in forecast/audit modes; the operational checklist separately proves authorized main/previous-prod ancestry and tree, clean `DEPLOYED_PROD_SHA` worktree HEAD/status, and exact Vercel project/deployment/commit provenance before invoking the runner. [VERIFIED: missing]
- [ ] `lib/services/forecast/__tests__/trusted-forecast-persistence.test.ts` for receipt/error states. [VERIFIED: missing]
- [ ] Rewrite `trusted-forecast-adjustment.test.ts` for lineage, local day/DST, nearest-edge conflict, exact bands, and raw horizon boundaries. [VERIFIED: current gaps]
- [ ] Replace the `log-display-prediction.test.ts` assertion that permits mutation of existing first-write rows. [VERIFIED: current incorrect assertion]
- [ ] `supabase/tests/database/trusted_external_forecast_adjustments.test.sql` for real transactional semantics. [VERIFIED: missing]
- [ ] Start Docker before `yarn db:reset`/pgTAP verification. [VERIFIED: daemon unavailable]
- [ ] Prove the exact `/opt/homebrew/bin/uv run --isolated --python 3.11 --with-requirements requirements.txt --with pytest==8.3.5 ...` Seaside validation path without repository venv or manifest changes. [VERIFIED: local pytest unavailable; approved fallback]

### Research-Time Validation Results

| Command | Result |
|---------|--------|
| Quiver current four focused suites with `--no-cache` | PASS — 4 suites, 50 tests. These tests validate the draft, not the corrected Phase 21 contract. [VERIFIED: command run 2026-07-27] |
| Seaside focused pytest under `python3.11` | BLOCKED — `No module named pytest`. [VERIFIED: command run 2026-07-27] |
| Seaside focused pytest under default `python3` | BLOCKED — `No module named pytest`. [VERIFIED: command run 2026-07-27] |
| Local Supabase/pgTAP | NOT RUN — Docker daemon unavailable and the required pgTAP file does not exist. [VERIFIED: environment/repository inspection] |

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | No end-user auth flow | Service-role-only server RPCs; no browser credential. [VERIFIED: architecture/D-23] |
| V3 Session Management | No | Phase does not create sessions. [VERIFIED: scope fence] |
| V4 Access Control | Yes | RLS, revoked defaults, service-role-only EXECUTE, private server modules, pgTAP privilege tests. [VERIFIED: project security rules] |
| V5 Input Validation | Yes | Per-source parsers, strict RPC JSON shape, numeric/time/range limits, URL allowlists. [VERIFIED: D-02–D-04] |
| V6 Cryptography | Yes | PostgreSQL SHA-256 over database canonical payload; never custom crypto. [VERIFIED: D-20] |
| V7 Error Handling and Logging | Yes | Durable private source outcomes/alerts; public logs and analytics omit narratives, URLs, hashes, and IDs. [VERIFIED: D-04/D-23] |
| V8 Data Protection | Yes | Private tables, no public DTO fields, least privilege, no third-party content redistribution. [VERIFIED: D-23 and scope fence] |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SSRF/open redirect through provider response | Spoofing / Information disclosure | Fixed source allowlists, manual HTTPS redirect validation per hop, bounded hops, no forwarded credentials. [RECOMMENDED: D-04 implementation] |
| Malicious or malformed HTML/JSON | Tampering / DoS | Response-size/content-type caps, source-specific grammar, range/time limits, fixtures, evidence-only default. [VERIFIED: D-02/D-03/D-08] |
| Mirror/model evidence masquerading as independent human vote | Spoofing | Persist provider lineage and evidence class; dedupe before authority. [VERIFIED: D-05–D-08] |
| Client-provided digest or count tampering | Tampering | Database canonicalization, SHA-256 recomputation, exact durable counts. [VERIFIED: D-20] |
| Concurrent/replayed build key | Tampering / Repudiation | Advisory transaction lock, immutable receipt, collision on changed content/count. [VERIFIED: D-20 and existing RPC precedent] |
| Partial database commit | Tampering | One transactional RPC; receipt inserted last. [VERIFIED: D-19] |
| Unattributed adjusted forecast after network ambiguity | Repudiation | Matching durable receipt is mandatory before adjusted output. [VERIFIED: D-21] |
| Private forecaster content in browser/API/analytics | Information disclosure | Server-private types, DTO allowlists, negative serialization tests, RLS/grant tests. [VERIFIED: D-23] |
| Alert evidence rewritten during acknowledgement | Repudiation | Block direct UPDATE; acknowledgement RPC changes only three allowed fields. [VERIFIED: D-22] |
| Retry storm or overlapping six-hour jobs | DoS | Bounded retries, `max_instances=1`, coalescing, timeouts, aggregate failure after partial persistence. [VERIFIED: D-04; CITED: https://apscheduler.readthedocs.io/en/3.x/userguide.html] |

## Rollout and Approval Gates

1. Apply and verify the Quiver schema/RPC migration in a disposable local database; production migration requires explicit approval. [VERIFIED: D-25/D-26]
2. Deploy complete Seaside ingestion with serving still independent; production deploy/write approval is required. [VERIFIED: D-24–D-26]
3. Run live read-only parser verification, then query private production run/issue counts to prove all 17 source outcomes, freshness, lineage, and parity with the latest local snapshot. [VERIFIED: MFA-08/D-25]
4. Deploy Quiver serving and enable its default-on behavior only after the schema and production issues exist; retain explicit-false kill switch. [VERIFIED: D-24/D-25]
5. Audit receipts, exact counts, unchanged first-write snapshots, conflict alerts, and absence of private fields in public contracts/analytics. [VERIFIED: MFA-06/MFA-07]
6. Request explicit launchd-removal approval, retire only `gui/501/com.quiver.surf-forecast-ingest`, verify it remains unloaded, and preserve snapshot evidence. [VERIFIED: D-25/D-26 and runtime inventory]

Rollback before launchd retirement is independent flag disablement. After retirement, recovery is reloading the preserved plist only with explicit operational approval; do not couple rollback to deleting production issue history. [RECOMMENDED: append-only and recoverable operations]

## Sources

### Primary (HIGH confidence)

- `21-CONTEXT.md` — all locked decisions, phase fence, canonical references, and rollout gates. [VERIFIED: repository]
- `.planning/REQUIREMENTS.md` — MFA-01 through MFA-08. [VERIFIED: repository]
- Quiver `AGENTS.md`, `CLAUDE.md`, `docs/ARCHITECTURE.md`, `supabase/ARCHITECTURE.md` — project workflow, builder, migration, and database constraints. [VERIFIED: repository]
- `lib/services/forecast/trusted-forecast-adjustment.ts`, `forecast-builder.ts`, `log-display-prediction.ts` and focused tests — current draft semantics and gaps. [VERIFIED: repository]
- `supabase/migrations/20260727231500_create_trusted_external_forecast_adjustments.sql` — current schema draft. [VERIFIED: repository]
- `supabase/migrations/20260717170000_create_regional_recommendation_holds.sql` — canonical JSONB, SHA-256, advisory lock, append-only, and idempotency precedent. [VERIFIED: repository]
- Seaside `AGENTS.md`, `scheduler.py`, `requirements.txt`, `crons/fetch_wavecast_forecasts.py`, and tests/fixtures — production runtime and current WaveCast draft. [VERIFIED: Seaside repository]
- Local `surf-forecast-ingestion/ingest_forecasts.py`, README, launchd plist, and latest runtime snapshot — 17-source inventory and retirement state. [VERIFIED: local workspace/runtime]
- https://supabase.com/docs/reference/javascript/rpc — Supabase JavaScript RPC contract. [CITED: official docs]
- https://www.postgresql.org/docs/current/functions-json.html — PostgreSQL JSON/JSONB facilities. [CITED: official docs]
- https://www.python-httpx.org/advanced/clients/ — HTTPX client pooling/configuration. [CITED: official docs]
- https://www.python-httpx.org/advanced/timeouts/ — HTTPX timeout model. [CITED: official docs]
- https://www.python-httpx.org/quickstart/#redirection-and-history — HTTPX redirect/history behavior. [CITED: official docs]
- https://docs.python.org/3/library/zoneinfo.html — Python IANA timezone/DST support. [CITED: official docs]
- https://apscheduler.readthedocs.io/en/3.x/userguide.html — APScheduler concurrency, misfire, and coalescing behavior. [CITED: official docs]
- https://supabase.com/docs/guides/local-development/cli/getting-started — local Supabase CLI workflow. [CITED: official docs]

### Secondary (MEDIUM confidence)

- https://www.weather.gov/hfo/SRF — current NWS Hawaii source grammar and explicit face-height basis, inspected 2026-07-27. [CITED: official provider]
- https://surf.institute/api/regions/pnw — current Surf Institute structured payload and buoy/model-oriented fields, inspected 2026-07-27. [CITED: provider endpoint]
- Current WaveCast, Stormsurf, NJ Beach Cams, and The Surfers View pages listed in the local source inventory — current parser grammar/evidence classification, inspected 2026-07-27 and protected by evidence-only defaults where basis was not proven. [VERIFIED: configured endpoint inspection]

### Tertiary (LOW confidence)

- None. Unproven source conversions are deliberately evidence-only rather than asserted as authority. [VERIFIED: D-08]

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new package is needed; versions and facilities were confirmed from manifests, runtime probes, repository precedent, and official docs. [VERIFIED]
- Architecture: HIGH — the required behavior is locked, canonical drafts were reviewed end-to-end, and the repository contains a close atomic-RPC precedent. [VERIFIED]
- Source parsing: MEDIUM-HIGH — configured endpoints and local runtime output were inspected, but third-party markup remains operationally changeable and therefore requires rollout-time fixture/live parity. [VERIFIED]
- Pitfalls: HIGH — each major pitfall is observable in the current draft or directly implied by a locked failure rule. [VERIFIED]
- Validation: HIGH — current tests and environment were probed; missing real-DB/Python dependencies are explicit. [VERIFIED]

**Research date:** 2026-07-27
**Valid until:** 2026-08-03 for live parser grammar; 2026-08-26 for stable architecture and database design.
