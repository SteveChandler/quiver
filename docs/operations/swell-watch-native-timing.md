# Swell Watch native-timestep tracking and bounded event timing

## Scope

Steven requested completion and production release of the supported blocker correction. This release changes application derivation only. It does not change provider receipts, the database schema, the fixed ten-source cohort, policy thresholds/hash, study authority, twelve-hour freshness, qualifying-day rules, expiry, collectors, or disabled sends. Hatteras's missing-partition blocker remains explicitly unresolved.

## Counterexample and sampling contract

The retained Waikiki–Canoes 2026-09-13T12:00Z forecast (semantic SHA256 `4f3eccf0aaac1f7e63f5d673d4479cee58ae0980916c1f5a4a6600e0961976a0`) fails hourly trajectory matching at hour139. Hours139/140 are provider interpolation points spanning a primary/secondary rank swap. Native hours138/141 match uniquely under the unchanged2s/25deg thresholds. The model's public implementation is pinned at open-meteo/open-meteo@9701689dd81ebef2d478800366c586c8a02c0c19, GfsDomain.forecastHours and GfsWaveVariable.interpolation. This is an explicit sampling contract, not a claim that the provider serving binary is attested.

Only the validated attested-run loader selects `ncep-gfswave-native-120h.v1` using its frozen model, transport, and issuance. All168 hourly frames and all336 components remain validated and retained. Tracking uses136 native frames: hours0..120 and123..165 by3. Nulls, malformed values, and unavailable components at interpolation points still fail. Hatteras's48 exact all-zero secondary tuples remain unavailable. Missing is not absence.

## Timing and persistence

Existing arrivalAt and peakAt remain retained native-sample timestamps. They do not assert an exact physical onset or continuous peak. Each derived event retains an open-left/closed-right onset interval and closure interval, and identifies peak as maximum_native_sample. An onset interval crossing a2day or5day actionability boundary suppresses rather than guessing.

For the retained Waikiki case, onset lies after2026-09-18T15:00Z and at/before18:00Z; closure lies after2026-09-20T00:00Z and at/before03:00Z. Timing evidence is carried through cohort derivation into the existing hash-covered study result JSON, including on a suppressed cohort with individually derived sources. Each row binds the source, issuance, revision set, sampling contract, retained/tracked counts and eventWindows. eventWindows columns are `[onsetAfterHour,onsetByHour,peakSampleHour,closureAfterHour,closureByHour,peakSourceSlot]`, relative to sampling.issuedAt. No persistence RPC or policy authority is weakened.

## Tests and release gate

Retained evidence fixtures independently verify their original semantic hashes. The native timing tests reproduce the old failure, assert corrected matching and exact timing intervals, and preserve malformed, missing, unbounded, unclosed and ambiguous-edge suppression. The existing incomplete-cohort test retains its exact assertions and adds exact expected derivation provenance.

The new disposable PostgreSQL/PostgREST test calls the real acquisition lease, metadata-selection logic, scope loader, receipt writer, study orchestrator, automatic acceptance/completion, cohort evaluator, nonzero impact persistence/history and result recorder. Only provider transport and explicitly synthetic source data are simulated. The real12h policy remains; a ten-source nonzero-candidate result, immutable retry, suppressed subsequent revision, recovery and zero sends must all pass. It is not a natural production invocation or a qualifying-day proof.

Required gates: full Prod Gate and native PostgREST integration plus the existing normalization SQL suite. Run no manual production acquisition/evaluation. Reverify actual deployment source and natural scheduled lineage after release. All release claims belong to timestamped PR evidence, not this plan.

## Hatteras data-contract hold

Open-Meteo GfsDownload replaces ocean-cell NaN wave fields with zero without carrying per-value cause. The current all-zero tuples therefore cannot alone establish known absence. The bounded source inventory reads at most two small precomputed NOAA GRIB index files, not forecast runs or paid endpoints. It checks whether the incident files expose partition count; finding or not finding a field is NOT a per-cell absence witness. A source-backed absence/validity signal must be tied to the same issuance, selected grid, time and partition before implementing a new missingness representation. Do not reinterpret zeros, drop a source, or count suppression to manufacture success.

## Rollback

Revert only the five application files and new selector to the pre-release implementation through a tested application rollback. Retain the added evidence/tests and all stored receipts/results. No database rollback, authority reset or send control changes are needed. Reverting tracking can restore the prior Waikiki suppression, which is safer than using unreviewed data semantics.
