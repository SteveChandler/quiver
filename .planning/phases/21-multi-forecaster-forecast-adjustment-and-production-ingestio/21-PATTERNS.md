# Phase 21: Multi-Forecaster Forecast Adjustment and Production Ingestion - Pattern Map

**Mapped:** 2026-07-27
**Files classified:** 25 planned file surfaces
**Analogs found:** 22 / 25
**Scope:** Quiver Phase 21 only; Quiver owns the production schema ledger and serving path, while Seaside owns scheduled source ingestion.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `seaside/crons/fetch_trusted_forecasts.py` | service / cron | batch, request-response, CRUD | `seaside/crons/fetch_wavecast_forecasts.py` | exact-role, contract must change |
| `seaside/trusted_forecasts/sources.py` | config | transform | `seaside/crons/fetch_wavecast_forecasts.py` lines 41-115 plus `surf-forecast-ingestion/ingest_forecasts.py` lines 31-52 | exact inventory/config |
| `seaside/trusted_forecasts/fetch.py` | service / utility | request-response | `seaside/scripts/shoaling_calibration_pipeline/lib/cdip_client.py` lines 96-131 | role-match |
| `seaside/trusted_forecasts/models.py` | model | transform | `seaside/crons/fetch_wavecast_forecasts.py` lines 68-74 and `seaside/crons/fetch_rip_current_risk.py` lines 87-93 | exact-role |
| `seaside/trusted_forecasts/parsers/wavecast.py` | utility / parser | transform | `seaside/crons/fetch_wavecast_forecasts.py` lines 117-380 | exact-role, semantics must change |
| `seaside/trusted_forecasts/parsers/nws_hawaii_srf.py` | utility / parser | transform | `seaside/crons/fetch_rip_current_risk.py` lines 32-56, 95-253 | role/data-flow match |
| `seaside/trusted_forecasts/parsers/surf_institute_pnw.py` | utility / parser | transform | None; only the generic evidence collector exists | no analog |
| `seaside/trusted_forecasts/parsers/stormsurf.py` | utility / parser | transform | None; only the generic evidence collector exists | no analog |
| `seaside/trusted_forecasts/parsers/surfers_view.py` | utility / parser | transform | None; only the generic evidence collector exists | no analog |
| `seaside/scripts/verify_trusted_forecast_ingestion.py` | utility | request-response, transform | `seaside/scripts/gfs_wave_comparison_report.py` lines 355-428 | role-match |
| `seaside/tests/test_fetch_trusted_forecasts.py` | test | request-response, transform, CRUD | `seaside/tests/test_fetch_wavecast_forecasts.py` | exact-role |
| `seaside/tests/fixtures/trusted_forecasts/**` | test fixture | file-I/O | `seaside/tests/fixtures/wavecast_*.html` consumed at `test_fetch_wavecast_forecasts.py` lines 12-89 | exact-role |
| `seaside/scheduler.py` | config | event-driven | `seaside/scheduler.py` lines 74-100 | exact |
| `lib/services/forecast/trusted-forecast-policy.ts` | config / utility | transform | `lib/services/forecast/trusted-forecast-adjustment.ts` lines 127-151 | partial; extract and replace policy |
| `lib/services/forecast/trusted-forecast-adjustment.ts` | service / utility | transform | same file, lines 64-247 | exact-role, approved semantics replace draft math |
| `lib/services/forecast/trusted-forecast-persistence.ts` | service | request-response, CRUD | `lib/recommendations/major-event-hold/control.ts` lines 1406-1482 | role/data-flow match |
| `lib/services/forecast/forecast-builder.ts` | service | batch, transform, CRUD | same file, lines 344-606 and 704-1008 | exact integration point |
| `lib/services/forecast/log-display-prediction.ts` | service | batch, CRUD | same file, lines 179-352 | exact first-write writer; trusted mutation must be removed |
| `supabase/migrations/20260727231500_create_trusted_external_forecast_adjustments.sql` | migration | CRUD, transactional | `supabase/migrations/20260717170000_create_regional_recommendation_holds.sql` | strong migration/RPC analog |
| `supabase/tests/database/trusted_external_forecast_adjustments.test.sql` | test | CRUD, transactional | `supabase/tests/database/claim_surf_alert_slot.test.sql` | exact framework/role |
| `lib/services/forecast/__tests__/trusted-forecast-adjustment.test.ts` | test | transform | same file | exact test home; boundary matrix must replace draft expectations |
| `lib/services/forecast/__tests__/trusted-forecast-persistence.test.ts` | test | request-response, CRUD | `__tests__/lib/recommendations/major-event-hold/control.test.ts` lines 1074-1199 | role/data-flow match |
| `lib/services/forecast/__tests__/forecast-builder.height-offset.test.ts` | test | batch, transform, CRUD | same file, lines 270-329 | exact integration/privacy home |
| `lib/services/forecast/__tests__/log-display-prediction.test.ts` | test | batch, CRUD | same file, lines 143-178 and 605-642 | exact test home; final assertion must reverse |
| `__tests__/migrations/trusted-external-forecast-adjustments.test.ts` | test | file-I/O / static contract | same file | exact static smoke; not sufficient for DB behavior |

## Pattern Assignments

### `seaside/trusted_forecasts/sources.py` and `models.py`

**Primary analogs:**

- `seaside/crons/fetch_wavecast_forecasts.py` lines 41-115
- `surf-forecast-ingestion/ingest_forecasts.py` lines 31-52
- `seaside/crons/fetch_rip_current_risk.py` lines 87-93

**Immutable typed configuration pattern** (`fetch_wavecast_forecasts.py` lines 68-74):

```python
@dataclass(frozen=True)
class Target:
    beach_id: str
    region: str
    exposure: str
    source_key: str | None = None
```

Copy the frozen-dataclass pattern, but make source configuration carry the full Phase 21 contract: stable source key, URL, allowed redirect hosts, provider lineage, parser key/version, evidence class, scope, IANA timezone, freshness policy, and independent enabled flag.

**Fixed inventory pattern** (`surf-forecast-ingestion/ingest_forecasts.py` lines 31-52):

```python
WAVECAST_REGIONS = {
    "socal": "https://wavecast.com/socal/",
    "hawaii": "https://wavecast.com/forecasts/hawaii/",
    # ...eight additional approved WaveCast regions...
}

OTHER_SOURCES = {
    "nws_hawaii_srf": "https://www.weather.gov/hfo/SRF",
    "surf_institute_pnw": "https://surf.institute/regions/pnw",
    "stormsurf_pnw_links": "https://www.stormsurf.com/page2/links/orsrprt.shtml",
    "stormsurf_pnw_buoy": "https://www.stormsurf.com/4cast/mht/pacnw.html",
    "stormsurf_ny_shortcast": "https://www.stormsurf.com/page2/forecast/shortcast/ny.html",
    "nj_beach_cams_reports": "https://njbeachcams.com/nj-surf-reports/",
    "surfers_view_nj": "https://thesurfersview.com/surf-forecast/new-jersey/",
}
```

Use the 17 locked stable keys. Do not carry over the generic relevant-line parser at lines 112-128 as a production normalizer.

**Provider policy assignment:**

- All WaveCast endpoints: lineage `wavecast`, human face-height authority.
- NWS Hawaii SRF: lineage `nws_hfo`, official human face-height authority.
- All Stormsurf endpoints: lineage `stormsurf`; PNW buoy is model/buoy evidence, PNW links evidence-only, NY shortcast human authority.
- NJ Beach Cams and The Surfers View: lineage `surfers_view`, evidence-only until a versioned face-height conversion is approved.
- Surf Institute: lineage `surf_institute`, evidence-only until conversion is approved.

### `seaside/trusted_forecasts/fetch.py`

**Analog:** `seaside/scripts/shoaling_calibration_pipeline/lib/cdip_client.py`

**Bounded transient retry pattern** (lines 96-131):

```python
for attempt in range(max_retries):
    try:
        payload = _get_json(url)
        return _parse_table(payload)
    except CdipHTTPError as error:
        last_exc = error
        if error.status < 500 and error.status != 429:
            raise
        wait = backoff[min(attempt, len(backoff) - 1)]
        time.sleep(wait)
    except (urllib.error.URLError, TimeoutError, ConnectionError) as error:
        last_exc = error
        wait = backoff[min(attempt, len(backoff) - 1)]
        time.sleep(wait)
raise RuntimeError(f"CDIP fetch failed for station {station_id}: {last_exc}")
```

Copy the explicit transient/permanent classification and bounded attempt loop. Adapt it to async HTTPX and include 408, 429, and 5xx as retryable.

**Do not copy:** `fetch_wavecast_forecasts.py` lines 479-487 uses `follow_redirects=True`. Phase 21 needs `follow_redirects=False`, per-hop URL resolution, HTTPS-only validation, source-specific hostname allowlists, a hop cap, response-size/content-type checks, and no credential forwarding.

### `seaside/trusted_forecasts/parsers/wavecast.py`

**Analog:** `seaside/crons/fetch_wavecast_forecasts.py`

**Parser decomposition pattern** (lines 134-172):

```python
def _clean_lines(raw: str) -> list[str]:
    # strip script/style/markup, unescape, normalize whitespace

def _parse_height(text: str) -> tuple[float, float] | None:
    match = HEIGHT_RE.search(text)
    if match:
        low = float(match.group(1))
        high = float(match.group(2))
        return (min(low, high), max(low, high))
    return None

def _window_for_date(valid_date: date, timezone_name: str) -> tuple[str, str]:
    timezone_info = ZoneInfo(timezone_name)
    start = datetime.combine(valid_date, datetime_time.min, tzinfo=timezone_info)
    end = start + timedelta(days=1)
    return start.astimezone(timezone.utc).isoformat(), end.astimezone(timezone.utc).isoformat()
```

Retain separate cleaning, scalar parsing, local-calendar window, and row-building helpers. Preserve `ZoneInfo` and next-local-midnight semantics.

**Immutable normalized row shape** (lines 383-445):

```python
{
    "provider": "wavecast",
    "source_scope": "spot",
    "source_key": target.source_key,
    "beach_id": target.beach_id,
    "region": target.region,
    "exposure": row["exposure"],
    "issued_at": issued_at.isoformat(),
    "valid_start": row["valid_start"],
    "valid_end": row["valid_end"],
    "min_face_ft": row["min_face_ft"],
    "max_face_ft": row["max_face_ft"],
    "period_s": row["period_s"],
    "direction_deg": row["direction_deg"],
    "parser_version": PARSER_VERSION,
    "source_hash": row["source_hash"],
}
```

Expand this to the Phase 21 issue identity/revision fields: provider lineage, evidence class, authority eligibility, measurement basis, valid local date/timezone, issue identity key, revision hash, and optional supersedes ID.

**Do not copy:**

- Lines 250-274 return `fetched_at` when the publication marker is absent. The new parser must reject.
- Lines 211-223 can discard the first split-exposure clause. Parse NNW and SSW clauses independently and never union them.
- Lines 175-187 choose a year nearest to fetch time. Validate the publication context, weekday/date consistency, and plausible horizon instead.

### `seaside/trusted_forecasts/parsers/nws_hawaii_srf.py`

**Analog:** `seaside/crons/fetch_rip_current_risk.py`

**Source-specific NWS grammar pattern** (lines 32-56, 95-253):

```python
ISSUE_RE = re.compile(
    r"^\s*(\d{1,4})\s*(AM|PM)\s+([A-Z]{2,4})\s+\w{3}\s+"
    r"([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{4})\s*$",
    re.MULTILINE,
)

@dataclass(frozen=True)
class RipRisk:
    zone: str
    valid_date: date
    risk_level: str
    source: str = "srf"
```

```python
def parse_srf_product(product_text: str, fetched_at: datetime | None = None) -> list[RipRisk]:
    issue_dt = parse_issue_datetime(product_text, fetched_at)
    issue_date = issue_dt.date()
    rows: list[RipRisk] = []
    for zones, block in _split_zone_blocks(product_text):
        for heading_start, heading_end, section in _split_day_sections(block):
            # source-specific match and valid-date resolution
```

Copy the dedicated regex grammar, frozen parsed model, zone/day-section decomposition, and IANA timezone handling. Replace the rip-risk payload with Hawaii SRF face-height/exposure rows.

**Do not copy:** `parse_issue_datetime()` lines 95-99 falls back to `fetched_at`; Phase 21 rejects missing/ambiguous publication time.

### `seaside/trusted_forecasts/parsers/surf_institute_pnw.py`, `stormsurf.py`, and `surfers_view.py`

There is no production normalizer to copy. Use the shared model/fetch contract and write fixture-driven parser functions per configured source key. The local generic collector (`surf-forecast-ingestion/ingest_forecasts.py` lines 112-128) is inventory/evidence only.

Required behavior by module:

- `surf_institute_pnw.py`: consume the structured API, record valid evidence, and keep authority disabled until a versioned face-height conversion exists.
- `stormsurf.py`: separate parser functions for PNW links, PNW buoy/model evidence, and NY shortcast; assign one `stormsurf` lineage.
- `surfers_view.py`: separate parser functions for NJ Beach Cams and The Surfers View while assigning one shared lineage.

### `seaside/crons/fetch_trusted_forecasts.py`

**Analog:** `seaside/crons/fetch_wavecast_forecasts.py`

**Partial-success orchestration pattern** (lines 505-597):

```python
rows: list[dict[str, Any]] = []
failures: list[str] = []

async with httpx.AsyncClient() as client:
    for source in configured_sources:
        try:
            raw = await fetch_source(client, source)
            parsed = parse_source(source, raw)
            rows.extend(build_rows(source, parsed))
            if not parsed:
                failures.append(f"{source.key}:no_rows")
        except Exception as error:
            logger.warning("[trusted-forecast] source=%s failed: %s", source.key, error)
            failures.append(source.key)

if rows:
    await asyncio.to_thread(write_rows, get_supabase(), rows)
if failures:
    raise RuntimeError(
        f"trusted forecast ingestion completed with {len(failures)} source failures"
    )
```

Preserve successful rows before raising aggregate unhealthy status. Extend persistence to append-only ingest run, per-source result, and issue revision rows. Persist transport success, parser success, and authority eligibility as separate status fields.

**Supabase async boundary** (`fetch_wavecast_forecasts.py` lines 583-597):

```python
supabase = get_supabase()
await asyncio.to_thread(_write_rows, supabase, rows)
```

Use the lazy singleton and wrap every synchronous Supabase call with `asyncio.to_thread()`.

### `seaside/scheduler.py`

**Analog:** same file, lines 74-100.

```python
jobs = [
    # ...
    (
        fetch_wavecast_forecasts.run,
        CronTrigger(hour="*/6", minute=10),
        "fetch-wavecast-forecasts",
    ),
]

for func, trigger, job_id in jobs:
    scheduler.add_job(
        func,
        trigger,
        id=job_id,
        name=job_id,
        max_instances=1,
        misfire_grace_time=300,
    )
```

Replace the WaveCast-only registration with one stable trusted-ingestion job ID on the six-hour cadence. Preserve `max_instances=1`, central error listener behavior, and the primary-scheduler gate. The phase flag must default on and honor only explicit case-insensitive `false`.

### `seaside/scripts/verify_trusted_forecast_ingestion.py`

**Analog:** `seaside/scripts/gfs_wave_comparison_report.py`

**Read-only CLI pattern** (lines 355-428):

```python
def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build read-only GFS-Wave comparison report")
    parser.add_argument("--json", action="store_true", help="print JSON to stdout")
    return parser.parse_args(argv)

def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        output = asyncio.run(_main_async(args))
    except Exception as exc:
        print(json.dumps({"error": str(exc)}, sort_keys=True))
        return 1
    print(json.dumps(output, sort_keys=True))
    return 0
```

Use explicit `--live --no-write`, deterministic source ordering, nonzero exit for any enabled-source failure, and sanitized summaries only. Output final URL/status, parser version, issue count, freshness, and evidence class; never print narrative/source content, URLs containing secrets, source hashes, or private issue IDs.

### Seaside tests and fixtures

**Analog:** `seaside/tests/test_fetch_wavecast_forecasts.py`

**Fixture test pattern** (lines 12-50):

```python
FIXTURES = Path(__file__).resolve().parent / "fixtures"

def test_parse_regional_page_preserves_exposure_and_local_day_windows() -> None:
    raw = (FIXTURES / "wavecast_region.html").read_text()
    rows = wavecast.parse_regional_page(
        region="hawaii",
        raw=raw,
        fetched_at=datetime(2026, 7, 27, 12, tzinfo=timezone.utc),
    )
    assert [(row["exposure"], row["min_face_ft"], row["max_face_ft"]) for row in rows] == [
        ("primary", 1, 2),
        ("NNW", 2, 3),
        ("SSW", 4, 5),
    ]
```

Keep deterministic fixture timestamps and assert full normalized semantics. Add fixtures for every source family, deleted publication markers, stale issues, invalid weekday/year/range/unit, redirects, retry exhaustion, partial success, split exposure, and 23/25-hour DST days.

**Scheduler contract pattern** (`test_scheduler_registration.py` lines 14-44):

```python
tree = ast.parse(SCHEDULER_PATH.read_text())
# extract the literal jobs list
assert _active_job_ids() == [
    # exact active IDs in registration order
]
```

Update the exact active job list; retain the error-listener tests at lines 55-79.

### `lib/services/forecast/trusted-forecast-policy.ts`

**Analog to extract from:** `trusted-forecast-adjustment.ts` lines 127-151.

```typescript
const byProvider = new Map<string, TrustedExternalForecastRow[]>();
for (const row of rows) {
  const existing = byProvider.get(row.provider) ?? [];
  existing.push(row);
  byProvider.set(row.provider, existing);
}

for (const providerRows of byProvider.values()) {
  const spotRows = providerRows.filter((row) => row.source_scope === "spot");
  const preferredRows = spotRows.length > 0 ? spotRows : providerRows;
  // select latest compatible issue
}
```

Keep the pure deterministic helper boundary and spot-over-regional idea. Replace provider grouping with provider lineage, versioned coverage/exposure policy, evidence-class filtering, existing-decision reuse, and stable tie-breaks.

The final precedence is compatible spot WaveCast → compatible regional WaveCast → configured validated regional authority. Same-lineage rows never self-corroborate.

### `lib/services/forecast/trusted-forecast-adjustment.ts`

**Analog:** same file.

**Useful pure-function and validation shape** (lines 64-100, 153-247):

```typescript
function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function buildTrustedForecastDecisions(args: {
  beachId: string;
  sources: TrustedExternalForecastRow[];
  slots: TrustedForecastSlot[];
  now?: Date;
}): TrustedForecastDecision[] {
  const now = args.now ?? new Date();
  if (!isTrustedForecastAdjustmentEnabled()) return [];
  // validate, group, select, and return deterministic decisions
}
```

Keep explicit input/result types, early returns, pure computation, deterministic sorting, and default-on/explicit-false flag behavior.

**Replace these draft semantics:**

- Lines 162-170 group by exact UTC windows; group by beach IANA local date.
- Lines 190-201 use midpoint conflict and union ranges; preserve the primary row and use nearest-edge separation.
- Lines 102-110 use `Math.round()`; implement explicit signed bands:

```typescript
const signedGapFt: number =
  baselineMaxFt < authority.minFt
    ? authority.minFt - baselineMaxFt
    : baselineMaxFt > authority.maxFt
      ? authority.maxFt - baselineMaxFt
      : 0;
const magnitudeFt: number = Math.abs(signedGapFt);
if (magnitudeFt < 0.5) return 0;
return Math.sign(signedGapFt) * (magnitudeFt < 0.75 ? 0.25 : 0.5);
```

- The draft stores subtraction-oriented `offsetFt`; the final `appliedDeltaFt` should use intuitive addition semantics.
- A durable existing `(beach_id, local_date)` decision wins over recomputation.
- Only raw horizons `0 <= hours <= 168` participate.

### `lib/services/forecast/trusted-forecast-persistence.ts`

**Primary analog:** `lib/recommendations/major-event-hold/control.ts`

**Server-private validated boundary** (lines 1-4, 27-55):

```typescript
import "server-only";
import { z } from "zod";

const UUID_SCHEMA = z.string().uuid().transform((value) => value.toLowerCase());
const ISO_INSTANT_SCHEMA = z.string().datetime({ offset: true });
```

Define strict schemas for payloads and receipts, validate all database-returned rows, canonicalize timestamps, and keep all types server-only.

**Store interface pattern** (lines 200-216):

```typescript
export interface ManualHoldStore {
  loadByIdempotencyKey(idempotencyKey: string): Promise<Record | null>;
  appendTransition(payload: Payload): Promise<Record>;
}
```

Use an injectable persistence store so the receipt/error state machine is testable without a live database.

**RPC and returned-row validation pattern** (lines 1460-1481):

```typescript
const result = await rpc.call(
  client,
  "append_regional_recommendation_hold_transition",
  { p_transition: payload },
);
if (result.error) {
  throw new Error(
    `${result.error.code ?? "rpc_error"}:${result.error.message ?? "append failed"}`,
  );
}
const rows = rowsFromResult(result);
if (rows.length !== 1) throw new HoldControlError("append_failed", 503);
const record = parseRawHoldRow(rows[0]);
```

Adapt this to `persist_trusted_forecast_build(payload)` plus receipt lookup by build key.

**Required result classification:**

1. Matching returned receipt → adjusted output allowed.
2. Definite structured SQL rejection → baseline may continue.
3. Timeout/reset/abort/missing response/uncertain exception → read durable receipt.
4. Matching hash and all exact counts → adjusted output allowed.
5. Missing, mismatched, or unreadable receipt after ambiguity → throw a typed retriable forecast-generation error.

If classification is uncertain, treat it as ambiguous.

### `lib/services/forecast/forecast-builder.ts`

**Analog:** same file.

**Established layer order** (lines 704-865):

```typescript
let waveHeightResult = this.getWaveHeight(/* base face transform */);

const handoffStep = processForecastHandoffBlendSlot({ /* ... */ });
if (handoffStep.adjustment) {
  waveHeightResult = {
    value: handoffStep.adjustment.waveHeight,
    debug: { ...waveHeightResult.debug, handoffBlend: handoffStep.adjustment.metadata },
  };
}

const parsedDisplay = parseDisplayHeightFt(waveHeightResult.value);
const correctedFt =
  parsedDisplay.numericFt == null
    ? null
    : applyBeachHeightOffset({ /* ... */ });
```

This is the canonical baseline: base face transform → handoff blend → beach offset. Insert trusted local-day decision next, before session feedback.

**Current integration point to replace** (lines 516-560):

```typescript
const trustedForecastDecisions = buildTrustedForecastDecisions({
  beachId: beach.id,
  sources: resolvedTrustedExternalForecasts,
  slots: trustedForecastSlots,
  now,
});
const trustedDecisionsPersisted =
  await persistTrustedForecastDecisions(trustedForecastDecisions);
```

Keep post-loop local-day decision generation, but send decisions, applications, alerts, new first-write snapshots, and receipt metadata through one RPC. Do not mutate forecast rows until a matching receipt is returned or reconciled.

**Horizon bug to replace** (lines 886-892):

```typescript
const horizonInt = Math.max(0, Math.round(forecastHorizonHours));
if (horizonInt <= 168) {
  // ...
}
```

Filter trusted eligibility using raw `forecastHorizonHours` before rounding. Exactly 0 and 168 are eligible; values below 0 or above 168 are not.

**Privacy pattern** (`forecast-builder.height-offset.test.ts` lines 307-327):

```typescript
const publicForecastPayload = JSON.stringify(forecasts);
expect(publicForecastPayload).not.toContain("wavecast");
expect(publicForecastPayload).not.toContain(waveCast.id);
expect(publicForecastPayload).not.toContain("trusted_forecast");
```

Expand negative assertions to every private range, narrative, URL, attribution, source hash, parser field, evidence field, and internal decision ID.

### `lib/services/forecast/log-display-prediction.ts`

**Analog:** same file, lines 179-352.

**First-write pattern to preserve** (lines 284-295):

```typescript
const { error } = await supabase
  .from("ml_predictions_log")
  .upsert(payload as unknown as never, {
    onConflict:
      "beach_id,predicted_at,forecast_horizon_bucket,display_source",
    ignoreDuplicates: true,
  });
```

The Phase 21 RPC must use equivalent `ON CONFLICT DO NOTHING` behavior for missing snapshots and leave existing snapshot bytes unchanged.

**Delete from the final path:** lines 354-392 updates existing `ml_predictions_log` rows with trusted sidecar fields. This violates the locked first-write invariant. Trusted attribution belongs in append-only applications referencing the resolved snapshot identity.

The test at `log-display-prediction.test.ts` lines 605-642 currently blesses the invalid UPDATE. Reverse it: assert no `.update()` occurs and existing snapshot content remains unchanged.

### `supabase/migrations/20260727231500_create_trusted_external_forecast_adjustments.sql`

**Structural starting point:** same migration lines 1-78.

Retain `BEGIN`/`COMMIT`, explicit checks, indexes, RLS, revoked public roles, and service-role-only access. Replace the two-table mutable draft with append-only ingest runs, source results, issue revisions, decisions, applications, alerts, and build receipts.

**Strong analog:** `20260717170000_create_regional_recommendation_holds.sql`.

**Append-only trigger** (lines 230-257):

```sql
CREATE OR REPLACE FUNCTION public.reject_regional_recommendation_hold_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'regional recommendation hold history is append-only'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER regional_recommendation_holds_append_only
  BEFORE UPDATE OR DELETE ON public.regional_recommendation_holds
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_regional_recommendation_hold_mutation();
```

Apply this pattern to issues, decisions, applications, and receipts. Alert evidence is immutable; only the acknowledgement RPC may alter acknowledgement status, actor, and timestamp.

**Canonical JSON pattern** (lines 259-306):

```sql
CREATE OR REPLACE FUNCTION public.regional_recommendation_hold_canonical_payload(
  p_row public.regional_recommendation_holds
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'hold_id', p_row.hold_id,
    'valid_from', to_char(
      p_row.valid_from AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
    )
    -- explicit remaining fields
  );
$$;
```

Canonicalize explicit nulls, scaled numerics, timestamps, versions, and sorted arrays in SQL.

**Strict input and transaction lock** (lines 367-456):

```sql
IF p_transition IS NULL OR jsonb_typeof(p_transition) <> 'object' THEN
  RAISE EXCEPTION 'hold transition must be a JSON object'
    USING ERRCODE = '22023';
END IF;

IF EXISTS (
  SELECT 1
  FROM jsonb_object_keys(p_transition) AS supplied(key)
  WHERE supplied.key <> ALL (ARRAY[/* allowed keys */]::text[])
) THEN
  RAISE EXCEPTION 'hold transition contains an unsupported field'
    USING ERRCODE = '22023';
END IF;

PERFORM pg_advisory_xact_lock(
  hashtextextended('regional-hold-idempotency:' || v_idempotency_key, 0)
);
```

**Database-owned hash and collision pattern** (lines 990-1005):

```sql
v_payload := public.regional_recommendation_hold_canonical_payload(v_new);
v_payload_hash := encode(
  pg_catalog.sha256(convert_to(v_payload::text, 'UTF8')),
  'hex'
);

IF v_existing.record_id IS NOT NULL THEN
  IF v_existing.payload_hash <> v_payload_hash THEN
    RAISE EXCEPTION 'hold idempotency collision'
      USING ERRCODE = '23505';
  END IF;
  RETURN NEXT v_existing;
  RETURN;
END IF;
```

Phase 21 must additionally compare every exact durable count. Insert the immutable build receipt last so any prior error rolls back the full set.

**Least-privilege pattern** (lines 1483-1522):

```sql
REVOKE ALL ON public.regional_recommendation_holds
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.append_regional_recommendation_hold_transition(jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.append_regional_recommendation_hold_transition(jsonb)
  TO service_role;
```

Revoke table and function defaults from `PUBLIC`, `anon`, and `authenticated`; expose only the persistence and acknowledgement RPCs to `service_role`.

### Database and migration tests

**Runtime pgTAP analog:** `supabase/tests/database/claim_surf_alert_slot.test.sql`.

**Framework and privilege pattern** (lines 1-46):

```sql
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;
SELECT plan(19);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.claim_surf_alert_slot(uuid,uuid,uuid,date,smallint)',
    'EXECUTE'
  ),
  'anonymous clients cannot claim surf-alert delivery slots'
);
```

**Isolation pattern** (lines 331-333):

```sql
SELECT * FROM finish();
ROLLBACK;
```

Use pgTAP to execute actual UPDATE/DELETE blocks, invalid payload rollback, hash/count replays, idempotency collisions, first-write snapshot reuse, one-decision/day uniqueness, one-slot-claim uniqueness, acknowledgement restrictions, and role privileges.

The existing Jest migration test (`__tests__/migrations/trusted-external-forecast-adjustments.test.ts`) is a useful static smoke for prohibited destructive SQL and expected object names, but it cannot prove transactional semantics.

### Quiver unit and integration tests

**Pure decision fixture pattern** (`trusted-forecast-adjustment.test.ts` lines 8-39):

```typescript
const now = new Date("2026-07-27T12:00:00.000Z");

function source(
  overrides: Partial<TrustedExternalForecastRow> = {},
): TrustedExternalForecastRow {
  return {
    // complete valid default
    ...overrides,
  };
}
```

Keep reusable complete defaults and override one dimension per test. Replace draft expectations with the required threshold, lineage, exposure, local-day/DST, and raw-horizon matrices.

**Transport/replay test analog** (`major-event-hold/control.test.ts` lines 1074-1199):

```typescript
const loadByIdempotencyKey = jest
  .fn()
  .mockResolvedValueOnce(null)
  .mockResolvedValueOnce(existing);
const store = makeStore({
  loadByIdempotencyKey,
  appendTransition: jest
    .fn()
    .mockRejectedValue(new Error("hold idempotency collision")),
});

await expect(executeCommand(/* ... */)).resolves.toMatchObject({
  outcome: "accepted",
});
expect(loadByIdempotencyKey).toHaveBeenCalledTimes(2);
```

Use table-driven cases for returned receipt, definite SQL rejection, timeout then matching receipt, and every unresolved ambiguous state. Only matching receipt paths may expose adjusted output.

## Shared Patterns

### Default-on independent kill switches

**Sources:**

- `seaside/crons/fetch_wavecast_forecasts.py` lines 33-35
- `lib/services/forecast/trusted-forecast-adjustment.ts` lines 57-62

```python
os.getenv("TRUSTED_FORECAST_INGEST_ENABLED", "true").strip().lower() != "false"
```

```typescript
process.env.TRUSTED_FORECAST_ADJUSTMENTS_ENABLED?.trim().toLowerCase() !==
  "false"
```

Apply independently to ingestion and serving. Do not couple the switches.

### IANA local-calendar handling

**Sources:**

- `seaside/crons/fetch_wavecast_forecasts.py` lines 168-172
- `seaside/crons/fetch_rip_current_risk.py` lines 525-542

Use `ZoneInfo`, local midnight, and next local midnight, then convert each bound to UTC. Never assume a local day is 24 elapsed hours.

### Synchronous Supabase calls from async Seaside code

**Source:** `seaside/crons/fetch_rip_current_risk.py` lines 604-662.

```python
result = await asyncio.to_thread(
    lambda: supabase.from_(table)
    .select(columns)
    .range(offset, offset + page_size - 1)
    .execute()
)
```

Use the singleton client and `asyncio.to_thread()` for all calls.

### Server-only Quiver persistence

**Source:** `lib/recommendations/major-event-hold/control.ts` lines 1-4, 1406-1482.

Keep service-role persistence in a `server-only` module, validate returned rows, expose an injectable store interface to tests, and keep source evidence out of DTOs.

### Error handling

- Seaside: isolate each configured source, persist its outcome, persist successful issues, then raise aggregate unhealthy.
- Pure parsers: reject malformed/ambiguous input; do not substitute fetch time or fabricate units.
- Quiver persistence: distinguish definite database rejection from transport ambiguity; uncertainty is ambiguous.
- Builder: unresolved ambiguity is retriable and must not return baseline or adjusted output.

### Privacy

Apply to every public forecast producer and analytics serializer:

- No source ranges, narratives, URLs, attribution, hashes, parser metadata, evidence, provider lineage, issue IDs, decision IDs, or receipt IDs.
- Private values may affect only the final public height.
- Prove the boundary with negative serialization tests and database privilege tests.

## Patterns to Preserve vs. Replace

| Existing pattern | Preserve | Replace |
|---|---|---|
| `fetch_wavecast_forecasts.py` | frozen configs, source isolation, partial successful rows, `to_thread`, aggregate failure | fetched-time issue fallback, automatic redirects, WaveCast-only inventory, split-exposure loss |
| `trusted-forecast-adjustment.ts` | pure typed helper, early returns, deterministic sorting, default-on flag | UTC-window grouping, provider enum, midpoint conflict, unioned range, `Math.round`, mutable upsert |
| `forecast-builder.ts` | base → handoff → beach offset order, buffered rows, private server computation | feedback before trusted decision, rounded horizon admission, serving before atomic receipt |
| `log-display-prediction.ts` | first-write `ignoreDuplicates`, batch payload construction | trusted sidecar UPDATE and best-effort post-serving write |
| Current Phase 21 migration | checks, indexes, RLS, revoked public access | two mutable tables, UPDATE grant, prediction sidecar columns |
| Regional hold migration | append-only trigger, strict JSON, advisory lock, canonical hash, collision, service-role RPC | domain-specific hold fields and retention exceptions |

## No Analog Found

| File | Role | Data Flow | Reason / Planner Direction |
|---|---|---|---|
| `seaside/trusted_forecasts/parsers/surf_institute_pnw.py` | parser | transform | No production parser exists; use shared parser contract and source fixtures, evidence-only by default. |
| `seaside/trusted_forecasts/parsers/stormsurf.py` | parser | transform | No production parser exists; implement separate source-key functions with one shared lineage and explicit evidence classes. |
| `seaside/trusted_forecasts/parsers/surfers_view.py` | parser | transform | No production parser exists; implement two source-key functions with one shared lineage and no inferred face-height conversion. |

No exact repository analog exists for manual per-hop HTTPX redirect allowlisting, database receipts with exact durable count reconciliation, or an alert acknowledgement RPC restricted to three columns. Use the approved `21-RESEARCH.md` contract and the closest patterns above; do not weaken these behaviors to fit an older helper.

## Metadata

**Analog search scope:**

- `/Users/stevenchandler/Desktop/dev/quiver/lib/services/forecast`
- `/Users/stevenchandler/Desktop/dev/quiver/lib/recommendations/major-event-hold`
- `/Users/stevenchandler/Desktop/dev/quiver/supabase/migrations`
- `/Users/stevenchandler/Desktop/dev/quiver/supabase/tests/database`
- `/Users/stevenchandler/Desktop/dev/quiver/__tests__`
- `/Users/stevenchandler/Desktop/dev/seaside/crons`
- `/Users/stevenchandler/Desktop/dev/seaside/scripts`
- `/Users/stevenchandler/Desktop/dev/seaside/tests`
- `/Users/stevenchandler/Desktop/dev/surf-forecast-ingestion`

**Strong analog files fully or materially analyzed:** 20
**Pattern extraction date:** 2026-07-27
**Implementation state:** Current trusted-adjustment code and migration are unapplied drafts containing known Phase 21 contract violations. Treat them as integration-location analogs, not approved semantics.
