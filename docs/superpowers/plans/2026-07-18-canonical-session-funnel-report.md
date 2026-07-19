# Canonical Session Funnel Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unordered session-acquisition conversion estimate with an aggregate-only, flow-correlated canonical funnel from start through durable persistence, while preserving corrected readiness diagnostics.

**Architecture:** Keep the existing report as the single read-only CLI surface. Normalize correlation-complete event rows in memory, deduplicate stable deliveries, build ordered `(user_id, flow_id)` attempts from `metadata.client_stage_at`, and join submit `metadata.session_id` to owned completed session rows. Add validation recovery and first-session marker coverage as separate aggregates, then render and validate schema-v3 Markdown/JSON without exposing identifiers.

**Tech Stack:** TypeScript, `tsx`, Supabase JS v2, Jest, existing report validator helpers, Yarn 1.

## Global Constraints

- Modify only `scripts/session-acquisition-funnel-report.ts` and `scripts/__tests__/session-acquisition-funnel-report.test.ts` during implementation.
- Do not add dependencies, database migrations, production writes, or client event-emission changes.
- Preserve the existing readiness, activation, onboarding, beach, conditions, rating, and durable session metrics.
- The canonical grain is unique authenticated user; flow counts are diagnostics.
- Correlation key is exactly `(user_id, metadata.flow_id)`.
- Logical ordering uses `metadata.client_stage_at`; `user_events.created_at` is only a deterministic delivery tie-breaker.
- Canonical logical timestamps must be valid and inside the half-open report window `[start, end)`.
- Canonical stage order is exactly `start -> form_view -> submit -> persisted_session`.
- Validation is an optional same-flow branch; it is never a required main-funnel stage.
- Persistence requires the submitted `metadata.session_id` to match `sessions.id` for the same user with `status === "completed"` and `deleted_at === null`.
- Historical first-session identity is the earliest completed lifetime row before `end`, ordered by `created_at` then `id`, even if it was soft-deleted later.
- `first_session_logged` never counts as submit and never establishes persistence order.
- The schema version is `3` and saved output remains aggregate-only: no raw user, flow, event, or surf-session identifiers.
- Legacy/web rows without the full correlation contract remain diagnostic and do not enter the canonical denominator.
- The fixed report window may right-censor offline delivery after `end`; do not add an observation horizon in this change.
- Use test-driven development: observe each new test fail for the intended reason before implementing its behavior.
- Before every implementation commit, run the task’s focused Jest selection and `yarn typecheck`.
- No Maestro, browser, or visual E2E is required because this is a read-only CLI report.

---

## File Map

- Modify `scripts/session-acquisition-funnel-report.ts`
  - Owns event/session input contracts, report types, canonical computation, legacy diagnostics, Markdown rendering, JSON writing, Supabase reads, and saved-report validation.
- Modify `scripts/__tests__/session-acquisition-funnel-report.test.ts`
  - Owns deterministic event/session/profile fixtures, canonical attempt cases, branch/marker cases, legacy compatibility assertions, renderer privacy, and schema-v3 tamper tests.

Do not split the report into new production files in this change. The approved scope is intentionally limited to the existing report and its focused test.

---

### Task 1: Correct Input Contracts And Legacy Telemetry

**Files:**
- Modify: `scripts/session-acquisition-funnel-report.ts:32-46`
- Modify: `scripts/session-acquisition-funnel-report.ts:112-130`
- Modify: `scripts/session-acquisition-funnel-report.ts:251-307`
- Modify: `scripts/session-acquisition-funnel-report.ts:744-940`
- Modify: `scripts/session-acquisition-funnel-report.ts:2694-2808`
- Modify: `scripts/session-acquisition-funnel-report.ts:2879-3114`
- Modify: `scripts/__tests__/session-acquisition-funnel-report.test.ts:25-57`
- Modify: `scripts/__tests__/session-acquisition-funnel-report.test.ts:163-184`
- Modify: `scripts/__tests__/session-acquisition-funnel-report.test.ts:533-1337`

**Interfaces:**
- Consumes: existing `SessionAcquisitionEventRow`, `SessionAcquisitionSessionRow`, actor maps, and readiness calculation.
- Produces: session rows with `id`; event allowlist with `session_log_form_view`; form-view fields on platform/build/recent diagnostics; actual-submit-only legacy coverage.

- [ ] **Step 1: Add failing fixtures and legacy-correction tests**

Give every session fixture a deterministic ID and add a category-prefixed test that proves form views are fetched while a first-session marker cannot impersonate submit:

```ts
function sessionRow(
  userId: string,
  createdAt: string,
  overrides: Partial<SessionAcquisitionSessionRow> = {}
): SessionAcquisitionSessionRow {
  return {
    id: "session-" + userId + "-" + createdAt,
    user_id: userId,
    created_at: createdAt,
    arrival_time: createdAt,
    status: "completed",
    source: "native",
    rating: 4,
    wave_height_ft: 3,
    deleted_at: null,
    ...overrides,
  };
}

it("legacy telemetry corrections: fetches form views and keeps first-session markers out of submit", () => {
  const report = computeSessionAcquisitionReport({
    start: START,
    end: END,
    generatedAt: "2026-07-01T00:00:00.000Z",
    profiles: [profileRow("user-1")],
    events: [
      eventRow("user-1", "session_log_start"),
      eventRow("user-1", "session_log_form_view"),
      eventRow("user-1", "first_session_logged", {
        metadata: {
          ...nativeBuildMetadata(),
          session_id: "session-user-1",
        },
      }),
    ],
    windowSessions: [],
    lifetimeSessions: [],
  });

  expect(SESSION_ACQUISITION_EVENT_TYPES).toContain("session_log_form_view");
  expect(stepActors(report, "stored_submit_event")).toBe(0);
  expect(report.telemetryCoverageByPlatform[0]).toMatchObject({
    platform: "native-ios",
    startActors: 1,
    formViewActors: 1,
    formViewActorsWithStart: 1,
    formViewOfStart: 1,
    submitEventActors: 0,
    submitActorsWithStart: 0,
    submitEventOfStart: 0,
  });
});
```

Update the existing platform, recent-window, and client-build exact-object tests under the same `legacy telemetry corrections` prefix to expect:

```ts
{
  formViewActors: expect.any(Number),
  formViewActorsWithStart: expect.any(Number),
  formViewOfStart: expect.anything(),
}
```

Replace every fixture that currently uses `first_session_logged` to satisfy submit readiness with a real `session_log_submit` row.

- [ ] **Step 2: Run the legacy selection and confirm the intended failures**

Run:

```bash
DOTENV_CONFIG_PATH=/Users/stevenchandler/Desktop/dev/quiver/.env.local NODE_OPTIONS="--require dotenv/config" yarn test:unit --runTestsByPath scripts/__tests__/session-acquisition-funnel-report.test.ts --runInBand -t "legacy telemetry corrections|Track B event coverage"
```

Expected: FAIL because `session_log_form_view` is absent, session fixtures lack a typed `id` contract in production, form-view coverage fields do not exist, and marker-inclusive submit counts are still nonzero.

- [ ] **Step 3: Implement the data and legacy coverage corrections**

Make these contract changes:

```ts
const SESSION_ACQUISITION_REPORT_SCHEMA_VERSION = 2;

export const SESSION_ACQUISITION_EVENT_TYPES = [
  "session_log_start",
  "session_log_form_view",
  "session_log_beach_selected",
  "session_log_conditions_set",
  "session_log_rating_set",
  "session_log_validation_failed",
  "session_log_abandon",
  "session_log_submit",
  "first_session_logged",
] as const;

export interface SessionAcquisitionSessionRow {
  id: string;
  user_id: string;
  created_at: string;
  arrival_time: string;
  status: string | null;
  source: string | null;
  rating: number | null;
  wave_height_ft: number | null;
  deleted_at: string | null;
}
```

Add `formViewActors`, `formViewActorsWithStart`, and `formViewOfStart` to `SessionTelemetryPlatformCoverage`, `SessionTelemetryClientBuildCoverage`, and `SessionRecentTelemetryWindow`.

In full-window, platform, build, and recent computation, use actual submit only:

```ts
const formViewActors =
  eventActorsByType.get("session_log_form_view") ?? new Set<string>();
const submitEventActors =
  eventActorsByType.get("session_log_submit") ?? new Set<string>();
```

Compute form-view intersection and rate with the same pattern as beach selection:

```ts
const formViewActorsWithStart = intersectionSize(formViewActors, startActors);

return {
  startActors: startActors.size,
  formViewActors: formViewActors.size,
  formViewActorsWithStart,
  formViewOfStart: ratio(formViewActorsWithStart, startActors.size),
};
```

Enumerate platforms from start, form-view, beach, conditions, and actual submit event maps. Do not enumerate marker-only platforms as submit platforms.

Add `id` to both Supabase session selects:

```ts
.select(
  "id, user_id, created_at, arrival_time, status, source, rating, wave_height_ft, deleted_at"
)
```

Extend `validateActorCoverageCounts` and the platform/build/recent shape validators to accept and validate the three form-view fields. Expand the Markdown platform/recent/build tables with form-view columns so the new diagnostics are visible.

- [ ] **Step 4: Run focused tests and typecheck**

Run:

```bash
DOTENV_CONFIG_PATH=/Users/stevenchandler/Desktop/dev/quiver/.env.local NODE_OPTIONS="--require dotenv/config" yarn test:unit --runTestsByPath scripts/__tests__/session-acquisition-funnel-report.test.ts --runInBand -t "legacy telemetry corrections|Track B event coverage|readiness"
yarn typecheck
```

Expected: all selected tests PASS; TypeScript exits 0.

- [ ] **Step 5: Review and commit the legacy correction**

Run:

```bash
git diff --check
git diff -- scripts/session-acquisition-funnel-report.ts scripts/__tests__/session-acquisition-funnel-report.test.ts
git add scripts/session-acquisition-funnel-report.ts scripts/__tests__/session-acquisition-funnel-report.test.ts
git commit -m "fix(analytics): correct session funnel telemetry"
```

Confirm the staged diff contains only actual-submit semantics, form-view diagnostics, session IDs, query selects, renderer columns, validator fields, and their tests.

---

### Task 2: Build Ordered Canonical Attempts And Persistence Correlation

**Files:**
- Modify: `scripts/session-acquisition-funnel-report.ts:140-216`
- Modify: `scripts/session-acquisition-funnel-report.ts:744-940`
- Modify: `scripts/session-acquisition-funnel-report.ts:3691-3920`
- Modify: `scripts/__tests__/session-acquisition-funnel-report.test.ts:25-110`
- Modify: `scripts/__tests__/session-acquisition-funnel-report.test.ts:533-1043`

**Interfaces:**
- Consumes: filtered real-user events, included window sessions, report `start`/`end`, `ratio`, and `timestampInRange`.
- Produces: `CanonicalSessionFunnel`, internal `CanonicalAttempt` states, strict metadata readers, stable-ID conflict handling, and mutually exclusive submit-persistence buckets.

- [ ] **Step 1: Add canonical fixture helpers**

Add deterministic helpers next to `nativeBuildMetadata`:

```ts
function canonicalMetadata(input: {
  flowId: string;
  clientStageAt: string;
  eventId: string;
  sessionId?: string;
  extra?: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    ...nativeBuildMetadata(),
    schema_version: 1,
    flow_id: input.flowId,
    client_stage_at: input.clientStageAt,
    event_id: input.eventId,
    ...(input.sessionId ? { session_id: input.sessionId } : {}),
    ...(input.extra ?? {}),
  };
}

function canonicalEventRow(
  userId: string | null,
  eventType: string,
  input: {
    flowId: string;
    clientStageAt: string;
    eventId: string;
    sessionId?: string;
    createdAt?: string;
    extra?: Record<string, unknown>;
  }
): SessionAcquisitionEventRow {
  return eventRow(userId, eventType, {
    created_at: input.createdAt ?? input.clientStageAt,
    metadata: canonicalMetadata(input),
  });
}

function canonicalStep(
  report: ReturnType<typeof computeSessionAcquisitionReport>,
  key: "start" | "form_view" | "submit" | "persisted_session"
) {
  const step = report.canonicalFunnel.steps.find((entry) => entry.key === key);
  if (!step) throw new Error("Missing canonical step: " + key);
  return step;
}
```

- [ ] **Step 2: Add failing ordered-flow, no-stitch, and delivery-order tests**

Use exact titles prefixed with `canonical funnel`. The happy-path test must send rows in delivery order different from logical order:

```ts
it("canonical funnel: advances one flow by logical stage time and exact persisted session", () => {
  const report = computeSessionAcquisitionReport({
    start: START,
    end: END,
    generatedAt: "2026-07-01T00:00:00.000Z",
    profiles: [profileRow("user-1")],
    events: [
      canonicalEventRow("user-1", "session_log_submit", {
        flowId: "flow-a",
        clientStageAt: "2026-06-15T12:03:00.000Z",
        createdAt: "2026-06-15T12:06:00.000Z",
        eventId: "submit-a",
        sessionId: "session-a",
      }),
      canonicalEventRow("user-1", "session_log_start", {
        flowId: "flow-a",
        clientStageAt: "2026-06-15T12:01:00.000Z",
        createdAt: "2026-06-15T12:05:00.000Z",
        eventId: "start-a",
      }),
      canonicalEventRow("user-1", "session_log_form_view", {
        flowId: "flow-a",
        clientStageAt: "2026-06-15T12:02:00.000Z",
        createdAt: "2026-06-15T12:04:00.000Z",
        eventId: "form-a",
      }),
    ],
    windowSessions: [
      sessionRow("user-1", "2026-06-15T12:03:00.000Z", { id: "session-a" }),
    ],
    lifetimeSessions: [],
  });

  expect(report.canonicalFunnel.steps).toMatchObject([
    { key: "start", users: 1, flows: 1, pctOfStart: 1, pctOfPrevious: null },
    { key: "form_view", users: 1, flows: 1, pctOfStart: 1, pctOfPrevious: 1 },
    { key: "submit", users: 1, flows: 1, pctOfStart: 1, pctOfPrevious: 1 },
    {
      key: "persisted_session",
      users: 1,
      flows: 1,
      pctOfStart: 1,
      pctOfPrevious: 1,
    },
  ]);
});
```

Add separate tests proving:

- start/form on `flow-a` plus submit on `flow-b` produces zero submit users;
- a submit with logical time before form does not advance;
- a row with missing/invalid/out-of-window `client_stage_at` is excluded and counted;
- a legacy/web row without `flow_id` remains in legacy diagnostics but not the canonical denominator;
- identical stable-ID retries deduplicate;
- stable-ID copies that disagree on user, flow, parsed logical time, or applicable session ID are excluded and add one conflict group.
- first-session markers missing user or `metadata.session_id` increment their dedicated coverage fields and never contribute to submit.

- [ ] **Step 3: Add failing persistence-bucket tests**

Create one test titled `persistence buckets: partitions every submitted flow exactly once` with five separate flows:

```ts
expect(report.canonicalFunnel.joinCoverage).toMatchObject({
  submitFlowsWithoutWindowSession: 1,
  submitFlowsWithSessionOwnerMismatch: 1,
  submitFlowsWithIneligibleSession: 2,
});
expect(canonicalStep(report, "submit").flows).toBe(5);
expect(canonicalStep(report, "persisted_session").flows).toBe(1);
```

The fixtures must cover:

- one owned completed non-deleted session;
- one missing/out-of-window session ID;
- one session ID owned by another included real user;
- one owned `status: "draft"` row;
- one owned completed row with non-null `deleted_at`.

Also assert wrong owner, missing ID, draft, and deletion do not add persisted users.

- [ ] **Step 4: Run the canonical selections and confirm failure**

Run:

```bash
DOTENV_CONFIG_PATH=/Users/stevenchandler/Desktop/dev/quiver/.env.local NODE_OPTIONS="--require dotenv/config" yarn test:unit --runTestsByPath scripts/__tests__/session-acquisition-funnel-report.test.ts --runInBand -t "canonical funnel|persistence buckets"
```

Expected: FAIL because `canonicalFunnel` and canonical correlation helpers do not exist.

- [ ] **Step 5: Add public canonical report types**

Add these exact interfaces near `FunnelStepMetric`:

```ts
export type CanonicalSessionFunnelStepKey =
  | "start"
  | "form_view"
  | "submit"
  | "persisted_session";

export interface CanonicalSessionFunnelStep {
  key: CanonicalSessionFunnelStepKey;
  label: string;
  users: number;
  flows: number;
  pctOfStart: number | null;
  pctOfPrevious: number | null;
}

export interface CanonicalSessionJoinCoverage {
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
}

export interface CanonicalSessionFunnel {
  grain: "unique_user";
  ordering: "metadata.client_stage_at";
  steps: CanonicalSessionFunnelStep[];
  joinCoverage: CanonicalSessionJoinCoverage;
}
```

Add `canonicalFunnel: CanonicalSessionFunnel` to `SessionAcquisitionReport`.

- [ ] **Step 6: Add strict parsing, deduplication, and attempt state**

Add these internal types and functions near the existing metadata/set helpers:

```ts
type CanonicalFunnelEventType =
  | "session_log_start"
  | "session_log_form_view"
  | "session_log_validation_failed"
  | "session_log_submit";

interface ParsedCanonicalEvent {
  row: SessionAcquisitionEventRow;
  eventType: CanonicalFunnelEventType | "first_session_logged";
  userId: string | null;
  flowId: string | null;
  sessionId: string | null;
  eventId: string | null;
  clientStageAtMs: number | null;
  createdAtMs: number;
  inputIndex: number;
}

interface CanonicalAttempt {
  userId: string;
  flowId: string;
  start: ParsedCanonicalEvent;
  formView: ParsedCanonicalEvent | null;
  submit: ParsedCanonicalEvent | null;
  validationFailures: ParsedCanonicalEvent[];
  persistedSession: SessionAcquisitionSessionRow | null;
}

interface CanonicalSessionAnalysis {
  attempts: CanonicalAttempt[];
  firstSessionMarkers: ParsedCanonicalEvent[];
  canonicalFunnel: CanonicalSessionFunnel;
}

function readMetadataString(metadata: unknown, key: string): string | null {
  const value = toRecord(metadata)[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readClientStageAtMs(
  metadata: unknown,
  startMs: number,
  endMs: number
): number | null {
  const raw = readMetadataString(metadata, "client_stage_at");
  if (!raw) return null;
  const value = Date.parse(raw);
  return Number.isFinite(value) && value >= startMs && value < endMs
    ? value
    : null;
}

function compareCanonicalEvents(
  left: ParsedCanonicalEvent,
  right: ParsedCanonicalEvent
): number {
  return (
    (left.clientStageAtMs ?? Number.POSITIVE_INFINITY) -
      (right.clientStageAtMs ?? Number.POSITIVE_INFINITY) ||
    left.createdAtMs - right.createdAtMs ||
    left.inputIndex - right.inputIndex
  );
}

function parseCanonicalEvents(input: {
  events: SessionAcquisitionEventRow[];
  start: string;
  end: string;
}): ParsedCanonicalEvent[];

function deduplicateCanonicalEvents(
  events: ParsedCanonicalEvent[]
): {
  events: ParsedCanonicalEvent[];
  stableIdConflictGroups: number;
};

function computeCanonicalSessionAnalysis(input: {
  events: SessionAcquisitionEventRow[];
  windowSessions: SessionAcquisitionSessionRow[];
  start: string;
  end: string;
}): CanonicalSessionAnalysis;
```

Implement `parseCanonicalEvents` over the four funnel event types plus `first_session_logged`. Deduplicate stable-ID groups at `eventType + eventId` before gap counting. A group agrees only when normalized user, flow, logical time, and applicable session ID are equal. Exclude conflicts and increment only `stableIdConflictGroups`.

Build attempts by `userId + flowId`:

1. reject funnel rows missing user, flow, or usable logical time while incrementing the applicable aggregate counters;
2. anchor the earliest valid start;
3. choose the earliest form at or after that start;
4. choose the earliest submit at or after that form that has `metadata.session_id`;
5. retain validation rows for Task 3;
6. keep first-session markers outside attempt ordering for Task 4.

- [ ] **Step 7: Correlate persistence and build step aggregates**

Use a `Map<string, SessionAcquisitionSessionRow>` over included window rows. Classify each canonical submit in this exact order:

```ts
function classifySubmittedSession(
  submit: ParsedCanonicalEvent,
  sessionsById: Map<string, SessionAcquisitionSessionRow>
):
  | { kind: "persisted"; session: SessionAcquisitionSessionRow }
  | { kind: "not_found" }
  | { kind: "owner_mismatch" }
  | { kind: "ineligible" } {
  if (!submit.sessionId) return { kind: "not_found" };
  const session = sessionsById.get(submit.sessionId);
  if (!session) return { kind: "not_found" };
  if (session.user_id !== submit.userId) return { kind: "owner_mismatch" };
  if (!isCompletedSession(session)) return { kind: "ineligible" };
  return { kind: "persisted", session };
}
```

Create user sets and flow counts for each ordered prefix. Build percentages from unique-user counts:

```ts
function canonicalFunnelStep(
  key: CanonicalSessionFunnelStepKey,
  label: string,
  users: Set<string>,
  flows: number,
  startUsers: number,
  previousUsers: number | null
): CanonicalSessionFunnelStep {
  return {
    key,
    label,
    users: users.size,
    flows,
    pctOfStart: key === "start"
      ? users.size > 0 ? 1 : null
      : ratio(users.size, startUsers),
    pctOfPrevious:
      previousUsers === null ? null : ratio(users.size, previousUsers),
  };
}
```

Return all four steps in exact order and attach join coverage. Verify in code that the three persistence rejection counts sum to `submit flows - persisted flows` by construction.

Call `computeCanonicalSessionAnalysis` from `computeSessionAcquisitionReport` after filtering events and sessions, and assign `canonicalFunnel` into the report object.

- [ ] **Step 8: Run focused tests and typecheck**

Run:

```bash
DOTENV_CONFIG_PATH=/Users/stevenchandler/Desktop/dev/quiver/.env.local NODE_OPTIONS="--require dotenv/config" yarn test:unit --runTestsByPath scripts/__tests__/session-acquisition-funnel-report.test.ts --runInBand -t "canonical funnel|persistence buckets"
yarn typecheck
```

Expected: all selected tests PASS; TypeScript exits 0.

- [ ] **Step 9: Review and commit canonical correlation**

Review for cross-attempt stitching, invalid timestamp rescue, identifier rendering, bucket overlap, and raw-event mutation. Then run:

```bash
git diff --check
git add scripts/session-acquisition-funnel-report.ts scripts/__tests__/session-acquisition-funnel-report.test.ts
git commit -m "feat(analytics): add canonical session funnel"
```

---

### Task 3: Add Same-Flow Validation Recovery

**Files:**
- Modify: `scripts/session-acquisition-funnel-report.ts:140-216`
- Modify: `scripts/session-acquisition-funnel-report.ts:744-940`
- Modify: canonical analysis helpers added in Task 2
- Modify: `scripts/__tests__/session-acquisition-funnel-report.test.ts` canonical test section

**Interfaces:**
- Consumes: internal `CanonicalAttempt[]` and canonical form/submit user and flow state from Task 2.
- Produces: `SessionValidationBranch` and `report.validationBranch`.

- [ ] **Step 1: Add failing validation branch tests**

Name every test with `validation recovery`. Cover clean submit, same-flow recovery, cross-flow non-recovery, and equal logical timestamp ordering:

```ts
it("validation recovery: counts an affected user only when the same flow later submits", () => {
  const report = computeSessionAcquisitionReport({
    start: START,
    end: END,
    generatedAt: "2026-07-01T00:00:00.000Z",
    profiles: [profileRow("user-1")],
    events: [
      canonicalEventRow("user-1", "session_log_start", {
        flowId: "flow-a",
        clientStageAt: "2026-06-15T12:00:00.000Z",
        eventId: "start-a",
      }),
      canonicalEventRow("user-1", "session_log_form_view", {
        flowId: "flow-a",
        clientStageAt: "2026-06-15T12:01:00.000Z",
        eventId: "form-a",
      }),
      canonicalEventRow("user-1", "session_log_validation_failed", {
        flowId: "flow-a",
        clientStageAt: "2026-06-15T12:02:00.000Z",
        eventId: "validation-a",
      }),
      canonicalEventRow("user-1", "session_log_submit", {
        flowId: "flow-a",
        clientStageAt: "2026-06-15T12:03:00.000Z",
        eventId: "submit-a",
        sessionId: "session-a",
      }),
    ],
    windowSessions: [
      sessionRow("user-1", "2026-06-15T12:03:00.000Z", { id: "session-a" }),
    ],
    lifetimeSessions: [],
  });

  expect(report.validationBranch).toEqual({
    affectedUsers: 1,
    affectedFlows: 1,
    pctOfFormViewUsers: 1,
    recoveredUsers: 1,
    recoveredFlows: 1,
    recoveryRate: 1,
  });
});
```

For equal `client_stage_at` values, set validation `created_at` earlier than submit and assert recovery. Reverse delivery timestamps and assert the validation is not before submit. Add a clean-submit case with every branch count zero and `null` rates where denominators are zero.

- [ ] **Step 2: Run the branch selection and confirm failure**

Run:

```bash
DOTENV_CONFIG_PATH=/Users/stevenchandler/Desktop/dev/quiver/.env.local NODE_OPTIONS="--require dotenv/config" yarn test:unit --runTestsByPath scripts/__tests__/session-acquisition-funnel-report.test.ts --runInBand -t "validation recovery"
```

Expected: FAIL because `validationBranch` does not exist.

- [ ] **Step 3: Implement branch aggregation**

Add:

```ts
export interface SessionValidationBranch {
  affectedUsers: number;
  affectedFlows: number;
  pctOfFormViewUsers: number | null;
  recoveredUsers: number;
  recoveredFlows: number;
  recoveryRate: number | null;
}
```

Implement:

```ts
function buildSessionValidationBranch(
  attempts: CanonicalAttempt[],
  formViewUsers: number
): SessionValidationBranch {
  const affectedUsers = new Set<string>();
  const recoveredUsers = new Set<string>();
  let affectedFlows = 0;
  let recoveredFlows = 0;

  for (const attempt of attempts) {
    if (!attempt.formView) continue;
    const firstSubmit = attempt.submit;
    const affected = attempt.validationFailures.some((event) => {
      if (compareCanonicalEvents(event, attempt.formView as ParsedCanonicalEvent) < 0) {
        return false;
      }
      return !firstSubmit || compareCanonicalEvents(event, firstSubmit) < 0;
    });
    if (!affected) continue;

    affectedFlows += 1;
    affectedUsers.add(attempt.userId);
    if (firstSubmit) {
      recoveredFlows += 1;
      recoveredUsers.add(attempt.userId);
    }
  }

  return {
    affectedUsers: affectedUsers.size,
    affectedFlows,
    pctOfFormViewUsers: ratio(affectedUsers.size, formViewUsers),
    recoveredUsers: recoveredUsers.size,
    recoveredFlows,
    recoveryRate: ratio(recoveredUsers.size, affectedUsers.size),
  };
}
```

The comparison is strictly before submit after applying the shared logical-time/`created_at`/input-index ordering. This makes equal logical timestamps deterministic.

Add `validationBranch` to `SessionAcquisitionReport` and the report object.

- [ ] **Step 4: Run focused tests and typecheck**

Run:

```bash
DOTENV_CONFIG_PATH=/Users/stevenchandler/Desktop/dev/quiver/.env.local NODE_OPTIONS="--require dotenv/config" yarn test:unit --runTestsByPath scripts/__tests__/session-acquisition-funnel-report.test.ts --runInBand -t "validation recovery|canonical funnel"
yarn typecheck
```

Expected: selected tests PASS; TypeScript exits 0.

- [ ] **Step 5: Review and commit validation recovery**

Review same-flow correlation, clean-flow behavior, repeated validation events, unique-user dedupe, and zero-denominator rates. Then:

```bash
git diff --check
git add scripts/session-acquisition-funnel-report.ts scripts/__tests__/session-acquisition-funnel-report.test.ts
git commit -m "feat(analytics): report session validation recovery"
```

---

### Task 4: Add Database-Truth First-Session Marker Coverage

**Files:**
- Modify: `scripts/session-acquisition-funnel-report.ts:140-216`
- Modify: `scripts/session-acquisition-funnel-report.ts:744-940`
- Modify: `scripts/session-acquisition-funnel-report.ts:3697-3735`
- Modify: canonical analysis helpers added in Task 2
- Modify: `scripts/__tests__/session-acquisition-funnel-report.test.ts` canonical test section

**Interfaces:**
- Consumes: canonical attempts with `persistedSession`, deduplicated first-session markers, lifetime session rows, and report `end`.
- Produces: `FirstSessionTelemetryCoverage` and `report.firstSessionTelemetryCoverage`.

- [ ] **Step 1: Add failing first-session coverage tests**

Use titles prefixed by `first-session telemetry coverage`. Cover:

- one canonical persisted first session with a matching marker;
- marker session mismatch;
- marker user mismatch;
- marker without canonical submit;
- duplicate markers for one user;
- a later current session when the historical first completed session was soft-deleted.

The soft-delete test must assert the current session is not reclassified:

```ts
expect(report.firstSessionTelemetryCoverage).toEqual({
  persistedFirstSessionUsers: 0,
  markerUsers: 0,
  coverage: null,
});
```

Its lifetime fixtures must include an earlier `status: "completed"` row with non-null `deleted_at` and the later canonical persisted row.

- [ ] **Step 2: Run the marker selection and confirm failure**

Run:

```bash
DOTENV_CONFIG_PATH=/Users/stevenchandler/Desktop/dev/quiver/.env.local NODE_OPTIONS="--require dotenv/config" yarn test:unit --runTestsByPath scripts/__tests__/session-acquisition-funnel-report.test.ts --runInBand -t "first-session telemetry coverage"
```

Expected: FAIL because first-session coverage is not separately computed.

- [ ] **Step 3: Implement historical identity and marker coverage**

Add:

```ts
export interface FirstSessionTelemetryCoverage {
  persistedFirstSessionUsers: number;
  markerUsers: number;
  coverage: number | null;
}

function isHistoricallyCompletedSession(
  session: SessionAcquisitionSessionRow
): boolean {
  return session.status === "completed";
}
```

Build first identity without filtering later soft deletion:

```ts
function buildFirstCompletedSessionByUser(
  lifetimeSessions: SessionAcquisitionSessionRow[],
  end: string
): Map<string, SessionAcquisitionSessionRow> {
  const sorted = lifetimeSessions
    .filter(isHistoricallyCompletedSession)
    .filter((session) => Date.parse(session.created_at) < Date.parse(end))
    .sort(
      (left, right) =>
        Date.parse(left.created_at) - Date.parse(right.created_at) ||
        left.id.localeCompare(right.id)
    );
  const firstByUser = new Map<string, SessionAcquisitionSessionRow>();
  for (const session of sorted) {
    if (!firstByUser.has(session.user_id)) {
      firstByUser.set(session.user_id, session);
    }
  }
  return firstByUser;
}
```

Build coverage:

1. collect canonical persisted attempts whose `persistedSession.id` equals the user’s historical first ID;
2. dedupe the denominator by user;
3. count a marker only when its user and `metadata.session_id` match that persisted-first-session pair;
4. intersect marker users with the denominator so `markerUsers` cannot exceed it;
5. set `coverage = markerUsers / persistedFirstSessionUsers`, or `null` for a zero denominator;
6. never inspect marker logical time for persistence ordering.

Expose that computation through this exact internal signature:

```ts
function buildFirstSessionTelemetryCoverage(input: {
  attempts: CanonicalAttempt[];
  firstSessionMarkers: ParsedCanonicalEvent[];
  lifetimeSessions: SessionAcquisitionSessionRow[];
  end: string;
}): FirstSessionTelemetryCoverage;
```

Add `firstSessionTelemetryCoverage` to `SessionAcquisitionReport` and the report object.

- [ ] **Step 4: Run focused tests and typecheck**

Run:

```bash
DOTENV_CONFIG_PATH=/Users/stevenchandler/Desktop/dev/quiver/.env.local NODE_OPTIONS="--require dotenv/config" yarn test:unit --runTestsByPath scripts/__tests__/session-acquisition-funnel-report.test.ts --runInBand -t "first-session telemetry coverage|canonical funnel"
yarn typecheck
```

Expected: selected tests PASS; TypeScript exits 0.

- [ ] **Step 5: Review and commit first-session coverage**

Review deleted-history semantics, ordering tie-breaker, marker mismatch, duplicate markers, denominator scope, and submit independence. Then:

```bash
git diff --check
git add scripts/session-acquisition-funnel-report.ts scripts/__tests__/session-acquisition-funnel-report.test.ts
git commit -m "feat(analytics): report first-session telemetry coverage"
```

---

### Task 5: Render And Strictly Validate Schema V3

**Files:**
- Modify: `scripts/session-acquisition-funnel-report.ts:32-33`
- Modify: `scripts/session-acquisition-funnel-report.ts:178-216`
- Modify: `scripts/session-acquisition-funnel-report.ts:943-1363`
- Modify: `scripts/session-acquisition-funnel-report.ts:1475-2035`
- Modify: `scripts/session-acquisition-funnel-report.ts:2477-2635`
- Modify: `scripts/__tests__/session-acquisition-funnel-report.test.ts:1367-1894`

**Interfaces:**
- Consumes: canonical, validation, first-session, legacy form-view, readiness, and privacy aggregates from Tasks 1-4.
- Produces: schema-v3 Markdown/JSON and strict validators for exact shape, relationships, rates, rejection partitions, and identifier leakage.

- [ ] **Step 1: Add failing Markdown and JSON assertions**

Extend the aggregate-only renderer test to require these headings:

```ts
expect(markdown).toContain("## Canonical Session Funnel");
expect(markdown).toContain("## Validation Recovery");
expect(markdown).toContain("## First-Session Telemetry Coverage");
expect(markdown).toContain("Correlation-complete traffic");
expect(markdown).not.toContain("flow-a");
expect(markdown).not.toContain("session-a");
```

Update JSON expectations to schema `3` and assert the exact four step keys:

```ts
expect(parsed.reportSchemaVersion).toBe(3);
expect(parsed.canonicalFunnel.steps.map((step: { key: string }) => step.key))
  .toEqual(["start", "form_view", "submit", "persisted_session"]);
```

- [ ] **Step 2: Add failing tamper and privacy tests**

Clone a valid computed report and mutate one rule per assertion. Expect stable blocker codes for:

- schema version 2;
- missing/reordered/duplicate canonical steps;
- non-integer or negative counts;
- non-monotonic users or flows;
- `users > flows`;
- incorrect `pctOfStart` or `pctOfPrevious`;
- persistence rejection buckets whose sum differs from `submit flows - persisted flows`;
- validation affected/recovered bounds and rate mismatches;
- first-session denominator/marker bounds and coverage mismatch;
- missing or negative join-coverage fields;
- extra root field containing `user_id`, `flow_id`, `event_id`, or `session_id`;
- UUID values;
- unsafe gap evidence such as `flow_id=flow-a`.

Use exact expected codes such as:

```ts
expect(validateSessionAcquisitionReport(tampered).blockers).toContain(
  "canonical_funnel_step_order_invalid"
);
```

Define every blocker code in its corresponding validator implementation; do not use dynamic prose as a code.

- [ ] **Step 3: Run renderer/validator selections and confirm failure**

Run:

```bash
DOTENV_CONFIG_PATH=/Users/stevenchandler/Desktop/dev/quiver/.env.local NODE_OPTIONS="--require dotenv/config" yarn test:unit --runTestsByPath scripts/__tests__/session-acquisition-funnel-report.test.ts --runInBand -t "aggregate-only|saved JSON|schema v3|tamper|privacy"
```

Expected: FAIL because the report is still schema 2 and the new sections/validators do not exist.

- [ ] **Step 4: Bump schema and render aggregate sections**

Set the schema literal and add the three aggregate members to the existing `SessionAcquisitionReport` interface:

```ts
const SESSION_ACQUISITION_REPORT_SCHEMA_VERSION = 3;

// Existing SessionAcquisitionReport members:
reportSchemaVersion: 3;
canonicalFunnel: CanonicalSessionFunnel;
validationBranch: SessionValidationBranch;
firstSessionTelemetryCoverage: FirstSessionTelemetryCoverage;
```

Render the canonical table:

```ts
lines.push("## Canonical Session Funnel");
lines.push("");
lines.push("- Grain: unique authenticated users; flow counts are diagnostic.");
lines.push(
  "- Correlation-complete traffic only; legacy/web rows without flow metadata remain diagnostic."
);
lines.push("");
lines.push("| Step | Users | Flows | Of start | From previous |");
lines.push("| --- | ---: | ---: | ---: | ---: |");
for (const step of report.canonicalFunnel.steps) {
  lines.push(
    "| " + step.label +
      " | " + step.users.toLocaleString() +
      " | " + step.flows.toLocaleString() +
      " | " + formatPercent(step.pctOfStart) +
      " | " + formatPercent(step.pctOfPrevious) + " |"
  );
}
```

Render validation and first-session coverage using only the interface counts/rates. Render each join-coverage field in a correlation-gap table. Expand the privacy note to name user, flow, event, and surf-session IDs.

- [ ] **Step 5: Add exact schema-v3 validators**

Add and call:

```ts
function validateCanonicalFunnel(
  value: unknown,
  blockers: string[]
): void;

function validateValidationBranch(
  value: unknown,
  canonicalFunnel: unknown,
  blockers: string[]
): void;

function validateFirstSessionTelemetryCoverage(
  value: unknown,
  canonicalFunnel: unknown,
  blockers: string[]
): void;

function validateAggregateOnlyReportPrivacy(
  value: unknown,
  blockers: string[]
): void;
```

`validateCanonicalFunnel` must enforce:

- `grain === "unique_user"` and `ordering === "metadata.client_stage_at"`;
- exact keys/order `start, form_view, submit, persisted_session`;
- non-negative integer `users`/`flows`;
- monotonic users and flows;
- `users <= flows`;
- start rates `1/null` and later exact ratios;
- all join-coverage keys present and non-negative integers;
- rejection bucket sum exactly equal to `submit.flows - persisted.flows`.

`validateValidationBranch` must enforce exact keys, integer/rate shapes, `affectedUsers <= affectedFlows <= form_view.flows`, `recoveredUsers <= recoveredFlows <= submit.flows`, recovered bounds, and exact ratios.

`validateFirstSessionTelemetryCoverage` must enforce exact keys, integer/rate shapes, `persistedFirstSessionUsers <= persisted_session.users`, `markerUsers <= persistedFirstSessionUsers`, and exact coverage.

Add a reusable exact-key helper:

```ts
function validateExactObjectKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  blockerCode: string,
  blockers: string[]
): void {
  const actual = Object.keys(value).sort();
  const expected = [...allowedKeys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    blockers.push(blockerCode);
  }
}
```

Use these exact schema key lists:

```ts
const SESSION_ACQUISITION_REPORT_KEYS = [
  "reportSchemaVersion",
  "generatedAt",
  "start",
  "end",
  "days",
  "eventRows",
  "sessionRows",
  "lifetimeSessionRows",
  "profileRows",
  "excludedEventRows",
  "excludedSessionRows",
  "funnelSteps",
  "canonicalFunnel",
  "validationBranch",
  "firstSessionTelemetryCoverage",
  "eventsByType",
  "eventsByPlatform",
  "sessionsBySource",
  "savedSessionUsers",
  "ratedSessionUsers",
  "faceHeightTruthUsers",
  "ratedFaceHeightTruthUsers",
  "savedSessions",
  "ratedSessions",
  "faceHeightTruthSessions",
  "ratedFaceHeightTruthSessions",
  "abandonedActors",
  "validationFailedActors",
  "activation",
  "onboarding",
  "readiness",
  "telemetryCoverage",
  "telemetryCoverageByPlatform",
  "recentTelemetry",
  "validationFailuresByCode",
  "gaps",
] as const;

const CANONICAL_FUNNEL_KEYS = [
  "grain",
  "ordering",
  "steps",
  "joinCoverage",
] as const;
const CANONICAL_STEP_KEYS = [
  "key",
  "label",
  "users",
  "flows",
  "pctOfStart",
  "pctOfPrevious",
] as const;
const CANONICAL_JOIN_COVERAGE_KEYS = [
  "funnelEventRowsMissingUserId",
  "funnelEventsMissingFlowId",
  "submitEventsMissingSessionId",
  "firstSessionMarkersMissingSessionId",
  "firstSessionMarkersMissingUserId",
  "funnelEventsWithUnusableClientStageAt",
  "stableIdConflictGroups",
  "submitFlowsWithoutWindowSession",
  "submitFlowsWithSessionOwnerMismatch",
  "submitFlowsWithIneligibleSession",
] as const;
const VALIDATION_BRANCH_KEYS = [
  "affectedUsers",
  "affectedFlows",
  "pctOfFormViewUsers",
  "recoveredUsers",
  "recoveredFlows",
  "recoveryRate",
] as const;
const FIRST_SESSION_TELEMETRY_KEYS = [
  "persistedFirstSessionUsers",
  "markerUsers",
  "coverage",
] as const;
```

Apply exact-key validation to the report root and the three new aggregate objects. Keep the existing UUID scan. Recursively reject exact identifier keys:

```ts
const UNSAFE_IDENTIFIER_KEYS = new Set([
  "user_id",
  "userId",
  "flow_id",
  "flowId",
  "event_id",
  "eventId",
  "session_id",
  "sessionId",
]);

const UNSAFE_IDENTIFIER_EVIDENCE_PATTERN =
  /\b(?:user_id|flow_id|event_id|session_id)\s*[:=]\s*\S+/i;
```

Reject unsafe evidence strings matching an identifier assignment pattern such as `user_id=...` or `flow_id: ...`. Do not reject aggregate field names like `submitEventsMissingSessionId` because the key check uses exact matches.

Add a rendered note that the fixed window can right-censor offline delivery after `end`; do not imply the report observes a mature follow-up horizon.

Update platform/build/recent validators and renderers to include Task 1 form-view fields.

- [ ] **Step 6: Make JSON writing fail closed**

Before writing, validate the report:

```ts
export function writeSessionAcquisitionReportJson(
  outputJsonPath: string,
  report: SessionAcquisitionReport
): string {
  const validation = validateSessionAcquisitionReport(report);
  if (!validation.ok) {
    throw new Error(
      "Refusing to write invalid session acquisition report: " +
        validation.blockers.join(", ")
    );
  }
  const resolvedPath = resolve(outputJsonPath);
  mkdirSync(dirname(resolvedPath), { recursive: true });
  writeFileSync(resolvedPath, JSON.stringify(report, null, 2) + "\n");
  return resolvedPath;
}
```

- [ ] **Step 7: Run focused tests and typecheck**

Run:

```bash
DOTENV_CONFIG_PATH=/Users/stevenchandler/Desktop/dev/quiver/.env.local NODE_OPTIONS="--require dotenv/config" yarn test:unit --runTestsByPath scripts/__tests__/session-acquisition-funnel-report.test.ts --runInBand -t "aggregate-only|saved JSON|schema v3|tamper|privacy|legacy telemetry corrections"
yarn typecheck
```

Expected: selected tests PASS; TypeScript exits 0.

- [ ] **Step 8: Review and commit schema-v3 output**

Review exact shape enforcement, false-positive privacy matches, zero denominators, stale schema rejection, extra-key rejection, renderer column alignment, and write-before-validation ordering. Then:

```bash
git diff --check
git add scripts/session-acquisition-funnel-report.ts scripts/__tests__/session-acquisition-funnel-report.test.ts
git commit -m "fix(analytics): validate canonical funnel reports"
```

---

### Task 6: Full QA And Read-Only Production Smoke

**Files:**
- Verify: `scripts/session-acquisition-funnel-report.ts`
- Verify: `scripts/__tests__/session-acquisition-funnel-report.test.ts`
- Generate temporarily: `/tmp/quiver-session-acquisition-funnel-v3.json`

**Interfaces:**
- Consumes: the completed schema-v3 report and local read-only production credentials.
- Produces: passing local gates, a validated aggregate production report, and a clean reviewed branch.

- [ ] **Step 1: Run the full focused report suite**

Run:

```bash
DOTENV_CONFIG_PATH=/Users/stevenchandler/Desktop/dev/quiver/.env.local NODE_OPTIONS="--require dotenv/config" yarn test:unit --runTestsByPath scripts/__tests__/session-acquisition-funnel-report.test.ts --runInBand
```

Expected: the complete report test file passes with zero failed tests.

- [ ] **Step 2: Run static gates**

Run:

```bash
yarn typecheck
yarn eslint --max-warnings=0 scripts/session-acquisition-funnel-report.ts scripts/__tests__/session-acquisition-funnel-report.test.ts
```

Expected: both commands exit 0 with no warnings promoted to errors.

- [ ] **Step 3: Generate a read-only 30-day production report**

Run:

```bash
yarn tsx scripts/session-acquisition-funnel-report.ts --days 30 --output-json /tmp/quiver-session-acquisition-funnel-v3.json
```

Expected: exit 0, aggregate Markdown on stdout, and a schema-v3 JSON file at the requested path. No database writes occur.

- [ ] **Step 4: Validate the generated JSON through the CLI**

Run:

```bash
yarn tsx scripts/session-acquisition-funnel-report.ts --validate-output-json /tmp/quiver-session-acquisition-funnel-v3.json --max-report-age-hours 1
```

Expected: exit 0 with `Session acquisition report JSON is valid`.

Print only aggregate verification:

```bash
node -e 'const r=require("/tmp/quiver-session-acquisition-funnel-v3.json"); console.log(JSON.stringify({schema:r.reportSchemaVersion,steps:r.canonicalFunnel.steps.map(({key,users,flows})=>({key,users,flows})),validation:r.validationBranch,firstSession:r.firstSessionTelemetryCoverage},null,2))'
```

Expected: schema `3`, exact four-step order, and aggregate counts only.

- [ ] **Step 5: Review the full branch like a PR**

Run:

```bash
git diff --check main...HEAD
git diff --stat main...HEAD
git status --short
```

Inspect the complete source/test diff for:

- cross-flow or cross-user stitching;
- out-of-window or invalid logical-time acceptance;
- stable-ID conflicts selecting a winner;
- overlap or gaps in persistence rejection buckets;
- deleted historical first-session misclassification;
- first markers contributing to submit;
- rates derived from flows instead of users;
- validator false positives/false negatives;
- raw identifiers in Markdown, JSON, blockers, gaps, or test evidence;
- weak tests that would still pass if ordering, ownership, or privacy were broken.

Fix every actionable finding in the owning task’s commit, rerun that task’s focused test and `yarn typecheck`, then repeat this review. Stop after five full review/fix cycles and report any remaining issue exactly.

- [ ] **Step 6: Confirm final state**

Expected final status:

```text
All focused tests pass.
Typecheck passes.
Targeted ESLint passes.
The read-only production report generates and validates as schema v3.
Only the two approved implementation files differ from the documentation commits.
No unresolved P1/P2 findings remain.
```

Do not create an empty verification commit. If review fixes changed code, commit them with the scoped Conventional Commit subject matching the owning behavior.
