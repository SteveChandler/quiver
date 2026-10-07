# Swell Watch event identity (2026-10-03)

Status: code and migration are in the pull request. The migration is **not applied**. Applying it is the founder's decision.

## What was measured

Production, 2026-09-17 to 2026-10-03: 26 past regional events for about 12 physical swells. 20 of the 26 were seen in one evaluation only, so they never reached `stable`.

Retained rows for the two worst cases are in `__tests__/fixtures/swell-watch-retained-20260920/event-identity-fragments.json`.

| Region | Issuance (UTC) | Arrival | Peak | Event | Why a new identity |
| --- | --- | --- | --- | --- | --- |
| san-diego | 09-20 00Z | 09-24 22 | 09-25 03 | `1cf874fe` | first sighting |
| san-diego | 09-20 06Z | 09-24 16 | 09-24 18 | `c8749117` | arrival moved 6 h (allowed), peak moved 9 h (limit 6 h) |
| san-diego | 09-20 06Z | 09-24 22 | 09-25 09 | `bac34085`, `bcc46da0` | second span of the issuance: matching was skipped, one new identity per beach |
| san-diego | 09-20 12Z | 09-25 00 | 09-25 09 | `54a80a4d`, `e3b2894b` | same |
| outer-banks | 09-20 12Z | 09-25 09 | 09-25 09 | `e11b7253` | matched (6 h) |
| outer-banks | 09-20 18Z | 09-25 12 | 09-25 17 | `ea04c90c` | peak moved 8 h |
| outer-banks | 09-20 18Z | 09-25 21 | 09-25 21 | `721655e2` | second span of the issuance |
| outer-banks | 09-21 00Z | 09-25 06 | 09-25 06 | `651d334e` | second span of the issuance |

## Root cause

1. **Endpoint matching.** `resolve_and_ingest_swell_watch_evaluation` required the arrival *and* the peak to each stay within `maximum_arrival_delta_hours` (6 h) of the event's latest reference. The peak of a flat swell is the maximum of a plateau; it moves further than that between issuances while the swell itself does not move.
2. **Same-issuance skip.** Since `20260918180000`, a second span from one issuance at one beach skipped matching entirely (`v_same_evaluation_beach`) and always took a fresh identity. It could not rejoin its own event from the previous issuance, and two beaches of one region got two identities for the identical span.
3. **Episode splitting.** One provider frame that splits the primary partition in two (San Diego, 09-24 21Z: 0.80 m becomes 0.64 m + 0.56 m) or reports no swell partition (Outer Banks, 09-25 18Z) closes the episode. The same swell reopens one to three hours later as a second span, which then hits rule 2.

## What changed

- `lib/alerts/swell-watch/horizon-derivation.ts` (derivation `v4`): spans of one issuance are rejoined when the next span arrives within `maximum_arrival_delta_hours` after the previous one closed and direction and period are within the matching tolerances. The rejoined event keeps the first arrival and the larger peak.
- `supabase/migrations/20261003190000_resolve_swell_watch_event_identity_by_span.sql`:
  - time coherence compares the arrival-to-peak spans: the gap between them must be at most `maximum_arrival_delta_hours`. Every pair the endpoint rule matched still matches.
  - the same-issuance skip now excludes only an event that already holds a different span of this issuance at this beach.
  - when several events fit, the one first evaluated is kept. Previously this raised `ambiguous regional identity`, which fails the whole cohort transaction.
- `lib/alerts/swell-watch/event-matcher.ts`: the same span rule for the application-side contiguity and confidence check.

Direction (25 deg), period (2 s), time tolerance (6 h), stability (2 evaluations), freshness and suppression rules are unchanged. No policy value changes, so the policy hash is unchanged and no existing row is rewritten.

## What it does not merge

- Swells whose spans are more than 6 h apart, or more than 25 deg or 2 s apart.
- Outer Banks, 09-20 06Z: the provider reports no swell partition for 19 h between a pulse on 09-24 and the main swell on 09-25. They stay two events. The seven production identities become three (pulse, main swell, a 9.8 s forerunner on 09-23).
- oahu-south, 09-25: the arrival moved 10 h between consecutive issuances with a 1 to 2 h span. Still two events. Closing that needs a wider time tolerance, which is a policy change.

## Applying

1. Merge and deploy the application change. It is safe with the current resolver.
2. Apply the migration as the production owner. It checks the production definition hash before and after and aborts on any difference. It is safe with the previous application version.
3. Rollback: `docs/operations/swell-watch-event-identity-rollback.sql`.

Existing fragmented events are in the past and are not rewritten.

## Verification

- `yarn jest __tests__/lib/alerts/swell-watch` (includes `event-identity-replay.test.ts`, which replays the retained runs)
- `bash scripts/test-swell-watch-event-identity-postgres.sh` (real resolver on disposable PostgreSQL 15; also proves the same spans fragment on the previous resolver, and that rollback restores it)
