# Phase 0A Major-Event Recommendation Hold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a narrow, audited, server-authoritative hold that prevents positive session recommendations for affected beginner, intermediate, and unknown-skill surfers without changing Quiver's objective forecasts.

**Architecture:** An append-only `regional_recommendation_holds` policy chain feeds one pure evaluator and response-specific sanitizers at every current recommendation boundary. The current California event is controlled manually; optional automation is a separate default-off rule that can create only beach/date holds from fresh official NWS high rip-current rows. Web and native receive a display-safe availability result, while physical wave, wind, tide, temperature, swell, and observation data remain unchanged.

**Tech Stack:** Next.js 16, React 19, TypeScript strict, Supabase/PostgreSQL and RLS, Zod, Jest, Playwright, Vercel Cron, Expo 55, React Native 0.83, TanStack Query 5, AsyncStorage, Maestro, Expo Updates.

## Global Constraints

- This is P0-A only; it does not implement the canonical event detector, beach projector, ranking engine, source policy, attribution envelope, or observation matcher.
- Objective forecast heights, periods, directions, swell partitions, wind, tide, temperature, observations, issue times, and forecast browsing remain unchanged.
- The affected default cohort is `beginner|intermediate|unknown`. Missing or invalid skill maps to `unknown`.
- Unknown skill never receives a positive recommendation in active scope.
- P0-A launches with `protected-alternative-explicit-none-v1`: protected alternatives are disabled because the current schema has no approved exposure class or calibrated high-side safety bound.
- A future protected alternative requires an explicit beach allowlist and a separately approved deterministic safety validator; preferences and geography inference cannot qualify it.
- `qa_only_evidence`, including scraped forecaster pages and social posts, may alert, support operator review, and seed fixtures. It cannot automatically activate, extend, replace, or cancel a hold and cannot change forecasts, eligibility, or ranking.
- Automatic activation accepts only fresh `rip_current_risks` rows with `risk_level='high'` and `source IN ('srf','alert')`. It rejects `source='derived'`.
- An official row is eligible only when its beach has a valid IANA timezone, `fetched_at` is between `now - 12 hours` and `now + 5 minutes`, and `valid_date` is between that beach's local civil today and local civil today plus two days, inclusive. There is no default timezone.
- The July 2026 current event uses the authenticated manual control path; P0-A must not pretend the rip-current rule is a hurricane-swell detector.
- Every transition has a mandatory expiry no more than seven days after effectiveness. Activation, extension, replacement, and cancellation append versions; they never update history.
- In `enforce` mode, unresolved hold state, missing candidate identity, or missing valid-time context cannot manufacture a positive recommendation.
- `MAJOR_EVENT_HOLD_MODE=off|shadow|enforce` and `MAJOR_EVENT_HOLD_AUTOMATION_ENABLED=true|false` are server-only. Do not add a `NEXT_PUBLIC_` or `EXPO_PUBLIC_` safety switch.
- Disabling automation never cancels an active record.
- Keep `WEEK_SCOUT_ENDPOINT_ENABLED=true` while enforcement is active because a 404 can trigger a native local fallback.
- Decision responses are `private, no-store, no-cache, must-revalidate`; hold enforcement runs after physical forecast caches.
- P0-A must ship an OTA/build for native runtime `1.0.1`. A previously installed offline client cannot be remotely changed; do not claim offline retroactive enforcement.
- Do not introduce a low-confidence label, confidence badge, or confidence-derived client behavior.
- Policy history contains only allowlisted reason codes and bounded opaque references. The access-denied operator mapping contains the sole auth-user link until erasure; neither table stores scraped text, URLs, email addresses, names, raw evidence, request bodies, or other free-form operator content.
- Completed policy chains are retained for 13 months after their final expiry, then removed only through the audited retention RPC. Deleting an operator removes the operator-to-opaque-reference mapping without deleting policy history or blocking account deletion.
- Do not apply the migration to any database until the migration plan is explicitly approved. A linked/production apply, deploy, OTA, hold activation, flag change, or production test requires a separate explicit release approval.
- Preserve unrelated dirty files. `next.config.mjs` is already dirty; review only the P0-A cache-header hunk.
- Do not commit unless the user separately and explicitly authorizes commits. Every commit step below is conditional.

---

## File Map

### Quiver server/web

- Create `supabase/migrations/20260717170000_create_regional_recommendation_holds.sql`.
- Create `scripts/db/regional-recommendation-holds-smoke.sql`.
- Create `lib/recommendations/major-event-hold/{types,config,repository,cohort,evaluator,service,control,automatic-evaluator}.ts`.
- Create `lib/recommendations/major-event-hold/adapters/{surf-discovery,surf-call,week-scout,bulk-forecast,legacy,regional,notification}.ts`.
- Create `app/api/admin/recommendation-holds/route.ts`.
- Create `app/api/cron/major-event-hold-evaluate/route.ts`.
- Create `app/api/cron/major-event-hold-retention/route.ts`.
- Create `scripts/recommendation-hold.ts`.
- Modify every authority and cache path named in Tasks 4-6.
- Create focused Jest tests, two Playwright specs, and `docs/runbooks/major-event-recommendation-hold.md`.

### Quiver Native

- Create `src/types/recommendation-availability.ts` and `src/lib/recommendation-hold.ts`.
- Modify discovery, Surf Call, map, Week Scout, foreground refresh, local Surf Call, home ranking, and plan-next ranking paths named in Task 7.
- Create focused Jest tests and `.maestro/flows/recommendations/major-event-hold.yaml`.

---

### Task 1: Create the Append-Only Hold Policy Store

**Files:**
- Create: `supabase/migrations/20260717170000_create_regional_recommendation_holds.sql`
- Create: `__tests__/migrations/regional-recommendation-holds.test.ts`
- Create: `scripts/db/regional-recommendation-holds-smoke.sql`
- Generate after approved local apply: `types/database.generated.ts`

**Interfaces:**
- Consumes: `auth.users`, `public.beaches`, service-role access.
- Produces: `regional_recommendation_hold_operator_refs`, `regional_recommendation_holds`, `append_regional_recommendation_hold_transition(jsonb)`, `resolve_active_regional_recommendation_holds(timestamptz,uuid[],timestamptz,timestamptz)`, `purge_expired_regional_recommendation_holds_v1()`, `erase_regional_recommendation_hold_operator_v1(uuid)`, and an atomic integration into the existing `delete_user_account(uuid)` erasure transaction.

- [ ] **Step 1: Write the failing migration contract test**

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260717170000_create_regional_recommendation_holds.sql",
);
const sql = readFileSync(migrationPath, "utf8");

describe("regional recommendation hold migration", () => {
  it("creates versioned bounded policy state", () => {
    expect(sql).toContain("CREATE TABLE public.regional_recommendation_holds");
    expect(sql).toContain("UNIQUE (hold_id, version)");
    expect(sql).toContain("expires_at <= effective_at + interval '7 days'");
    expect(sql).toContain("payload_hash");
  });

  it("is append-only and transactional", () => {
    expect(sql).toContain("BEFORE UPDATE OR DELETE");
    expect(sql).toContain("append_regional_recommendation_hold_transition");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("hold idempotency collision");
  });

  it("resolves only the latest active overlapping version", () => {
    expect(sql).toContain("resolve_active_regional_recommendation_holds");
    expect(sql).toContain("WHERE effective_at <= p_as_of");
    expect(sql).toContain("DISTINCT ON (hold_id)");
    expect(sql).toContain("status = 'active'");
    expect(sql).toContain("scope_beach_ids && p_beach_ids");
  });

  it("makes the append RPC the only service-role write path", () => {
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("REVOKE ALL ON public.regional_recommendation_holds FROM PUBLIC, anon, authenticated");
    expect(sql).toContain("REVOKE INSERT, UPDATE, DELETE ON public.regional_recommendation_holds FROM service_role");
    expect(sql).toContain("GRANT SELECT ON public.regional_recommendation_holds TO service_role");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.append_regional_recommendation_hold_transition(jsonb) TO service_role");
  });

  it("stores only bounded opaque metadata and supports erasure and retention", () => {
    expect(sql).toContain("regional_recommendation_hold_refs_are_safe");
    expect(sql).toContain("authorizing_operator_ref");
    expect(sql).toContain("ON DELETE CASCADE");
    expect(sql).not.toMatch(/\breason\s+text\b/i);
    expect(sql).toContain("reason_code");
    expect(sql).toContain("purge_expired_regional_recommendation_holds_v1");
    expect(sql).toContain("erase_regional_recommendation_hold_operator_v1");
    expect(sql.toLowerCase()).toContain("perform public.erase_regional_recommendation_hold_operator_v1(p_user_id)");
    expect(sql).toContain("interval '13 months'");
  });

  it("makes the database verify every automatic-official activation", () => {
    expect(sql).toContain("official-rip-high.v1");
    expect(sql).toContain("official_high_rip_current");
    expect(sql).toContain("FROM public.rip_current_risks");
    expect(sql).toContain("risk_level = 'high'");
    expect(sql).toContain("source IN ('srf','alert')");
    expect(sql).toContain("transaction_timestamp() - interval '12 hours'");
    expect(sql).toContain("transaction_timestamp() + interval '5 minutes'");
  });
});
```

- [ ] **Step 2: Run the test and verify red**

Run: `yarn test:unit __tests__/migrations/regional-recommendation-holds.test.ts --runInBand`

Expected: FAIL with `ENOENT` for the migration file.

- [ ] **Step 3: Add the exact schema contract**

The migration must create these immutable columns:

```sql
CREATE TABLE public.regional_recommendation_hold_operator_refs (
  operator_ref uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_user_id uuid NOT NULL UNIQUE
    REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.regional_recommendation_holds (
  record_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hold_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  transition text NOT NULL CHECK (
    transition IN ('activation','extension','replacement','cancellation')
  ),
  status text NOT NULL CHECK (status IN ('active','cancelled')),
  region_keys text[] NOT NULL DEFAULT '{}' CHECK (
    public.regional_recommendation_hold_region_keys_are_safe(region_keys)
  ),
  scope_beach_ids uuid[] NOT NULL CHECK (
    cardinality(scope_beach_ids) BETWEEN 1 AND 2000
  ),
  scope_exposure_classes text[] NOT NULL DEFAULT '{}' CHECK (
    scope_exposure_classes <@ ARRAY[
      'fully_exposed','partially_protected','protected','unknown'
    ]::text[]
  ),
  protected_alternative_beach_ids uuid[] NOT NULL DEFAULT '{}' CHECK (
    cardinality(protected_alternative_beach_ids) <= 2000
  ),
  event_reference text CHECK (
    event_reference IS NULL
    OR event_reference ~ '^(event|official|qa):[a-z0-9_]+:[A-Za-z0-9_-]{1,64}$'
  ),
  valid_from timestamptz NOT NULL,
  valid_until timestamptz NOT NULL CHECK (valid_until > valid_from),
  affected_cohorts text[] NOT NULL CHECK (
    cardinality(affected_cohorts) > 0
    AND affected_cohorts <@ ARRAY['beginner','intermediate','advanced','expert','unknown']::text[]
  ),
  action text NOT NULL CHECK (
    action IN ('suppress_positive','protected_alternatives_only')
  ),
  trigger_type text NOT NULL CHECK (
    trigger_type IN ('automatic_official','manual_operator')
  ),
  supporting_evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (
    jsonb_typeof(supporting_evidence_refs) = 'array'
    AND public.regional_recommendation_hold_refs_are_safe(supporting_evidence_refs)
  ),
  automatic_policy_version text CHECK (
    automatic_policy_version IS NULL
    OR automatic_policy_version ~ '^[a-z0-9._-]{1,64}$'
  ),
  authorizing_operator_ref uuid,
  authorizing_actor text NOT NULL CHECK (
    authorizing_actor IN ('admin_api','official_automation')
  ),
  reason_code text NOT NULL CHECK (
    reason_code IN (
      'major_swell_manual_safety',
      'official_high_rip_current',
      'scope_correction',
      'event_expired',
      'operator_cancelled',
      'policy_rollback'
    )
  ),
  effective_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL CHECK (
    expires_at > effective_at
    AND expires_at <= effective_at + interval '7 days'
  ),
  supersedes_record_id uuid REFERENCES public.regional_recommendation_holds(record_id),
  idempotency_key text NOT NULL UNIQUE CHECK (
    idempotency_key ~ '^[A-Za-z0-9:_-]{1,160}$'
  ),
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  request_id text CHECK (
    request_id IS NULL OR request_id ~ '^[A-Za-z0-9:_-]{1,96}$'
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hold_id, version),
  UNIQUE (supersedes_record_id),
  CHECK (
    (transition='activation' AND version=1 AND supersedes_record_id IS NULL)
    OR
    (transition<>'activation' AND version>1 AND supersedes_record_id IS NOT NULL)
  ),
  CHECK (
    (transition='cancellation' AND status='cancelled')
    OR
    (transition<>'cancellation' AND status='active')
  ),
  CHECK (
    (trigger_type='manual_operator'
      AND authorizing_operator_ref IS NOT NULL
      AND automatic_policy_version IS NULL)
    OR
    (trigger_type='automatic_official'
      AND authorizing_operator_ref IS NULL
      AND automatic_policy_version IS NOT NULL
      AND jsonb_array_length(supporting_evidence_refs) > 0)
  ),
  CHECK (
    action<>'protected_alternatives_only'
    OR cardinality(protected_alternative_beach_ids)>0
  ),
  CHECK (
    trigger_type<>'automatic_official'
    OR (
      transition='activation'
      AND action='suppress_positive'
      AND affected_cohorts=ARRAY['beginner','intermediate','unknown']::text[]
      AND cardinality(scope_beach_ids)=1
      AND cardinality(region_keys)=0
      AND cardinality(scope_exposure_classes)=0
      AND cardinality(protected_alternative_beach_ids)=0
      AND automatic_policy_version='official-rip-high.v1'
      AND authorizing_actor='official_automation'
      AND reason_code='official_high_rip_current'
      AND jsonb_array_length(supporting_evidence_refs)=1
    )
  )
);
```

The table checks freeze the automatic tuple, but the append RPC is the actual
official-evidence trust boundary. For `trigger_type='automatic_official'`, the
RPC accepts exactly one `official:rip_current_risks:<uuid>` reference, extracts
the UUID without accepting any caller-supplied source metadata, and locks the
matching `rip_current_risks` row plus its `beaches` row. It rejects a missing
row, a beach mismatch, `risk_level<>'high'`, `source NOT IN ('srf','alert')`, an
invalid/missing beach IANA timezone, `fetched_at` outside
`[transaction_timestamp()-12 hours, transaction_timestamp()+5 minutes]`, or a
`valid_date` outside the beach-local interval `[today,today+2 days]`. A `qa:*`
reference can therefore never authorize an automatic row.

The RPC does not trust automatic action, cohort, author, validity, effective,
expiry, or policy fields from the application. After resolving the official
row, it normalizes them to `suppress_positive`,
`['beginner','intermediate','unknown']`, `official_automation`, the one matched
beach with empty region/exposure/protected-alternative scopes,
`official-rip-high.v1`, and `official_high_rip_current`; sets both
`event_reference` and the sole supporting-evidence reference to that exact
official row; derives
`valid_from`/`valid_until` from the risk row's local civil day; sets
`effective_at` to the later of transaction time and `valid_from`; and sets
`expires_at=valid_until`. The normalized stored tuple—not the submitted
automatic body—is canonicalized and hashed. An existing automatic idempotency
key is checked before time-dependent normalization, so an identical retry
returns its original record and cannot drift with the clock. Any submitted
automatic field that conflicts with the normalized tuple is rejected rather
than silently accepted. Manual rows must have `authorizing_actor='admin_api'`;
automatic rows can be created only through this verified RPC branch.

`regional_recommendation_hold_operator_refs` is the only table that links an
opaque `operator_ref` to `auth.users.id`. The append RPC resolves or creates
that mapping from the authenticated admin ID and stores only `operator_ref` in
the policy row; there is deliberately no foreign key from policy history back
to the mapping. `erase_regional_recommendation_hold_operator_v1(p_user_id)`
deletes only that mapping. Replace the current canonical
`delete_user_account(uuid)` body from
`20260427182722_patch_delete_user_account_drop_dead_column_refs.sql` with an
otherwise behavior-equivalent body that calls
`PERFORM public.erase_regional_recommendation_hold_operator_v1(p_user_id);`
inside its existing transaction before profile anonymization. This is required
because Quiver bans, rather than deletes, the `auth.users` row. `ON DELETE
CASCADE` is a backup for a later hard auth deletion. Both paths remove the
identity link while leaving anonymous policy history and never block account
erasure.

Add immutable SQL helpers
`regional_recommendation_hold_refs_are_safe(jsonb)` and
`regional_recommendation_hold_region_keys_are_safe(text[])` and use them in
table checks and again inside the append RPC. Evidence has at most 16 unique JSON
strings; each string is 1-128 ASCII characters and matches exactly
`^(official:rip_current_risks:[0-9a-f-]{36}|qa:artifact:[A-Za-z0-9_-]{1,64})$`.
Reject objects, URLs, whitespace, `@`, text excerpts, duplicate references,
and unknown namespaces. Region scope has at most 64 unique keys and every key
matches `^[a-z0-9][a-z0-9_-]{0,63}$`. Bound `event_reference`, `idempotency_key`,
`payload_hash`, and `request_id` with the same opaque-token principle. The API
accepts `reasonCode`, never a free-form reason or note; raw official payloads,
scraped content, operator names/emails, and request bodies never enter either
table.

Add GIN indexes for beach, region, and cohort arrays; time/latest indexes; an
append-only trigger rejecting UPDATE/DELETE; and service-role-only RLS/grants.
Revoke `INSERT`, `UPDATE`, and `DELETE` from `service_role` after all functions
exist. Grant it only `SELECT` on policy rows and `EXECUTE` on the append,
resolver, retention, and operator-erasure RPCs. Every mutating RPC is `SECURITY DEFINER` with
`SET search_path = public, pg_temp`; revoke function execution from `PUBLIC`,
`anon`, and `authenticated`. No application path calls `.insert()`, `.update()`,
or `.delete()` on the policy table.

Enable RLS on the operator mapping too and revoke all table privileges from
`PUBLIC`, `anon`, `authenticated`, and `service_role`. Only the append RPC's
definer may resolve/create a mapping; client and service code never list it.

`append_regional_recommendation_hold_transition(jsonb)` must advisory-lock the
hold ID, return an existing row only when idempotency key and payload hash both
match, enforce exact next-version/supersession, validate all metadata bounds,
resolve the opaque operator mapping, and insert one row in its transaction.
For a manual call, `operatorUserId` is a transient RPC input used only to
resolve that mapping. The function removes it before canonicalization and
computes `payload_hash` from normalized stored fields containing
`authorizing_operator_ref`; the auth UUID is never stored, hashed into the
row, returned, or included in database error text.

The resolver must filter future-effective rows *before* latest-version
selection so a scheduled replacement or cancellation cannot hide a currently
effective version:

```sql
WITH effective_versions AS (
  SELECT *
  FROM public.regional_recommendation_holds
  WHERE effective_at <= p_as_of
), latest AS (
  SELECT DISTINCT ON (hold_id) *
  FROM effective_versions
  ORDER BY hold_id, version DESC
)
SELECT *
FROM latest
WHERE status = 'active'
  AND expires_at > p_as_of
  AND valid_from < p_window_end
  AND valid_until > p_window_start
  AND scope_beach_ids && p_beach_ids;
```

`purge_expired_regional_recommendation_holds_v1()` takes no caller-controlled
clock and uses `transaction_timestamp()`. It may delete only a whole hold chain
whose latest version is cancelled or expired with no future-effective version,
and whose every row has
`expires_at < transaction_timestamp() - interval '13 months'`. It uses a transaction-local
purge guard recognized by the append-only trigger, reports deleted chain and
row counts, and cannot touch an active, future-effective, partially eligible,
or mixed-age chain. Direct deletion remains denied.

`erase_regional_recommendation_hold_operator_v1(p_user_id)` advisory-locks the
user ID, deletes the mapping if present, returns only `{ mapping_deleted:
boolean }`, and never deletes or updates a policy row. Revoke it from
`PUBLIC`, `anon`, and `authenticated`; grant execution only to `service_role`
and exercise the account-erasure integration in the SQL fixture.

- [ ] **Step 4: Run the static test**

Run: `yarn test:unit __tests__/migrations/regional-recommendation-holds.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 5: Add the transactional SQL fixture**

Create `scripts/db/regional-recommendation-holds-smoke.sql` with `ON_ERROR_STOP`
and one `BEGIN`/`ROLLBACK` transaction. The fixture must:

1. `SET LOCAL ROLE service_role`, attempt a direct table `INSERT` inside a
   `DO` block, and fail the fixture unless SQLSTATE is `42501`; then `RESET
   ROLE`.
2. As the local database owner, insert activation version 1 effective one hour
   ago and scheduled cancellation version 2 effective one hour in the future
   for the same generated hold/beach IDs.
3. Assert the resolver returns version 1 at fixture `now`, proving the
   `effective_at` predicate occurs before `DISTINCT ON`.
4. Assert the resolver returns no row two hours later, when version 2 is
   effective.
5. Assert the append RPC rejects a URL, an email-shaped reference, 17 refs, a
   duplicate ref, a free-form reason field, and an unknown reason code.
6. Insert official-risk fixtures and prove the RPC accepts one fresh `high`
   `srf`/`alert` row only after deriving the exact automatic tuple. Prove it
   rejects a nonexistent reference, a `qa:*` reference, derived/moderate,
   stale/future-fetched, out-of-range local date, invalid timezone, mismatched
   beach, altered action/cohorts/policy/author/reason, and any automatic
   extension, replacement, or cancellation.
7. Add one terminal chain older than 13 months, one 12-month terminal chain,
   and one active chain; call the purge RPC; assert only the 13-month chain is
   deleted as a whole.
8. Create an operator mapping plus a policy row using its opaque reference,
   invoke the ordinary `delete_user_account(fixture_operator_id)` flow, and
   assert the still-present/banned `auth.users` row has no mapping while the
   policy row remains with no recoverable user ID. Also hard-delete a second
   fixture auth user to prove the backup `ON DELETE CASCADE` path.

The fixture uses generated UUIDs and no production IDs. Every assertion raises
an exception with a unique message so a false positive cannot exit zero.

- [ ] **Step 6: Stop for migration approval**

Present the exact diff, RLS/grants, expiry checks, expected row volume, RPC
behavior, privacy/erasure contract, 13-month chain purge, and rollback. Do not
run a database command yet.

- [ ] **Step 7: After approval, apply locally, run the fixture, and regenerate types**

```bash
supabase db reset
psql 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' -v ON_ERROR_STOP=1 -f scripts/db/regional-recommendation-holds-smoke.sql
yarn db:types
yarn typecheck
```

Expected: PASS; generated types include both tables and all four new RPCs. Do not
run `yarn db:types:remote` and do not substitute a linked or production URL.

- [ ] **Step 8: Commit only if explicitly authorized**

```bash
git add supabase/migrations/20260717170000_create_regional_recommendation_holds.sql __tests__/migrations/regional-recommendation-holds.test.ts scripts/db/regional-recommendation-holds-smoke.sql types/database.generated.ts
git commit -m "feat(safety): add append-only recommendation holds"
```

### Task 2: Implement the Pure Evaluator and Server Resolver

**Files:**
- Create: `lib/recommendations/major-event-hold/types.ts`
- Create: `lib/recommendations/major-event-hold/config.ts`
- Create: `lib/recommendations/major-event-hold/cohort.ts`
- Create: `lib/recommendations/major-event-hold/evaluator.ts`
- Create: `lib/recommendations/major-event-hold/repository.ts`
- Create: `lib/recommendations/major-event-hold/service.ts`
- Create: `__tests__/lib/recommendations/major-event-hold/evaluator.test.ts`
- Create: `__tests__/lib/recommendations/major-event-hold/repository.test.ts`
- Create: `__tests__/lib/recommendations/major-event-hold/service.test.ts`

**Interfaces:**
- Consumes: Task 1 resolver RPC and profile experience.
- Produces: `evaluateMajorEventHold()`, `evaluateMajorEventHoldCandidates()`, and `RecommendationAvailability`.

- [ ] **Step 1: Write the failing cohort/evaluator matrix**

```ts
it.each(["beginner", "intermediate", "unknown"] as const)(
  "returns explicit none for affected %s",
  (cohort) => {
    expect(evaluateMajorEventHold({
      mode: "enforce",
      resolutionState: "resolved",
      holds: [activeHold],
      cohort,
      candidate: heldCandidate,
    })).toMatchObject({
      outcome: "explicit_none",
      reasonCode: "major_event_hold",
    });
  },
);

it("maps missing and invalid profile skill to unknown", () => {
  expect(mapSafetyCohort(null)).toBe("unknown");
  expect(mapSafetyCohort("novice-ish")).toBe("unknown");
});

it("fails closed when hold state is unresolved", () => {
  expect(evaluateMajorEventHold({
    mode: "enforce",
    resolutionState: "unresolved",
    holds: [],
    cohort: "expert",
    candidate: heldCandidate,
  })).toMatchObject({
    outcome: "explicit_none",
    reasonCode: "hold_state_unavailable",
  });
});

it("does not emit a protected alternative in P0-A", () => {
  expect(P0_PROTECTED_ALTERNATIVE_POLICY_VERSION)
    .toBe("protected-alternative-explicit-none-v1");
  expect(evaluateMajorEventHold({
    mode: "enforce",
    resolutionState: "resolved",
    holds: [{ ...activeHold, action: "protected_alternatives_only" }],
    cohort: "beginner",
    candidate: heldCandidate,
  }).outcome).toBe("explicit_none");
});
```

- [ ] **Step 2: Run the tests and verify red**

Run: `yarn test:unit __tests__/lib/recommendations/major-event-hold --runInBand`

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Define the exact client-safe contract**

```ts
export type SafetyCohort =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "expert"
  | "unknown";

export type MajorEventHoldMode = "off" | "shadow" | "enforce";

export interface RecommendationAvailability {
  state: "available" | "none";
  reasonCode?: "major_event_hold" | "hold_state_unavailable";
  expiresAt?: string;
  holdEpoch: string;
}

export interface MajorEventHoldCandidate {
  candidateId: string;
  beachId: string;
  startsAt: string;
  endsAt: string;
}

export interface MajorEventHoldEvaluation {
  outcome: "allow" | "explicit_none";
  reasonCode?: "major_event_hold" | "hold_state_unavailable";
  holdIds: string[];
  expiresAt?: string;
  holdEpoch: string;
}
```

Client payloads contain no supporting evidence, operator identity, internal
safety values, reliability, or confidence.

- [ ] **Step 4: Implement config, resolution, and evaluation**

`config.ts` strictly parses `off|shadow|enforce`; invalid values throw at
server startup. The repository calls the resolver RPC once for a batch of beach
IDs and windows, validates every returned row, and returns `unresolved` on
transport or shape failure. The evaluator checks beach scope, valid-window
overlap, affected cohort, and latest hold status. `shadow` records a
would-block audit but returns allow; `enforce` returns explicit none.

The service evaluates before response truncation and returns a stable
`holdEpoch` derived from sorted active record IDs/versions. Missing candidate
identity or valid-time information is unresolved in enforce mode.

- [ ] **Step 5: Run focused gates**

```bash
yarn test:unit __tests__/lib/recommendations/major-event-hold --runInBand
yarn typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit only if explicitly authorized**

```bash
git add lib/recommendations/major-event-hold/types.ts lib/recommendations/major-event-hold/config.ts lib/recommendations/major-event-hold/cohort.ts lib/recommendations/major-event-hold/evaluator.ts lib/recommendations/major-event-hold/repository.ts lib/recommendations/major-event-hold/service.ts __tests__/lib/recommendations/major-event-hold
git commit -m "feat(safety): add major-event hold evaluator"
```

### Task 3: Add Audited Manual Control and Narrow Official Automation

**Files:**
- Create: `lib/recommendations/major-event-hold/control.ts`
- Create: `lib/recommendations/major-event-hold/automatic-evaluator.ts`
- Create: `app/api/admin/recommendation-holds/route.ts`
- Create: `app/api/cron/major-event-hold-evaluate/route.ts`
- Create: `app/api/cron/major-event-hold-retention/route.ts`
- Create: `scripts/recommendation-hold.ts`
- Create: `__tests__/lib/recommendations/major-event-hold/control.test.ts`
- Create: `__tests__/lib/recommendations/major-event-hold/automatic-evaluator.test.ts`
- Create: `__tests__/app/api/admin/recommendation-holds/route.test.ts`
- Create: `__tests__/app/api/cron/major-event-hold-evaluate/route.test.ts`
- Create: `__tests__/app/api/cron/major-event-hold-retention/route.test.ts`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: Task 1 append RPC, authenticated admin identity, and official `rip_current_risks`.
- Produces: append-only manual transitions, default-off `official-rip-high.v1` automatic activations, and a flag-independent 13-month retention run.

- [ ] **Step 1: Write failing control tests**

```ts
it("requires an authenticated operator for a manual transition", async () => {
  await expect(appendHoldTransition(
    manualActivation,
    { ...dependencies, operatorUserId: null },
  )).rejects.toThrow("manual transition requires an operator");
});

it("rejects an idempotency collision", async () => {
  dependencies.rpc.mockRejectedValue(new Error("hold idempotency collision"));
  await expect(appendHoldTransition(manualActivation, dependencies))
    .rejects.toThrow("hold idempotency collision");
});

it("never updates or deletes policy history", async () => {
  await appendHoldTransition(manualActivation, dependencies);
  expect(dependencies.update).not.toHaveBeenCalled();
  expect(dependencies.delete).not.toHaveBeenCalled();
});

it("does not let the admin route claim the automatic-official trigger", async () => {
  const response = await POST_ADMIN(makeAdminRequest({
    ...manualActivation,
    triggerType: "automatic_official",
  }));
  expect(response.status).toBe(400);
  expect(dependencies.rpc).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Write the official-evidence matrix**

```ts
it("creates a beach/date proposal only for fresh official high risk", () => {
  expect(evaluateOfficialRipCurrentHolds({
    rows: [{
      ...officialHighRisk,
      valid_date: "2026-07-17",
      fetched_at: "2026-07-17T19:00:00.000Z",
      beach_timezone: "America/Los_Angeles",
    }],
    now: new Date("2026-07-17T20:00:00.000Z"),
  })).toEqual([expect.objectContaining({
    triggerType: "automatic_official",
    automaticPolicyVersion: "official-rip-high.v1",
    scopeBeachIds: [officialHighRisk.beach_id],
    affectedCohorts: ["beginner", "intermediate", "unknown"],
    supportingEvidenceRefs: [
      `official:rip_current_risks:${officialHighRisk.id}`,
    ],
    validFrom: "2026-07-17T07:00:00.000Z",
    validUntil: "2026-07-18T07:00:00.000Z",
  })]);
});

it.each([
  { source: "derived", risk_level: "high", fetched_at: "2026-07-17T19:00:00.000Z", valid_date: "2026-07-17", beach_timezone: "America/Los_Angeles" },
  { source: "alert", risk_level: "moderate", fetched_at: "2026-07-17T19:00:00.000Z", valid_date: "2026-07-17", beach_timezone: "America/Los_Angeles" },
  { source: "srf", risk_level: "high", fetched_at: "2026-07-17T07:59:59.999Z", valid_date: "2026-07-17", beach_timezone: "America/Los_Angeles" },
  { source: "srf", risk_level: "high", fetched_at: "2026-07-17T20:05:00.001Z", valid_date: "2026-07-17", beach_timezone: "America/Los_Angeles" },
  { source: "srf", risk_level: "high", fetched_at: "2026-07-17T19:00:00.000Z", valid_date: "2026-07-16", beach_timezone: "America/Los_Angeles" },
  { source: "srf", risk_level: "high", fetched_at: "2026-07-17T19:00:00.000Z", valid_date: "2026-07-20", beach_timezone: "America/Los_Angeles" },
  { source: "srf", risk_level: "high", fetched_at: "2026-07-17T19:00:00.000Z", valid_date: "2026-07-17", beach_timezone: null },
  { source: "srf", risk_level: "high", fetched_at: "2026-07-17T19:00:00.000Z", valid_date: "2026-07-17", beach_timezone: "Not/A_Zone" },
])("rejects nonapproved automatic input", (input) => {
  expect(evaluateOfficialRipCurrentHolds({
    rows: [buildRiskRow(input)],
    now: new Date("2026-07-17T20:00:00.000Z"),
  })).toEqual([]);
});

it("interprets valid_date in the beach civil day rather than UTC", () => {
  const proposals = evaluateOfficialRipCurrentHolds({
    rows: [buildRiskRow({
      source: "alert",
      risk_level: "high",
      fetched_at: "2026-07-18T06:00:00.000Z",
      valid_date: "2026-07-17",
      beach_timezone: "America/Los_Angeles",
    })],
    now: new Date("2026-07-18T06:30:00.000Z"),
  });
  expect(proposals).toEqual([expect.objectContaining({
    validFrom: "2026-07-17T07:00:00.000Z",
    validUntil: "2026-07-18T07:00:00.000Z",
  })]);
});

it("runs retention even when activation automation is disabled", async () => {
  process.env.MAJOR_EVENT_HOLD_AUTOMATION_ENABLED = "false";
  mockPurgeExpiredHolds.mockResolvedValue({ chains_deleted: 2, rows_deleted: 5 });
  const response = await GET_RETENTION(makeCronRequest());
  expect(response.status).toBe(200);
  expect(mockPurgeExpiredHolds).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 3: Run tests and verify red**

Run: `yarn test:unit __tests__/lib/recommendations/major-event-hold/control.test.ts __tests__/lib/recommendations/major-event-hold/automatic-evaluator.test.ts __tests__/app/api/cron/major-event-hold-retention/route.test.ts --runInBand`

Expected: FAIL because the modules are absent.

- [ ] **Step 4: Implement the control boundary**

`appendHoldTransition()` canonicalizes the public policy fields, resolves
region keys to a concrete beach snapshot, enforces bounded expiry, and calls
only the Task 1 append RPC. Manual records require `context.user.id`; the RPC
maps it to `authorizingOperatorRef`, so no auth UUID is stored in policy
history or its payload hash. The Zod boundary is strict and accepts `reasonCode`, bounded opaque
`eventReference`/`supportingEvidenceRefs`, and no free-form note, URL, source
text, operator identity field, or unknown property.
`withAdminAuth` protects GET/POST; POST accepts only
`activate|extend|replace|cancel`, forcibly constructs
`triggerType='manual_operator'`, and rejects a body containing
`triggerType`, `automaticPolicyVersion`, or `authorizingActor`. Only the
authenticated evaluation cron may request the RPC's automatic branch, and the
database independently re-verifies and normalizes that branch as specified in
Task 1. Route/RPC logs contain only request ID, hold
ID, transition, reason code, and success/error code; they never log request
bodies, evidence content, the transient auth UUID, cookie, name, or email.

The CLI reads `QUIVER_ADMIN_COOKIE`, calls the admin API, and has no Supabase
client. It supports `list-active`, `activate`, `extend`, `replace`, and
`cancel`.

- [ ] **Step 5: Implement default-off automatic evaluation**

The evaluation cron returns before a data query unless automation is true. It
joins each high `srf|alert` row to `beaches.timezone`, rejects missing or
invalid IANA zones, and uses `formatInTimeZone`/`fromZonedTime` from
`date-fns-tz`; it never falls back to Los Angeles, UTC, or server time. A row is
fresh only for `now - 12 hours <= fetched_at <= now + 5 minutes`. Its
`valid_date` must be within `[beach-local today, beach-local today + 2 days]`.
The hold window is exactly local midnight at `valid_date` through the next
local midnight, converted to UTC so 23/25-hour DST days stay correct. For the
current local day `effectiveAt=now`; for a future local day
`effectiveAt=validFrom`; in both cases `expiresAt=validUntil`. The cron creates idempotent beach/date holds for
beginner/intermediate/unknown. It never extends or cancels a manual record. QA
references and `derived` risk rows are rejected.

`major-event-hold-retention` is a separate weekly authenticated cron. It runs
regardless of hold mode and automation mode, calls the no-argument
`purge_expired_regional_recommendation_holds_v1()`, emits chain/row counts, and
alerts on failure. It never calls the append RPC and never purges a chain less
than 13 months old. Add `{ "path": "/api/cron/major-event-hold-retention",
"schedule": "15 9 * * 0" }` to `vercel.json`; disabling
automatic activation must not disable privacy retention.

- [ ] **Step 6: Run route and type gates**

```bash
yarn test:unit __tests__/lib/recommendations/major-event-hold/control.test.ts __tests__/lib/recommendations/major-event-hold/automatic-evaluator.test.ts __tests__/app/api/admin/recommendation-holds/route.test.ts __tests__/app/api/cron/major-event-hold-evaluate/route.test.ts __tests__/app/api/cron/major-event-hold-retention/route.test.ts --runInBand
yarn typecheck
```

Expected: PASS; unauthorized calls fail, disabled automation makes zero data
calls, and identical retries return the original record.

- [ ] **Step 7: Commit only if explicitly authorized**

```bash
git add lib/recommendations/major-event-hold/control.ts lib/recommendations/major-event-hold/automatic-evaluator.ts app/api/admin/recommendation-holds/route.ts app/api/cron/major-event-hold-evaluate/route.ts app/api/cron/major-event-hold-retention/route.ts scripts/recommendation-hold.ts __tests__/lib/recommendations/major-event-hold/control.test.ts __tests__/lib/recommendations/major-event-hold/automatic-evaluator.test.ts __tests__/app/api/admin/recommendation-holds/route.test.ts __tests__/app/api/cron/major-event-hold-evaluate/route.test.ts __tests__/app/api/cron/major-event-hold-retention/route.test.ts vercel.json
git commit -m "feat(safety): add audited hold control path"
```

### Task 4: Enforce Every Recommendation API Boundary

**Files:**
- Create: `lib/recommendations/major-event-hold/adapters/surf-discovery.ts`
- Create: `lib/recommendations/major-event-hold/adapters/surf-call.ts`
- Create: `lib/recommendations/major-event-hold/adapters/week-scout.ts`
- Create: `lib/recommendations/major-event-hold/adapters/bulk-forecast.ts`
- Create: `lib/recommendations/major-event-hold/adapters/legacy.ts`
- Modify: `app/api/surf/discover/route.ts`
- Modify: `app/api/surf/call/route.ts`
- Modify: `app/api/surf/week-scout/route.ts`
- Modify: `app/api/v1/recommendations/route.ts`
- Modify: `app/api/forecasts/bulk/route.ts`
- Modify: `app/api/forecasts/scored/[beachId]/route.ts`
- Modify: `app/api/beach-daily-intel/route.ts`
- Modify: `app/api/coach-picks/route.ts`
- Modify: `actions/forecast/intent-forecast-actions.ts`
- Modify: `actions/spot/spot-surf-report-actions.ts`
- Modify: `types/personalization.ts`
- Modify: `types/api/recommendations.ts`
- Modify: `next.config.mjs`
- Create: `__tests__/lib/recommendations/major-event-hold/adapters.test.ts`
- Create: `__tests__/app/api/major-event-hold-routes.test.ts`

**Interfaces:**
- Consumes: Task 2 service and unchanged legacy outputs.
- Produces: sanitized responses with `recommendationAvailability`.

- [ ] **Step 1: Write the failing physical-preservation matrix**

```ts
it.each(adapterFixtures)(
  "$name removes positives and preserves physical fields",
  async ({ sanitize, input, physicalSnapshot }) => {
    const frozen = deepFreeze(structuredClone(input));
    const result = await sanitize(frozen, activeUnknownHoldContext);
    expect(result.recommendationAvailability).toMatchObject({
      state: "none",
      reasonCode: "major_event_hold",
    });
    expect(extractPositiveRecommendations(result)).toEqual([]);
    expect(physicalSnapshot(result)).toEqual(physicalSnapshot(input));
  },
);
```

- [ ] **Step 2: Run tests and verify red**

Run: `yarn test:unit __tests__/lib/recommendations/major-event-hold/adapters.test.ts __tests__/app/api/major-event-hold-routes.test.ts --runInBand`

Expected: FAIL because adapters are absent.

- [ ] **Step 3: Implement surface sanitizers**

- Discovery filters both legacy and V2 candidates before truncation and again before serialization.
- Surf Call retains conditions, returns verdict `NO`, and clears positive score/window/tier semantics.
- Week Scout returns HTTP 200 with no best window; it never uses 404 under an active or unresolved hold.
- Bulk/map retains physical forecasts, removes held condition scores, sets summary `UNKNOWN`, and clears best/golden windows.
- Scored forecast retains physical slots and clears composite positives/golden windows.
- Daily intel retains surf/swell/wind/tide fields and clears recommendation, score, best window, and positive generated prose.
- Coach picks, intent pages, and legacy V1 treat unauthenticated skill as unknown and ignore query-string skill for hold policy.

All adapters are pure and do not mutate input.

- [ ] **Step 4: Remove stale decision caching**

Every decision route emits `Cache-Control: private, no-store, no-cache,
must-revalidate`. Remove discovery ETag/304. Override the blanket cache rule in
`next.config.mjs` only for the listed endpoints. Physical computation caches
remain, but hold application occurs after cache reads. Transitions revalidate
affected beach, regional, and share-card paths/tags.

- [ ] **Step 5: Run route, type, and lint gates**

```bash
yarn test:unit __tests__/lib/recommendations/major-event-hold/adapters.test.ts __tests__/app/api/major-event-hold-routes.test.ts --runInBand
yarn typecheck
npx eslint --max-warnings=0 lib/recommendations/major-event-hold app/api/surf app/api/v1/recommendations app/api/forecasts app/api/beach-daily-intel app/api/coach-picks actions/forecast/intent-forecast-actions.ts actions/spot/spot-surf-report-actions.ts
```

Expected: PASS; tests assert no-store, explicit none, and unchanged physical
snapshots.

- [ ] **Step 6: Commit only if explicitly authorized**

```bash
git add lib/recommendations/major-event-hold/adapters/surf-discovery.ts lib/recommendations/major-event-hold/adapters/surf-call.ts lib/recommendations/major-event-hold/adapters/week-scout.ts lib/recommendations/major-event-hold/adapters/bulk-forecast.ts lib/recommendations/major-event-hold/adapters/legacy.ts app/api/surf/discover/route.ts app/api/surf/call/route.ts app/api/surf/week-scout/route.ts app/api/v1/recommendations/route.ts app/api/forecasts/bulk/route.ts 'app/api/forecasts/scored/[beachId]/route.ts' app/api/beach-daily-intel/route.ts app/api/coach-picks/route.ts actions/forecast/intent-forecast-actions.ts actions/spot/spot-surf-report-actions.ts types/personalization.ts types/api/recommendations.ts next.config.mjs __tests__/lib/recommendations/major-event-hold/adapters.test.ts __tests__/app/api/major-event-hold-routes.test.ts
git commit -m "feat(safety): enforce holds at recommendation APIs"
```

### Task 5: Gate Regional Copy, Notifications, Email, and Share Automation

**Files:**
- Create: `lib/recommendations/major-event-hold/adapters/regional.ts`
- Create: `lib/recommendations/major-event-hold/adapters/notification.ts`
- Modify: `lib/utils/regional-forecast-utils.ts`
- Modify: `lib/utils/forecast-hub-utils.ts`
- Modify: `actions/forecast/get-top-beaches-now.ts`
- Modify: `components/forecast/regional-call-hero.tsx`
- Modify: `components/forecast/seven-day-outlook.tsx`
- Modify: `lib/notifications/worker.ts`
- Modify: `lib/notifications/registry.ts`
- Modify: `app/api/cron/condition-alert-evaluate/route.ts`
- Modify: `app/api/cron/condition-alert-deliver/route.ts`
- Modify: `app/api/cron/conditions-alert-email/route.ts`
- Modify: `app/api/cron/similarity-alerts/route.ts`
- Modify: `app/api/cron/home-morning-call/route.ts`
- Modify: `app/api/cron/weekend-window/route.ts`
- Modify: `app/api/cron/weekly-recap-email/route.ts`
- Modify: `app/api/cron/reengagement-email/route.ts`
- Modify: `app/api/cron/first-session-nudge/route.ts`
- Modify: `app/api/cron/first-session-nudge-push/route.ts`
- Modify: `app/api/cron/swell-watch/route.ts`
- Modify: `app/api/og/surf-call/route.tsx`
- Modify: `app/api/og/weekend-wave-check/route.tsx`
- Modify: `supabase/functions/bluesky-auto-post/index.ts`
- Create: `__tests__/lib/recommendations/major-event-hold/notification.test.ts`
- Create: `__tests__/app/api/cron/major-event-hold-delivery.test.ts`
- Create: `__tests__/app/api/og/major-event-hold.test.tsx`
- Modify: `__tests__/app/api/cron/first-session-nudge-push.test.ts`
- Modify: `__tests__/notifications/registry.test.ts`
- Modify: `__tests__/notifications/worker.test.ts`

**Interfaces:**
- Consumes: Task 2 service at producer time and immediately before delivery.
- Produces: no positive outbound session recommendation under a hold.

- [ ] **Step 1: Write queued-before-activation and Swell Watch tests**

```ts
it("suppresses a positive alert queued before activation", async () => {
  const result = await deliverNotification(queuedForecastAlert, {
    loadProfile: async () => beginnerProfile,
    resolveHold: async () => activeHoldResolution,
    sendPush,
    sendEmail,
  });
  expect(result).toMatchObject({ status: "suppressed", reason: "major_event_hold" });
  expect(sendPush).not.toHaveBeenCalled();
  expect(sendEmail).not.toHaveBeenCalled();
});

it("suppresses a firing first-session push queued before activation", async () => {
  const queued = buildLogSessionNudgeEvent({
    cohort: "free_home_firing",
    title: "Good window at your home break",
    body: "Check today's forecast, and log a session if you paddle out.",
    beach_id: null,
    policy_context: {
      kind: "positive_session_recommendation",
      beach_id: "11111111-1111-4111-8111-111111111111",
      starts_at: "2026-07-17T07:00:00.000Z",
      ends_at: "2026-07-18T07:00:00.000Z",
    },
  });
  const result = await deliverNotification(queued, {
    loadProfile: async () => beginnerProfile,
    resolveHold: async () => activeHoldResolution,
    sendPush,
    sendEmail,
  });
  expect(result).toMatchObject({ status: "suppressed", reason: "major_event_hold" });
  expect(sendPush).not.toHaveBeenCalled();
});

it("retains policy context internally but never sends it to FCM", () => {
  const parsed = registry.log_session_nudge.validatePayload(firingNudgePayload);
  expect(parsed.policy_context).toEqual(firingNudgePayload.policy_context);
  const push = registry.log_session_nudge.buildPushPayload!(parsed, buildCtx);
  expect(push.data).not.toHaveProperty("policy_context");
  expect(JSON.stringify(push)).not.toContain("2026-07-17T07:00:00.000Z");
});

it("suppresses firing copy at the first-session-push producer", async () => {
  seedSingleFiringCandidate();
  mockResolveHold.mockResolvedValue(activeHoldResolution);
  await GET(makeCronRequest());
  expect(mockEnqueueNotification).not.toHaveBeenCalled();
});

it("enqueues an internal beach/day context when firing is allowed", async () => {
  seedSingleFiringCandidate();
  mockResolveHold.mockResolvedValue(clearHoldResolution);
  await GET(makeCronRequest());
  expect(mockEnqueueNotification).toHaveBeenCalledWith(
    expect.objectContaining({
      payload: expect.objectContaining({
        cohort: "free_home_firing",
        policy_context: {
          kind: "positive_session_recommendation",
          beach_id: "11111111-1111-4111-8111-111111111111",
          starts_at: "2026-07-17T07:00:00.000Z",
          ends_at: "2026-07-18T07:00:00.000Z",
        },
      }),
    }),
  );
});

it("keeps Swell Watch objective without go language or a beach pick", async () => {
  const result = await buildSwellWatchMessage(swellEvent, activeUnknownHoldContext);
  expect(result.recommendedBeachId).toBeNull();
  expect(result.copy).not.toMatch(/\b(go|head to|best spot|surf it)\b/i);
  expect(result.eventSummary).toContain("swell");
});
```

- [ ] **Step 2: Run tests and verify red**

Run: `yarn test:unit __tests__/lib/recommendations/major-event-hold/notification.test.ts __tests__/app/api/cron/major-event-hold-delivery.test.ts __tests__/app/api/og/major-event-hold.test.tsx __tests__/app/api/cron/first-session-nudge-push.test.ts __tests__/notifications/registry.test.ts __tests__/notifications/worker.test.ts --runInBand`

Expected: the new last-mile assertions FAIL.

- [ ] **Step 3: Add last-mile and direct-send gates**

Resolve profile cohort and current hold in `lib/notifications/worker.ts` after
loading the queued payload and immediately before any channel send. Suppress
`forecast_alert|similarity_match|home_morning_call|weekend_window` when held
or unresolved. Also suppress `log_session_nudge` when its strict internal
`policy_context.kind` is `positive_session_recommendation`; malformed or
missing beach/time context on the `free_home_firing` cohort is unresolved and
fails closed. Record the existing terminal delivery status `skipped_disabled`
plus structured audit code `major_event_hold`, avoiding a notification-status
schema expansion. Producer checks remain defense in depth.

`first-session-nudge-push` is an explicit positive producer for its
`free_home_firing` branch and must not be treated as a generic growth message.
When that branch is built, retain this strict internal event-payload field:

```ts
interface PositiveRecommendationPolicyContext {
  kind: "positive_session_recommendation";
  beach_id: string;
  starts_at: string;
  ends_at: string;
}
```

Derive the UTC boundaries from the home beach's IANA timezone and the local
civil day used by the confidence query. If timezone, beach, or window
resolution fails, do not emit firing copy. At producer time, an active or
unresolved enforce-mode hold suppresses the firing event before enqueue.
Otherwise enqueue it with `policy_context`, so a hold activated after enqueue
but before worker delivery still suppresses it. Extend the strict
`logSessionNudgeSchema` to preserve this field internally; its push builder
must explicitly omit it and preserve the existing external `beach_id`
behavior. Tests inspect the persisted enqueue payload and the final FCM data
separately.

Call the same policy immediately before each direct Resend call. Remove or skip
best-session sections from weekly recap, reengagement, and first-session
messages.

- [ ] **Step 4: Gate regional and public sharing paths**

Filter regional top spots and positive hero copy while retaining objective
day-by-day height and wind. Positive OG cards require server-side beach/time
resolution; query strings alone produce neutral cards. Swell Watch remains
objective safety awareness with no recommended beach/window. Bluesky Go/No,
weekend, and longboard posts resolve the hold RPC and fail closed to objective
awareness.

- [ ] **Step 5: Run focused gates**

```bash
yarn test:unit __tests__/lib/recommendations/major-event-hold/notification.test.ts __tests__/app/api/cron/major-event-hold-delivery.test.ts __tests__/app/api/og/major-event-hold.test.tsx __tests__/app/api/cron/first-session-nudge-push.test.ts __tests__/notifications/registry.test.ts __tests__/notifications/worker.test.ts --runInBand
yarn typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit only if explicitly authorized**

Stage only the exact P0-A files listed by this task, including the existing
first-session-push and notification registry/worker tests, then:

```bash
git commit -m "feat(safety): gate outbound session recommendations"
```

### Task 6: Make Web Rendering and Browser Caches Obey Explicit None

**Files:**
- Modify: `hooks/use-surf-discovery.ts`
- Modify: `hooks/use-oracle-data.ts`
- Modify: `hooks/use-time-slot-prefetch.ts`
- Modify: `lib/utils/discovery-cache-utils.ts`
- Modify: `components/home-screen/index.tsx`
- Modify: `components/oracle/oracle-home-screen.tsx`
- Modify: `components/discover/beach-discovery-list.tsx`
- Modify: `components/map/map-marker-builder.ts`
- Modify: `components/beach-detail/session-intelligence-pilot.tsx`
- Modify: `components/home-screen/session-intelligence-module.tsx`
- Create: `__tests__/hooks/use-surf-discovery-hold.test.tsx`
- Create: `__tests__/components/major-event-hold-rendering.test.tsx`
- Create: `e2e/guest-major-event-recommendation-hold.spec.ts`
- Create: `e2e/major-event-recommendation-hold.spec.ts`

**Interfaces:**
- Consumes: server `RecommendationAvailability`.
- Produces: objective forecast rendering without stale/local positive decisions.

- [ ] **Step 1: Write failing cache precedence tests**

```ts
it("deletes a cached positive when fresh state is explicit none", async () => {
  localStorage.setItem("quiver_discovery_fixture", JSON.stringify(cachedPositive));
  server.use(discoveryHandler(heldDiscoveryResponse));
  const { result } = renderHook(() => useSurfDiscovery(discoveryInput), { wrapper });
  await waitFor(() => {
    expect(result.current.data?.recommendationAvailability.state).toBe("none");
  });
  expect(result.current.data?.recommendations).toEqual([]);
  expect(localStorage.getItem("quiver_discovery_fixture")).toBeNull();
});

it("does not construct Session Intelligence from a held Surf Call", () => {
  render(<SessionIntelligencePilot surfCall={heldSurfCall} forecasts={physicalForecasts} />);
  expect(screen.queryByText(/best session|go surf|worth it/i)).not.toBeInTheDocument();
  expect(screen.getByText("6 ft")).toBeInTheDocument();
});
```

- [ ] **Step 2: Remove recommendation persistence and local rebuilding**

Delete `quiver_discovery_*` entries on first load after this contract ships.
Remove recommendation localStorage and prefetch writes; keep objective forecast
caches. Before deleting a helper, run `rg` and remove every production import
in the same change. Preserve the public hook interface with `isCached: false`.

All listed components check availability before positive copy, reranking, or
fallback. They may render physical forecasts and neutral unavailability; they
do not render confidence.

- [ ] **Step 3: Add browser E2E**

Guest/unknown, beginner, and intermediate tests cover home, map, beach detail,
regional, and Week Scout. Capture the same physical-height text before and
during a hold, assert no positive, append a cancellation fixture, and assert
ordinary recommendations return.

- [ ] **Step 4: Run web gates**

```bash
yarn test:unit __tests__/hooks/use-surf-discovery-hold.test.tsx __tests__/components/major-event-hold-rendering.test.tsx --runInBand
yarn test:e2e e2e/guest-major-event-recommendation-hold.spec.ts e2e/major-event-recommendation-hold.spec.ts --project=guest --project=auth --workers=1
```

Expected: PASS; E2E fails if a positive appears or physical height changes.

- [ ] **Step 5: Commit only if explicitly authorized**

Stage the exact files listed in this task, then:

```bash
git commit -m "fix(web): prevent held recommendation cache bypass"
```

### Task 7: Make Native Caches, Fallbacks, and Rankers Obey the Hold

**Files:**
- Create: `/Users/stevenchandler/Desktop/dev/quiver-native/src/types/recommendation-availability.ts`
- Create: `/Users/stevenchandler/Desktop/dev/quiver-native/src/lib/recommendation-hold.ts`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver-native/src/hooks/use-surf-discovery.ts`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver-native/src/hooks/use-surf-call.ts`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver-native/src/hooks/use-week-scout.ts`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver-native/src/hooks/use-map-beaches.ts`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver-native/src/lib/week-scout/canonical-week-scout.ts`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver-native/src/lib/week-scout/stability-store.ts`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver-native/src/lib/surf-decision.ts`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver-native/src/lib/home/my-surf-list-ranking.ts`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver-native/src/lib/plan-my-next-session/rank-recommendations.ts`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver-native/src/components/explore-map/surf-spot-map-summary.ts`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver-native/src/lib/forecast-refresh.ts`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver-native/src/providers/forecast-refresh-provider.tsx`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver-native/src/screens/home.tsx`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver-native/src/screens/beach-detail.tsx`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver-native/src/screens/week-scout.tsx`
- Create: `src/__tests__/recommendation-hold.test.ts`
- Create: `src/__tests__/week-scout-hold.test.ts`
- Create: `src/__tests__/major-event-hold-surfaces.test.tsx`
- Create: `.maestro/flows/recommendations/major-event-hold.yaml`

**Interfaces:**
- Consumes: additive server availability fields.
- Produces: `isRecommendationBlocked()` checked before every local positive.

- [ ] **Step 1: Write failing native guard tests**

```ts
it.each(["major_event_hold", "hold_state_unavailable"] as const)(
  "blocks cached and local positives for %s",
  (reasonCode) => {
    const availability = { state: "none" as const, reasonCode, holdEpoch: "epoch-1" };
    expect(isRecommendationBlocked(availability)).toBe(true);
    expect(computeSimpleSurfCall(physicalForecast, "intermediate", availability))
      .toBe("UNKNOWN");
    expect(rankMySurfList(cachedDiscovery, availability)).toEqual([]);
  },
);

it("clears the Week Scout incumbent on explicit none", async () => {
  await saveStableWeekScout(cachedPositiveWeekScout);
  await reconcileWeekScoutResponse(heldWeekScoutResponse);
  expect(await loadStableWeekScout()).toBeNull();
});
```

- [ ] **Step 2: Run tests and verify red**

```bash
cd /Users/stevenchandler/Desktop/dev/quiver-native
npm test -- --runInBand src/__tests__/recommendation-hold.test.ts src/__tests__/week-scout-hold.test.ts
```

Expected: FAIL because the guard is absent.

- [ ] **Step 3: Implement fail-closed precedence**

Parse availability on discovery, Surf Call, Week Scout, and map responses. A
present none state wins before previous-data placeholders, persisted Week Scout
incumbents, local Surf Call, home ranking, plan-next ranking, and map summaries.
Malformed explicit-none payloads block rather than downgrade to available.

Held/unresolved Week Scout deletes stability state and prohibits 404/local
fallback. Add all hold-sensitive queries to foreground refresh. Never reuse a
positive after observing a newer hold epoch.

- [ ] **Step 4: Add native user-flow verification**

Jest covers home/map/beach/Week Scout, cache precedence, foreground refresh,
and cancellation. Maestro proves physical heights remain while positives are
absent, then restore after cancellation. Smoke-test the previous compatible
`1.0.1` build online and record the offline limitation.

- [ ] **Step 5: Run native gates**

```bash
cd /Users/stevenchandler/Desktop/dev/quiver-native
npm run typecheck
npm test -- --runInBand
npx maestro test .maestro/flows/recommendations/major-event-hold.yaml
```

Expected: PASS.

- [ ] **Step 6: Commit in the native repository only if explicitly authorized**

Stage only P0-A files and preserve the unrelated
`src/__tests__/session-form-screen.test.tsx` change, then:

```bash
git commit -m "feat(native): enforce major-event recommendation holds"
```

### Task 8: Verify, Canary, and Exercise Rollback

**Files:**
- Create: `docs/runbooks/major-event-recommendation-hold.md`
- Modify: only task-owned files required by review findings.

**Interfaces:**
- Consumes: all P0-A artifacts and explicit release approvals.
- Produces: local evidence, approval packet, scoped canary, audited real hold, and rollback proof.

- [ ] **Step 1: Run Quiver gates**

```bash
source ~/.nvm/nvm.sh
nvm use 22
psql 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' -v ON_ERROR_STOP=1 -f scripts/db/regional-recommendation-holds-smoke.sql
yarn test:unit __tests__/migrations/regional-recommendation-holds.test.ts __tests__/lib/recommendations/major-event-hold __tests__/app/api/admin/recommendation-holds __tests__/app/api/cron/major-event-hold-evaluate __tests__/app/api/cron/major-event-hold-retention __tests__/app/api/cron/first-session-nudge-push.test.ts __tests__/notifications/registry.test.ts __tests__/notifications/worker.test.ts --runInBand
yarn typecheck
yarn lint
yarn lint:tests
```

Expected: PASS.

- [ ] **Step 2: Run the exact web/native flows from Tasks 6 and 7**

Expected: Playwright, native Jest, Maestro, and previous-compatible online
smoke all PASS. Fixture success does not substitute for the online smoke.

- [ ] **Step 3: Review separate repository diffs**

```bash
git -C /Users/stevenchandler/Desktop/dev/quiver diff --check
git -C /Users/stevenchandler/Desktop/dev/quiver-native diff --check
git -C /Users/stevenchandler/Desktop/dev/quiver status --short
git -C /Users/stevenchandler/Desktop/dev/quiver-native status --short
```

Expected: no whitespace errors, unrelated staging, objective forecast mutation,
public safety flag, or QA evidence in automatic policy input.

- [ ] **Step 4: Request independent release approvals**

Request separate approval to apply the reviewed migration, deploy Quiver in
shadow with automation false, publish native runtime `1.0.1`, run a short
beach-scoped manual canary, switch to enforce, activate the real manual scope,
and later enable official automation.

- [ ] **Step 5: Run the approved canary**

After schema, server/web, and native rollout: activate one test-beach hold with
beginner/intermediate/unknown and a 30-minute expiry; verify every surface;
append an extension; append cancellation; confirm ordinary recommendations
return. Only then enable enforce and activate the approved real scope.

- [ ] **Step 6: Exercise rollback**

1. Append cancellation for every active hold.
2. Set automation false.
3. If enforcement code is faulty, set mode off only after active state review.
4. Keep Week Scout endpoint enabled.
5. Retain the additive schema and audit history.
6. Verify physical forecasts remain unchanged.

Automation-off alone is not cancellation.

- [ ] **Step 7: Commit the runbook only if explicitly authorized**

```bash
git add docs/runbooks/major-event-recommendation-hold.md
git commit -m "docs(safety): add major-event hold runbook"
```

## Covered Authority Inventory

P0-A is blocked until every row below has a tested adapter:

| Authority | Enforcement |
|---|---|
| Discovery/Home/Oracle | Server sanitize both legacy/V2; no ETag or localStorage positive |
| Legacy public V1 | Unauthenticated is unknown; ignore query skill |
| Surf Call | Apply after physical cache; clear positive verdict/window |
| Week Scout | HTTP 200 explicit none; clear stability and prohibit fallback |
| Bulk map/Explore | Preserve physical rows; remove scores; local summary returns unknown |
| Scored forecast/golden windows | Preserve slots; clear positives/windows |
| Daily intel/coach/intent | Preserve objective data; clear picks and positive prose |
| Session Intelligence | Check availability before client construction |
| Regional/top spots | Filter picks and positive copy; preserve day forecasts |
| Alerts/push/direct email | Producer plus immediate pre-send gate |
| First-session firing push | Retain internal home-beach/local-day context; gate enqueue and worker delivery; strip context from FCM |
| Swell Watch | Objective awareness only; no go language or beach |
| OG/share/Bluesky | Server state required for positive; unresolved fails neutral |
| Native home/map/beach/Week Scout | Server none wins over caches and local rankers |

## P0-A Completion Gate

P0-A is complete only when:

- activation, extension, replacement, cancellation, expiry, concurrency, and idempotent retry are proven;
- direct service-role writes are denied and every transition goes through the append RPC;
- a future-effective version cannot hide the currently effective version;
- current-event manual control works without claiming a complete hurricane detector;
- automatic creation accepts only fresh official high `srf|alert` rows whose `valid_date` is plausible in the beach's own civil day;
- beginner, intermediate, and unknown contexts receive no positive in active scope;
- P0-A emits no protected alternative;
- hold-resolution failures cannot manufacture a positive;
- every inventoried API, web, native, alert, email, social, and share path is covered;
- firing first-session pushes retain internal beach/day context, are gated at enqueue and delivery, and never expose that context to FCM;
- stale caches and local rankers cannot bypass a newer hold epoch;
- objective forecast values are unchanged in unit, API, browser, native, and canary evidence;
- runtime `1.0.1` is released and the previous-compatible online build passes;
- the offline-old-client limitation is recorded;
- canary activation, extension, cancellation, enforce activation, and rollback are exercised;
- policy rows contain only bounded opaque refs and allowlisted reason codes; operator deletion removes its identity mapping; the 13-month whole-chain retention fixture passes;
- no low-confidence UI or confidence-derived behavior exists;
- all focused and broad Quiver, Playwright, native Jest, and Maestro gates pass.

## Approval Boundaries

- Approval of this plan does not approve implementation.
- Implementation approval does not approve the migration.
- Migration approval does not approve deploy, OTA, activation, automation, or production testing.
- Every external/production action in Task 8 requires its own explicit approval.
