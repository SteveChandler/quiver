---
schema_version: swell-watch-calibration.v2
status: implementation_ready
live_status: blocked
approved_profile: null
profile_hash: null
reviewer: null
reviewed_at: null
---

# Swell Watch Calibration

## Decision

Fixture-driven implementation is ready with a deterministic provisional policy. Live calibration and activation remain blocked: a read-only production inventory was authorized on 2026-09-03, but the retained data cannot satisfy the evidence contract. Fixture and replay cases are deliberately ineligible for selecting a production policy profile.

Plans 03–09 may use the provisional fixture policy only for local no-send implementation and tests. Plans 10 approval and 11 activation remain blocked. No production detector, matcher, hold, staleness, cadence, audience, or provider-failure constant has been selected.

## Provisional fixture policy — implementation only

The exact fixture is [`__tests__/fixtures/swell-watch-provisional-policy.json`](../../__tests__/fixtures/swell-watch-provisional-policy.json). It is versioned `swell-watch-policy.v1`, profile ID `swell-watch-provisional-fixture.v1`, provenance `provisional_fixture`, and canonical value hash `9a278ceca6c2fde80358e19258e2f6118e564735b8eb762266bd682c494df2ad`. It has no reviewer and `production_approved: false`.

| Dimension                                   | Fixture value                    | Evidence status                                          |
| ------------------------------------------- | -------------------------------- | -------------------------------------------------------- |
| Local rise / energy                         | 1 ft / 1.25 ratio                | deterministic fixture, not observed safe                 |
| Impact score                                | 1                                | deterministic fixture, not observed safe                 |
| Direction / period / arrival matching       | 25° / 2 s / 6 h                  | deterministic fixture, not observed safe                 |
| Actionability / stability                   | 2–5 days / 2 genuine evaluations | D-04/D-05 contract; genuine identity still required live |
| Candidate / recipient / projected-send caps | 50 / 1,000 / 1,000               | deterministic fixture, not observed safe                 |
| Provider hold                               | 60 min / 5% / 20 samples         | deterministic fixture, not observed safe                 |
| Staleness / cadence                         | 6 h / 60 min                     | deterministic fixture, not observed safe                 |

Production authority is explicitly unsupported and fail-closed until Plan 06 supplies an independently loaded, revocation-aware trusted approval source. It rejects provisional, missing, stale, mismatched, fabricated, or forced-arm authority; caller-supplied JSON fields and booleans cannot authorize a send.

## Required artifact contract

The exporter accepts only local, versioned `swell-watch-shadow-corpus.v1` JSONL input with sanitized NOAA or Open-Meteo observations and an independently declared active-scope inventory. It derives retained days from actual `observed_at` dates within the declared window; caller-supplied endpoints and observed rows cannot define expected scope. Provenance is required. Missing immutable issuance/evaluation identity, audience evaluation, candidate/regional outcome, recipient/projected-send, or delivery outcome remains explicitly unavailable, never zero or a candidate-count alias. It rejects user/device identifiers, relationship mappings, raw payloads/errors, salts, secrets, unknown providers, partial tuples, reused evaluation IDs, and unversioned rows.

The manifest carries sorted active region IDs and beach pseudonyms so the calibrator can recompute coverage rather than trust reported totals. It must independently establish all of the following before calibration can begin:

| Assertion                                                  | Evidence                      | Status  |
| ---------------------------------------------------------- | ----------------------------- | ------- |
| Retained window is at least 30 days                        | unavailable                   | blocked |
| Active regions and beaches are fully covered               | unavailable                   | blocked |
| Each beach/provider has two distinct completed evaluations | unavailable                   | blocked |
| 69h, 72h, and 75h seam rows are observed                   | unavailable                   | blocked |
| Each region has observed candidate and regional-event rows | unavailable                   | blocked |
| Audience-evaluated candidate total matches candidates      | unavailable                   | blocked |
| Observed delivery outcomes are retained honestly           | unavailable                   | unavailable; injected failure tests/device evidence are a Plan 10 gate, not a circular real-failure prerequisite |
| Recursive PII/redaction scan passes                        | unavailable                   | blocked |
| Fixture/replay rows are excluded from real evidence        | no corpus available to verify | blocked |

## Commands and reproducibility

The following commands are the reproducible local workflow once an approved sanitized input artifact exists. They were not run here: the required input and its lineage are absent, and replacing it with fabricated rows would invalidate calibration.

```sh
yarn tsx scripts/calibrate-swell-watch.ts --mode fixtures --fixture __tests__/fixtures/swell-watch-provisional-policy.json
yarn tsx scripts/export-swell-watch-shadow-corpus.ts --from <ISO> --to <ISO> --mode replay-and-shadow --scope <independent-active-scope.json> --input <sanitized-local-jsonl> --out .artifacts/swell-watch/shadow-corpus.v1.jsonl --manifest .artifacts/swell-watch/shadow-corpus-manifest.v1.json
yarn tsx scripts/calibrate-swell-watch.ts --mode live-evidence --input .artifacts/swell-watch/shadow-corpus.v1.jsonl --manifest .artifacts/swell-watch/shadow-corpus-manifest.v1.json --output docs/operations/swell-watch-calibration.md
```

The exporter uses stable sorting and SHA-256 serialization for the corpus hash. The calibrator re-sanitizes rows, recomputes that hash, and fails before any profile output when the manifest hash or coverage assertions do not pass. Neither script opens a database/network client, sends or enqueues a push, or embeds policy constants.

Live evidence eligibility additionally fails on missing immutable issuance/evaluation identity, candidate/regional outcome, audience evaluation, recipient count, or projected-send count. Delivery outcome counters remain `null` when unavailable and are reported without inventing failure categories; real delivery failures are not manufactured to make a gate pass.

## Read-only inventory evidence

The following aggregate-only inventory ran from the primary web checkout using runtime environment source `.env.production.local`. It selected counts and timestamp boundaries only; it did not select user IDs, device/installation identifiers, beach mappings, raw payloads/errors, salts, or secrets. No export artifact was written.

```sh
cd /Users/stevenchandler/Desktop/dev/quiver && node -
# stdin program: aggregate-only Supabase SELECT/head queries; dotenv source .env.production.local
```

| Inventory dimension              | Aggregate finding                                                                                                  | Calibration consequence                                                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gfs_wave_shadow_forecasts`      | 28,783 total / 28,783 `ok`; earliest `2026-06-12T16:00:53.230724+00:00`, latest `2026-06-18T15:01:46.753538+00:00` | Less than 30 retained days. Schema constrains this source to Open-Meteo, so it cannot establish NOAA/Open-Meteo provider coverage.                  |
| `enhanced_forecasts`             | 66,357 total; earliest `2026-08-27T02:30:28.711+00:00`, latest `2026-09-03T18:02:23.714+00:00`                     | Less than 30 retained days; current row shape has no immutable issuance/evaluation identity.                                                        |
| `forecast_alert_deliveries`      | 0 rows for `swell_watch_email`                                                                                     | No swell-watch delivery history.                                                                                                                    |
| `notification_events`            | 1 row for type `swell_watch`                                                                                       | Insufficient to establish candidate/regional/audience outcomes; aggregate-only review intentionally did not read event payload or recipient fields. |
| `notification_delivery_attempts` | 3,026 push rows total                                                                                              | Table status taxonomy does not contain the required swell-specific auth/config, rate-limit, contradiction, or missing-partition outcome evidence.   |

The schema and this inventory therefore leave every required seam, distinct issuance, candidate/regional, audience/projected-send, and classified delivery table unsupported. No corpus/manifest hash, percentile, candidate profile, fixture confusion result, or policy value may be derived.

## Evidence tables

All measurement tables below are intentionally unavailable—not zero—because no retained/shadow artifact was supplied.

| Dimension                                         | Value                                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Corpus hash                                       | unavailable — no sanitized corpus exported                                           |
| Manifest hash                                     | unavailable — no manifest exported                                                   |
| Retained days                                     | insufficient: shadow history spans under 7 days; enhanced history spans under 8 days |
| Region/beach coverage                             | unavailable — no versioned active-scope corpus                                       |
| Distinct issuance/evaluation interarrival         | unavailable — no immutable evaluation IDs in retained enhanced rows                  |
| Seam counts (69h/72h/75h)                         | unavailable — no eligible corpus                                                     |
| Candidate/regional/audience/projected-send totals | unavailable — no historical swell-watch evaluator output                             |
| Provider/delivery outcome counts                  | insufficient — no swell-watch delivery history and incompatible outcome taxonomy     |
| Distribution and percentile tables                | unavailable                                                                          |
| Fixture confusion table                           | unavailable                                                                          |

## Approval gate

Do not approve a profile until a reviewer can inspect a complete artifact pair with verified hashes and every coverage assertion passing. Approval must then name one immutable profile ID/hash and exact values for local significance, impact, direction/period/arrival tolerances, discontinuity/disagreement, candidate/recipient/projected-send caps, provider-failure window/rate/minimum sample, staleness, and one completed canonical forecast-batch evaluation cadence.
