# Forecast Truth-Scored Transform Replay — 2026-06-26

Generated: 2026-06-26T14:14:50+00:00

Analysis only: no production change, no migration, no DB writes, no committed code. DB access used read-only psql transactions via POSTGRES_URL_NON_POOLING; no secrets, raw user identifiers, raw session identifiers, emails, or DB URLs are printed.

## Inputs and row counts

| item | value |
| --- | --- |
| eligible forecast rows read | 872 |
| distinct beaches | 104 |
| model_swell rows | 764 |
| cdip_sig anchor rows | 108 |
| V0 exact-match rows scored | 794 |
| V0 quarantined rows | 78 |
| rows with original null display_wave_source | 0 |
| named requested beaches present | big-jetty, county-line-malibu-ca, crystal-pier, doheny, pb-point, rincon-carpinteria-ca, swamis, tourmaline-surf-park, upper-trestles |
| session face anchor read status | ok |
| anonymized session rows read | 3 |
| forecast rows with ±3h session face anchor | 0 |

Query purpose summaries:
- Forecast rows: last ~5 days, observed_m > 0 and display_raw_input_height_m present, plus production display provenance and all transform inputs from ml_predictions_log joined to public beach configuration. Rows are replayed on their stored/coalesced display_wave_source path; V0 must reproduce stored raw_display_height_m before recommendation.
- Session face anchor: optional anonymized sessions.wave_height_ft by beach/time only, excluding mock/system/non-real profiles; no raw user or session identifiers selected or reported.

Commands run:

```text
test ! -e quiver/.planning/forecast-replay-truth-2026-06-26.md
psql COPY rows: last 5d observed replayable rows from ml_predictions_log joined to beaches, read-only transaction
psql COPY sessions: anonymized last 5d sessions.wave_height_ft by beach/time, read-only transaction
python3 scripts/face_height_model/workspace/hermes_forecast_replay_truth_20260626.py
```

## V0 sanity gate

Result: PARTIAL PASS. 794 / 872 rows matched stored raw_display_height_m within 0.051 m; 78 mixed-writer rows are quarantined from scoring.

Variant scoring below uses only exact V0-match rows. The quarantined rows are preserved here so the recommendation is not based on a guessed production baseline.

| beach | source | predicted_at | stored m | V0 m | error m | path |
| --- | --- | --- | --- | --- | --- | --- |
| forster-st-oceanside | cdip_sig | 2026-06-24 21:00:00+00 | 1.585 | 1.402 | -0.183 | face-Hs-transformer-v1 |
| tamarack | cdip_sig | 2026-06-24 21:00:00+00 | 1.25 | 1.067 | -0.183 | face-Hs-transformer-v1 |
| tamarack | cdip_sig | 2026-06-24 18:00:00+00 | 1.25 | 1.067 | -0.183 | face-Hs-transformer-v1 |
| forster-st-oceanside | cdip_sig | 2026-06-24 18:00:00+00 | 1.585 | 1.402 | -0.183 | face-Hs-transformer-v1 |
| solimar-reef-ventura-ca | model_swell | 2026-06-24 21:00:00+00 | 0.183 | 0.366 | 0.183 | face-Hs-transformer-v1 |
| solimar-reef-ventura-ca | model_swell | 2026-06-25 00:00:00+00 | 0.183 | 0.366 | 0.183 | face-Hs-transformer-v1 |
| c-street-ventura-ca | model_swell | 2026-06-24 21:00:00+00 | 0.183 | 0.366 | 0.183 | face-Hs-transformer-v1 |
| c-street-ventura-ca | model_swell | 2026-06-24 18:00:00+00 | 0.183 | 0.366 | 0.183 | face-Hs-transformer-v1 |
| andrew-molera-river-mouth-big-sur-ca | model_swell | 2026-06-25 03:00:00+00 | 0.64 | 0.457 | -0.183 | face-Hs-transformer-v1 |
| andrew-molera-river-mouth-big-sur-ca | model_swell | 2026-06-25 06:00:00+00 | 0.64 | 0.457 | -0.183 | face-Hs-transformer-v1 |
| lower-trestles | cdip_sig | 2026-06-24 21:00:00+00 | 1.798 | 1.676 | -0.122 | face-Hs-transformer-v1 |
| church | cdip_sig | 2026-06-24 18:00:00+00 | 1.737 | 1.615 | -0.122 | face-Hs-transformer-v1 |
| cottons | cdip_sig | 2026-06-24 21:00:00+00 | 1.707 | 1.585 | -0.122 | face-Hs-transformer-v1 |
| church | cdip_sig | 2026-06-24 21:00:00+00 | 1.737 | 1.615 | -0.122 | face-Hs-transformer-v1 |
| cottons | cdip_sig | 2026-06-24 18:00:00+00 | 1.707 | 1.585 | -0.122 | face-Hs-transformer-v1 |
| lower-trestles | cdip_sig | 2026-06-24 18:00:00+00 | 1.798 | 1.676 | -0.122 | face-Hs-transformer-v1 |
| andrew-molera-river-mouth-big-sur-ca | model_swell | 2026-06-24 18:00:00+00 | 0.427 | 0.305 | -0.122 | face-Hs-transformer-v1 |
| blacks | cdip_sig | 2026-06-24 21:00:00+00 | 1.006 | 0.884 | -0.122 | face-Hs-transformer-v1 |
| poche-beach | model_swell | 2026-06-25 00:00:00+00 | 0.61 | 0.732 | 0.122 | face-Hs-transformer-v1 |
| andrew-molera-river-mouth-big-sur-ca | model_swell | 2026-06-25 00:00:00+00 | 0.427 | 0.305 | -0.122 | face-Hs-transformer-v1 |
| andrew-molera-river-mouth-big-sur-ca | model_swell | 2026-06-24 21:00:00+00 | 0.427 | 0.305 | -0.122 | face-Hs-transformer-v1 |
| blacks | cdip_sig | 2026-06-25 00:00:00+00 | 1.006 | 0.884 | -0.122 | face-Hs-transformer-v1 |
| middles | cdip_sig | 2026-06-24 18:00:00+00 | 1.585 | 1.463 | -0.122 | face-Hs-transformer-v1 |
| old-mans-sano | cdip_sig | 2026-06-24 18:00:00+00 | 1.646 | 1.524 | -0.122 | face-Hs-transformer-v1 |
| old-mans-sano | cdip_sig | 2026-06-24 21:00:00+00 | 1.646 | 1.524 | -0.122 | face-Hs-transformer-v1 |

## Variant scoreboard — overall

| segment | variant | obs n | obs MAE | obs bias | session n | session MAE | session bias | v5 n | v5 MAE | v5 bias |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| all | V0_current | 794 | 0.414 | -0.2962 | 0 |  |  | 794 | 0.3666 | -0.334 |
| all | V1_decay_off | 794 | 0.3877 | -0.2496 | 0 |  |  | 794 | 0.3237 | -0.2875 |
| all | V2_decouple_buckets | 794 | 0.5005 | -0.2333 | 0 |  |  | 794 | 0.4072 | -0.2711 |
| all | V3_raw_om | 794 | 0.2563 | 0.0608 | 0 |  |  | 794 | 0.0472 | 0.023 |

Note: observed_m is offshore CDIP significant wave height (Hs), not true surf face; use it for relative ranking. Physics says surf face should generally land near-or-above Hs (roughly raw OM), not below it, so lower observed_m MAE identifies the under-read fix but not the final absolute face target. session_face_m is the sparse gold tie-breaker; v5_shadow_height_m is the logged v5 shadow comparator.

## Segments by beach

| segment | variant | obs n | obs MAE | obs bias | session n | session MAE | session bias | v5 n | v5 MAE | v5 bias |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| emma-wood-ventura-ca | V0_current | 17 | 1.0764 | -1.0764 | 0 |  |  | 17 | 0.573 | -0.573 |
| emma-wood-ventura-ca | V1_decay_off | 17 | 1.0764 | -1.0764 | 0 |  |  | 17 | 0.573 | -0.573 |
| emma-wood-ventura-ca | V2_decouple_buckets | 17 | 1.1715 | -1.1715 | 0 |  |  | 17 | 0.6682 | -0.6682 |
| emma-wood-ventura-ca | V3_raw_om | 17 | 0.6447 | -0.6447 | 0 |  |  | 17 | 0.1414 | -0.1414 |
| zuma-beach-malibu-ca | V0_current | 9 | 0.6691 | -0.6691 | 0 |  |  | 9 | 0.8443 | -0.8443 |
| zuma-beach-malibu-ca | V1_decay_off | 9 | 0.6691 | -0.6691 | 0 |  |  | 9 | 0.8443 | -0.8443 |
| zuma-beach-malibu-ca | V2_decouple_buckets | 9 | 0.6691 | -0.6691 | 0 |  |  | 9 | 0.8443 | -0.8443 |
| zuma-beach-malibu-ca | V3_raw_om | 9 | 0.2056 | 0.2056 | 0 |  |  | 9 | 0.0308 | 0.0303 |
| jalama-beach-jalama-ca | V0_current | 9 | 0.689 | -0.689 | 0 |  |  | 9 | 0.4997 | -0.4997 |
| jalama-beach-jalama-ca | V1_decay_off | 9 | 0.689 | -0.689 | 0 |  |  | 9 | 0.4997 | -0.4997 |
| jalama-beach-jalama-ca | V2_decouple_buckets | 9 | 1.024 | -1.024 | 0 |  |  | 9 | 0.8347 | -0.8347 |
| jalama-beach-jalama-ca | V3_raw_om | 9 | 0.0922 | -0.0922 | 0 |  |  | 9 | 0.0971 | 0.0971 |
| el-segundo-beach-jetty-el-segundo-ca | V0_current | 9 | 0.3018 | -0.2924 | 0 |  |  | 9 | 0.3668 | -0.3668 |
| el-segundo-beach-jetty-el-segundo-ca | V1_decay_off | 9 | 0.3018 | -0.2924 | 0 |  |  | 9 | 0.3668 | -0.3668 |
| el-segundo-beach-jetty-el-segundo-ca | V2_decouple_buckets | 9 | 0.5434 | -0.5434 | 0 |  |  | 9 | 0.6178 | -0.6178 |
| el-segundo-beach-jetty-el-segundo-ca | V3_raw_om | 9 | 0.0811 | 0.0122 | 0 |  |  | 9 | 0.0621 | -0.0621 |
| goldenwest | V0_current | 9 | 0.5193 | -0.5193 | 0 |  |  | 9 | 0.4737 | -0.4737 |
| goldenwest | V1_decay_off | 9 | 0.5193 | -0.5193 | 0 |  |  | 9 | 0.4737 | -0.4737 |
| goldenwest | V2_decouple_buckets | 9 | 0.445 | -0.445 | 0 |  |  | 9 | 0.3993 | -0.3993 |
| goldenwest | V3_raw_om | 9 | 0.1733 | -0.0844 | 0 |  |  | 9 | 0.0388 | -0.0388 |
| hb-cliffs | V0_current | 9 | 0.3549 | -0.3549 | 0 |  |  | 9 | 0.4748 | -0.4748 |
| hb-cliffs | V1_decay_off | 9 | 0.3549 | -0.3549 | 0 |  |  | 9 | 0.4748 | -0.4748 |
| hb-cliffs | V2_decouple_buckets | 9 | 0.4604 | -0.4604 | 0 |  |  | 9 | 0.5803 | -0.5803 |
| hb-cliffs | V3_raw_om | 9 | 0.1267 | 0.0822 | 0 |  |  | 9 | 0.0377 | -0.0377 |
| hermosa-pier | V0_current | 9 | 0.3589 | -0.3589 | 0 |  |  | 9 | 0.2316 | -0.2316 |
| hermosa-pier | V1_decay_off | 9 | 0.3589 | -0.3589 | 0 |  |  | 9 | 0.2316 | -0.2316 |
| hermosa-pier | V2_decouple_buckets | 9 | 0.6939 | -0.6939 | 0 |  |  | 9 | 0.5666 | -0.5666 |
| hermosa-pier | V3_raw_om | 9 | 0.2122 | -0.2122 | 0 |  |  | 9 | 0.0849 | -0.0849 |
| horseshoe | V0_current | 9 | 0.2987 | 0.2987 | 0 |  |  | 9 | 0.3002 | -0.3002 |
| horseshoe | V1_decay_off | 9 | 0.2987 | 0.2987 | 0 |  |  | 9 | 0.3002 | -0.3002 |
| horseshoe | V2_decouple_buckets | 9 | 0.6541 | 0.6541 | 0 |  |  | 9 | 0.1786 | 0.0552 |
| horseshoe | V3_raw_om | 9 | 0.6689 | 0.6689 | 0 |  |  | 9 | 0.07 | 0.07 |
| hotel-del-coronado | V0_current | 9 | 0.2702 | -0.2702 | 0 |  |  | 9 | 0.8363 | -0.8363 |
| hotel-del-coronado | V1_decay_off | 9 | 0.2702 | -0.2702 | 0 |  |  | 9 | 0.8363 | -0.8363 |
| hotel-del-coronado | V2_decouple_buckets | 9 | 0.2702 | -0.2702 | 0 |  |  | 9 | 0.8363 | -0.8363 |
| hotel-del-coronado | V3_raw_om | 9 | 0.5889 | 0.5889 | 0 |  |  | 9 | 0.0228 | 0.0228 |
| salt-creek | V0_current | 9 | 0.3987 | -0.2827 | 0 |  |  | 9 | 0.278 | -0.1389 |
| salt-creek | V1_decay_off | 9 | 0.3987 | -0.2827 | 0 |  |  | 9 | 0.278 | -0.1389 |
| salt-creek | V2_decouple_buckets | 9 | 0.3753 | -0.2593 | 0 |  |  | 9 | 0.2547 | -0.1156 |
| salt-creek | V3_raw_om | 9 | 0.1167 | -0.11 | 0 |  |  | 9 | 0.0338 | 0.0338 |
| river-jetties | V0_current | 9 | 0.5096 | -0.5096 | 0 |  |  | 9 | 0.5148 | -0.5148 |
| river-jetties | V1_decay_off | 9 | 0.3164 | -0.316 | 0 |  |  | 9 | 0.3212 | -0.3212 |
| river-jetties | V2_decouple_buckets | 9 | 0.2599 | -0.2386 | 0 |  |  | 9 | 0.2438 | -0.2438 |
| river-jetties | V3_raw_om | 9 | 0.1511 | 0.0133 | 0 |  |  | 9 | 0.0177 | 0.0081 |
| huntington-state-beach | V0_current | 9 | 0.3164 | -0.316 | 0 |  |  | 9 | 0.3212 | -0.3212 |
| huntington-state-beach | V1_decay_off | 9 | 0.3164 | -0.316 | 0 |  |  | 9 | 0.3212 | -0.3212 |
| huntington-state-beach | V2_decouple_buckets | 9 | 0.2327 | -0.1842 | 0 |  |  | 9 | 0.1894 | -0.1894 |
| huntington-state-beach | V3_raw_om | 9 | 0.1511 | 0.0133 | 0 |  |  | 9 | 0.0177 | 0.0081 |
| la-jolla-shores | V0_current | 9 | 0.258 | 0.258 | 0 |  |  | 9 | 0.3083 | -0.3083 |
| la-jolla-shores | V1_decay_off | 9 | 0.1864 | 0.1864 | 0 |  |  | 9 | 0.3799 | -0.3799 |
| la-jolla-shores | V2_decouple_buckets | 9 | 0.3521 | 0.3521 | 0 |  |  | 9 | 0.2142 | -0.2142 |
| la-jolla-shores | V3_raw_om | 9 | 0.6067 | 0.6067 | 0 |  |  | 9 | 0.0403 | 0.0403 |
| doheny-state-beach | V0_current | 9 | 0.4879 | -0.4879 | 0 |  |  | 9 | 0.3088 | -0.3088 |
| doheny-state-beach | V1_decay_off | 9 | 0.4879 | -0.4879 | 0 |  |  | 9 | 0.3088 | -0.3088 |
| doheny-state-beach | V2_decouple_buckets | 9 | 0.7619 | -0.7619 | 0 |  |  | 9 | 0.5828 | -0.5828 |
| doheny-state-beach | V3_raw_om | 9 | 0.1844 | -0.1356 | 0 |  |  | 9 | 0.0436 | 0.0436 |
| rincon-carpinteria-ca | V0_current | 9 | 1.228 | -1.228 | 0 |  |  | 9 | 0.6592 | -0.6592 |
| rincon-carpinteria-ca | V1_decay_off | 9 | 1.106 | -1.106 | 0 |  |  | 9 | 0.5372 | -0.5372 |
| rincon-carpinteria-ca | V2_decouple_buckets | 9 | 1.228 | -1.228 | 0 |  |  | 9 | 0.6592 | -0.6592 |
| rincon-carpinteria-ca | V3_raw_om | 9 | 0.72 | -0.72 | 0 |  |  | 9 | 0.1512 | -0.1512 |
| malibu-first-point-surfrider | V0_current | 9 | 0.4251 | -0.4251 | 0 |  |  | 9 | 0.5966 | -0.5966 |
| malibu-first-point-surfrider | V1_decay_off | 9 | 0.1501 | -0.1501 | 0 |  |  | 9 | 0.3216 | -0.3216 |
| malibu-first-point-surfrider | V2_decouple_buckets | 9 | 0.4551 | -0.4551 | 0 |  |  | 9 | 0.6266 | -0.6266 |
| malibu-first-point-surfrider | V3_raw_om | 9 | 0.1989 | 0.1989 | 0 |  |  | 9 | 0.0301 | 0.0274 |
| pipes | V0_current | 9 | 0.0533 | -0.0116 | 0 |  |  | 9 | 0.2594 | -0.2594 |
| pipes | V1_decay_off | 9 | 0.0533 | -0.0116 | 0 |  |  | 9 | 0.2594 | -0.2594 |
| pipes | V2_decouple_buckets | 9 | 0.1064 | -0.1064 | 0 |  |  | 9 | 0.3543 | -0.3543 |
| pipes | V3_raw_om | 9 | 0.2678 | 0.2678 | 0 |  |  | 9 | 0.0226 | 0.0199 |
| marine-street-beach | V0_current | 9 | 0.2987 | 0.2987 | 0 |  |  | 9 | 0.2677 | -0.2677 |
| marine-street-beach | V1_decay_off | 9 | 0.2987 | 0.2987 | 0 |  |  | 9 | 0.2677 | -0.2677 |
| marine-street-beach | V2_decouple_buckets | 9 | 0.7016 | 0.7016 | 0 |  |  | 9 | 0.2423 | 0.1352 |
| marine-street-beach | V3_raw_om | 9 | 0.6067 | 0.6067 | 0 |  |  | 9 | 0.0403 | 0.0403 |
| pacific-beach | V0_current | 9 | 0.1799 | 0.1799 | 0 |  |  | 9 | 0.419 | -0.419 |
| pacific-beach | V1_decay_off | 9 | 0.1799 | 0.1799 | 0 |  |  | 9 | 0.419 | -0.419 |
| pacific-beach | V2_decouple_buckets | 9 | 0.5931 | 0.5931 | 0 |  |  | 9 | 0.1447 | -0.0058 |
| pacific-beach | V3_raw_om | 9 | 0.6689 | 0.6689 | 0 |  |  | 9 | 0.07 | 0.07 |
| mission-beach | V0_current | 9 | 0.5409 | -0.5409 | 0 |  |  | 9 | 0.4664 | -0.4664 |
| mission-beach | V1_decay_off | 9 | 0.5409 | -0.5409 | 0 |  |  | 9 | 0.4664 | -0.4664 |
| mission-beach | V2_decouple_buckets | 9 | 0.6289 | -0.6289 | 0 |  |  | 9 | 0.5544 | -0.5544 |
| mission-beach | V3_raw_om | 9 | 0.0822 | -0.0044 | 0 |  |  | 9 | 0.07 | 0.07 |
| mission-beach-central | V0_current | 9 | 0.5916 | -0.5916 | 0 |  |  | 9 | 0.5171 | -0.5171 |
| mission-beach-central | V1_decay_off | 9 | 0.5916 | -0.5916 | 0 |  |  | 9 | 0.5171 | -0.5171 |
| mission-beach-central | V2_decouple_buckets | 9 | 0.6664 | -0.6664 | 0 |  |  | 9 | 0.592 | -0.592 |
| mission-beach-central | V3_raw_om | 9 | 0.0822 | -0.0044 | 0 |  |  | 9 | 0.07 | 0.07 |
| osprey-point | V0_current | 9 | 0.6842 | -0.6842 | 0 |  |  | 9 | 0.5618 | -0.5618 |
| osprey-point | V1_decay_off | 9 | 0.6842 | -0.6842 | 0 |  |  | 9 | 0.5618 | -0.5618 |
| osprey-point | V2_decouple_buckets | 9 | 0.8266 | -0.8266 | 0 |  |  | 9 | 0.7041 | -0.7041 |
| osprey-point | V3_raw_om | 9 | 0.0811 | -0.0367 | 0 |  |  | 9 | 0.0858 | 0.0858 |
| oceanside-pier | V0_current | 9 | 0.3753 | -0.2593 | 0 |  |  | 9 | 0.2502 | -0.1064 |
| oceanside-pier | V1_decay_off | 9 | 0.1252 | -0.0054 | 0 |  |  | 9 | 0.1474 | 0.1474 |
| oceanside-pier | V2_decouple_buckets | 9 | 0.1419 | -0.0221 | 0 |  |  | 9 | 0.1308 | 0.1308 |
| oceanside-pier | V3_raw_om | 9 | 0.13 | -0.1278 | 0 |  |  | 9 | 0.0251 | 0.0251 |
| oceanside-harbor | V0_current | 9 | 0.4302 | -0.24 | 0 |  |  | 9 | 0.2773 | -0.0793 |
| oceanside-harbor | V1_decay_off | 9 | 0.1863 | 0.0039 | 0 |  |  | 9 | 0.1646 | 0.1646 |
| oceanside-harbor | V2_decouple_buckets | 9 | 0.1796 | 0.1396 | 0 |  |  | 9 | 0.3002 | 0.3002 |
| oceanside-harbor | V3_raw_om | 9 | 0.1378 | -0.1356 | 0 |  |  | 9 | 0.0251 | 0.0251 |
| san-onofre-state-beach | V0_current | 9 | 0.4837 | -0.4357 | 0 |  |  | 9 | 0.3677 | -0.2988 |
| san-onofre-state-beach | V1_decay_off | 9 | 0.1757 | -0.1277 | 0 |  |  | 9 | 0.0603 | 0.0092 |
| san-onofre-state-beach | V2_decouple_buckets | 9 | 0.199 | -0.151 | 0 |  |  | 9 | 0.083 | -0.0141 |
| san-onofre-state-beach | V3_raw_om | 9 | 0.1033 | -0.0967 | 0 |  |  | 9 | 0.0402 | 0.0402 |
| ocean-beach-sloat-san-francisco-ca | V0_current | 9 | 1.0696 | -1.0696 | 0 |  |  | 9 | 0.6764 | -0.6764 |
| ocean-beach-sloat-san-francisco-ca | V1_decay_off | 9 | 1.0696 | -1.0696 | 0 |  |  | 9 | 0.6764 | -0.6764 |
| ocean-beach-sloat-san-francisco-ca | V2_decouple_buckets | 9 | 1.1616 | -1.1616 | 0 |  |  | 9 | 0.7684 | -0.7684 |
| ocean-beach-sloat-san-francisco-ca | V3_raw_om | 9 | 0.3222 | -0.3222 | 0 |  |  | 9 | 0.0709 | 0.0709 |
| scripps | V0_current | 9 | 0.5588 | 0.5588 | 0 |  |  | 9 | 0.1628 | -0.0141 |
| scripps | V1_decay_off | 9 | 0.4406 | 0.4406 | 0 |  |  | 9 | 0.1323 | -0.1323 |
| scripps | V2_decouple_buckets | 9 | 0.7727 | 0.7727 | 0 |  |  | 9 | 0.3767 | 0.1998 |
| scripps | V3_raw_om | 9 | 0.61 | 0.61 | 0 |  |  | 9 | 0.0371 | 0.0371 |
| coronado-north-jetty | V0_current | 9 | 0.2702 | -0.2702 | 0 |  |  | 9 | 0.8363 | -0.8363 |
| coronado-north-jetty | V1_decay_off | 9 | 0.2702 | -0.2702 | 0 |  |  | 9 | 0.8363 | -0.8363 |
| coronado-north-jetty | V2_decouple_buckets | 9 | 0.2702 | -0.2702 | 0 |  |  | 9 | 0.8363 | -0.8363 |
| coronado-north-jetty | V3_raw_om | 9 | 0.5889 | 0.5889 | 0 |  |  | 9 | 0.0228 | 0.0228 |
| windansea | V0_current | 9 | 0.2987 | 0.2987 | 0 |  |  | 9 | 0.3002 | -0.3002 |
| windansea | V1_decay_off | 9 | 0.2987 | 0.2987 | 0 |  |  | 9 | 0.3002 | -0.3002 |
| windansea | V2_decouple_buckets | 9 | 0.7016 | 0.7016 | 0 |  |  | 9 | 0.226 | 0.1027 |
| windansea | V3_raw_om | 9 | 0.6689 | 0.6689 | 0 |  |  | 9 | 0.07 | 0.07 |
| trails | V0_current | 9 | 0.1197 | 0.0954 | 0 |  |  | 9 | 0.1312 | 0.1312 |
| trails | V1_decay_off | 9 | 0.1197 | 0.0954 | 0 |  |  | 9 | 0.1312 | 0.1312 |
| trails | V2_decouple_buckets | 9 | 0.1227 | 0.048 | 0 |  |  | 9 | 0.0838 | 0.0838 |
| trails | V3_raw_om | 9 | 0.0667 | 0.0044 | 0 |  |  | 9 | 0.0402 | 0.0402 |
| tourmaline-surf-park | V0_current | 9 | 0.0918 | -0.01 | 0 |  |  | 9 | 0.6089 | -0.6089 |
| tourmaline-surf-park | V1_decay_off | 9 | 0.4403 | 0.4403 | 0 |  |  | 9 | 0.1586 | -0.1586 |
| tourmaline-surf-park | V2_decouple_buckets | 9 | 0.7017 | 0.7017 | 0 |  |  | 9 | 0.3208 | 0.1028 |
| tourmaline-surf-park | V3_raw_om | 9 | 0.6689 | 0.6689 | 0 |  |  | 9 | 0.07 | 0.07 |
| the-wedge | V0_current | 9 | 0.1249 | -0.0696 | 0 |  |  | 9 | 0.1389 | -0.0678 |
| the-wedge | V1_decay_off | 9 | 0.1946 | -0.1941 | 0 |  |  | 9 | 0.2294 | -0.1923 |
| the-wedge | V2_decouple_buckets | 9 | 0.1246 | -0.0052 | 0 |  |  | 9 | 0.0948 | -0.0034 |
| the-wedge | V3_raw_om | 9 | 0.1511 | -0 | 0 |  |  | 9 | 0.0138 | 0.0018 |
| shipwrecks-coronado-ca | V0_current | 9 | 0.2702 | -0.2702 | 0 |  |  | 9 | 0.8363 | -0.8363 |
| shipwrecks-coronado-ca | V1_decay_off | 9 | 0.2702 | -0.2702 | 0 |  |  | 9 | 0.8363 | -0.8363 |
| shipwrecks-coronado-ca | V2_decouple_buckets | 9 | 0.2702 | -0.2702 | 0 |  |  | 9 | 0.8363 | -0.8363 |
| shipwrecks-coronado-ca | V3_raw_om | 9 | 0.5889 | 0.5889 | 0 |  |  | 9 | 0.0228 | 0.0228 |
| carlsbad-state-beach | V0_current | 9 | 0.2126 | -0.0019 | 0 |  |  | 9 | 0.1619 | 0.1292 |
| carlsbad-state-beach | V1_decay_off | 9 | 0.2126 | -0.0019 | 0 |  |  | 9 | 0.1619 | 0.1292 |
| carlsbad-state-beach | V2_decouple_buckets | 9 | 0.1742 | 0.1676 | 0 |  |  | 9 | 0.2987 | 0.2987 |
| carlsbad-state-beach | V3_raw_om | 9 | 0.0944 | -0.0856 | 0 |  |  | 9 | 0.0456 | 0.0456 |
| sunset-cliffs-garbage-san-diego-ca | V0_current | 9 | 0.6909 | -0.6909 | 0 |  |  | 9 | 0.5684 | -0.5684 |
| sunset-cliffs-garbage-san-diego-ca | V1_decay_off | 9 | 0.6909 | -0.6909 | 0 |  |  | 9 | 0.5684 | -0.5684 |
| sunset-cliffs-garbage-san-diego-ca | V2_decouple_buckets | 9 | 0.8439 | -0.8439 | 0 |  |  | 9 | 0.7214 | -0.7214 |
| sunset-cliffs-garbage-san-diego-ca | V3_raw_om | 9 | 0.0811 | -0.0367 | 0 |  |  | 9 | 0.0858 | 0.0858 |
| corona-del-mar | V0_current | 9 | 0.1946 | -0.1941 | 0 |  |  | 9 | 0.2294 | -0.1923 |
| corona-del-mar | V1_decay_off | 9 | 0.1946 | -0.1941 | 0 |  |  | 9 | 0.2294 | -0.1923 |
| corona-del-mar | V2_decouple_buckets | 9 | 0.3572 | -0.3572 | 0 |  |  | 9 | 0.3554 | -0.3554 |
| corona-del-mar | V3_raw_om | 9 | 0.1511 | -0 | 0 |  |  | 9 | 0.0138 | 0.0018 |
| sunset-cliffs-luscombs-san-diego-ca | V0_current | 9 | 0.7219 | -0.7219 | 0 |  |  | 9 | 0.5994 | -0.5994 |
| sunset-cliffs-luscombs-san-diego-ca | V1_decay_off | 9 | 0.7219 | -0.7219 | 0 |  |  | 9 | 0.5994 | -0.5994 |
| sunset-cliffs-luscombs-san-diego-ca | V2_decouple_buckets | 9 | 0.8739 | -0.8739 | 0 |  |  | 9 | 0.7514 | -0.7514 |
| sunset-cliffs-luscombs-san-diego-ca | V3_raw_om | 9 | 0.0811 | -0.0367 | 0 |  |  | 9 | 0.0858 | 0.0858 |
| county-line-malibu-ca | V0_current | 9 | 1.0038 | -1.0038 | 0 |  |  | 9 | 0.692 | -0.692 |
| county-line-malibu-ca | V1_decay_off | 9 | 0.8208 | -0.8208 | 0 |  |  | 9 | 0.509 | -0.509 |
| county-line-malibu-ca | V2_decouple_buckets | 9 | 1.0338 | -1.0338 | 0 |  |  | 9 | 0.722 | -0.722 |
| county-line-malibu-ca | V3_raw_om | 9 | 0.3978 | -0.3089 | 0 |  |  | 9 | 0.0147 | 0.0029 |
| crystal-cove | V0_current | 9 | 0.2619 | -0.2619 | 0 |  |  | 9 | 0.2887 | -0.2856 |
| crystal-cove | V1_decay_off | 9 | 0.2619 | -0.2619 | 0 |  |  | 9 | 0.2887 | -0.2856 |
| crystal-cove | V2_decouple_buckets | 9 | 0.4516 | -0.4516 | 0 |  |  | 9 | 0.4752 | -0.4752 |
| crystal-cove | V3_raw_om | 9 | 0.1467 | 0.0489 | 0 |  |  | 9 | 0.0254 | 0.0252 |
| crystal-pier | V0_current | 9 | 0.2576 | -0.1082 | 0 |  |  | 9 | 0.7071 | -0.7071 |
| crystal-pier | V1_decay_off | 9 | 0.1661 | 0.1661 | 0 |  |  | 9 | 0.4328 | -0.4328 |
| crystal-pier | V2_decouple_buckets | 9 | 0.5931 | 0.5931 | 0 |  |  | 9 | 0.1447 | -0.0058 |
| crystal-pier | V3_raw_om | 9 | 0.6689 | 0.6689 | 0 |  |  | 9 | 0.07 | 0.07 |

## Segments by decay bucket

| segment | variant | obs n | obs MAE | obs bias | session n | session MAE | session bias | v5 n | v5 MAE | v5 bias |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0.8-1.05 | V0_current | 610 | 0.3979 | -0.2873 | 0 |  |  | 610 | 0.3389 | -0.3059 |
| 0.8-1.05 | V1_decay_off | 610 | 0.3979 | -0.2873 | 0 |  |  | 610 | 0.3389 | -0.3059 |
| 0.8-1.05 | V2_decouple_buckets | 610 | 0.4967 | -0.299 | 0 |  |  | 610 | 0.4186 | -0.3176 |
| 0.8-1.05 | V3_raw_om | 610 | 0.2365 | 0.0408 | 0 |  |  | 610 | 0.0485 | 0.0222 |
| 0.5-0.8 | V0_current | 110 | 0.5861 | -0.5571 | 0 |  |  | 110 | 0.4938 | -0.4602 |
| 0.5-0.8 | V1_decay_off | 110 | 0.3563 | -0.3223 | 0 |  |  | 110 | 0.2936 | -0.2254 |
| 0.5-0.8 | V2_decouple_buckets | 110 | 0.4366 | -0.3228 | 0 |  |  | 110 | 0.3886 | -0.2259 |
| 0.5-0.8 | V3_raw_om | 110 | 0.2185 | -0.0886 | 0 |  |  | 110 | 0.036 | 0.0083 |
| >1.05 | V0_current | 39 | 0.3358 | 0.1924 | 0 |  |  | 39 | 0.1987 | -0.1477 |
| >1.05 | V1_decay_off | 39 | 0.305 | 0.0837 | 0 |  |  | 39 | 0.2649 | -0.2563 |
| >1.05 | V2_decouple_buckets | 39 | 0.5624 | 0.3651 | 0 |  |  | 39 | 0.3701 | 0.025 |
| >1.05 | V3_raw_om | 39 | 0.4149 | 0.3697 | 0 |  |  | 39 | 0.0324 | 0.0297 |
| <0.5 | V0_current | 35 | 0.2405 | -0.1749 | 0 |  |  | 35 | 0.6357 | -0.6357 |
| <0.5 | V1_decay_off | 35 | 0.4001 | 0.2638 | 0 |  |  | 35 | 0.2194 | -0.1969 |
| <0.5 | V2_decouple_buckets | 35 | 0.6991 | 0.528 | 0 |  |  | 35 | 0.309 | 0.0673 |
| <0.5 | V3_raw_om | 35 | 0.5446 | 0.5354 | 0 |  |  | 35 | 0.0747 | 0.0747 |

## Segments by period bucket

| segment | variant | obs n | obs MAE | obs bias | session n | session MAE | session bias | v5 n | v5 MAE | v5 bias |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0-8s | V0_current | 789 | 0.411 | -0.2925 | 0 |  |  | 789 | 0.3655 | -0.3328 |
| 0-8s | V1_decay_off | 789 | 0.3846 | -0.2457 | 0 |  |  | 789 | 0.3224 | -0.286 |
| 0-8s | V2_decouple_buckets | 789 | 0.4967 | -0.2277 | 0 |  |  | 789 | 0.405 | -0.268 |
| 0-8s | V3_raw_om | 789 | 0.2564 | 0.0628 | 0 |  |  | 789 | 0.0468 | 0.0225 |
| 8-12s | V0_current | 5 | 0.88 | -0.88 | 0 |  |  | 5 | 0.5298 | -0.5298 |
| 8-12s | V1_decay_off | 5 | 0.88 | -0.88 | 0 |  |  | 5 | 0.5298 | -0.5298 |
| 8-12s | V2_decouple_buckets | 5 | 1.1056 | -1.1056 | 0 |  |  | 5 | 0.7554 | -0.7554 |
| 8-12s | V3_raw_om | 5 | 0.25 | -0.25 | 0 |  |  | 5 | 0.1002 | 0.1002 |

## Segments by forecast-horizon bucket

| segment | variant | obs n | obs MAE | obs bias | session n | session MAE | session bias | v5 n | v5 MAE | v5 bias |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 6-24 | V0_current | 554 | 0.4417 | -0.3342 | 0 |  |  | 554 | 0.3537 | -0.3276 |
| 6-24 | V1_decay_off | 554 | 0.4121 | -0.2812 | 0 |  |  | 554 | 0.3051 | -0.2746 |
| 6-24 | V2_decouple_buckets | 554 | 0.5282 | -0.2495 | 0 |  |  | 554 | 0.3916 | -0.2429 |
| 6-24 | V3_raw_om | 554 | 0.2577 | 0.0157 | 0 |  |  | 554 | 0.0465 | 0.0223 |
| 0-6 | V0_current | 235 | 0.336 | -0.1911 | 0 |  |  | 235 | 0.392 | -0.3436 |
| 0-6 | V1_decay_off | 235 | 0.3167 | -0.1588 | 0 |  |  | 235 | 0.3618 | -0.3113 |
| 0-6 | V2_decouple_buckets | 235 | 0.423 | -0.1769 | 0 |  |  | 235 | 0.4387 | -0.3294 |
| 0-6 | V3_raw_om | 235 | 0.2461 | 0.1808 | 0 |  |  | 235 | 0.0465 | 0.0283 |
| 24-72 | V0_current | 5 | 1.017 | -1.017 | 0 |  |  | 5 | 0.5944 | -0.5944 |
| 24-72 | V1_decay_off | 5 | 1.017 | -1.017 | 0 |  |  | 5 | 0.5944 | -0.5944 |
| 24-72 | V2_decouple_buckets | 5 | 1.078 | -1.078 | 0 |  |  | 5 | 0.6554 | -0.6554 |
| 24-72 | V3_raw_om | 5 | 0.578 | -0.578 | 0 |  |  | 5 | 0.1554 | -0.1554 |

## Worst forecast-horizon under-display rows (V0 vs observed)

| beach | horizon | source | display/raw | observed | V0 | V1 | V2 | OM | v5 | period | decay |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rincon-carpinteria-ca | 12 | model_swell | 0.5067 | 1.63 | 0.152 | 0.274 | 0.152 | 0.78 | 0.868 | 5 | 0.6 |
| county-line-malibu-ca | 24 | model_swell | 0.4492 | 1.7 | 0.274 | 0.457 | 0.244 | 0.9 | 0.93 | 6 | 0.6 |
| county-line-malibu-ca | 12 | model_swell | 0.4492 | 1.7 | 0.274 | 0.457 | 0.244 | 1 | 0.982 | 5 | 0.6 |
| mondos-beach-ventura-ca | 9 | model_swell | 0.8133 | 1.63 | 0.244 | 0.244 | 0.152 | 0.78 | 0.868 | 5 | 1 |
| emma-wood-ventura-ca | 12 | model_swell | 0.8133 | 1.63 | 0.244 | 0.244 | 0.152 | 0.76 | 0.859 | 5 | 1 |
| rincon-carpinteria-ca | 24 | model_swell | 0.5067 | 1.52 | 0.152 | 0.274 | 0.152 | 0.58 | 0.773 | 6 | 0.6 |
| ocean-beach-sloat-san-francisco-ca | 24 | model_swell | 1.22 | 1.71 | 0.366 | 0.366 | 0.274 | 1.2 | 1.096 | 8 | 1 |
| county-line-malibu-ca | 6 | model_swell | 0.4492 | 1.6 | 0.274 | 0.457 | 0.244 | 1 | 0.982 | 5 | 0.6 |
| rincon-carpinteria-ca | 15 | model_swell | 0.5067 | 1.47 | 0.152 | 0.274 | 0.152 | 0.72 | 0.84 | 5 | 0.6 |
| rincon-carpinteria-ca | 21 | model_swell | 0.5067 | 1.46 | 0.152 | 0.274 | 0.152 | 0.6 | 0.783 | 6 | 0.6 |
| emma-wood-ventura-ca | 24 | model_swell | 0.71 | 1.52 | 0.213 | 0.213 | 0.152 | 0.62 | 0.792 | 6 | 1 |
| rincon-carpinteria-ca | 18 | model_swell | 0.5067 | 1.44 | 0.152 | 0.274 | 0.152 | 0.66 | 0.811 | 6 | 0.6 |
| solimar-reef-ventura-ca | 9 | model_swell | 1.22 | 1.63 | 0.366 | 0.366 | 0.152 | 0.78 | 0.868 | 5 | 1 |
| rincon-carpinteria-ca | 9 | model_swell | 0.5067 | 1.41 | 0.152 | 0.274 | 0.152 | 0.76 | 0.859 | 6 | 0.6 |
| emma-wood-ventura-ca | 21 | model_swell | 0.71 | 1.47 | 0.213 | 0.213 | 0.152 | 0.62 | 0.792 | 6 | 1 |
| emma-wood-ventura-ca | 27 | model_swell | 0.71 | 1.47 | 0.213 | 0.213 | 0.152 | 0.64 | 0.802 | 5 | 1 |
| emma-wood-ventura-ca | 15 | model_swell | 0.71 | 1.47 | 0.213 | 0.213 | 0.152 | 0.72 | 0.84 | 6 | 1 |
| emma-wood-ventura-ca | 21 | model_swell | 0.71 | 1.46 | 0.213 | 0.213 | 0.152 | 0.64 | 0.802 | 6 | 1 |
| emma-wood-ventura-ca | 18 | model_swell | 0.71 | 1.44 | 0.213 | 0.213 | 0.152 | 0.66 | 0.811 | 6 | 1 |
| county-line-malibu-ca | 18 | model_swell | 0.4492 | 1.5 | 0.274 | 0.457 | 0.244 | 0.96 | 0.961 | 6 | 0.6 |
| county-line-malibu-ca | 0 | model_swell | 0.4492 | 1.5 | 0.274 | 0.457 | 0.244 | 0.96 | 0.961 | 6 | 0.6 |
| mondos-beach-ventura-ca | 12 | model_swell | 0.8133 | 1.47 | 0.244 | 0.244 | 0.152 | 0.74 | 0.849 | 5 | 1 |
| mondos-beach-ventura-ca | 18 | model_swell | 0.8133 | 1.46 | 0.244 | 0.244 | 0.152 | 0.64 | 0.802 | 6 | 1 |
| mondos-beach-ventura-ca | 15 | model_swell | 0.8133 | 1.44 | 0.244 | 0.244 | 0.152 | 0.7 | 0.83 | 6 | 1 |
| emma-wood-ventura-ca | 9 | model_swell | 0.8133 | 1.41 | 0.244 | 0.244 | 0.152 | 0.78 | 0.868 | 5 | 1 |

## Overshoot guard

Flag means the variant exceeds both observed_m and session face truth on at least 10% of session-joinable rows with mean excess >0.05 m. When session truth is absent, `watch` marks variants that are above offshore observed_m on at least half of rows; that is not automatically bad because surf face should usually be at-or-above offshore Hs.

| variant | obs n | rate above observed | session n | rate above obs+session | mean excess above obs+session m | status |
| --- | --- | --- | --- | --- | --- | --- |
| V0_current | 794 | 0.2254 | 0 |  |  | ok |
| V1_decay_off | 794 | 0.2569 | 0 |  |  | ok |
| V2_decouple_buckets | 794 | 0.3199 | 0 |  |  | ok |
| V3_raw_om | 794 | 0.4975 | 0 |  |  | ok |

## De-amplifier-beach controls (sub-1.0 shoaling buckets)

Direction of change is V2 minus V0 on model_swell rows. These controls verify that decoupling calibrated buckets can lower, not raise, beaches whose empirical buckets are below 1.0.

| beach | n | min bucket | V0 avg | V2 avg | delta | direction |
| --- | --- | --- | --- | --- | --- | --- |
| 54th-street-newport-beach-ca | 7 | 0.87 | 0.732 | 0.61 | -0.122 | lower |
| agate-street | 7 | 0.63 | 0.6924 | 0.488 | -0.2044 | lower |
| andrew-molera-river-mouth-big-sur-ca | 2 | 0.66 | 0.671 | 0.488 | -0.183 | lower |
| avalanche | 6 | 0.96 | 0.671 | 0.5892 | -0.0818 | lower |
| beacons | 5 | 0.96 | 1.097 | 1.006 | -0.091 | lower |
| brooks-street | 8 | 0.63 | 0.6552 | 0.488 | -0.1673 | lower |
| c-street-ventura-ca | 7 | 0.48 | 0.3483 | 0.152 | -0.1963 | lower |
| corona-del-mar | 9 | 0.81 | 0.7726 | 0.6094 | -0.1631 | lower |
| county-line-malibu-ca | 9 | 0.64 | 0.274 | 0.244 | -0.03 | lower |
| crystal-cove | 9 | 0.75 | 0.7048 | 0.5151 | -0.1897 | lower |
| doheny-state-beach | 9 | 0.49 | 0.701 | 0.427 | -0.274 | lower |
| el-porto-manhattan | 7 | 0.66 | 0.6274 | 0.3351 | -0.2923 | lower |
| el-segundo-beach-jetty-el-segundo-ca | 9 | 0.66 | 0.5287 | 0.2777 | -0.251 | lower |
| emma-wood-ventura-ca | 17 | 0.34 | 0.2472 | 0.152 | -0.0952 | lower |
| grandview | 6 | 0.95 | 1.097 | 1.006 | -0.091 | lower |
| hb-cliffs | 9 | 0.94 | 0.4473 | 0.3418 | -0.1056 | lower |
| hermosa-pier | 9 | 0.51 | 0.64 | 0.305 | -0.335 | lower |
| jalama-beach-jalama-ca | 9 | 0.48 | 0.701 | 0.366 | -0.335 | lower |
| malibu-first-point-surfrider | 9 | 0.6 | 0.396 | 0.366 | -0.03 | lower |
| manhattan-beach-pier-manhattan-beach-ca | 7 | 0.6 | 0.575 | 0.3137 | -0.2613 | lower |
| mission-beach | 7 | 0.85 | 0.5357 | 0.4226 | -0.1131 | lower |
| mission-beach-central | 7 | 0.85 | 0.488 | 0.3917 | -0.0963 | lower |
| mondos-beach-ventura-ca | 5 | 0.22 | 0.244 | 0.152 | -0.092 | lower |
| moonlight-state-beach | 5 | 0.98 | 1.067 | 1.006 | -0.061 | lower |
| new-break-nubes | 8 | 0.71 | 0.488 | 0.335 | -0.153 | lower |
| newport-56th-st | 7 | 0.87 | 0.732 | 0.61 | -0.122 | lower |
| newport-point | 8 | 0.87 | 0.732 | 0.61 | -0.122 | lower |
| ocean-beach | 6 | 0.96 | 0.792 | 0.671 | -0.121 | lower |
| ocean-beach-pier | 6 | 0.96 | 0.701 | 0.61 | -0.091 | lower |
| ocean-beach-sloat-san-francisco-ca | 9 | 0.6 | 0.366 | 0.274 | -0.092 | lower |
| osprey-point | 7 | 0.71 | 0.488 | 0.305 | -0.183 | lower |
| pipes | 7 | 0.79 | 0.732 | 0.61 | -0.122 | lower |
| poche-beach | 5 | 0.91 | 0.7076 | 0.671 | -0.0366 | lower |
| rockpile | 7 | 0.73 | 0.6796 | 0.488 | -0.1916 | lower |
| san-clemente-state-beach | 7 | 0.81 | 0.732 | 0.61 | -0.122 | lower |
| san-elijo-state-beach | 6 | 0.84 | 0.975 | 0.823 | -0.152 | lower |
| solana-beach | 6 | 0.92 | 1.036 | 0.914 | -0.122 | lower |
| solimar-reef-ventura-ca | 5 | 0.24 | 0.366 | 0.152 | -0.214 | lower |
| sunset-cliffs-garbage | 7 | 0.71 | 0.549 | 0.335 | -0.214 | lower |
| sunset-cliffs-garbage-san-diego-ca | 9 | 0.71 | 0.488 | 0.335 | -0.153 | lower |
| sunset-cliffs-luscombs-san-diego-ca | 9 | 0.71 | 0.457 | 0.305 | -0.152 | lower |
| tamarack | 7 | 0.71 | 1.097 | 0.884 | -0.213 | lower |
| terramar-point | 6 | 0.79 | 1.097 | 0.823 | -0.274 | lower |
| thalia-street | 8 | 0.63 | 0.7087 | 0.457 | -0.2517 | lower |
| trails | 7 | 0.88 | 1.097 | 1.036 | -0.061 | lower |
| venice-breakwater-los-angeles-ca | 7 | 0.58 | 0.732 | 0.366 | -0.366 | lower |
| 204s | 7 | 0.9 | 0.6401 | 0.6313 | -0.0089 | flat |
| big-jetty | 5 | 0.96 | 0.305 | 0.64 | 0.335 | higher |
| coronado-north-jetty | 9 | 0.73 | 0.152 | 0.152 | 0 | flat |
| doheny | 6 | 0.49 | 0.427 | 0.427 | 0 | flat |
| forster-st-oceanside | 7 | 0.94 | 1.0407 | 1.128 | 0.0873 | higher |
| hotel-del-coronado | 9 | 0.73 | 0.152 | 0.152 | 0 | flat |
| middles | 7 | 0.99 | 1.097 | 1.189 | 0.092 | higher |
| oceanside-pier | 7 | 0.99 | 0.762 | 1.067 | 0.305 | higher |
| rincon-carpinteria-ca | 9 | 0.22 | 0.152 | 0.152 | 0 | flat |
| san-clemente-pier-northside | 7 | 0.95 | 0.732 | 0.732 | 0 | flat |
| san-onofre-state-beach | 7 | 0.81 | 0.579 | 0.945 | 0.366 | higher |
| shipwrecks-coronado-ca | 9 | 0.73 | 0.152 | 0.152 | 0 | flat |
| t-street | 7 | 0.96 | 0.732 | 0.732 | 0 | flat |
| the-wedge | 9 | 0.99 | 0.8971 | 0.9614 | 0.0643 | higher |

## Recommendation

| lever comparison | V0 obs MAE | V1 obs MAE | V2 obs MAE | V3/raw-OM obs MAE | observed_m winner | V1 obs improvement | V2 obs improvement | V1 session MAE | V2 session MAE | recommended ship lever |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| model_swell | 0.4251 | 0.3969 | 0.5177 | 0.2525 | V3_raw_om | 0.0282 | -0.0926 |  |  | decay-off |

Recommended single ship lever: decay-off. Raw-OM is the observed_m winner, but observed_m is offshore Hs and no session face anchors joined in this window, so raw-OM is treated as the diagnostic Hs floor/reference rather than the first face-display ship. Among shippable transform levers, decay-off most reduces error versus V0 on the model_swell cohort while respecting the overshoot guard above. First-ship beaches need enough evidence and no overshoot under V1_decay_off:

| beach | n | V0 obs MAE | V1_decay_off obs MAE | MAE reduction | overshoot rate |
| --- | --- | --- | --- | --- | --- |
| malibu-first-point-surfrider | 9 | 0.4251 | 0.1501 | 0.275 | 0 |
| county-line-malibu-ca | 9 | 1.0038 | 0.8208 | 0.183 | 0 |
| rincon-carpinteria-ca | 9 | 1.228 | 1.106 | 0.122 | 0 |

## Limitations and caveats

- This is analysis only: no production change, no migration, no committed code.
- No DB writes were performed; queries were SELECT/COPY-only inside read-only transactions.
- observed_m is offshore CDIP significant wave height, not surf face. It is suitable for relative variant ranking, not absolute surf-face truth; the desired face display should be near-or-above Hs, so being above observed_m alone is not an overshoot failure.
- Session face anchors, where present, are anonymized beach/time aggregates only and are sparse; they should not override the broader observed/OM/v5 relative evidence.
- Decoupling uses the existing transformer by replaying rows as cdip_sig, which also follows the CDIP access/alignment behavior and decay suppression in the mirror.
- V0 scoring excludes 78 rows whose stored display does not replay under the current mirrored transform; those rows remain listed in the V0 gate section and are not used to choose the lever.
