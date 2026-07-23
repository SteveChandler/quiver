# Phase 0-B Legacy Decision Envelope and Attribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist an append-only audit envelope around every covered legacy recommendation authority and attribute the candidate actually rendered, opened, and linked to a session without changing any forecast, recommendation, ranking, confidence, or presentation behavior.

**Architecture:** Quiver creates the authoritative legacy envelope immediately after an existing authority finishes evaluating its slate and before its response or message is released. Web and native receive only an opaque envelope reference plus candidate IDs, then append lifecycle events whose candidates are checked against the persisted slate; server-selected and client-rendered candidates remain distinct so current divergence is measured instead of concealed. Persistence is best-effort and independently flaggable, and existing impression/session-context writes remain in place during rollout.

**Tech Stack:** TypeScript 5, Next.js 16 App Router, React 19, Zod 4, Supabase/PostgreSQL, Jest, Playwright, React Native/Expo 55, AsyncStorage, Maestro.

## Global Constraints

- This plan implements P0-B only; it does not implement the canonical decision engine, source policy, observation matching, or the Phase 0 major-event hold.
- The legacy envelope is audit instrumentation, not a new serving authority; existing recommendation values, order, thresholds, fallbacks, and copy must remain byte-for-byte equivalent when envelope fields are removed from a response.
- No objective forecast value may be suppressed, modified, or recomputed by this work.
- No low-confidence label or confidence-derived client behavior may be introduced; internal confidence fields are not added to the client envelope reference.
- Envelope, candidate, lifecycle, operational-attempt, and session-link outbox records are append-only. Deletion is allowed only through the reviewed dependency-closure retention RPC or an explicit account/session-erasure path; ordinary updates and ad hoc deletes are not.
- Full user profiles, raw coordinates, exact travel or availability values, free text, private custom-spot IDs, raw evidence, internal reliability, and safety values must not be persisted in the legacy envelope.
- Every JSON field is parsed by a strict versioned allowlist at adapter, route, persistence, and RPC ingress; unknown or sensitive keys are rejected, never spread into storage.
- A lifecycle candidate is accepted only when it belongs to its declared rendered-owner envelope. Cross-envelope rendering is allowed only for an enumerated cache or stability path, must include the fresh comparison envelope, and must match actor, scope fingerprint, authority family, candidate kind, and validity window.
- A `session_linked` event is attribution, not mere membership: the owned session must match the candidate's public beach (or server-keyed private candidate binding) and its arrival time must fall in the candidate window. Anonymous envelopes may link to a later authenticated session only through the signed actor-claim flow defined below.
- Envelope/event failures must fail open for attribution and fail neutral for serving: return the unchanged legacy recommendation with `legacyDecision: null`, record an operational error, and never invent an envelope or candidate ID.
- When P0-A is enabled, “unchanged serving” means unchanged **post-hold** serving. P0-B may fail open only around attribution; it must never restore a candidate that P0-A held or turn a P0-A fail-closed result into a recommendation.
- Existing `recommendation_impressions`, `recommendation_session_contexts`, and `sessions.recommendation_id` writes remain dual-written until the completion gate passes.
- `LEGACY_DECISION_ENVELOPE_WRITE_ENABLED` and `LEGACY_DECISION_EVENT_WRITE_ENABLED` are independent from each other and from every Phase 0-A, P0-C, and P0-D flag.
- Retention is operationally independent from attribution writes. `LEGACY_DECISION_RETENTION_ENABLED=true` plus privacy sign-off is required before any authority reaches general rollout, and write rollback never disables retention.
- No migration may be applied to a local, development, preview, or production database until the migration approval checkpoint in Task 3 is explicitly approved. A production/linked `supabase db push` requires a second explicit release approval.
- Quiver and quiver-native are separate repositories. Run their gates and create their commits separately.
- Do not create any commit unless the user explicitly authorizes commits. Every commit step below is conditional and must be skipped without that authorization.

---

## Authority Coverage Contract

The following paths are in the P0-B inventory. A path is complete only when it has an adapter or appears in the dashboard as an explicitly accepted gap.

| Authority path | Existing authority | Render/reorder path | P0-B disposition |
|---|---|---|---|
| `surf_discovery_v1` | `app/api/surf/discover/route.ts` and `lib/services/discovery/surf-discovery-orchestrator.ts` | Web home, Oracle, discover; native home local ranking | Full envelope and lifecycle coverage |
| `surf_discovery_v2` | `lib/services/discovery/recommendations-v2.ts` | Native Plan My Next hooks | A distinct v2 envelope, candidate namespace, and response reference; dormant consumers may not be activated without lifecycle coverage |
| `surf_call_v1` | `app/api/surf/call/route.ts`, `actions/spot/spot-surf-report-actions.ts`, `lib/utils/surf-call-logic.ts` | Web/native beach detail and native home copy | Selected-candidate envelope; document evaluated-slate limitation until headline resolver exposes all considered windows |
| `surf_call_native_fallback_v1` | `quiver-native/src/hooks/use-surf-call.ts` | Native offline fallback and development override | Client-reported envelope when online, never attached to the server surf-call slate; offline rendering queues `offline_generation_unobservable` |
| `week_scout_server_v1` | `app/api/surf/week-scout/route.ts`, `lib/services/discovery/week-scout.ts` | Native filters and stability retention | Full server slate; old-envelope owner recorded for retained incumbents |
| `week_scout_native_fallback_v1` | `quiver-native/src/lib/week-scout/build-week-scout.ts` | Native filters and stability | Client-reported generation when reachable; offline/client-generation failure queues `offline_generation_unobservable` |
| `native_home_ranker_v1` | `quiver-native/src/lib/home/my-surf-list-ranking.ts` | Native home | Render event records filtered/reordered candidate list against discovery envelope |
| `native_beach_detail_v1` | `quiver-native/src/lib/plan-my-next-session/beach-detail-best-window.ts` | Native beach detail | Client-reported envelope until canonical server replacement exists |
| `session_intelligence_home_v1` | `lib/recommendations/session-intelligence-surface-adapters.ts` | Web home/Oracle | Preserve discovery candidate identity through presentation adapter |
| `session_intelligence_spot_v1` | `lib/recommendations/surf-window-recommendations.ts` | Web spot page | Client-reported generation because selection currently runs in a client component |
| `session_intelligence_regional_v1` | `lib/recommendations/surf-window-recommendations.ts`, `lib/utils/forecast-hub-utils.ts` | Public forecast hub | Server envelope with anonymous signed event token |
| `forecast_top_spots_v1` | `lib/utils/forecast-hub-utils.ts#getTopBeachesRightNow` | Public `BestRightNow` list | Server envelope with anonymous signed event token |
| `regional_forecast_copy_v1` | `lib/utils/regional-forecast-utils.ts`, regional call hero, and seven-day outlook | Public regional forecast copy | Server envelope for the complete evaluated regional slate; rendered card/list lifecycle is covered |
| `forecast_bulk_map_v1` | `app/api/forecasts/bulk/route.ts` current-row condition scoring | Web map and native map feed | One server envelope per logical request with every requested beach/current-row candidate; web map rendering reports its actual visible subset |
| `forecast_scored_beach_v1` | `app/api/forecasts/scored/[beachId]/route.ts` | No current Quiver or native consumer found | Full eight-slot envelope on any request before golden-window grouping; render disposition is accepted gap `no_current_consumer` and no selected candidate is invented |
| `coach_picks_v1` | `app/api/coach-picks/route.ts#get_coach_picks` | No current Quiver or native consumer found | Full returned RPC slate on any request; render disposition is accepted gap `no_current_consumer` and selected candidate remains null |
| `intent_forecast_v1` | `actions/forecast/intent-forecast-actions.ts#getIntentForecastSummary` | City intent pages | Full evaluated city slate before top-pick truncation plus the existing best-window selection |
| `native_map_summary_v1` | `quiver-native/src/components/explore-map/surf-spot-map-summary.ts` | Native map marker summaries | Client-reported envelope for the complete locally evaluated marker set; offline generation is an explicit queued gap |
| `native_plan_next_ranker_v1` | `quiver-native/src/lib/plan-my-next-session/rank-recommendations.ts` | Native Plan My Next | Client-reported merged/deduped pre-limit slate and rendered order; offline generation is an explicit queued gap |
| `daily_intel_v2` | `lib/services/intel-generation-service.ts` | Beach page, onboarding, email inputs | Envelope generation at immutable daily-intel issuance |
| `og_surf_call_v1` | `app/api/og/surf-call/route.tsx` | Public Surf Call share card | Server-selected envelope; crawler display is an explicit `public_share_shown_unobservable` gap |
| `og_weekend_wave_check_v1` | `app/api/og/weekend-wave-check/route.tsx` | Public weekend share card | Server-selected envelope; crawler display is an explicit `public_share_shown_unobservable` gap |
| `social_bluesky_auto_post_v1` | `supabase/functions/bluesky-auto-post/index.ts` | Bluesky forecast posts | Signed internal generation call captures the evaluated/selected post candidate; provider display is an explicit `public_share_shown_unobservable` gap |
| `message_*` | Active recommendation-producing cron routes listed in Task 14, including first-session-nudge push and weekly recap email | Email/push client | Generated and opened coverage; actual message `shown` remains an explicit measurement gap |
| `legacy_public_recommendations_v1` | `app/api/v1/recommendations/route.ts` | No current Quiver/native consumer found | Generate envelope when flag-enabled; lifecycle gap remains visible until a consumer exists |

`authority-registry.ts` is the executable inventory behind this table. Every
`LegacyDecisionAuthorityPathSchema` option must have exactly one registry row,
an owner, generation and render dispositions (`covered`, `accepted_gap`, or
`release_blocker`), a gap code when applicable, and a review expiry for every
accepted gap. Contract tests fail for a missing/extra enum, registry, adapter,
or dashboard row. The dashboard always shows the entire registry, including
dormant and zero-volume rows. A `release_blocker` fails rollout; an accepted
gap requires named Product and Engineering approval and is never silently
removed from the denominator. Eligible attempts for covered and accepted-gap
authorities all enter volume coverage; only the predeclared unobservable
display classes are shown as excluded sub-denominators. Therefore the 99%/95%
gates cannot pass by omitting an authority that has no adapter or no traffic.

## P0-A Composition Contract

P0-A and P0-B remain independently flaggable but share adapter boundaries in a fixed order when both are enabled:

1. The existing legacy authority evaluates and orders its complete server slate.
2. P0-B builds the immutable generation input from that pre-hold slate and starts best-effort persistence; it does not mutate the slate.
3. P0-A evaluates the major-event hold and shapes the served response. Its fail-closed result is authoritative even if P0-B persistence times out or throws.
4. A held response carries at most the opaque envelope reference needed for attribution, never the hidden candidate values, IDs, order, or list. Its client-safe reference must set `selectedCandidateId: null` and reject candidate maps or pre-hold payloads. The client renders explicit none and appends `shown` with `renderOutcome="explicit_none"`, empty candidate IDs, and `server_none_preserved`.
5. The RPC compares that actual render with the pre-hold envelope. A positive pre-hold winner followed by a held explicit-none render is `suppressed_server_positive`; it is not reported as missing attribution or rewritten as a generated explicit-none envelope.

If P0-A is disabled, P0-B observes the ordinary legacy response. If P0-B is disabled or fails, P0-A behavior is unchanged and the client emits only a safe `missing_envelope` gap where possible. A combined test matrix must cover both flags alone, both together, P0-B timeout, and P0-A error/fail-closed; no rollout can rely only on isolated workstream tests.

## File Responsibility Map

### Quiver files to create

- `lib/recommendations/legacy-envelope/types.ts` — shared server/client-safe contracts and Zod schemas.
- `lib/recommendations/legacy-envelope/canonicalize.ts` — canonical JSON serialization and SHA-256 helpers.
- `lib/recommendations/legacy-envelope/candidate-id.ts` — deterministic opaque candidate IDs scoped to one idempotency key.
- `lib/recommendations/legacy-envelope/attempt-reconciliation.ts` — strict log-archive parsing and attempt-ID set reconciliation.
- `lib/recommendations/legacy-envelope/expiry-policy.ts` — versioned authority-family decision and event-acceptance TTLs.
- `lib/recommendations/legacy-envelope/privacy.ts` — explicit allowlist sanitizers for scope, forecast, and user provenance.
- `lib/recommendations/legacy-envelope/feature-flags.ts` — independent global and authority allowlist gates.
- `lib/recommendations/legacy-envelope/authority-registry.ts` — exhaustive enum-to-adapter/gap ownership manifest used by rollout and dashboards.
- `lib/recommendations/legacy-envelope/persistence.ts` — best-effort calls to service-role RPCs.
- `lib/recommendations/legacy-envelope/events.ts` — lifecycle validation input builder and event token helpers.
- `lib/recommendations/legacy-envelope/discovery-adapter.ts` — converts discovery’s full evaluated slate into envelope input.
- `lib/recommendations/legacy-envelope/surf-call-adapter.ts` — converts a surf-call result into the documented selected-only legacy trace.
- `lib/recommendations/legacy-envelope/week-scout-adapter.ts` — converts all Week Scout windows into candidates.
- `lib/recommendations/legacy-envelope/session-intelligence-adapter.ts` — converts surf-window and top-spots results.
- `lib/recommendations/legacy-envelope/forecast-ranking-adapter.ts` — converts bulk/map, scored-slot, coach-pick, regional-copy, and intent slates.
- `lib/recommendations/legacy-envelope/outbound-presentation-adapter.ts` — converts OG/share and signed Bluesky selections without claiming display.
- `lib/recommendations/legacy-envelope/message-adapter.ts` — common generation/open metadata for recommendation-producing messages.
- `lib/recommendations/legacy-envelope/client.ts` — browser lifecycle POST helper.
- `lib/recommendations/legacy-envelope/message-open.ts` — strict signed CTA parameter parser and one-shot web open emitter.
- `lib/recommendations/legacy-envelope/session-link-queue.ts` — bounded IndexedDB browser retry queue for DB-outbox enqueue.
- `hooks/use-legacy-decision-lifecycle.ts` — surface-level shown/opened emission.
- `components/intent/intent-forecast-lifecycle.tsx` — hydrated lifecycle bridge for prose-only intent recommendations.
- `app/api/recommendations/legacy-envelope/events/route.ts` — authenticated or signed-anonymous event append route.
- `app/api/recommendations/legacy-envelope/client-generation/route.ts` — rate-limited optional-auth endpoint for enumerated legacy client-only authorities; guest use requires a server-minted signed visitor token and receives a signed event token.
- `app/api/recommendations/legacy-envelope/visitor-token/route.ts` — rate-limited server-minted anonymous visitor claim for guest web/native client generation.
- `app/api/recommendations/legacy-envelope/server-generation/route.ts` — HMAC-authenticated server-message generation boundary used by the Bluesky edge function.
- `app/api/recommendations/legacy-envelope/claim/route.ts` — binds a signed anonymous actor identity to the authenticated user without rewriting the envelope.
- `app/api/recommendations/legacy-envelope/session-link-outbox/route.ts` — authenticated idempotent enqueue endpoint for durable web session links.
- `app/api/cron/legacy-decision-session-link-outbox/route.ts` — retries pending outbox rows through the lifecycle RPC.
- `app/api/cron/cleanup-legacy-decision-envelopes/route.ts` — retention cleanup that remains enabled through write rollback.
- `app/admin/forecasts/decision-attribution/page.tsx` — admin-only coverage and divergence dashboard.
- `lib/services/legacy-decision-attribution-service.ts` — dashboard query boundary.
- `supabase/migrations/20260717171000_create_legacy_decision_envelopes.sql` — envelopes, candidates, lifecycle events, write attempts, session-link outbox, strict constraints, append-only triggers, RPCs, and reporting views.
- `scripts/db/legacy-decision-envelope-smoke.sql` — local schema/RPC smoke assertions.
- `scripts/ops/reconcile-legacy-decision-attempts.ts` — reconciles an immutable log-drain NDJSON export with database attempts.
- `docs/security/legacy-decision-envelope-data-map.md` — privacy data map, retention, erasure, and anonymous-token review.
- `docs/deployment/legacy-decision-envelope-rollout.md` — flags, staged rollout, thresholds, and rollback commands.
- `e2e/recommendation-attribution.spec.ts` — browser proof of selected-versus-rendered and session linking.
- `__tests__/integration/major-event-hold-legacy-envelope.test.ts` — composition proof that pre-hold attribution cannot bypass the hold.

### Quiver files to modify

- `types/personalization.ts`
- `types/session-intelligence.ts`
- `lib/services/discovery/surf-discovery-orchestrator.ts`
- `lib/services/discovery/recommendations-v2.ts`
- `lib/services/discovery/week-scout.ts`
- `lib/services/surf-discovery-service.ts`
- `app/api/surf/discover/route.ts`
- `app/api/surf/call/route.ts`
- `app/api/surf/week-scout/route.ts`
- `app/api/v1/recommendations/route.ts`
- `app/api/forecasts/bulk/route.ts`
- `app/api/forecasts/scored/[beachId]/route.ts`
- `app/api/coach-picks/route.ts`
- `actions/forecast/intent-forecast-actions.ts`
- `lib/utils/regional-forecast-utils.ts`
- `components/forecast/regional-call-hero.tsx`
- `components/forecast/seven-day-outlook.tsx`
- `components/map/map-beach-loader.ts`
- `components/map/interactive-map.tsx`
- `components/map/map-marker-builder.ts`
- `components/intent/todays-intent-plan.tsx`
- `components/city/city-map-view.tsx`
- `app/[intent]/[city]/page.tsx`
- `app/best-time-to-surf/[city]/page.tsx`
- `app/api/og/surf-call/route.tsx`
- `app/api/og/weekend-wave-check/route.tsx`
- `supabase/functions/bluesky-auto-post/index.ts`
- `actions/spot/spot-surf-report-actions.ts`
- `hooks/use-surf-discovery.ts`
- `hooks/use-oracle-data.ts`
- `components/home-screen/index.tsx`
- `components/oracle/oracle-home-screen.tsx`
- `components/discover/beach-discovery-list.tsx`
- `components/providers.tsx`
- `lib/services/discovery/surf-discovery-gating.ts`
- `components/home-screen/session-intelligence-module.tsx`
- `components/beach-detail/session-intelligence-pilot.tsx`
- `components/session-intelligence/best-surf-windows.tsx`
- `lib/recommendations/session-intelligence-surface-adapters.ts`
- `lib/utils/forecast-hub-utils.ts`
- `actions/forecast/get-top-beaches-now.ts`
- `components/forecast/best-right-now.tsx`
- `lib/recommendations/attribution.ts`
- `lib/recommendations/session-context.ts`
- `app/api/recommendations/session-context/route.ts`
- `actions/session-actions.ts`
- `vercel.json`
- Recommendation-producing cron files listed in Task 14.
- `types/database.generated.ts` only after the migration approval checkpoint.

### quiver-native files to create

- `src/lib/legacy-decision-envelope.ts` — native contracts, API calls, and candidate/order helpers.
- `src/lib/legacy-decision-event-queue.ts` — bounded AsyncStorage retry queue.
- `src/lib/legacy-decision-message-open.ts` — signed push/deep-link open parsing and event enqueue.
- `src/hooks/use-legacy-decision-lifecycle.ts` — native shown/opened lifecycle hook.
- `.maestro/flows/discovery/recommendation-envelope-session-link.yaml` — native end-to-end attribution flow.

### quiver-native files to modify

- `src/types/discovery.ts`
- `src/types/plan-my-next-session.ts`
- `src/hooks/use-surf-discovery.ts`
- `src/hooks/use-surf-call.ts`
- `src/hooks/use-week-scout.ts`
- `src/screens/home.tsx`
- `src/screens/beach-detail.tsx`
- `src/screens/week-scout.tsx`
- `src/lib/home/my-surf-list-ranking.ts`
- `src/hooks/use-map-beaches.ts`
- `src/components/explore-map/surf-spot-map-summary.ts`
- `src/hooks/use-plan-my-next-session-recommendations.ts`
- `src/lib/plan-my-next-session/rank-recommendations.ts`
- `src/lib/plan-my-next-session/beach-detail-best-window.ts`
- `src/lib/week-scout/canonical-week-scout.ts`
- `src/lib/week-scout/stability.ts`
- `src/lib/week-scout/stability-store.ts`
- `src/lib/week-scout/types.ts`
- `src/lib/recommendation-context.ts`
- `src/lib/session-form-state.ts`
- `src/lib/session-form-utils.ts`
- `src/lib/pending-sessions-store.ts`
- `src/lib/pending-sessions-flush.ts`
- `src/lib/push-notifications.ts`
- `src/lib/deeplink/handle-inbound-url.ts`

---

### Task 1: Lock the versioned envelope contracts, canonical serialization, and privacy allowlists

**Files:**
- Create: `lib/recommendations/legacy-envelope/types.ts`
- Create: `lib/recommendations/legacy-envelope/canonicalize.ts`
- Create: `lib/recommendations/legacy-envelope/candidate-id.ts`
- Create: `lib/recommendations/legacy-envelope/expiry-policy.ts`
- Create: `lib/recommendations/legacy-envelope/privacy.ts`
- Create: `lib/recommendations/legacy-envelope/authority-registry.ts`
- Test: `__tests__/lib/recommendations/legacy-envelope/contracts.test.ts`

**Interfaces:**
- Consumes: Existing `SurfDiscoveryRecommendation`, `EnhancedForecastEntity`, and user preference types only through adapters in later tasks.
- Produces: `LegacyDecisionGenerationInput`, `LegacyDecisionReference`, `HeldLegacyDecisionReference`, `LegacyDecisionEventInput`, `LegacyDecisionCandidateInput`, the exhaustive `LEGACY_DECISION_AUTHORITY_REGISTRY`, `redactLegacyDecisionForHeldResponse(reference)`, `canonicalizeJson(value)`, `sha256Base64Url(value)`, `buildLegacyCandidateId(idempotencyKey, stableKey)`, `buildLegacyIdempotencyUuid(authorityPath, externalKey)`, `resolveLegacyDecisionExpiry(authorityFamily, generatedAt)`, `sanitizeLegacyScope(input)`, `sanitizeForecastSnapshot(input)`, and `sanitizeUserContextProvenance(input)`.
- Private-candidate identity additionally produces `buildLegacyPrivateStableKeyHash(idempotencyKey, candidateKind, privateStableKey)`, which uses a server-only HMAC key and is the only input private candidate builders may pass to `buildLegacyCandidateId`.

- [ ] **Step 1: Write the failing contract tests**

```ts
import {
  LegacyDecisionAuthorityPathSchema,
  LegacyDecisionCandidateInputSchema,
  LegacyDecisionGenerationInputSchema,
  LegacyDecisionReferenceSchema,
} from "@/lib/recommendations/legacy-envelope/types";
import { canonicalizeJson } from "@/lib/recommendations/legacy-envelope/canonicalize";
import {
  buildLegacyCandidateId,
  buildLegacyIdempotencyUuid,
} from "@/lib/recommendations/legacy-envelope/candidate-id";
import { resolveLegacyDecisionExpiry } from "@/lib/recommendations/legacy-envelope/expiry-policy";
import { sanitizeLegacyScope } from "@/lib/recommendations/legacy-envelope/privacy";
import { LEGACY_DECISION_AUTHORITY_REGISTRY } from "@/lib/recommendations/legacy-envelope/authority-registry";

function buildCompleteGenerationInput() {
  return {
    envelopeVersion: 1 as const,
    idempotencyKey: "11111111-1111-4111-8111-111111111111",
    originSurface: "web_home" as const,
    clientPlatform: "web" as const,
    authorityPath: "surf_discovery_v1" as const,
    authorityFamily: "discovery" as const,
    authorityVersion: "legacy-discovery-2026-07-17",
    generationReason: "interactive_request" as const,
    generationTrust: "server_observed" as const,
    generatedAt: "2026-07-17T12:00:00.000Z",
    expiresAt: "2026-07-17T12:30:00.000Z",
    eventAcceptUntil: "2026-07-18T12:00:00.000Z",
    scope: {
      regionSlug: "san-diego",
      hasAvailabilityConstraint: false,
      hasTravelConstraint: false,
    },
    forecastManifest: {
      snapshotHash: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      sourcePolicyVersion: "legacy-72h.v1",
      newestForecastIssuedAt: "2026-07-17T06:00:00.000Z",
    },
    sourceIssuance: null,
    scorerVersions: { primary: "unversioned-legacy" },
    policyVersions: { presentation: "legacy-web-home.v1" },
    userContextProvenance: {
      safetyCohort: "unknown" as const,
      skillSource: "missing" as const,
      preferenceVersion: null,
      hasAvailabilityConstraint: false,
      travelBucket: "unknown" as const,
    },
    candidates: [],
    serverCandidateOrder: [],
    serverReturnedCandidateOrder: [],
    serverSelectedCandidateId: null,
  };
}

describe("legacy decision envelope contracts", () => {
  it("canonicalizes object keys and produces stable scoped candidate IDs", () => {
    expect(canonicalizeJson({ b: 2, a: { d: 4, c: 3 } })).toBe(
      '{"a":{"c":3,"d":4},"b":2}'
    );
    expect(buildLegacyCandidateId("11111111-1111-4111-8111-111111111111", "beach:a|start:1"))
      .toBe(buildLegacyCandidateId("11111111-1111-4111-8111-111111111111", "beach:a|start:1"));
    expect(buildLegacyCandidateId("11111111-1111-4111-8111-111111111111", "beach:a|start:1"))
      .not.toBe(buildLegacyCandidateId("22222222-2222-4222-8222-222222222222", "beach:a|start:1"));
  });

  it("drops raw coordinates and exact travel or availability values", () => {
    expect(sanitizeLegacyScope({
      regionSlug: "san-diego",
      latitude: 32.832,
      longitude: -117.281,
      radiusMiles: 27,
      availabilityStart: "2026-07-18T06:00:00Z",
    })).toEqual({
      regionSlug: "san-diego",
      radiusBucket: "25_50_miles",
      hasAvailabilityConstraint: true,
      hasTravelConstraint: true,
    });
  });

  it("rejects a client reference containing internal context", () => {
    expect(() => LegacyDecisionReferenceSchema.parse({
      envelopeId: "11111111-1111-4111-8111-111111111111",
      envelopeVersion: 1,
      originSurface: "web_home",
      authorityPath: "surf_discovery_v1",
      selectedCandidateId: null,
      userContext: { skill: "beginner" },
    })).toThrow();
  });

  it("redacts every candidate identity from a held client reference", () => {
    const held = redactLegacyDecisionForHeldResponse(POSITIVE_REFERENCE);
    expect(HeldLegacyDecisionReferenceSchema.parse(held)).toMatchObject({
      envelopeId: POSITIVE_REFERENCE.envelopeId,
      selectedCandidateId: null,
    });
    expect(JSON.stringify(held)).not.toContain(POSITIVE_REFERENCE.selectedCandidateId);
    expect(held).not.toHaveProperty("candidateIds");
    expect(held).not.toHaveProperty("candidateMap");
  });

  it("rejects unknown keys inside every persisted JSON object", () => {
    const input = buildCompleteGenerationInput();
    expect(() => LegacyDecisionGenerationInputSchema.parse({
      ...input,
      scope: { ...input.scope, latitude: 32.832 },
    })).toThrow();
    expect(() => LegacyDecisionGenerationInputSchema.parse({
      ...input,
      forecastManifest: { ...input.forecastManifest, rawProfile: {} },
    })).toThrow();
  });

  it("rejects free-form verdicts and candidate reasons", () => {
    expect(() => LegacyDecisionCandidateInputSchema.parse({
      ...VALID_CANDIDATE,
      verdict: "Email me at surfer@example.com",
    })).toThrow();
    expect(() => LegacyDecisionCandidateInputSchema.parse({
      ...VALID_CANDIDATE,
      reasonCodes: ["the user lives near a private spot"],
    })).toThrow();
  });

  it("derives stable UUID idempotency and deterministic expiry", () => {
    expect(buildLegacyIdempotencyUuid(
      "message_weekend_window_v1",
      "weekend_window:user-1:2026-07-18",
    )).toBe(buildLegacyIdempotencyUuid(
      "message_weekend_window_v1",
      "weekend_window:user-1:2026-07-18",
    ));
    expect(resolveLegacyDecisionExpiry(
      "message",
      new Date("2026-07-17T12:00:00.000Z"),
    )).toEqual({
      expiresAt: new Date("2026-07-18T12:00:00.000Z"),
      eventAcceptUntil: new Date("2026-08-16T12:00:00.000Z"),
    });
  });

  it("accepts a complete generation input with an explicit empty selection", () => {
    expect(LegacyDecisionGenerationInputSchema.parse(
      buildCompleteGenerationInput(),
    )).toBeDefined();
  });

  it("has one owned registry row for every authority enum and no hidden denominator", () => {
    expect(LEGACY_DECISION_AUTHORITY_REGISTRY.map((row) => row.authorityPath).sort())
      .toEqual([...LegacyDecisionAuthorityPathSchema.options].sort());
    expect(new Set(LEGACY_DECISION_AUTHORITY_REGISTRY.map((row) => row.authorityPath)).size)
      .toBe(LEGACY_DECISION_AUTHORITY_REGISTRY.length);
    for (const row of LEGACY_DECISION_AUTHORITY_REGISTRY) {
      expect(row.owner).toEqual(expect.any(String));
      expect(["covered", "accepted_gap", "release_blocker"])
        .toContain(row.generationDisposition);
      expect(["covered", "accepted_gap", "release_blocker"])
        .toContain(row.renderDisposition);
      if (row.generationDisposition === "accepted_gap" || row.renderDisposition === "accepted_gap") {
        expect(row.gapCode).toEqual(expect.any(String));
        expect(row.reviewExpiresAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });
});
```

- [ ] **Step 2: Run the contract test to verify it fails**

Run: `yarn test:unit --runTestsByPath __tests__/lib/recommendations/legacy-envelope/contracts.test.ts --runInBand`

Expected: FAIL with module-not-found errors for `legacy-envelope/types`, `canonicalize`, `candidate-id`, and `privacy`.

- [ ] **Step 3: Implement the contracts and helpers**

Use these exact public shapes in `types.ts`:

```ts
import { z } from "zod";

export const LegacyDecisionOriginSurfaceSchema = z.enum([
  "web_home", "web_oracle", "web_discover", "web_spot", "web_forecast_hub",
  "web_map", "web_scored_forecast", "web_coach_picks", "web_intent", "web_share_card",
  "native_home", "native_beach_detail", "native_week_scout", "native_map", "native_plan_next",
  "email_conditions_alert", "email_reengagement", "email_first_session_nudge", "email_weekly_recap",
  "push_home_morning_call", "push_weekend_window", "push_similarity_alert",
  "push_condition_alert", "push_first_session_nudge", "push_swell_watch",
  "social_bluesky", "internal_prefetch", "unknown_legacy",
]);

export const LegacyDecisionAuthorityPathSchema = z.enum([
  "surf_discovery_v1", "surf_discovery_v2", "surf_call_v1", "surf_call_native_fallback_v1",
  "week_scout_server_v1", "week_scout_native_fallback_v1",
  "native_home_ranker_v1", "native_beach_detail_v1",
  "session_intelligence_home_v1", "session_intelligence_spot_v1",
  "session_intelligence_regional_v1", "forecast_top_spots_v1",
  "regional_forecast_copy_v1", "forecast_bulk_map_v1", "forecast_scored_beach_v1",
  "coach_picks_v1", "intent_forecast_v1", "native_map_summary_v1",
  "native_plan_next_ranker_v1", "og_surf_call_v1",
  "og_weekend_wave_check_v1", "social_bluesky_auto_post_v1",
  "daily_intel_v2", "message_home_morning_call_v1", "message_weekend_window_v1",
  "message_conditions_alert_v1", "message_similarity_alert_v1",
  "message_condition_rule_v1", "message_first_session_nudge_v1",
  "message_first_session_nudge_push_v1", "message_weekly_recap_v1",
  "message_reengagement_v1", "message_swell_watch_v1",
  "legacy_public_recommendations_v1",
]);

export const LegacyDecisionAuthorityFamilySchema = z.enum([
  "discovery", "surf_call", "week_scout", "session_intelligence",
  "forecast_rankings", "daily_intel", "message", "legacy_public",
]);

export const LegacyDecisionMutationReasonSchema = z.enum([
  "photo_required_filter", "entitlement_teaser", "client_filter",
  "client_reorder", "cache_replay", "stability_retained",
  "fallback_refetch", "server_none_preserved", "region_filter",
  "beginner_filter", "longboard_filter", "quiet_filter",
  "excluded_beach_filter", "local_home_rank", "local_map_summary",
  "plan_next_merge", "plan_next_rank",
]);

export type LegacyDecisionMutationReason = z.infer<
  typeof LegacyDecisionMutationReasonSchema
>;

export const LegacyDecisionScopeSchema = z.object({
  regionSlug: z.string().min(1).max(80).nullable().optional(),
  publicBeachIds: z.array(z.string().uuid()).max(100).optional(),
  radiusBucket: z.enum(["0_10_miles", "10_25_miles", "25_50_miles", "50_plus_miles"]).optional(),
  dayBucket: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  timeOfDayBucket: z.enum(["dawn", "morning", "midday", "afternoon", "evening", "any"]).optional(),
  hasAvailabilityConstraint: z.boolean(),
  hasTravelConstraint: z.boolean(),
}).strict();

export const LegacyForecastSnapshotSchema = z.object({
  forecastId: z.string().max(120).nullable(),
  publicBeachId: z.string().uuid().nullable(),
  forecastAt: z.string().datetime().nullable(),
  issuedAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime().nullable(),
  waveHeightM: z.number().finite().nonnegative().nullable(),
  wavePeriodS: z.number().finite().nonnegative().nullable(),
  waveDirectionDeg: z.number().finite().min(0).max(360).nullable(),
  sourceCode: z.string().min(1).max(64).nullable(),
  modelCode: z.string().min(1).max(64).nullable(),
  measurementBasis: z.enum(["offshore_significant_height", "breaking_face_height", "legacy_unspecified"]),
  unit: z.literal("meters"),
}).strict();

export const LegacyScoreSnapshotSchema = z.object({
  legacyTotal: z.number().finite().nullable(),
  condition: z.number().finite().nullable(),
  personalMatch: z.number().finite().nullable(),
  timing: z.number().finite().nullable(),
  popularity: z.number().finite().nullable(),
  tieBreakRank: z.number().int().positive().nullable(),
}).strict();

export const LegacyCandidateProvenanceSchema = z.object({
  adapterVersion: z.string().min(1).max(120),
  sourceAuthority: LegacyDecisionAuthorityPathSchema,
  sourceCandidateKeyHash: z.string().length(43),
  selectionStage: z.enum(["evaluated", "returned", "rendered", "message_selected"]),
}).strict();

export const LegacyForecastManifestSchema = z.object({
  snapshotHash: z.string().length(43),
  sourcePolicyVersion: z.string().min(1).max(120),
  newestForecastIssuedAt: z.string().datetime().nullable(),
}).strict();

export const LegacySourceIssuanceSchema = z.object({
  kind: z.literal("beach_daily_intel"),
  issuanceId: z.string().uuid(),
  sourceRecordId: z.string().uuid(),
  sourceRevisionAt: z.string().datetime(),
  sourceRevisionHash: z.string().length(43),
}).strict();

export const LegacyScorerVersionsSchema = z.object({
  primary: z.string().min(1).max(120),
  window: z.string().min(1).max(120).optional(),
  fallback: z.string().min(1).max(120).optional(),
  clientReranker: z.string().min(1).max(120).optional(),
}).strict();

export const LegacyPolicyVersionsSchema = z.object({
  eligibility: z.string().min(1).max(120).optional(),
  hold: z.string().min(1).max(120).optional(),
  stability: z.string().min(1).max(120).optional(),
  cache: z.string().min(1).max(120).optional(),
  presentation: z.string().min(1).max(120).optional(),
}).strict();

export const LegacyUserContextProvenanceSchema = z.object({
  safetyCohort: z.enum(["beginner", "intermediate", "advanced", "expert", "unknown"]),
  skillSource: z.enum(["profile", "request", "missing", "not_applicable"]),
  preferenceVersion: z.string().min(1).max(120).nullable(),
  hasAvailabilityConstraint: z.boolean(),
  travelBucket: z.enum(["local", "regional", "extended", "none", "unknown"]),
}).strict();

export const LegacyDecisionReferenceSchema = z.object({
  envelopeId: z.string().uuid(),
  envelopeVersion: z.literal(1),
  originSurface: LegacyDecisionOriginSurfaceSchema,
  authorityPath: LegacyDecisionAuthorityPathSchema,
  selectedCandidateId: z.string().min(8).max(96).nullable(),
  eventToken: z.string().min(20).optional(),
  actorClaimToken: z.string().min(20).optional(),
  eventAcceptUntil: z.string().datetime().optional(),
}).strict();

export const HeldLegacyDecisionReferenceSchema = LegacyDecisionReferenceSchema.extend({
  selectedCandidateId: z.null(),
}).strict();

export function redactLegacyDecisionForHeldResponse(
  reference: LegacyDecisionReference,
): HeldLegacyDecisionReference {
  return HeldLegacyDecisionReferenceSchema.parse({
    ...reference,
    selectedCandidateId: null,
  });
}

export const LegacyDecisionVerdictSchema = z.enum([
  "yes", "maybe", "no", "worth_it", "skip", "unknown",
  "good", "fair", "check", "go", "hold", "none",
  "positive", "neutral", "negative",
]);

export const LegacyCandidateReasonCodeSchema = z.enum([
  "eligible", "ineligible", "selected", "not_selected", "score_rank",
  "photo_missing", "travel_exceeded", "availability_mismatch", "skill_mismatch",
  "preference_match", "fallback", "no_data", "positive", "neutral", "negative",
  "golden_window", "coach_pick", "intent_top_pick", "local_rank",
  "deduplicated", "filtered", "message_primary", "unknown",
]);

export const LegacyDecisionCandidateInputSchema = z.object({
  candidateId: z.string().min(8).max(96),
  stableKeyHash: z.string().length(43),
  candidateKind: z.enum([
    "beach_window", "custom_spot_window", "surf_call", "message_window",
    "forecast_slot", "ranked_beach", "public_share_recommendation",
  ]),
  publicBeachId: z.string().uuid().nullable(),
  windowStart: z.string().datetime().nullable(),
  windowEnd: z.string().datetime().nullable(),
  forecastAt: z.string().datetime().nullable(),
  evaluatedRank: z.number().int().positive().nullable(),
  responseRank: z.number().int().positive().nullable(),
  score: z.number().finite().nullable(),
  verdict: LegacyDecisionVerdictSchema.nullable(),
  eligibilityState: z.enum(["eligible", "ineligible", "unknown"]),
  reasonCodes: z.array(LegacyCandidateReasonCodeSchema).max(20),
  selected: z.boolean(),
  returned: z.boolean(),
  forecastSnapshot: LegacyForecastSnapshotSchema,
  scoreSnapshot: LegacyScoreSnapshotSchema,
  provenance: LegacyCandidateProvenanceSchema,
}).strict();

export const LegacyDecisionGenerationInputSchema = z.object({
  envelopeVersion: z.literal(1),
  idempotencyKey: z.string().uuid(),
  parentEnvelopeId: z.string().uuid().nullable().optional(),
  userId: z.string().uuid().nullable().optional(),
  actorSessionHash: z.string().length(64).nullable().optional(),
  originSurface: LegacyDecisionOriginSurfaceSchema,
  clientPlatform: z.enum(["web", "ios", "android", "server_message"]),
  authorityPath: LegacyDecisionAuthorityPathSchema,
  authorityFamily: LegacyDecisionAuthorityFamilySchema,
  authorityVersion: z.string().min(1).max(120),
  generationReason: z.enum(["interactive_request", "fallback_refetch", "cache_replay", "background_prefetch", "scheduled_message"]),
  generationTrust: z.enum(["server_observed", "client_reported"]),
  generatedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  eventAcceptUntil: z.string().datetime(),
  scope: LegacyDecisionScopeSchema,
  forecastManifest: LegacyForecastManifestSchema,
  sourceIssuance: LegacySourceIssuanceSchema.nullable(),
  scorerVersions: LegacyScorerVersionsSchema,
  policyVersions: LegacyPolicyVersionsSchema,
  userContextProvenance: LegacyUserContextProvenanceSchema,
  candidates: z.array(LegacyDecisionCandidateInputSchema).max(500),
  serverCandidateOrder: z.array(z.string()).max(500),
  serverReturnedCandidateOrder: z.array(z.string()).max(100),
  serverSelectedCandidateId: z.string().nullable(),
}).strict();

export const LegacyDecisionLifecycleEventInputSchema = z.object({
  clientEventId: z.string().uuid(),
  eventType: z.enum(["shown", "opened", "session_linked"]),
  envelopeId: z.string().uuid(),
  renderedFromEnvelopeId: z.string().uuid(),
  renderedCandidateIds: z.array(z.string()).max(100),
  renderedPrimaryCandidateId: z.string().nullable(),
  renderOutcome: z.enum(["positive", "explicit_none"]),
  originSurface: LegacyDecisionOriginSurfaceSchema,
  clientAuthorityPath: LegacyDecisionAuthorityPathSchema,
  clientAuthorityVersion: z.string().min(1).max(120),
  mutationReasonCodes: z.array(LegacyDecisionMutationReasonSchema).max(20),
  sessionId: z.string().uuid().nullable(),
  occurredAt: z.string().datetime(),
}).strict().superRefine((event, ctx) => {
  const hasPrimary = event.renderedPrimaryCandidateId !== null;
  const primaryIsMember = hasPrimary && event.renderedCandidateIds.includes(
    event.renderedPrimaryCandidateId as string,
  );
  if (event.renderOutcome === "positive" && !primaryIsMember) {
    ctx.addIssue({ code: "custom", message: "positive render requires member primary" });
  }
  if (event.renderOutcome === "explicit_none" &&
      (hasPrimary || event.renderedCandidateIds.length > 0)) {
    ctx.addIssue({ code: "custom", message: "explicit none cannot carry candidates" });
  }
  if ((event.eventType === "opened" || event.eventType === "session_linked") &&
      event.renderOutcome !== "positive") {
    ctx.addIssue({ code: "custom", message: `${event.eventType} requires a positive candidate` });
  }
  if (event.eventType === "session_linked" && event.sessionId === null) {
    ctx.addIssue({ code: "custom", message: "session_linked requires sessionId" });
  }
  if (event.eventType !== "session_linked" && event.sessionId !== null) {
    ctx.addIssue({ code: "custom", message: "only session_linked may carry sessionId" });
  }
});

export const LegacyDecisionCoverageGapInputSchema = z.object({
  clientEventId: z.string().uuid(),
  eventType: z.literal("coverage_gap"),
  envelopeId: z.string().uuid().nullable(),
  originSurface: LegacyDecisionOriginSurfaceSchema,
  clientAuthorityPath: LegacyDecisionAuthorityPathSchema,
  clientAuthorityVersion: z.string().min(1).max(120),
  sessionId: z.string().uuid().nullable().default(null),
  rejectionReason: z.enum([
    "missing_envelope", "invalid_nonmember", "actor_mismatch", "old_cache_without_identity",
    "message_shown_unobservable", "public_share_shown_unobservable",
    "offline_generation_unobservable", "persistence_failed", "semantic_mismatch",
    "anonymous_claim_missing", "actor_claim_failed", "session_link_retryable",
    "session_link_expired", "session_link_attempts_exhausted",
  ]),
  occurredAt: z.string().datetime(),
}).strict().superRefine((event, ctx) => {
  const sessionScopedReasons = new Set([
    "semantic_mismatch", "session_link_retryable", "session_link_expired",
    "session_link_attempts_exhausted",
  ]);
  if (sessionScopedReasons.has(event.rejectionReason) !== (event.sessionId !== null)) {
    ctx.addIssue({
      code: "custom",
      message: "sessionId is required only for a session-scoped link gap",
    });
  }
});

export const LegacyDecisionEventInputSchema = z.union([
  LegacyDecisionLifecycleEventInputSchema,
  LegacyDecisionCoverageGapInputSchema,
]);

export type LegacyDecisionReference = z.infer<typeof LegacyDecisionReferenceSchema>;
export type HeldLegacyDecisionReference = z.infer<typeof HeldLegacyDecisionReferenceSchema>;
export type LegacyDecisionOriginSurface = z.infer<typeof LegacyDecisionOriginSurfaceSchema>;
export type LegacyDecisionGenerationInput = z.infer<typeof LegacyDecisionGenerationInputSchema>;
export type LegacyDecisionCandidateInput = z.infer<typeof LegacyDecisionCandidateInputSchema>;
export type LegacyDecisionEventInput = z.infer<typeof LegacyDecisionEventInputSchema>;
```

Implement recursive key sorting in `canonicalize.ts` and Node
`createHash("sha256")`. A public candidate ID is the prefix `lc_` plus
`sha256Base64Url("legacy-candidate-v1\\0" + idempotencyKey + "\\0" + stableKey)`.
Private candidates (`custom_spot_window` and any future account-private kind)
first derive `stableKeyHash = base64url(HMAC-SHA256(LEGACY_DECISION_PRIVATE_HASH_SECRET,
"legacy-private-candidate-v1\\0" + idempotencyKey + "\\0" + candidateKind +
"\\0" + privateStableKey))`; candidate IDs are then built from that keyed
hash, never the raw private ID. The idempotency key makes identical private IDs
unlinkable across envelopes. Raw private IDs must not enter an envelope,
payload hash, log, event, URL, or client persistence. `buildLegacyIdempotencyUuid`
hashes the versioned namespace, authority path, and external key into 16 bytes,
sets RFC 4122 variant bits and UUID version 8 bits, and formats the result as a
UUID; tests cover stable output, authority separation, private-hash envelope
separation, secret rotation fixtures, and 10,000 fixture keys without a
collision.

The mutation enum above is the complete v1 allowlist. Web, native, route, and RPC code must import or mirror this exact list; individual adapters may not introduce string literals outside it. The migration constrains every array element to this list, and a contract fixture test compares the native mirror and SQL allowlist with `LegacyDecisionMutationReasonSchema.options`. `sourceIssuance` is required only for `daily_intel_v2`, forbidden for other authorities, and creates an immutable issuance-to-envelope mapping even though `beach_daily_intel` continues to upsert its current row.

`authority-registry.ts` is a frozen typed array, not a dashboard-maintained
list. Its authority path set must equal the Zod enum exactly. Each row pins the
authority family, current adapter owner/file, generation/render disposition,
expected origin surfaces, applicable gap code, review owner, and expiry. The
SQL authority-family mapping and reporting service import or mirror this
registry and are compared in contract/migration tests. Accepted-gap approval
metadata is configuration reviewed in code; an environment allowlist cannot
remove a registry row. A registry entry whose review expires becomes
`release_blocker` until it is reapproved or covered.

Candidate `verdict` and `reasonCodes` are also closed vocabularies. Each
server adapter has an explicit exhaustive mapping from its legacy enum to the
normalized schemas above; an unrecognized value becomes the literal
`unknown`, never the source string. Client-generation requests may submit only
those normalized enum values and the route parses them before persistence.
Free-form explanations, `why` copy, provider text, URLs, emails, names, and
unknown reason strings are rejected. The migration mirrors both ordered
allowlists with SQL checks, and the contract/migration tests compare them to
the Zod options so service-role callers cannot bypass the privacy boundary.

`expiry-policy.ts` freezes these Phase 0-B TTLs:

| Authority family | Decision TTL | Event acceptance TTL |
|---|---:|---:|
| `discovery`, `session_intelligence`, `forecast_rankings`, `legacy_public` | 30 minutes | 24 hours |
| `surf_call` | 60 minutes | 24 hours |
| `week_scout` | 30 hours | 7 days |
| `daily_intel` | 24 hours | 7 days |
| `message` | 24 hours | 30 days |

The generation schema must require `expiresAt` and `eventAcceptUntil` to equal the selected policy exactly. `shown` and cross-envelope render events must occur no later than decision expiry; delayed message `opened` events may arrive after decision expiry but no later than event acceptance expiry.

Implement privacy helpers as explicit allowlists; `sanitizeForecastSnapshot` may return only the fields in `LegacyForecastSnapshotSchema` and must never spread the source object. The four JSONB groups and all candidate JSONB values are parsed by these strict schemas again inside `recordLegacyDecisionEnvelope`; the database RPC independently rejects unknown top-level JSONB keys with a `jsonb_has_only_keys_v1` helper before insert. No adapter, client-generation route, or service-role caller may bypass these parsers.

- [ ] **Step 4: Run the contract test and typecheck**

Run: `yarn test:unit --runTestsByPath __tests__/lib/recommendations/legacy-envelope/contracts.test.ts --runInBand && yarn typecheck`

Expected: PASS for the contract suite and exit code 0 from TypeScript.

- [ ] **Step 5: If the user explicitly authorized commits, commit the contract boundary**

```bash
git add lib/recommendations/legacy-envelope __tests__/lib/recommendations/legacy-envelope/contracts.test.ts
git commit -m "feat(forecast): define legacy decision envelope contracts"
```

### Task 2: Add independent feature flags and best-effort persistence

**Files:**
- Create: `lib/recommendations/legacy-envelope/feature-flags.ts`
- Create: `lib/recommendations/legacy-envelope/persistence.ts`
- Test: `__tests__/lib/recommendations/legacy-envelope/persistence.test.ts`

**Interfaces:**
- Consumes: `LegacyDecisionGenerationInput` and `LegacyDecisionReference` from Task 1.
- Produces: `isLegacyEnvelopeWriteEnabled(authorityPath)`, `isLegacyEventWriteEnabled(authorityPath)`, and `recordLegacyDecisionEnvelope(input, { signal?, dependencies? }): Promise<LegacyDecisionReference | null>` plus privacy-safe operational attempt telemetry. `dependencies` is an internal test seam whose default creates the production service-role client.

- [ ] **Step 1: Write failing flag and failure-neutrality tests**

```ts
import { isLegacyEnvelopeWriteEnabled } from "@/lib/recommendations/legacy-envelope/feature-flags";
import { recordLegacyDecisionEnvelope } from "@/lib/recommendations/legacy-envelope/persistence";

describe("legacy envelope persistence", () => {
  afterEach(() => jest.restoreAllMocks());

  it("requires both the global flag and authority allowlist", () => {
    process.env.LEGACY_DECISION_ENVELOPE_WRITE_ENABLED = "true";
    process.env.LEGACY_DECISION_ENVELOPE_AUTHORITIES = "surf_discovery_v1,week_scout_server_v1";
    expect(isLegacyEnvelopeWriteEnabled("surf_discovery_v1")).toBe(true);
    expect(isLegacyEnvelopeWriteEnabled("surf_call_v1")).toBe(false);
  });

  it("returns null instead of changing serving behavior when the RPC fails", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const rpc = jest.fn().mockResolvedValue({ data: null, error: new Error("db unavailable") });
    const input = buildValidGenerationInput();
    await expect(recordLegacyDecisionEnvelope(input, {
      dependencies: { createServiceRoleClient: async () => ({ rpc }) },
    })).resolves.toBeNull();
    expect(rpc).toHaveBeenCalledWith(
      "record_legacy_decision_write_attempt_v1",
      expect.objectContaining({
        p_attempt: expect.objectContaining({
          authority_path: input.authorityPath,
          outcome: "envelope_rpc_failed",
          duration_ms: expect.any(Number),
        }),
      }),
    );
  });

  it("emits a structured fallback when the independent attempt sink fails", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockAttemptRpc.mockRejectedValueOnce(new Error("attempt sink unavailable"));
    await recordLegacyDecisionEnvelope(buildValidGenerationInput());
    expect(error).toHaveBeenCalledWith(
      "legacy_decision_write_attempt",
      expect.objectContaining({ outcome: expect.any(String) }),
    );
  });

  it("cancels both RPCs at their own deadlines and propagates caller abort", async () => {
    jest.useFakeTimers();
    const caller = new AbortController();
    const promise = recordLegacyDecisionEnvelope(buildValidGenerationInput(), {
      signal: caller.signal,
    });
    caller.abort();
    await expect(promise).resolves.toBeNull();
    expect(mockEnvelopeAbortSignal).toHaveBeenCalled();
    expect(mockAttemptAbortSignal).toHaveBeenCalled();
  });
});
```

The test file must define `buildValidGenerationInput()` with the complete valid object from Task 1 rather than importing a production fixture.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn test:unit --runTestsByPath __tests__/lib/recommendations/legacy-envelope/persistence.test.ts --runInBand`

Expected: FAIL because the flag and persistence modules do not exist.

- [ ] **Step 3: Implement flags and persistence**

```ts
export function isLegacyEnvelopeWriteEnabled(authorityPath: string): boolean {
  if (process.env.LEGACY_DECISION_ENVELOPE_WRITE_ENABLED !== "true") return false;
  const allowed = new Set((process.env.LEGACY_DECISION_ENVELOPE_AUTHORITIES ?? "")
    .split(",").map((value) => value.trim()).filter(Boolean));
  return allowed.has(authorityPath);
}

export function isLegacyEventWriteEnabled(authorityPath: string): boolean {
  if (process.env.LEGACY_DECISION_EVENT_WRITE_ENABLED !== "true") return false;
  const allowed = new Set((process.env.LEGACY_DECISION_EVENT_AUTHORITIES ?? "")
    .split(",").map((value) => value.trim()).filter(Boolean));
  return allowed.has(authorityPath);
}
```

`recordLegacyDecisionEnvelope` must validate with `LegacyDecisionGenerationInputSchema`, return `null` when disabled, canonicalize and hash the validated input, call `record_legacy_decision_envelope_v1` through a service-role client, and return a strict `LegacyDecisionReference`. It accepts an optional caller `AbortSignal` and a typed dependency object only for tests; production callers omit the dependency object and receive the statically imported service-role factory. Tests inject the factory before invocation rather than mocking a module after it has already been imported. A shared `runRpcWithDeadline` composes that signal with a fresh timer and passes the result to the PostgREST builder's `.abortSignal(...)`; the envelope RPC has a 150 ms hard deadline and the independent attempt RPC has a 100 ms hard deadline. Timers are always cleared. A deadline abort records `timed_out`, a caller abort records `caller_aborted`, and neither is retried inside an interactive request. Tests must prove that each underlying request receives cancellation, late resolution cannot mutate the returned result, and one RPC's controller is never reused for the other.

For every enabled attempt, generate an attempt UUID before the envelope RPC, measure wall-clock milliseconds, and in `finally` build one canonical privacy-safe attempt object containing only attempt ID, origin surface, platform, authority path/version, generation trust, outcome, duration, optional successful envelope ID, occurred time, and its own payload hash. Emit `legacy_decision_write_attempt` for **every** attempt, then call independent RPC `record_legacy_decision_write_attempt_v1` with that same object. If that sink fails or times out, increment the existing server error monitor; do not log candidates, coordinates, user IDs, scope, or context. The structured stream must be exported by the production Vercel Log Drain to an access-controlled append-only NDJSON archive with at least 90-day retention before attribution writes are enabled.

Reconciliation is an executable gate, not a dashboard inference. `scripts/ops/reconcile-legacy-decision-attempts.ts --from <ISO> --to <ISO> --log-export <path>` strictly parses the archived NDJSON schema, verifies the archive manifest SHA-256 and drain watermark through `to + 10 minutes`, deduplicates by `attemptId`, rejects conflicting duplicate payload hashes, and queries database attempts for the identical half-open interval `[from,to)`. It computes `expected = logIds ∪ databaseIds`, `sinkMissing = logIds − databaseIds`, `logMissing = databaseIds − logIds`, and `payloadMismatch` for IDs whose hashes differ. A window is `trusted` only when the archive watermark is continuous and all three discrepancy sets are empty; otherwise the script exits nonzero and the 99% gate is blocked. The signed JSON result, input archive manifest hash, row counts, and interval are retained with the rollout evidence. The dashboard denominator is the reconciled union only for trusted windows; it must never substitute whichever source happens to be larger.

- [ ] **Step 4: Run tests and typecheck**

Run: `yarn test:unit --runTestsByPath __tests__/lib/recommendations/legacy-envelope/persistence.test.ts --runInBand && yarn typecheck`

Expected: PASS and TypeScript exit code 0.

- [ ] **Step 5: If the user explicitly authorized commits, commit the flag and persistence boundary**

```bash
git add lib/recommendations/legacy-envelope/feature-flags.ts lib/recommendations/legacy-envelope/persistence.ts __tests__/lib/recommendations/legacy-envelope/persistence.test.ts
git commit -m "feat(forecast): add flag-gated envelope persistence"
```

### Task 3: Define the append-only database schema and stop for migration approval

**Files:**
- Create: `supabase/migrations/20260717171000_create_legacy_decision_envelopes.sql`
- Create: `scripts/db/legacy-decision-envelope-smoke.sql`
- Create: `__tests__/migrations/legacy-decision-envelopes.test.ts`
- Modify after approval: `types/database.generated.ts`

**Interfaces:**
- Consumes: JSON produced by `recordLegacyDecisionEnvelope`.
- Produces: Tables `legacy_decision_envelopes`, `legacy_decision_candidates`, `legacy_decision_events`, `legacy_decision_write_attempts`, and `legacy_decision_session_link_outbox`; seven RPCs: `record_legacy_decision_envelope_v1(jsonb,jsonb,text)`, `append_legacy_decision_event_v1(jsonb)`, `record_legacy_decision_write_attempt_v1(jsonb)`, `claim_legacy_decision_actor_v1(jsonb)`, `enqueue_legacy_decision_session_link_v1(jsonb)`, no-argument `purge_legacy_decision_envelopes_v1()`, and `erase_legacy_decision_actor_v1(uuid)`; integration with the existing `delete_user_account(uuid)` erasure transaction; views `legacy_decision_coverage_daily` and `legacy_decision_divergence_daily`.

- [ ] **Step 1: Write the failing migration contract test**

```ts
import fs from "node:fs";
import path from "node:path";

const migrationPath = path.join(process.cwd(), "supabase/migrations/20260717171000_create_legacy_decision_envelopes.sql");

describe("legacy decision envelope migration", () => {
  it("creates append-only tables, RPCs, views, and revokes direct access", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");
    for (const required of [
      "create table public.legacy_decision_envelopes",
      "create table public.legacy_decision_candidates",
      "create table public.legacy_decision_events",
      "create table public.legacy_decision_write_attempts",
      "create table public.legacy_decision_session_link_outbox",
      "record_legacy_decision_envelope_v1",
      "append_legacy_decision_event_v1",
      "record_legacy_decision_write_attempt_v1",
      "claim_legacy_decision_actor_v1",
      "enqueue_legacy_decision_session_link_v1",
      "purge_legacy_decision_envelopes_v1",
      "erase_legacy_decision_actor_v1",
      "legacy_decision_coverage_daily",
      "legacy_decision_divergence_daily",
      "prevent_legacy_decision_update",
      "payload_hash",
      "revoke all",
      "grant execute",
    ]) expect(sql.toLowerCase()).toContain(required);
    expect(sql.toLowerCase()).not.toMatch(/parent_envelope_id[^,]+on delete cascade/);
    expect(sql.toLowerCase()).not.toMatch(/rendered_from_envelope_id[^,]+on delete cascade/);
    expect(sql.toLowerCase()).toMatch(/user_id uuid references auth\.users\(id\) on delete restrict/);
    expect(sql.toLowerCase()).toContain("perform erase_legacy_decision_actor_v1(p_user_id)");
    expect(sql.toLowerCase()).toContain("public_share_recommendation");
    expect(sql.toLowerCase()).toContain("intent_top_pick");
    expect(sql.toLowerCase()).toContain("offline_generation_unobservable");
  });

  it("does not add public or authenticated table policies", () => {
    const sql = fs.readFileSync(migrationPath, "utf8").toLowerCase();
    expect(sql).not.toContain("to authenticated using");
    expect(sql).not.toContain("to anon using");
  });
});
```

- [ ] **Step 2: Run the migration test to verify it fails**

Run: `yarn test:unit --runTestsByPath __tests__/migrations/legacy-decision-envelopes.test.ts --runInBand`

Expected: FAIL with `ENOENT` for `20260717171000_create_legacy_decision_envelopes.sql`.

- [ ] **Step 3: Write the migration and local smoke script without applying them**

The migration must implement this exact relational contract:

```sql
create table public.legacy_decision_envelopes (
  id uuid primary key default gen_random_uuid(),
  envelope_version smallint not null check (envelope_version = 1),
  user_id uuid references auth.users(id) on delete restrict,
  actor_session_hash text check (actor_session_hash is null or actor_session_hash ~ '^[0-9a-f]{64}$'),
  parent_envelope_id uuid references public.legacy_decision_envelopes(id) on delete restrict,
  origin_surface text not null,
  client_platform text not null check (client_platform in ('web','ios','android','server_message')),
  authority_path text not null,
  authority_family text not null check (authority_family in (
    'discovery','surf_call','week_scout','session_intelligence',
    'forecast_rankings','daily_intel','message','legacy_public'
  )),
  authority_version text not null,
  generation_reason text not null,
  generation_trust text not null check (generation_trust in ('server_observed','client_reported')),
  idempotency_key uuid not null,
  payload_hash text not null check (payload_hash ~ '^[A-Za-z0-9_-]{43}$'),
  scope_fingerprint text not null check (scope_fingerprint ~ '^[A-Za-z0-9_-]{43}$'),
  scope_summary jsonb not null,
  forecast_manifest jsonb not null,
  source_issuance jsonb,
  scorer_versions jsonb not null,
  policy_versions jsonb not null,
  user_context_provenance jsonb not null,
  server_selected_candidate_id text,
  server_candidate_order text[] not null default '{}',
  server_returned_candidate_order text[] not null default '{}',
  generated_at timestamptz not null,
  expires_at timestamptz not null,
  event_accept_until timestamptz not null,
  created_at timestamptz not null default now(),
  unique (authority_path, idempotency_key),
  check (expires_at > generated_at),
  check (event_accept_until >= expires_at)
);

create unique index legacy_decision_daily_intel_issuance_unique
  on public.legacy_decision_envelopes ((source_issuance->>'issuanceId'))
  where authority_path = 'daily_intel_v2';

create table public.legacy_decision_candidates (
  envelope_id uuid not null references public.legacy_decision_envelopes(id) on delete cascade,
  candidate_id text not null,
  stable_key_hash text not null check (stable_key_hash ~ '^[A-Za-z0-9_-]{43}$'),
  candidate_kind text not null check (
    candidate_kind in (
      'beach_window','custom_spot_window','surf_call','message_window',
      'forecast_slot','ranked_beach','public_share_recommendation'
    )
  ),
  public_beach_id uuid,
  window_start timestamptz,
  window_end timestamptz,
  forecast_at timestamptz,
  evaluated_rank integer check (evaluated_rank is null or evaluated_rank > 0),
  response_rank integer check (response_rank is null or response_rank > 0),
  score double precision,
  verdict text check (
    verdict is null or verdict in (
      'yes','maybe','no','worth_it','skip','unknown','good','fair','check',
      'go','hold','none','positive','neutral','negative'
    )
  ),
  eligibility_state text not null check (eligibility_state in ('eligible','ineligible','unknown')),
  reason_codes text[] not null default '{}' check (
    reason_codes <@ ARRAY[
      'eligible','ineligible','selected','not_selected','score_rank',
      'photo_missing','travel_exceeded','availability_mismatch','skill_mismatch',
      'preference_match','fallback','no_data','positive','neutral','negative',
      'golden_window','coach_pick','intent_top_pick','local_rank',
      'deduplicated','filtered','message_primary','unknown'
    ]::text[]
  ),
  selected boolean not null,
  returned boolean not null,
  forecast_snapshot jsonb not null,
  score_snapshot jsonb not null,
  provenance jsonb not null,
  created_at timestamptz not null default now(),
  primary key (envelope_id, candidate_id),
  check (window_end is null or window_start is null or window_end > window_start)
);

alter table public.legacy_decision_envelopes
  add constraint legacy_decision_selected_candidate_fkey
  foreign key (id, server_selected_candidate_id)
  references public.legacy_decision_candidates(envelope_id, candidate_id)
  deferrable initially deferred;

create table public.legacy_decision_events (
  id uuid primary key default gen_random_uuid(),
  client_event_id uuid not null,
  payload_hash text not null check (payload_hash ~ '^[A-Za-z0-9_-]{43}$'),
  event_type text not null check (event_type in ('generated','actor_bound','shown','opened','session_linked','coverage_gap')),
  envelope_id uuid references public.legacy_decision_envelopes(id) on delete restrict,
  rendered_from_envelope_id uuid references public.legacy_decision_envelopes(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete restrict,
  actor_session_hash text check (actor_session_hash is null or actor_session_hash ~ '^[0-9a-f]{64}$'),
  origin_surface text not null,
  client_authority_path text not null,
  client_authority_version text not null,
  rendered_primary_candidate_id text,
  rendered_candidate_ids text[] not null default '{}',
  render_outcome text check (render_outcome in ('positive','explicit_none')),
  mutation_reason_codes text[] not null default '{}',
  divergence_kind text,
  rejection_reason text check (
    rejection_reason is null or rejection_reason in (
      'missing_envelope','invalid_nonmember','actor_mismatch',
      'old_cache_without_identity','message_shown_unobservable',
      'public_share_shown_unobservable','offline_generation_unobservable',
      'persistence_failed','semantic_mismatch','anonymous_claim_missing',
      'actor_claim_failed','session_link_retryable','session_link_expired',
      'session_link_attempts_exhausted'
    )
  ),
  session_id uuid references public.sessions(id) on delete cascade,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  unique (event_type, client_event_id),
  check ((event_type = 'coverage_gap' and rejection_reason is not null) or (event_type <> 'coverage_gap' and envelope_id is not null)),
  check (
    event_type not in ('opened','session_linked')
    or (render_outcome = 'positive' and rendered_from_envelope_id is not null
      and rendered_primary_candidate_id is not null
      and rendered_primary_candidate_id = any(rendered_candidate_ids))
  ),
  check (
    event_type <> 'shown'
    or (rendered_from_envelope_id is not null and (
      (render_outcome = 'positive'
        and rendered_primary_candidate_id is not null
        and rendered_primary_candidate_id = any(rendered_candidate_ids))
      or
      (render_outcome = 'explicit_none'
        and rendered_primary_candidate_id is null
        and cardinality(rendered_candidate_ids) = 0)
    ))
  ),
  check (
    (event_type = 'session_linked' and session_id is not null)
    or
    (event_type = 'coverage_gap'
      and rejection_reason in (
        'semantic_mismatch','session_link_retryable',
        'session_link_expired','session_link_attempts_exhausted'
      )
      and session_id is not null)
    or
    (event_type not in ('session_linked','coverage_gap') and session_id is null)
    or
    (event_type = 'coverage_gap'
      and rejection_reason not in (
        'semantic_mismatch','session_link_retryable',
        'session_link_expired','session_link_attempts_exhausted'
      )
      and session_id is null)
  )
);

create table public.legacy_decision_write_attempts (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique,
  payload_hash text not null check (payload_hash ~ '^[A-Za-z0-9_-]{43}$'),
  origin_surface text not null,
  client_platform text not null check (client_platform in ('web','ios','android','server_message')),
  authority_path text not null,
  authority_version text not null,
  generation_trust text not null check (generation_trust in ('server_observed','client_reported')),
  outcome text not null check (outcome in (
    'persisted','validation_failed','envelope_rpc_failed','timed_out','caller_aborted'
  )),
  duration_ms integer not null check (duration_ms >= 0),
  envelope_id uuid references public.legacy_decision_envelopes(id) on delete restrict,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  check ((outcome = 'persisted') = (envelope_id is not null))
);

create table public.legacy_decision_session_link_outbox (
  session_id uuid primary key references public.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  envelope_id uuid not null references public.legacy_decision_envelopes(id) on delete restrict,
  rendered_from_envelope_id uuid not null references public.legacy_decision_envelopes(id) on delete restrict,
  candidate_id text not null,
  origin_surface text not null,
  client_authority_path text not null,
  client_authority_version text not null,
  payload_hash text not null check (payload_hash ~ '^[A-Za-z0-9_-]{43}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > created_at),
  foreign key (rendered_from_envelope_id, candidate_id)
    references public.legacy_decision_candidates(envelope_id, candidate_id)
    deferrable initially deferred
);

alter table public.legacy_decision_events
  add constraint legacy_decision_event_primary_candidate_fkey
  foreign key (rendered_from_envelope_id, rendered_primary_candidate_id)
  references public.legacy_decision_candidates(envelope_id, candidate_id)
  deferrable initially deferred;
```

Add indexes on envelope `(generated_at, origin_surface, authority_path)`, candidate `(public_beach_id, forecast_at)`, event `(received_at, origin_surface, divergence_kind)`, attempt `(occurred_at, authority_path, outcome)`, and outbox `(expires_at, created_at)`. Add a `before update` trigger on all five tables that raises SQLSTATE `55000`. Revoke direct delete on all five; only the security-definer retention/erasure functions may delete. Enable RLS, create no client policies, revoke all table/view/function privileges from `PUBLIC`, `anon`, and `authenticated`, and grant only the seven enumerated RPCs plus count-only reporting-view reads to `service_role`.

The migration defines SQL constants/functions for the exact v1 mutation,
candidate-kind, candidate-verdict, and candidate-reason allowlists from Task 1
and rejects any element outside them; TypeScript and SQL drift is a
migration-test failure. `record_legacy_decision_envelope_v1` revalidates these
values before insert even if a service-role caller bypasses TypeScript.
The envelope RPC requires `source_issuance` with exactly `kind`, `issuanceId`,
`sourceRecordId`, `sourceRevisionAt`, and `sourceRevisionHash` for
`daily_intel_v2`, checks that the referenced `beach_daily_intel` row and
revision hash match at insert time, and forbids it for all other authorities.
The partial unique issuance index makes the mapping immutable and one-to-one
even after the mutable source row receives a later upsert.

`record_legacy_decision_envelope_v1(p_envelope jsonb, p_candidates jsonb, p_payload_hash text)` must use `security definer set search_path = ''`, return the existing ID only when `(authority_path,idempotency_key)` and payload hash match, raise SQLSTATE `23505` on a mismatched collision, validate selected/order membership, enforce the authority-family mapping and exact expiry-policy TTLs, and insert envelope, candidates, and the `generated` event in one transaction. A `parent_envelope_id` is accepted only when parent and child have the same actor identity, scope fingerprint, and authority family. Before insertion it calls `jsonb_has_only_keys_v1` for the envelope, scope, forecast manifest, source issuance, scorer versions, policy versions, user provenance, and every candidate forecast/score/provenance object; unknown keys or wrong JSON types are rejected even if a service caller bypasses TypeScript.

`append_legacy_decision_event_v1(p_event jsonb)` must return `(accepted boolean, event_id uuid, divergence_kind text, rejection_reason text)`. It canonically hashes the submitted event before any server-derived fields; an existing `(event_type,client_event_id)` is returned only when its payload hash matches, otherwise the RPC raises `legacy decision event idempotency collision`. It validates actor ownership, session ownership, required positive/explicit-none shape, the complete mutation-reason allowlist, and all rendered IDs against `rendered_from_envelope_id`. Cross-envelope use is allowed only for `cache_replay`, `stability_retained`, or `fallback_refetch`, and only when fresh and rendered-owner envelopes have the same actor identity, scope fingerprint, authority family, compatible candidate kind, and unexpired decision window. Signed anonymous tokens bind both envelope IDs plus the actor-session hash. Invalid input becomes a `coverage_gap` row with no submitted candidate values and returns `accepted=false`. Accepted divergence is computed server-side as `exact`, `filtered`, `reordered`, `replaced_primary`, `cached_incumbent_retained`, `suppressed_server_positive`, or `client_positive_from_server_none`. `shown` must occur by `expires_at`; `opened` may occur through `event_accept_until`. The RPC rejects `session_id` on `generated`, `actor_bound`, `shown`, or `opened`; requires it on `session_linked`; and permits it on `coverage_gap` only for the four enumerated session-link reasons mirrored by the SQL check. No route may normalize an arbitrary lifecycle event into a session-scoped row.

For `session_linked`, the RPC additionally loads the session and candidate under one transaction. It requires session ownership; exact `sessions.beach_id = candidate.public_beach_id`; and, when the candidate has `window_start/window_end`, `sessions.arrival_time >= window_start AND sessions.arrival_time < window_end`. A candidate with only `forecast_at` uses an explicit ±90-minute compatibility interval; a candidate with neither a window nor `forecast_at` is not linkable. For `custom_spot_window`, the authenticated server route derives the same envelope-scoped private HMAC from `sessions.custom_spot_id`, sends only that hash, and the RPC requires it to equal `stable_key_hash` in addition to the denormalized public-beach match. A beach or time mismatch records `coverage_gap/semantic_mismatch`, never an accepted link. Unit and smoke fixtures cover correct beach/window, wrong beach, boundary timestamps, edited arrival time, custom-spot hash match, and private-ID mismatch.

`record_legacy_decision_write_attempt_v1(p_attempt jsonb)` is append-only and idempotent by `attempt_id` plus payload hash. It accepts only the privacy-safe operational fields in the table and never accepts actor, candidate, scope, location, or forecast data.

`claim_legacy_decision_actor_v1(p_claim jsonb)` inserts an immutable `actor_bound` event and never updates the original envelope. It accepts only a claim already verified by the authenticated server route: claim/event UUID, anonymous envelope ID, exact envelope `actor_session_hash`, authenticated user ID, purpose/version, issued/expiry times, and payload hash. It requires an anonymous envelope, matching actor-session hash, claim time no later than `event_accept_until`, and idempotent payload equality. A user may claim an anonymous actor hash only after the route verifies both the signed actor-claim token and the current server-minted signed visitor cookie/bearer; subsequent events treat the binding as actor ownership. Conflicting claims are rejected and audited as `actor_claim_failed` without candidate data.

`enqueue_legacy_decision_session_link_v1(p_link jsonb)` validates the authenticated user owns the session and both envelope identities either directly or through a valid `actor_bound` event, validates candidate membership plus the beach/window/private-binding semantics above, and inserts one immutable outbox row keyed by session UUID. It derives `expires_at = least(rendered_owner.event_accept_until, created_at + interval '30 days')`; an already expired link becomes a coverage gap and is not queued. An identical retry returns the row; a different payload for the same session raises `legacy decision session-link collision`. The worker passes that row to the lifecycle RPC with `client_event_id=session_id`; the outbox row remains as durable audit evidence until retention or session-scoped erasure.

The outbox worker has bounded retry semantics without mutating the append-only row. Each retryable failure appends a candidate-free `coverage_gap/session_link_retryable` event keyed deterministically by `(session_id, attempt_number)`. The next due time is derived from those events with delays `5m, 15m, 1h, 6h`, then `24h` capped; the worker stops at 32 attempts or `expires_at`, whichever comes first, and appends exactly one idempotent terminal `session_link_attempts_exhausted` or `session_link_expired` gap. Terminal rows are excluded from future selects. The cron processes at most 500 due rows per run with 20-way concurrency, a 10-second route deadline, and a 2-second per-RPC deadline. Dashboard backlog separates due, backed-off, expired, exhausted, and linked rows; any oldest-due age over 15 minutes blocks rollout.

`purge_legacy_decision_envelopes_v1()` accepts no clock and uses one captured
`transaction_timestamp()` for every cutoff. It computes complete dependency
components across parent links, event `envelope_id`, rendered-owner links,
write-attempt envelope references, and session-link outbox references before
deleting anything. A component containing any valid `session_linked`
event—regardless of whether its generation actor was anonymous—is retained
until 13 months after that component's latest `session_linked.received_at`.
Every other component is retained until 90 days after the latest envelope
`generated_at`, event `received_at`, attempt `occurred_at`, or outbox
`created_at` in the component. Failed standalone attempts with no envelope are
retained 90 days from `occurred_at` and purged independently. Envelope-null,
session-null coverage-gap events are also purged independently after 90 days
from `received_at`; envelope-null session-scoped link gaps are retained for 13
months from `received_at` unless session erasure cascades them earlier. A
component or standalone class is deleted only when every referenced node is
due; delete order is events, outbox, candidates, attempts, then envelopes so
restricted cross-envelope FKs cannot cascade away a younger record. The
function returns aggregate counts only. Its no-argument signature and use of
the database transaction clock are static and SQL-smoke assertions; callers
cannot accelerate deletion with a future timestamp.

`erase_legacy_decision_actor_v1(p_user_id uuid)` computes every dependency
component owned by that actor, verifies cross-actor links are absent, and
deletes the full components in the same safe order. It also treats
envelope-null gaps as singleton erasure nodes: delete every such row whose
`actor_user_id=p_user_id` and every anonymous actor-session hash immutably bound
to that user by an `actor_bound` event. This explicitly covers
`missing_envelope`, offline-generation, persistence, and claim gaps that never
joined an envelope component. All auth-user foreign keys use `ON DELETE
RESTRICT`; account erasure never relies on a hidden cascade. In the same
migration, replace the current canonical `delete_user_account(uuid)` body from
`20260427182722_patch_delete_user_account_drop_dead_column_refs.sql` with an
otherwise byte-equivalent body that calls `PERFORM
public.erase_legacy_decision_actor_v1(p_user_id);` inside its existing
transaction before profile anonymization. Add a migration fixture that fails
account deletion if the call is removed and proves no legacy actor/session
hash or standalone actor gap remains afterward. Session deletion is explicitly
classified as session-scoped erasure and may cascade-delete only its outbox,
its `session_linked` event, and the four session-scoped link-gap event classes
required to carry that same session ID. The smoke test proves `shown`,
`opened`, actor/generation history, and unrelated envelope history remain.
Revoke purge/actor-erasure functions from client roles and grant them only to
`service_role`.

Define `legacy_decision_coverage_daily` from write attempts plus generated,
shown, session-linked, and coverage-gap events. `internal_prefetch`,
`message_shown_unobservable`, and `public_share_shown_unobservable` are exposed
as named excluded sub-denominators rather than eligible render attempts.
`offline_generation_unobservable` remains an eligible failure in its own
offline-generation denominator; it cannot improve rendered coverage. The view
exposes persistence successes/failures and p50/p95 `duration_ms` using the
attempt table. Define `legacy_decision_divergence_daily` grouped by event day,
origin surface, client platform, authority path/version, client
authority/version, generation trust, and divergence kind. Both views expose
counts only and must not expose user, session, candidate, or forecast
identifiers. These ordinary views intentionally cover only the raw-record
retention window; P0-B does not promise aggregate history after its source rows
are purged.

The smoke SQL must begin `begin;`, exercise successful envelope/event/outbox idempotent replay, mismatched collision rejection, strict JSON-key rejection, complete mutation/candidate-kind/verdict/reason enum enforcement and TypeScript/SQL parity, keyed private-candidate separation, immutable daily-intel issuance uniqueness, update/ad-hoc-delete rejection, cross-actor and cross-scope rejection, positive/explicit-none shape checks, nonmember event rejection, valid and invalid beach/window session links, rejection of session IDs on non-session events, anonymous actor claim and conflicting claim rejection, bounded outbox terminal-gap derivation, mixed anonymous/authenticated dependency retention, 90-day standalone-gap cleanup, 13-month standalone session-gap cleanup, the no-argument transaction-clock purge boundary, actor erasure of authenticated and bound-anonymous standalone gaps, session-scoped erasure, and end `rollback;`.

- [ ] **Step 4: Run the static migration test**

Run: `yarn test:unit --runTestsByPath __tests__/migrations/legacy-decision-envelopes.test.ts --runInBand`

Expected: PASS. No database command has run yet.

- [ ] **Step 5: Stop at the migration approval gate**

Present the migration diff, estimated row volume, retention policy, RLS/grant model, and rollback strategy to the user. Do not run `supabase db reset`, `supabase migration up`, `supabase db push`, `psql`, or regenerate database types until the user explicitly approves applying this migration to a disposable local database.

- [ ] **Step 6: After local migration approval, apply and smoke-test locally**

Run: `supabase start && yarn db:reset:types && psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f scripts/db/legacy-decision-envelope-smoke.sql`

Expected: local reset completes, `types/database.generated.ts` contains all five tables and all seven RPCs, every smoke assertion succeeds, and the transaction rolls back.

- [ ] **Step 7: Run migration and generated-type gates**

Run: `yarn test:unit --runTestsByPath __tests__/migrations/legacy-decision-envelopes.test.ts --runInBand && yarn typecheck`

Expected: PASS and TypeScript exit code 0.

- [ ] **Step 8: If the user explicitly authorized commits, commit the approved local migration**

```bash
git add supabase/migrations/20260717171000_create_legacy_decision_envelopes.sql scripts/db/legacy-decision-envelope-smoke.sql __tests__/migrations/legacy-decision-envelopes.test.ts types/database.generated.ts
git commit -m "feat(forecast): add append-only legacy decision schema"
```

Do not apply the migration to a linked environment in this task.

### Task 4: Capture discovery’s full evaluated slate before truncation

**Files:**
- Create: `lib/recommendations/legacy-envelope/discovery-adapter.ts`
- Modify: `lib/services/discovery/surf-discovery-orchestrator.ts`
- Modify: `lib/services/discovery/recommendations-v2.ts`
- Modify: `lib/services/surf-discovery-service.ts`
- Modify: `types/personalization.ts`
- Test: `__tests__/lib/recommendations/legacy-envelope/discovery-adapter.test.ts`
- Test: `__tests__/lib/services/discovery/surf-discovery-orchestrator.test.ts`

**Interfaces:**
- Consumes: `allRecsScored`, `finalSlice`, `recommendationsV2`, discovery options, a validated `LegacyDiscoveryTraceContext` carrying the request UUID, active hero flag, preference provenance, and forecast rows already present in the orchestrator.
- Produces: `LegacySurfDiscoveryExecution`, `discoverSurfSpotsWithTrace(userId, options, traceContext)`, a distinct v1/v2 trace pair, and authority-scoped candidate IDs attached to each authority's returned recommendations.

- [ ] **Step 1: Write failing adapter and parity tests**

```ts
it("records the evaluated slate and preserves the legacy response", async () => {
  const execution = await discoverSurfSpotsWithTrace(USER_ID, OPTIONS, TRACE_CONTEXT);
  expect(stripLegacyFields(execution.response)).toEqual(
    stripLegacyFields(await discoverSurfSpots(USER_ID, OPTIONS)),
  );
  expect(execution.discoveryV1Trace.candidates.length).toBeGreaterThan(
    execution.response.recommendations.length
  );
  expect(execution.response.recommendations[0].legacyCandidateId).toBe(
    execution.discoveryV1Trace.serverSelectedCandidateId
  );
});

it("uses the transported request UUID for v1 and a derived v2 namespace", async () => {
  const execution = await discoverSurfSpotsWithTrace(USER_ID, OPTIONS, {
    ...TRACE_CONTEXT,
    requestId: REQUEST_ID,
  });
  expect(execution.discoveryV1Trace.idempotencyKey).toBe(REQUEST_ID);
  expect(execution.discoveryV2Trace.idempotencyKey).toBe(
    buildLegacyIdempotencyUuid("surf_discovery_v2", REQUEST_ID),
  );
  expect(execution.discoveryV1Trace.authorityPath).toBe("surf_discovery_v1");
  expect(execution.discoveryV2Trace.authorityPath).toBe("surf_discovery_v2");
  expect(execution.response.recommendationsV2[0].legacyCandidateId).not.toBe(
    execution.response.recommendations[0].legacyCandidateId,
  );
});

it("records whether hero reranking controlled the returned order", () => {
  const trace = buildDiscoveryLegacyTrace(FIXTURE);
  expect(trace.policyVersions.heroWindowScore).toBe("enabled");
  expect(trace.scorerVersions.similarityLayer).toBe("legacy-similarity-v1");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test:unit --runTestsByPath __tests__/lib/recommendations/legacy-envelope/discovery-adapter.test.ts __tests__/lib/services/discovery/surf-discovery-orchestrator.test.ts --runInBand`

Expected: FAIL because `discoverSurfSpotsWithTrace`, `buildDiscoveryLegacyTrace`, and `legacyCandidateId` do not exist.

- [ ] **Step 3: Add the execution/trace interface and adapter**

```ts
export interface LegacySurfDiscoveryExecution {
  response: SurfDiscoveryResponse;
  discoveryV1Trace: LegacyDecisionGenerationInput;
  discoveryV2Trace: LegacyDecisionGenerationInput;
}

export interface LegacyDiscoveryTraceContext {
  requestId: string;
  originSurface: LegacyDecisionOriginSurface;
  clientPlatform: "web" | "ios" | "android";
  generationReason: "interactive_request" | "fallback_refetch" | "background_prefetch";
  parentEnvelopeId?: string;
}

export async function discoverSurfSpotsWithTrace(
  userId: string,
  options: SurfDiscoveryOptions,
  traceContext: LegacyDiscoveryTraceContext,
): Promise<LegacySurfDiscoveryExecution>;

export async function discoverSurfSpots(
  userId: string,
  options: SurfDiscoveryOptions
): Promise<SurfDiscoveryResponse> {
  return (await discoverSurfSpotsWithTrace(userId, options, buildInternalTraceContext())).response;
}
```

Build both traces beside `allRecsScored`, `finalSlice`, and `recommendationsV2`, not in the route. The route-provided `traceContext.requestId` is the v1 idempotency key and must be passed explicitly into `buildDiscoveryLegacyTrace` and every v1 candidate-ID builder; v2 derives its own idempotency key with `buildLegacyIdempotencyUuid("surf_discovery_v2", requestId)` and passes that into a separate trace and candidate namespace. Never read a request ID from ambient state or generate it inside a candidate loop. Record both pre-hero and returned order in v1 score/policy snapshots; v2 records its own evaluated and returned slate rather than aliasing v1 candidate IDs. Sanitize all forecast/user/scope data through Task 1 helpers. Do not refactor or alter comparator, filter, slice, photo, similarity, or rerank code.

- [ ] **Step 4: Run focused discovery tests**

Run: `yarn test:unit --runTestsByPath __tests__/lib/recommendations/legacy-envelope/discovery-adapter.test.ts __tests__/lib/services/discovery/surf-discovery-orchestrator.test.ts __tests__/lib/services/discovery/surf-discovery-orchestrator-similarity-lift.test.ts __tests__/lib/services/discovery/recommendations-v2.test.ts --runInBand`

Expected: PASS, including exact legacy response parity assertions.

- [ ] **Step 5: If the user explicitly authorized commits, commit discovery trace capture**

```bash
git add lib/recommendations/legacy-envelope/discovery-adapter.ts lib/services/discovery/surf-discovery-orchestrator.ts lib/services/discovery/recommendations-v2.ts lib/services/surf-discovery-service.ts types/personalization.ts __tests__/lib/recommendations/legacy-envelope/discovery-adapter.test.ts __tests__/lib/services/discovery/surf-discovery-orchestrator.test.ts
git commit -m "feat(discovery): capture legacy evaluated slate"
```

### Task 5: Persist discovery envelopes and extend the additive API contract

**Files:**
- Modify: `app/api/surf/discover/route.ts`
- Modify: `hooks/use-surf-discovery.ts`
- Modify: `lib/services/discovery/surf-discovery-gating.ts`
- Test: `__tests__/api/surf/discover.test.ts`
- Test: `__tests__/hooks/use-surf-discovery.test.tsx`
- Test: `__tests__/lib/services/discovery/surf-discovery-gating.test.ts`

**Interfaces:**
- Consumes: `discoverSurfSpotsWithTrace`, `recordLegacyDecisionEnvelope`, a validated `X-Legacy-Decision-Request-Id` UUID header, and validated origin metadata.
- Produces: Optional response references `legacyDecision` for v1 and `recommendationsV2LegacyDecision` for v2 plus authority-scoped per-recommendation `legacyCandidateId` fields.

- [ ] **Step 1: Write failing API compatibility tests**

```ts
it("adds a persisted reference without changing legacy recommendation fields", async () => {
  process.env.LEGACY_DECISION_ENVELOPE_WRITE_ENABLED = "true";
  process.env.LEGACY_DECISION_ENVELOPE_AUTHORITIES = "surf_discovery_v1,surf_discovery_v2";
  const response = await GET(buildRequest("originSurface=web_home"));
  const body = await response.json();
  expect(body.data.legacyDecision).toMatchObject({
    envelopeVersion: 1,
    originSurface: "web_home",
    authorityPath: "surf_discovery_v1",
  });
  expect(body.data.recommendationsV2LegacyDecision).toMatchObject({
    authorityPath: "surf_discovery_v2",
  });
  expect(body.data.legacyDecision.envelopeId).not.toBe(
    body.data.recommendationsV2LegacyDecision.envelopeId,
  );
  expect(stripLegacyFields(body.data)).toEqual(LEGACY_RESPONSE_FIXTURE);
});

it("leaves the v2 reference null when only v1 is allowlisted", async () => {
  process.env.LEGACY_DECISION_ENVELOPE_WRITE_ENABLED = "true";
  process.env.LEGACY_DECISION_ENVELOPE_AUTHORITIES = "surf_discovery_v1";
  const body = await (await GET(buildRequest("originSurface=web_home"))).json();
  expect(body.data.legacyDecision?.authorityPath).toBe("surf_discovery_v1");
  expect(body.data.recommendationsV2LegacyDecision).toBeNull();
  expect(stripLegacyFields(body.data)).toEqual(LEGACY_RESPONSE_FIXTURE);
});

it("returns the unchanged response with a null reference on persistence failure", async () => {
  mockRecordEnvelope.mockResolvedValue(null);
  const body = await (await GET(buildRequest("originSurface=web_discover"))).json();
  expect(body.data.legacyDecision).toBeNull();
  expect(stripLegacyFields(body.data)).toEqual(LEGACY_RESPONSE_FIXTURE);
});
```

- [ ] **Step 2: Run route and hook tests to verify they fail**

Run: `yarn test:unit --runTestsByPath __tests__/api/surf/discover.test.ts __tests__/hooks/use-surf-discovery.test.tsx __tests__/lib/services/discovery/surf-discovery-gating.test.ts --runInBand`

Expected: FAIL because the response lacks `legacyDecision` and the hook does not send `originSurface`.

- [ ] **Step 3: Add the route and hook contract**

Extend the query schema with the Task 1 origin enum and default `unknown_legacy`. Parse `X-Legacy-Decision-Request-Id` as a UUID; for old callers that omit it, generate one UUID once at route ingress. Pass that exact value and origin/client metadata in `LegacyDiscoveryTraceContext` before either trace or any candidate ID is built. The route persists the v1 and v2 envelopes independently before entitlement response shaping and returns `legacyDecision` plus `recommendationsV2LegacyDecision`; failure of one leaves only that reference null and never substitutes the other. `surf_discovery_v2` is therefore measurable as an authority even while its dormant consumers stay disabled. The hook requires an explicit origin at every production call site and generates one request UUID per logical fetch, sends it in the header, and reuses it through HTTP/auth/internal retries. A new user action or explicit refetch receives a new UUID. Extend the locked entitlement teaser with the selected v1 `legacyCandidateId` and v1 `legacyDecision` reference so the teaser can report what it actually exposed; do not expose the hidden slate or attach the v2 reference to a v1 candidate.

```ts
export interface UseSurfDiscoveryOptions extends SurfDiscoveryOptions {
  originSurface: LegacyDecisionOriginSurface;
  generationReason?: "interactive_request" | "fallback_refetch" | "background_prefetch";
  parentEnvelopeId?: string;
}
```

Use `web_home`, `web_oracle`, `web_discover`, `native_home`, and `internal_prefetch` at the known callers. Oracle’s San Diego fallback uses `fallback_refetch` and passes the empty primary envelope as `parentEnvelopeId`.

- [ ] **Step 4: Run focused API/hook tests and typecheck**

Run: `yarn test:unit --runTestsByPath __tests__/api/surf/discover.test.ts __tests__/hooks/use-surf-discovery.test.tsx __tests__/hooks/use-oracle-data.test.ts __tests__/lib/services/discovery/surf-discovery-gating.test.ts --runInBand && yarn typecheck`

Expected: PASS; existing response assertions continue to pass after stripping additive envelope fields.

- [ ] **Step 5: If the user explicitly authorized commits, commit the additive discovery contract**

```bash
git add app/api/surf/discover/route.ts hooks/use-surf-discovery.ts hooks/use-oracle-data.ts lib/services/discovery/surf-discovery-gating.ts __tests__/api/surf/discover.test.ts __tests__/hooks/use-surf-discovery.test.tsx __tests__/hooks/use-oracle-data.test.ts __tests__/lib/services/discovery/surf-discovery-gating.test.ts
git commit -m "feat(discovery): return legacy decision references"
```

### Task 6: Add lifecycle-event validation and authenticated/signed-anonymous routes

**Files:**
- Create: `lib/recommendations/legacy-envelope/events.ts`
- Create: `app/api/recommendations/legacy-envelope/events/route.ts`
- Create: `app/api/recommendations/legacy-envelope/client-generation/route.ts`
- Create: `app/api/recommendations/legacy-envelope/visitor-token/route.ts`
- Create: `app/api/recommendations/legacy-envelope/server-generation/route.ts`
- Create: `app/api/recommendations/legacy-envelope/claim/route.ts`
- Test: `__tests__/api/legacy-decision-events.test.ts`
- Test: `__tests__/api/legacy-decision-client-generation.test.ts`
- Test: `__tests__/api/legacy-decision-visitor-token.test.ts`
- Test: `__tests__/api/legacy-decision-server-generation.test.ts`
- Test: `__tests__/api/legacy-decision-claim.test.ts`

**Interfaces:**
- Consumes: Task 1 event/generation schemas, Task 2 flags, and Task 3 RPCs.
- Produces: `appendLegacyDecisionEvent(input, actor)`, purpose-bound event and actor-claim tokens, authenticated actor-claim binding, and client-generation responses with server-assigned candidate IDs.

- [ ] **Step 1: Write failing auth, membership, and idempotency tests**

```ts
it("rejects a candidate outside the rendered-owner envelope without storing its value", async () => {
  mockRpc.mockResolvedValue({ data: [{ accepted: false, event_id: GAP_ID, divergence_kind: null, rejection_reason: "invalid_nonmember" }], error: null });
  const response = await POST(authenticatedRequest({
    ...VALID_SHOWN_EVENT,
    renderedPrimaryCandidateId: "lc_not-a-member",
    renderedCandidateIds: ["lc_not-a-member"],
  }));
  expect(response.status).toBe(422);
  expect(await response.json()).toMatchObject({ accepted: false, reason: "invalid_nonmember" });
});

it("replays the same client event idempotently", async () => {
  const first = await POST(authenticatedRequest(VALID_SHOWN_EVENT));
  const second = await POST(authenticatedRequest(VALID_SHOWN_EVENT));
  expect((await first.json()).eventId).toBe((await second.json()).eventId);
});

it("rejects a conflicting retry with the same client event ID", async () => {
  await POST(authenticatedRequest(VALID_SHOWN_EVENT));
  const response = await POST(authenticatedRequest({
    ...VALID_SHOWN_EVENT,
    renderedPrimaryCandidateId: SECOND_CANDIDATE_ID,
    renderedCandidateIds: [SECOND_CANDIDATE_ID],
  }));
  expect(response.status).toBe(409);
});

it("rejects unrelated cross-envelope ownership", async () => {
  const response = await POST(authenticatedRequest({
    ...VALID_SHOWN_EVENT,
    renderedFromEnvelopeId: OTHER_ACTOR_ENVELOPE_ID,
    mutationReasonCodes: ["cache_replay"],
  }));
  expect(response.status).toBe(422);
});

it("allows shown explicit-none but not opened without a candidate", async () => {
  expect((await POST(authenticatedRequest({
    ...VALID_SHOWN_EVENT,
    renderOutcome: "explicit_none",
    renderedPrimaryCandidateId: null,
    renderedCandidateIds: [],
  }))).status).toBe(200);
  expect((await POST(authenticatedRequest({
    ...VALID_OPEN_EVENT,
    renderOutcome: "explicit_none",
    renderedPrimaryCandidateId: null,
    renderedCandidateIds: [],
  }))).status).toBe(400);
});

it("requires a valid signed token for an anonymous event", async () => {
  expect((await POST(anonymousRequest(VALID_SHOWN_EVENT, "bad-token"))).status).toBe(401);
});

it("allows only enumerated client-reported authority paths", async () => {
  const response = await POST_CLIENT_GENERATION(authenticatedRequest({
    authorityPath: "surf_discovery_v1",
    candidates: [],
  }));
  expect(response.status).toBe(400);
});

it.each([
  "week_scout_native_fallback_v1",
  "native_beach_detail_v1",
  "surf_call_native_fallback_v1",
  "session_intelligence_spot_v1",
  "native_map_summary_v1",
  "native_plan_next_ranker_v1",
])("requires a server-minted visitor token for guest %s generation", async (authorityPath) => {
  expect((await POST_CLIENT_GENERATION(guestRequest({ authorityPath }))).status).toBe(401);
  expect((await POST_CLIENT_GENERATION(guestRequest(
    { authorityPath },
    { visitorToken: VALID_SERVER_MINTED_VISITOR_TOKEN },
  ))).status).toBe(200);
});

it("rejects a caller-chosen visitor UUID even when it is well formed", async () => {
  const response = await POST_CLIENT_GENERATION(guestRequest(
    VALID_CLIENT_GENERATION,
    { visitorId: crypto.randomUUID() },
  ));
  expect(response.status).toBe(401);
  expect(mockRecordEnvelope).not.toHaveBeenCalled();
});

it("binds an anonymous envelope only when auth, visitor cookie, and claim token agree", async () => {
  const response = await POST_CLAIM(authenticatedClaimRequest({
    envelopeId: ANONYMOUS_ENVELOPE_ID,
    actorClaimToken: VALID_ACTOR_CLAIM_TOKEN,
  }, { visitorToken: MATCHING_SIGNED_VISITOR_COOKIE }));
  expect(response.status).toBe(200);
  expect(mockRpc).toHaveBeenCalledWith("claim_legacy_decision_actor_v1", expect.anything());
});

it.each(["missing_cookie", "wrong_cookie", "expired_token", "wrong_purpose"])(
  "rejects anonymous actor claim %s without creating a binding",
  async (fixture) => {
    const response = await POST_CLAIM(buildInvalidClaimRequest(fixture));
    expect(response.status).toBe(401);
    expect(mockClaimRpc).not.toHaveBeenCalled();
  },
);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test:unit --runTestsByPath __tests__/api/legacy-decision-events.test.ts __tests__/api/legacy-decision-client-generation.test.ts __tests__/api/legacy-decision-visitor-token.test.ts __tests__/api/legacy-decision-server-generation.test.ts __tests__/api/legacy-decision-claim.test.ts --runInBand`

Expected: FAIL because the event, client-generation, visitor-token,
server-generation, and claim routes/helpers are absent.

- [ ] **Step 3: Implement event and client-generation routes**

The event route uses optional auth. Authenticated events derive `actorUserId` from auth and never trust a body user ID. Anonymous surface events require an HMAC-SHA256 token signed by `LEGACY_DECISION_EVENT_TOKEN_SECRET` with `purpose=surface_lifecycle`, fresh envelope ID, rendered-owner envelope ID, actor-session hash, authority, origin, allowed event types (`shown`,`opened`), and event-acceptance expiry; the route verifies the current signed visitor claim and derives its hash with the dedicated actor HMAC secret before persistence. This token can never authorize a message open, actor claim, or session link. Parse authority and mutation codes through the Task 1 enums before the RPC. Return 204 when event writes are disabled, 200 for accepted/idempotent events, 409 for an event-ID payload collision, 422 for membership/scope/family/expiry rejection, 401 for actor/token mismatch, and 429 for rate limits.

The client-generation route allows only
`week_scout_native_fallback_v1`, `native_beach_detail_v1`,
`surf_call_native_fallback_v1`, `session_intelligence_spot_v1`,
`native_map_summary_v1`, and `native_plan_next_ranker_v1`. Authenticated
requests derive the user from auth. Every one of those authorities is also
guest-capable, but a guest must present a valid server-minted signed visitor
token; a body/header UUID chosen by the caller is never an actor claim.

The visitor-token route is rate/bot limited and creates the random visitor
claim ID server-side. For web it sets a `Secure`, `HttpOnly`, `SameSite=Lax`
signed cookie; for a native attested request it returns a purpose-bound bearer
stored in SecureStore, never AsyncStorage. Claims include only version,
`purpose=legacy_visitor`, random claim ID, platform, issuance, expiry (at most
30 days), and key ID. Client generation verifies signature, purpose, platform,
expiry, and key ID, then derives `actorSessionHash` server-side with a separate
HMAC secret. It never persists or returns the raw claim ID. Signed-in requests
bind the authenticated user and ignore any visitor token. Token issuance,
generation, claim, and lifecycle endpoints have independent rate limits and
purpose keys.

For every guest-capable authority, successful generation returns both the
surface-lifecycle token and a separate `purpose=actor_claim` token signed by
`LEGACY_DECISION_ACTOR_CLAIM_TOKEN_SECRET`. That claim token binds one envelope
ID, actor-session hash, issuance/expiry, and a random claim UUID; it contains no
raw visitor or user ID and cannot submit an event. Missing, invalid, or expired
visitor claims return 401 and never create an envelope. The client records a
candidate-free `anonymous_claim_missing` or `offline_generation_unobservable`
gap through its durable event queue when connectivity returns. The route
accepts at most 100 sanitized candidate summaries, assigns public IDs or
envelope-scoped HMAC private IDs server-side, persists with
`generationTrust: "client_reported"`, and returns only the reference plus a
stable-key-to-candidate-ID map.

The server-generation route is a separate strict boundary for
`social_bluesky_auto_post_v1`. It accepts only a timestamped, nonce-bound,
body-hash HMAC from the allowlisted edge function, rejects replay/clock skew,
parses the same candidate schemas, and can create only
`clientPlatform="server_message"`, `originSurface="social_bluesky"`
envelopes. It does not
accept user IDs, anonymous visitor claims, or lifecycle events.

The authenticated claim route accepts only `{ envelopeId, actorClaimToken }`, reads and verifies the current signed visitor cookie/bearer server-side, derives the actor-session hash, verifies claim-token signature/purpose/envelope/hash/expiry with constant-time comparison, and calls `claim_legacy_decision_actor_v1` with the authenticated user. It is idempotent by the token's claim UUID. It runs on the auth-transition callback and again on session-link enqueue if a carried anonymous context is not yet bound. A missing, expired, or mismatched claim never falls back to ownership-by-envelope-ID: it records `coverage_gap/anonymous_claim_missing` or `actor_claim_failed`, drops that attribution context, and leaves session creation untouched. Dashboard session-link coverage excludes pre-P0-B anonymous contexts with no claim token from the eligible denominator, but includes claim-capable contexts and reports their claim failures separately.

- [ ] **Step 4: Run API tests and typecheck**

Run: `yarn test:unit --runTestsByPath __tests__/api/legacy-decision-events.test.ts __tests__/api/legacy-decision-client-generation.test.ts __tests__/api/legacy-decision-visitor-token.test.ts __tests__/api/legacy-decision-server-generation.test.ts __tests__/api/legacy-decision-claim.test.ts --runInBand && yarn typecheck`

Expected: PASS and TypeScript exit code 0.

- [ ] **Step 5: If the user explicitly authorized commits, commit lifecycle APIs**

```bash
git add lib/recommendations/legacy-envelope/events.ts app/api/recommendations/legacy-envelope/events/route.ts app/api/recommendations/legacy-envelope/client-generation/route.ts app/api/recommendations/legacy-envelope/visitor-token/route.ts app/api/recommendations/legacy-envelope/server-generation/route.ts app/api/recommendations/legacy-envelope/claim/route.ts __tests__/api/legacy-decision-events.test.ts __tests__/api/legacy-decision-client-generation.test.ts __tests__/api/legacy-decision-visitor-token.test.ts __tests__/api/legacy-decision-server-generation.test.ts __tests__/api/legacy-decision-claim.test.ts
git commit -m "feat(forecast): validate legacy decision lifecycle events"
```

### Task 7: Capture the actual web-rendered slate and opens

**Files:**
- Create: `lib/recommendations/legacy-envelope/client.ts`
- Create: `hooks/use-legacy-decision-lifecycle.ts`
- Modify: `components/home-screen/index.tsx`
- Modify: `components/oracle/oracle-home-screen.tsx`
- Modify: `components/discover/beach-discovery-list.tsx`
- Modify: `components/home-screen/hero-recommendation.tsx`
- Modify: `components/home-screen/compact-spot-card.tsx`
- Modify: `components/discover/beach-discovery-card.tsx`
- Test: `__tests__/hooks/use-legacy-decision-lifecycle.test.tsx`
- Test: `__tests__/components/home-screen/home-screen.discovery-metrics.test.tsx`
- Test: `__tests__/components/discover/beach-discovery-card.test.tsx`
- Test: `__tests__/integration/major-event-hold-legacy-envelope.test.ts`

**Interfaces:**
- Consumes: `LegacyDecisionReference`, candidate IDs, actual post-filter/reorder arrays.
- Produces: `useLegacyDecisionLifecycle({ reference, renderedFromEnvelopeId, renderedCandidates, originSurface, clientAuthorityPath, clientAuthorityVersion, mutationReasonCodes })` and `recordOpened(candidateId)`.

- [ ] **Step 1: Write failing render-order tests**

```ts
it("reports the candidate actually promoted after the home photo filter", async () => {
  render(<HomeScreen discovery={DISCOVERY_WITH_FIRST_PHOTO_MISSING} />);
  await waitFor(() => expect(fetch).toHaveBeenCalledWith(
    "/api/recommendations/legacy-envelope/events",
    expect.objectContaining({ body: expect.stringContaining(SECOND_CANDIDATE_ID) })
  ));
  const event = JSON.parse((fetch as jest.Mock).mock.calls.at(-1)[1].body);
  expect(event.renderedPrimaryCandidateId).toBe(SECOND_CANDIDATE_ID);
  expect(event.mutationReasonCodes).toContain("photo_required_filter");
});

it("does not emit shown from a background prefetch", () => {
  renderHook(() => useLegacyDecisionLifecycle(PREFETCH_INPUT));
  expect(fetch).not.toHaveBeenCalled();
});

it("records pre-hold suppression while attribution failure can never bypass P0-A", async () => {
  enableMajorEventHold();
  mockLegacyAuthority.mockResolvedValue(POSITIVE_SERVER_SLATE);
  mockRecordEnvelope.mockRejectedValue(new Error("attribution unavailable"));
  const response = await runCombinedRecommendationAdapter();
  expect(response.recommendations).toEqual([]);
  expect(response.hold).toMatchObject({ state: "held" });
  expect(response.legacyDecision).toBeNull();
});

it("classifies a held explicit-none render against the pre-hold positive envelope", async () => {
  const response = await runCombinedRecommendationAdapterWithPersistedEnvelope();
  expect(response.recommendations).toEqual([]);
  expect(response.legacyDecision).toMatchObject({ selectedCandidateId: null });
  expect(response).not.toHaveProperty("preHoldRecommendations");
  expect(JSON.stringify(response)).not.toContain(PRE_HOLD_SELECTED_CANDIDATE_ID);
  await renderAndReport(response);
  expect(mockAppendEvent).toHaveBeenCalledWith(expect.objectContaining({
    renderOutcome: "explicit_none",
    renderedCandidateIds: [],
    mutationReasonCodes: ["server_none_preserved"],
  }));
  expect(mockAppendEventResult).toMatchObject({ divergenceKind: "suppressed_server_positive" });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test:unit --runTestsByPath __tests__/hooks/use-legacy-decision-lifecycle.test.tsx __tests__/components/home-screen/home-screen.discovery-metrics.test.tsx __tests__/components/discover/beach-discovery-card.test.tsx __tests__/integration/major-event-hold-legacy-envelope.test.ts --runInBand`

Expected: FAIL because no surface-level lifecycle hook exists.

- [ ] **Step 3: Implement surface-level shown/opened events**

Create one shown event after React commits the actual ordered array. Reuse one `crypto.randomUUID()` across retry for that mount. Do not emit shown in `useSurfDiscovery`; a fetch is not a render. Keep existing `useRecommendationImpression` dual-writes unchanged. On click/log-session handlers, call `recordOpened` with the exact clicked candidate before navigation using `keepalive: true`.

Home uses `photo_required_filter`; native-only reason codes are not emitted by web. Oracle fallback renders against its fallback envelope and parent chain. Discover list emits its displayed order after included/custom rows are merged. A tracking-eligible render with no reference sends `coverage_gap/missing_envelope`, allowing the dashboard denominator to measure attribution loss. The entitlement-locked teaser preserves the selected candidate ID through `surf-discovery-gating.ts` and emits `entitlement_teaser` rather than pretending the full list rendered. When P0-A holds a pre-hold positive slate, every affected surface renders no candidate and emits the explicit-none event from the composition contract; neither the lifecycle hook nor a persistence catch block may fall back to the positive response.

- [ ] **Step 4: Run web surface tests and typecheck**

Run: `yarn test:unit --runTestsByPath __tests__/hooks/use-legacy-decision-lifecycle.test.tsx __tests__/components/home-screen/home-screen.discovery-metrics.test.tsx __tests__/components/home-screen/hero-recommendation.test.tsx __tests__/components/home-screen/compact-spot-card.test.tsx __tests__/components/discover/beach-discovery-card.test.tsx __tests__/integration/major-event-hold-legacy-envelope.test.ts --runInBand && yarn typecheck`

Expected: PASS with both legacy impression calls and new lifecycle calls asserted independently.

- [ ] **Step 5: If the user explicitly authorized commits, commit web lifecycle capture**

```bash
git add lib/recommendations/legacy-envelope/client.ts hooks/use-legacy-decision-lifecycle.ts components/home-screen/index.tsx components/oracle/oracle-home-screen.tsx components/discover/beach-discovery-list.tsx components/home-screen/hero-recommendation.tsx components/home-screen/compact-spot-card.tsx components/discover/beach-discovery-card.tsx __tests__/hooks/use-legacy-decision-lifecycle.test.tsx __tests__/components/home-screen/home-screen.discovery-metrics.test.tsx __tests__/components/discover/beach-discovery-card.test.tsx __tests__/integration/major-event-hold-legacy-envelope.test.ts
git commit -m "feat(web): capture rendered recommendation divergence"
```

### Task 8: Link web sessions without fabricating envelope data

**Files:**
- Create: `lib/recommendations/legacy-envelope/session-link-queue.ts`
- Create: `app/api/recommendations/legacy-envelope/session-link-outbox/route.ts`
- Create: `app/api/cron/legacy-decision-session-link-outbox/route.ts`
- Modify: `vercel.json`
- Modify: `lib/recommendations/attribution.ts`
- Modify: `lib/recommendations/session-context.ts`
- Modify: `app/api/recommendations/session-context/route.ts`
- Modify: `actions/session-actions.ts`
- Modify: `lib/utils/session-wizard-params.ts`
- Modify: `hooks/use-session-form.ts`
- Test: `__tests__/lib/recommendations/attribution.test.ts`
- Test: `__tests__/api/recommendation-session-context.test.ts`
- Test: `__tests__/components/session-forms/ConditionsSection.recommendation.test.tsx`
- Test: `__tests__/lib/recommendations/legacy-envelope/session-link-queue.test.ts`
- Test: `__tests__/api/legacy-decision-session-link-outbox.test.ts`
- Test: `__tests__/api/cron/legacy-decision-session-link-outbox.test.ts`

**Interfaces:**
- Consumes: envelope ID, rendered-owner envelope ID, and candidate ID from an opened recommendation.
- Produces: a bounded browser retry entry, immutable database outbox row, and eventually idempotent `session_linked` event keyed by session UUID while preserving existing recommendation context writes.

- [ ] **Step 1: Write failing session-link tests**

```ts
it("links the created session to a membership-validated candidate", async () => {
  const result = await createLoggedSession(buildSessionInput({
    legacy_decision_context: {
      envelopeId: ENVELOPE_ID,
      renderedFromEnvelopeId: ENVELOPE_ID,
      candidateId: CANDIDATE_ID,
      originSurface: "web_discover",
    },
  }));
  expect(mockRpc).toHaveBeenCalledWith("enqueue_legacy_decision_session_link_v1", expect.objectContaining({
    p_link: expect.objectContaining({
      sessionId: result.data.id,
      envelopeId: ENVELOPE_ID,
      candidateId: CANDIDATE_ID,
    }),
  }));
});

it("keeps a browser retry until the database outbox accepts the link", async () => {
  mockOutboxFetch.mockRejectedValueOnce(new Error("offline"));
  await enqueueLegacyDecisionSessionLink(VALID_SESSION_LINK);
  expect(readLegacySessionLinkQueue()).toEqual([VALID_SESSION_LINK]);
  mockOutboxFetch.mockResolvedValueOnce(okResponse());
  await flushLegacyDecisionSessionLinks();
  expect(readLegacySessionLinkQueue()).toEqual([]);
});

it("restores the browser retry after a reload from IndexedDB", async () => {
  await enqueueLegacyDecisionSessionLink(VALID_SESSION_LINK);
  jest.resetModules();
  const reloaded = await import("@/lib/recommendations/legacy-envelope/session-link-queue");
  expect(await reloaded.readLegacySessionLinkQueue()).toEqual([VALID_SESSION_LINK]);
});

it("retries an immutable database outbox row until the lifecycle event exists", async () => {
  mockAppendLifecycleRpc.mockRejectedValueOnce(new Error("temporary"));
  await runLegacyDecisionSessionLinkOutbox();
  expect(mockDeleteOutbox).not.toHaveBeenCalled();
  mockAppendLifecycleRpc.mockResolvedValueOnce(acceptedEvent());
  await runLegacyDecisionSessionLinkOutbox();
  expect(mockAppendLifecycleRpc).toHaveBeenLastCalledWith(expect.objectContaining({
    clientEventId: SESSION_ID,
    eventType: "session_linked",
  }));
});

it("backs off retryable rows and terminally expires them without a hot loop", async () => {
  mockNow("2026-07-18T12:00:00.000Z");
  await runLegacyDecisionSessionLinkOutbox();
  expect(mockAppendGap).toHaveBeenCalledWith(expect.objectContaining({
    rejectionReason: "session_link_expired",
  }));
  await runLegacyDecisionSessionLinkOutbox();
  expect(mockAppendLifecycleRpc).toHaveBeenCalledTimes(0);
});

it.each([
  ["wrong beach", SESSION_WRONG_BEACH],
  ["outside candidate window", SESSION_OUTSIDE_WINDOW],
  ["wrong private binding", SESSION_WRONG_CUSTOM_SPOT],
])("rejects session_linked for %s", async (_label, session) => {
  const response = await enqueueSessionLinkFor(session);
  expect(response).toMatchObject({ accepted: false, reason: "semantic_mismatch" });
});

it("does not derive condition, personal, and overall scores from one display score", async () => {
  await createLoggedSession(buildSessionInput({ recommendation_context: LEGACY_CONTEXT }));
  expect(mockSessionContextUpsert).not.toHaveBeenCalledWith(expect.objectContaining({
    condition_score: LEGACY_CONTEXT.score,
    personal_score: LEGACY_CONTEXT.score,
    overall_score: LEGACY_CONTEXT.score,
  }));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test:unit --runTestsByPath __tests__/lib/recommendations/attribution.test.ts __tests__/api/recommendation-session-context.test.ts __tests__/components/session-forms/ConditionsSection.recommendation.test.tsx __tests__/lib/recommendations/legacy-envelope/session-link-queue.test.ts __tests__/api/legacy-decision-session-link-outbox.test.ts __tests__/api/cron/legacy-decision-session-link-outbox.test.ts --runInBand`

Expected: FAIL because envelope fields are not carried and the current action fabricates three scores.

- [ ] **Step 3: Carry and append the envelope link**

```ts
export interface LegacyDecisionSessionContext {
  envelopeId: string;
  renderedFromEnvelopeId: string;
  candidateId: string;
  originSurface: LegacyDecisionOriginSurface;
  actorClaimToken?: string;
}
```

Carry the non-secret identifiers through URL/form state without scores or forecast snapshots. Treat `actorClaimToken` as an opaque bearer: never place it in a URL, log it, or copy it into a session/database row; carry it only in the IndexedDB context keyed by a random non-secret navigation handle. Before navigation, persist the strict context in IndexedDB database `quiver-attribution-v1`, object store `pending-navigation`; after session creation succeeds, atomically move it to object store `session-link-queue` keyed by session UUID and POST the authenticated outbox route. IndexedDB, not module memory or `sessionStorage`, is the durable queue of record; the implementation uses one read-write transaction, schema version 1, and a cross-tab `navigator.locks` flush lease (with an atomic IndexedDB lease-record fallback) plus compare-and-delete on payload hash. Remove an entry only after `enqueue_legacy_decision_session_link_v1` confirms the immutable database row. Flush on app start, online transition, visibility regain, and successful session submission; cap at 100 entries and 30 days, dropping only expired entries with a structured coverage-gap log. Tests recreate the module/database connection to prove reload persistence and concurrent flush safety.

The authenticated enqueue route loads the session and candidate itself; it never trusts client-supplied beach, window, private ID, or actor user. It enforces the Task 3 semantic beach/window rule before queueing. If the envelope is anonymous, it verifies and consumes the carried actor-claim token through the Task 6 claim route/RPC first; a failed claim becomes the explicit anonymous claim gap and the link is not accepted. This preserves anonymous-to-authenticated attribution without treating possession of an envelope UUID as ownership.

The CRON-secret-authenticated outbox route selects only due, nonterminal rows whose matching `session_linked` event is absent, applies the Task 3 deterministic backoff, appends the event using `clientEventId=sessionId`, and leaves the immutable outbox row in place. Retryable and terminal outcomes are append-only coverage-gap events, so the worker never updates retry counters. Register `/api/cron/legacy-decision-session-link-outbox` in `vercel.json` at `*/5 * * * *`; the route test must reject missing/invalid cron auth, prove an empty backlog is a successful no-op, prove a backoff row is skipped, and prove expired/exhausted rows become terminal exactly once. RPC idempotency makes retries safe. Keep the existing context upsert only with values that came from an actual recommendation context. Remove the fallback that copies one display score into all score columns. Neither an attribution failure nor outbox retry rolls back a successfully created session; the IndexedDB queue plus immutable database outbox makes the retry path concrete and testable.

- [ ] **Step 4: Run session attribution tests and typecheck**

Run: `yarn test:unit --runTestsByPath __tests__/lib/recommendations/attribution.test.ts __tests__/api/recommendation-session-context.test.ts __tests__/components/session-forms/ConditionsSection.recommendation.test.tsx __tests__/lib/recommendations/legacy-envelope/session-link-queue.test.ts __tests__/api/legacy-decision-session-link-outbox.test.ts __tests__/api/cron/legacy-decision-session-link-outbox.test.ts --runInBand && yarn typecheck`

Expected: PASS and no fabricated-score assertion remains.

- [ ] **Step 5: If the user explicitly authorized commits, commit web session linking**

```bash
git add lib/recommendations/attribution.ts lib/recommendations/session-context.ts lib/recommendations/legacy-envelope/session-link-queue.ts app/api/recommendations/session-context/route.ts app/api/recommendations/legacy-envelope/session-link-outbox/route.ts app/api/cron/legacy-decision-session-link-outbox/route.ts vercel.json actions/session-actions.ts lib/utils/session-wizard-params.ts hooks/use-session-form.ts __tests__/lib/recommendations/attribution.test.ts __tests__/api/recommendation-session-context.test.ts __tests__/components/session-forms/ConditionsSection.recommendation.test.tsx __tests__/lib/recommendations/legacy-envelope/session-link-queue.test.ts __tests__/api/legacy-decision-session-link-outbox.test.ts __tests__/api/cron/legacy-decision-session-link-outbox.test.ts
git commit -m "fix(sessions): link validated legacy recommendation context"
```

### Task 9: Instrument server Week Scout and surf-call authorities

**Files:**
- Create: `lib/recommendations/legacy-envelope/week-scout-adapter.ts`
- Create: `lib/recommendations/legacy-envelope/surf-call-adapter.ts`
- Modify: `lib/services/discovery/week-scout.ts`
- Modify: `app/api/surf/week-scout/route.ts`
- Modify: `actions/spot/spot-surf-report-actions.ts`
- Modify: `app/api/surf/call/route.ts`
- Test: `__tests__/lib/recommendations/legacy-envelope/week-scout-adapter.test.ts`
- Test: `__tests__/lib/recommendations/legacy-envelope/surf-call-adapter.test.ts`
- Test: `__tests__/app/api/surf-week-scout-route.test.ts`
- Test: `__tests__/app/api/surf-call-route.test.ts`

**Interfaces:**
- Consumes: every Week Scout draft/window before response truncation and the final surf-call/headline result.
- Produces: additive `legacyDecision` and `legacyCandidateId` fields for both APIs.

- [ ] **Step 1: Write failing authority tests**

```ts
it("envelopes every Week Scout window before the best id is selected", async () => {
  const response = await runWeekScout(FIXTURE);
  expect(mockRecordEnvelope).toHaveBeenCalledWith(expect.objectContaining({
    authorityPath: "week_scout_server_v1",
    candidates: expect.arrayContaining([
      expect.objectContaining({ candidateId: response.days[0].windows[0].legacyCandidateId }),
    ]),
  }));
});

it("marks surf call as selected-only trace coverage", () => {
  const input = buildSurfCallLegacyEnvelope(SURF_CALL_FIXTURE);
  expect(input.policyVersions.traceCoverage).toBe("selected_only");
  expect(input.candidates).toHaveLength(1);
});
```

- [ ] **Step 2: Run focused tests to verify they fail**

Run: `yarn test:unit --runTestsByPath __tests__/lib/recommendations/legacy-envelope/week-scout-adapter.test.ts __tests__/lib/recommendations/legacy-envelope/surf-call-adapter.test.ts __tests__/app/api/surf-week-scout-route.test.ts __tests__/app/api/surf-call-route.test.ts --runInBand`

Expected: FAIL because adapters and response fields are absent.

- [ ] **Step 3: Add adapters without changing authority behavior**

Week Scout records all draft windows, current `WEEK_SCOUT_SCORER_VERSION`, rerank diagnostics, best ID, and returned daily order. Surf call records the selected forecast/window, `resolveTodayHeadline` path, `computeSurfCall` verdict, tier result, preference/board provenance, and `traceCoverage: "selected_only"`; it must not claim an evaluated slate that the current resolver does not expose.

Both routes return the unchanged result plus optional references. Existing endpoint flags and cache behavior remain untouched.

- [ ] **Step 4: Run authority tests and typecheck**

Run: `yarn test:unit --runTestsByPath __tests__/lib/recommendations/legacy-envelope/week-scout-adapter.test.ts __tests__/lib/recommendations/legacy-envelope/surf-call-adapter.test.ts __tests__/lib/services/discovery/week-scout.test.ts __tests__/app/api/surf-week-scout-route.test.ts __tests__/app/api/surf-call-route.test.ts --runInBand && yarn typecheck`

Expected: PASS with legacy response parity.

- [ ] **Step 5: If the user explicitly authorized commits, commit Week Scout and surf-call adapters**

```bash
git add lib/recommendations/legacy-envelope/week-scout-adapter.ts lib/recommendations/legacy-envelope/surf-call-adapter.ts lib/services/discovery/week-scout.ts app/api/surf/week-scout/route.ts actions/spot/spot-surf-report-actions.ts app/api/surf/call/route.ts __tests__/lib/recommendations/legacy-envelope/week-scout-adapter.test.ts __tests__/lib/recommendations/legacy-envelope/surf-call-adapter.test.ts __tests__/app/api/surf-week-scout-route.test.ts __tests__/app/api/surf-call-route.test.ts
git commit -m "feat(forecast): envelope week scout and surf call"
```

### Task 10: Instrument web forecast rankings, Session Intelligence, and public regional authorities

**Files:**
- Create: `lib/recommendations/legacy-envelope/session-intelligence-adapter.ts`
- Create: `lib/recommendations/legacy-envelope/forecast-ranking-adapter.ts`
- Create: `components/intent/intent-forecast-lifecycle.tsx`
- Modify: `types/session-intelligence.ts`
- Modify: `lib/recommendations/surf-window-recommendations.ts`
- Modify: `lib/recommendations/session-intelligence-surface-adapters.ts`
- Modify: `components/home-screen/session-intelligence-module.tsx`
- Modify: `components/beach-detail/session-intelligence-pilot.tsx`
- Modify: `components/session-intelligence/best-surf-windows.tsx`
- Modify: `lib/utils/forecast-hub-utils.ts`
- Modify: `actions/forecast/get-top-beaches-now.ts`
- Modify: `components/forecast/best-right-now.tsx`
- Modify: `app/api/v1/recommendations/route.ts`
- Modify: `app/api/forecasts/bulk/route.ts`
- Modify: `app/api/forecasts/scored/[beachId]/route.ts`
- Modify: `app/api/coach-picks/route.ts`
- Modify: `actions/forecast/intent-forecast-actions.ts`
- Modify: `lib/utils/regional-forecast-utils.ts`
- Modify: `components/forecast/regional-call-hero.tsx`
- Modify: `components/forecast/seven-day-outlook.tsx`
- Modify: `components/map/map-beach-loader.ts`
- Modify: `components/map/interactive-map.tsx`
- Modify: `components/map/map-marker-builder.ts`
- Modify: `components/intent/todays-intent-plan.tsx`
- Modify: `components/city/city-map-view.tsx`
- Modify: `app/[intent]/[city]/page.tsx`
- Modify: `app/best-time-to-surf/[city]/page.tsx`
- Test: `__tests__/lib/recommendations/session-intelligence-surface-adapters.test.ts`
- Test: `__tests__/lib/recommendations/surf-window-recommendations.test.ts`
- Test: `__tests__/components/session-intelligence/best-surf-windows.test.tsx`
- Test: `__tests__/lib/utils/forecast-hub-utils.test.ts`
- Test: `__tests__/app/api/v1/recommendations/route.test.ts`
- Test: `__tests__/app/api/forecasts/bulk/route.test.ts`
- Test: `__tests__/app/api/forecasts/scored-route.test.ts`
- Test: `__tests__/app/api/coach-picks/route.test.ts`
- Test: `__tests__/actions/forecast/intent-forecast-actions.test.ts`
- Test: `__tests__/lib/utils/regional-forecast-utils.test.ts`
- Test: `__tests__/components/map/map-beach-loader-partitions.test.ts`
- Test: `__tests__/components/map/interactive-map.test.tsx`
- Test: `__tests__/components/intent/todays-intent-plan.test.tsx`
- Test: `__tests__/components/intent/intent-forecast-lifecycle.test.tsx`
- Test: `__tests__/components/city/city-map-view.test.tsx`
- Test: `__tests__/app/best-time-city-page.test.ts`

**Interfaces:**
- Consumes: surf-window candidates before `.slice`, homepage discovery identity, public top-spots sorted rows, bulk-map requested beach rows, scored forecast slots before golden-window grouping, coach-pick rows, the intent city slate before top-pick truncation, and regional copy inputs.
- Produces: candidate identity preserved through `SurfWindowRecommendation`; exhaustive server envelopes for regional/top-spots, bulk map, scored slots, coach picks, intent summaries, and regional copy; and client-reported generation for the current client-side spot pilot.

- [ ] **Step 1: Write failing identity and public-envelope tests**

```ts
it("preserves discovery candidate identity through the homepage adapter", () => {
  const [window] = buildHomepageSurfWindowRecommendations({ recommendations: [DISCOVERY_REC] });
  expect(window.legacyCandidateId).toBe(DISCOVERY_REC.legacyCandidateId);
});

it("captures candidates before regional max-item slicing", () => {
  const result = buildSurfWindowRecommendations(GROUPS, { maxRecommendations: 3 });
  expect(result.legacyTrace?.candidates.length).toBeGreaterThan(result.recommendations.length);
});

it("returns an anonymous signed reference for public top spots", async () => {
  const result = await getTopBeachesRightNow(5);
  expect(result.legacyDecision?.eventToken).toEqual(expect.any(String));
});

it.each([
  ["forecast_bulk_map_v1", runBulkMapFixture],
  ["forecast_scored_beach_v1", runScoredBeachFixture],
  ["coach_picks_v1", runCoachPicksFixture],
  ["intent_forecast_v1", runIntentForecastFixture],
  ["regional_forecast_copy_v1", runRegionalCopyFixture],
])("captures the complete pre-truncation slate for %s", async (authorityPath, runFixture) => {
  const result = await runFixture();
  expect(mockRecordEnvelope).toHaveBeenCalledWith(expect.objectContaining({
    authorityPath,
    candidates: result.expectedEvaluatedCandidates,
  }));
  expect(stripLegacyFields(result.response)).toEqual(result.legacyResponse);
});

it.each(["forecast_scored_beach_v1", "coach_picks_v1"])(
  "keeps %s generation visible but marks rendering no-current-consumer",
  (authorityPath) => {
    expect(LEGACY_DECISION_AUTHORITY_REGISTRY.find(
      (row) => row.authorityPath === authorityPath,
    )).toMatchObject({
      generationDisposition: "covered",
      renderDisposition: "accepted_gap",
      gapCode: "no_current_consumer",
    });
  },
);

it("carries bulk-map candidate identity to visible marker shown/opened events", async () => {
  mockFetch.mockResolvedValueOnce(buildBulkMapResponse(BULK_MAP_LEGACY_FIXTURE));
  render(<InteractiveMap beaches={MAP_BEACHES} disableBeachClustering />);
  await waitFor(() => expect(mockAppendEvent).toHaveBeenCalledWith(
    expect.objectContaining({
      eventType: "shown",
      clientAuthorityPath: "forecast_bulk_map_v1",
      renderedCandidateIds: VISIBLE_MARKER_CANDIDATE_IDS,
    }),
  ));
  await userEvent.click(screen.getByRole("button", { name: /ocean beach/i }));
  expect(mockAppendEvent).toHaveBeenCalledWith(expect.objectContaining({
    eventType: "opened",
    renderedPrimaryCandidateId: OCEAN_BEACH_CANDIDATE_ID,
  }));
});

it("hydrates intent identity and opens the clicked top pick", async () => {
  render(<TodaysIntentPlan summary={INTENT_SUMMARY_WITH_LEGACY_IDS} {...PROPS} />);
  await waitFor(() => expect(mockAppendEvent).toHaveBeenCalledWith(
    expect.objectContaining({ eventType: "shown", clientAuthorityPath: "intent_forecast_v1" }),
  ));
  await userEvent.click(screen.getByRole("link", { name: /top pick beach/i }));
  expect(mockAppendEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "opened" }));
});

it("opens an intent top pick clicked from the city map list", async () => {
  render(<CityMapView forecastTopPicks={INTENT_SUMMARY_WITH_LEGACY_IDS.topPicks} {...CITY_PROPS} />);
  await userEvent.click(screen.getByRole("link", { name: /top pick beach/i }));
  expect(mockAppendEvent).toHaveBeenCalledWith(expect.objectContaining({
    eventType: "opened",
    clientAuthorityPath: "intent_forecast_v1",
    renderedPrimaryCandidateId: TOP_PICK_CANDIDATE_ID,
  }));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test:unit --runTestsByPath __tests__/lib/recommendations/session-intelligence-surface-adapters.test.ts __tests__/lib/recommendations/surf-window-recommendations.test.ts __tests__/components/session-intelligence/best-surf-windows.test.tsx __tests__/lib/utils/forecast-hub-utils.test.ts __tests__/app/api/forecasts/bulk/route.test.ts __tests__/app/api/forecasts/scored-route.test.ts __tests__/app/api/coach-picks/route.test.ts __tests__/actions/forecast/intent-forecast-actions.test.ts __tests__/lib/utils/regional-forecast-utils.test.ts __tests__/components/map/map-beach-loader-partitions.test.ts __tests__/components/map/interactive-map.test.tsx __tests__/components/intent/todays-intent-plan.test.tsx __tests__/components/intent/intent-forecast-lifecycle.test.tsx __tests__/components/city/city-map-view.test.tsx __tests__/app/best-time-city-page.test.ts --runInBand`

Expected: FAIL because surf-window types and public results lack envelope identity.

- [ ] **Step 3: Add identity and lifecycle adapters**

Add optional `legacyCandidateId` and `legacyDecision` fields only. Homepage mapping copies the discovery identity and does not assign a new one. The regional builder returns its unsliced candidate trace so `getRegionalSummary` can persist server-side after cached forecast computation. Public references contain an event token but no actor or internal context. The current spot pilot posts its already-computed sanitized slate to the client-generation endpoint before emitting shown.

`forecast-ranking-adapter.ts` receives already-computed legacy outputs and must
not call a scorer. Bulk/map records one `ranked_beach` candidate for each
requested beach's selected current row before response shaping, preserving the
existing requested/order semantics and visible subset. The scored-beach route
records all returned `forecast_slot` candidates before golden-window grouping;
it sets a selected candidate only when the existing response already identifies
one. Coach Picks records the entire RPC result in returned order. Intent
forecast records every evaluated city result before the existing confidence
sort/top limit and maps its existing best window to the selected candidate.
Regional copy records the actual evaluated top-spot/window slate before hero or
seven-day presentation truncation. Every response/action adds only the opaque
reference and candidate IDs; parity tests strip those fields and compare the
complete old result.

For the live bulk-map path, `map-beach-loader.ts` parses each batch's strict
reference/candidate map and returns ownership beside the existing maps;
`map-marker-builder.ts` carries only the opaque candidate ID; and
`interactive-map.tsx` emits one deduped `shown` event after the current visible
marker set is committed plus `opened` on the actual marker/callout click.
Timeline-only extension fetches are `internal_prefetch` and do not create
render events. For intent, both server pages preserve the additive summary
identity. `TodaysIntentPlan` emits shown for its rendered best window/top-pick
list and opened for the clicked pick. The prose-only best-time page mounts
`IntentForecastLifecycle` so hydration—not SSR, metadata generation, or bot
fetch—records shown. `CityMapView` receives the same opaque candidate IDs and
routes its live-conditions table/map-list top-pick links through the shared
opened emitter, so that second intent presentation cannot bypass lifecycle
coverage. Scored-forecast and Coach Picks have no current repo
consumer; they retain covered generation on any direct request but registry
render disposition `accepted_gap/no_current_consumer`. No synthetic shown/open
event is emitted until a real consumer is inventoried and assigned.

Preserve the existing `getTopBeachesRightNow` wrapper and its `Promise<TopBeachEntry[]>` return. Add `getTopBeachesRightNowWithTrace` with the same parameters and a `Promise<{ items: TopBeachEntry[]; legacyDecision: LegacyDecisionReference | null }>` return for `get-top-beaches-now.ts` and `BestRightNow`. Add the same optional envelope/candidate fields to the legacy public recommendation API without changing its score, sort, top-three limit, or public authentication behavior.

`BestSurfWindows` continues its existing `surf_window_impression` dual-write and adds the new surface-level lifecycle event. Do not modify `confidenceLevel`, `SourceConfidenceBadge`, `WhyThisCall`, or any confidence copy in this task.

- [ ] **Step 4: Run Session Intelligence tests and typecheck**

Run: `yarn test:unit --runTestsByPath __tests__/lib/recommendations/session-intelligence-surface-adapters.test.ts __tests__/lib/recommendations/surf-window-recommendations.test.ts __tests__/components/session-intelligence/best-surf-windows.test.tsx __tests__/components/home-screen/session-intelligence-module.test.tsx __tests__/components/beach-detail/session-intelligence-pilot.test.tsx __tests__/lib/utils/forecast-hub-utils.test.ts __tests__/app/api/v1/recommendations/route.test.ts __tests__/app/api/forecasts/bulk/route.test.ts __tests__/app/api/forecasts/scored-route.test.ts __tests__/app/api/coach-picks/route.test.ts __tests__/actions/forecast/intent-forecast-actions.test.ts __tests__/lib/utils/regional-forecast-utils.test.ts __tests__/components/map/map-beach-loader-partitions.test.ts __tests__/components/map/interactive-map.test.tsx __tests__/components/intent/todays-intent-plan.test.tsx __tests__/components/intent/intent-forecast-lifecycle.test.tsx __tests__/components/city/city-map-view.test.tsx __tests__/app/best-time-city-page.test.ts --runInBand && yarn typecheck`

Expected: PASS with unchanged ordering, score, verdict, and confidence assertions.

- [ ] **Step 5: If the user explicitly authorized commits, commit Session Intelligence coverage**

```bash
git add lib/recommendations/legacy-envelope/session-intelligence-adapter.ts lib/recommendations/legacy-envelope/forecast-ranking-adapter.ts components/intent/intent-forecast-lifecycle.tsx types/session-intelligence.ts lib/recommendations/surf-window-recommendations.ts lib/recommendations/session-intelligence-surface-adapters.ts components/home-screen/session-intelligence-module.tsx components/beach-detail/session-intelligence-pilot.tsx components/session-intelligence/best-surf-windows.tsx lib/utils/forecast-hub-utils.ts actions/forecast/get-top-beaches-now.ts components/forecast/best-right-now.tsx app/api/v1/recommendations/route.ts app/api/forecasts/bulk/route.ts 'app/api/forecasts/scored/[beachId]/route.ts' app/api/coach-picks/route.ts actions/forecast/intent-forecast-actions.ts lib/utils/regional-forecast-utils.ts components/forecast/regional-call-hero.tsx components/forecast/seven-day-outlook.tsx components/map/map-beach-loader.ts components/map/interactive-map.tsx components/map/map-marker-builder.ts components/intent/todays-intent-plan.tsx components/city/city-map-view.tsx 'app/[intent]/[city]/page.tsx' 'app/best-time-to-surf/[city]/page.tsx' __tests__/lib/recommendations/session-intelligence-surface-adapters.test.ts __tests__/lib/recommendations/surf-window-recommendations.test.ts __tests__/components/session-intelligence/best-surf-windows.test.tsx __tests__/lib/utils/forecast-hub-utils.test.ts __tests__/app/api/v1/recommendations/route.test.ts __tests__/app/api/forecasts/bulk/route.test.ts __tests__/app/api/forecasts/scored-route.test.ts __tests__/app/api/coach-picks/route.test.ts __tests__/actions/forecast/intent-forecast-actions.test.ts __tests__/lib/utils/regional-forecast-utils.test.ts __tests__/components/map/map-beach-loader-partitions.test.ts __tests__/components/map/interactive-map.test.tsx __tests__/components/intent/todays-intent-plan.test.tsx __tests__/components/intent/intent-forecast-lifecycle.test.tsx __tests__/components/city/city-map-view.test.tsx __tests__/app/best-time-city-page.test.ts
git commit -m "feat(forecast): attribute legacy forecast ranking authorities"
```

### Task 11: Add native contracts and a bounded lifecycle retry queue

**Files:**
- Create: `/Users/stevenchandler/Desktop/dev/quiver-native/src/lib/legacy-decision-envelope.ts`
- Create: `/Users/stevenchandler/Desktop/dev/quiver-native/src/lib/legacy-decision-event-queue.ts`
- Create: `/Users/stevenchandler/Desktop/dev/quiver-native/src/hooks/use-legacy-decision-lifecycle.ts`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver-native/src/types/discovery.ts`
- Test: `/Users/stevenchandler/Desktop/dev/quiver-native/src/__tests__/legacy-decision-envelope.test.ts`
- Test: `/Users/stevenchandler/Desktop/dev/quiver-native/src/__tests__/legacy-decision-event-queue.test.ts`

**Interfaces:**
- Consumes: additive Quiver `legacyDecision` and `legacyCandidateId` JSON.
- Produces: native `LegacyDecisionReference`, `enqueueLegacyDecisionEvent`, `flushLegacyDecisionEvents`, and `useLegacyDecisionLifecycle`.

- [ ] **Step 1: Write failing native parser and queue tests**

```ts
it("parses additive discovery envelope fields while accepting old responses", () => {
  expect(parseLegacyDecisionReference(NEW_RESPONSE.legacyDecision)).toEqual(NEW_RESPONSE.legacyDecision);
  expect(parseLegacyDecisionReference(undefined)).toBeNull();
});

it("reuses a client event id and caps the queue at 100 events", async () => {
  for (let index = 0; index < 101; index += 1) {
    await enqueueLegacyDecisionEvent(buildEvent(String(index)));
  }
  const queue = await readLegacyDecisionEventQueue();
  expect(queue).toHaveLength(100);
  expect(new Set(queue.map((event) => event.clientEventId)).size).toBe(100);
});

it("removes accepted and disabled events but retains network failures", async () => {
  mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
  mockFetch.mockRejectedValueOnce(new Error("offline"));
  await flushLegacyDecisionEvents();
  expect(await readLegacyDecisionEventQueue()).toHaveLength(1);
});

it("mirrors every v1 mutation reason and rejects an unknown reason", () => {
  expect(NATIVE_LEGACY_MUTATION_REASONS).toEqual([
    "photo_required_filter", "entitlement_teaser", "client_filter",
    "client_reorder", "cache_replay", "stability_retained",
    "fallback_refetch", "server_none_preserved", "region_filter",
    "beginner_filter", "longboard_filter", "quiet_filter",
    "excluded_beach_filter", "local_home_rank", "local_map_summary",
    "plan_next_merge", "plan_next_rank",
  ]);
  expect(() => parseLegacyMutationReasons(["new_unreviewed_reason"])).toThrow();
});
```

- [ ] **Step 2: Run native tests to verify they fail**

Run: `cd /Users/stevenchandler/Desktop/dev/quiver-native && npm test -- --runInBand src/__tests__/legacy-decision-envelope.test.ts src/__tests__/legacy-decision-event-queue.test.ts`

Expected: FAIL because native envelope modules do not exist.

- [ ] **Step 3: Implement native contracts and queue**

Use the same property names as the web contract and mirror the complete Task 1 mutation tuple as `NATIVE_LEGACY_MUTATION_REASONS`; all native ranking/filter modules import that type rather than widening to `string[]`. The native contract test above and the Quiver contract fixture both pin the ordered tuple, so adding a reason requires a v2 contract change or coordinated web/SQL/native update. Store queue version 1 under `legacy_decision_event_queue_v1`, retain at most 100 candidate-free/event-reference records for at most 7 days, flush oldest-first, and use the existing authenticated API client. The server-minted guest visitor bearer lives separately in SecureStore. If an offline gap was queued before a bearer existed, the flusher first obtains a new server-minted bearer and then submits only the candidate-free gap; it never reconstructs or uploads the local candidate slate. HTTP 200/204 removes an event; 401/422 removes it and records a safe telemetry reason; 429 and network/5xx retain it with capped attempt count 10. Never store forecast/user snapshots in AsyncStorage.

- [ ] **Step 4: Run native tests, lint, and typecheck**

Run: `cd /Users/stevenchandler/Desktop/dev/quiver-native && npm test -- --runInBand src/__tests__/legacy-decision-envelope.test.ts src/__tests__/legacy-decision-event-queue.test.ts && npm run lint && npm run typecheck`

Expected: PASS with lint and TypeScript exit code 0.

- [ ] **Step 5: If the user explicitly authorized commits, commit native infrastructure in the native repository**

```bash
cd /Users/stevenchandler/Desktop/dev/quiver-native
git add src/lib/legacy-decision-envelope.ts src/lib/legacy-decision-event-queue.ts src/hooks/use-legacy-decision-lifecycle.ts src/types/discovery.ts src/__tests__/legacy-decision-envelope.test.ts src/__tests__/legacy-decision-event-queue.test.ts
git commit -m "feat(native): add legacy decision lifecycle queue"
```

### Task 12: Capture native home/beach rendering and durable session links

**Files:**
- Modify: `/Users/stevenchandler/Desktop/dev/quiver-native/src/hooks/use-surf-discovery.ts`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver-native/src/hooks/use-surf-call.ts`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver-native/src/screens/home.tsx`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver-native/src/lib/home/my-surf-list-ranking.ts`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver-native/src/hooks/use-map-beaches.ts`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver-native/src/components/explore-map/surf-spot-map-summary.ts`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver-native/src/hooks/use-plan-my-next-session-recommendations.ts`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver-native/src/lib/plan-my-next-session/rank-recommendations.ts`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver-native/src/types/plan-my-next-session.ts`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver-native/src/screens/beach-detail.tsx`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver-native/src/lib/plan-my-next-session/beach-detail-best-window.ts`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver-native/src/lib/recommendation-context.ts`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver-native/src/lib/session-form-state.ts`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver-native/src/lib/session-form-utils.ts`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver-native/src/lib/pending-sessions-store.ts`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver-native/src/lib/pending-sessions-flush.ts`
- Test: `/Users/stevenchandler/Desktop/dev/quiver-native/src/__tests__/best-surf-calls-ranking.test.ts`
- Test: `/Users/stevenchandler/Desktop/dev/quiver-native/src/__tests__/recommendation-context.test.ts`
- Test: `/Users/stevenchandler/Desktop/dev/quiver-native/src/__tests__/pending-sessions-flush.test.ts`
- Test: `/Users/stevenchandler/Desktop/dev/quiver-native/src/__tests__/home-screen.test.tsx`
- Test: `/Users/stevenchandler/Desktop/dev/quiver-native/src/__tests__/use-surf-call-hook.test.ts`
- Test: `/Users/stevenchandler/Desktop/dev/quiver-native/src/__tests__/surf-spot-map-summary.test.ts`
- Test: `/Users/stevenchandler/Desktop/dev/quiver-native/src/__tests__/plan-my-next-session-ranking.test.ts`

**Interfaces:**
- Consumes: discovery and bulk-map envelope/candidate IDs, locally merged Plan My Next candidates, and the client-generation endpoint.
- Produces: native home/map/beach/Plan My Next shown/opened events with actual local order, explicit offline-generation gaps, and session-linked events surviving offline session creation.

- [ ] **Step 1: Write failing native divergence/session tests**

```ts
it("reports the locally selected home primary and mutation reasons", async () => {
  render(<HomeScreen fixture={SERVER_WINNER_EXCLUDED_FIXTURE} />);
  await waitFor(() => expect(enqueueLegacyDecisionEvent).toHaveBeenCalledWith(expect.objectContaining({
    eventType: "shown",
    renderedPrimaryCandidateId: LOCAL_WINNER_ID,
    clientAuthorityPath: "native_home_ranker_v1",
    mutationReasonCodes: expect.arrayContaining(["excluded_beach_filter", "local_home_rank"]),
  })));
});

it("queues a session link with the session uuid as idempotency key", async () => {
  await flushPendingSession(PENDING_WITH_LEGACY_CONTEXT);
  expect(enqueueLegacyDecisionEvent).toHaveBeenCalledWith(expect.objectContaining({
    eventType: "session_linked",
    clientEventId: SAVED_SESSION_ID,
    sessionId: SAVED_SESSION_ID,
  }));
});

it.each([
  ["surf_call_native_fallback_v1", renderOfflineSurfCall],
  ["native_map_summary_v1", renderOfflineMap],
  ["native_plan_next_ranker_v1", renderOfflinePlanNext],
])("records an explicit measured gap instead of calling client generation offline for %s", async (
  authorityPath,
  renderOffline,
) => {
  await renderOffline();
  expect(mockClientGeneration).not.toHaveBeenCalled();
  expect(enqueueLegacyDecisionEvent).toHaveBeenCalledWith(expect.objectContaining({
    eventType: "coverage_gap",
    envelopeId: null,
    clientAuthorityPath: authorityPath,
    rejectionReason: "offline_generation_unobservable",
  }));
});
```

- [ ] **Step 2: Run native tests to verify they fail**

Run: `cd /Users/stevenchandler/Desktop/dev/quiver-native && npm test -- --runInBand src/__tests__/best-surf-calls-ranking.test.ts src/__tests__/home-screen.test.tsx src/__tests__/recommendation-context.test.ts src/__tests__/pending-sessions-flush.test.ts src/__tests__/surf-spot-map-summary.test.ts src/__tests__/plan-my-next-session-ranking.test.ts`

Expected: FAIL because local rank output and pending session context do not carry envelope identity.

- [ ] **Step 3: Carry native identity through ranking, navigation, and outbox**

Add a ranking result containing ordered candidates plus stable reason codes; do not change the comparator. Native home emits shown after exclusions/drive tags/local ranking, and opens the clicked candidate. Beach detail requests a client-reported envelope for its locally built candidate. Native map submits the full locally evaluated marker set as `native_map_summary_v1` before visible-viewport filtering and emits shown for only visible markers with `local_map_summary`. Plan My Next submits its merged/deduped pre-limit slate as `native_plan_next_ranker_v1`, records the unchanged ranked order, and emits `plan_next_merge`/`plan_next_rank` for the actual rendered list. Extend recommendation/session context only with:

```ts
export interface NativeLegacyDecisionContext {
  envelopeId: string;
  renderedFromEnvelopeId: string;
  candidateId: string;
  originSurface: "native_home" | "native_beach_detail" | "native_week_scout";
}
```

Persist that object in the existing pending-session outbox. After a pending session receives its server UUID, enqueue `session_linked`; retrying uses the same UUID. Home quick-log navigation must include context instead of dropping it. When a locally computed Surf Call, map summary, or Plan My Next slate is online, request its distinct client-reported envelope and never reuse a server authority's candidate IDs. When connectivity is absent—or client generation fails before rendering—preserve the current product result, enqueue one candidate-free `coverage_gap/offline_generation_unobservable` record with a stable client event ID, and do not synchronously call a network endpoint or fabricate an envelope/candidate ID. The reconnect flusher in Task 11 submits that gap. Offline results cannot be linked to a later session envelope; the dashboard counts them in a separate offline-generation denominator. A development override with working connectivity may use client generation; an actually offline override follows the same gap path.

- [ ] **Step 4: Run native focused tests and gates**

Run: `cd /Users/stevenchandler/Desktop/dev/quiver-native && npm test -- --runInBand src/__tests__/best-surf-calls-ranking.test.ts src/__tests__/home-screen.test.tsx src/__tests__/recommendation-context.test.ts src/__tests__/pending-sessions-flush.test.ts src/__tests__/session-form-state.test.ts src/__tests__/session-form-utils.test.ts src/__tests__/use-surf-call-hook.test.ts src/__tests__/surf-spot-map-summary.test.ts src/__tests__/plan-my-next-session-ranking.test.ts && npm run typecheck`

Expected: PASS; ranking fixture order is unchanged and offline retry retains attribution.

- [ ] **Step 5: If the user explicitly authorized commits, commit native home/beach/session coverage**

```bash
cd /Users/stevenchandler/Desktop/dev/quiver-native
git add src/hooks/use-surf-discovery.ts src/hooks/use-surf-call.ts src/screens/home.tsx src/lib/home/my-surf-list-ranking.ts src/hooks/use-map-beaches.ts src/components/explore-map/surf-spot-map-summary.ts src/hooks/use-plan-my-next-session-recommendations.ts src/lib/plan-my-next-session/rank-recommendations.ts src/types/plan-my-next-session.ts src/screens/beach-detail.tsx src/lib/plan-my-next-session/beach-detail-best-window.ts src/lib/recommendation-context.ts src/lib/session-form-state.ts src/lib/session-form-utils.ts src/lib/pending-sessions-store.ts src/lib/pending-sessions-flush.ts src/__tests__/best-surf-calls-ranking.test.ts src/__tests__/home-screen.test.tsx src/__tests__/recommendation-context.test.ts src/__tests__/pending-sessions-flush.test.ts src/__tests__/use-surf-call-hook.test.ts src/__tests__/surf-spot-map-summary.test.ts src/__tests__/plan-my-next-session-ranking.test.ts
git commit -m "feat(native): attribute rendered and logged recommendations"
```

### Task 13: Capture native Week Scout fallback, filters, cache, and stability retention

**Files:**
- Modify: `/Users/stevenchandler/Desktop/dev/quiver-native/src/hooks/use-week-scout.ts`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver-native/src/screens/week-scout.tsx`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver-native/src/lib/week-scout/canonical-week-scout.ts`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver-native/src/lib/week-scout/stability.ts`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver-native/src/lib/week-scout/stability-store.ts`
- Modify: `/Users/stevenchandler/Desktop/dev/quiver-native/src/lib/week-scout/types.ts`
- Test: `/Users/stevenchandler/Desktop/dev/quiver-native/src/__tests__/use-week-scout.test.tsx`
- Test: `/Users/stevenchandler/Desktop/dev/quiver-native/src/__tests__/week-scout-screen.test.tsx`
- Test: `/Users/stevenchandler/Desktop/dev/quiver-native/src/lib/week-scout/__tests__/stability.test.ts`
- Test: `/Users/stevenchandler/Desktop/dev/quiver-native/src/lib/week-scout/__tests__/stability-store.test.ts`

**Interfaces:**
- Consumes: server Week Scout reference, client-generation endpoint, and native lifecycle queue.
- Produces: stability record version 2 with candidate owner envelope and fresh comparison envelope.

- [ ] **Step 1: Write failing retained-incumbent tests**

```ts
it("attributes a retained incumbent to its owner and compares it with the fresh envelope", () => {
  const result = applyWeekScoutStability(FRESH_RESULT, STORED_INCUMBENT);
  expect(result.displayed.legacyCandidateId).toBe(STORED_INCUMBENT.candidateId);
  expect(result.renderedFromEnvelopeId).toBe(STORED_INCUMBENT.envelopeId);
  expect(result.comparisonEnvelopeId).toBe(FRESH_RESULT.legacyDecision.envelopeId);
  expect(result.mutationReasonCodes).toContain("stability_retained");
});

it("migrates a version-one stability record without inventing attribution", () => {
  expect(readStabilityRecord(V1_RECORD)).toMatchObject({ version: 2, legacyDecision: null });
});
```

- [ ] **Step 2: Run native Week Scout tests to verify they fail**

Run: `cd /Users/stevenchandler/Desktop/dev/quiver-native && npm test -- --runInBand src/__tests__/use-week-scout.test.tsx src/__tests__/week-scout-screen.test.tsx src/lib/week-scout/__tests__/stability.test.ts src/lib/week-scout/__tests__/stability-store.test.ts`

Expected: FAIL because stability records contain no envelope/candidate ownership.

- [ ] **Step 3: Add fallback generation and owner-aware stability**

Server responses retain server candidate IDs. On a 404 local fallback with
connectivity, post the local evaluated slate to `client-generation` before
rendering. If that request cannot run or fails, render unchanged and enqueue
the same candidate-free `offline_generation_unobservable` gap defined in Task
12; never fabricate identity. Persist envelope/candidate reference in
stability v2 only after successful generation. A retained incumbent emits
shown against its original owner envelope and includes the fresh envelope for
divergence comparison. If a v1 cache record lacks identity, render unchanged
and emit a safe coverage-gap event; never attach it to a fresh candidate by
beach/time guesswork. Client filters emit reason codes `region_filter`,
`beginner_filter`, `longboard_filter`, `quiet_filter`, and
`excluded_beach_filter`.

- [ ] **Step 4: Run Week Scout tests and native gates**

Run: `cd /Users/stevenchandler/Desktop/dev/quiver-native && npm test -- --runInBand src/__tests__/use-week-scout.test.tsx src/__tests__/week-scout-screen.test.tsx src/lib/week-scout/__tests__/canonical-week-scout.test.ts src/lib/week-scout/__tests__/stability.test.ts src/lib/week-scout/__tests__/stability-store.test.ts && npm run typecheck`

Expected: PASS with unchanged winner/stability decisions and new ownership assertions.

- [ ] **Step 5: If the user explicitly authorized commits, commit native Week Scout coverage**

```bash
cd /Users/stevenchandler/Desktop/dev/quiver-native
git add src/hooks/use-week-scout.ts src/screens/week-scout.tsx src/lib/week-scout/canonical-week-scout.ts src/lib/week-scout/stability.ts src/lib/week-scout/stability-store.ts src/lib/week-scout/types.ts src/__tests__/use-week-scout.test.tsx src/__tests__/week-scout-screen.test.tsx src/lib/week-scout/__tests__/stability.test.ts src/lib/week-scout/__tests__/stability-store.test.ts
git commit -m "feat(native): attribute week scout stability overrides"
```

### Task 14: Envelope active message authorities without claiming unobservable impressions

**Files:**
- Create: `lib/recommendations/legacy-envelope/message-adapter.ts`
- Create: `lib/recommendations/legacy-envelope/outbound-presentation-adapter.ts`
- Create: `lib/recommendations/legacy-envelope/message-open.ts`
- Modify: `components/providers.tsx`
- Modify: `lib/services/intel-generation-service.ts`
- Modify: `app/api/cron/home-morning-call/route.ts`
- Modify: `app/api/cron/weekend-window/route.ts`
- Modify: `app/api/cron/conditions-alert-email/route.ts`
- Modify: `app/api/cron/similarity-alerts/route.ts`
- Modify: `app/api/cron/condition-alert-evaluate/route.ts`
- Modify: `app/api/cron/first-session-nudge/route.ts`
- Modify: `app/api/cron/first-session-nudge-push/route.ts`
- Modify: `app/api/cron/weekly-recap-email/route.ts`
- Modify: `app/api/cron/reengagement-email/route.ts`
- Modify: `app/api/cron/swell-watch/route.ts`
- Modify: `app/api/cron/condition-alert-deliver/route.ts`
- Modify: `app/api/og/surf-call/route.tsx`
- Modify: `app/api/og/weekend-wave-check/route.tsx`
- Modify: `supabase/functions/bluesky-auto-post/index.ts`
- Test: `__tests__/lib/recommendations/legacy-envelope/message-adapter.test.ts`
- Test: `__tests__/lib/recommendations/legacy-envelope/message-open.test.ts`
- Test: `__tests__/app/api/cron/first-session-nudge-push.test.ts`
- Test: `__tests__/app/api/cron/weekly-recap-email.test.ts`
- Test: `__tests__/app/api/og/legacy-decision-attribution.test.tsx`
- Test: `__tests__/api/legacy-decision-bluesky-generation.test.ts`
- Create native: `/Users/stevenchandler/Desktop/dev/quiver-native/src/lib/legacy-decision-message-open.ts`
- Modify native: `/Users/stevenchandler/Desktop/dev/quiver-native/src/lib/push-notifications.ts`
- Modify native: `/Users/stevenchandler/Desktop/dev/quiver-native/src/lib/deeplink/handle-inbound-url.ts`
- Test native: `/Users/stevenchandler/Desktop/dev/quiver-native/src/__tests__/push-tap-routing.test.ts`
- Test native: `/Users/stevenchandler/Desktop/dev/quiver-native/src/lib/deeplink/handle-inbound-url.test.ts`
- Test: Existing cron tests listed below.

**Interfaces:**
- Consumes: each route’s evaluated candidates, selected message/share/social payload, delivery or render dedupe key, and user context provenance.
- Produces: `recordLegacyMessageDecision(input)`, `recordLegacyOutboundPresentationDecision(input)`, and envelope/candidate identifiers in notification payloads, signed CTA URLs, OG responses, and the Bluesky signed internal call.

- [ ] **Step 1: Write failing common-adapter and route tests**

```ts
it("maps the delivery dedupe key to a stable authority-scoped UUID", async () => {
  const reference = await recordLegacyMessageDecision({
    authorityPath: "message_weekend_window_v1",
    originSurface: "push_weekend_window",
    deliveryDedupeKey: "weekend_window:user-1:2026-07-18",
    userId: USER_ID,
    candidates: WEEKEND_CANDIDATES,
    selectedStableKey: WEEKEND_CANDIDATES[0].stableKey,
  });
  expect(mockRecordEnvelope).toHaveBeenCalledWith(expect.objectContaining({
    idempotencyKey: buildLegacyIdempotencyUuid(
      "message_weekend_window_v1",
      "weekend_window:user-1:2026-07-18",
    ),
    generationReason: "scheduled_message",
    serverSelectedCandidateId: reference.selectedCandidateId,
  }));
});

it("records a signed web CTA open once and removes attribution params", async () => {
  render(<ProvidersHarness url={SIGNED_MESSAGE_URL} />);
  await waitFor(() => expect(mockAppendEvent).toHaveBeenCalledWith(
    expect.objectContaining({ eventType: "opened" }),
  );
  expect(window.history.replaceState).toHaveBeenCalledWith(
    expect.anything(),
    "",
    URL_WITHOUT_LEGACY_ATTRIBUTION_PARAMS,
  );
});

it("uses a purpose-limited message-open bearer, not a surface event token", async () => {
  const claims = verifyLegacyMessageOpenToken(SIGNED_MESSAGE_OPEN_TOKEN);
  expect(claims).toMatchObject({
    purpose: "message_open",
    allowedEventType: "opened",
    candidateId: MESSAGE_CANDIDATE_ID,
  });
  expect(() => verifyLegacyDecisionEventToken(SIGNED_MESSAGE_OPEN_TOKEN)).toThrow();
  expect(() => verifyLegacyMessageOpenToken(SIGNED_SURFACE_EVENT_TOKEN)).toThrow();
});

it("stores one immutable envelope mapping for the exact daily-intel issuance", async () => {
  await generateAndSaveDailyIntel(DAILY_INTEL_FIXTURE);
  expect(mockRecordEnvelope).toHaveBeenCalledWith(expect.objectContaining({
    authorityPath: "daily_intel_v2",
    sourceIssuance: expect.objectContaining({
      kind: "beach_daily_intel",
      issuanceId: expect.any(String),
      sourceRecordId: DAILY_INTEL_ROW_ID,
      sourceRevisionAt: DAILY_INTEL_GENERATED_AT,
      sourceRevisionHash: DAILY_INTEL_REVISION_HASH,
    }),
  }));
});

it.each([
  ["first-session-nudge push", "message_first_session_nudge_push_v1"],
  ["weekly recap email", "message_weekly_recap_v1"],
])("envelopes the selected candidate for %s", async (fixture, authorityPath) => {
  await runMessageFixture(fixture);
  const input = mockRecordEnvelope.mock.calls.at(-1)?.[0];
  expect(input).toEqual(expect.objectContaining({
    authorityPath,
    serverSelectedCandidateId: expect.any(String),
  }));
  expect(input.candidates.length).toBeGreaterThan(0);
});

it("does not record a shown event when a provider accepts a message", async () => {
  await runWeekendWindowCron();
  expect(mockAppendEvent).not.toHaveBeenCalledWith(expect.objectContaining({ eventType: "shown" }));
});

it.each([
  ["og_surf_call_v1", runSurfCallOgFixture],
  ["og_weekend_wave_check_v1", runWeekendOgFixture],
  ["social_bluesky_auto_post_v1", runBlueskyFixture],
])("captures %s generation but records display as explicitly unobservable", async (
  authorityPath,
  runFixture,
) => {
  await runFixture();
  expect(mockRecordEnvelope).toHaveBeenCalledWith(expect.objectContaining({ authorityPath }));
  expect(mockAppendGap).toHaveBeenCalledWith(expect.objectContaining({
    rejectionReason: "public_share_shown_unobservable",
  }));
  expect(mockAppendEvent).not.toHaveBeenCalledWith(
    expect.objectContaining({ eventType: "shown" }),
  );
});
```

- [ ] **Step 2: Run focused tests to verify they fail**

Run: `yarn test:unit --runTestsByPath __tests__/lib/recommendations/legacy-envelope/message-adapter.test.ts __tests__/lib/recommendations/legacy-envelope/message-open.test.ts __tests__/api/cron/home-morning-call.test.ts __tests__/api/cron/weekend-window.test.ts __tests__/app/api/cron/conditions-alert-email.test.ts __tests__/api/cron/similarity-alerts.test.ts __tests__/api/cron/condition-alert-evaluate.test.ts __tests__/app/api/cron/first-session-nudge.test.ts __tests__/app/api/cron/first-session-nudge-push.test.ts __tests__/app/api/cron/weekly-recap-email.test.ts __tests__/app/api/cron/reengagement-email.test.ts __tests__/api/cron/swell-watch.test.ts __tests__/app/api/og/legacy-decision-attribution.test.tsx __tests__/api/legacy-decision-bluesky-generation.test.ts --runInBand`

Expected: FAIL because message adapters and envelope payload fields are absent.

- [ ] **Step 3: Add common message generation and open attribution**

Generate the envelope after candidate selection but before enqueue/send. Derive the UUID idempotency key with `buildLegacyIdempotencyUuid(authorityPath, deliveryDedupeKey)`; never pass the raw textual delivery key into the UUID field. Include `legacy_envelope_id`, `legacy_rendered_envelope_id`, `legacy_candidate_id`, and a dedicated signed message-open token in push payloads and CTA query parameters.

`message-open.ts` defines a strict `LegacyMessageOpenClaimsV1` with only `version=1`, `purpose="message_open"`, random `jti`, envelope ID, rendered-owner envelope ID, one candidate ID, authority path, origin surface, `allowedEventType="opened"`, issued-at, and expiry. Sign and verify it only with `LEGACY_DECISION_MESSAGE_OPEN_TOKEN_SECRET`; do not accept `LEGACY_DECISION_EVENT_TOKEN_SECRET`, an anonymous surface token, or an actor-claim token. The server event route maps a valid bearer to exactly one idempotent `opened` event with `clientEventId=jti`; it cannot authorize `shown`, `session_linked`, client generation, actor claim, a different candidate, or a different envelope. Query/push parameter name is `legacy_open_token`, logs redact it, expiry is no later than the envelope's `eventAcceptUntil`, and the parser removes it immediately after handing it to the event route.

On web, `components/providers.tsx` calls the strict one-shot parser in `message-open.ts`, submits the bearer to the server event route, and removes attribution parameters with `history.replaceState` without changing navigation. On native warm/cold push taps, `src/lib/push-notifications.ts` calls `legacy-decision-message-open.ts` before routing; ordinary inbound email/app links call the same helper from `src/lib/deeplink/handle-inbound-url.ts`. Both paths enqueue through the existing bounded native event queue and dedupe by token `jti`; native storage holds the opaque bearer only until accepted/expired and never decodes it as authority. The named web/native tests cover warm tap, cold-start tap, foreground deep link, cross-purpose token rejection, wrong candidate, invalid signature, expiry, redacted logging, and retry. Session links preserve the same non-secret identifiers, not the message-open bearer. Email provider delivery/open pixels and push enqueue acceptance must not be mapped to `shown`. Add dashboard gap code `message_shown_unobservable` for delivered recommendation messages so coverage is honest.

Daily intel generates an issuance UUID before `saveIntel`, saves and re-reads the exact `beach_daily_intel` row (`id`, `generated_at`, and the strict allowlisted recommendation fields), computes its canonical revision hash, then records `daily_intel_v2` with the required `sourceIssuance`. `record_legacy_decision_envelope_v1` verifies that row/revision and the partial unique index freezes the one-to-one issuance mapping in the append-only envelope. A later upsert may change the daily-intel row but cannot rewrite the historical mapping. Message routes that reuse intel must select the row ID/revision they actually read and resolve only an envelope whose issuance ID, source record ID, revision time, and revision hash all match; “latest envelope for beach/date” lookup is forbidden. An older or overwritten row with no exact mapping causes the message route to generate its own envelope and mark provenance `legacy_daily_intel_without_envelope`.

`first-session-nudge-push` uses distinct authority `message_first_session_nudge_push_v1` and the existing `push_first_session_nudge` origin; its adapter captures the ranked candidate set and exact pushed candidate before Expo enqueue without changing dedupe or copy. `weekly-recap-email` uses `message_weekly_recap_v1` and `email_weekly_recap`; its candidates are the existing evaluated “best days this week” rows before template truncation, and its selected candidate is the primary CTA day/window. Both routes use their existing delivery dedupe keys for envelope idempotency and the common open-token path. Their existing suites must assert unchanged recipients, skips, ordering, text/template payload, and provider dedupe after legacy fields are stripped.

`outbound-presentation-adapter.ts` applies the same candidate allowlists to the
two positive OG routes. Each route resolves its server-side beach/window state,
records the exact selected share candidate before rendering, adds only an
opaque envelope/candidate reference to response metadata, and appends
`public_share_shown_unobservable`; crawler fetch or image generation is never a
`shown` event. The Bluesky edge function preserves its current selection/copy,
then calls Task 6's signed server-generation endpoint before posting. A failed
attribution call does not change the post, but records a privacy-safe
generation attempt and a release-visible gap. Provider acceptance/display is
also `public_share_shown_unobservable`; a tracked Quiver CTA may append
`opened`, but platform impressions are never inferred. Swell Watch remains
objective-only and records no selected beach/window when its current behavior
does not make one.

- [ ] **Step 4: Run message suites and typecheck**

Run Quiver: `yarn test:unit --runTestsByPath __tests__/lib/recommendations/legacy-envelope/message-adapter.test.ts __tests__/lib/recommendations/legacy-envelope/message-open.test.ts __tests__/app/api/cron/daily-intel.test.ts __tests__/api/cron/home-morning-call.test.ts __tests__/api/cron/weekend-window.test.ts __tests__/app/api/cron/conditions-alert-email.test.ts __tests__/api/cron/similarity-alerts.test.ts __tests__/api/cron/condition-alert-evaluate.test.ts __tests__/app/api/cron/first-session-nudge.test.ts __tests__/app/api/cron/first-session-nudge-push.test.ts __tests__/app/api/cron/weekly-recap-email.test.ts __tests__/app/api/cron/reengagement-email.test.ts __tests__/api/cron/swell-watch.test.ts __tests__/api/cron/condition-alert-deliver.test.ts __tests__/app/api/og/legacy-decision-attribution.test.tsx __tests__/api/legacy-decision-bluesky-generation.test.ts --runInBand && yarn typecheck`

Run native: `cd /Users/stevenchandler/Desktop/dev/quiver-native && npm test -- --runInBand src/__tests__/push-tap-routing.test.ts src/lib/deeplink/handle-inbound-url.test.ts && npm run typecheck`

Expected: PASS with unchanged send/skip/dedupe behavior.

- [ ] **Step 5: If the user explicitly authorized commits, commit message authority coverage**

```bash
git add lib/recommendations/legacy-envelope/message-adapter.ts lib/recommendations/legacy-envelope/outbound-presentation-adapter.ts lib/recommendations/legacy-envelope/message-open.ts components/providers.tsx lib/services/intel-generation-service.ts app/api/cron/home-morning-call/route.ts app/api/cron/weekend-window/route.ts app/api/cron/conditions-alert-email/route.ts app/api/cron/similarity-alerts/route.ts app/api/cron/condition-alert-evaluate/route.ts app/api/cron/first-session-nudge/route.ts app/api/cron/first-session-nudge-push/route.ts app/api/cron/weekly-recap-email/route.ts app/api/cron/reengagement-email/route.ts app/api/cron/swell-watch/route.ts app/api/cron/condition-alert-deliver/route.ts app/api/og/surf-call/route.tsx app/api/og/weekend-wave-check/route.tsx supabase/functions/bluesky-auto-post/index.ts __tests__/lib/recommendations/legacy-envelope/message-adapter.test.ts __tests__/lib/recommendations/legacy-envelope/message-open.test.ts __tests__/app/api/cron/first-session-nudge-push.test.ts __tests__/app/api/cron/weekly-recap-email.test.ts __tests__/app/api/og/legacy-decision-attribution.test.tsx __tests__/api/legacy-decision-bluesky-generation.test.ts
git commit -m "feat(alerts): attribute legacy message decisions"
```

Native, only if commits were explicitly authorized:

```bash
cd /Users/stevenchandler/Desktop/dev/quiver-native
git add src/lib/legacy-decision-message-open.ts src/lib/push-notifications.ts src/lib/deeplink/handle-inbound-url.ts src/__tests__/push-tap-routing.test.ts src/lib/deeplink/handle-inbound-url.test.ts
git commit -m "feat(native): attribute recommendation message opens"
```

### Task 15: Add privacy review and operator coverage/divergence dashboards

**Files:**
- Create: `docs/security/legacy-decision-envelope-data-map.md`
- Create: `lib/services/legacy-decision-attribution-service.ts`
- Create: `app/admin/forecasts/decision-attribution/page.tsx`
- Create: `app/api/cron/cleanup-legacy-decision-envelopes/route.ts`
- Modify: `vercel.json`
- Test: `__tests__/lib/recommendations/legacy-envelope/attempt-reconciliation.test.ts`
- Test: `__tests__/lib/services/legacy-decision-attribution-service.test.ts`
- Test: `__tests__/app/admin/forecasts/decision-attribution-page.test.tsx`
- Test: `__tests__/api/cron/cleanup-legacy-decision-envelopes.test.ts`

**Interfaces:**
- Consumes: `legacy_decision_coverage_daily` and `legacy_decision_divergence_daily` views, immutable outbox/gap aggregates, and a signed attempt-log reconciliation artifact.
- Produces: `getLegacyDecisionAttributionReport({ from, to })` and an admin-only dashboard.

- [ ] **Step 1: Write failing report tests**

```ts
it("reports coverage without treating prefetch or unobservable message display as a render", async () => {
  const report = await getLegacyDecisionAttributionReport({ from: "2026-07-10", to: "2026-07-17" });
  expect(report.totals).toEqual(expect.objectContaining({
    eligibleRenderAttempts: 100,
    attributedShown: 96,
    renderedCoverageRate: 0.96,
  }));
  expect(report.excluded).toEqual(expect.objectContaining({
    backgroundPrefetch: 20,
    messageShownUnobservable: 14,
  }));
});

it("groups mismatch by surface, authority, platform, and version", async () => {
  const report = await getLegacyDecisionAttributionReport(RANGE);
  expect(report.divergence[0]).toEqual(expect.objectContaining({
    originSurface: "native_home",
    authorityPath: "surf_discovery_v1",
    divergenceKind: "replaced_primary",
  }));
});

it("marks the measurement window untrusted when either attempt source is missing an id", () => {
  const report = reconcileLegacyDecisionAttempts(DB_ATTEMPTS, ARCHIVED_LOG_ATTEMPTS, WATERMARK);
  expect(report).toMatchObject({
    trusted: false,
    sinkMissing: [LOG_ONLY_ATTEMPT_ID],
    logMissing: [DB_ONLY_ATTEMPT_ID],
  });
});

it("cannot pass rollout with a missing authority or expired accepted gap", async () => {
  const report = await getLegacyDecisionAttributionReport(RANGE);
  expect(report.authorityInventory.missing).toEqual([]);
  expect(report.authorityInventory.expiredAcceptedGaps).toEqual([
    "fixture_expired_gap_v1",
  ]);
  expect(report.trusted).toBe(false);
  expect(report.rolloutBlockedBy).toContain("authority_inventory_incomplete");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test:unit --runTestsByPath __tests__/lib/recommendations/legacy-envelope/attempt-reconciliation.test.ts __tests__/lib/services/legacy-decision-attribution-service.test.ts __tests__/app/admin/forecasts/decision-attribution-page.test.tsx --runInBand`

Expected: FAIL because service/page modules do not exist.

- [ ] **Step 3: Implement report service, dashboard, and privacy data map**

The dashboard must show, by day/surface/platform/authority/version:

- generation persistence success and failure counts;
- eligible render attempts, attributed shown count, and coverage rate;
- exact, filtered, reordered, replaced, cached-incumbent, suppressed-positive, and client-positive-from-none counts;
- invalid/nonmember event attempts;
- opened and session-linked rates;
- anonymous claim eligible, bound, failed, and pre-P0-B/no-claim-token excluded counts;
- session-link due, backed-off, linked, expired, attempts-exhausted, semantic-mismatch, and oldest-due-age metrics;
- p50/p95 envelope-write latency;
- the complete authority registry with generation/render disposition, zero-volume rows, owner, review expiry, and release-blocker state;
- accepted explicit gaps, including selected-only Surf Call, scored-forecast and Coach Picks with no current consumer, message shown, public OG/social display, offline client generation, old cache without identity, legacy V1 with no consumer, and dormant discovery V2 consumers.

The privacy document must enumerate every persisted field, source, purpose, retention, access role, erasure behavior, and client exposure. Set retention by dependency component: 90 days for components without a valid session link and 13 months from the latest valid session-link receipt for any component containing one, including anonymous-origin envelopes. Dashboard history ends with raw-record retention; no longer-lived aggregate is promised in P0-B. Document separate decision, surface-event, actor-claim, and message-open token purposes/expiry; that tokens contain no raw visitor or user context; that private candidate identity uses envelope-scoped HMAC; and that session deletion is session-scoped erasure. Include a reviewer checklist signed by Product, Engineering, and Privacy/Security before production flag enablement.

Add a daily authenticated cron route that calls the no-argument
`purge_legacy_decision_envelopes_v1()`, reports only deleted aggregate counts,
and is separately gated by `LEGACY_DECISION_RETENTION_ENABLED=true`. The RPC,
not the route, obtains `transaction_timestamp()`. Register it in `vercel.json`
at `30 4 * * *`. Its disabled response is a successful no-op in local/test
only; production monitoring raises a release blocker whenever attribution
writes are enabled while retention is disabled. General rollout cannot begin
until privacy sign-off, one successful dry-run, and one successful enabled
cleanup run are recorded. Write rollback leaves this flag and cron enabled.

The dashboard reads `legacy_decision_write_attempts` for generation persistence and latency, but labels a window trusted only from the latest verified reconciliation artifact produced by the Task 2 algorithm. `attempt-reconciliation.ts` is the pure parser/set-join used by both the CLI and service tests; the service fetches the signed artifact and referenced archive manifest from the access-controlled log archive, verifies their hashes/signature and interval/watermark, then exposes only aggregate discrepancy counts. A missing, stale, discontinuous, or nonzero-discrepancy artifact marks coverage `untrusted` and cannot satisfy the 99% gate. Segment every lifecycle metric by `generation_trust` so client-reported generation cannot inflate server-observed coverage.

Before computing any percentage, the service joins attempts/events to the
full Task 1 authority registry. A missing adapter mapping, expired accepted
gap, unexplained zero-volume row during an expected activation window, or any
`release_blocker` makes the report untrusted. It may display a diagnostic
percentage but cannot satisfy rollout. Accepted-gap attempts remain in their
stage denominator unless they are one of the explicitly unobservable display
classes above. Offline-generation gaps are counted by authority and platform,
including Surf Call, Week Scout, native map, and Plan My Next, and are never
converted into successful generated/rendered/session-linked events later.

For session-link coverage, `eligible` means the user began a recommendation-originated session with a P0-B context that either already had the authenticated actor or carried a still-valid actor-claim token. Old anonymous contexts with no claim token are an explicit excluded cohort, not a success or failure. Claim-capable contexts that fail signature/cookie/binding are eligible failures. The service also derives outbox state from immutable rows plus lifecycle/gap events using the exact retry schedule in Task 3; terminal rows never remain in the due backlog.

- [ ] **Step 4: Run dashboard tests, lint, and typecheck**

Run: `yarn test:unit --runTestsByPath __tests__/lib/recommendations/legacy-envelope/attempt-reconciliation.test.ts __tests__/lib/services/legacy-decision-attribution-service.test.ts __tests__/app/admin/forecasts/decision-attribution-page.test.tsx __tests__/api/cron/cleanup-legacy-decision-envelopes.test.ts --runInBand && yarn lint && yarn typecheck`

Expected: PASS with lint and TypeScript exit code 0.

- [ ] **Step 5: If the user explicitly authorized commits, commit dashboard and privacy review**

```bash
git add docs/security/legacy-decision-envelope-data-map.md lib/recommendations/legacy-envelope/attempt-reconciliation.ts scripts/ops/reconcile-legacy-decision-attempts.ts lib/services/legacy-decision-attribution-service.ts app/admin/forecasts/decision-attribution/page.tsx app/api/cron/cleanup-legacy-decision-envelopes/route.ts vercel.json __tests__/lib/recommendations/legacy-envelope/attempt-reconciliation.test.ts __tests__/lib/services/legacy-decision-attribution-service.test.ts __tests__/app/admin/forecasts/decision-attribution-page.test.tsx __tests__/api/cron/cleanup-legacy-decision-envelopes.test.ts
git commit -m "feat(admin): report legacy decision attribution"
```

### Task 16: Prove end-to-end attribution and write the rollout/rollback runbook

**Files:**
- Create: `e2e/recommendation-attribution.spec.ts`
- Create: `/Users/stevenchandler/Desktop/dev/quiver-native/.maestro/flows/discovery/recommendation-envelope-session-link.yaml`
- Create: `docs/deployment/legacy-decision-envelope-rollout.md`
- Modify: `__tests__/api/recommendation-impressions.test.ts`
- Modify: `__tests__/api/recommendation-session-context.test.ts`

**Interfaces:**
- Consumes: completed web/native/API/database instrumentation.
- Produces: exercised rollout/rollback evidence and Phase 0-B completion report inputs.

- [ ] **Step 1: Write the failing web E2E**

```ts
test("records the rendered replacement and links the logged session", async ({ page, request }) => {
  await installDiscoveryFixture(page, { serverWinnerHasPhoto: false, secondCandidateHasPhoto: true });
  await page.goto("/");
  await expect(page.getByTestId("hero-recommendation")).toContainText("Second Candidate");
  await page.getByRole("button", { name: /log session/i }).click();
  await completeMinimalSessionForm(page);
  const audit = await request.get("/api/test-support/legacy-decision-audit");
  expect(await audit.json()).toMatchObject({
    shown: { divergenceKind: "replaced_primary" },
    sessionLinked: true,
  });
});
```

Use the existing test-support authorization pattern; do not expose the audit route in production builds.

- [ ] **Step 2: Run the E2E to verify it fails before the test fixture/support is complete**

Run: `yarn test:e2e e2e/recommendation-attribution.spec.ts --project=auth --workers=1`

Expected: FAIL because the test-support audit fixture or lifecycle rows are not yet available in the E2E environment.

- [ ] **Step 3: Complete E2E fixture support and native Maestro flow**

The Maestro flow must authenticate, wait for native home, open the rendered hero, start a session log, save it, and assert the debug-only attribution status reads `Session linked`. Keep all mutation in the existing dev/test fixture environment.

The rollout runbook must define these exact flags:

```text
LEGACY_DECISION_ENVELOPE_WRITE_ENABLED=false
LEGACY_DECISION_EVENT_WRITE_ENABLED=false
LEGACY_DECISION_ENVELOPE_AUTHORITIES=
LEGACY_DECISION_EVENT_AUTHORITIES=
LEGACY_DECISION_EVENT_TOKEN_SECRET=$(openssl rand -base64 32)
LEGACY_DECISION_ACTOR_CLAIM_TOKEN_SECRET=$(openssl rand -base64 32)
LEGACY_DECISION_VISITOR_TOKEN_SECRET=$(openssl rand -base64 32)
LEGACY_DECISION_VISITOR_HASH_SECRET=$(openssl rand -base64 32)
LEGACY_DECISION_MESSAGE_OPEN_TOKEN_SECRET=$(openssl rand -base64 32)
LEGACY_DECISION_SERVER_GENERATION_SECRET=$(openssl rand -base64 32)
LEGACY_DECISION_PRIVATE_HASH_SECRET=$(openssl rand -base64 32)
LEGACY_DECISION_RETENTION_ENABLED=false
```

The runbook also requires the immutable 90-day attempt-log archive, drain continuity alarm, archive manifest verification key, and reconciliation command; missing log-drain coverage blocks the first write-enabled stage. Rollout stages are schema dark, privacy/retention dry run, retention enabled, discovery 1% allowlist, discovery web 100%, bulk/scored/coach/intent/regional authorities, native home/beach/map/Plan My Next, Week Scout, surf call/Session Intelligence, then messages/OG/social. Each stage must show the complete authority registry, including dormant/accepted-gap rows. No general-rollout stage may begin with `LEGACY_DECISION_RETENTION_ENABLED=false`. Each stage requires trusted attempt-sink reconciliation, ≥99% generation persistence, ≥95% tracking-eligible rendered coverage, 100% accepted candidate membership and semantic session-link validation, ≥95% eligible recommendation-originated session-link coverage, no expired gap approval or inventory release blocker, no statistically meaningful response/error change, and p95 route overhead ≤75 ms.

Rollback sets both write flags false and clears both authority allowlists. It does not disable `LEGACY_DECISION_RETENTION_ENABLED`. Event routes return 204, clients tolerate missing references, schema/data and pending session-link outbox rows remain in place, and legacy recommendation behavior continues. Do not roll back by dropping tables. Disabling automatic writes does not delete attribution already collected.

- [ ] **Step 4: Run focused web and native E2E**

Run web: `yarn test:e2e e2e/recommendation-attribution.spec.ts --project=auth --workers=1`

Expected: PASS with one shown, one opened, and one session-linked lifecycle chain.

Run native: `cd /Users/stevenchandler/Desktop/dev/quiver-native && maestro test .maestro/flows/discovery/recommendation-envelope-session-link.yaml`

Expected: PASS on the configured dev build and test account.

- [ ] **Step 5: Run complete local gates in each repository**

Run Quiver:

```bash
cd /Users/stevenchandler/Desktop/dev/quiver
yarn typecheck
yarn test:unit --runInBand
yarn lint
```

Expected: all commands PASS.

Run quiver-native:

```bash
cd /Users/stevenchandler/Desktop/dev/quiver-native
npm run typecheck
npm test -- --runInBand
npm run lint
```

Expected: all commands PASS.

- [ ] **Step 6: Exercise rollback in local/dev before production approval**

Set both write flags false, rerun the discovery API, web home, native home API regression, Week Scout, surf call, and one message cron dry run. Expected: every legacy recommendation payload and UI remains functional, `legacyDecision` is null or absent, event endpoints return 204, and no new envelope/event rows appear.

- [ ] **Step 7: Stop at the linked-database and production rollout approval gate**

Provide exact local test output, E2E/Maestro evidence, migration hash, schema diff, privacy sign-off, dashboard screenshot, row-volume estimate, and exercised rollback evidence. Do not run `supabase db push --linked`, deploy Quiver, publish a native OTA/binary, or enable any production flag until the user explicitly approves each release action.

- [ ] **Step 8: If the user explicitly authorized commits, commit E2E and rollout documentation in each repository**

Quiver:

```bash
cd /Users/stevenchandler/Desktop/dev/quiver
git add e2e/recommendation-attribution.spec.ts docs/deployment/legacy-decision-envelope-rollout.md __tests__/api/recommendation-impressions.test.ts __tests__/api/recommendation-session-context.test.ts
git commit -m "test(forecast): verify legacy decision attribution rollout"
```

quiver-native:

```bash
cd /Users/stevenchandler/Desktop/dev/quiver-native
git add .maestro/flows/discovery/recommendation-envelope-session-link.yaml
git commit -m "test(native): verify recommendation session attribution"
```

---

## Phase 0-B Completion Gate

Phase 0-B is complete only when all of the following are evidenced for the agreed measurement window:

- Every authority in the inventory has an adapter or an explicitly accepted dashboard gap.
- Enabled generation persistence is at least 99%.
- Operational attempt telemetry is reconciled; an incomplete denominator cannot pass the persistence gate.
- At least 95% of tracking-eligible rendered recommendations carry an envelope and membership-valid candidate ID.
- At least 95% of recommendation-originated sessions carry a `session_linked` event.
- Every accepted shown/opened/session-linked candidate is membership-valid.
- Event and session-link retries are payload-hash idempotent, and the durable outbox backlog is within its freshness SLO.
- Server-selected versus client-rendered divergence is measurable by surface, authority, platform, scorer version, and policy version.
- Background prefetch and unobservable message/OG/social display are excluded from rendered coverage and reported separately; offline generation remains an explicit eligible failure denominator.
- Existing recommendation, forecast, confidence, ordering, fallback, email, and push behavior remains unchanged.
- Existing recommendation impression and session-context dual-writes remain healthy.
- The privacy data map is approved and retention/user-erasure checks pass.
- Retention is enabled, dependency-closure and mixed-retention fixtures pass, and write rollback leaves cleanup active.
- The local/dev rollback has been exercised successfully.
- The database migration and every deployment/flag change received its required explicit approval.

## Deferred Work Explicitly Outside This Plan

- Replacing competing authorities with the canonical session decision engine.
- Changing any ranking, threshold, fallback, surf-call, Session Intelligence, or Week Scout behavior.
- Removing existing impressions or recommendation session contexts.
- Treating a message provider delivery or email pixel as proof that a user saw a recommendation.
- Inferring attribution for old native cache records that do not contain an envelope ID.
- Activating any dormant `surf_discovery_v2` consumer before its distinct lifecycle adapter is complete.
- Adding or changing confidence UI.
- Applying the migration or enabling production flags without the approval gates above.
