# Forecast Feedback Numeric Capture Design

**Date:** 2026-07-13
**Owner:** Codex
**Status:** Design direction approved; written spec pending review

## Objective

Collect structured face-height evidence when a user says a displayed forecast is too low or too high, prevent duplicate feedback from inflating operator review, and carry the observation into the existing session-log flow. Keep all direct feedback review-only until it is linked to a completed session.

## Evidence Behind the Change

The 2026-07-13 weekly review found three recent Blacks Beach feedback rows from one active, non-mock, non-system account. Two “about right” rows targeted the same forecast slot with identical context 36 seconds apart, indicating a likely duplicate submission. None of the three rows linked to a session or provided structured numeric face height. This leaves the operator unable to distinguish a repeated tap from independent calibration evidence or measure the magnitude of a reported miss.

## Scope

This slice will:

1. Reveal an optional observed face-height input only for `too_low` and `too_high` feedback.
2. Validate and store the observed height as structured review context.
3. Prevent accidental duplicate submission in the client and reuse one request identifier across retries.
4. Make Seaside return an existing row when it receives a previously stored request identifier.
5. Carry the observed height into the existing “Log the session” handoff and preserve it as the user-entered session height.
6. Deduplicate the weekly operator report defensively and classify numeric feedback conservatively.

This slice will not:

- Treat direct feedback as calibration or model-training truth.
- Write user-reported face height to `ml_predictions_log.observed_m`.
- Change forecasts, calibration values, schedulers, models, or promotion gates.
- Apply a database migration or add a new production column or constraint.
- Change native capture in the same slice.
- Deploy, commit, or mutate production data as part of implementation.

## User Experience

The existing `Too low`, `Right`, and `Too high` controls remain.

- Selecting `Right` keeps the existing low-friction flow. No height input appears.
- Selecting `Too low` or `Too high` reveals an optional number input labeled `What face height did you see?` with a `ft` suffix.
- The input accepts a representative face height from 0.5 to 50 feet in 0.5-foot increments.
- Free-text notes remain optional and are never parsed into numeric calibration evidence.
- The send button is disabled while a request is in flight.
- After a successful save, the selection, height, note, and send control are locked for that card instance. The user sees the existing success message and session-log CTA.
- A failed request keeps the entered data and allows retrying with the same request identifier.

The height is optional because forcing it would reduce feedback completion and invite false precision. A mismatch without a height remains useful as directional feedback but receives lower review readiness.

## Client Data Contract

Add an optional `observedFaceHeightFt` field to `ForecastFeedbackClientPayload`:

```ts
observedFaceHeightFt?: number | null;
```

Validation rules:

- Accept only finite numbers from 0.5 through 50.
- Accept half-foot increments.
- Permit the field only with `too_low` or `too_high` forecast-accuracy feedback.
- Normalize an empty input to `null`.
- Reject an out-of-range or wrong-context value at the API boundary.

The Quiver payload builder stores the validated value under:

```json
{
  "audit_metadata": {
    "user_observation": {
      "face_height_ft": 6
    }
  }
}
```

This uses the existing JSONB contract and avoids a schema mutation. The displayed forecast remains in `displayed_context.wave_height_ft`; operator tooling must keep displayed and observed values distinct.

## Duplicate Protection

Duplicate protection has three layers:

### Client lock

Generate a request UUID when the user starts a feedback draft. Reuse it for retries of that draft. Disable submission while pending and lock the card after success. Changing the selected feedback before a successful send creates a new draft identifier.

### Seaside request reuse

Before inserting, Seaside checks `forecast_feedback_contexts` for the same authenticated user, non-null `request_id`, and `ingest_path`. If a row exists, return it rather than inserting another. This is best-effort idempotency without a new unique constraint; the client lock prevents the observed double-click case, while request reuse covers ordinary network retries.

### Operator-report deduplication

The weekly report collapses rows when all of these match:

- account identity,
- beach,
- forecast slot,
- feedback kind and value,
- displayed context,
- observed face height,
- creation timestamps within two minutes.

The report exposes a duplicate count but excludes duplicates from signal counts and readiness classification. This protects historical data and concurrent requests that evade best-effort service idempotency.

## Session Carryover

Extend the session-wizard URL contract with optional `observedFaceHeightFt`.

- Validate the parameter as a finite 0.5–50-foot number on parse.
- Map it to `SessionFormState.waveHeight`.
- Set `waveHeightEdited: true` because the value came from the user, not forecast prefill.
- Preserve the existing `forecastFeedbackId` and `forecastFeedbackValue` parameters.
- Ensure forecast auto-prefill does not overwrite the carried user observation.
- On successful session creation, keep the existing service-role link that writes the created session ID to the matching feedback context after user and beach checks.

The resulting session row and downstream `session_wave_observation_candidates` path remain the canonical numeric evidence. The feedback JSON value is supporting review context.

## Weekly Review Semantics

The Seaside report will read `audit_metadata.user_observation.face_height_ft` and emit aggregate fields only. Raw notes, account identifiers, and individual feedback IDs remain excluded from the default human report.

Readiness rules:

- Directional feedback without observed height: `watch` after one signal; `hypothesis` after two independent same-beach signals.
- Unlinked numeric mismatch: `watch` or `hypothesis`, never a shadow candidate by itself.
- Numeric feedback linked to a completed session with matching beach and plausible timing: session-aligned evidence.
- Three to five consistent, independent, session-aligned numeric signals may become `shadow_candidate` or `manual_review_candidate`.
- Conflicting, duplicate, invalid, or single-account repeated signals remain `insufficient_signal`, `watch`, or `hypothesis` based on operator judgment.
- Offshore `ml_predictions_log.observed_m` remains context only and is never treated as face-height truth.

## Error Handling

- Invalid height input is rejected client-side with an inline message and server-side with a validation response.
- Feedback storage failure leaves the draft editable and does not display the session-log CTA.
- A duplicate request returns the original feedback row identifier so session carryover still works.
- Failure to link a completed session remains non-fatal to session creation and logs a masked warning.
- Weekly-report parsing ignores malformed JSON values, records a data-gap count, and never infers a height from notes.

## Files Expected to Change

Quiver:

- `components/forecast/forecast-feedback-capture.tsx`
- `lib/services/forecast/forecast-feedback.ts`
- `app/api/forecast-feedback/route.ts`
- `lib/validation/schemas.ts`
- `types/session-wizard.ts`
- `lib/utils/session-wizard-params.ts`
- Focused Jest tests for the component, payload builder, API route, session wizard, and session submission

Seaside:

- `feedback_service.py`
- `scripts/weekly_forecast_feedback_report.py`
- Focused service and report tests
- `docs/forecast_feedback_contract.md`

No migration file is expected.

## Test Strategy

### Quiver unit and component coverage

- Mismatch selection reveals the optional face-height field; `Right` does not.
- Valid height is submitted as structured context.
- Empty height is accepted; invalid or out-of-range values are blocked.
- Double-click or post-success click produces one request.
- Retry reuses the same request identifier.
- Successful response locks the card and builds a session URL carrying feedback ID, feedback value, and observed height.
- Session URL parsing validates the height and prefills `waveHeight` without allowing forecast prefill to overwrite it.
- API validation rejects observed height attached to `about_right`.

### Seaside coverage

- A new request identifier inserts one row.
- A repeated request identifier returns the existing row without another insert.
- Weekly report collapses the Blacks-style duplicate pattern.
- Deduplication does not collapse independent users or materially different context.
- Structured observed height appears in aggregate output without raw notes or identity fields.
- Unlinked numeric feedback cannot reach shadow/manual-review readiness by itself.
- Pipeline-isolation tests continue proving feedback cannot change training, calibration, serving, scheduler, or promotion paths.

### Browser coverage

Review the existing forecast-feedback and session-log E2E coverage before adding a test. Add or modify Playwright only if the existing suite has a stable authenticated forecast-feedback flow that can prove the inline field, one-save behavior, and session carryover without persistent test-data leakage.

## Acceptance Criteria

- A user can optionally report observed face height after `Too low` or `Too high` without additional friction for `Right`.
- One successful card interaction cannot produce a second client submission.
- Retrying the same draft does not create another stored row in normal service operation.
- The session-log CTA carries the observed height and completed session logging links back to the feedback context.
- Weekly review counts likely duplicates once and treats direct numeric feedback conservatively.
- No model, forecast, calibration, scheduler, deployment, or production database state changes occur.
