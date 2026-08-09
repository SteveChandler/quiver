# Phase 21: Multi-Forecaster Forecast Adjustment and Production Ingestion - Context

**Gathered:** 2026-07-27
**Status:** Ready for planning
**Source:** Approved user plan and follow-up coverage decisions

<domain>
## Phase Boundary

Replace the local 17-endpoint surf-forecast scraper with a production Seaside
job, normalize authorized human-authored surf calls into private immutable
issues, and apply bounded coverage-aware face-height adjustments in Quiver with
transactional attribution. This phase includes schema, ingestion, decision,
serving, privacy, verification, rollout, and retirement of the local launchd
job after production parity.

</domain>

<decisions>
## Implementation Decisions

### Source ingestion

- **D-01:** Production Seaside ingestion covers all 10 WaveCast regions plus the seven endpoints currently listed by `surf-forecast-ingestion`: NWS Hawaii SRF, Surf Institute PNW, Stormsurf PNW report links, Stormsurf PNW buoy forecast, Stormsurf NY shortcast, NJ Beach Cams reports, and The Surfers View NJ.
- **D-02:** Every source gets a source-specific parser. The existing generic relevant-line collector is evidence for research only and is not a production normalizer.
- **D-03:** A source without a parseable publication time, local valid date/window, unambiguous height basis, and valid surf range is rejected. `fetched_at` never substitutes for publication time.
- **D-04:** Ingestion runs every six hours with bounded transient retry and HTTPS redirect restrictions. Partial source success is persisted, but any enabled source failure makes the aggregate job unhealthy.

### Provider identity and evidence classes

- **D-05:** NJ Beach Cams and The Surfers View share one provider lineage and cannot count as independent votes.
- **D-06:** All Stormsurf endpoints share one provider lineage. Multiple endpoints cannot create multiple Stormsurf votes for one beach/day.
- **D-07:** Stormsurf's PNW buoy forecast is model or buoy evidence, not a human-authored face-height authority.
- **D-08:** Any source whose surf-height scale cannot be deterministically converted to breaking face-height feet remains evidence-only until a versioned conversion is approved and covered by fixtures.

### Coverage-aware authority

- **D-09:** Authority precedence is fresh compatible spot WaveCast, regional WaveCast, then the highest-priority validated regional authority when no fresh compatible WaveCast issue exists.
- **D-10:** A single valid configured authority activates immediately; universal two-source consensus is not required.
- **D-11:** Where independent authorities overlap, range separation above 1.00 ft blocks the adjustment and creates a durable alert. At or below 1.00 ft, the primary range remains unchanged and other providers are evidence only.
- **D-12:** Spot guidance supersedes regional guidance. Exposure compatibility is mandatory; NNW and SSW ranges are never unioned.
- **D-13:** There is exactly one decision per beach/local day and each forecast slot can be claimed by at most one decision.

### Adjustment behavior

- **D-14:** Compare the trusted local-day maximum range with Quiver's local-day maximum after base face transform, handoff blend, and beach offset.
- **D-15:** Inside-range and sub-0.50 ft discrepancies are no-ops. Magnitudes from 0.50 through 0.749 ft move 0.25 ft toward the range; magnitudes of 0.75 ft or greater move 0.50 ft toward the range. Preserve sign and cap at ±0.50 ft.
- **D-16:** Trusted adjustments apply only to snapshot-eligible forecast horizons from 0 through 168 hours.
- **D-17:** Session-feedback adjustment does not stack when a trusted forecast adjustment applies.

### Persistence and failure handling

- **D-18:** Normalized issues, decisions, applications, alerts, and build receipts are append-only. Existing `ml_predictions_log` snapshots remain first-write-wins.
- **D-19:** One database RPC atomically persists decisions, applications, alerts, new prediction snapshots, and a build receipt.
- **D-20:** The database recomputes SHA-256 from canonical payload content. A repeated build key is idempotent only when payload hash and exact durable counts match.
- **D-21:** A definite transactional rejection may serve baseline. After any transport-ambiguous persistence attempt, only a matching durable receipt may serve adjusted output; missing, mismatched, or unreadable receipt state returns a retriable forecast-generation error.
- **D-22:** Direct alert evidence mutation is forbidden. A service-role-only acknowledgement RPC may update only acknowledgement status, actor, and timestamp.

### Privacy, flags, and rollout

- **D-23:** Forecaster ranges, narratives, URLs, attribution, source hashes, parser metadata, provider evidence, and internal decision IDs remain absent from public APIs, UI payloads, and client analytics.
- **D-24:** Eligible ingestion and serving default enabled after deployment. Explicit `false` values remain independent immediate kill switches.
- **D-25:** Rollout order is schema, production Seaside ingestion, live parser and parity verification, Quiver serving, audit verification, then local launchd retirement.
- **D-26:** Database migration, production deploys, production writes, and local launchd removal remain explicit approval gates.

### the agent's Discretion

- Exact module boundaries, helper names, fixture organization, bounded retry
  timing, and code-level provider policy representation, provided every locked
  decision and requirement remains directly testable.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing trusted-adjustment draft

- `lib/services/forecast/trusted-forecast-adjustment.ts` — Current decision and persistence draft whose review findings must be corrected.
- `lib/services/forecast/forecast-builder.ts` — Active display-height construction and serving order.
- `supabase/migrations/20260727231500_create_trusted_external_forecast_adjustments.sql` — Current unapplied trusted-forecast schema draft.

### Production and local ingestion

- `/Users/stevenchandler/Desktop/dev/seaside/crons/fetch_wavecast_forecasts.py` — Current Seaside WaveCast-only production draft.
- `/Users/stevenchandler/Desktop/dev/surf-forecast-ingestion/ingest_forecasts.py` — Local 17-endpoint source inventory and generic evidence collector.
- `/Users/stevenchandler/Desktop/dev/surf-forecast-ingestion/README.md` — Current local schedule, output, and source behavior.

### Forecast architecture and safety

- `docs/archive/superpowers/specs/2026-07-17-canonical-session-decision-engine-design.md` — Forecast evidence classes, immutable lineage, and canonical decision direction. Phase 21's approved bounded-authority decisions supersede its earlier blanket QA-only treatment for specifically authorized normalized forecasters.
- `AGENTS.md` — Quiver repository workflow, verification, migration, and final-report requirements.
- `/Users/stevenchandler/Desktop/dev/seaside/AGENTS.md` — Seaside scheduler, database, testing, and production-safety requirements.

</canonical_refs>

<specifics>
## Specific Ideas

- Expected plan decomposition: production ingestion; immutable storage; coverage-aware decision engine; builder integration and privacy; verification and rollout.
- The latest local scheduled snapshot on 2026-07-26 captured 10/10 WaveCast regions, 7/7 additional endpoints, 208 normalized WaveCast rows, and zero HTTP failures. It did not normalize the seven additional sources.
- Coverage overlap is strongest in Hawaii and New York/New Jersey. Pacific Northwest sources extend beyond WaveCast coverage.

</specifics>

<deferred>
## Deferred Ideas

- Forecast horizons beyond 168 hours.
- Public display of external forecaster content or attribution.
- Model training, automatic calibration promotion, or session-feedback-derived height changes.
- New confidence UI or public disagreement labels.
- Additional providers not present in the current 17-endpoint inventory.

</deferred>

<scope_fence>
## Scope Fence

Phase 21 changes only private trusted-source ingestion, bounded physical
face-height adjustment, auditability, and operational rollout. It does not
redesign recommendation ranking, personalize physical surf height, train a new
forecast model, or redistribute third-party forecast content.

</scope_fence>

---

*Phase: 21-multi-forecaster-forecast-adjustment-and-production-ingestio*
*Context gathered: 2026-07-27 from approved user decisions*
