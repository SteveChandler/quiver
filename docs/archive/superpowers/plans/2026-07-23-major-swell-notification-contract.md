# Major-Swell Notification Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make forecast-trend, official-only, and corroborated major-swell observations share one versioned, privacy-safe notification contract that is validated in shadow and can later enter enforcement only with durable hold proof.

**Architecture:** Extract the swell notification payload from the registry into a dedicated discriminated-union contract. Keep upstream evidence and enforcement proof inside the server payload, but project only user-safe beach, timing, severity, and physical forecast fields to push and in-app clients. Validate every shadow observation through the same parser used by the notification worker, while leaving automation and delivery disabled.

**Tech Stack:** TypeScript, Zod, Next.js route handlers, centralized notification registry, Jest.

## Global Constraints

- Major-swell automation and delivery remain disabled throughout this plan.
- `forecast_trend` requires real physical event values; do not synthesize missing height, period, peak date, or forecast timestamps.
- `official_advisory` requires official evidence and permits physical event values to remain `null`.
- `corroborated` requires both official evidence and real physical event values.
- An `enforce` payload is invalid unless it carries durable hold proof from an accepted hold transition.
- Internal evidence references, affected-cohort lists, hold IDs, and hold record IDs must never be copied into push or in-app client data.
- Physical forecast values are read-only inputs and remain unchanged.
- Existing queued forecast-trend payloads without a schema version must continue to validate through an explicit legacy adapter.
- No database migration or environment-variable change is part of this contract slice.

---

## File Structure

- Create `lib/notifications/types/major-swell.ts`: versioned schemas, legacy normalization, inferred payload types, and the single parser.
- Modify `lib/notifications/registry.ts`: import the extracted contract and create privacy-safe push/in-app projections.
- Modify `app/api/cron/swell-watch/route.ts`: add the schema version and validate every shadow payload before recording it.
- Modify `__tests__/lib/notifications/major-swell.test.ts`: contract truth table and legacy compatibility.
- Modify `__tests__/notifications/registry.test.ts`: client-projection privacy and official-only routing.
- Modify `__tests__/api/cron/swell-watch.test.ts`: producer/contract parity for all three signals.
- Modify `docs/archive/superpowers/plans/2026-07-23-major-swell-notification-contract.md`: record final verification evidence and activation preconditions after implementation.

---

### Task 1: Define the versioned discriminated-union contract

**Files:**
- Create: `lib/notifications/types/major-swell.ts`
- Create: `__tests__/lib/notifications/major-swell.test.ts`

**Interfaces:**
- Produces:
  - `MAJOR_SWELL_NOTIFICATION_SCHEMA_VERSION`
  - `majorSwellNotificationPayloadSchema`
  - `parseMajorSwellNotificationPayload(value: unknown): MajorSwellNotificationPayload`
  - `MajorSwellNotificationPayload`
- Consumed by: notification registry and swell-watch producer.

- [ ] **Step 1: Write the failing contract truth-table tests**

Create `__tests__/lib/notifications/major-swell.test.ts` with these cases:

```ts
import {
  MAJOR_SWELL_NOTIFICATION_SCHEMA_VERSION,
  parseMajorSwellNotificationPayload,
} from "@/lib/notifications/types/major-swell";

const physicalEvent = {
  event_start_date: "2026-08-01",
  peak_date: "2026-08-02",
  peak_height_ft: 8,
  peak_period_s: 16,
  forecast_at: "2026-08-02T15:00:00.000Z",
};

const base = {
  schema_version: MAJOR_SWELL_NOTIFICATION_SCHEMA_VERSION,
  beach_id: "11111111-1111-4111-8111-111111111111",
  beach_slug: "blacks",
  beach_name: "Black's Beach",
  awareness_mode: "shadow" as const,
  automation_enabled: false as const,
  awareness_severity: "major" as const,
  would_suppress_cohorts: ["beginner", "intermediate", "unknown"] as const,
  title: "Swell incoming — Black's Beach",
  body: "A major swell is approaching.",
};

describe("major swell notification contract", () => {
  it("accepts forecast-trend evidence with physical values", () => {
    expect(parseMajorSwellNotificationPayload({
      ...base,
      ...physicalEvent,
      awareness_signal: "forecast_trend",
      official_evidence_refs: [],
      enforcement: null,
    })).toMatchObject({ awareness_signal: "forecast_trend" });
  });

  it("accepts official-only evidence without invented physical values", () => {
    expect(parseMajorSwellNotificationPayload({
      ...base,
      event_start_date: null,
      peak_date: null,
      peak_height_ft: null,
      peak_period_s: null,
      forecast_at: null,
      awareness_signal: "official_advisory",
      official_evidence_refs: ["official:nws_alert:high-surf"],
      enforcement: null,
    })).toMatchObject({
      awareness_signal: "official_advisory",
      peak_height_ft: null,
    });
  });

  it("rejects corroborated evidence when physical values are missing", () => {
    expect(() => parseMajorSwellNotificationPayload({
      ...base,
      event_start_date: null,
      peak_date: null,
      peak_height_ft: null,
      peak_period_s: null,
      forecast_at: null,
      awareness_signal: "corroborated",
      official_evidence_refs: ["official:nws_alert:high-surf"],
      enforcement: null,
    })).toThrow();
  });

  it("rejects enforce mode without durable hold proof", () => {
    expect(() => parseMajorSwellNotificationPayload({
      ...base,
      ...physicalEvent,
      awareness_mode: "enforce",
      automation_enabled: true,
      awareness_signal: "corroborated",
      official_evidence_refs: ["official:nws_alert:high-surf"],
      enforcement: null,
    })).toThrow();
  });

  it("normalizes a queued unversioned forecast-trend payload", () => {
    const parsed = parseMajorSwellNotificationPayload({
      ...base,
      ...physicalEvent,
      schema_version: undefined,
      awareness_signal: "forecast_trend",
      official_evidence_refs: [],
    });
    expect(parsed.schema_version).toBe(
      MAJOR_SWELL_NOTIFICATION_SCHEMA_VERSION,
    );
    expect(parsed.enforcement).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test and verify the missing-module failure**

Run:

```bash
DOTENV_CONFIG_PATH=../../.env.local NODE_OPTIONS='-r dotenv/config' \
yarn jest __tests__/lib/notifications/major-swell.test.ts --runInBand
```

Expected: FAIL because `@/lib/notifications/types/major-swell` does not exist.

- [ ] **Step 3: Implement the contract**

Create `lib/notifications/types/major-swell.ts` with:

```ts
import { z } from "zod";

export const MAJOR_SWELL_NOTIFICATION_SCHEMA_VERSION =
  "major-swell-notification.v1" as const;

const instantSchema = z.string().datetime({ offset: true });
const cohortsSchema = z.array(
  z.enum(["beginner", "intermediate", "unknown"]),
);
const enforcementSchema = z.object({
  hold_id: z.string().uuid(),
  hold_record_id: z.string().uuid(),
  hold_valid_until: instantSchema,
}).strict();

const baseSchema = z.object({
  schema_version: z.literal(MAJOR_SWELL_NOTIFICATION_SCHEMA_VERSION),
  beach_id: z.string().uuid(),
  beach_slug: z.string().min(1).optional(),
  beach_name: z.string().min(1),
  awareness_severity: z.enum(["significant", "major"]),
  would_suppress_cohorts: cohortsSchema,
  title: z.string().min(1),
  body: z.string().min(1),
});

const physicalEventSchema = {
  event_start_date: z.string().date(),
  peak_date: z.string().date(),
  peak_height_ft: z.number().positive(),
  peak_period_s: z.number().positive(),
  forecast_at: instantSchema,
};

const shadowFields = {
  awareness_mode: z.literal("shadow"),
  automation_enabled: z.literal(false),
  enforcement: z.null(),
};

const enforceFields = {
  awareness_mode: z.literal("enforce"),
  automation_enabled: z.literal(true),
  enforcement: enforcementSchema,
};

const forecastTrendSchema = baseSchema.extend({
  ...physicalEventSchema,
  ...shadowFields,
  awareness_signal: z.literal("forecast_trend"),
  official_evidence_refs: z.array(z.string().min(1)).length(0),
}).strict();

const officialAdvisorySchema = baseSchema.extend({
  event_start_date: z.null(),
  peak_date: z.null(),
  peak_height_ft: z.null(),
  peak_period_s: z.null(),
  forecast_at: z.null(),
  ...shadowFields,
  awareness_signal: z.literal("official_advisory"),
  official_evidence_refs: z.array(z.string().min(1)).min(1),
}).strict();

const officialAdvisoryEnforceSchema = baseSchema.extend({
  event_start_date: z.null(),
  peak_date: z.null(),
  peak_height_ft: z.null(),
  peak_period_s: z.null(),
  forecast_at: z.null(),
  ...enforceFields,
  awareness_signal: z.literal("official_advisory"),
  official_evidence_refs: z.array(z.string().min(1)).min(1),
}).strict();

const corroboratedShadowSchema = baseSchema.extend({
  ...physicalEventSchema,
  ...shadowFields,
  awareness_signal: z.literal("corroborated"),
  official_evidence_refs: z.array(z.string().min(1)).min(1),
}).strict();

const corroboratedEnforceSchema = baseSchema.extend({
  ...physicalEventSchema,
  ...enforceFields,
  awareness_signal: z.literal("corroborated"),
  official_evidence_refs: z.array(z.string().min(1)).min(1),
}).strict();

export const majorSwellNotificationPayloadSchema = z.union([
  forecastTrendSchema,
  officialAdvisorySchema,
  officialAdvisoryEnforceSchema,
  corroboratedShadowSchema,
  corroboratedEnforceSchema,
]);

export type MajorSwellNotificationPayload = z.infer<
  typeof majorSwellNotificationPayloadSchema
>;

const legacyForecastTrendSchema = z.object({
  beach_id: z.string().min(1),
  beach_slug: z.string().min(1).optional(),
  beach_name: z.string().min(1),
  event_start_date: z.string().date(),
  peak_date: z.string().date(),
  peak_height_ft: z.number().positive(),
  peak_period_s: z.number().positive(),
  forecast_at: instantSchema,
  awareness_mode: z.literal("shadow"),
  automation_enabled: z.literal(false).optional(),
  awareness_signal: z.literal("forecast_trend"),
  awareness_severity: z.enum(["significant", "major"]),
  official_evidence_refs: z.array(z.string()).optional(),
  would_suppress_cohorts: cohortsSchema.optional(),
  title: z.string().min(1),
  body: z.string().min(1),
}).passthrough();

export function parseMajorSwellNotificationPayload(
  value: unknown,
): MajorSwellNotificationPayload {
  const current = majorSwellNotificationPayloadSchema.safeParse(value);
  if (current.success) return current.data;

  const legacy = legacyForecastTrendSchema.parse(value);
  return forecastTrendSchema.parse({
    ...legacy,
    schema_version: MAJOR_SWELL_NOTIFICATION_SCHEMA_VERSION,
    automation_enabled: false,
    official_evidence_refs: [],
    would_suppress_cohorts:
      legacy.would_suppress_cohorts ??
      ["beginner", "intermediate", "unknown"],
    enforcement: null,
  });
}
```

- [ ] **Step 4: Run the contract tests**

Run the command from Step 2.

Expected: 5 tests PASS.

- [ ] **Step 5: Commit the isolated contract**

```bash
git add \
  lib/notifications/types/major-swell.ts \
  __tests__/lib/notifications/major-swell.test.ts
git commit -m "feat(alerts): define major swell notification contract"
```

---

### Task 2: Route the notification registry through the contract

**Files:**
- Modify: `lib/notifications/registry.ts`
- Modify: `__tests__/notifications/registry.test.ts`

**Interfaces:**
- Consumes: `parseMajorSwellNotificationPayload` and `MajorSwellNotificationPayload`.
- Produces: worker validation plus privacy-safe push and in-app projections.

- [ ] **Step 1: Write failing registry projection tests**

Add tests asserting:

```ts
it("does not expose major-swell evidence or hold proof to clients", () => {
  const payload = NOTIFICATION_REGISTRY.swell_watch.validatePayload!({
    schema_version: "major-swell-notification.v1",
    beach_id: "11111111-1111-4111-8111-111111111111",
    beach_slug: "blacks",
    beach_name: "Black's Beach",
    event_start_date: "2026-08-01",
    peak_date: "2026-08-02",
    peak_height_ft: 8,
    peak_period_s: 16,
    forecast_at: "2026-08-02T15:00:00.000Z",
    awareness_mode: "enforce",
    automation_enabled: true,
    awareness_signal: "corroborated",
    awareness_severity: "major",
    official_evidence_refs: ["official:nws_alert:high-surf"],
    would_suppress_cohorts: ["beginner", "intermediate", "unknown"],
    enforcement: {
      hold_id: "22222222-2222-4222-8222-222222222222",
      hold_record_id: "33333333-3333-4333-8333-333333333333",
      hold_valid_until: "2026-08-03T00:00:00.000Z",
    },
    title: "Major swell incoming",
    body: "Advanced conditions are approaching.",
  });

  const push =
    NOTIFICATION_REGISTRY.swell_watch.buildPushPayload!(payload);
  const inApp =
    NOTIFICATION_REGISTRY.swell_watch.buildInAppPayload!(payload);
  for (const clientPayload of [push.data, inApp.data]) {
    expect(clientPayload).not.toHaveProperty("official_evidence_refs");
    expect(clientPayload).not.toHaveProperty("would_suppress_cohorts");
    expect(clientPayload).not.toHaveProperty("enforcement");
    expect(JSON.stringify(clientPayload)).not.toContain(
      "22222222-2222-4222-8222-222222222222",
    );
  }
});

it("omits nonexistent physical values from official-only push data", () => {
  const push = NOTIFICATION_REGISTRY.swell_watch.buildPushPayload!(
    officialOnlyPayload,
  );
  expect(push.data).not.toHaveProperty("forecast_at");
  expect(JSON.stringify(push.data)).not.toContain("null");
});
```

- [ ] **Step 2: Run the registry tests and verify failure**

Run:

```bash
DOTENV_CONFIG_PATH=../../.env.local NODE_OPTIONS='-r dotenv/config' \
yarn jest __tests__/notifications/registry.test.ts --runInBand
```

Expected: FAIL because the registry still owns a separate schema and exposes internal evidence.

- [ ] **Step 3: Replace the inline schema and payload interface**

In `lib/notifications/registry.ts`:

```ts
import {
  parseMajorSwellNotificationPayload,
  type MajorSwellNotificationPayload,
} from "./types/major-swell";
```

Delete the inline `swellWatchSchema` and `SwellWatchPayload`. Update the registry entry:

```ts
validatePayload: parseMajorSwellNotificationPayload,
buildPushPayload: (payload) => ({
  title: payload.title,
  body: payload.body,
  data: {
    type: "swell_watch",
    beach_id: payload.beach_id,
    ...(payload.beach_slug ? { beach_slug: payload.beach_slug } : {}),
    ...(payload.forecast_at ? { forecast_at: payload.forecast_at } : {}),
    awareness_signal: payload.awareness_signal,
    awareness_severity: payload.awareness_severity,
  },
}),
buildInAppPayload: (payload) => ({
  type: "swell_watch",
  data: {
    beach_id: payload.beach_id,
    ...(payload.beach_slug ? { beach_slug: payload.beach_slug } : {}),
    beach_name: payload.beach_name,
    event_start_date: payload.event_start_date,
    peak_date: payload.peak_date,
    peak_height_ft: payload.peak_height_ft,
    peak_period_s: payload.peak_period_s,
    forecast_at: payload.forecast_at,
    awareness_signal: payload.awareness_signal,
    awareness_severity: payload.awareness_severity,
    title: payload.title,
    body: payload.body,
  },
}),
```

Keep `satisfies NotificationTypeDef<MajorSwellNotificationPayload>`.

- [ ] **Step 4: Run registry and worker tests**

```bash
DOTENV_CONFIG_PATH=../../.env.local NODE_OPTIONS='-r dotenv/config' \
yarn jest \
  __tests__/notifications/registry.test.ts \
  __tests__/notifications/worker.test.ts \
  --runInBand
```

Expected: both suites PASS.

- [ ] **Step 5: Commit the registry integration**

```bash
git add \
  lib/notifications/registry.ts \
  __tests__/notifications/registry.test.ts
git commit -m "fix(notifications): project major swell payloads safely"
```

---

### Task 3: Validate every shadow observation through the production contract

**Files:**
- Modify: `app/api/cron/swell-watch/route.ts`
- Modify: `__tests__/api/cron/swell-watch.test.ts`

**Interfaces:**
- Consumes: `parseMajorSwellNotificationPayload`.
- Produces: `shadowEvaluations` containing normalized `MajorSwellNotificationPayload` values.

- [ ] **Step 1: Add failing producer parity assertions**

Update the swell-watch route tests so the forecast-trend, official-only, and corroborated fixtures assert:

```ts
expect(body.data.shadowEvaluations[0]).toMatchObject({
  schema_version: "major-swell-notification.v1",
  awareness_mode: "shadow",
  automation_enabled: false,
  enforcement: null,
});
```

For the official-only case retain:

```ts
expect(body.data.shadowEvaluations[0]).toMatchObject({
  awareness_signal: "official_advisory",
  event_start_date: null,
  peak_date: null,
  peak_height_ft: null,
  peak_period_s: null,
  forecast_at: null,
});
```

- [ ] **Step 2: Run the route tests and verify failure**

```bash
DOTENV_CONFIG_PATH=../../.env.local NODE_OPTIONS='-r dotenv/config' \
yarn jest __tests__/api/cron/swell-watch.test.ts --runInBand
```

Expected: FAIL because the producer omits `schema_version` and `enforcement`.

- [ ] **Step 3: Parse the producer output before returning it**

In `app/api/cron/swell-watch/route.ts`, replace the local payload interface with `MajorSwellNotificationPayload`, and construct payloads through:

```ts
const payload = parseMajorSwellNotificationPayload({
  schema_version: MAJOR_SWELL_NOTIFICATION_SCHEMA_VERSION,
  beach_id: beach.id,
  ...(beach.slug ? { beach_slug: beach.slug } : {}),
  beach_name: beach.name,
  event_start_date: event?.eventStartDate ?? null,
  peak_date: event?.peakDate ?? null,
  peak_height_ft: event?.peakHeightFt ?? null,
  peak_period_s: event?.peakPeriodS ?? null,
  forecast_at: event?.peakForecastAt ?? null,
  awareness_mode: "shadow",
  automation_enabled: false,
  awareness_signal: awareness.signal,
  awareness_severity: awareness.severity,
  official_evidence_refs: awareness.officialEvidenceRefs,
  would_suppress_cohorts: awareness.wouldSuppressCohorts,
  enforcement: null,
  title: copy.title,
  body: copy.body,
});
```

Return `{ payload }`. A schema mismatch must become that beach evaluation’s `state: "error"` and increment `summary.errors`; it must never be silently recorded as a valid shadow match.

- [ ] **Step 4: Run the route and contract tests**

```bash
DOTENV_CONFIG_PATH=../../.env.local NODE_OPTIONS='-r dotenv/config' \
yarn jest \
  __tests__/api/cron/swell-watch.test.ts \
  __tests__/lib/notifications/major-swell.test.ts \
  --runInBand
```

Expected: both suites PASS.

- [ ] **Step 5: Commit producer validation**

```bash
git add \
  app/api/cron/swell-watch/route.ts \
  __tests__/api/cron/swell-watch.test.ts
git commit -m "test(cron): validate swell shadow payload contracts"
```

---

### Task 4: Add the activation contract gate

**Files:**
- Modify: `__tests__/lib/notifications/major-swell.test.ts`
- Modify: `__tests__/notifications/registry.test.ts`
- Modify: `__tests__/api/cron/swell-watch.test.ts`

**Interfaces:**
- Consumes: the versioned parser and registry projections.
- Produces: one release-gate command proving shadow compatibility, enforcement proof requirements, privacy, and legacy support.

- [ ] **Step 1: Add the complete signal/mode matrix**

Add `it.each` coverage for:

| Signal | Mode | Physical values | Official refs | Hold proof | Result |
|---|---|---:|---:|---:|---|
| forecast_trend | shadow | required | empty | null | accept |
| official_advisory | shadow | null | required | null | accept |
| corroborated | shadow | required | required | null | accept |
| forecast_trend | enforce | required | empty | present | reject |
| official_advisory | enforce | null | required | missing | reject |
| official_advisory | enforce | null | required | present | accept |
| corroborated | enforce | required | required | missing | reject |
| corroborated | enforce | required | required | present | accept |

Forecast-only evidence remains shadow-only. Official-only and corroborated evidence can enter enforce mode only after an accepted durable hold transition supplies valid hold proof.

- [ ] **Step 2: Add mutation assertions**

For each accepted payload:

```ts
const original = structuredClone(payload);
parseMajorSwellNotificationPayload(payload);
expect(payload).toEqual(original);
```

This proves validation does not alter objective physical forecast inputs.

- [ ] **Step 3: Run the release-gate test command**

```bash
DOTENV_CONFIG_PATH=../../.env.local NODE_OPTIONS='-r dotenv/config' \
yarn jest \
  __tests__/lib/notifications/major-swell.test.ts \
  __tests__/notifications/registry.test.ts \
  __tests__/notifications/worker.test.ts \
  __tests__/api/cron/swell-watch.test.ts \
  __tests__/lib/recommendations/major-swell-awareness/official-advisory-adapter.test.ts \
  __tests__/lib/recommendations/major-swell-awareness/shadow-evaluator.test.ts \
  --runInBand
```

Expected: all suites PASS with zero snapshots changed.

- [ ] **Step 4: Run static gates**

```bash
DOTENV_CONFIG_PATH=../../.env.local NODE_OPTIONS='-r dotenv/config' \
yarn typecheck

yarn eslint \
  lib/notifications/types/major-swell.ts \
  lib/notifications/registry.ts \
  app/api/cron/swell-watch/route.ts \
  __tests__/lib/notifications/major-swell.test.ts \
  __tests__/notifications/registry.test.ts \
  __tests__/api/cron/swell-watch.test.ts \
  --max-warnings=0

git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit the activation gate**

```bash
git add \
  __tests__/lib/notifications/major-swell.test.ts \
  __tests__/notifications/registry.test.ts \
  __tests__/api/cron/swell-watch.test.ts
git commit -m "test(notifications): gate major swell activation contracts"
```

---

### Task 5: Record release and canary preconditions

**Files:**
- Modify: `docs/archive/superpowers/plans/2026-07-23-major-swell-notification-contract.md`

**Interfaces:**
- Consumes: final test output and commit SHAs.
- Produces: an explicit activation handoff; it does not flip any flag.

- [ ] **Step 1: Append the verification record**

Add a final section containing:

```md
## Verification Record

- Contract matrix: PASS
- Legacy queued payload compatibility: PASS
- Registry privacy projection: PASS
- Shadow producer parity: PASS
- Notification worker regression: PASS
- Typecheck: PASS
- Targeted lint: PASS
- Automation enabled: NO
- Delivery enabled: NO
```

- [ ] **Step 2: Record the separate activation prerequisites**

Add:

```md
## Activation Preconditions

1. The enforce producer must append and read back an accepted durable hold.
2. The enforce payload must carry the accepted hold and record IDs.
3. Beginner, intermediate, and unknown cohorts must receive no positive recommendation.
4. Protected alternatives require separate eligibility and hold resolution.
5. Push and in-app payloads must omit evidence references and hold identifiers.
6. Physical forecast values must match the pre-enforcement values exactly.
7. A single-beach manual canary must prove activation, extension, cancellation, and restoration.
8. Automation and delivery flags remain off until the canary is approved.
```

- [ ] **Step 3: Review the final diff**

Run:

```bash
git status --short
git diff --check
git diff --stat
```

Expected: only the planned files are changed and `git diff --check` exits 0.

- [ ] **Step 4: Commit the handoff**

```bash
git add docs/archive/superpowers/plans/2026-07-23-major-swell-notification-contract.md
git commit -m "docs(release): document major swell activation gate"
```

---

## Self-Review

- Spec coverage: forecast-trend, official-only, corroborated, legacy payloads, enforcement proof, client privacy, physical-value invariance, shadow validation, and activation gating are each assigned to an explicit task.
- Scope boundary: this plan prepares the contract and validation path only; it does not create holds, enable automation, or send notifications.
- Type consistency: `MajorSwellNotificationPayload` is the only payload type used by the producer and registry; `parseMajorSwellNotificationPayload` is the only parser.
- Deployment impact: no migration and no environment change; production behavior remains shadow-only.

## Verification Record

- Contract matrix: PASS
- Legacy queued payload compatibility: PASS
- Registry privacy projection: PASS
- Shadow producer parity: PASS
- Notification worker regression: PASS
- Typecheck: PASS
- Targeted lint: PASS
- Automation enabled: NO
- Delivery enabled: NO

## Activation Preconditions

1. The enforce producer must append and read back an accepted durable hold.
2. The enforce payload must carry the accepted hold and record IDs.
3. Beginner, intermediate, and unknown cohorts must receive no positive recommendation.
4. Protected alternatives require separate eligibility and hold resolution.
5. Push and in-app payloads must omit evidence references and hold identifiers.
6. Physical forecast values must match the pre-enforcement values exactly.
7. A single-beach manual canary must prove activation, extension, cancellation, and restoration.
8. Automation and delivery flags remain off until the canary is approved.
