# Canonical Session Funnel Report Design

Date: 2026-07-18

Status: approved

## Product Decision

The session acquisition report will add one attempt-aware canonical funnel:

```text
start -> form_view -> submit -> persisted_session
```

The funnel measures unique authenticated users, while also reporting flow counts as diagnostics. A user advances only when one `flow_id` reaches the complete ordered prefix. Events from separate attempts may not be stitched together.

Validation failures are an optional branch after `form_view`, not a required funnel stage. `first_session_logged` is telemetry coverage for the database-truth first persisted session, not submit evidence and not a universal funnel stage.

The existing readiness funnel, activation metrics, and beach/conditions/rating diagnostics remain available. They are not relabeled as canonical conversion.

## Why The Current Report Is Incorrect

The current report has four material errors:

- it does not fetch `session_log_form_view`;
- it unions `first_session_logged` with `session_log_submit`;
- it intersects unordered user sets, allowing separate attempts by the same user to form a false conversion;
- it does not select `sessions.id`, so a submit cannot be tied to the persisted session it created.

Native supplies the correlation fields needed to fix this. Funnel events include `metadata.flow_id`, logical stage time in `metadata.client_stage_at`, and stable IDs in `metadata.event_id`. Submit events include the surf session ID in `metadata.session_id`. The top-level `user_events.session_id` is anonymous-browser attribution and must not be used to join a surf session.

Native persistence chronology is also authoritative:

1. `session_log_submit` is durably queued with `persistence_state: queued`.
2. The session row is persisted.
3. Native emits `first_session_logged` for a database-confirmed first session.
4. Native emits `session_created`.

`first_session_logged.metadata.client_stage_at` intentionally reuses the submit time. Its timestamp therefore cannot establish persistence order. The completed session row is durable truth.

## Scope

This change is limited to:

- `scripts/session-acquisition-funnel-report.ts`;
- `scripts/__tests__/session-acquisition-funnel-report.test.ts`;
- the Markdown and JSON output produced by that report.

It will:

- fetch and measure form views;
- build an ordered, flow-correlated canonical funnel;
- measure the validation branch and same-flow recovery;
- join submit events to completed sessions by owner and session ID;
- report first-session marker coverage separately;
- correct platform, build, and recent submit telemetry so it never treats `first_session_logged` as submit;
- bump the saved report schema from version 2 to version 3;
- strengthen saved-report validation and identifier-leak protection.

It will not:

- modify native or web event emission;
- change database schema or production data;
- add a delayed-event observation horizon;
- replace the existing personalization-readiness thresholds;
- expose raw user, flow, event, or session identifiers;
- redesign unrelated activation, onboarding, or rated-session metrics.

## Measurement Population And Window

The report retains its existing half-open measurement window, `[start, end)`, and its existing real-user filters:

- bot-flagged event rows are excluded;
- mock, deleted, system, and explicitly non-real profiles are excluded;
- canonical persisted sessions require `status === "completed"` and `deleted_at === null`.

Historical first-session identity has one deliberate exception: later soft deletion does not change which completed session was first. The First-Session Telemetry Coverage section defines that rule.

The canonical funnel is authenticated-user only. Events without `user_id` cannot join durable session truth and are excluded from canonical steps. Their aggregate count is reported as unjoinable coverage rather than silently assigned to a user.

The canonical denominator is correlation-complete traffic, currently native traffic that emits the full `flow_id` and `client_stage_at` contract. Legacy and web starts without that contract remain visible in existing diagnostic coverage and in join gaps, but they do not enter canonical conversion. The report must label this boundary so readers do not interpret the canonical rate as all-platform conversion.

The database query continues to fetch event rows by `user_events.created_at` within `[start, end)`. Canonical start, form-view, validation, and submit rows must also have `metadata.client_stage_at` within `[start, end)`. Stage timestamps must be valid and nondecreasing within an attempt. A missing, invalid, or out-of-window logical timestamp is unusable for canonical measurement and is reported in join coverage.

This design does not add a post-window observation period. An offline submit delivered or persisted after `end` can therefore be right-censored. The report will describe that limitation; a mature cohort with an explicit follow-up horizon is a separate enhancement.

## Canonical Attempt Model

### Correlation key

An attempt is keyed by:

```text
(user_id, metadata.flow_id)
```

Both values must be non-empty strings. A stage without either field is unjoinable and cannot advance the canonical funnel.

### Logical ordering

Stage order uses parsed `metadata.client_stage_at`, not delivery order in `user_events.created_at`. Nondecreasing timestamps are allowed because adjacent stages can share the same client timestamp.

The canonical prefixes are:

1. `start`: a valid `session_log_start` anchors the flow in the measurement window.
2. `form_view`: a valid `session_log_form_view` occurs at or after start on the same flow.
3. `submit`: a valid `session_log_submit` occurs at or after form view on the same flow and has a non-empty `metadata.session_id`.
4. `persisted_session`: the submit session ID matches `sessions.id` for the same user, and that session is completed, non-deleted, and in the window session population.

A flow may contain retries or duplicate deliveries. Its earliest valid start anchors the attempt. The builder then selects the earliest form view at or after that start and the earliest submit at or after that form view. It must not choose a later start or form merely to make an earlier invalid submit appear ordered.

### Deduplication

Canonical funnel and first-session marker events with a non-empty `metadata.event_id` are grouped at `(event_type, event_id)` grain before attempts are built. Copies in a group must agree on `user_id`, `flow_id`, parsed `client_stage_at`, and `session_id` where that field applies. An agreeing group becomes one event, with earliest `created_at` as the delivery tie-breaker. A conflicting group is excluded from canonical measurement and increments the stable-ID conflict count. Events without a stable event ID are not assumed to be duplicates.

Deduplication changes neither the report grain nor privacy behavior: only aggregate counts leave the computation.

## Canonical Output

The schema-v3 report adds:

```ts
interface CanonicalSessionFunnel {
  grain: "unique_user";
  ordering: "metadata.client_stage_at";
  steps: Array<{
    key: "start" | "form_view" | "submit" | "persisted_session";
    label: string;
    users: number;
    flows: number;
    pctOfStart: number | null;
    pctOfPrevious: number | null;
  }>;
  joinCoverage: {
    funnelEventRowsMissingUserId: number;
    funnelEventsMissingFlowId: number;
    submitEventsMissingSessionId: number;
    firstSessionMarkersMissingSessionId: number;
    firstSessionMarkersMissingUserId: number;
    funnelEventsWithUnusableClientStageAt: number;
    stableIdConflictGroups: number;
    submitFlowsWithoutWindowSession: number;
    submitFlowsWithSessionOwnerMismatch: number;
    submitFlowsWithIneligibleSession: number;
  };
}
```

The funnel-event coverage fields apply to included `session_log_start`, `session_log_form_view`, `session_log_validation_failed`, and `session_log_submit` rows. A non-conflicting row can contribute to more than one missing-field count. A stable-ID conflict group contributes only to `stableIdConflictGroups`, avoiding double-counted root causes. First-session marker coverage is separate because marker time does not participate in funnel ordering.

Every canonical submit flow that fails persistence correlation belongs to exactly one mutually exclusive class:

1. `submitFlowsWithoutWindowSession`: no window session has the submitted ID, including a session persisted outside the report window;
2. `submitFlowsWithSessionOwnerMismatch`: the ID exists in the window, but its owner differs from the event user;
3. `submitFlowsWithIneligibleSession`: the owned row exists, but is not completed or is deleted.

`users` is the primary product metric. `flows` helps diagnose retries and repeated attempts. Percentages are calculated from unique-user counts, not flow counts.

For the start step, `pctOfStart` is `1` when any start user exists and otherwise `null`; `pctOfPrevious` is always `null`. For later steps, each percentage is the exact user-count ratio and is `null` only when its denominator is zero.

Step counts must be monotonic:

```text
persisted_session <= submit <= form_view <= start
```

The same invariant applies independently to flow counts.

## Validation Branch

The schema-v3 report adds:

```ts
interface SessionValidationBranch {
  affectedUsers: number;
  affectedFlows: number;
  pctOfFormViewUsers: number | null;
  recoveredUsers: number;
  recoveredFlows: number;
  recoveryRate: number | null;
}
```

An affected flow has an ordered start and form view followed by `session_log_validation_failed` on that same flow before its first canonical submit. Equal client timestamps qualify when the validation row has an earlier `created_at` delivery tie-breaker than the submit row. A recovered flow is an affected flow that later reaches canonical submit on the same flow.

Users are unique at each branch metric. Validation on flow A followed by submit on flow B is not recovery. A clean submit without a validation event remains fully eligible for the main funnel.

`pctOfFormViewUsers` is `affectedUsers / canonical form-view users`. `recoveryRate` is `recoveredUsers / affectedUsers`. Each is `null` only when its denominator is zero.

The existing aggregate validation-code table remains diagnostic across included validation rows. It does not imply ordered recovery unless the new branch metrics say so.

## First-Session Telemetry Coverage

The schema-v3 report adds:

```ts
interface FirstSessionTelemetryCoverage {
  persistedFirstSessionUsers: number;
  markerUsers: number;
  coverage: number | null;
}
```

For marker coverage, database truth is the earliest completed lifetime session before `end`, ordered by `created_at` and then `id`, regardless of whether that historical row was soft-deleted later. This matches native first-session classification. Canonical persisted conversion still requires the submitted session itself to be non-deleted.

`persistedFirstSessionUsers` counts canonical `persisted_session` users whose matched session is that database-truth first session. It is not a count of every first session created in the report window.

A `first_session_logged` marker counts only when:

- its `user_id` matches the session owner; and
- `metadata.session_id` matches that database-truth first session ID.

Marker `client_stage_at` is not compared with persistence time. A marker never counts as submit and never advances the canonical funnel.

`coverage` is `markerUsers / persistedFirstSessionUsers` and is `null` only when there are no persisted first-session users.

## Existing Metrics And Compatibility

The report keeps `funnelSteps`, readiness, activation, onboarding, saved/rated-session totals, beach selection, conditions, rating, and validation-code diagnostics.

Correctness changes apply to those diagnostics:

- `SESSION_ACQUISITION_EVENT_TYPES` includes `session_log_form_view`;
- every submit actor count uses `session_log_submit` only;
- `first_session_logged` is removed from submit unions in full-window, recent, platform, and client-build calculations;
- recent, platform, and client-build coverage add form-view actor counts and form-view-of-start rates;
- those legacy coverage sections remain actor diagnostics and are not described as attempt-aware conversion.

The readiness submit-coverage threshold remains configured as it is today, but its observed value becomes stricter because only actual submit telemetry qualifies.

## Data Access Changes

`SessionAcquisitionSessionRow` adds `id: string`. Both window and lifetime session queries select `id`.

Metadata access uses strict readers for:

- `flow_id`;
- `session_id`;
- `client_stage_at`;
- `event_id`.

Malformed metadata is not fatal. It increments the appropriate aggregate join-coverage count and is excluded from the canonical step that requires it. Supabase query errors and invalid report structure remain fatal.

## Rendering And Saved-Report Validation

Markdown adds three aggregate-only sections:

1. Canonical Session Funnel;
2. Validation Recovery;
3. First-Session Telemetry Coverage.

It also renders correlation gaps so missing instrumentation is visible.

JSON schema version becomes `3`. Validation requires:

- the exact canonical step keys and order;
- non-negative integer user and flow counts;
- monotonic step counts;
- `users <= flows` at every canonical step;
- percentage values within `[0, 1]` and equal to their source ratios;
- affected validation users no greater than form-view users;
- recovered users and flows no greater than affected users and flows;
- affected users no greater than affected flows;
- affected flows no greater than canonical form-view flows;
- recovered users no greater than recovered flows;
- recovered flows no greater than canonical submit flows;
- persisted first-session users no greater than canonical persisted-session users;
- marker users no greater than persisted first-session users;
- exact validation-recovery and first-session coverage ratios;
- non-negative integer join-coverage counts;
- no raw identifier arrays, identifier-keyed objects, UUIDs, or unsafe evidence strings.

Existing schema-v2 JSON is rejected as stale rather than silently interpreted with v3 semantics.

## Test Strategy

Implementation follows test-driven development. Tests must cover:

1. `session_log_form_view` is in the fetched event allowlist.
2. One ordered flow reaches all four canonical stages.
3. Start/form on flow A and submit/session on flow B do not convert.
4. Out-of-order delivery with ordered `client_stage_at` converts.
5. A logical submit before form view does not advance.
6. A clean submit without validation remains in the main funnel.
7. Same-flow validation followed by submit counts as recovery.
8. Validation on one flow and submit on another is not recovery.
9. Persistence requires matching session ID, owner, completed status, and non-deleted state.
10. Wrong owner, wrong ID, draft status, or deletion prevents persistence.
11. `first_session_logged` without submit never counts as submit.
12. A first-session marker counts only when its session ID matches database truth.
13. Missing or invalid correlation metadata is reported as unjoinable.
14. Duplicate stable event IDs do not inflate users or flows.
15. Platform, build, and recent submit metrics no longer union first-session markers.
16. Schema-v3 validation enforces ordering, bounds, ratios, and exact step keys.
17. Rendered Markdown and JSON contain no raw user, flow, event, or session identifiers.
18. Persistence failures enter exactly one not-found, owner-mismatch, or ineligible bucket.
19. Conflicting stable-ID duplicates are excluded and reported rather than selecting one copy.
20. A later-soft-deleted historical first session remains the first-session identity.
21. Uncorrelated web or legacy starts remain diagnostic and do not enter the canonical denominator.

The focused report test is the first gate. Repository typecheck and the broader relevant unit suite run after implementation. This report has no browser or native UI surface, so Maestro and visual E2E are not required for the report change.

## Acceptance Criteria

The change is complete when:

- one attempt-aware unique-user funnel reports start, form view, submit, and persistence;
- separate attempts cannot be cross-stitched;
- validation recovery requires the same flow;
- submit-to-persistence requires the exact owned completed session;
- first-session telemetry is reported separately from submit;
- existing readiness and diagnostic metrics remain available with corrected submit semantics;
- schema-v3 Markdown and JSON pass strict validation and privacy checks;
- focused tests and typecheck pass;
- no production data, schema, or client event-emission change is introduced.

## Known Limitation And Follow-Up

The fixed report window can right-censor offline flows whose events or session persistence arrive after `end`. A future mature-cohort mode may add an explicit observation timestamp and minimum follow-up horizon. That enhancement must be opt-in and separately specified so this correctness fix does not silently change cohort membership.
