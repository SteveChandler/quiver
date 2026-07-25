# Phase 0D Observation Matching and Trustworthy Source Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace earliest-in-window observation pairing with immutable nearest-time lineage and produce promotion-blocked, identical-row source-policy evaluation reports.

**Architecture:** A pure Seaside matcher selects the nearest immutable observation revision from one persisted, target-specific station-resolution snapshot using millisecond-precise deterministic tie-breaking. Quiver owns append-only contiguous station-ingestion coverage, unresolved-attempt/retry evidence, match lineage, and V1/V2 comparison artifacts. Seaside dual-runs the new matcher as append-only evidence and evaluates only matured, full-window-complete, scoring-eligible P0-C candidates on identical rows. A 64-bucket fair sweep plus database-derived retry backoff prevents permanently incomplete history from starving newer targets. Phase 0D never cuts over the legacy observation writer and cannot change forecast serving or the display-height offset inputs.

**Tech Stack:** Python 3.11, pytest, FastAPI service cron modules, Supabase/PostgreSQL migrations and RLS, TypeScript/Jest migration tests, Node.js 22, Yarn 1.

## Global Constraints

- Execute Quiver commands from `/Users/stevenchandler/Desktop/dev/quiver` and Seaside commands from `/Users/stevenchandler/Desktop/dev/seaside`.
- P0-C's `forecast_source_issuance_revisions` and `forecast_source_candidates` schema must land before the P0-D migration is applied.
- Do not apply the migration to any database until its plan is explicitly approved. A linked or production apply, Quiver/Seaside deploy, or production flag change requires a separate explicit release approval.
- `OBSERVATION_MATCHER_V2_MODE` is server-only, accepts only `off|compare`, and defaults to `off`; Phase 0 has no V2 compatibility-write mode.
- `SOURCE_POLICY_EVALUATION_ENABLED` is server-only, defaults to `false`, and never affects forecast serving.
- Matching policy `nearest-time.v2` uses a 43,200,000-millisecond retrieval tolerance, a 7,200,000-millisecond scoring tolerance, an 86,400-second maturity delay, and a 25 km automatic station-distance ceiling.
- Timestamp comparison is millisecond-precise. Inputs with precision finer than one millisecond are rejected at the repository boundary rather than truncated.
- A match or `no_observation` result is terminal only after `valid_time + 24 hours` and one immutable, gap-free station/source ingestion coverage interval enclosing the entire `valid_time - 12 hours` through `valid_time + 12 hours` window. A latest poll timestamp or wall-clock age is not completeness evidence.
- Station distance is recomputed against the requested target beach by the frozen resolver. Never reuse `unified_wave_observations.distance_to_beach_km`, which describes a station's stored nearest beach.
- A configured CDIP station may be retrieved outside 25 km for compatibility, but it is not scoring-eligible unless its recorded distance is at most 25 km.
- A time tie chooses the earlier observation, then lexical station ID, then lexical observation identity.
- Trustworthy source scoring uses P0-C `offshore_significant_height` in meters. Legacy prediction snapshots retain their real raw/corrected/display fields and bases for matcher diagnostics; they are never coerced into offshore source candidates or breaking-face truth.
- Historical `ml_predictions_log.observed_m` rows without P0-D lineage remain untrusted; do not relabel or overwrite them in bulk.
- A legacy NOAA/Open-Meteo baseline without exact immutable issuance lineage is descriptive only and emits `baseline_issuance_lineage_missing`; P0-D must not manufacture cycle identity from retrieval time.
- Rows with unknown provider issue cycles may appear in descriptive coverage but cannot count as independent cycles or pass a promotion gate.
- QA-only or scraped forecaster evidence has no automatic effect on matching, scoring, forecasts, or recommendations.
- Reports must use one canonical comparison-unit ID, identical candidate rows, frozen segment definitions, and a reproducible two-way cluster bootstrap over issue cycle and station/region.
- Phase 0D has no serving promotion, no forecast-height change, and no user-facing low-confidence behavior.
- Preserve unrelated dirty worktree changes and stage only files owned by the task.
- Do not create commits unless the user separately and explicitly authorizes commits.
- Before compare mode, verify `cron.job` has no duplicate active observation comparison job. The existing legacy `backfill-observations` writer remains authoritative and unchanged.

---

## File Map

### Quiver

- Create `supabase/migrations/20260717173000_create_forecast_observation_matches.sql`: service-only observation evidence view, immutable contiguous station-ingestion coverage, unresolved-attempt retry ledger, frozen target-specific station resolver, append-only match and V1/V2 comparison lineage, current-match/retry views, sole-write RPCs, policies, and mutation protection.
- Create `__tests__/migrations/forecast-observation-matches.test.ts`: static schema and safety-contract assertions.
- Create `scripts/db/forecast-observation-matches-smoke.sql`: local PostgreSQL behavior tests for policy, lineage, completeness, idempotency, and sole-write RPCs.
- Modify `types/database.generated.ts`: regenerate database types after the local migration is applied.
- Modify `lib/services/ioos/ioos-service.ts`: return explicit success-with-data, success-empty, and failure fetch outcomes needed for completeness.
- Modify `app/api/cron/ioos-sync/route.ts`: append per-station successful poll watermarks.
- Modify `app/api/cron/ndbc-direct-sync/route.ts`: append per-station successful poll watermarks.
- Modify `__tests__/app/api/cron/ioos-sync-observations.test.ts`: watermark success/failure coverage; review `ioos-sync-deactivation.test.ts` and change it only if deactivation behavior is affected.
- Modify `__tests__/app/api/cron/ndbc-direct-sync.test.ts`: watermark success/failure coverage.

### Seaside

- Create `crons/observation_matching.py`: immutable matcher policy, observation-revision identity, UTC millisecond normalization, deterministic nearest selection, and scoring eligibility.
- Create `crons/observation_match_repository.py`: frozen input snapshots, evidence-row retrieval, full-window coverage checks, and idempotent append-only RPC persistence.
- Create `crons/match_forecast_source_candidates.py`: matured P0-C candidate matching.
- Modify `crons/backfill_observations.py`: retain the legacy path in both modes and run a separate append-only comparison batch under `compare`.
- Modify `config.py`: strict parsing for both P0-D server flags.
- Modify `scheduler.py`: register the source-candidate matcher at minute 35; the job is a no-op unless enabled.
- Create `scripts/source_policy_segments.v1.json`: frozen row, segment, exclusion, metric, and guardrail definitions.
- Create `scripts/source_policy_beach_classifications.v1.json`: canonical beach-to-region snapshot from P0-C scope plus explicit versioned exposure placeholders and content hash.
- Create `scripts/source_policy_event_cases.v1.json`: frozen event-case registry; it starts empty and keeps the event gate blocked until reviewed cases are added in a separately approved evidence change.
- Create `scripts/source_policy_evaluation_report.py`: canonical-unit report with deterministic two-way cluster bootstrap and explicit blockers.
- Modify `tests/test_backfill_observations.py`: dispatch, nearest-time, compatibility, and failure-path coverage.
- Create `tests/test_observation_matching.py`: pure matcher tests.
- Create `tests/test_observation_match_repository.py`: query, persistence, idempotency, and failure tests.
- Create `tests/test_match_forecast_source_candidates.py`: maturity and exact-revision tests.
- Create `tests/test_source_policy_evaluation_report.py`: segment, identical-row, bootstrap, and blocker tests.
- Create `tests/fixtures/source_policy_evaluation_rows.jsonl`: fixed candidate/observation rows for deterministic report verification.
- Create `tests/fixtures/source_policy_capture_rows.json`: fixed run/scope/attempt rows for database-derived capture-denominator tests.
- Create `tests/fixtures/source_policy_event_cases.reviewed.json`: reviewed synthetic registry fixture for the only gate-ready test path.
- Create `tests/fixtures/source_policy_beach_classifications.reviewed.json`: hash-valid synthetic region/exposure fixture for report determinism tests.
- Modify `tests/test_scheduler_registration.py`: active job contract.
- Modify `docs/README.md`: P0-D flags, report commands, and no-promotion boundary.

## Contract Map

The matcher contract defines immutable `ObservationCandidate` and
`ObservationMatch` dataclasses with the fields shown in Task 1. Its callable
signature is `choose_nearest_observation(*, valid_time: datetime,
candidates: Sequence[ObservationCandidate], station_resolver_version: str,
policy: ObservationMatcherPolicy = MATCHER_POLICY_V2) -> ObservationMatch |
None`.

The repository signatures are `load_match_input_snapshot(supabase: Any, *,
target: ForecastMatchTarget, station_cache: dict[str, StationResolution |
None], as_of: datetime) -> MatchInputSnapshot` and `match_target(supabase:
Any, *, target: ForecastMatchTarget, snapshot: MatchInputSnapshot, now:
datetime) -> PersistedMatchResult`. The comparison adapters are
`run_one_v1_v2_comparison(supabase: Any, pred: dict[str, Any], *, snapshot:
MatchInputSnapshot, now: datetime) -> PersistedComparisonResult` and
`run_v2_comparison_batch(supabase: Any, *, now: datetime) ->
ComparisonBatchResult`; they only record append-only evidence.

The retry contracts are `record_match_attempt(supabase: Any, *, target:
ForecastMatchTarget, snapshot: MatchInputSnapshot | None, outcome:
Literal["pending_incomplete", "no_station", "repository_error"], run_started_at: datetime,
error_code: str | None = None) -> MatchAttemptReceipt` and
`active_match_buckets(run_started_at: datetime) -> tuple[int, ...]`. The database, not the
worker, derives the attempt ordinal, one of 64 stable target buckets, and the
frozen retry schedule of 1, 2, 4, 8, 24, 72, then 168 hours. Attempt evidence
never substitutes for a match or `no_observation` row.

The pure boundary is `evaluate_match_target(*, target: ForecastMatchTarget,
snapshot: MatchInputSnapshot, now: datetime, policy:
ObservationMatcherPolicy = MATCHER_POLICY_V2) -> MatchEvaluation`.
`match_target()` persists that evaluation through the standalone RPC; V1/V2
comparison sends the same evaluation to the atomic two-artifact RPC.

The stable write identity is `compute_match_idempotency_key(target:
ForecastMatchTarget, *, matcher_version: str, station_resolver_version: str)
-> str`. It excludes result data. `compute_match_payload_hash(payload:
Mapping[str, Any]) -> str` hashes the separately canonicalized immutable result,
so a same-version rerun that observes different data becomes an explicit
collision instead of silently relabeling history.

The append-only match table accepts either one legacy prediction target or one P0-C source candidate target. Every row carries a hash-validated target value snapshot, station-resolution snapshot, selected observation values and revision, the full-window coverage proof, millisecond deltas, frozen policy, matcher, resolver, and eligibility lineage. Legacy target snapshots include the actual `raw_forecast_m`, `corrected_forecast_m`, `wave_height_om`, `om_passthrough_m`, `raw_display_height_m`, and `offset_corrected_display_height_m` columns with nulls preserved; P0-C snapshots contain candidate `wave_height_m`, `offshore_significant_height`, and meters. The separate attempt table records only unresolved operational outcomes and retry eligibility. Direct inserts are revoked. Sole-write RPCs recompute and validate source-backed target, station-resolution, observation, coverage, retry, and payload identities before insertion.

---

### Task 1: Freeze the Matcher Policy and Prove Nearest-Time Selection

**Files:**
- Create: `/Users/stevenchandler/Desktop/dev/seaside/crons/observation_matching.py`
- Create: `/Users/stevenchandler/Desktop/dev/seaside/tests/test_observation_matching.py`

**Interfaces:**
- Consumes: UTC datetimes and raw observation candidates from the repository layer.
- Produces: `MATCHER_POLICY_V2`, `ObservationCandidate`, `ObservationMatch`, `build_observation_revision_identity()`, and `choose_nearest_observation()`.

- [ ] **Step 1: Write the failing policy and tie-break tests**

```python
from datetime import datetime, timezone

import pytest

from crons.observation_matching import (
    MATCHER_POLICY_V2,
    ObservationCandidate,
    build_observation_revision_identity,
    choose_nearest_observation,
)


UTC = timezone.utc
VALID_TIME = datetime(2026, 7, 17, 12, 0, tzinfo=UTC)


def candidate(station_id: str, observed_at: datetime, height: float = 1.4, distance: float = 8.0):
    revision_id, payload_hash = build_observation_revision_identity(
        source="ioos",
        source_record_id="ioos:42",
        source_payload_hash="a" * 64,
        station_id=station_id,
        observed_at=observed_at,
        wave_height_m=height,
        wave_period_s=14.0,
        wave_direction_deg=275.0,
        quality_control_version="positive-height.v1",
    )
    return ObservationCandidate(
        observation_revision_id=revision_id,
        observation_payload_hash=payload_hash,
        source_record_id="ioos:42",
        source_payload_hash="a" * 64,
        quality_control_version="positive-height.v1",
        source="ioos",
        station_id=station_id,
        observed_at=observed_at,
        wave_height_m=height,
        wave_period_s=14.0,
        wave_direction_deg=275.0,
        distance_to_beach_km=distance,
    )


def test_policy_values_are_frozen() -> None:
    assert MATCHER_POLICY_V2.matcher_version == "nearest-time.v2"
    assert MATCHER_POLICY_V2.retrieval_tolerance_milliseconds == 43_200_000
    assert MATCHER_POLICY_V2.scoring_tolerance_milliseconds == 7_200_000
    assert MATCHER_POLICY_V2.maturity_delay_seconds == 86_400
    assert MATCHER_POLICY_V2.max_station_distance_km == 25.0


def test_nearest_candidate_wins_instead_of_earliest_in_window() -> None:
    result = choose_nearest_observation(
        valid_time=VALID_TIME,
        candidates=[
            candidate("station-a", datetime(2026, 7, 17, 1, 0, tzinfo=UTC)),
            candidate("station-a", datetime(2026, 7, 17, 11, 45, tzinfo=UTC)),
        ],
        station_resolver_version="station-resolver.2026-07-17.v3",
    )
    assert result is not None
    assert result.candidate.observed_at == datetime(2026, 7, 17, 11, 45, tzinfo=UTC)
    assert result.signed_delta_milliseconds == -900_000
    assert result.scoring_eligible is True


def test_equal_delta_prefers_earlier_observation() -> None:
    result = choose_nearest_observation(
        valid_time=VALID_TIME,
        candidates=[
            candidate("station-a", datetime(2026, 7, 17, 12, 30, tzinfo=UTC)),
            candidate("station-a", datetime(2026, 7, 17, 11, 30, tzinfo=UTC)),
        ],
        station_resolver_version="station-resolver.2026-07-17.v3",
    )
    assert result is not None
    assert result.candidate.observed_at == datetime(2026, 7, 17, 11, 30, tzinfo=UTC)


def test_nearest_outside_scoring_tolerance_is_retained_but_ineligible() -> None:
    result = choose_nearest_observation(
        valid_time=VALID_TIME,
        candidates=[
            candidate("station-a", datetime(2026, 7, 17, 9, 0, tzinfo=UTC)),
        ],
        station_resolver_version="station-resolver.2026-07-17.v3",
    )
    assert result is not None
    assert result.abs_delta_milliseconds == 10_800_000
    assert result.scoring_eligible is False
    assert result.scoring_exclusion_reason == "time_delta_exceeds_scoring_tolerance"
```

- [ ] **Step 2: Run the tests and verify the expected import failure**

Run:

```bash
python -m pytest tests/test_observation_matching.py -v --tb=short
```

Expected: FAIL during collection with `ModuleNotFoundError: No module named 'crons.observation_matching'`.

- [ ] **Step 3: Implement the pure matcher**

```python
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from hashlib import sha256
import json
import math
from typing import Sequence


@dataclass(frozen=True)
class ObservationMatcherPolicy:
    matcher_version: str
    retrieval_tolerance_milliseconds: int
    scoring_tolerance_milliseconds: int
    maturity_delay_seconds: int
    max_station_distance_km: float


MATCHER_POLICY_V2 = ObservationMatcherPolicy(
    matcher_version="nearest-time.v2",
    retrieval_tolerance_milliseconds=43_200_000,
    scoring_tolerance_milliseconds=7_200_000,
    maturity_delay_seconds=86_400,
    max_station_distance_km=25.0,
)


@dataclass(frozen=True)
class ObservationCandidate:
    observation_revision_id: str
    observation_payload_hash: str
    source_record_id: str
    source_payload_hash: str
    quality_control_version: str
    source: str
    station_id: str
    observed_at: datetime
    wave_height_m: float
    wave_period_s: float | None
    wave_direction_deg: float | None
    distance_to_beach_km: float | None


@dataclass(frozen=True)
class ObservationMatch:
    candidate: ObservationCandidate
    signed_delta_milliseconds: int
    abs_delta_milliseconds: int
    scoring_eligible: bool
    scoring_exclusion_reason: str | None
    matcher_version: str
    station_resolver_version: str


def _utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def canonical_decimal(value: float | None, *, places: int) -> str | None:
    if value is None:
        return None
    if not math.isfinite(value):
        raise ValueError("observation values must be finite")
    quantum = Decimal(1).scaleb(-places)
    return format(Decimal(str(value)).quantize(quantum, rounding=ROUND_HALF_UP), "f")


def canonical_json(value: dict[str, object]) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _utc_milliseconds(value: datetime) -> datetime:
    normalized = _utc(value)
    if normalized.microsecond % 1_000 != 0:
        raise ValueError("observation timestamps must have millisecond precision")
    return normalized


def _delta_milliseconds(left: datetime, right: datetime) -> int:
    delta = _utc_milliseconds(left) - _utc_milliseconds(right)
    return (
        delta.days * 86_400_000
        + delta.seconds * 1_000
        + delta.microseconds // 1_000
    )


def build_observation_revision_identity(
    *,
    source: str,
    source_record_id: str,
    source_payload_hash: str,
    station_id: str,
    observed_at: datetime,
    wave_height_m: float,
    wave_period_s: float | None,
    wave_direction_deg: float | None,
    quality_control_version: str,
) -> tuple[str, str]:
    observed_text = (
        _utc_milliseconds(observed_at)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )
    payload = "\x1f".join([
        source,
        source_record_id,
        source_payload_hash,
        station_id,
        observed_text,
        canonical_decimal(wave_height_m, places=3) or "null",
        canonical_decimal(wave_period_s, places=2) or "null",
        canonical_decimal(wave_direction_deg, places=2) or "null",
        quality_control_version,
    ])
    payload_hash = sha256(payload.encode("utf-8")).hexdigest()
    return f"obsrev:{payload_hash}", payload_hash


def choose_nearest_observation(
    *,
    valid_time: datetime,
    candidates: Sequence[ObservationCandidate],
    station_resolver_version: str,
    policy: ObservationMatcherPolicy = MATCHER_POLICY_V2,
) -> ObservationMatch | None:
    target = _utc_milliseconds(valid_time)
    eligible_candidates: list[tuple[int, int, str, str, ObservationCandidate]] = []
    for candidate in candidates:
        if not math.isfinite(candidate.wave_height_m) or candidate.wave_height_m <= 0:
            continue
        observed_at = _utc_milliseconds(candidate.observed_at)
        signed_delta = _delta_milliseconds(observed_at, target)
        abs_delta = abs(signed_delta)
        if abs_delta > policy.retrieval_tolerance_milliseconds:
            continue
        eligible_candidates.append(
            (
                abs_delta,
                0 if signed_delta <= 0 else 1,
                candidate.station_id,
                candidate.observation_revision_id,
                candidate,
            )
        )
    if not eligible_candidates:
        return None

    selected = min(eligible_candidates, key=lambda item: item[:4])[-1]
    signed_delta = _delta_milliseconds(selected.observed_at, target)
    abs_delta = abs(signed_delta)
    exclusion_reason: str | None = None
    if abs_delta > policy.scoring_tolerance_milliseconds:
        exclusion_reason = "time_delta_exceeds_scoring_tolerance"
    elif selected.distance_to_beach_km is None or not math.isfinite(selected.distance_to_beach_km):
        exclusion_reason = "station_distance_missing"
    elif selected.distance_to_beach_km > policy.max_station_distance_km:
        exclusion_reason = "station_distance_exceeds_policy"

    return ObservationMatch(
        candidate=selected,
        signed_delta_milliseconds=signed_delta,
        abs_delta_milliseconds=abs_delta,
        scoring_eligible=exclusion_reason is None,
        scoring_exclusion_reason=exclusion_reason,
        matcher_version=policy.matcher_version,
        station_resolver_version=station_resolver_version,
    )
```

- [ ] **Step 4: Add invalid-height, distance, UTC, and deterministic-identity assertions**

```python
def test_nonpositive_height_is_excluded() -> None:
    assert choose_nearest_observation(
        valid_time=VALID_TIME,
        candidates=[candidate("station-a", VALID_TIME, height=0.0)],
        station_resolver_version="station-resolver.2026-07-17.v3",
    ) is None


@pytest.mark.parametrize("height", [float("nan"), float("inf"), float("-inf")])
def test_nonfinite_height_is_rejected_before_identity_is_built(height: float) -> None:
    with pytest.raises(ValueError, match="finite"):
        candidate("station-a", VALID_TIME, height=height)


@pytest.mark.parametrize("distance", [float("nan"), float("inf"), float("-inf")])
def test_nonfinite_distance_is_not_scoring_eligible(distance: float) -> None:
    result = choose_nearest_observation(
        valid_time=VALID_TIME,
        candidates=[candidate("station-a", VALID_TIME, distance=distance)],
        station_resolver_version="station-resolver.2026-07-17.v3",
    )
    assert result is not None
    assert result.scoring_eligible is False
    assert result.scoring_exclusion_reason == "station_distance_missing"


def test_station_beyond_25_km_is_not_scoring_eligible() -> None:
    result = choose_nearest_observation(
        valid_time=VALID_TIME,
        candidates=[candidate("station-a", VALID_TIME, distance=25.001)],
        station_resolver_version="station-resolver.2026-07-17.v3",
    )
    assert result is not None
    assert result.scoring_eligible is False
    assert result.scoring_exclusion_reason == "station_distance_exceeds_policy"


def test_naive_datetime_is_interpreted_as_utc() -> None:
    result = choose_nearest_observation(
        valid_time=datetime(2026, 7, 17, 12, 0),
        candidates=[candidate("station-a", VALID_TIME)],
        station_resolver_version="station-resolver.2026-07-17.v3",
    )
    assert result is not None
    assert result.abs_delta_milliseconds == 0


def test_observation_revision_identity_is_stable_for_same_utc_instant() -> None:
    utc_value = datetime(2026, 7, 17, 12, 0, tzinfo=UTC)
    offset_value = datetime.fromisoformat("2026-07-17T05:00:00-07:00")
    shared = {
        "source": "ioos",
        "source_record_id": "ioos:42",
        "source_payload_hash": "a" * 64,
        "station_id": "station-a",
        "wave_height_m": 1.4,
        "wave_period_s": 14.0,
        "wave_direction_deg": 275.0,
        "quality_control_version": "positive-height.v1",
    }
    assert build_observation_revision_identity(observed_at=utc_value, **shared) == (
        build_observation_revision_identity(observed_at=offset_value, **shared)
    )


@pytest.mark.parametrize(
    ("value", "expected"),
    [(1.2345, "1.235"), (-1.2345, "-1.235")],
)
def test_numeric_ties_match_postgresql_round(value: float, expected: str) -> None:
    assert canonical_decimal(value, places=3) == expected


def test_submillisecond_timestamp_is_rejected_instead_of_truncated() -> None:
    with pytest.raises(ValueError, match="millisecond precision"):
        candidate(
            "station-a",
            datetime(2026, 7, 17, 12, 0, 0, 1, tzinfo=UTC),
        )
```

- [ ] **Step 5: Run the focused tests**

Run:

```bash
python -m pytest tests/test_observation_matching.py -v --tb=short
```

Expected: PASS.

- [ ] **Step 6: Commit the pure matcher only if commits were explicitly authorized**

```bash
git add crons/observation_matching.py tests/test_observation_matching.py
git commit -m "fix(forecast): add deterministic nearest observation matcher"
```

### Task 2: Add Append-Only Match Lineage in Quiver

**Files:**
- Create: `/Users/stevenchandler/Desktop/dev/quiver/supabase/migrations/20260717173000_create_forecast_observation_matches.sql`
- Create: `/Users/stevenchandler/Desktop/dev/quiver/__tests__/migrations/forecast-observation-matches.test.ts`
- Create: `/Users/stevenchandler/Desktop/dev/quiver/scripts/db/forecast-observation-matches-smoke.sql`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver/types/database.generated.ts`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver/lib/services/ioos/ioos-service.ts`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver/app/api/cron/ioos-sync/route.ts`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver/app/api/cron/ndbc-direct-sync/route.ts`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver/__tests__/app/api/cron/ioos-sync-observations.test.ts`
- Review: `/Users/stevenchandler/Desktop/dev/quiver/__tests__/app/api/cron/ioos-sync-deactivation.test.ts`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver/__tests__/app/api/cron/ndbc-direct-sync.test.ts`

**Interfaces:**
- Consumes: P0-C `forecast_source_candidates.candidate_id` and `forecast_source_issuance_revisions.issuance_revision_id`.
- Produces: `observation_evidence_rows`, `observation_station_ingestion_watermarks`, `resolve_beach_observation_station_v3(uuid,timestamptz)`, `forecast_observation_match_attempts`, `current_forecast_observation_match_attempts`, `forecast_observation_matches`, `current_forecast_observation_matches`, `forecast_observation_match_comparisons`, `record_observation_station_ingestion_coverage_v1(jsonb)`, `record_forecast_observation_match_attempt_v1(jsonb)`, `list_forecast_observation_match_due_targets_v1(text,timestamptz,integer)`, `record_forecast_observation_match_v1(jsonb)`, and `record_forecast_observation_comparison(jsonb,jsonb)`.

- [ ] **Step 1: Write the failing migration contract test**

```typescript
import fs from "node:fs";
import path from "node:path";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260717173000_create_forecast_observation_matches.sql"
);

describe("forecast observation match lineage migration", () => {
  const sql = fs.readFileSync(migrationPath, "utf8");

  it("creates append-only match lineage with exactly one target kind", () => {
    expect(sql).toMatch(/CREATE TABLE public\.observation_station_ingestion_watermarks/i);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.resolve_beach_observation_station_v3/i);
    expect(sql).toMatch(/CREATE TABLE public\.forecast_observation_match_attempts/i);
    expect(sql).toMatch(/CREATE VIEW public\.current_forecast_observation_match_attempts/i);
    expect(sql).toMatch(/CREATE TABLE public\.forecast_observation_matches/i);
    expect(sql).toMatch(/CREATE TABLE public\.forecast_observation_match_comparisons/i);
    expect(sql).toContain("record_forecast_observation_comparison");
    expect(sql).toContain("record_forecast_observation_match_attempt_v1");
    expect(sql).toContain("list_forecast_observation_match_due_targets_v1");
    expect(sql).toContain("ml_prediction_id");
    expect(sql).toContain("forecast_source_candidate_id");
    expect(sql).toMatch(/num_nonnulls\(ml_prediction_id, forecast_source_candidate_id\) = 1/i);
    expect(sql).toContain("issuance_revision_id");
    expect(sql).toContain("observation_revision_id");
    expect(sql).toContain("observation_payload_hash");
    expect(sql).toContain("station_resolution_id");
    expect(sql).toContain("target_value_snapshot");
    expect(sql).toContain("target_value_snapshot_hash");
    expect(sql).toContain("input_snapshot_canonical");
    expect(sql).toContain("watermark_covered_from");
    expect(sql).toContain("watermark_covered_through");
    expect(sql).toContain("idempotency_key");
    expect(sql).toContain("payload_hash");
    expect(sql).toMatch(/FOREIGN KEY \(forecast_source_candidate_id, issuance_revision_id\)/i);
    expect(sql).not.toMatch(/ON DELETE CASCADE/i);
  });

  it("persists tolerances, versions, maturity, and scoring eligibility", () => {
    for (const column of [
      "signed_delta_milliseconds",
      "abs_delta_milliseconds",
      "retrieval_tolerance_milliseconds",
      "scoring_tolerance_milliseconds",
      "maturity_delay_seconds",
      "station_resolver_version",
      "matcher_version",
      "scoring_eligible",
      "scoring_exclusion_reason",
    ]) {
      expect(sql).toContain(column);
    }
    expect(sql).toMatch(/abs_delta_milliseconds <= retrieval_tolerance_milliseconds/i);
    expect(sql).toMatch(/watermark_covered_from <= retrieval_window_start/i);
    expect(sql).toMatch(/watermark_covered_through >= retrieval_window_end/i);
    expect(sql).toContain("retrieval_tolerance_milliseconds = 43200000");
    expect(sql).toContain("scoring_tolerance_milliseconds = 7200000");
    expect(sql).toContain("maturity_delay_seconds = 86400");
    expect(sql).toMatch(/WITH \(security_invoker = true\)/i);
  });

  it("blocks update and delete and grants no client mutation", () => {
    expect(sql).toContain("reject_forecast_observation_match_mutation");
    expect(sql).toMatch(/BEFORE UPDATE OR DELETE/i);
    expect(sql).toMatch(/REVOKE ALL ON public\.forecast_observation_matches FROM anon, authenticated/i);
    expect(sql).toMatch(/REVOKE INSERT, UPDATE, DELETE ON public\.forecast_observation_matches FROM service_role/i);
    expect(sql).toContain("validate_forecast_observation_match_target");
    expect(sql).toContain("record_forecast_observation_match_v1");
    expect(sql).toMatch(/REVOKE INSERT, UPDATE, DELETE ON public\.forecast_observation_match_attempts FROM service_role/i);
  });

  it("records unresolved attempts without allowing them to become match truth", () => {
    expect(sql).toContain("pending_incomplete");
    expect(sql).toContain("repository_error");
    expect(sql).toContain("no_station");
    expect(sql).toContain("fair_bucket");
    expect(sql).toContain("retry_after");
    expect(sql).toContain("ARRAY[1,2,4,8,24,72,168]");
    expect(sql).not.toMatch(/match_status[^;]+pending_incomplete/is);
    expect(sql).not.toMatch(/match_status[^;]+no_station/is);
  });

  it("stores replayable V1 lineage and validates real legacy fields", () => {
    expect(sql).toContain("v1_observation_source_record_id");
    expect(sql).toContain("v1_observation_source_payload_hash");
    expect(sql).toContain("v1_observed_wave_height_m");
    expect(sql).toContain("raw_forecast_m");
    expect(sql).toContain("corrected_forecast_m");
    expect(sql).toContain("raw_display_height_m");
    expect(sql).not.toMatch(/select beach_id, predicted_at, forecast_m/i);
  });
});
```

- [ ] **Step 2: Run the migration test and verify it fails because the SQL file is absent**

Run:

```bash
yarn jest __tests__/migrations/forecast-observation-matches.test.ts --runInBand
```

Expected: FAIL with `ENOENT` for `20260717173000_create_forecast_observation_matches.sql`.

- [ ] **Step 3: Create the migration**

The migration must contain this core schema contract plus the atomic comparison RPC specified immediately after it:

```sql
BEGIN;

CREATE OR REPLACE FUNCTION public.sha256_hex_v1(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = public, extensions, pg_temp
AS $$
  SELECT encode(digest(convert_to(p_value, 'UTF8'), 'sha256'), 'hex')
$$;

CREATE OR REPLACE FUNCTION public.observation_revision_id_v1(
  p_source text,
  p_source_record_id text,
  p_source_payload_hash text,
  p_station_id text,
  p_observed_at timestamptz,
  p_wave_height_m numeric,
  p_wave_period_s numeric,
  p_wave_direction_deg numeric,
  p_quality_control_version text
) RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions, pg_temp
AS $$
  SELECT 'obsrev:' || public.sha256_hex_v1(concat_ws(E'\x1f',
    p_source,
    p_source_record_id,
    p_source_payload_hash,
    p_station_id,
    to_char(p_observed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    round(p_wave_height_m, 3)::text,
    coalesce(round(p_wave_period_s, 2)::text, 'null'),
    coalesce(round(p_wave_direction_deg, 2)::text, 'null'),
    p_quality_control_version
  ))
$$;

CREATE VIEW public.observation_evidence_rows
WITH (security_invoker = true) AS
SELECT
  'ioos'::text AS source,
  'ioos:' || o.id::text AS source_record_id,
  public.sha256_hex_v1(jsonb_build_object(
    'source', 'ioos', 'id', o.id, 'station_id', o.station_id,
    'observed_at', o.observed_at, 'wave_height_m', o.wave_height_m,
    'wave_period_s', o.wave_period_s,
    'wave_direction_deg', o.wave_direction_deg, 'raw_data', o.raw_data
  )::text) AS source_payload_hash,
  o.station_id,
  o.observed_at,
  o.wave_height_m,
  o.wave_period_s,
  o.wave_direction_deg,
  o.created_at AS ingested_at
FROM public.ioos_observations o
UNION ALL
SELECT
  'ndbc_direct'::text,
  'ndbc_direct:' || o.id::text,
  public.sha256_hex_v1(jsonb_build_object(
    'source', 'ndbc_direct', 'id', o.id, 'station_id', o.station_id,
    'observed_at', o.observed_at, 'wave_height_m', o.wave_height_m,
    'wave_period_s', o.wave_period_s,
    'wave_direction_deg', o.wave_direction_deg
  )::text),
  o.station_id,
  o.observed_at,
  o.wave_height_m,
  o.wave_period_s,
  o.wave_direction_deg,
  o.created_at
FROM public.ndbc_direct_observations o;

CREATE TABLE public.observation_station_ingestion_watermarks (
  watermark_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('ioos', 'ndbc_direct')),
  station_id text NOT NULL,
  poll_started_at timestamptz NOT NULL,
  poll_completed_at timestamptz NOT NULL,
  request_window_start timestamptz NOT NULL,
  request_window_end timestamptz NOT NULL,
  covered_from timestamptz NOT NULL,
  covered_through timestamptz NOT NULL,
  outcome text NOT NULL
    CHECK (outcome IN ('success_with_data', 'success_empty')),
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  source_response_hash text NOT NULL CHECK (source_response_hash ~ '^[0-9a-f]{64}$'),
  completed_page_count integer NOT NULL CHECK (completed_page_count >= 1),
  coverage_gap_count integer NOT NULL CHECK (coverage_gap_count = 0),
  ingestion_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, station_id, poll_started_at, ingestion_version),
  CHECK (poll_completed_at >= poll_started_at),
  CHECK (request_window_start < request_window_end),
  CHECK (covered_from = request_window_start),
  CHECK (covered_through = request_window_end)
);

CREATE OR REPLACE FUNCTION public.resolve_beach_observation_station_v3(
  p_beach_id uuid,
  p_as_of timestamptz
) RETURNS TABLE (
  station_resolution_id text,
  station_id text,
  station_source text,
  resolution_tier text,
  distance_to_target_beach_km numeric,
  resolved_at timestamptz,
  resolver_version text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
WITH target AS (
  SELECT b.*,
    'edu_ucsd_cdip_' || lpad(
      nullif(regexp_replace(b.cdip_station, '\D', '', 'g'), ''), 3, '0'
    ) AS preferred_cdip_id
  FROM public.beaches b
  WHERE b.id = p_beach_id
), station_candidates AS (
  SELECT 0 AS tier_order, 'configured_cdip'::text AS resolution_tier,
    'ioos'::text AS station_source, s.station_id,
    extensions.ST_Distance(t.geog, s.coordinates::extensions.geography) / 1000.0 AS distance_km
  FROM target t
  JOIN public.ioos_stations s ON s.station_id = t.preferred_cdip_id
  WHERE s.active = true
    AND EXISTS (
      SELECT 1 FROM public.ioos_observations o
      WHERE o.station_id = s.station_id
        AND o.observed_at BETWEEN p_as_of - interval '7 days' AND p_as_of
        AND o.wave_height_m > 0
    )
  UNION ALL
  SELECT 1, 'ioos_direct', 'ioos', s.station_id,
    extensions.ST_Distance(t.geog, s.coordinates::extensions.geography) / 1000.0
  FROM target t
  JOIN public.ioos_stations s ON s.nearest_beach_id = t.id
  WHERE s.active = true AND s.has_wave_data = true
    AND extensions.ST_DWithin(t.geog, s.coordinates::extensions.geography, 25000)
  UNION ALL
  SELECT 2, 'ioos_spatial', 'ioos', s.station_id,
    extensions.ST_Distance(t.geog, s.coordinates::extensions.geography) / 1000.0
  FROM target t
  JOIN public.ioos_stations s ON s.active = true AND s.has_wave_data = true
  JOIN public.beaches nearest ON nearest.id = s.nearest_beach_id
  WHERE extensions.ST_DWithin(t.geog, s.coordinates::extensions.geography, 25000)
    AND public.swell_windows_overlap(
      t.swell_window_min_deg, t.swell_window_max_deg,
      nearest.swell_window_min_deg, nearest.swell_window_max_deg
    ) >= 30
  UNION ALL
  SELECT 3, 'ndbc_direct', 'ndbc_direct', s.station_id,
    extensions.ST_Distance(t.geog, s.coordinates::extensions.geography) / 1000.0
  FROM target t
  JOIN public.ndbc_direct_stations s ON s.nearest_beach_id = t.id
  WHERE s.active = true AND s.has_wave_data = true
    AND extensions.ST_DWithin(t.geog, s.coordinates::extensions.geography, 25000)
    AND (s.ioos_station_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.ioos_stations duplicate
      WHERE duplicate.station_id = s.ioos_station_id AND duplicate.active = true
    ))
  UNION ALL
  SELECT 4, 'ndbc_spatial', 'ndbc_direct', s.station_id,
    extensions.ST_Distance(t.geog, s.coordinates::extensions.geography) / 1000.0
  FROM target t
  JOIN public.ndbc_direct_stations s ON s.active = true AND s.has_wave_data = true
  JOIN public.beaches nearest ON nearest.id = s.nearest_beach_id
  WHERE (s.ioos_station_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.ioos_stations duplicate
      WHERE duplicate.station_id = s.ioos_station_id AND duplicate.active = true
    ))
    AND extensions.ST_DWithin(t.geog, s.coordinates::extensions.geography, 25000)
    AND public.swell_windows_overlap(
      t.swell_window_min_deg, t.swell_window_max_deg,
      nearest.swell_window_min_deg, nearest.swell_window_max_deg
    ) >= 30
), chosen AS (
  SELECT * FROM station_candidates
  ORDER BY tier_order, distance_km, station_id
  LIMIT 1
), resolved AS (
  SELECT station_id, station_source, resolution_tier, distance_km FROM chosen
  UNION ALL
  SELECT NULL::text, NULL::text, NULL::text, NULL::double precision
  FROM target
  WHERE NOT EXISTS (SELECT 1 FROM chosen)
)
SELECT
  public.sha256_hex_v1(jsonb_build_object(
    'beach_id', p_beach_id, 'resolved_at', p_as_of,
    'station_id', r.station_id, 'station_source', r.station_source,
    'resolution_tier', r.resolution_tier,
    'distance_to_target_beach_km', round(r.distance_km::numeric, 6),
    'resolver_version', 'station-resolver.2026-07-17.v3'
  )::text),
  r.station_id,
  r.station_source,
  r.resolution_tier,
  round(r.distance_km::numeric, 6),
  p_as_of,
  'station-resolver.2026-07-17.v3'::text
FROM resolved r;
$$;

CREATE TABLE public.forecast_observation_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  input_snapshot jsonb NOT NULL CHECK (jsonb_typeof(input_snapshot) = 'object'),
  input_snapshot_canonical text NOT NULL,
  input_snapshot_hash text NOT NULL CHECK (input_snapshot_hash ~ '^[0-9a-f]{64}$'),
  target_kind text NOT NULL
    CHECK (target_kind IN ('ml_prediction', 'forecast_source_candidate')),
  ml_prediction_id uuid,
  forecast_source_candidate_id uuid,
  issuance_revision_id uuid,
  beach_id uuid NOT NULL REFERENCES public.beaches(id) ON DELETE RESTRICT,
  valid_time timestamptz NOT NULL,
  target_value_snapshot jsonb NOT NULL CHECK (jsonb_typeof(target_value_snapshot) = 'object'),
  target_value_snapshot_hash text NOT NULL
    CHECK (target_value_snapshot_hash ~ '^[0-9a-f]{64}$'),
  target_primary_value_m numeric(8,3),
  target_measurement_basis text NOT NULL
    CHECK (target_measurement_basis IN (
      'offshore_significant_height', 'legacy_prediction_multi_field'
    )),
  target_height_unit text NOT NULL CHECK (target_height_unit = 'meters'),
  match_status text NOT NULL
    CHECK (match_status IN ('matched', 'no_observation')),
  station_resolution_id text NOT NULL
    CHECK (station_resolution_id ~ '^[0-9a-f]{64}$'),
  station_id text,
  station_source text CHECK (station_source IN ('ioos', 'ndbc_direct')),
  station_resolution_tier text,
  station_distance_km numeric(10,6) CHECK (station_distance_km IS NULL OR station_distance_km >= 0),
  station_resolved_at timestamptz NOT NULL,
  observation_revision_id text,
  observation_payload_hash text
    CHECK (observation_payload_hash IS NULL OR observation_payload_hash ~ '^[0-9a-f]{64}$'),
  observation_source_record_id text,
  observation_source_payload_hash text
    CHECK (observation_source_payload_hash IS NULL OR observation_source_payload_hash ~ '^[0-9a-f]{64}$'),
  observation_quality_control_version text,
  observation_source text,
  observed_at timestamptz,
  observed_wave_height_m numeric(8,3),
  observed_wave_period_s numeric(8,2),
  observed_wave_direction_deg numeric(8,2),
  signed_delta_milliseconds bigint,
  abs_delta_milliseconds bigint,
  retrieval_tolerance_milliseconds bigint NOT NULL
    CHECK (retrieval_tolerance_milliseconds > 0),
  scoring_tolerance_milliseconds bigint NOT NULL
    CHECK (scoring_tolerance_milliseconds > 0),
  maturity_delay_seconds integer NOT NULL CHECK (maturity_delay_seconds > 0),
  retrieval_window_start timestamptz NOT NULL,
  retrieval_window_end timestamptz NOT NULL,
  observation_watermark_id uuid
    REFERENCES public.observation_station_ingestion_watermarks(watermark_id)
    ON DELETE RESTRICT,
  watermark_covered_from timestamptz,
  watermark_covered_through timestamptz,
  station_resolver_version text NOT NULL,
  matcher_version text NOT NULL,
  scoring_eligible boolean NOT NULL DEFAULT false,
  scoring_exclusion_reason text,
  supersedes_match_id uuid REFERENCES public.forecast_observation_matches(id),
  matched_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (forecast_source_candidate_id, issuance_revision_id)
    REFERENCES public.forecast_source_candidates(candidate_id, issuance_revision_id)
    ON DELETE RESTRICT,
  CHECK (num_nonnulls(ml_prediction_id, forecast_source_candidate_id) = 1),
  CHECK (
    (target_kind = 'ml_prediction'
      AND ml_prediction_id IS NOT NULL
      AND forecast_source_candidate_id IS NULL
      AND issuance_revision_id IS NULL
      AND target_primary_value_m IS NULL
      AND target_measurement_basis = 'legacy_prediction_multi_field')
    OR
    (target_kind = 'forecast_source_candidate'
      AND ml_prediction_id IS NULL
      AND forecast_source_candidate_id IS NOT NULL
      AND issuance_revision_id IS NOT NULL
      AND target_primary_value_m > 0
      AND target_measurement_basis = 'offshore_significant_height')
  ),
  CHECK (
    (match_status = 'matched'
      AND station_id IS NOT NULL
      AND observation_revision_id IS NOT NULL
      AND observation_payload_hash IS NOT NULL
      AND observation_source_record_id IS NOT NULL
      AND observation_source_payload_hash IS NOT NULL
      AND observation_quality_control_version IS NOT NULL
      AND observation_source IS NOT NULL
      AND observed_at IS NOT NULL
      AND observed_wave_height_m > 0
      AND signed_delta_milliseconds IS NOT NULL
      AND abs_delta_milliseconds = abs(signed_delta_milliseconds)
      AND abs_delta_milliseconds <= retrieval_tolerance_milliseconds)
    OR
    (match_status <> 'matched'
      AND observation_revision_id IS NULL
      AND observation_payload_hash IS NULL
      AND observation_source_record_id IS NULL
      AND observation_source_payload_hash IS NULL
      AND observation_quality_control_version IS NULL
      AND observation_source IS NULL
      AND observed_at IS NULL
      AND observed_wave_height_m IS NULL
      AND observed_wave_period_s IS NULL
      AND observed_wave_direction_deg IS NULL
      AND signed_delta_milliseconds IS NULL
      AND abs_delta_milliseconds IS NULL)
  ),
  CHECK (
    station_id IS NOT NULL
      AND station_source IS NOT NULL
      AND station_resolution_tier IS NOT NULL
  ),
  CHECK (retrieval_window_start = valid_time - interval '12 hours'),
  CHECK (retrieval_window_end = valid_time + interval '12 hours'),
  CHECK (
    observation_watermark_id IS NOT NULL
      AND watermark_covered_from <= retrieval_window_start
      AND watermark_covered_through >= retrieval_window_end
  ),
  CHECK (
    matched_at >= valid_time
      + maturity_delay_seconds * interval '1 second'
  ),
  CHECK (
    (scoring_eligible = true AND scoring_exclusion_reason IS NULL)
    OR
    (scoring_eligible = false AND scoring_exclusion_reason IS NOT NULL)
  ),
  CHECK (
    scoring_eligible = false
    OR (
      match_status = 'matched'
      AND abs_delta_milliseconds <= scoring_tolerance_milliseconds
      AND station_distance_km IS NOT NULL
      AND station_distance_km <= 25.0
      AND scoring_exclusion_reason IS NULL
    )
  ),
  CHECK (retrieval_tolerance_milliseconds = 43200000),
  CHECK (scoring_tolerance_milliseconds = 7200000),
  CHECK (maturity_delay_seconds = 86400),
  CHECK (matcher_version = 'nearest-time.v2'),
  CHECK (station_resolver_version = 'station-resolver.2026-07-17.v3')
);

CREATE TABLE public.forecast_observation_match_attempts (
  attempt_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_key text NOT NULL UNIQUE CHECK (attempt_key ~ '^[0-9a-f]{64}$'),
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  target_kind text NOT NULL
    CHECK (target_kind IN ('ml_prediction', 'forecast_source_candidate')),
  ml_prediction_id uuid,
  forecast_source_candidate_id uuid,
  issuance_revision_id uuid,
  beach_id uuid NOT NULL REFERENCES public.beaches(id) ON DELETE RESTRICT,
  valid_time timestamptz NOT NULL,
  input_snapshot_hash text
    CHECK (input_snapshot_hash IS NULL OR input_snapshot_hash ~ '^[0-9a-f]{64}$'),
  station_resolution_id text
    CHECK (station_resolution_id IS NULL OR station_resolution_id ~ '^[0-9a-f]{64}$'),
  station_source text CHECK (station_source IN ('ioos', 'ndbc_direct')),
  station_id text,
  required_window_start timestamptz NOT NULL,
  required_window_end timestamptz NOT NULL,
  attempt_outcome text NOT NULL
    CHECK (attempt_outcome IN ('pending_incomplete', 'no_station', 'repository_error')),
  bounded_error_code text CHECK (bounded_error_code ~ '^[a-z0-9_]{1,64}$'),
  run_started_at timestamptz NOT NULL,
  attempt_ordinal integer NOT NULL CHECK (attempt_ordinal > 0),
  fair_bucket smallint NOT NULL CHECK (fair_bucket BETWEEN 0 AND 63),
  retry_after timestamptz NOT NULL,
  matcher_version text NOT NULL CHECK (matcher_version = 'nearest-time.v2'),
  station_resolver_version text NOT NULL
    CHECK (station_resolver_version = 'station-resolver.2026-07-17.v3'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(ml_prediction_id, forecast_source_candidate_id) = 1),
  CHECK (required_window_start = valid_time - interval '12 hours'),
  CHECK (required_window_end = valid_time + interval '12 hours'),
  CHECK (retry_after > run_started_at),
  CHECK (
    (attempt_outcome = 'pending_incomplete'
      AND input_snapshot_hash IS NOT NULL
      AND station_resolution_id IS NOT NULL
      AND station_source IS NOT NULL
      AND station_id IS NOT NULL
      AND bounded_error_code IS NULL)
    OR
    (attempt_outcome = 'no_station'
      AND input_snapshot_hash IS NOT NULL
      AND station_resolution_id IS NOT NULL
      AND station_source IS NULL
      AND station_id IS NULL
      AND bounded_error_code IS NULL)
    OR
    (attempt_outcome = 'repository_error'
      AND bounded_error_code IS NOT NULL)
  )
);

CREATE TABLE public.forecast_observation_match_comparisons (
  comparison_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comparison_key text NOT NULL UNIQUE CHECK (comparison_key ~ '^[0-9a-f]{64}$'),
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  ml_prediction_id uuid NOT NULL,
  candidate_snapshot_hash text NOT NULL CHECK (candidate_snapshot_hash ~ '^[0-9a-f]{64}$'),
  v1_observation_revision_id text,
  v1_observation_payload_hash text,
  v1_observation_source_record_id text,
  v1_observation_source_payload_hash text,
  v1_observation_quality_control_version text,
  v1_observation_source text,
  v1_station_id text,
  v1_observed_at timestamptz,
  v1_observed_wave_height_m numeric(8,3),
  v1_observed_wave_period_s numeric(8,2),
  v1_observed_wave_direction_deg numeric(8,2),
  v1_signed_delta_milliseconds bigint,
  v1_match_status text NOT NULL CHECK (v1_match_status IN ('matched', 'no_observation')),
  v1_matcher_version text NOT NULL CHECK (v1_matcher_version = 'earliest-window.v1'),
  v2_match_id uuid NOT NULL REFERENCES public.forecast_observation_matches(id) ON DELETE RESTRICT,
  v2_matcher_version text NOT NULL CHECK (v2_matcher_version = 'nearest-time.v2'),
  same_observation_revision boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (v1_match_status = 'matched'
      AND v1_observation_revision_id IS NOT NULL
      AND v1_observation_payload_hash IS NOT NULL
      AND v1_observation_source_record_id IS NOT NULL
      AND v1_observation_source_payload_hash IS NOT NULL
      AND v1_observation_quality_control_version IS NOT NULL
      AND v1_observation_source IS NOT NULL
      AND v1_station_id IS NOT NULL
      AND v1_observed_at IS NOT NULL
      AND v1_observed_wave_height_m > 0
      AND v1_signed_delta_milliseconds IS NOT NULL)
    OR
    (v1_match_status <> 'matched'
      AND v1_observation_revision_id IS NULL
      AND v1_observation_payload_hash IS NULL
      AND v1_observation_source_record_id IS NULL
      AND v1_observation_source_payload_hash IS NULL
      AND v1_observation_quality_control_version IS NULL
      AND v1_observation_source IS NULL
      AND v1_station_id IS NULL
      AND v1_observed_at IS NULL
      AND v1_observed_wave_height_m IS NULL
      AND v1_observed_wave_period_s IS NULL
      AND v1_observed_wave_direction_deg IS NULL
      AND v1_signed_delta_milliseconds IS NULL)
  )
);

CREATE INDEX forecast_observation_matches_target_idx
  ON public.forecast_observation_matches (target_kind, ml_prediction_id, forecast_source_candidate_id);
CREATE INDEX forecast_observation_matches_valid_time_idx
  ON public.forecast_observation_matches (valid_time DESC);
CREATE INDEX forecast_observation_matches_scoring_idx
  ON public.forecast_observation_matches (scoring_eligible, valid_time DESC);
CREATE INDEX forecast_observation_matches_station_idx
  ON public.forecast_observation_matches (station_id, observed_at DESC);
CREATE INDEX observation_station_watermarks_latest_idx
  ON public.observation_station_ingestion_watermarks
  (source, station_id, covered_through DESC);
CREATE INDEX forecast_observation_match_comparisons_prediction_idx
  ON public.forecast_observation_match_comparisons (ml_prediction_id, created_at DESC);
CREATE INDEX forecast_observation_match_attempts_retry_idx
  ON public.forecast_observation_match_attempts
  (target_kind, fair_bucket, retry_after, valid_time);
CREATE UNIQUE INDEX forecast_observation_match_attempts_semantic_identity_idx
  ON public.forecast_observation_match_attempts (
    target_kind, ml_prediction_id, forecast_source_candidate_id,
    matcher_version, station_resolver_version, run_started_at
  ) NULLS NOT DISTINCT;
CREATE UNIQUE INDEX forecast_observation_matches_supersedes_once_idx
  ON public.forecast_observation_matches (supersedes_match_id)
  WHERE supersedes_match_id IS NOT NULL;
CREATE UNIQUE INDEX forecast_observation_matches_semantic_identity_idx
  ON public.forecast_observation_matches (
    target_kind, ml_prediction_id, forecast_source_candidate_id,
    issuance_revision_id, matcher_version, station_resolver_version
  ) NULLS NOT DISTINCT;
CREATE UNIQUE INDEX forecast_observation_comparisons_semantic_identity_idx
  ON public.forecast_observation_match_comparisons (
    ml_prediction_id, v1_matcher_version, v2_matcher_version
  );

CREATE VIEW public.current_forecast_observation_matches
WITH (security_invoker = true) AS
SELECT match.*
FROM public.forecast_observation_matches AS match
WHERE NOT EXISTS (
  SELECT 1
  FROM public.forecast_observation_matches AS replacement
  WHERE replacement.supersedes_match_id = match.id
);

CREATE VIEW public.current_forecast_observation_match_attempts
WITH (security_invoker = true) AS
SELECT DISTINCT ON (
  target_kind, ml_prediction_id, forecast_source_candidate_id,
  matcher_version, station_resolver_version
) attempt.*
FROM public.forecast_observation_match_attempts AS attempt
ORDER BY target_kind, ml_prediction_id, forecast_source_candidate_id,
         matcher_version, station_resolver_version,
         run_started_at DESC, attempt_id DESC;

CREATE OR REPLACE FUNCTION public.validate_forecast_observation_match_target()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_candidate record;
  v_prediction record;
  v_resolution record;
  v_observation record;
  v_expected_snapshot jsonb;
  v_expected_observation_id text;
  v_watermark public.observation_station_ingestion_watermarks%ROWTYPE;
BEGIN
  IF NEW.input_snapshot_canonical::jsonb <> NEW.input_snapshot
      OR public.sha256_hex_v1(NEW.input_snapshot_canonical) <> NEW.input_snapshot_hash THEN
    RAISE EXCEPTION 'match input snapshot hash mismatch';
  END IF;

  IF NEW.target_kind = 'forecast_source_candidate' THEN
    SELECT c.valid_at, c.wave_height_m, c.measurement_basis, c.height_unit,
           c.candidate_quality, r.beach_id, r.quality_status
      INTO v_candidate
      FROM public.forecast_source_candidates c
      JOIN public.forecast_source_issuance_revisions r
        ON r.issuance_revision_id = c.issuance_revision_id
     WHERE c.candidate_id = NEW.forecast_source_candidate_id
       AND c.issuance_revision_id = NEW.issuance_revision_id;
    IF NOT FOUND
        OR v_candidate.beach_id <> NEW.beach_id
        OR v_candidate.valid_at <> NEW.valid_time
        OR v_candidate.wave_height_m <> NEW.target_primary_value_m
        OR v_candidate.measurement_basis <> NEW.target_measurement_basis
        OR v_candidate.height_unit <> NEW.target_height_unit
        OR v_candidate.candidate_quality <> 'ok'
        OR v_candidate.quality_status <> 'ok' THEN
      RAISE EXCEPTION 'forecast source target lineage mismatch';
    END IF;
    v_expected_snapshot := jsonb_build_object(
      'candidate_id', NEW.forecast_source_candidate_id,
      'issuance_revision_id', NEW.issuance_revision_id,
      'wave_height_m', v_candidate.wave_height_m,
      'measurement_basis', v_candidate.measurement_basis,
      'height_unit', v_candidate.height_unit,
      'candidate_quality', v_candidate.candidate_quality
    );
  ELSE
    SELECT beach_id, predicted_at, raw_forecast_m, corrected_forecast_m,
           wave_height_om, om_passthrough_m, raw_display_height_m,
           offset_corrected_display_height_m, display_raw_input_height_m,
           display_wave_source, display_source, model_version
      INTO v_prediction
      FROM public.ml_predictions_log
     WHERE id = NEW.ml_prediction_id;
    IF NOT FOUND
        OR v_prediction.beach_id <> NEW.beach_id
        OR v_prediction.predicted_at <> NEW.valid_time THEN
      RAISE EXCEPTION 'ml prediction target lineage mismatch';
    END IF;
    v_expected_snapshot := jsonb_build_object(
      'ml_prediction_id', NEW.ml_prediction_id,
      'raw_forecast_m', v_prediction.raw_forecast_m,
      'corrected_forecast_m', v_prediction.corrected_forecast_m,
      'wave_height_om', v_prediction.wave_height_om,
      'om_passthrough_m', v_prediction.om_passthrough_m,
      'raw_display_height_m', v_prediction.raw_display_height_m,
      'offset_corrected_display_height_m', v_prediction.offset_corrected_display_height_m,
      'display_raw_input_height_m', v_prediction.display_raw_input_height_m,
      'display_wave_source', v_prediction.display_wave_source,
      'display_source', v_prediction.display_source,
      'model_version', v_prediction.model_version,
      'height_unit', 'meters'
    );
  END IF;

  IF NEW.target_value_snapshot <> v_expected_snapshot
      OR NEW.target_value_snapshot_hash <>
        public.sha256_hex_v1(v_expected_snapshot::text) THEN
    RAISE EXCEPTION 'forecast target value snapshot mismatch';
  END IF;

  SELECT * INTO v_resolution
    FROM public.resolve_beach_observation_station_v3(
      NEW.beach_id, NEW.station_resolved_at
    );
  IF NOT FOUND
      OR v_resolution.station_resolution_id <> NEW.station_resolution_id
      OR v_resolution.station_id IS DISTINCT FROM NEW.station_id
      OR v_resolution.station_source IS DISTINCT FROM NEW.station_source
      OR v_resolution.resolution_tier IS DISTINCT FROM NEW.station_resolution_tier
      OR v_resolution.distance_to_target_beach_km IS DISTINCT FROM NEW.station_distance_km
      OR v_resolution.resolver_version <> NEW.station_resolver_version THEN
    RAISE EXCEPTION 'station resolution snapshot mismatch';
  END IF;

  IF NEW.match_status = 'matched' THEN
    SELECT * INTO v_observation
      FROM public.observation_evidence_rows
     WHERE source = NEW.observation_source
       AND source_record_id = NEW.observation_source_record_id;
    IF NOT FOUND
        OR v_observation.source <> NEW.station_source
        OR v_observation.station_id <> NEW.station_id
        OR v_observation.source_payload_hash <> NEW.observation_source_payload_hash
        OR v_observation.observed_at <> NEW.observed_at
        OR v_observation.wave_height_m <> NEW.observed_wave_height_m
        OR v_observation.wave_period_s IS DISTINCT FROM NEW.observed_wave_period_s
        OR v_observation.wave_direction_deg IS DISTINCT FROM NEW.observed_wave_direction_deg
        OR NEW.observation_quality_control_version <> 'positive-height.v1' THEN
      RAISE EXCEPTION 'selected observation evidence mismatch';
    END IF;
    v_expected_observation_id := public.observation_revision_id_v1(
      v_observation.source, v_observation.source_record_id,
      v_observation.source_payload_hash, v_observation.station_id,
      v_observation.observed_at, v_observation.wave_height_m,
      v_observation.wave_period_s, v_observation.wave_direction_deg,
      NEW.observation_quality_control_version
    );
    IF NEW.observation_revision_id <> v_expected_observation_id
        OR NEW.observation_payload_hash <> substring(v_expected_observation_id FROM 8) THEN
      RAISE EXCEPTION 'observation revision identity mismatch';
    END IF;
    IF NOT (NEW.input_snapshot->'candidates') @> jsonb_build_array(
      jsonb_build_object(
        'observation_revision_id', NEW.observation_revision_id,
        'observation_payload_hash', NEW.observation_payload_hash,
        'source_record_id', NEW.observation_source_record_id,
        'source_payload_hash', NEW.observation_source_payload_hash,
        'quality_control_version', NEW.observation_quality_control_version,
        'source', NEW.observation_source,
        'station_id', NEW.station_id,
        'observed_at', NEW.observed_at,
        'wave_height_m', NEW.observed_wave_height_m,
        'wave_period_s', NEW.observed_wave_period_s,
        'wave_direction_deg', NEW.observed_wave_direction_deg,
        'distance_to_beach_km', NEW.station_distance_km
      )
    ) THEN
      RAISE EXCEPTION 'selected observation is absent from match input snapshot';
    END IF;
  END IF;

  IF NEW.match_status IN ('matched', 'no_observation') THEN
    SELECT * INTO v_watermark
      FROM public.observation_station_ingestion_watermarks
     WHERE watermark_id = NEW.observation_watermark_id;
    IF NOT FOUND
        OR v_watermark.source <> NEW.station_source
        OR v_watermark.station_id <> NEW.station_id
        OR v_watermark.request_window_start <> v_watermark.covered_from
        OR v_watermark.request_window_end <> v_watermark.covered_through
        OR v_watermark.covered_from <> NEW.watermark_covered_from
        OR v_watermark.covered_through <> NEW.watermark_covered_through
        OR v_watermark.coverage_gap_count <> 0
        OR v_watermark.poll_completed_at > NEW.matched_at
        OR v_watermark.covered_from > NEW.retrieval_window_start
        OR v_watermark.covered_through < NEW.retrieval_window_end THEN
      RAISE EXCEPTION 'observation completeness watermark mismatch';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER forecast_observation_matches_validate_target
BEFORE INSERT ON public.forecast_observation_matches
FOR EACH ROW EXECUTE FUNCTION public.validate_forecast_observation_match_target();

CREATE OR REPLACE FUNCTION public.validate_forecast_observation_match_comparison()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_match public.forecast_observation_matches%ROWTYPE;
BEGIN
  SELECT * INTO v_match
    FROM public.forecast_observation_matches
   WHERE id = NEW.v2_match_id;
  IF NOT FOUND
      OR v_match.target_kind <> 'ml_prediction'
      OR v_match.ml_prediction_id <> NEW.ml_prediction_id
      OR v_match.matcher_version <> NEW.v2_matcher_version
      OR v_match.input_snapshot_hash <> NEW.candidate_snapshot_hash THEN
    RAISE EXCEPTION 'V1/V2 comparison target mismatch';
  END IF;
  IF NEW.same_observation_revision <>
      (NEW.v1_observation_revision_id IS NOT NULL
       AND NEW.v1_observation_revision_id = v_match.observation_revision_id) THEN
    RAISE EXCEPTION 'V1/V2 comparison agreement mismatch';
  END IF;
  IF NEW.v1_match_status = 'matched'
      AND NEW.v1_observation_revision_id <>
        public.observation_revision_id_v1(
          NEW.v1_observation_source,
          NEW.v1_observation_source_record_id,
          NEW.v1_observation_source_payload_hash,
          NEW.v1_station_id,
          NEW.v1_observed_at,
          NEW.v1_observed_wave_height_m,
          NEW.v1_observed_wave_period_s,
          NEW.v1_observed_wave_direction_deg,
          NEW.v1_observation_quality_control_version
        ) THEN
    RAISE EXCEPTION 'V1 observation revision identity mismatch';
  END IF;
  IF NEW.v1_match_status = 'matched'
      AND (
        NEW.v1_observation_payload_hash <>
          substring(NEW.v1_observation_revision_id FROM 8)
        OR NOT (v_match.input_snapshot->'candidates') @> jsonb_build_array(
          jsonb_build_object(
            'observation_revision_id', NEW.v1_observation_revision_id,
            'observation_payload_hash', NEW.v1_observation_payload_hash,
            'source_record_id', NEW.v1_observation_source_record_id,
            'source_payload_hash', NEW.v1_observation_source_payload_hash,
            'quality_control_version', NEW.v1_observation_quality_control_version,
            'source', NEW.v1_observation_source,
            'station_id', NEW.v1_station_id,
            'observed_at', NEW.v1_observed_at,
            'wave_height_m', NEW.v1_observed_wave_height_m,
            'wave_period_s', NEW.v1_observed_wave_period_s,
            'wave_direction_deg', NEW.v1_observed_wave_direction_deg,
            'distance_to_beach_km', v_match.station_distance_km
          )
        )
      ) THEN
    RAISE EXCEPTION 'V1 selection is absent from match input snapshot';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER forecast_observation_match_comparisons_validate
BEFORE INSERT ON public.forecast_observation_match_comparisons
FOR EACH ROW EXECUTE FUNCTION public.validate_forecast_observation_match_comparison();

CREATE OR REPLACE FUNCTION public.reject_forecast_observation_match_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'forecast_observation_matches is append-only';
END;
$$;

CREATE TRIGGER forecast_observation_matches_append_only
BEFORE UPDATE OR DELETE ON public.forecast_observation_matches
FOR EACH ROW EXECUTE FUNCTION public.reject_forecast_observation_match_mutation();
CREATE TRIGGER observation_station_watermarks_append_only
BEFORE UPDATE OR DELETE ON public.observation_station_ingestion_watermarks
FOR EACH ROW EXECUTE FUNCTION public.reject_forecast_observation_match_mutation();
CREATE TRIGGER forecast_observation_match_comparisons_append_only
BEFORE UPDATE OR DELETE ON public.forecast_observation_match_comparisons
FOR EACH ROW EXECUTE FUNCTION public.reject_forecast_observation_match_mutation();
CREATE TRIGGER forecast_observation_match_attempts_append_only
BEFORE UPDATE OR DELETE ON public.forecast_observation_match_attempts
FOR EACH ROW EXECUTE FUNCTION public.reject_forecast_observation_match_mutation();

ALTER TABLE public.forecast_observation_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.observation_station_ingestion_watermarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_observation_match_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_observation_match_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.forecast_observation_matches FROM anon, authenticated;
REVOKE ALL ON public.observation_station_ingestion_watermarks FROM anon, authenticated;
REVOKE ALL ON public.forecast_observation_match_comparisons FROM anon, authenticated;
REVOKE ALL ON public.forecast_observation_match_attempts FROM anon, authenticated;
REVOKE ALL ON public.observation_evidence_rows FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.current_forecast_observation_matches FROM anon, authenticated;
REVOKE ALL ON public.current_forecast_observation_match_attempts FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.forecast_observation_matches FROM service_role;
REVOKE INSERT, UPDATE, DELETE ON public.observation_station_ingestion_watermarks FROM service_role;
REVOKE INSERT, UPDATE, DELETE ON public.forecast_observation_match_comparisons FROM service_role;
REVOKE INSERT, UPDATE, DELETE ON public.forecast_observation_match_attempts FROM service_role;
GRANT SELECT ON public.forecast_observation_matches TO service_role;
GRANT SELECT ON public.observation_station_ingestion_watermarks TO service_role;
GRANT SELECT ON public.forecast_observation_match_comparisons TO service_role;
GRANT SELECT ON public.forecast_observation_match_attempts TO service_role;
GRANT SELECT ON public.observation_evidence_rows TO service_role;
GRANT SELECT ON public.current_forecast_observation_matches TO service_role;
GRANT SELECT ON public.current_forecast_observation_match_attempts TO service_role;
REVOKE ALL ON FUNCTION public.resolve_beach_observation_station_v3(uuid, timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sha256_hex_v1(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.observation_revision_id_v1(
  text, text, text, text, timestamptz, numeric, numeric, numeric, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sha256_hex_v1(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.observation_revision_id_v1(
  text, text, text, text, timestamptz, numeric, numeric, numeric, text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_beach_observation_station_v3(uuid, timestamptz)
  TO service_role;

CREATE POLICY forecast_observation_matches_service_select
ON public.forecast_observation_matches FOR SELECT TO service_role USING (true);
CREATE POLICY observation_station_watermarks_service_select
ON public.observation_station_ingestion_watermarks FOR SELECT TO service_role USING (true);
CREATE POLICY forecast_observation_match_comparisons_service_select
ON public.forecast_observation_match_comparisons FOR SELECT TO service_role USING (true);
CREATE POLICY forecast_observation_match_attempts_service_select
ON public.forecast_observation_match_attempts FOR SELECT TO service_role USING (true);

COMMENT ON TABLE public.forecast_observation_matches IS
  'Immutable nearest-time observation lineage. Phase 0D evidence only; not a forecast-serving input.';
COMMENT ON COLUMN public.forecast_observation_matches.scoring_eligible IS
  'True only for matured nearest-time matches within the frozen time and station-distance policy.';
COMMENT ON TABLE public.observation_station_ingestion_watermarks IS
  'Immutable, gap-free historical request coverage. A point-in-time poll is not completeness evidence.';
COMMENT ON TABLE public.forecast_observation_match_comparisons IS
  'Immutable same-snapshot V1/V2 matcher comparison artifacts; never a serving input.';
COMMENT ON TABLE public.forecast_observation_match_attempts IS
  'Immutable unresolved operational attempts and retry eligibility; never observation truth or a serving input.';

COMMIT;
```

In the same migration, implement four write RPCs plus one read selector as
`SECURITY DEFINER SET search_path = public, pg_temp`, executable only by
`service_role`; explicitly revoke each from `PUBLIC`, `anon`, and
`authenticated`. Grant no direct mutation as a substitute for these RPCs.

`record_observation_station_ingestion_coverage_v1(p_coverage jsonb)` is the
only coverage-table writer. It rejects unknown/missing keys, requires source
version `ioos-sync.history.v1` or `ndbc-direct-sync.history.v1`, requires a
36-hour historical request ending at `poll_started_at`, requires
`completed_page_count >= 1`, `coverage_gap_count = 0`, a lowercase response
hash, and `poll_completed_at >= poll_started_at`. It derives `covered_from` and
`covered_through` from the validated request bounds. Exact retries return the
existing ID; any differing immutable field under the same source/station/start
identity raises `observation coverage idempotency collision`.

`record_forecast_observation_match_attempt_v1(p_attempt jsonb)` is the only
attempt-ledger writer. It rejects unknown/missing keys and validates the target
identity against the source row. Under an advisory lock on target, matcher, and
resolver, it derives `attempt_ordinal` from prior immutable attempts,
`fair_bucket` from the first byte of
`sha256(target_kind || chr(31) || target_id) mod 64`, and `retry_after` from
the frozen hour array `ARRAY[1,2,4,8,24,72,168]`, capped at the final value. It
derives the required window as `valid_time ± 12 hours`, recomputes
`attempt_key` from target, versions, and `run_started_at`, and computes the
payload hash. `pending_incomplete` requires a validated station-resolution and
snapshot hash with no complete coverage row; `no_station` requires the frozen
empty station-resolution snapshot and remains retryable rather than becoming a
terminal match; `repository_error` may omit the
snapshot/resolution because it also covers resolver or snapshot-load failure,
but accepts only a bounded allowlisted error code and no raw exception text.
An exact retry returns the existing receipt; different payload under the same
key raises `observation match attempt idempotency collision`.

`list_forecast_observation_match_due_targets_v1(p_target_kind text,
p_run_started_at timestamptz, p_limit integer default 20000)` is the sole
server-side work selector. It validates `p_limit BETWEEN 1 AND 20000`, excludes
completed matches (or completed ML comparisons while retaining the exact
match-without-comparison repair case), joins the latest attempt, and selects
only unseen targets or retries with `retry_after <= p_run_started_at`. The
active set is the 32 stable buckets whose parity matches the UTC run hour, so
two consecutive hourly runs form a complete sweep. It round-robins within
buckets and reserves 15,000 slots for unseen targets plus 5,000 for due
retries, then lends unused capacity across lanes. A failed 19,950-target cycle
therefore cannot monopolize later work, while due gaps remain visible and are
retried at least weekly rather than converted into observation truth.
For an ML repair row, the selector also returns `repair_match_id` plus that
match's persisted `input_snapshot_canonical` and hash. Repair rehydrates those
exact bytes; it never resolves a station or fetches observations under a later
anchor.

`record_forecast_observation_match_v1(p_match jsonb)` is the only standalone
match writer. It rejects unknown/missing keys, overwrites caller policy values
with exactly `nearest-time.v2`, `station-resolver.2026-07-17.v3`, 43,200,000 ms,
7,200,000 ms, and 86,400 seconds, computes target/payload hashes server-side,
and hashes the supplied UTF-8 `input_snapshot_canonical` bytes only after
proving `input_snapshot_canonical::jsonb = input_snapshot`. It never hashes
PostgreSQL's differently formatted `jsonb::text` as a substitute for the
cross-language canonical bytes. It then lets all source, station, observation, and coverage
validation run. Exact retries return the existing ID; a different payload for
the same idempotency key raises `observation match idempotency collision`.

The RPC ignores any caller key and recomputes `idempotency_key` as SHA-256 of
the UTF-8 unit-separator join of target kind, target ID, nullable issuance
revision (`"null"`), matcher version, and resolver version. The semantic unique
index enforces the same tuple independently of the hash. The input snapshot has
an exact allowlisted shape—target, station resolution, complete coverage or
null, snapshot timestamp, and a full-key-set candidate array. The RPC proves
the target/resolution/coverage objects equal the row fields, proves every
candidate still matches `observation_evidence_rows`, proves every selected
revision is a member, and recomputes the nearest selection over that
array using `(absolute millisecond delta, earlier-side rank, station_id,
observation_revision_id)`. `matched`, `no_observation`, and eligibility fields
must equal that recomputation.

`record_forecast_observation_comparison(p_match jsonb, p_comparison jsonb)`
uses those same validation helpers in one transaction. It must:

1. lock on the match idempotency key and comparison key;
2. recompute one input-snapshot hash from the persisted JSON and bind it to both artifacts;
3. insert the V2 match or select an exact existing match with the same server-computed payload hash;
4. inject that match ID into the comparison and retain the full V1 selected-observation lineage/value;
5. insert the comparison in the same transaction;
6. on retry, return exact existing match/comparison IDs;
7. when an exact match exists but its comparison is absent (for example after an earlier standalone evidence run), attach the new validated comparison instead of treating that repairable state as a collision; and
8. raise `observation comparison idempotency collision` for a conflicting match, conflicting comparison, or comparison-without-match state.

The comparison RPC recomputes `comparison_key` as SHA-256 of the
unit-separator join of `ml_prediction_id`, `earliest-window.v1`, and
`nearest-time.v2`; its semantic unique index prevents alternate-key duplicates.
It recomputes V1 as the earliest valid observation in the same snapshot and V2
as the nearest ordering above, then compares every persisted lineage/value
field. A self-consistent off-snapshot row is rejected. Phase 0 requires
`supersedes_match_id` to be null because the schema admits only the frozen
matcher and resolver versions. The column and branch-prevention index reserve a
future linear history, but a later reviewed migration must first expand the
version constraints and RPC validation before any superseding row is accepted.

No RPC accepts caller-derived coverage counters, arbitrary policy versions, or
an arbitrary `v2_match_id`. The static test must assert strict allowlists,
server-derived hashes/policy, exact-existing-match attachment, service-only
grants, and collision text.

`ml_prediction_id` is intentionally an immutable UUID reference without a
foreign key: legacy prediction-log retention must not cascade-delete match
lineage or become blocked by the append-only trigger. P0-C source candidates
use the composite foreign key. The insert trigger additionally proves the
candidate's beach, valid time, positive value, units, candidate quality, and
revision quality. For a legacy row it compares the complete named snapshot to
the actual `raw_forecast_m`, `corrected_forecast_m`, `wave_height_om`,
`om_passthrough_m`, `raw_display_height_m`,
`offset_corrected_display_height_m`, display provenance, and model version;
there is no nonexistent `forecast_m` alias and no forced offshore basis. Once
inserted, lineage remains replayable even if legacy retention removes the
source row.

- [ ] **Step 4: Run the migration contract test**

Run:

```bash
yarn jest __tests__/migrations/forecast-observation-matches.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Add local PostgreSQL behavior coverage**

Create `scripts/db/forecast-observation-matches-smoke.sql` as a transaction
that rolls back and uses `pg_temp.expect_error(...)`. Against seeded beaches,
stations, observations, one legacy prediction, and one P0-C candidate, prove:

1. all direct service-role inserts/updates/deletes, including attempt-ledger mutation, are denied;
2. every automatic resolver tier rejects stations beyond 25 km, while only an explicitly configured CDIP may resolve beyond 25 km and remains scoring-ineligible;
3. a point watermark, a gapped interval, a range missing either edge, arbitrary policy constants, a forged station-resolution ID, a forged target snapshot/hash, and a forged observation revision/hash are rejected;
4. both matched and `no_observation` records require one gap-free coverage row enclosing the full ±12-hour window;
5. exact attempt, standalone-match, and comparison retries are idempotent; attempt ordinal, bucket, and retry time are server-derived; an exact standalone match can later receive its comparison; and conflicting/partial artifacts fail atomically;
6. incomplete coverage creates no match or comparison, the due-target selector excludes it until `retry_after`, and a newer unseen target remains selectable in the same two-hour fair sweep;
7. V1 full observation lineage and V2 lineage replay to the same frozen input snapshot; and
8. `observation_revision_id_v1` matches a fixed Python parity vector including null period/direction.

- [ ] **Step 6: Add historical-window coverage producers and tests**

Introduce `ObservationFetchOutcome` in the IOOS service and the equivalent
NDBC route helper with three disjoint outcomes:

```ts
type ObservationFetchOutcome<T> =
  | { status: "success_with_data"; data: T; pollStartedAt: string; pollCompletedAt: string; requestWindowStart: string; requestWindowEnd: string; completedPageCount: number; coverageGapCount: 0; requestFingerprint: string; sourceResponseHash: string }
  | { status: "success_empty"; data: null; pollStartedAt: string; pollCompletedAt: string; requestWindowStart: string; requestWindowEnd: string; completedPageCount: number; coverageGapCount: 0; requestFingerprint: string; sourceResponseHash: string }
  | { status: "failure"; data: null; errorCode: string };
```

For every station, request the complete interval from exactly 36 hours before
`pollStartedAt` through `pollStartedAt`, follow every upstream page, and fail
the whole station coverage attempt if a page, interval, or parse is missing.
HTTP success over the full interval with no usable row is `success_empty`;
timeout, HTTP error, pagination discontinuity, partial station response, parse
error, or observation upsert error is `failure`. Hash the canonical URL,
station, and requested bounds for `requestFingerprint`; hash ordered raw page
bytes for `sourceResponseHash`. Only after all pages and observation rows are
durable, call `record_observation_station_ingestion_coverage_v1`. Never infer
historical coverage from a current/latest endpoint.

Tests must prove full-window success-with-data/empty records coverage,
transport/parse/pagination/upsert failure records none, exact retry is
idempotent, the two stored bounds equal the actual upstream request, and client
response bodies remain unchanged.

Run:

```bash
yarn jest __tests__/app/api/cron/ioos-sync-observations.test.ts __tests__/app/api/cron/ioos-sync-deactivation.test.ts __tests__/app/api/cron/ndbc-direct-sync.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Stop for migration approval, then run it locally and regenerate types if approved**

Present the exact schema diff, dependency on P0-C, RLS/grants, expected row
volume, and rollback behavior. Do not run a database command until the user
approves applying this migration to the disposable local stack.

Run:

```bash
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f scripts/db/forecast-observation-matches-smoke.sql
yarn db:types
```

Expected: all three commands exit 0; generated types contain match, comparison,
attempt, current-match, and current-attempt contracts.

- [ ] **Step 8: Review the migration before any remote action**

Run:

```bash
git diff -- supabase/migrations/20260717173000_create_forecast_observation_matches.sql types/database.generated.ts __tests__/migrations/forecast-observation-matches.test.ts
```

Expected: only the append-only P0-D schema, generated type additions, and migration tests appear. Stop here for explicit approval before any production migration command.

- [ ] **Step 9: Commit the local Quiver unit only if commits were explicitly authorized**

```bash
git add supabase/migrations/20260717173000_create_forecast_observation_matches.sql types/database.generated.ts __tests__/migrations/forecast-observation-matches.test.ts scripts/db/forecast-observation-matches-smoke.sql lib/services/ioos/ioos-service.ts app/api/cron/ioos-sync/route.ts app/api/cron/ndbc-direct-sync/route.ts __tests__/app/api/cron/ioos-sync-observations.test.ts __tests__/app/api/cron/ioos-sync-deactivation.test.ts __tests__/app/api/cron/ndbc-direct-sync.test.ts
git commit -m "feat(forecast): add immutable observation match lineage"
```

### Task 3: Add Strict Flags and an Idempotent Match Repository

**Files:**
- Modify: `/Users/stevenchandler/Desktop/dev/seaside/config.py`
- Create: `/Users/stevenchandler/Desktop/dev/seaside/crons/observation_match_repository.py`
- Create: `/Users/stevenchandler/Desktop/dev/seaside/tests/test_observation_match_repository.py`

**Interfaces:**
- Consumes: `ObservationCandidate`, `ObservationMatch`, `resolve_beach_observation_station_v3`, `observation_evidence_rows`, contiguous station coverage, and Supabase service-role access.
- Produces: `ObservationMatcherMode`, `StationResolution`, `ForecastMatchTarget`, `MatchInputSnapshot`, `MatchAttemptReceipt`, `PersistedMatchResult`, `resolve_station()`, `fetch_observation_candidates()`, `fetch_completeness_coverage()`, `load_match_input_snapshot()`, `record_match_attempt()`, `persist_match_revision()`, and `match_target()`.

- [ ] **Step 1: Write failing configuration and repository tests**

```python
import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import pytest

from crons.observation_match_repository import (
    ForecastMatchTarget,
    compute_match_idempotency_key,
    compute_match_payload_hash,
    fetch_observation_candidates,
    is_target_mature,
    match_target,
    persist_match_revision,
    record_match_attempt,
    resolve_station,
)


def _run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


class RecordingBuilder:
    def __init__(self, rows):
        self.rows = rows
        self.method_names: list[str] = []
        self.not_ = self

    def __getattr__(self, name):
        if name in {"select", "eq", "gte", "lte", "is_", "order", "limit"}:
            def record(*args, **kwargs):
                self.method_names.append(name)
                return self
            return record
        raise AttributeError(name)

    def execute(self):
        return MagicMock(data=self.rows, error=None)


def test_target_requires_full_24_hour_maturity() -> None:
    valid_time = datetime(2026, 7, 17, 12, tzinfo=timezone.utc)
    assert is_target_mature(valid_time, valid_time + timedelta(hours=24)) is True
    assert is_target_mature(valid_time, valid_time + timedelta(hours=23, minutes=59)) is False


def test_idempotency_key_changes_with_exact_issuance_revision() -> None:
    target_a = ForecastMatchTarget(
        target_kind="forecast_source_candidate",
        target_id="10000000-0000-0000-0000-000000000001",
        beach_id="20000000-0000-0000-0000-000000000001",
        valid_time=datetime(2026, 7, 17, 12, tzinfo=timezone.utc),
        target_value_snapshot=_source_value_snapshot(
            candidate_id="10000000-0000-0000-0000-000000000001",
            issuance_revision_id="30000000-0000-0000-0000-000000000001",
            wave_height_m=1.6,
        ),
        target_primary_value_m=1.6,
        target_measurement_basis="offshore_significant_height",
        target_height_unit="meters",
        issuance_revision_id="30000000-0000-0000-0000-000000000001",
    )
    target_b = ForecastMatchTarget(
        **{**target_a.__dict__, "issuance_revision_id": "30000000-0000-0000-0000-000000000002"}
    )
    assert compute_match_idempotency_key(
        target_a,
        matcher_version="nearest-time.v2",
        station_resolver_version="station-resolver.2026-07-17.v3",
    ) != compute_match_idempotency_key(
        target_b,
        matcher_version="nearest-time.v2",
        station_resolver_version="station-resolver.2026-07-17.v3",
    )


def test_payload_is_not_part_of_the_stable_idempotency_key() -> None:
    target = ForecastMatchTarget(
        target_kind="ml_prediction",
        target_id="10000000-0000-0000-0000-000000000001",
        beach_id="20000000-0000-0000-0000-000000000001",
        valid_time=datetime(2026, 7, 17, 12, tzinfo=timezone.utc),
        target_value_snapshot=_legacy_value_snapshot(
            raw_forecast_m=1.6,
            corrected_forecast_m=None,
        ),
        target_primary_value_m=None,
        target_measurement_basis="legacy_prediction_multi_field",
        target_height_unit="meters",
        issuance_revision_id=None,
    )
    key = compute_match_idempotency_key(
        target,
        matcher_version="nearest-time.v2",
        station_resolver_version="station-resolver.2026-07-17.v3",
    )
    assert key == compute_match_idempotency_key(
        target,
        matcher_version="nearest-time.v2",
        station_resolver_version="station-resolver.2026-07-17.v3",
    )
    assert (
        compute_match_payload_hash({"match_status": "no_observation"})
        != compute_match_payload_hash({"match_status": "matched"})
    )


def test_invalid_matcher_mode_is_rejected(monkeypatch) -> None:
    from config import _enum_env
    monkeypatch.setenv("OBSERVATION_MATCHER_V2_MODE", "earliest")
    with pytest.raises(ValueError, match="OBSERVATION_MATCHER_V2_MODE"):
        _enum_env(
            "OBSERVATION_MATCHER_V2_MODE",
            default="off",
            allowed={"off", "compare"},
        )


def test_invalid_evaluation_flag_is_rejected(monkeypatch) -> None:
    from config import _bool_env
    monkeypatch.setenv("SOURCE_POLICY_EVALUATION_ENABLED", "yes")
    with pytest.raises(ValueError, match="SOURCE_POLICY_EVALUATION_ENABLED"):
        _bool_env("SOURCE_POLICY_EVALUATION_ENABLED", default=False)


def test_empty_station_rpc_is_a_clean_no_station() -> None:
    rpc_result = MagicMock(data=[{
        "station_resolution_id": "a" * 64,
        "station_id": None,
        "station_source": None,
        "resolution_tier": None,
        "distance_to_target_beach_km": None,
        "resolved_at": "2026-07-18T12:00:00Z",
        "resolver_version": "station-resolver.2026-07-17.v3",
    }], error=None)
    rpc_builder = MagicMock()
    rpc_builder.execute.return_value = rpc_result
    supabase = MagicMock()
    supabase.rpc.return_value = rpc_builder
    cache = {}

    result = _run(resolve_station(
        supabase,
        beach_id="beach-a",
        station_cache=cache,
        as_of=datetime(2026, 7, 18, 12, tzinfo=timezone.utc),
    ))

    assert result.station_id is None
    assert result.resolution_id == "a" * 64
    assert cache["beach-a"].station_id is None


def test_no_station_is_retryable_attempt_not_terminal_match() -> None:
    target = _source_target(valid_time=datetime(2026, 7, 17, 12, tzinfo=timezone.utc))
    snapshot = _input_snapshot(
        target=target,
        station_resolution=_no_station_resolution(),
        candidates=[],
        coverage=None,
    )
    result = _run(match_target(
        fake_supabase,
        target=target,
        snapshot=snapshot,
        now=_mature_time(target),
    ))
    assert result.status == "no_station"
    assert result.match_id is None
    assert fake_supabase.match_rpc_calls == []
    assert fake_supabase.attempt_rpc_calls[0]["attempt_outcome"] == "no_station"


def test_observation_fetch_never_limits_to_the_earliest_row() -> None:
    rows = [
        {"source": "ioos", "source_record_id": "ioos:1", "source_payload_hash": "a" * 64, "station_id": "station-a", "observed_at": "2026-07-17T01:00:00Z", "wave_height_m": 1.0, "wave_period_s": 14.0, "wave_direction_deg": 275.0},
        {"source": "ioos", "source_record_id": "ioos:2", "source_payload_hash": "b" * 64, "station_id": "station-a", "observed_at": "2026-07-17T11:45:00Z", "wave_height_m": 1.4, "wave_period_s": 15.0, "wave_direction_deg": 280.0},
    ]
    builder = RecordingBuilder(rows)
    supabase = MagicMock()
    supabase.from_.return_value = builder

    result = _run(fetch_observation_candidates(
        supabase,
        station_source="ioos",
        station_id="station-a",
        distance_to_target_beach_km=8.0,
        valid_time=datetime(2026, 7, 17, 12, tzinfo=timezone.utc),
    ))

    assert len(result) == 2
    assert "limit" not in builder.method_names


def test_no_observation_waits_for_a_complete_retrieval_window(monkeypatch) -> None:
    target = _source_target(valid_time=datetime(2026, 7, 17, 12, tzinfo=timezone.utc))
    snapshot = _input_snapshot(
        target=target,
        candidates=[],
        coverage=_coverage(
            covered_from="2026-07-17T00:00:00Z",
            covered_through="2026-07-17T23:59:59.999Z",
        ),
    )
    result = _run(match_target(fake_supabase, target=target, snapshot=snapshot, now=_mature_time(target)))
    assert result.status == "pending_incomplete"
    assert fake_supabase.match_rpc_calls == []
    assert fake_supabase.attempt_rpc_calls[0]["input_snapshot_hash"] == snapshot.snapshot_hash
    assert result.attempt_receipt.retry_after > _mature_time(target)


def test_no_observation_requires_coverage_of_both_window_edges() -> None:
    target = _source_target(valid_time=datetime(2026, 7, 17, 12, tzinfo=timezone.utc))
    snapshot = _input_snapshot(
        target=target,
        candidates=[],
        coverage=_coverage(
            covered_from="2026-07-17T00:00:00Z",
            covered_through="2026-07-18T00:00:00Z",
        ),
    )
    result = _run(match_target(fake_supabase, target=target, snapshot=snapshot, now=_mature_time(target)))
    assert result.status == "no_observation"
    assert fake_supabase.match_rpc_calls[0]["observation_watermark_id"]


def test_match_also_waits_for_full_window_coverage() -> None:
    target = _source_target(valid_time=datetime(2026, 7, 17, 12, tzinfo=timezone.utc))
    snapshot = _input_snapshot(
        target=target,
        candidates=[_candidate("ioos:1", "2026-07-17T11:45:00Z")],
        coverage=_coverage(
            covered_from="2026-07-17T00:00:00.001Z",
            covered_through="2026-07-18T00:00:00Z",
        ),
    )
    result = _run(match_target(fake_supabase, target=target, snapshot=snapshot, now=_mature_time(target)))
    assert result.status == "pending_incomplete"
    assert fake_supabase.match_rpc_calls == []
    assert len(fake_supabase.attempt_rpc_calls) == 1


def test_pre_snapshot_repository_error_is_persisted_without_raw_exception() -> None:
    target = _source_target(valid_time=datetime(2026, 7, 17, 12, tzinfo=timezone.utc))
    receipt = _run(record_match_attempt(
        fake_supabase,
        target=target,
        snapshot=None,
        outcome="repository_error",
        error_code="snapshot_load_failed",
        run_started_at=_mature_time(target),
    ))
    assert receipt.attempt_ordinal == 1
    assert fake_supabase.attempt_rpc_calls[0]["input_snapshot_hash"] is None
    assert "exception" not in fake_supabase.attempt_rpc_calls[0]
```

For `persist_match_revision()`, assert it calls only
`record_forecast_observation_match_v1`, accepts the exact returned ID, and
never directly inserts, updates, or deletes a lineage table. Program an RPC
collision and assert `RuntimeError("observation match idempotency collision")`.

- [ ] **Step 2: Run the focused tests and verify the expected failures**

Run:

```bash
python -m pytest tests/test_observation_match_repository.py -v --tb=short
```

Expected: FAIL because `crons.observation_match_repository` does not exist.

- [ ] **Step 3: Add strict config parsing**

Add this parser and exported values to `config.py`:

```python
def _enum_env(name: str, *, default: str, allowed: set[str]) -> str:
    value = os.getenv(name, default).strip().lower()
    if value not in allowed:
        allowed_values = ", ".join(sorted(allowed))
        raise ValueError(f"{name} must be one of: {allowed_values}")
    return value


def _bool_env(name: str, *, default: bool) -> bool:
    default_value = "true" if default else "false"
    value = os.getenv(name, default_value).strip().lower()
    if value not in {"true", "false"}:
        raise ValueError(f"{name} must be true or false")
    return value == "true"


OBSERVATION_MATCHER_V2_MODE = _enum_env(
    "OBSERVATION_MATCHER_V2_MODE",
    default="off",
    allowed={"off", "compare"},
)
SOURCE_POLICY_EVALUATION_ENABLED = _bool_env(
    "SOURCE_POLICY_EVALUATION_ENABLED",
    default=False,
)
```

- [ ] **Step 4: Implement the repository around the pure matcher**

Use these exact data contracts:

```python
ObservationMatcherMode = Literal["off", "compare"]


@dataclass(frozen=True)
class StationResolution:
    resolution_id: str
    station_id: str | None
    station_source: Literal["ioos", "ndbc_direct"] | None
    resolver_tier: str | None
    distance_to_beach_km: float | None
    resolved_at: datetime
    resolver_version: str = "station-resolver.2026-07-17.v3"


@dataclass(frozen=True)
class ForecastMatchTarget:
    target_kind: Literal["ml_prediction", "forecast_source_candidate"]
    target_id: str
    beach_id: str
    valid_time: datetime
    target_value_snapshot: Mapping[str, object]
    target_primary_value_m: float | None
    target_measurement_basis: Literal[
        "offshore_significant_height", "legacy_prediction_multi_field"
    ]
    target_height_unit: Literal["meters"]
    issuance_revision_id: str | None


@dataclass(frozen=True)
class StationIngestionCoverage:
    watermark_id: str
    source: Literal["ioos", "ndbc_direct"]
    station_id: str
    covered_from: datetime
    covered_through: datetime
    poll_completed_at: datetime
    coverage_gap_count: Literal[0]


@dataclass(frozen=True)
class MatchInputSnapshot:
    target: ForecastMatchTarget
    station_resolution: StationResolution
    candidates: tuple[ObservationCandidate, ...]
    coverage: StationIngestionCoverage | None
    snapshot_at: datetime
    canonical_json: str
    snapshot_hash: str


@dataclass(frozen=True)
class MatchEvaluation:
    status: Literal[
        "matched", "no_station", "no_observation", "pending_incomplete", "not_mature"
    ]
    observation_match: ObservationMatch | None
    match_payload: Mapping[str, object] | None


@dataclass(frozen=True)
class MatchAttemptReceipt:
    attempt_id: str
    attempt_ordinal: int
    fair_bucket: int
    retry_after: datetime


@dataclass(frozen=True)
class PersistedMatchResult:
    status: Literal[
        "matched",
        "no_station",
        "no_observation",
        "pending_incomplete",
        "not_mature",
        "error",
    ]
    match_id: str | None
    observation_match: ObservationMatch | None
    attempt_receipt: MatchAttemptReceipt | None
```

`resolve_station()` must call `resolve_beach_observation_station_v3` once per beach per run with the injected run `as_of`; cache and persist the returned resolution ID, source, tier, exact target-beach distance, resolved time, and version. It must never read distance from `unified_wave_observations`. `fetch_observation_candidates()` must query `observation_evidence_rows` for the resolved source and station and select:

```text
source, source_record_id, source_payload_hash, station_id, observed_at,
wave_height_m, wave_period_s, wave_direction_deg, ingested_at
```

within `valid_time ± 12 hours`, ordered only for stable transport and with no single-row limit. Build the observation revision identity from exact source record/hash, canonical values, timestamp, and `positive-height.v1`; attach the resolver's target-specific distance to every candidate.

`fetch_completeness_coverage()` selects the latest exact source/station row with
`coverage_gap_count=0`, `covered_from <= valid_time - 12 hours`,
`covered_through >= valid_time + 12 hours`, and `poll_completed_at <= as_of`.
A point or one-sided row never qualifies. `load_match_input_snapshot()` calls
the resolver, candidate fetch, and coverage query once, sorts all candidate
records by immutable identity, freezes their full values plus the target and
coverage into UTF-8, sorted-key, compact JSON with Python separators
`(',', ':')`, stores those exact bytes as `canonical_json`, and computes the
hash. The database parses those bytes back to JSONB to prove semantic equality
without reserializing them. It rejects submillisecond
times and never shares mutable objects between V1 and V2.

`record_match_attempt()` calls only
`record_forecast_observation_match_attempt_v1`. For
`pending_incomplete` or `no_station`, it sends the frozen snapshot hash and
validated station resolution; for a pre-snapshot repository error it sends neither and maps the
exception to a bounded allowlisted code. It accepts only the database-derived
ordinal, bucket, and retry time in the receipt. It never stores raw exceptions,
candidate arrays, or observation values.

`match_target()` accepts that `snapshot` explicitly and performs no fetch. It
returns `not_mature` until `valid_time + 24 hours`. An unresolved station
appends a `no_station` operational attempt and remains retryable. A resolved
station with a missing full-window coverage proof appends an operational attempt and returns
`pending_incomplete`, but writes no match or comparison even when a candidate
exists; this prevents a late closer observation from invalidating a claimed nearest match. With complete coverage it selects
nearest or records `no_observation`. Persist only complete match evidence through `record_forecast_observation_match_v1`, using a
stable key from target kind/ID, issuance revision, matcher, and resolver. The
database derives hashes and validates the frozen source rows. RPC collisions
raise `observation match idempotency collision`; repository code never writes
lineage tables directly. Phase 0 always sends `supersedes_match_id=null`; a
deliberately new matcher or resolver requires a separate schema migration and
approval before it may append one linear supersession.

- [ ] **Step 5: Run repository tests**

Run:

```bash
python -m pytest tests/test_observation_matching.py tests/test_observation_match_repository.py -v --tb=short
```

Expected: PASS.

- [ ] **Step 6: Commit the repository only if commits were explicitly authorized**

```bash
git add config.py crons/observation_match_repository.py tests/test_observation_match_repository.py
git commit -m "feat(forecast): persist versioned observation matches"
```

### Task 4: Dual-Run Append-Only Matcher Evidence Without Cutover

**Files:**
- Modify: `/Users/stevenchandler/Desktop/dev/seaside/crons/backfill_observations.py`
- Modify: `/Users/stevenchandler/Desktop/dev/seaside/tests/test_backfill_observations.py`

**Interfaces:**
- Consumes: `OBSERVATION_MATCHER_V2_MODE`, `list_forecast_observation_match_due_targets_v1`, `active_match_buckets()`, `load_match_input_snapshot()`, `record_match_attempt()`, the pure V1 and V2 selectors, and the atomic comparison RPC.
- Produces: `PersistedComparisonResult`, `ComparisonBatchResult`, unchanged legacy `process_prediction()` and `run()` behavior in both modes, append-only unresolved attempts, and same-snapshot comparison artifacts only when mode is `compare`. It never changes `ml_predictions_log` from V2 output.

Use these exact result contracts:

```python
@dataclass(frozen=True)
class LegacyObservationSelection:
    match_status: Literal["matched", "no_observation"]
    observation_revision_id: str | None
    observation_source_record_id: str | None
    observation_source_payload_hash: str | None
    observation_quality_control_version: str | None
    station_id: str | None
    observed_at: datetime | None
    observed_wave_height_m: float | None
    observed_wave_period_s: float | None
    observed_wave_direction_deg: float | None
    signed_delta_milliseconds: int | None


@dataclass(frozen=True)
class PersistedComparisonArtifact:
    comparison_id: str
    candidate_snapshot_hash: str
    v1_observation_revision_id: str | None
    v1_observation_source_record_id: str | None
    v1_observation_source_payload_hash: str | None
    v1_observation_quality_control_version: str | None
    v1_station_id: str | None
    v1_observed_wave_height_m: float | None


@dataclass(frozen=True)
class PersistedComparisonResult:
    v1: LegacyObservationSelection
    v2: PersistedMatchResult
    comparison: PersistedComparisonArtifact


@dataclass(frozen=True)
class ComparisonBatchResult:
    unseen_processed: int
    due_retry_processed: int
    deferred_retry_count: int
    attempted_comparisons: int
    repaired_comparisons: int
    pending_incomplete: int
    repository_errors: int
```

- [ ] **Step 1: Add failing off/compare and isolation tests**

Add tests proving:

```python
def test_off_runs_only_the_unchanged_legacy_writer(monkeypatch) -> None:
    monkeypatch.setattr(backfill_observations, "OBSERVATION_MATCHER_V2_MODE", "off")
    result = _run(backfill_observations.run_with_client(fake_supabase, now=NOW))
    assert result.legacy_processed == expected_legacy_count
    assert fake_supabase.comparison_rpc_calls == []


def test_compare_runs_legacy_then_independent_matured_probe(monkeypatch) -> None:
    monkeypatch.setattr(backfill_observations, "OBSERVATION_MATCHER_V2_MODE", "compare")
    result = _run(backfill_observations.run_with_client(fake_supabase, now=NOW))
    assert result.legacy_processed == expected_legacy_count
    assert result.comparison_processed == expected_comparison_count
    assert fake_supabase.ml_prediction_updates == expected_v1_updates


def test_compare_uses_one_frozen_snapshot_for_both_selectors() -> None:
    snapshot = _input_snapshot(
        candidates=[
            _candidate("ioos:1", "2026-07-17T01:00:00Z"),
            _candidate("ioos:2", "2026-07-17T11:45:00Z"),
        ],
        coverage=_complete_coverage(),
    )
    result = _run(run_one_v1_v2_comparison(
        fake_supabase,
        _sample_prediction(),
        snapshot=snapshot,
        now=NOW,
    ))
    assert result.v1.observation_revision_id == snapshot.candidates[0].observation_revision_id
    assert result.v2.observation_match.candidate.observation_revision_id == snapshot.candidates[1].observation_revision_id
    assert fake_supabase.comparison_rpc_calls[0]["candidate_snapshot_hash"] == snapshot.snapshot_hash


def test_v1_lineage_is_fully_replayable() -> None:
    row = _run(run_one_v1_v2_comparison(
        fake_supabase,
        _sample_prediction(),
        snapshot=_input_snapshot(),
        now=NOW,
    )).comparison
    assert row.v1_observation_source_record_id
    assert row.v1_observation_source_payload_hash
    assert row.v1_observation_quality_control_version == "positive-height.v1"
    assert row.v1_station_id
    assert row.v1_observed_wave_height_m > 0


def test_compare_never_updates_legacy_truth_or_error_columns() -> None:
    _run(run_v2_comparison_batch(fake_supabase, now=NOW))
    assert fake_supabase.v2_update_calls == []
    assert fake_supabase.v2_sentinel_calls == []


def test_permanently_incomplete_cycle_cannot_starve_new_targets() -> None:
    fake_supabase.seed_pending_attempts(count=19_950, retry_after=NOW + timedelta(days=7))
    fake_supabase.seed_unseen_predictions(count=1_000, active_buckets=active_match_buckets(NOW))
    result = _run(run_v2_comparison_batch(fake_supabase, now=NOW))
    assert result.unseen_processed == 1_000
    assert result.deferred_retry_count == 19_950
    assert result.attempted_comparisons == 1_000


def test_snapshot_failure_appends_bounded_attempt_and_is_backed_off() -> None:
    fake_supabase.fail_snapshot_load_with("upstream detail that must not persist")
    _run(run_v2_comparison_batch(fake_supabase, now=NOW))
    assert fake_supabase.attempt_rpc_calls[0]["bounded_error_code"] == "snapshot_load_failed"
    assert "upstream detail" not in json.dumps(fake_supabase.attempt_rpc_calls[0])
    assert fake_supabase.comparison_rpc_calls == []


def test_match_without_comparison_repair_reuses_original_snapshot_bytes() -> None:
    original = fake_supabase.seed_standalone_ml_match(
        snapshot=_input_snapshot(snapshot_at=NOW)
    )
    fake_supabase.replace_current_station_and_observations()
    result = _run(run_v2_comparison_batch(fake_supabase, now=NOW + timedelta(hours=6)))
    assert result.repaired_comparisons == 1
    assert fake_supabase.snapshot_load_calls == []
    assert fake_supabase.comparison_rpc_calls[0]["candidate_snapshot_hash"] == original.input_snapshot_hash
```

Also prove an incomplete coverage interval—even with a candidate—remains
`pending_incomplete`; the comparison RPC is not called. Prove a crash or
conflict in the comparison insert leaves no new match, while an exact
standalone `ml_prediction` match from an earlier V2 evaluation can receive its
missing V1/V2 comparison on retry. A `forecast_source_candidate` match is never
eligible for this repair path.

- [ ] **Step 2: Run the focused legacy tests**

```bash
python -m pytest tests/test_backfill_observations.py -v --tb=short
```

Expected: FAIL because compare-mode snapshot and atomic artifact logic do not exist.

- [ ] **Step 3: Preserve V1 byte-for-byte and add a separate comparison probe**

Do not rename, replace, or branch the current `process_prediction()` legacy
writer. It remains the only function that updates `observed_m`,
`raw_error_m`, `corrected_error_m`, or the legacy sentinel. In both
`off` and `compare`, `run()` first executes that existing batch unchanged.
Only `compare` then calls `run_v2_comparison_batch()`; V2 output is forbidden
from every `ml_predictions_log.update(...)` path.

`fetch_v2_comparison_predictions()` freezes a run-start high-water mark and
calls `list_forecast_observation_match_due_targets_v1('ml_prediction',
run_started_at, 20000)`. The selector includes rows at least 24 hours old
regardless of `observed_m`, excludes exact completed comparisons, retains the
exact match-without-comparison repair case, and applies the latest immutable
retry receipt. Each UTC hour activates one parity half of the 64 target
buckets; two consecutive hours cover all buckets. Within the 20,000 cap, use
round-robin bucket order with a 15,000 unseen-target lane and a 5,000 due-retry
lane, lending unused capacity across lanes. Load returned IDs by stable
`(predicted_at,id)` order with concurrency 25.

Emit unseen/due/deferred counts by bucket, lane utilization, attempts by
outcome, remaining current-sweep count, and the oldest unseen and overdue-retry
age. Alert when either parity sweep fails to drain within two hours under the
documented capacity envelope; do not treat a not-yet-due permanent gap as
current backlog. A capacity test must prove a 19,950-target incomplete cycle
cannot prevent a later unseen cycle from being attempted.

For each target:

1. construct the complete legacy value snapshot from the actual named columns;
2. for a new target, call `load_match_input_snapshot(..., as_of=run_started_at)` exactly once; for a repair row, parse and hash-check the persisted canonical snapshot and perform no repository fetch;
3. if snapshot loading fails, append `repository_error` with a bounded code and no raw exception; if station resolution is empty, append `no_station`; if full-window coverage is absent, append `pending_incomplete`; in every unresolved case write no match or comparison;
4. run the characterized `earliest-window.v1` and `nearest-time.v2` selectors over the same tuple;
5. retain V1 source record/hash, QC version, station, observed timestamp, height, period, direction, revision ID, and signed delta;
6. call only `record_forecast_observation_comparison`, which atomically inserts or attaches the exact V2 match and comparison.

For a repair row, both selectors consume the rehydrated original snapshot and
the RPC must match its stored match ID/hash before attaching the comparison.
This remains deterministic even if station configuration or observation state
changed after the standalone match.

This is an isolated selector comparison on the same V3 station resolution, not
a claim that historical V1 production used that station. Existing scalar
`observed_m` is descriptive only unless separately lined. Never derive V1
revision identity from that scalar.

- [ ] **Step 4: Add the pure evaluation boundary used by both repository paths**

Define:

```python
def evaluate_match_target(
    *,
    target: ForecastMatchTarget,
    snapshot: MatchInputSnapshot,
    now: datetime,
    policy: ObservationMatcherPolicy = MATCHER_POLICY_V2,
) -> MatchEvaluation

async def match_target(
    supabase: Any,
    *,
    target: ForecastMatchTarget,
    snapshot: MatchInputSnapshot,
    now: datetime,
) -> PersistedMatchResult
```

`evaluate_match_target()` performs no I/O. `match_target()` wraps it and
calls `record_forecast_observation_match_v1` for standalone P0-C evidence.
The comparison batch calls the pure evaluator and the two-artifact RPC, never
the standalone writer. Both paths use the exact same payload builder.

- [ ] **Step 5: Run focused tests**

```bash
python -m pytest tests/test_backfill_observations.py tests/test_observation_matching.py tests/test_observation_match_repository.py -v --tb=short
```

Expected: PASS, with the pre-existing V1 assertions unchanged and no V2
mutation of legacy truth/error/display-offset inputs.

- [ ] **Step 6: Commit the compare-only batch only if commits were explicitly authorized**

```bash
git add crons/backfill_observations.py tests/test_backfill_observations.py
git commit -m "feat(forecast): compare nearest matcher append-only"
```

### Task 5: Match Matured P0-C Source Candidates

**Files:**
- Create: `/Users/stevenchandler/Desktop/dev/seaside/crons/match_forecast_source_candidates.py`
- Create: `/Users/stevenchandler/Desktop/dev/seaside/tests/test_match_forecast_source_candidates.py`
- Modify: `/Users/stevenchandler/Desktop/dev/seaside/scheduler.py`
- Modify: `/Users/stevenchandler/Desktop/dev/seaside/tests/test_scheduler_registration.py`

**Interfaces:**
- Consumes: P0-C candidates, exact issuance revision IDs, `SOURCE_POLICY_EVALUATION_ENABLED`, `list_forecast_observation_match_due_targets_v1`, `record_match_attempt()`, and `match_target()`.
- Produces: hourly append-only source-candidate attempts/matches and scheduler job `match-forecast-source-candidates`.

- [ ] **Step 1: Write failing candidate-query and scheduler tests**

```python
def test_fetch_targets_requires_maturity_and_exact_revision():
    rows = fetch_targets(
        fake_supabase,
        now=datetime(2026, 7, 18, 12, tzinfo=timezone.utc),
    )
    assert rows == [
        ForecastMatchTarget(
            target_kind="forecast_source_candidate",
            target_id="10000000-0000-0000-0000-000000000001",
            beach_id="20000000-0000-0000-0000-000000000001",
            valid_time=datetime(2026, 7, 17, 12, tzinfo=timezone.utc),
            target_value_snapshot=_source_value_snapshot(
                candidate_id="10000000-0000-0000-0000-000000000001",
                issuance_revision_id="30000000-0000-0000-0000-000000000001",
                wave_height_m=1.6,
            ),
            target_primary_value_m=1.6,
            target_measurement_basis="offshore_significant_height",
            target_height_unit="meters",
            issuance_revision_id="30000000-0000-0000-0000-000000000001",
        )
    ]


def test_disabled_job_performs_zero_supabase_calls(monkeypatch):
    monkeypatch.setattr(match_forecast_source_candidates, "SOURCE_POLICY_EVALUATION_ENABLED", False)
    fake = CountingSupabase()
    run_with_client(fake)
    assert fake.calls == []


def test_due_selector_preserves_unseen_capacity_after_large_incomplete_cycle():
    fake_supabase.seed_source_attempts(count=19_950, retry_after=NOW + timedelta(days=7))
    fake_supabase.seed_unseen_source_candidates(count=1_000, active_buckets=active_match_buckets(NOW))
    rows = fetch_targets(fake_supabase, now=NOW)
    assert len(rows) == 1_000
    assert {row.target_id for row in rows} == fake_supabase.unseen_target_ids
```

Update the scheduler expectation to:

```python
assert _active_job_ids() == [
    "extract-hrrr-wind",
    "refresh-observable",
    "backfill-observations",
    "match-forecast-source-candidates",
    "fetch-rip-current-risk",
    "compute-beach-height-offsets",
]
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
python -m pytest tests/test_match_forecast_source_candidates.py tests/test_scheduler_registration.py -v --tb=short
```

Expected: FAIL because the module and job do not exist.

- [ ] **Step 3: Implement the gated matcher job**

`fetch_targets()` calls
`list_forecast_observation_match_due_targets_v1('forecast_source_candidate',
run_started_at, 20000)`, then loads the returned P0-C `candidate_id`, its
revision's `beach_id`, candidate `valid_at`, exact `wave_height_m`, measurement
basis/unit, candidate quality, and `issuance_revision_id`. Require candidate and
revision quality `ok`, positive wave height, `valid_at <= now - 24 hours`, and
absence from `current_forecast_observation_matches`. Build the complete source
value snapshot key set. The shared selector applies the two-hour 64-bucket
sweep, latest-attempt `retry_after`, 15,000 unseen/5,000 due-retry lane reserve,
and 20,000 total cap. Returned IDs load in stable `(valid_at,candidate_id)`
order. This covers the expected 57 candidates per beach for at least 350
beaches per cycle while preventing both fixed-1,000 and permanent-gap
starvation.

For each target, call `load_match_input_snapshot(...,
as_of=run_started_at)` once, then call `match_target(..., snapshot=snapshot,
now=run_started_at)`. Snapshot-load failure appends a bounded
`repository_error`; a station with no gap-free ±12-hour coverage appends
`pending_incomplete` even when a candidate observation is present. Neither
outcome creates a match. `run()` must return before obtaining Supabase when the
flag is false, process at most 25 targets concurrently, and count matched,
ineligible, no-station, completeness-proven no-observation,
pending-incomplete, repository-error, due-retry, and deferred-retry outcomes
separately. Emit lane/bucket utilization, remaining current-sweep count, and
oldest unseen/overdue-retry age; alert if either parity sweep fails to drain
within two hours under the capacity envelope.

Register:

```python
(match_forecast_source_candidates.run, CronTrigger(minute=35), 'match-forecast-source-candidates'),
```

The job calls only `record_forecast_observation_match_attempt_v1` for unresolved
operational outcomes and `record_forecast_observation_match_v1` for complete
match/no-observation evidence; direct table inserts are forbidden. It must
never update `ml_predictions_log`, `forecast_source_candidates`,
`forecast_source_issuance_revisions`, `enhanced_forecasts`,
`corrected_forecasts`, or any display-height offset input.

- [ ] **Step 4: Run job and scheduler tests**

Run:

```bash
python -m pytest tests/test_match_forecast_source_candidates.py tests/test_scheduler_registration.py -v --tb=short
```

Expected: PASS.

- [ ] **Step 5: Commit source-candidate matching only if commits were explicitly authorized**

```bash
git add crons/match_forecast_source_candidates.py tests/test_match_forecast_source_candidates.py scheduler.py tests/test_scheduler_registration.py
git commit -m "feat(forecast): match matured source candidates"
```

### Task 6: Freeze Segments and Build the Promotion-Blocked Report

**Files:**
- Create: `/Users/stevenchandler/Desktop/dev/seaside/scripts/source_policy_segments.v1.json`
- Create: `/Users/stevenchandler/Desktop/dev/seaside/scripts/source_policy_beach_classifications.v1.json`
- Create: `/Users/stevenchandler/Desktop/dev/seaside/scripts/source_policy_event_cases.v1.json`
- Create: `/Users/stevenchandler/Desktop/dev/seaside/scripts/source_policy_evaluation_report.py`
- Create: `/Users/stevenchandler/Desktop/dev/seaside/tests/test_source_policy_evaluation_report.py`
- Create: `/Users/stevenchandler/Desktop/dev/seaside/tests/fixtures/source_policy_evaluation_rows.jsonl`
- Create: `/Users/stevenchandler/Desktop/dev/seaside/tests/fixtures/source_policy_capture_rows.json`
- Create: `/Users/stevenchandler/Desktop/dev/seaside/tests/fixtures/source_policy_event_cases.reviewed.json`
- Create: `/Users/stevenchandler/Desktop/dev/seaside/tests/fixtures/source_policy_beach_classifications.reviewed.json`

**Interfaces:**
- Consumes: P0-C capture runs, scope membership, attempts, candidates joined to `current_forecast_observation_matches`, read-only legacy diagnostic rows, a self-hashed segment policy, a hash-validated beach-classification manifest, and a hash-validated event registry.
- Produces: an immutable evaluation-window capture manifest, canonical JSON and derived Markdown with database-derived capture coverage, required classification slices, descriptive metrics, promotion-eligible identical-row metrics only when both forecast lineages are exact, deterministic two-way cluster intervals, and blockers. It never returns a serving `go` decision.

- [ ] **Step 1: Create the frozen segment manifest**

```json
{
  "version": "source-policy-phase0.v1",
  "policy_hash": "f6e023ef289830361dff3d22655cd4bc1f944c73d2f4116b642a8d1ee42a664e",
  "measurement_basis": "offshore_significant_height",
  "unit": "meters",
  "maturity_delay_seconds": 86400,
  "max_abs_time_delta_milliseconds": 7200000,
  "max_station_distance_km": 25.0,
  "minimum_capture_coverage": 0.95,
  "minimum_aligned_rows": 500,
  "minimum_independent_issue_cycles": 30,
  "minimum_beaches": 5,
  "minimum_event_cases": 3,
  "approved_inferred_cycle_resolvers": [],
  "required_classifications": {
    "region": {"source": "beach_classification_manifest.region", "null_blocker": "region_classification_missing"},
    "direction": {
      "source": "candidate.wave_direction_deg",
      "buckets": [
        {"id": "north", "start_inclusive": 315.0, "end_exclusive": 45.0, "wraps_zero": true},
        {"id": "east", "start_inclusive": 45.0, "end_exclusive": 135.0},
        {"id": "south", "start_inclusive": 135.0, "end_exclusive": 225.0},
        {"id": "west", "start_inclusive": 225.0, "end_exclusive": 315.0}
      ],
      "null_blocker": "direction_classification_missing"
    },
    "period": {
      "source": "candidate.wave_period_s",
      "buckets": [
        {"id": "short_lt_10", "max_exclusive": 10.0},
        {"id": "mid_10_to_14", "min_inclusive": 10.0, "max_exclusive": 14.0},
        {"id": "long_ge_14", "min_inclusive": 14.0}
      ],
      "null_blocker": "period_classification_missing"
    },
    "mixed_swell": {
      "version": "partition-mix.v1",
      "minimum_partition_height_m": 0.25,
      "minimum_secondary_to_total_ratio": 0.20,
      "minimum_direction_separation_degrees": 30.0
    },
    "event_regime": {
      "source": "hash_validated_event_registry",
      "allowed": ["tropical", "long_period", "ordinary", "unresolved_disagreement"],
      "null_blocker": "event_regime_classification_missing"
    },
    "exposure": {
      "required_version": "beach-exposure.v1",
      "allowed": ["exposed", "sheltered"],
      "null_blocker": "beach_exposure_classification_missing"
    }
  },
  "segment_minimums": {"rows": 500, "cycles": 30, "beaches": 5},
  "primary_segments": [
    {"id": "all_eligible", "horizon_min": 0, "horizon_max": 168, "minimum_rows": 500, "minimum_cycles": 30, "minimum_beaches": 5},
    {"id": "handoff_60_96", "horizon_min": 60, "horizon_max": 96, "minimum_rows": 500, "minimum_cycles": 30, "minimum_beaches": 5, "seam_sides": [{"id": "at_or_before_72", "minimum_rows": 100, "minimum_cycles": 10}, {"id": "after_72", "minimum_rows": 100, "minimum_cycles": 10}]},
    {"id": "long_horizon_121_168", "horizon_min": 121, "horizon_max": 168, "minimum_rows": 500, "minimum_cycles": 30, "minimum_beaches": 5},
    {"id": "mixed_swell", "mixed_swell": true, "minimum_rows": 500, "minimum_cycles": 30, "minimum_beaches": 5},
    {"id": "event_regimes", "expand_by": "event_regime", "minimum_rows": 500, "minimum_cycles": 30, "minimum_beaches": 5, "minimum_cases": 3, "minimum_rows_per_case": 100, "minimum_cycles_per_case": 5},
    {"id": "regions", "expand_by": "region", "minimum_rows": 500, "minimum_cycles": 30, "minimum_beaches": 5},
    {"id": "directions", "expand_by": "direction", "minimum_rows": 500, "minimum_cycles": 30, "minimum_beaches": 5},
    {"id": "periods", "expand_by": "period", "minimum_rows": 500, "minimum_cycles": 30, "minimum_beaches": 5},
    {"id": "exposure_groups", "expand_by": "exposure", "minimum_rows": 500, "minimum_cycles": 30, "minimum_beaches": 5}
  ],
  "protected_segments": [
    {"id": "short_horizon_0_59", "horizon_min": 0, "horizon_max": 59, "minimum_rows": 500, "minimum_cycles": 30, "minimum_beaches": 5},
    {"id": "non_mixed", "mixed_swell": false, "minimum_rows": 500, "minimum_cycles": 30, "minimum_beaches": 5},
    {"id": "sheltered", "exposure": "sheltered", "minimum_rows": 500, "minimum_cycles": 30, "minimum_beaches": 5}
  ],
  "target_improvement": {
    "absolute_mae_m": 0.02,
    "relative_mae": 0.05,
    "operator": "and",
    "bootstrap_confidence": 0.95,
    "lower_confidence_bound_must_exceed_m": 0.0
  },
  "protected_rejection": {
    "absolute_mae_worsening_m": 0.02,
    "relative_mae_worsening": 0.05,
    "operator": "or"
  },
  "bootstrap": {
    "iterations": 2000,
    "seed": 20260717,
    "method": "two_way_product_weight_cluster_bootstrap.v1",
    "cycle_key": [
      "baseline_source", "baseline_source_model", "baseline_source_cycle_id",
      "candidate_source", "candidate_source_model", "candidate_source_cycle_id"
    ],
    "second_key": "station_id_else_region"
  }
}
```

`policy_hash` is SHA-256 of recursively key-sorted compact JSON with only the
`policy_hash` field omitted. `load_segment_policy()` recomputes it and rejects
missing, mismatched, or same-version content drift before reading a threshold.

Create `source_policy_beach_classifications.v1.json` as a canonical manifest
with `version`, `evaluation_window_start`, `evaluation_window_end`,
`generated_at`, `region_source="forecast_source_capture_scope.region_snapshot"`,
`region_source_version="p0c-scope.v1"`, nullable approved exposure source and
version, sorted entries, and `classification_hash`. Each entry is keyed by
`(capture_run_id, beach_id)` and contains the exact `region_snapshot` and
`scope_row_hash` from that immutable P0-C scope row. Exposure is null in the
initial production manifest. A future non-null exposure entry must include its
approved value, source version, as-of time, and content hash. Compute
`classification_hash` over canonical JSON with that field omitted.

The loader requires exactly one entry for every run/beach in the comparison
capture manifest, verifies region and row hash against the frozen P0-C scope,
and rejects extra entries, current-`beaches` substitution, or a classification
learned after the comparison decision issue time. Each comparison unit stores
the applicable entry values plus the complete classification-manifest hash.
Changing region or future exposure membership therefore creates a new
manifest and new unit IDs rather than silently moving historical rows between
segments.

`expand_by` creates one required segment for every frozen bucket and, for
region, every non-null frozen region represented in the beach-classification
manifest. Missing classifications are excluded from metrics and add the named
blocker. `partition-mix.v1` is true only when two distinct swell partitions
each meet 0.25 m, the smaller is at least 20% of their summed height, and their
circular direction separation is at least 30 degrees.

There is currently no approved authoritative `beach-exposure.v1` dataset.
Therefore every real Phase 0 report must emit
`beach_exposure_classification_missing`, omit exposed/sheltered promotion
metrics, and remain `blocked`. Do not infer exposure from beach names,
`swell_access_factors`, user preferences, or P0-A's conservative event scope.
Adding that classification is a separate reviewed evidence change.

Create the event registry as an explicit blocked initial state:

```json
{
  "version": "source-policy-event-cases.v1",
  "status": "collection_required",
  "minimum_event_cases": 3,
  "cases": [],
  "allowed_evidence_classes": [
    "serving_model_evidence",
    "official_safety_context",
    "qa_only_evidence"
  ],
  "required_reviewers": 2,
  "required_adjudication_status": "approved",
  "registry_hash": "9fde25b51a662b0ba96f86f9dafdc82e088aeda0a0c123b0d5d3281234ff180c",
  "label_use": "evaluation_segmentation_only",
  "serving_effect": "none"
}
```

Every future case must include `event_case_id`, label, UTC start/end, regions,
at least one immutable evidence reference with an allowed evidence class and
content hash, two distinct reviewer IDs, `adjudication_status="approved"`, and
an adjudication timestamp. Recompute `registry_hash` over canonical JSON with
that field omitted. An empty, hash-mismatched, under-reviewed, or
collection-required registry always blocks the event gate. QA-only evidence may
label evaluation segments but never becomes forecast or safety truth.

- [ ] **Step 2: Write failing report tests**

Tests must assert:

- candidates are compared only on canonical comparison units sharing the exact observation revision and both exact forecast revisions;
- independent cycles are distinct paired baseline/candidate `(source, source_model, source_cycle_id)` keys from one shared comparison manifest, with provider resolution or an explicitly approved inferred resolver on both sides; retrieval time and `issuance_identity` never count;
- the bootstrap independently resamples issue-cycle clusters and station/region clusters, then applies the product of their multiplicities to rows;
- protected rejection fires when either absolute worsening exceeds 0.02 m or relative worsening exceeds 5%;
- a primary segment passes improvement only when `baseline_mae - candidate_mae >= 0.02`, `(baseline_mae - candidate_mae) / baseline_mae >= 0.05`, and the paired-delta 95% lower bound is above zero;
- `baseline_mae == 0` yields an undefined relative change and blocks that segment;
- insufficient cycles, rows, beaches, capture coverage, or event cases produce explicit blockers;
- capture coverage is recomputed from immutable P0-C run scope and attempts over the evaluation window; caller summary counts are ignored;
- every primary/protected segment requires 500 rows, 30 paired cycles, and five beaches; the 60–96-hour segment additionally requires both frozen seam-side minima;
- region, direction, period, mixed/non-mixed, event-regime, and exposure classifications use only the frozen derivations, and missing exposure emits `beach_exposure_classification_missing`;
- segment-policy and beach-classification hashes are recomputed before use; same-version policy edits, missing run/beach classification entries, and current-table substitutions fail closed;
- every included event case meets its per-case row/cycle floor in addition to the three-case registry gate;
- a baseline row without exact immutable issuance lineage produces `baseline_issuance_lineage_missing` and is excluded from promotion metrics;
- duplicate canonical comparison-unit IDs or nondeterministic as-of revision selection fail closed;
- arbitrary event IDs absent from the hash-validated registry are rejected;
- output status is only `blocked`, `evidence_collecting`, or `gate_ready_for_review`, never `go`;
- Markdown is derived from the same canonical result object as JSON.

At minimum, include these direct policy assertions:

```python
def test_protected_rejection_uses_absolute_or_relative_worsening() -> None:
    assert protected_segment_rejected(
        absolute_mae_worsening_m=0.021,
        relative_mae_worsening=0.01,
    ) is True
    assert protected_segment_rejected(
        absolute_mae_worsening_m=0.01,
        relative_mae_worsening=0.051,
    ) is True
    assert protected_segment_rejected(
        absolute_mae_worsening_m=0.02,
        relative_mae_worsening=0.05,
    ) is False


def test_unknown_cycle_cannot_count_as_independent() -> None:
    result = evaluate_gate(load_fixture("unknown-cycle-exact-revisions"))
    assert result["independent_issue_cycles"] == 0
    assert "independent_issue_cycles_below_30" in result["blockers"]
    assert result["status"] == "blocked"


def test_phase0_realistic_fixture_remains_blocked() -> None:
    result = evaluate_gate(load_fixture("phase0-current-lineage"))
    assert "baseline_issuance_lineage_missing" in result["blockers"]
    assert "baseline_shared_capture_manifest_missing" in result["blockers"]
    assert "event_registry_collection_required" in result["blockers"]
    assert "beach_exposure_classification_missing" in result["blockers"]
    assert result["status"] == "blocked"
    assert "go" not in json.dumps(result).lower()


def test_improvement_requires_absolute_and_relative_targets() -> None:
    assert improvement_target_passes(
        baseline_mae_m=0.40, candidate_mae_m=0.379, ci_lower_m=0.001
    ) is True
    assert improvement_target_passes(
        baseline_mae_m=1.00, candidate_mae_m=0.97, ci_lower_m=0.001
    ) is False  # 3% misses the relative threshold
    assert improvement_target_passes(
        baseline_mae_m=0.20, candidate_mae_m=0.185, ci_lower_m=0.001
    ) is False  # 0.015 m misses the absolute threshold


def test_review_ready_path_uses_only_validated_fixtures() -> None:
    registry = load_event_registry(
        Path("tests/fixtures/source_policy_event_cases.reviewed.json")
    )
    classifications = load_beach_classification_manifest(
        Path("tests/fixtures/source_policy_beach_classifications.reviewed.json"),
        capture_manifest=load_capture_fixture(),
    )
    result = evaluate_gate(
        load_fixture("exact-both-lineages"),
        event_registry=registry,
        classification_manifest=classifications,
    )
    assert result["status"] == "gate_ready_for_review"
    assert "go" not in json.dumps(result).lower()


def test_capture_coverage_comes_from_scope_and_attempt_rows() -> None:
    fixture = load_capture_fixture()
    manifest = build_capture_coverage_manifest(
        fixture["runs"],
        fixture["scope"],
        fixture["attempts"],
        window_start=parse_utc(fixture["window_start"]),
        window_end=parse_utc(fixture["window_end"]),
    )
    assert manifest["expected_candidate_slots"] == 5 * 57
    assert manifest["captured_candidate_slots"] == 4 * 57
    assert manifest["coverage"] == pytest.approx(0.8)
    assert "capture_coverage_below_95pct" in evaluate_gate({
        **load_fixture("exact-both-lineages"),
        "capture_manifest": manifest,
    })["blockers"]


def test_handoff_requires_both_seam_sides() -> None:
    result = evaluate_gate(load_fixture("handoff-only-at-or-before-72"))
    assert "handoff_after_72_rows_below_100" in result["blockers"]
    assert result["status"] == "blocked"


def test_same_version_policy_content_drift_fails_closed(tmp_path: Path) -> None:
    changed = json.loads(Path("scripts/source_policy_segments.v1.json").read_text())
    changed["minimum_aligned_rows"] = 499
    path = tmp_path / "changed-policy.json"
    path.write_text(json.dumps(changed))
    with pytest.raises(ValueError, match="policy hash mismatch"):
        load_segment_policy(path)


def test_current_beach_region_cannot_replace_frozen_classification() -> None:
    manifest = load_beach_classification_manifest(
        Path("tests/fixtures/source_policy_beach_classifications.reviewed.json"),
        capture_manifest=load_capture_fixture(),
    )
    with pytest.raises(ValueError, match="off-manifest beach classification"):
        classify_evaluation_row(
            {**load_fixture("one-row"), "region": "edited-current-region"},
            policy=load_segment_policy(Path("scripts/source_policy_segments.v1.json")),
            event_registry=load_event_registry(Path("tests/fixtures/source_policy_event_cases.reviewed.json")),
            classification_manifest=manifest,
        )
```

- [ ] **Step 3: Run the report tests and verify they fail**

Run:

```bash
python -m pytest tests/test_source_policy_evaluation_report.py -v --tb=short
```

Expected: FAIL because the report module does not exist.

- [ ] **Step 4: Implement the report**

Define and use these exact public signatures:

- `load_segment_policy(path: Path) -> dict[str, Any]`
- `load_event_registry(path: Path) -> dict[str, Any]`
- `load_beach_classification_manifest(path: Path, *, capture_manifest: dict[str, Any]) -> dict[str, Any]`
- `build_capture_coverage_manifest(runs: Sequence[dict[str, Any]], scope: Sequence[dict[str, Any]], attempts: Sequence[dict[str, Any]], *, window_start: datetime, window_end: datetime) -> dict[str, Any]`
- `classify_evaluation_row(row: dict[str, Any], *, policy: dict[str, Any], event_registry: dict[str, Any], classification_manifest: dict[str, Any]) -> dict[str, Any]`
- `select_revisions_as_of(rows: Sequence[dict[str, Any]], *, decision_issue_time: datetime, evaluation_anchor: datetime) -> list[dict[str, Any]]`
- `build_comparison_units(rows: Sequence[dict[str, Any]], *, evaluation_anchor: datetime, policy_version: str, policy_hash: str, classification_manifest: dict[str, Any]) -> list[dict[str, Any]]`
- `compute_segment_metrics(rows: Sequence[dict[str, Any]], segment: dict[str, Any]) -> dict[str, Any]`
- `two_way_cluster_bootstrap_mae_delta(rows: Sequence[dict[str, Any]], *, iterations: int, seed: int) -> dict[str, float]`
- `improvement_target_passes(*, baseline_mae_m: float, candidate_mae_m: float, ci_lower_m: float) -> bool`
- `protected_segment_rejected(*, absolute_mae_worsening_m: float, relative_mae_worsening: float) -> bool`
- `evaluate_gate(report_input: dict[str, Any], *, event_registry: dict[str, Any] | None = None, classification_manifest: dict[str, Any] | None = None) -> dict[str, Any]`
- `render_markdown(result: dict[str, Any]) -> str`

`build_capture_coverage_manifest()` includes every capture run started in the
closed evaluation window, verifies each stored expected-beach count against
scope membership, derives `expected_candidate_slots = scope_count * 57`, and
derives captured slots only from immutable attempt counts. It validates that
each attempt is in scope and its count matches persisted candidates, then
hashes sorted run/scope/attempt identities. Failed and partial runs remain in
the denominator; caller summary counts are ignored.

`select_revisions_as_of()` chooses the latest revision with `retrieved_at <=
decision_issue_time`; that time must be at or before `evaluation_anchor`. It
uses `(retrieved_at, revision_id)` ordering, rejects two different payloads at
the same terminal key, and never consults wall-clock time. Provider/parser
corrections learned after the hypothetical decision cannot leak backward.
`build_comparison_units()` hashes a canonical object containing comparison
capture-manifest ID/hash, decision issue time, evaluation anchor,
segment policy version/hash, beach-classification manifest hash and frozen
region/exposure values, matcher/resolver policy versions, beach, valid time, exact
observation revision, measurement basis/unit, exact baseline source/model/cycle
resolution/revision/value, and exact candidate
source/model/cycle-resolution/revision/value. Duplicate unit IDs are fatal.

Extract the current legacy NOAA/Open-Meteo baseline read-only from
`ml_predictions_log` as diagnostic rows with exact prediction row ID and a
frozen `legacy-72h.v1` selector: at or before 72 hours use `raw_forecast_m`
and fall back to `wave_height_om`; after 72 hours use `wave_height_om` and fall
back to `raw_forecast_m`. Record the matching P0-C reason code, preserve
`offshore_significant_height`/meters, and never substitute raw or corrected
display face-height fields. Set `baseline_issuance_revision_id=null` and
`baseline_lineage_status="missing_issuance_lineage"`. Report its paired
descriptive error and an explicit denominator, but never feed those rows into
promotion metrics. P0-D does not pretend P0-C's GFS-only registry contains
legacy NOAA/Open-Meteo revisions. Until a separately approved baseline-capture
workstream supplies exact immutable lineage, every real report carries
`baseline_issuance_lineage_missing` and
`baseline_shared_capture_manifest_missing`.

Independent issue cycles are counted only from distinct paired keys
`(baseline source/model/cycle, candidate source/model/cycle)` where both cycle
resolutions are `provider` or use an inferred resolver version in the frozen
approved list. Unknown cycles and `issuance_identity` never substitute. Both
revisions must be selected from the same immutable comparison capture manifest
at each unit's `decision_issue_time`; `retrieved_at` and `source_issued_at` must
be at or before that issue time, which must be no later than the report's
`evaluation_anchor`. This shared manifest is the alignment rule and is recorded
in each comparison unit—calendar bucketing or nearest retrieval time may not
manufacture alignment.

For each bootstrap iteration, sample the unique issue-cycle clusters with
replacement and independently sample the unique station IDs (region only when
station is absent) with replacement. Give each row the product of its two
cluster multiplicities, then compute the weighted paired mean of
`baseline_absolute_error_m - candidate_absolute_error_m`. Use exactly 2,000
iterations and `numpy.random.Generator(numpy.random.PCG64(20260717))`; emit the
2.5th and 97.5th percentiles plus the seed/method. Row-wise or concatenated
single-block resampling is forbidden.

Every primary and protected segment must meet 500 aligned rows, 30 independent
paired cycles, and five beaches. Capture-manifest coverage must be at least
95%. Handoff must also meet both seam-side row/cycle floors. All frozen region,
direction, period, mixed/non-mixed, event-regime, and exposure slices must be
reported; missing classification or underpowered required slices block the
gate rather than disappearing from the denominator. Event regimes require
three reviewed cases plus each case's row/cycle floor.

Every primary segment must meet its own minimum rows and independent cycles.
Its point improvement is `baseline_mae - candidate_mae` (positive is better),
relative improvement is that delta divided by baseline MAE, and it passes only
when absolute improvement is at least 0.02 m, relative improvement is at least
5%, and the 95% paired-delta lower bound is above zero. Baseline MAE zero makes
relative improvement undefined and blocks the segment. Every protected segment
must meet its minimum rows and rejects when either absolute worsening is over
0.02 m or relative worsening is over 5%.

`evaluate_gate()` must apply the protected rule as:

```python
protected_rejected = (
    absolute_mae_worsening_m > 0.02
    or relative_mae_worsening > 0.05
)
```

Even when all numerical gates pass, return `gate_ready_for_review`; Phase 0D never authorizes serving.

- [ ] **Step 5: Run deterministic fixture verification**

Run:

```bash
python -m pytest tests/test_source_policy_evaluation_report.py -v --tb=short
python scripts/source_policy_evaluation_report.py --input tests/fixtures/source_policy_evaluation_rows.jsonl --capture-input tests/fixtures/source_policy_capture_rows.json --segments scripts/source_policy_segments.v1.json --classifications scripts/source_policy_beach_classifications.v1.json --events scripts/source_policy_event_cases.v1.json --json-out /tmp/source-policy-evaluation.json --markdown-out /tmp/source-policy-evaluation.md
```

Expected: pytest PASS; the script exits 0; both output files exist; fixture status is `blocked` with deterministic blocker codes.

- [ ] **Step 6: Commit the report only if commits were explicitly authorized**

```bash
git add scripts/source_policy_segments.v1.json scripts/source_policy_beach_classifications.v1.json scripts/source_policy_event_cases.v1.json scripts/source_policy_evaluation_report.py tests/test_source_policy_evaluation_report.py tests/fixtures/source_policy_evaluation_rows.jsonl tests/fixtures/source_policy_capture_rows.json tests/fixtures/source_policy_event_cases.reviewed.json tests/fixtures/source_policy_beach_classifications.reviewed.json
git commit -m "feat(forecast): add trustworthy source policy report"
```

### Task 7: Document Operations and Verify Rollback

**Files:**
- Modify: `/Users/stevenchandler/Desktop/dev/seaside/docs/README.md`

**Interfaces:**
- Consumes: all P0-D flags, jobs, tables, and report commands.
- Produces: exact operator sequence and rollback evidence.

- [ ] **Step 1: Add the operations contract to README**

Document:

```text
OBSERVATION_MATCHER_V2_MODE=off
SOURCE_POLICY_EVALUATION_ENABLED=false
```

Rollout order:

1. Apply the approved Quiver migration after P0-C.
2. Deploy the Quiver IOOS/NDBC 36-hour historical coverage producers and verify complete, empty, paginated-failure, and transport-failure outcomes for one cycle.
3. Deploy Seaside with both flags at defaults.
4. Set `OBSERVATION_MATCHER_V2_MODE=compare`.
5. Verify at least 500 atomic same-snapshot comparison rows, zero match-without-comparison gaps, and zero cases where V2 fails to select the minimum millisecond delta.
6. Verify every matched or `no_observation` row has one gap-free coverage interval enclosing both retrieval-window edges; both parity sweeps drain unseen and currently due work within two hours; and not-yet-due incomplete attempts remain visible with database-derived retry times no more than seven days apart.
7. Set `SOURCE_POLICY_EVALUATION_ENABLED=true`.
8. Verify source-candidate match freshness, exact target/resolution/observation lineage, unseen/retry lane capacity, permanent-gap non-starvation, and the expected `baseline_issuance_lineage_missing` plus event-registry blocked report.
9. Leave the mode at `compare`; any compatibility-writer cutover is a later, separately designed and approved workstream because it can affect display-height offset inputs.

Rollback order:

1. Change `SOURCE_POLICY_EVALUATION_ENABLED=false` to stop new source-candidate matching.
2. Change `OBSERVATION_MATCHER_V2_MODE=off` to stop new comparison artifacts; the legacy writer remains unchanged.
3. Leave historical coverage capture enabled; it is truth completeness infrastructure, not a matcher switch.
4. Do not delete append-only attempts/matches/comparisons or roll back the shared schema.
5. Do not change forecast serving.

Before rollout, run this read-only preflight against the target database:

```sql
select jobname, active
from cron.job
where jobname = 'ml-backfill-observations';
```

Expected: zero active rows. If an active row exists, stop; do not enable V2
until a separately approved database change unschedules the duplicate writer.

- [ ] **Step 2: Run the focused and full Seaside gates**

Run:

```bash
python -m pytest tests/test_observation_matching.py tests/test_observation_match_repository.py tests/test_backfill_observations.py tests/test_match_forecast_source_candidates.py tests/test_source_policy_evaluation_report.py tests/test_scheduler_registration.py -v --tb=short
python -m pytest tests/ -v --tb=short
```

Expected: both commands PASS.

- [ ] **Step 3: Run Quiver gates**

Run:

```bash
yarn jest __tests__/migrations/forecast-observation-matches.test.ts __tests__/app/api/cron/ioos-sync-observations.test.ts __tests__/app/api/cron/ioos-sync-deactivation.test.ts __tests__/app/api/cron/ndbc-direct-sync.test.ts --runInBand
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f scripts/db/forecast-observation-matches-smoke.sql
yarn typecheck
yarn lint
```

Expected: all commands PASS on Node.js 22.

- [ ] **Step 4: Review both diffs**

Run:

```bash
git -C /Users/stevenchandler/Desktop/dev/quiver diff --check
git -C /Users/stevenchandler/Desktop/dev/seaside diff --check
git -C /Users/stevenchandler/Desktop/dev/quiver status --short
git -C /Users/stevenchandler/Desktop/dev/seaside status --short
```

Expected: no whitespace errors; only P0-D-owned files are staged or selected for later staging; unrelated existing work remains untouched.

- [ ] **Step 5: Exercise flag rollback in tests**

Run:

```bash
OBSERVATION_MATCHER_V2_MODE=compare SOURCE_POLICY_EVALUATION_ENABLED=false python -m pytest tests/test_backfill_observations.py tests/test_match_forecast_source_candidates.py -v --tb=short
OBSERVATION_MATCHER_V2_MODE=off SOURCE_POLICY_EVALUATION_ENABLED=false python -m pytest tests/test_backfill_observations.py tests/test_match_forecast_source_candidates.py -v --tb=short
```

Expected: both commands PASS; compare retains V1 compatibility behavior, and off performs zero source-policy evaluation writes.

- [ ] **Step 6: Commit documentation only if commits were explicitly authorized**

```bash
git add docs/README.md
git commit -m "docs(forecast): document observation scoring rollout"
```

## P0-D Completion Gate

P0-D is complete only when all of the following are evidenced:

- submillisecond inputs are rejected and fixed fixtures prove the minimum absolute millisecond delta is selected, including deterministic ties;
- station resolution ID/source/tier/target-specific distance/as-of/version, observation revision/source record/payload/QC identity, valid time, signed and absolute millisecond delta, tolerances, maturity, exact issuance revision, snapshot hash, and matcher version are persisted;
- every matched or terminal `no_observation` row has one gap-free source/station coverage interval enclosing the full ±12-hour window; incomplete windows and unresolved stations append only operational attempts, remain unscored, and are retried under the same bounded policy;
- no historical unlineaged `observed_m` row is presented as trusted;
- V2 compare mode has at least 500 atomic same-snapshot comparison rows, zero orphaned halves, and zero non-nearest selections;
- source candidates are filtered to positive `ok` candidate/revision rows; the two parity sweeps drain unseen and currently due work within two hours under the 20,000-target capacity envelope; deferred retries remain explicit and cannot starve newer work;
- promotion metrics use canonical comparison-unit IDs with both exact forecast lineages; the current unlineaged legacy baseline remains descriptive and blocks review readiness;
- deterministic two-way issue-cycle and station/region product-weight bootstrap intervals are used for uncertainty;
- segment policy and run/beach region/exposure classifications are canonical, self-hash-validated, and included in every comparison-unit identity; mutable current beach metadata cannot reclassify historical evidence;
- unknown provider cycles do not count as independent cycles;
- primary improvement requires absolute AND relative thresholds plus a positive lower confidence bound, while protected rejection uses absolute OR relative worsening;
- event cases come only from a hash-validated, reviewed registry; the empty production registry blocks the event gate;
- capture coverage is database-derived and at least 95%; every required primary/protected and region/direction/period/event/exposure slice meets 500 rows, 30 paired cycles, and five beaches, with both seam sides populated;
- the absent approved beach-exposure classification and empty event registry keep the real Phase 0 report blocked until separate reviewed evidence changes land;
- reports remain `blocked`, `evidence_collecting`, or `gate_ready_for_review` and cannot promote serving;
- `enhanced_forecasts`, `corrected_forecasts`, displayed physical heights, and recommendation behavior are unchanged;
- compare-to-off and source-evaluation true-to-false rollback paths have been exercised;
- focused and full Seaside tests plus Quiver migration, typecheck, and lint gates pass.

## Approval Boundaries

- Approval to implement this plan does not approve applying `20260717173000_create_forecast_observation_matches.sql` to any database.
- Approval to apply the schema does not approve any V2 compatibility-writer cutover; Phase 0 supports only `off|compare`.
- Approval to enable trustworthy reporting does not approve a source-policy serving change.
- A future serving-policy proposal requires a separate report, review, and explicit approval after the P0-C/P0-D evidence gates are satisfied.
