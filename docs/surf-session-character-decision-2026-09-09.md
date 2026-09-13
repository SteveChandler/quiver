# Surf-session character: follow-up decision

**Decision:** the correctness fixes are ready for operator code review, not deployment approval. Do not broaden the closeout threshold or adopt the tested stored-period substitution. No predictive improvement is claimed. Production was not changed.

## Additional evidence recovered

All 49 notes were individually reviewed against their complete wording. Of the 26 previously unparsed notes, 15 yielded additional evidence: nine unambiguous observations and six explicitly ambiguous descriptions. The remaining 11 contain satisfaction, skill, equipment, or catch-success commentary without an additional physical discriminator. Catch counts were not turned into opportunity rates.

Corrections include the negative meaning of "opposite of clean," weakness **before** the reported 8:45 size increase, and distinguishing late steepening of an individual wave from change over a session. Relative weakness, usable sections, high-tide observations, and location-specific current/shorebreak context were retained without inventing measurements. The original extraction remains frozen; the [reviewed observation ledger](/Users/stevenchandler/Desktop/dev/.quiver/local-evidence/surf-session-character-20260908/audit/manual-review.private.json) contains source hashes, spans, scope, timing, and individual rationales for all 49 notes. It is private, not a publishing artifact.

The [individual diagnostic traces](/Users/stevenchandler/Desktop/dev/.quiver/local-evidence/surf-session-character-20260908/followup/case-traces.private.md) cover all 14 requested closeout cases, six barrel cases, three lull cases, and 30 original B-class power cases, plus one newly recovered B-class power observation: **37 unique cases**, not the sum of those overlapping groups. Each trace includes raw and converted inputs, current beach configuration, actual rule gates/subscores/output, observations, and unresolved causes. C-class observations remain labeled separately.

## What explains the cases

| Dimension | Finding |
| --- | --- |
| Closeouts | All 14 have finite rule inputs, heights of **2.0-5.2 ft**, and tides above the rule's low-tide criterion. Thus every case fails both the 6-foot and low-tide gates. Four also fail the beach-break gate, six the 10-second gate, and seven the falling-tide gate. These failures overlap. The existing heavy/dropping-low warning is simply not a general closeout predictor. |
| Input/configuration validity | All 14 have populated break type and raw tide height. Point/reef/jetty classifications explain four type exclusions; changing those classifications would still leave the height/tide exclusions. Current partition selection changes the stored period in **10/14** cases. This is a current-code reinterpretation, not evidence of the code or configuration deployed at surf time. |
| Barrels | Six B cases span 1.3-5.8-foot inputs and point, reef, and beach configurations. Two also carry closeout tags. Occurrence does not establish an open exit, ride completion, or makeability; none of the notes supplies that missing target. |
| Lulls | The three B cases report long waits, good waves every 10-15 minutes, and set waves after 20+ minutes. The retained legacy heuristic returns respectively **60, 55, and 60 waves/hour**, with a 60-second beat interval in all three. Their saved slots are 65, 15, and 90 minutes before arrival, so these are diagnostic disagreements, not measured historical errors. The contrary "constant sets" case gets zero from the height gate, but its slot also precedes arrival. Carrier periods, worthwhile waves, set arrivals, and surfer catches are different targets. |
| Power/takeoff | Thirty-one B cases now have usable power evidence. Six have explicit strong/weak note wording suitable for a narrow component comparison; only three have slots inside the session. Two of those three have the same 17-second dominant period but opposite strong/weak observations. Fat, mushy, steep, and powerful tags can coexist across phases and are not automatically contradictory. |

The detailed traces also flag a rivermouth observation matched to a pier configuration and every hourly slot outside the actual session interval. B certifies input vintage, not exact local applicability. **No recovered case contains a trusted historical delivered prediction, and none of these traces represents a full-session forecast.**

## Offline candidate and strongest opportunity

The period discrepancies justified an **offline input-source sensitivity check**, not a new forecasting rule: retain the existing 10-second energy proxy and substitute stored period for the current dominant-partition period on identical records. Against six explicit B-class strong/weak notes, the current proxy has four compatible and two contrary outcomes; stored-period substitution has zero compatible, five contrary, and one missing-input outcome. Restricting to the three in-session slots gives two compatible/one contrary versus zero compatible/two contrary/one unavailable.

**Reject the substitution.** These are component-level compatibility checks, not scores for the complete forecast classifier. The earlier/later split is 2/4 observations, shares users, and is retrospective, not a blind held-out set. All notes were inspected; no parameters were fitted and no generalization claim is warranted. The [offline replay](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/surf-session-character-20260908/scripts/analysis/surf-session-character-followup.ts) is runnable and keeps the full original classifier output alongside the component probe.

The strongest physical-model opportunity is **ordinary-height breaking-shape discrimination**, separate from wind texture and the existing heavy-surf safety rule. The precise missing discriminators are:

- **Closeouts versus usable sections:** breaking section/peak, local bar or reef depth and orientation, and crest spreading/peel geometry. A beach-wide tide height and categorical break type cannot distinguish the reported nearshore closeout from a fat, nonbreaking peak in the same session.
- **Power versus weak push:** face height/steepness at the actual takeoff and which partition is breaking there. Offshore period alone does not resolve the opposing 17-second reports; changing period source worsened this limited check.
- **Set waits versus background waves:** a defined event target and independently timed local set/envelope arrivals aligned with the session. The available carrier periods do not supply this discriminator, and the quantitative wait examples do not have simultaneous saved slots.
- **Barrels versus makeable barrels:** exit/ride-completion evidence and local opening/peel geometry. Six occurrence tags cannot answer makeability.

No additional physical-prediction candidate is supported for implementation from these records. This is a specific identifiability limit, not a request to label every missing observation negative or to lower thresholds until the sample fits.

## Local fixes ready for review

- Forecast hints remain unselected until tapped. Unknown-origin drafts now **retain** their choices, show a confirmation control, and cannot submit or emit confirmed-condition feedback until confirmed or edited. The marker survives draft persistence and time/beach changes; known manual selections remain intact.
- Native warning reuse now requires a matching beach/date, selected time, displayed interval, and available alignment metadata. Unlocated or mismatched holds return no call rather than becoming a different beach/time warning or a fabricated positive call.
- Snapshot synchronization binds session owner **and beach**, rejects reassignment, and revokes explicit anonymous/authenticated/service-role trigger-function grants as well as PUBLIC access. Trigger relation identity is checked. This closes an owner-only-policy loophole demonstrated before the migration in the isolated database.
- Existing nullable frequency/wait outputs remain withheld. No replacement qualitative frequency claim was introduced. **Legacy scored-API numeric retirement remains a separate contract task; that endpoint was not changed.**

## Verification and remaining limits

The isolated clone contains **167 public tables and 317 policies** from the existing local full application schema, not minimal mock tables. Full-schema tests passed for 100-row representative backfill, owner/anonymous RLS, cross-owner/wrong-beach insertion and reassignment, explicit clearing, actual completed-session writer interaction, and byte-equivalent saved forecast JSON/creation timestamps after source forecast revision. All session triggers remained active. Platform-only restore exceptions and exact commands are documented in the [verification ledger](/Users/stevenchandler/Desktop/dev/.quiver/local-evidence/surf-session-character-20260908/followup/verification.md); this does not claim schema parity with production.

Focused web component/domain checks passed (273 tests). Native checks passed, including actual mocked save payloads for untouched hints, manual selections, and unknown-origin drafts. Nullable home/beach-card rendering and installed API contracts were exercised. Base/current lint comparisons are **4/4 web warnings and 44/44 native warnings**, with no new normalized findings. Dead-code comparison is **1,487/1,487 normalized findings**, with no additions or removals. Existing gate failures remain visible rather than being called clean.

Native device/pixel-layout checks and a real network end-to-end save were **not run**: no simulator was booted, and the existing Maestro session flow targets production. Renderer/save-flow tests are not device E2E. These remain release checks, alongside production-scale migration locking and a current staging-schema comparison. No source weights, physical thresholds, production data, or release state changed.
