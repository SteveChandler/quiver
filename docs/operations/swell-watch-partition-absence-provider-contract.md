# Required source contract for partition absence

Status: proposal and unsent provider questions. No provider request, production adapter, migration, or authority change was executed.

## Concrete question

For `ncep_gfswave016`, when primary swell is valid and all three secondary fields are zero, which upstream state generated those zeros? Does the service distinguish an absent second partition from an undefined/invalid upstream value before its ocean-cell NaN-to-zero conversion?

The retained counterexample is Cape Hatteras Lighthouse, source `d264fbf8-0525-4d31-adb5-9a0742eaeb7e`, requested issuance `2026-09-13T12:00Z`, selected grid latitude `35.166668`, longitude `-75.5`. There are 48 zero secondary tuples, including native forecast hour 4 and hours 48–87. No absence conclusion has been assigned to them.

The same integration also needs a stable contract for model-native time resolution and interpolation of ranked swell slots after hour 120. Can the API expose native-vs-interpolated provenance or supply the native partition frames without rank-wise temporal interpolation?

## Evidence required before an unavailable tuple may become a known absence

A usable response must establish the source model and issuance, exact selected grid, native forecast time and partition rank, successful source decode, and an explicit documented absence/validity state. That state must be distinct from missing messages, invalid masks, undefined values, and transport/parser failure. Include immutable source content hashes, transformation version, and the field/bit/record that supports the classification.

Possible paths to investigate, not assumed capabilities:

- An explicit provider absence/validity indicator bound to the original request and output.
- Direct upstream model evidence containing a partition count or equivalent authoritative absence semantics, plus a validity indicator. A NaN or missing GRIB value without documented absence semantics is not sufficient.

A valid primary partition, wet-grid designation, or another beach's complete forecast alone is not an absence witness for the secondary partition. An upstream count that itself includes wind sea/swell under different partition definitions also requires explicit mapping; it must not be guessed.

## Three distinct states

- **Present:** valid source values with supported physical meaning.
- **Explicitly absent:** source-backed absence evidence, not synthetic height/period/direction values. The observation representation and evaluator must support an absence state explicitly.
- **Unavailable:** source validity or absence is unknown; preserve suppression.

No substitution of zero energy, one-second period, interpolated values from another run, alternate coordinates, removed cohort members, or manual acceptance is allowed to manufacture completeness.

## Source request budget and permissions

Before implementation, inspect whether the required signal actually exists. A minimal prospective probe should be explicitly capped by issuance, source points, fields, forecast hours, bytes, timeout, request count, and cost; preserve original evidence. No such probe was performed here. A paid account, extra archive coverage, new retention table, state interpretation, or authority binding needs its relevant owner approval.

## Integration gate

Do not wire known-absence handling into the current epoch merely to increase qualifying dates. Require real-source fixtures and actual database/evaluator integration proving that unknown remains suppressed, explicit absence cannot be forged through raw zero values, provenance remains independently checkable, and the governing study definition is satisfied. The current database contract remains unchanged until that review completes.
