# Canonical Session Decision Engine Design

Date: 2026-07-17

Status: approved architecture; implementation must be decomposed into phase-specific plans

Parent product goal: guide each surfer to the session most likely to be worth surfing, without hiding meaningful swell events or recommending conditions outside that surfer's safe and suitable range.

Related foundation design: [Forecast Source Handoff Shadow Design](./2026-07-16-forecast-source-handoff-shadow-design.md)

## Product Decision

Quiver will have one authoritative, server-side session decision engine powering home recommendations, map results, beach detail, Week Scout, alerts, surf-call messaging, web, and native.

The engine is an orchestration boundary composed of separately testable layers. It is not one giant scoring function.

The governing rule is:

> The ocean forecast is shared physical truth. Personalization determines which sessions are suitable and valuable for a particular surfer.

Personalization must never reduce a physical forecast for a beginner, hide a hurricane swell, make an exposed beach appear safer, or replace forecast evidence with preferred conditions. It may exclude unsuitable sessions and rank the remaining sessions.

The system can guarantee that decision policy. It cannot guarantee how the ocean will behave.

## Why The Current Architecture Is Insufficient

The July 2026 Elida swell exposed both a forecast problem and a decision-system problem:

- NOAA/NWS and Open-Meteo are collapsed behind a fixed 72-hour handoff before event-level evidence is reconciled.
- Pinned GFS-Wave issue-time capture exists but is hard-disabled.
- External forecaster pages identified a major swell that Quiver materially undercalled. Those pages are useful discrepancy evidence, but they are not safe direct numerical inputs.
- Beach-aware swell, wind, tide, and setup logic exists, but a more generic scorer controls important window-selection paths.
- Personalization is applied after candidate windows have already been collapsed in parts of discovery.
- Home, discovery, beach detail, Week Scout, alerts, and native can select, score, or rerank independently.
- Below-threshold fallback behavior can return the best available session even when no session is worth recommending.
- Production recommendation attribution has not yet produced the outcome volume needed for a learned ranking model.
- Offshore buoy height is currently used in places where breaking face height or session utility is the actual target. These are different truths and require different validation data.

The source-handoff shadow work remains necessary, but it is Phase 0 of this architecture rather than the final forecast fix.

## Considered Approaches

### Patch source selection and existing scores

Restoring GFS capture and adjusting the 72-hour handoff may improve event visibility quickly. It would not resolve competing score authorities, unsafe post-selection personalization, below-threshold fallbacks, or client-side reranking. Rejected as an end state.

### Train an end-to-end personalized recommender now

A learned model could eventually estimate personal session value, but current recommendation-attributed outcomes are too sparse to train or validate it responsibly. It would also make safety rules harder to audit. Rejected for the current stage.

### Build a staged canonical decision engine

Preserve all forecast evidence, detect regional events before reconciliation, translate the shared ocean state to each beach, apply hard eligibility, rank every eligible beach-window for the user, and publish one immutable decision record. Start with versioned deterministic policies and add learned residuals only after outcome attribution is healthy. Selected.

## Architecture

```text
Forecast evidence and observations
              |
              v
Regional ocean state and event detection
              |
              v
Beach-level surf impact projections
              |
              v
Candidate beach-window enumeration
              |
              v
Hard eligibility and safety policy
              |
              v
Personal session utility ranking
              |
              v
Immutable canonical decision record
              |
              v
All Quiver surfaces and lifecycle attribution
```

The canonical engine lives server-side in Quiver. Seaside and existing ingestion jobs remain forecast-data producers. Native and web clients become presentation consumers and may not recompute or rerank a canonical decision.

## Component Boundaries

### 1. Forecast Evidence Registry

Purpose: retain the forecast evidence available at issue time without prematurely selecting one source.

Inputs include:

- NOAA/NWS forecast candidates;
- Open-Meteo forecast candidates;
- pinned GFS-Wave candidates;
- buoy and nearshore observations;
- tropical-system metadata;
- HRRR wind where applicable;
- external forecaster snapshots as QA and discrepancy evidence.

Evidence has three enforced classes:

- `serving_model_evidence`: approved numerical forecast sources that may participate in shadow or serving source policy;
- `official_safety_context`: official storm, closure, and hazard records that may classify an event or gate a recommendation but may not invent a numerical surf height;
- `qa_only_evidence`: scraped forecaster output and other discrepancy monitors that may alert operators and create review cases but may not alter event state, projections, eligibility, or ranking.

Moving an input between evidence classes requires a separately approved adapter, validation report, and policy-version change. A social post or scraper result can initiate an investigation but can never become an automatic production input.

Every candidate must retain source, model, cycle, issue time, valid time, region, horizon, partitions, freshness, units, parser version, and quality status. Forecast issuance persistence separates stable `issuance_identity` from immutable `issuance_revision_id`. Every revision records `raw_payload_hash`, adapter and parser versions, `retrieved_at`, quality status, and optional `supersedes_revision_id`. A provider correction or parser correction creates a new revision and may supersede an earlier revision; it never rewrites it. Every decision references the exact revision it saw.

QA-only evidence may trigger alerting, operator review, regression-fixture creation, and an audited manual recommendation hold. It may not automatically change event detection, reconciliation, numerical projections, eligibility, or ranking.

### 2. Regional Ocean State And Event Detector

Purpose: detect and describe meaningful regional swell events before candidate forecasts are collapsed.

The regional pipeline has an explicit non-circular order:

```text
normalized approved raw evidence
        -> preliminary event-regime classification
        -> source reconciliation conditioned on regime
        -> final regional ocean state
        -> versioned event characterization
```

The preliminary classifier identifies `tropical`, `long_period`, `ordinary`, or `unresolved_disagreement` from approved raw evidence and official context without depending on a reconciled height. The serving detector then emits versioned regional events containing:

- stable `event_id`, immutable `event_version_id`, `previous_event_version_id`, and region;
- arrival, peak, and decay windows;
- dominant direction and period range;
- energy or magnitude class;
- tropical or non-tropical event type;
- supporting and disagreeing evidence;
- detector version, `detected_at`, and issue-time evidence lineage.

Source reconciliation is a separate pure policy. Weighting may vary by region, horizon, swell direction and period, event type, freshness, historical source skill, and current disagreement. The initial serving policy reproduces existing behavior while candidate policies run in shadow.

Merges, splits, arrival shifts, and cancellation create new event versions instead of rewriting earlier versions. The beach projector receives reconciled swell partitions, uncertainty, and complete evidence lineage rather than only a collapsed scalar height.

Event detection must be evaluated independently from exact height accuracy. An undercalled height must not cause a well-supported major event to disappear. Conversely, an event signal does not authorize an unvalidated storm multiplier or choosing the largest source value.

The Elida event and a curated set of historical tropical and long-period swells become permanent regression fixtures.

### 3. Beach Impact Projector

Purpose: translate a shared regional ocean state into conditions at each beach and valid time.

The projector accounts for:

- directional exposure, shelter, and island or headland shadowing;
- swell period and partition interaction;
- bathymetry, shoaling, refraction, and local decay;
- beach orientation and break type;
- tide response;
- local wind direction and speed;
- event arrival, peak, and decay;
- known access and hazard context.

One versioned transformation authority replaces competing display and recommendation transformations over time. Existing beach-aware primitives should be reused where validated, but no existing score or transform becomes canonical merely because it already exists.

Each projection includes an expected breaking-surf range and an internal high-side safety range. The high-side is derived from source dispersion, event state, and measured forecast-error bounds. Calibration reports target quantile coverage, interval sharpness, quantile loss or interval score, and maximum-width guardrails separately for ordinary and major-event conditions. Cohorts cover event regime, horizon, source availability, and beach class. Before any Phase 2 calibration code or promotion is approved, the Phase 2 implementation plan must freeze numerical values for the target high-side quantile or coverage rate, cohort minimum sample sizes, maximum interval widths, sharpness gate, and quantile-loss or interval-score gate. Beach-specific calibration may replace broader hierarchical priors only after that frozen minimum-sample gate passes. The high-side upper bound must be at least the expected upper bound. It is used by safety policy and is not presented as a user-facing low-confidence label.

Every numerical wave field carries an explicit `measurement_basis` (`offshore_significant_height` or `breaking_face_height`) and canonical `unit` (`meters`), with display conversion declared separately. Eligibility operates only on canonical breaking-face-height meters. QA-only evidence may not directly set either numerical range.

The projector must keep these truths separate:

- offshore source skill, validated against correctly time-matched offshore observations;
- beach breaking-height response, validated against independent nearshore, camera, trusted report, or surfer-entered truth;
- session utility, validated against recommendation-attributed surfer outcomes.

Offshore significant wave height alone must not certify displayed face height.

### 4. Candidate Enumerator

Purpose: evaluate all reasonable `beach x contiguous time window` candidates before any personalization collapses the search space.

Inputs define an explicit decision scope: location or allowed beach set, availability, maximum travel radius or duration, and planning horizon. The same enumerator supports near-term discovery and seven-day Week Scout decisions.

Candidate construction must:

- use daylight and availability boundaries;
- build contiguous surfable windows rather than score only a start slot;
- represent average quality, minimum floor, peak, persistence, variance, and duration;
- retain source and projection lineage;
- exclude synthetic or invalid slots from winning a recommendation;
- avoid preferring today merely because it is today.

The search may be bounded for cost, but pruning may use only objective scope constraints such as distance, availability, closure, or invalid data. It may not discard a beach's better time window using a generic pre-personalization score.

### 5. Eligibility And Safety Policy

Purpose: decide whether a candidate is allowed to enter personalized ranking.

Eligibility is a policy result, not a score deduction. It has three states:

- `eligible`;
- `ineligible`, with stable reason codes;
- `insufficient_safety_data`, which is not rankable as a recommendation.

Hard gates include:

- skill and explicit user restrictions;
- maximum suitable breaking-wave size;
- internal high-side safety estimate;
- beach hazards such as currents, reef, shorebreak, access, or local setup risk;
- tide limits and unsafe setup interactions;
- daylight and schedule;
- closures and safety-critical data freshness;
- source or projection validity.

Safety-critical personalization is available to every user and is never a paid feature. Learned preference or popularity bonuses cannot override an ineligible result.

If the user's skill level is unknown, Quiver may show objective forecast information but must not label a session as a personalized recommendation. The product should request the minimum required context instead of assuming an unsafe skill level.

During a major swell, an exposed expert beach can be eligible for a suitable surfer and excluded for a beginner from the same physical projection. A protected beach remains eligible only when its expected and high-side ranges, hazards, and conditions pass policy. If nothing passes, the engine returns no recommendation.

#### Interim Phase 0 Major-Event Hold

Phase 0 introduces a deliberately narrow `major_event_hold_evaluator` before the complete event detector and eligibility engine exist. It is enforced server-side across every current recommendation authority and cannot change objective forecast heights or forecast browsing.

An append-only `regional_recommendation_hold` policy record contains:

```text
hold_id and version
region and optional beach or exposure scope
event reference
affected valid-time window
affected user safety cohorts
action
trigger_type
supporting evidence references
automatic policy version or authorizing operator
reason
created_at, effective_at, and mandatory expires_at
supersedes_hold_id
status
```

The parent architecture permits automatic holds only from approved serving-model evidence or official safety context. The first P0-A trigger policy is narrower: it accepts only fresh official safety context. No serving-model trigger is approved for P0-A launch; adding one requires a new versioned trigger policy, focused tests, and separate implementation and release approval. QA-only evidence may open an alert and investigation; an authorized operator may then create a separate audited hold record that references it. The policy record, not the QA evidence, changes recommendation behavior. Every activation, extension, replacement, cancellation, and expiry is auditable.

The conservative cohort includes beginner, intermediate, and unknown-skill contexts. Unknown skill receives no positive personalized recommendation inside an active major-event scope. An affected exposed session is removed. A protected alternative may remain only when it passes separately approved Phase 0 safety criteria; otherwise the result is explicit none. Failure to resolve active hold state cannot manufacture a positive recommendation.

Every server-reachable legacy route, native response, cached recommendation, alert, and surf-call path must enforce the same active record. An old client is protected after its next successful server decision request because the server returns the held result or refuses to deliver a positive recommendation. A fully offline installed client cannot be retroactively changed, so P0-A requires an OTA/build that clears and gates positive caches before enforcement; absolute cross-version prevention additionally requires a separately approved minimum-version policy. Holds have mandatory expiration and cannot remain active indefinitely. Automatic evaluation, manual policy state, and enforcement have independent controls: disabling automatic evaluation does not cancel an already effective audited hold.

### 6. Personal Session Utility Ranker

Purpose: rank eligible candidates by expected value to this surfer.

The ranker uses separate, inspectable dimensions:

- objective surf quality and window persistence;
- match to preferred size, style, tide, and wind;
- skill comfort within the already-safe range;
- board compatibility;
- schedule fit;
- travel friction;
- crowds only when supported by reliable data;
- learned beach affinity and avoidance;
- internal forecast reliability and downside risk.

The first version uses versioned rules and calibrated weights. Personalization applies to every viable candidate window, not after selecting one generic window per beach. Global, regional, beach, and user priors are hierarchical so sparse user histories fall back safely instead of producing unstable rankings.

Machine-learned personalization may later predict a residual adjustment to eligible candidate utility. It may not control physical forecasts or hard safety gates, and it may not launch until recommendation-attributed outcome volume and offline promotion gates are sufficient.

A server-owned, versioned minimum utility threshold separates "best available" from "worth recommending." Clients and surfaces cannot change it. Below that threshold, the canonical result contains no selected recommendation.

### 7. Canonical Decision Orchestrator

Purpose: coordinate the layers, persist one immutable internal record, and derive one sanitized client view.

The decision identity is deterministic for the normalized decision scope, server-owned planning anchor, scope window, scope timezone, forecast snapshot, user-context snapshot, engine version, policy versions, and a complete dependency-manifest snapshot. The dependency manifest covers closures, hazards, access, daylight, source freshness, travel inputs, deterministic expiration inputs, and every other value capable of changing eligibility or rank.

Inputs are canonically serialized before hashing. The resulting `decision_id` is opaque and exposes no user-context values. Forecast and dependency revisions are resolved transactionally, and insertion is idempotent under a database uniqueness constraint. Repeating the same request against the same canonical input manifest returns the same decision ID. A replacement record uses `superseded_by_decision_id` or an equivalent immutable lookup; the original record is never updated to contain new decision state.

Physical source-policy and beach-projection experiments are never randomized per user. All users viewing the same beach, valid time, forecast snapshot, and serving policy receive the same physical projection. User-level experiments may operate only within eligibility-safe ranking behavior.

#### `CanonicalDecisionRecord`

The server-internal source of truth contains:

```text
decision_id
created_at and expires_at
decision_anchor_time
scope_window_start and scope_window_end
scope_timezone
decision_scope and availability
forecast_snapshot_id
regional_event_ids
engine and component versions
user_context_snapshot and provenance
dependency_manifest_id
candidate set and beach projections
eligibility results and reason codes
ranked eligible sessions and component scores
selected recommendation or explicit none
canonical alternatives
internal evidence and audit metadata
superseded_by_decision_id lookup
```

The full user-context snapshot, availability and travel inputs, internal reliability values, high-side ranges, full candidate slate, raw evidence, and audit metadata remain server-only.

#### `CanonicalDecisionView`

The sanitized, versioned surface payload contains only:

```text
decision_id
schema_version
scope
created_at and expires_at
selected recommendation or explicit none
displayable canonical alternatives
objective forecast references
display-safe reason codes
surface actions
```

Both contracts use the same decision ID. Surface adapters consume `CanonicalDecisionView`, never the unrestricted internal record. This prevents clients from using internal reliability or safety fields to invent confidence treatments and keeps personal or operational data off the client.

A decision expires when its forecast evidence, closure state, availability, or other safety-critical input is superseded. Expiration creates a new decision; it never mutates the old record. `decision_anchor_time`, scope-window fields, and timezone are always explicit, even when the anchor is normalized by the versioned scope policy.

The engine may produce decisions for approved server-owned scopes, such as nearby next-24-hours, plan-next-72-hours, seven-day Week Scout, or a fixed beach. Scope semantics and bounds are versioned policy; clients cannot supply arbitrary filters to force a different winner. The default `plan_next_session` scope is shared by home, map, native, and general recommendation alerts. Fixed-beach detail is explicitly contextual and must not masquerade as the global best-session decision. Scope changes are inputs to the same engine, not client-side filtering or reranking. Identical scope and inputs must yield the same decision across every surface.

### 8. Surface Adapters

Home, map, beach detail, Week Scout, alerts, surf-call messaging, web, and native consume `CanonicalDecisionView`.

Surfaces may:

- choose presentation and copy appropriate to the context;
- show eligible, above-threshold canonical alternatives as secondary options while preserving the selected candidate as the primary recommendation;
- display objective forecast data from the decision's referenced physical snapshot independently from its recommendation;
- request a new canonical decision when scope or user context changes.

Surfaces may not:

- recalculate scores;
- select a different time window from the same decision;
- add personalization or popularity bonuses;
- reorder canonical candidates;
- convert an explicit none into a recommendation;
- show a stale decision after expiration;
- infer confidence labels from internal reliability fields.

Every displayed alternative must be eligible and clear the same server-owned minimum utility threshold as a recommendation. A surface may never substitute an alternative as primary for the same decision ID. When the canonical result is explicit none, below-threshold candidates may appear only as objective forecast information, never as other recommendations. Selecting a different scope or changing user context requests a new decision and therefore a new decision ID.

During migration, every surface must report the decision ID it rendered. Contract assertions detect mismatched recommendation, beach, or window for the same decision ID.

### 9. Outcome Attribution And Learning

Purpose: connect an exact decision to what the surfer did and experienced.

The lifecycle is:

```text
generated -> shown -> opened -> navigation_started -> arrived_or_checked_in
          -> session_completed -> session_rated
```

Each event references the immutable decision ID and, when the outcome contains a recommendation, its selected candidate ID. An explicit-none event carries no candidate ID. Session records preserve whether wave height, tide, wind, and other conditions were user-entered, sensor-observed, expert-reported, or forecast-prefilled. Forecast-prefilled values may not be treated as independent truth during learning.

The system stores the evaluated slate and versions needed to calculate selection quality and policy performance. Before online exploration exists, `replay_regret` means the difference between the selected candidate and an independently expert-labeled best eligible candidate on a historical replay. It is not inferred from an unsurfed alternative. Online counterfactual regret may be estimated only from an approved experiment that logs candidate propensities and compares already-eligible, near-tied choices; model-estimated regret without those data is diagnostic and cannot be a promotion gate. Existing session ratings and wave-quality values may seed descriptive priors, but they do not become recommendation outcomes unless exact decision attribution exists.

#### Phase 0 Legacy Decision Envelope

Before canonical decisions exist, each current authority emits an immutable, versioned legacy envelope that exposes rather than conceals current divergence:

```text
legacy_envelope_id and envelope_version
origin_surface
legacy_authority and scorer path
forecast snapshot
evaluated server slate
server-selected candidate
active scorer and policy versions
user-context provenance
created_at and expires_at
```

The immutable generation envelope stops at server evaluation. A separate append-only rendered lifecycle event reports the candidate actually shown, its rendered order, and any enumerated client reorder, filter, stability, cache, or replacement reason. A held explicit-none event contains no candidate ID. Candidate-membership validation distinguishes a rendered server candidate from an unrecognized client replacement without rewriting the generation envelope. Phase 0 begins with an inventory of every server and client recommendation authority; each receives an envelope adapter or an explicit documented attribution gap. Envelope and lifecycle data together measure cross-surface disagreement and do not pretend the inconsistency has already been removed.

## Canonical Contract And Persistence

The implementation uses append-only logical records with stable foreign-key lineage:

- forecast issuance identities, immutable revisions, and source candidates;
- regional event versions;
- append-only regional recommendation holds;
- beach projection versions;
- internal canonical decision records and sanitized decision views;
- evaluated decision candidates and eligibility outcomes;
- recommendation lifecycle events;
- linked session outcomes.

Shared physical evidence and beach projections are referenced by ID rather than duplicated per user decision. User decision records store only normalized decision inputs required for reproduction, subject to existing privacy and retention policies.

Full evaluated candidate scores are retained long enough for offline comparison and rollout analysis. Aggregated metrics may outlive detailed decision records, but an active experiment may not discard its reproducibility inputs before its evaluation window closes.

## Failure Behavior

- A failed external scrape raises an internal freshness alert and never blocks serving.
- A missing source remains visible in evidence quality. Other sources may serve only when source-policy validity requirements pass.
- A well-supported major event with unresolved numerical disagreement raises an internal event discrepancy and increases the high-side safety bound; it does not invent a numerical multiplier.
- Before the canonical eligibility layer ships, an interim major-event recommendation hold protects the legacy path. The Phase 0 launch automation accepts only fresh official safety context. A serving-model trigger requires a new versioned trigger policy, focused tests, and separate implementation/release approval before it may create a hold policy record. QA-only evidence may alert an operator, who must separately authorize an audited hold record; the QA evidence itself never becomes policy state. The hold never changes displayed heights. For affected beginner, intermediate, and unknown-skill contexts, it removes exposed sessions from positive recommendations and returns explicit none when no separately vetted alternative remains.
- Missing or stale safety-critical beach data makes that candidate non-rankable.
- A canonical-engine failure does not fall back to a client-side scorer. Objective forecast browsing may remain available, while recommendation surfaces return a standard unavailable state.
- An expired decision cannot be rendered as current; the surface requests a replacement.
- An outcome event received twice is idempotent by decision, candidate, event type, and client event identity.

No failure path manufactures a positive recommendation.

## Evaluation And Promotion Gates

### Source gate

Evaluate NOAA/NWS, Open-Meteo, pinned GFS-Wave, and candidate reconciliation policies against correctly nearest-time-matched offshore observation revisions by region, horizon, direction, period, and event regime. Matching uses target-specific station-resolution snapshots, millisecond-precise deltas, and immutable source-record/value/QC identity. A terminal absence requires both the maturity delay and a successful station/source ingestion watermark covering the complete retrieval window; elapsed time alone is not observation completeness.

Candidate serving policies must beat the current policy on canonical identical-row units with both exact forecast revisions selected from one shared comparison capture manifest, one exact observation revision, and a statistically positive result with no material protected-segment regression. Existing GFS shadow thresholds remain the minimum for its target segment: `baseline MAE - candidate MAE` must be at least 0.02 m **and** at least 5% of baseline MAE, with the lower bound of a 95% paired interval above zero. Baseline MAE zero makes the relative test undefined and blocks the segment. A target segment needs at least 30 independent paired issue cycles, 500 matured aligned rows across at least five beaches, both sides of the 72-hour seam where relevant, and at least 95% expected capture coverage; every primary/protected segment also has a frozen minimum sample gate. Each side of a paired cycle key is a provider or explicitly approved inferred `(source, model, source_cycle_id)` tuple—retrievals and issuance identities are never substitutes. Uncertainty uses a reproducible two-way cluster bootstrap that independently resamples paired issue-cycle and station/region clusters and applies product weights. Reject a candidate if protected-segment MAE worsens by more than 0.02 m absolute **or** more than 5% relative; both guardrails must pass. Event-aware source policies additionally require at least three distinct cases from a hash-validated, multiply reviewed event registry. Calendar time alone never satisfies the gate.

### Event gate

The curated major-event regression corpus must have 100% event recall, including Elida and historical tropical cases. A frozen held-out subset is never used for threshold or feature tuning. The corpus also includes paired non-event and ordinary-swell fixtures so a detector cannot pass by labeling every disagreement as a major event. Arrival, peak, decay, direction, period, and false-event rate are scored separately. Live monitoring alerts whenever trusted evidence indicates a major event that the serving projection misses or materially undercalls.

### Beach-response gate

Beach breaking-height changes must improve independent face-height error, target high-side coverage, interval sharpness, and quantile loss or interval score versus the current transformation on identical evidence. Offshore buoy height cannot be the sole target. Ordinary conditions and major events are reported separately. No beach class, source, horizon, or ordinary-condition segment may materially regress without explicit approval.

### Eligibility gate

The skill, size, hazard, closure, daylight, tide, and missing-data matrix must produce zero known-ineligible recommendations. Property tests assert that adding preference, popularity, or quality points cannot change an ineligible candidate to eligible.

### Ranking gate

Before outcome volume is sufficient, the new engine must improve expert-reviewed top-session recall and `replay_regret` on replay fixtures without degrading the eligibility gate. The replay protocol freezes allowed issue-time evidence, requires independent labels before model output is revealed, uses at least two qualified reviewers, and resolves disagreement through a recorded third review or consensus adjudication. After attribution is healthy, promotion requires improvement in top-pick session success, call-wrong rate, and recommendation-attributed rating or wave quality. Online counterfactual regret is a gate only for an approved propensity-logged experiment; it may not be fabricated from ordinary one-session attribution.

### Product consistency gate

For identical decision IDs, web, native, home, map, beach detail, Week Scout, alerts, and surf-call messaging must agree 100% on selected beach, window, and explicit-none state. Presentation differences are allowed.

### Attribution gate

Generated and shown events must be captured for at least 95% of successfully rendered canonical recommendations before learned personalization is considered. A session launched from a recommendation must retain its decision linkage through completion and rating.

### Evaluation protocol

Primary source-policy segments, metrics, exclusion rules, and guardrails are frozen before promotion analysis. Source uncertainty is blocked or clustered by issue cycle and observation station or region wherever rows share underlying truth. Forecast-prefilled session data is non-independent in promotion reports and descriptive dashboards; it may never be counted as an observation merely because it was copied into a session record.

## Testing Strategy

Each layer has independent unit and characterization tests. Cross-layer tests use fixed issuance and user-context fixtures.

Required coverage includes:

- exact characterization of the legacy 72-hour policy before candidate policies are added;
- source freshness, disagreement, missing-source, and all-zero rejection;
- immutable issuance-revision tests for provider and parser corrections;
- evidence-class tests proving QA-only inputs cannot alter a serving event, projection, eligibility result, or rank;
- interim major-event hold tests for automatic approved evidence, audited manual policy records, mandatory expiry, replacement and cancellation, exposed beginner/intermediate/unknown-skill sessions, vetted protected alternatives, explicit none, stale caches, old native clients, alerts, and surf-call paths;
- Elida and historical event arrival, peak, and decay fixtures;
- exposed and protected beach projections from the same regional event;
- multi-swell interference, shadowing, tide, wind, and high-side bounds;
- beginner, intermediate, advanced, and expert eligibility matrices;
- invariants proving preferences cannot override safety;
- explicit no-recommendation behavior;
- full-window ranking rather than start-slot ranking;
- deterministic decision IDs, planning anchors, scope windows and timezone, canonical serialization, transactional dependency resolution, idempotent insertion, supersession lookup, and replayability;
- privacy and contract tests proving internal user context, reliability, high-side ranges, raw evidence, and full slates cannot appear in `CanonicalDecisionView`;
- contract tests preventing client-side reranking;
- legacy-envelope tests distinguishing server-selected and client-rendered candidates across inventoried authority paths;
- lifecycle event idempotency and provenance-aware outcome learning;
- representative live read-only traces before any forecast-serving promotion.

Relevant web and native E2E flows must assert the rendered decision ID and canonical selected session. Tests must fail if a client changes the beach, window, ordering, or explicit-none result.

## Rollout And Decomposition

This is a program-level destination design, not one implementation batch. Each phase receives its own design details, implementation plan, feature flags, tests, rollout gate, and rollback path.

### Phase 0: Safety, evidence, and trustworthy measurement

Phase 0 is four independently flaggable workstreams, not one implementation batch or pull request.

#### P0-A: Interim major-event recommendation hold

- Add the versioned hold record and operator control path.
- Add narrow automatic triggers from approved evidence and audited manual activation after QA alerts.
- Enforce holds centrally for beginner, intermediate, and unknown-skill contexts.
- Return explicit none unless a protected alternative passes separately approved safety criteria.
- Cover every current server, cache, alert, messaging, web, and native recommendation path.
- Provide independent enable, disable, expiry, replacement, cancellation, and emergency rollback controls.

P0-A ships first because it closes the live safety gap.

#### P0-B: Legacy decision envelope and attribution

- Inventory every current recommendation authority and client reranking path.
- Persist immutable legacy generation envelopes plus append-only rendered lifecycle events that distinguish server-selected from client-rendered candidates.
- Capture generated, shown, opened, and session-link events with idempotency and candidate-membership validation.
- Measure envelope coverage and cross-surface mismatches.
- Complete a privacy review for user-context snapshots and location-related events.

#### P0-C: Evidence restoration and source-policy boundary

- Execute the approved GFS-Wave capture and source-policy-boundary subdesign.
- Preserve immutable issuance revisions and candidate sources side by side.
- Add freshness, coverage, seam, and discrepancy monitoring.
- Characterize the existing 72-hour policy exactly and extract the pure policy boundary.
- Keep candidate policies shadow-only and verify zero writes into the display forecast path.

#### P0-D: Observation matching and trustworthy source scoring

- Correct nearest-time matching with target-specific station resolution, immutable observation revisions, millisecond time tolerance, maturity, ingestion-watermark completeness, and issue-cycle lineage.
- Persist atomic same-snapshot V1/V2 comparison artifacts.
- Compare candidates on canonical identical rows under frozen segment definitions and both exact forecast lineages.
- Use a reproducible two-way cluster bootstrap by issue cycle and station or region.
- Keep the real report blocked when the current NOAA/Open-Meteo baseline lacks immutable issuance lineage or the reviewed event registry is incomplete.
- Make no serving promotion in Phase 0.

Each workstream has independent flags and an exercised rollback. Disabling GFS capture cannot disable the hold. Disabling attribution cannot affect recommendations. Disabling automatic hold evaluation cannot remove an already effective audited hold without an explicit policy action.

Forecast serving and displayed physical heights remain unchanged. The only user-visible decision change permitted in Phase 0 is the conservative major-event hold returning no positive recommendation where the legacy system cannot establish a safe eligible choice.

#### Phase 0 completion gate

Phase 0 is complete only when:

- active holds prevent exposed positive recommendations for affected beginner, intermediate, and unknown-skill contexts across every covered surface;
- QA-only evidence has zero automatic effect on forecasts or recommendations;
- displayed physical heights remain unchanged;
- protected alternatives cannot bypass a hold without approved safety validation;
- at least 99% of enabled legacy recommendation generations persist an envelope, at least 95% of tracking-eligible rendered recommendations carry valid envelope and candidate IDs, and at least 95% of recommendation-originated sessions carry a valid session-link event;
- current cross-surface divergences are measurable;
- GFS-Wave capture is fresh, nonzero, and isolated from serving;
- the legacy 72-hour source policy is exactly characterized;
- observation matching passes millisecond, target-distance, completeness-watermark, atomic-comparison, and backlog-capacity fixtures;
- every workstream has an exercised rollback path;
- no low-confidence label or confidence-derived client behavior is introduced.

### Phase 1: Regional truth and event detection

- Build versioned event records and the event detector.
- Add the Elida and historical regression corpus.
- Shadow candidate source reconciliation policies.
- Retain the legacy serving projection until the source and event gates pass.

### Phase 2: Canonical beach response

- Consolidate offshore-to-breaking-wave projection behind one interface.
- Generate expected and high-side ranges with provenance.
- Validate against independent beach-level truth.
- Dual-run against existing display transforms without changing users initially.

### Phase 3: Canonical eligibility and ranking

- Enumerate all beach-window candidates.
- Add hard safety and suitability policy.
- Move existing validated beach-aware scoring primitives into one utility ranker.
- Return explicit no-recommendation results.
- Produce immutable internal canonical decision records and sanitized decision views in shadow.

### Phase 4: Surface migration

- Migrate one server and client surface at a time behind flags.
- Remove local reranking only after parity and consistency checks pass.
- Make canonical decisions authoritative for web, native, home, map, beach detail, Week Scout, alerts, and surf-call messaging.
- Retire legacy scoring authorities after rollback windows close.

### Phase 5: Outcome learning

- Validate lifecycle attribution and provenance.
- Establish deterministic policy baselines.
- Introduce conservative hierarchical personalization only after outcome gates pass.
- Shadow, canary, evaluate, and roll back learned residuals independently from safety and physical forecast layers.

The implementation strategy is a strangler migration around existing production paths, not a big-bang rewrite.

## Required Success Criteria

The refactor is not complete until:

- major swell events are never missed in the curated regression corpus;
- all users receive the same physical forecast for the same beach, time, and issuance;
- known unsafe recommendations are eliminated in the eligibility matrix;
- every surface renders the same result for the same decision ID;
- event arrival, peak, and beach breaking-height performance improve against appropriate truth sources;
- the engine returns no recommendation when nothing clears safety and utility thresholds;
- every decision is reproducible from immutable evidence, component versions, scope, and user context;
- recommendation-attributed outcome data is captured reliably;
- no user-facing low-confidence label is introduced.

## Explicit Non-Goals

- No direct serving from external forecaster pages.
- No `max(source)` policy, storm multiplier, or blanket beach-height increase.
- No personalization of physical wave height.
- No paid gating of safety or core suitability.
- No end-to-end learned recommender before attribution gates pass.
- No client-specific scoring or reranking.
- No user-facing low-confidence state.
- No revival of Seaside's retired correction layer as a shortcut.
- No big-bang replacement of every existing forecast and recommendation path.

## Final Architectural Invariant

For a given decision ID, there is exactly one physical forecast snapshot, one set of eligibility outcomes, one canonical ranking, and one selected recommendation or explicit none. Every Quiver surface presents that decision; none of them creates another one.
