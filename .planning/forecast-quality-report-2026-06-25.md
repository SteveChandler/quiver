# A. Code Path Inventory And Hypothesis Reset

Hypothesis challenged: the low forecast-height reports might be caused by a stale UI formatter, a missing DB write, or a single bad beach configuration. I tried to disprove that by tracing the active write path and checking production rows instead of trusting prior notes.

Code path evidence:
- Quiver writes display forecasts in `quiver/lib/services/forecast/forecast-builder.ts:601-611`, where `getWaveHeight(...)` computes the displayed string once and captures provenance.
- The snapshot writer stores the pre-offset display height plus provenance into `ml_predictions_log` at `quiver/lib/services/forecast/forecast-builder.ts:647-760`, including `raw_display_height_m`, `display_wave_source`, `display_raw_input_height_m`, OM fields, and v5 shadow fields.
- The active display row is then emitted as `wave_height` at `quiver/lib/services/forecast/forecast-builder.ts:832-839`; OM is co-located as raw model data, not the served display height, at `quiver/lib/services/forecast/forecast-builder.ts:856-869`.
- Source selection prefers nowcast, then CDIP significant height, then model swell, then CDIP swell, then model Hs in `quiver/lib/utils/wave-formatters.ts:416-508`.
- The generic scalar transform is `rawHeightFt * decay * BASE_SHOALING * periodFactor * directionFactor` at `quiver/lib/utils/wave-height-transformer.ts:433-445`.
- The calibrated shoaling short-circuit only fires when `source === 'cdip_sig'` or an explicitly allowed nowcast anchor; model sources are intentionally excluded at `quiver/lib/utils/wave-height-transformer.ts:416-431` and `quiver/lib/utils/wave-height-transformer.ts:695-707`.
- The decomposed path RMS-sums components after decay, period, access/alignment, and optional CDIP-only shoaling buckets at `quiver/lib/utils/wave-height-transformer.ts:854-980`.
- Seaside's Python mirror has the same constants and gates: period cap 1.2 at `seaside/scripts/face_height_model/transform.py:32-47`, scalar formula at `seaside/scripts/face_height_model/transform.py:463-491`, decomposed formula at `seaside/scripts/face_height_model/transform.py:494-583`, and final clamp/round to meters at `seaside/scripts/face_height_model/transform.py:586-611`.
- Seaside's active v5 calibration is a shadow comparator, not the served height: Quiver loads/logs v5 from `quiver/lib/services/forecast/calibration-v5.ts:200-289`, while Seaside mirrors it in `seaside/calibration.py:194-247`.

Database verification, purpose: prove which path production is currently using and avoid assuming code is deployed differently than stored data.

Read-only production checks returned:
- Active beaches: 321.
- Beaches with `shoaling_factors`: 117.
- Terrain-enabled beaches: 261.
- Beaches with `swell_access_factors`: 261.
- Beaches with non-neutral `deepwater_decay_factor`: 25.
- Recent `enhanced_forecasts` rows in the next 7 days: 47,955 across 321 beaches.
- Of those rows: 44,390 used `model_swell`, 3,269 used `cdip_sig`, 16,580 used `decomposed`, and 3,169 had calibrated shoaling fired.

Recent provenance distribution, purpose: challenge whether calibrated CDIP is commonly feeding the visible height:

| source | transform path | calibrated | rows |
|---|---:|---:|---:|
| model_swell | scalar_generic | false | 27,810 |
| model_swell | decomposed | false | 16,580 |
| cdip_sig | scalar_calibrated | true | 3,127 |
| blank/missing | blank | false | 145 |
| cdip_sig | scalar_generic | false | 142 |
| nowcast_anchor | scalar_generic | false | 109 |
| nowcast_anchor | scalar_calibrated | true | 42 |

Conclusion for reset: the current low-height hypothesis survives the first adversarial check. Production is overwhelmingly on model-swell paths where calibrated `shoaling_factors` are not allowed to fire. This does not yet prove the model path is wrong; it only narrows the likely chain to model-source transform factors rather than UI-only display or absent forecast writes.

# B. DB Sample Selection And Baseline Height Evidence

Hypothesis challenged: maybe only a few cherry-picked beaches look low, or raw model input is also tiny so the display is reasonable. I selected rows by objective predicates: production `enhanced_forecasts`, forecast_at between now and +7 days, source `model_swell`, raw input at least 2 ft, then sorted by display/raw ratio ascending.

Query purpose summary:
- Compare visible `wave_height` against the raw input in `raw_forecast.wave_height_provenance.raw_value_ft`.
- Separate model-swell rows from CDIP rows.
- Use public beach slugs/regions only; no user data was read or reported.

Representative low model-swell evidence:

| UTC slot | beach slug | region | display | raw input ft | display/raw | source | path | calibrated |
|---|---|---|---:|---:|---:|---|---|---|
| 06-29 18:00 | big-jetty | San Diego | 0.6 ft | 2.89 | 0.21 | model_swell | scalar_generic | false |
| 06-30 09:00 | big-jetty | San Diego | 0.6 ft | 2.69 | 0.22 | model_swell | decomposed | false |
| 06-30 00:00 | big-jetty | San Diego | 0.8 ft | 3.41 | 0.23 | model_swell | scalar_generic | false |
| 06-29 06:00 | tourmaline-surf-park | San Diego | 0.7 ft | 2.95 | 0.24 | model_swell | scalar_generic | false |
| 06-29 03:00 | big-jetty | San Diego | 0.9 ft | 3.74 | 0.24 | model_swell | scalar_generic | false |
| 06-29 00:00 | tourmaline-surf-park | San Diego | 0.9 ft | 3.67 | 0.24 | model_swell | scalar_generic | false |

Counter-sample, purpose: see whether the whole system always under-displays raw input. CDIP calibrated rows do not show the same collapse:

| UTC slot | beach slug | region | display | raw input ft | display/raw | source | path |
|---|---|---|---:|---:|---:|---|---|
| 06-26 00:00 | marine-street-beach | San Diego | 3.3 ft | 1.64 | 2.01 | cdip_sig | scalar_calibrated |
| 06-26 00:00 | windansea | San Diego | 3.3 ft | 1.64 | 2.01 | cdip_sig | scalar_calibrated |
| 06-26 00:00 | horseshoe | San Diego | 3.2 ft | 1.64 | 1.95 | cdip_sig | scalar_calibrated |
| 06-26 00:00 | crystal-pier | San Diego | 3.0 ft | 1.64 | 1.83 | cdip_sig | scalar_calibrated |
| 06-26 00:00 | lower-trestles | San Diego | 5.3 ft | 3.28 | 1.62 | cdip_sig | scalar_calibrated |

Baseline conclusion: the under-height symptom is not global formatting. It clusters where production uses `model_swell`, especially at terrain/decay configured beaches. Calibrated CDIP paths can amplify raw Hs by roughly 1.6-2.0x in the same production database.

# C. Factor Chain Reconstruction From Code And Data

Hypothesis challenged: the period cap alone might be eating height. I decomposed the chain into the terms that can reduce/amplify height: source gate, `shoaling_factors`, period factor, direction/access factor, deepwater decay, and component decomposition.

Code formula summary:
- Period factor is capped to [0.8, 1.2] in `quiver/lib/utils/wave-height-transformer.ts:212-216`; Seaside mirror at `seaside/scripts/face_height_model/transform.py:142-147`.
- Direction factor is neutral unless terrain is enabled and a 72-bin access array exists; when active it is `0.6 + access * 0.4` in `quiver/lib/utils/wave-height-transformer.ts:233-257`; Seaside mirror at `seaside/scripts/face_height_model/transform.py:150-160`.
- Deepwater decay is applied to every source except `cdip_sig` and `nowcast_anchor` in `quiver/lib/utils/wave-height-transformer.ts:437-445` and `quiver/lib/utils/wave-height-transformer.ts:703-707`.
- Decomposed model rows use terrain access instead of strict window alignment at `quiver/lib/utils/wave-height-transformer.ts:710-740`, then compute `faceI = component.heightFt * decay * perComponentFactor * accessFactor` at `quiver/lib/utils/wave-height-transformer.ts:933-952`.

Database reconstruction, purpose: pin which term actually reduces Big Jetty/Tourmaline-type rows.

Beach configuration sample:

| slug | region | terrain | shoaling_factors | access factors | center | halfwidth | decay | shoaling buckets |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| big-jetty | San Diego | true | true | true | 150 | 40 | 0.4 | 4 |
| tourmaline-surf-park | San Diego | true | true | true | 218 | 143 | 0.4 | 4 |
| lower-trestles | San Diego | true | true | true | 220 | 105 | 0.6 | 4 |
| marine-street-beach | San Diego | true | true | true | 290 | 150 | 1.0 | 4 |

Direction/access terms for representative directions:

| slug | direction | 5-degree bin | access | direction factor | decay |
|---|---:|---:|---:|---:|---:|
| big-jetty | 195 | 39 | 0.115 | 0.646 | 0.4 |
| big-jetty | 276 | 55 | 0.386 | 0.754 | 0.4 |
| big-jetty | 286 | 57 | 0.575 | 0.830 | 0.4 |
| tourmaline-surf-park | 197 | 39 | 0.924 | 0.970 | 0.4 |
| tourmaline-surf-park | 278 | 55 | 0.471 | 0.788 | 0.4 |
| marine-street-beach | 290 | 58 | 0.924 | 0.970 | 1.0 |

Big Jetty scalar sample, purpose: test whether the formula predicts the production collapse.

| UTC slot | display m | raw input m | period | period factor | direction | direction factor | decay | expected scalar factor | observed factor |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 06-29 12:00 | 0.244 | 0.740 | 10.1 | 1.005 | 195 | 0.646 | 0.4 | 0.260 | 0.330 |
| 06-29 18:00 | 0.213 | 0.880 | 10.6 | 1.030 | 276 | 0.754 | 0.4 | 0.311 | 0.242 |
| 06-30 00:00 | 0.244 | 0.860 | 10.8 | 1.040 | 278 | 0.754 | 0.4 | 0.314 | 0.284 |

Interpretation:
- Period is not eating these rows; it is slightly above neutral, around 1.00-1.04.
- Direction/access reduces Big Jetty to 0.65-0.83, material but not enough to explain 0.21-0.33 by itself.
- `deepwater_decay_factor=0.4` is the largest single reducer. It turns a near-neutral 1.0 period factor and moderate 0.65-0.83 direction factor into a 0.26-0.34 scalar multiplier.
- Missing calibrated shoaling in the model path matters because Big Jetty has four shoaling buckets but source `model_swell` forces generic/decomposed non-calibrated behavior. That means the CDIP-calibrated bucket factors never counteract decay on those rows.

# D. Period Cap Verification

Hypothesis challenged: maybe the 1.2 period cap is the primary culprit on long-period swell. I tested this against both code and recent rows.

Code evidence:
- Quiver defines `PERIOD_FACTOR_MAX = 1.2` at `quiver/lib/utils/wave-height-transformer.ts:145-149` and clamps calculated period factor in `quiver/lib/utils/wave-height-transformer.ts:212-216`.
- Seaside mirrors `PERIOD_FACTOR_MAX = 1.2` at `seaside/scripts/face_height_model/transform.py:32-47` and the same clamp at `seaside/scripts/face_height_model/transform.py:142-147`.
- On the decomposed path, model rows can force 12s+ periods up to at least the max when `deepwater_decay_factor > 1`, but not above 1.2: `quiver/lib/utils/wave-height-transformer.ts:938-949` and `seaside/scripts/face_height_model/transform.py:550-560`.

Database verification, purpose: measure whether long period rows exist and whether their low displays are still bounded by other factors.

Recent `ml_predictions_log` rows in the last 14 days with `display_source='face-Hs-transformer-v1'`:
- Total rows: 65,477.
- Rows with `wave_period_s >= 14`: 3,577.
- Long-period model-swell rows: 531.
- Long-period CDIP-sig rows: 0 in this snapshot window.
- Average computed period factor across rows: 0.965.
- Maximum computed period factor: 1.2.

Calibrated shoaling bucket distribution, purpose: compare generic period cap to empirical CDIP bucket factors:

| period bucket | beaches | avg factor | min factor | max factor |
|---|---:|---:|---:|---:|
| 0-8 | 117 | 0.93 | 0.24 | 1.58 |
| 8-12 | 117 | 1.01 | 0.22 | 1.89 |
| 12-16 | 117 | 1.12 | 0.24 | 2.13 |
| 16-999 | 117 | 1.17 | 0.36 | 2.40 |

Representative long-period model rows sorted by low display/raw factor:

| slug | region | UTC slot | source | display m | raw m | factor | period | direction | raw OM m | v5 m |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| swamis | San Diego | 06-26 18:00 | model_swell | 0.366 | 0.720 | 0.51 | 14.0 | 203 | 0.88 | 0.920 |
| upper-trestles | San Diego | 06-26 18:00 | model_swell | 0.579 | 0.860 | 0.67 | 14.2 | 193 | 0.92 | 0.941 |
| doheny | Orange County | 06-26 15:00 | model_swell | 0.579 | 0.860 | 0.67 | 14.3 | 190 | 0.90 | 0.930 |
| newport-upper-jetties | Orange County | 06-26 18:00 | model_swell | 0.549 | 0.720 | 0.76 | 14.0 | 184 | 0.86 | 0.909 |

Conclusion: the period cap is a real ceiling and can falsifiably limit long-period amplification versus empirical buckets up to 2.40. But it is not the primary height-eater in the most severe Big Jetty/Tourmaline examples, where periods are ~9.4-10.9s and the computed period factor is neutral-to-slightly-positive. Period cap ranks below decay/source gating for the current evidence.

# E. Decay, Direction, And shoaling_factors Verification

Hypothesis challenged: perhaps `shoaling_factors` are simply missing from production, or direction alone is the culprit. I checked all three: decay distribution, source gating on calibrated beaches, and null-shoaling terrain beaches.

Decay distribution, purpose: determine whether a few configured beaches have strong model attenuation.

| deepwater_decay_factor | active beaches | with shoaling_factors |
|---:|---:|---:|
| 0.4 | 5 | 5 |
| 0.6 | 8 | 8 |
| 0.7 | 7 | 7 |
| 1.0 | 296 | 92 |
| 1.15 | 5 | 5 |

Model-swell display/raw by decay bucket, purpose: test whether decay correlates with low visible height.

| decay | rows | avg display/raw | min display/raw |
|---:|---:|---:|---:|
| 0.4 | 214 | 0.39 | 0.21 |
| 0.6 | 272 | 0.58 | 0.28 |
| 0.7 | 225 | 0.72 | 0.32 |
| 1.0 | 8,351 | 0.87 | 0.30 |
| 1.15 | 195 | 1.12 | 0.65 |

Source gating on calibrated beaches, purpose: check whether `shoaling_factors` are present but unused because the source is model_swell.

| has shoaling_factors | source | path | calibrated | rows |
|---:|---|---|---:|---:|
| true | model_swell | decomposed | false | 5,064 |
| true | model_swell | scalar_generic | false | 1,446 |
| true | cdip_sig | scalar_calibrated | true | 42 |
| false | model_swell | scalar_generic | false | 9,003 |
| false | model_swell | decomposed | false | 2,408 |
| false | cdip_sig | scalar_generic | false | 3 |

Calibrated beaches with model-swell source and raw input >=2 ft, purpose: find where factors exist but do not fire.

| slug | region | rows | avg display/raw | path example |
|---|---|---:|---:|---|
| big-jetty | San Diego | 46 | 0.31 | decomposed |
| topanga-malibu-ca | Los Angeles | 16 | 0.37 | decomposed |
| crystal-pier | San Diego | 42 | 0.37 | decomposed |
| tourmaline-surf-park | San Diego | 42 | 0.41 | decomposed |
| tourmaline | San Diego | 42 | 0.41 | decomposed |
| rincon-carpinteria-ca | Carpinteria, CA | 34 | 0.43 | scalar_generic |
| county-line-malibu-ca | Los Angeles | 33 | 0.43 | decomposed |
| pb-point | San Diego | 42 | 0.44 | decomposed |

Null-shoaling terrain beaches, purpose: disprove that all low model ratios are only from calibrated beaches with unused CDIP buckets.

| slug | region | rows | avg display/raw |
|---|---|---:|---:|
| isle-of-palms-isle-of-palms-sc | South Carolina | 13 | 0.48 |
| leadbetter-santa-barbara-ca | Santa Barbara | 34 | 0.49 |
| avila-beach-avila-beach-ca | Central Coast | 34 | 0.51 |
| capitola-capitola-ca | Central Coast | 32 | 0.51 |
| florence-south-jetty | Oregon Coast | 34 | 0.52 |
| hanalei-bay-kauai | Kauai | 34 | 0.54 |
| la-push-second-beach-la-push-wa | Washington Coast | 56 | 0.55 |

V5/observed comparator, purpose: check whether raw OM/v5 disagrees with displayed heights on observed rows. In 19,484 observed rows from the last 14 days:
- Display MAE: 0.461 m.
- Raw OM MAE: 0.270 m.
- V5 MAE: 0.277 m.
- V5 populated rows: 19,477.

Representative worst observed display errors in that window show display far below observed and below raw OM/v5; these rows had older/null replay provenance in `display_wave_source`, so they are supporting evidence for display undercall, not source-gating proof:

| slug | region | UTC slot | observed m | display m | raw OM m | v5 m | period | direction |
|---|---|---|---:|---:|---:|---:|---:|---:|
| surfside-beach-surfside-beach-tx | Texas Gulf Coast | 06-18 09:00 | 4.30 | 0.366 | 1.16 | 1.176 | 5.1 | 138 |
| rincon-carpinteria-ca | Carpinteria, CA | 06-20 12:00 | 3.98 | 0.152 | 0.62 | 0.734 | 10.1 | 227 |
| emma-wood-ventura-ca | Ventura | 06-20 12:00 | 3.98 | 0.183 | 0.70 | 0.739 | 9.6 | 180 |
| mondos-beach-ventura-ca | Ventura | 06-20 12:00 | 3.98 | 0.213 | 0.64 | 0.735 | 9.8 | 196 |

Conclusion: the strongest database-backed chain is: model_swell source prevents calibrated shoaling buckets from firing; for some calibrated sheltered beaches the model path then applies `deepwater_decay_factor` as low as 0.4; direction/access can further reduce; period cap is a secondary ceiling; missing `shoaling_factors` is a separate lower-confidence contributor for uncalibrated terrain beaches but not required to explain Big Jetty/Tourmaline.

# F. Culprit Ranking, Confidence, And Next Validation

Hypothesis challenged: any ranking can overfit the examples above. I list what would falsify each culprit and the smallest validation step before changing production code or data.

1. Highest confidence: model-swell source gate plus strong deepwater decay on calibrated sheltered beaches.
   - Confidence: high.
   - Why: production has 6,510 next-7-day rows where beaches have `shoaling_factors` but source is `model_swell` and calibrated=false; decay=0.4 rows average 0.39 display/raw with a 0.21 minimum; Big Jetty scalar rows reconstruct to ~0.26-0.31 expected factor from period × direction × decay.
   - What would falsify it: a replay that removes/neutralizes decay for model_swell at the affected beaches but still produces the same sub-0.4 display/raw ratios; or evidence that raw model swell is already nearshore face height and must be decayed.
   - Smallest next validation: run a read-only/local replay for the top 10 low-ratio rows with three variants: current, decay=1 only, and CDIP-bucket allowed for model_swell only for analysis. Compare predicted display against observed/OM/v5 where available. Do not write DB.

2. Medium-high confidence: calibrated `shoaling_factors` are present but unavailable for the dominant source.
   - Confidence: medium-high.
   - Why: CDIP calibrated rows amplify raw input by ~1.6-2.0x, while calibrated beaches on model_swell show average display/raw as low as 0.31-0.44. Code intentionally gates bucket use to `cdip_sig`/allowed nowcast.
   - What would falsify it: evidence that applying CDIP-derived buckets to model_swell consistently worsens observed MAE in the same low-ratio beaches, or that model_swell raw input is not comparable to CDIP Hs.
   - Smallest next validation: offline replay only, not a code change: for observed rows with `display_wave_source='model_swell'`, compute current vs bucket-applied vs raw OM/v5 MAE by beach/source/period bucket.

3. Medium confidence: direction/access attenuation compounds the low display.
   - Confidence: medium.
   - Why: Big Jetty direction factors were 0.646-0.830 on sampled low rows, and several low-ratio rows are decomposed path rows where per-component access is multiplied into each component.
   - What would falsify it: low-ratio rows with direction/access near 1.0 and decay neutral still dominating the symptom.
   - Smallest next validation: add a local diagnostic replay that logs per-component `accessFactor`, `periodFactor`, `decay`, and chosen bucket for the sampled rows; no production writes.

4. Medium-low confidence: period cap is a secondary ceiling, not the main current eater.
   - Confidence: medium-low as primary culprit, medium as contributor on long-period days.
   - Why: current worst Big Jetty/Tourmaline samples have periods around 9.4-10.9s, where period factor is neutral. Long-period model rows exist, and the 1.2 cap is lower than some empirical bucket factors, but those rows were not the most severe undercalls in this sample.
   - What would falsify it: a larger undercall set dominated by periods >=14s where decay and direction are neutral but the 1.2 cap alone explains the gap.
   - Smallest next validation: replay only rows with `wave_period_s>=14`, compare current period cap 1.2 against 1.4 and against calibrated bucket factors, grouped by observed MAE.

5. Lower-confidence separate issue: missing `shoaling_factors` on uncalibrated terrain beaches.
   - Confidence: low-to-medium.
   - Why: null-shoaling beaches can have low model ratios around 0.48-0.55, but the strongest Big Jetty/Tourmaline evidence occurs where `shoaling_factors` are present.
   - What would falsify it: if uncalibrated terrain beaches are absent from user complaints or have acceptable observed MAE after accounting for source and decay.
   - Smallest next validation: rank null-shoaling beaches by observed display MAE and sample count before prioritizing new calibration work.

Final recommendation: do not start with UI formatting or a DB mutation. The smallest safe next step is a read-only/local replay report for the exact low-ratio rows identified here, decomposing current output into `raw input × decay × period × access/alignment × shoaling bucket/source gate`, then comparing replay variants to observed, raw OM, and v5. That would directly falsify or confirm whether to adjust decay, source gating, or period cap first.