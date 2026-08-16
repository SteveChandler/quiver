# Forecast Transform Replay — 2026-06-25

Generated: 2026-06-25T23:33:43+00:00

Analysis only: no production change, no migration, no DB writes, no committed code. DB access used read-only psql transactions via POSTGRES_URL_NON_POOLING; no secrets, raw user identifiers, raw session identifiers, emails, or DB URLs are printed.

## Result

V0 sanity gate is blocked, so no variant recommendation is made.

The requested observed cohort cannot be faithfully replayed because every eligible `observed_m > 0` row in `ml_predictions_log` lacks the Phase 0 replay provenance that production now writes: `display_wave_source` and `display_raw_input_height_m`. Reconstructing V0 from partition columns would compare a guessed transform input against a stored display value and can create false mismatches.

This is not a production transform verdict and not a safe basis for choosing decay-off or decouple-buckets.

## Inputs and row counts

| item | value |
| --- | --- |
| eligible observed rows selected | 9599 |
| distinct selected beaches | 70 |
| selected rows with original display_wave_source | 0 |
| selected rows with display_raw_input_height_m | 0 |
| selected rows replayable for V0 | 0 |
| named requested beaches present | big-jetty, county-line-malibu-ca, crystal-pier, doheny, pb-point, rincon-carpinteria-ca, swamis, tourmaline-surf-park, upper-trestles |
| anonymized session face rows read | 25 |
| ml_predictions_log total rows | 90403 |
| ml_predictions_log observed rows | 40043 |
| ml_predictions_log rows with display_wave_source | 21306 |
| ml_predictions_log rows with display_raw_input_height_m | 21306 |
| ml_predictions_log observed replayable rows | 0 |
| first replayable ml_predictions_log predicted_at | 2026-06-24 15:00:00+00 |
| last replayable ml_predictions_log predicted_at | 2026-07-02 21:00:00+00 |
| next-7d enhanced_forecasts rows | 17976 |
| next-7d enhanced_forecasts rows with wave_height_provenance | 17976 |

## V0 sanity gate

Result: BLOCKED. The gate was not run because the observed rows do not contain the raw source tag or raw input height needed to replay production exactly.

Existing Seaside parity code treats this shape as legacy-unreplayable when `display_wave_source` is null; see `seaside/scripts/face_height_model/transform.py` oracle behavior. The current Quiver writer does populate both fields, but those rows have not yet acquired `observed_m > 0` backfill.

## Variant scoreboard

Not produced. Scoring V1/V2/V3 against observed_m would inherit the invalid V0 reconstruction and could choose the wrong lever.

## Overshoot and de-amplifier controls

Not produced for the same reason. De-amplifier controls require a replayable V0 baseline before V2 direction-of-change can be trusted.

## Recommendation

No decay-off vs decouple-buckets recommendation. The smallest next validation is to rerun this replay after observation backfill lands for rows at or after the first replayable `ml_predictions_log.predicted_at`, or to run a clearly labeled forecast-horizon-only replay that scores current rows against OM/v5 without observed_m.

## Commands run

```text
test ! -e quiver/.planning/forecast-replay-2026-06-25.md
psql COPY rows: last 21d observed rows from ml_predictions_log joined to beaches, read-only transaction
psql COPY sessions: anonymized last 21d sessions.wave_height_ft by beach/time, read-only transaction
python3 seaside/scripts/face_height_model/workspace/hermes_forecast_replay_20260625.py
psql COPY replayable-summary: ml_predictions_log provenance availability, read-only transaction
psql COPY horizon-summary: next-7d enhanced_forecasts provenance availability, read-only transaction
```
