# Next bounded task: pre-session condition-output receipts

Status: proposed only. Do not implement as part of the correctness release.

## Objective

Preserve the actual condition output available before a session, rather than reconstructing it later from mutable forecasts and current code. Start with one existing surf-call response and its native Home consumer. No new predictions, scoring changes, dashboard, polling, ingestion service, or model platform.

## Reuse and scope

Trace the current surf-call handler through native `src/hooks/use-surf-call.ts`, Home's actual displayed selection, the existing impression writer, and the existing feedback/outbox path. Existing storage includes `recommendation_impressions`, `recommendation_session_contexts`, `forecast_feedback_contexts`, and `session_forecast_snapshots`. The feedback table already carries displayed/model/calibration/call contexts, request/correlation IDs, client source/version, schema/contract versions and audit metadata. Reuse that context vocabulary and the established authenticated, idempotent writes.

Do not manufacture feedback or reinterpret every impression as a served-response log. If no existing append-only request record can represent an output receipt without changing its meaning, add one small receipt table and link it from the existing impression/feedback mechanisms. Do not create a second event transport or general analytics system.

## Minimum receipt

- Immutable output: exact condition category, label, warning cause, decision and nullable frequency fields returned by that producer. Preserve unavailable/null output rather than manufacturing a call.
- Input provenance: exact representative forecast row/revision and values consumed, selected partition, source issuance/update times, beach ID, timezone, requested timestamp and complete relevant window. Include the actual beach configuration used, not just its mutable foreign key.
- Code/configuration provenance: deployed producer revision plus an immutable configuration snapshot or hash resolvable to retained content. A hash pointing to unavailable historical content is insufficient.
- Identity and timing: existing request/correlation or recommendation ID, server-generated timestamp, response-assembly/serve timestamp, capture timestamp, receipt schema version, and retention policy. Use server-established facts; keep client-reported times distinct.
- Observation linkage: session ID and origin metadata for the specific submitted fields. Join only within authorized user/beach/window scope. Never rewrite the receipt from a later forecast fetch or a session edit.

## Generated, served and displayed are different evidence

1. `generated`: producer computed the output. This alone proves neither transport nor display.
2. `served`: handler emitted the response containing that output. This is not proof that the client received or rendered it. Do not label response assembly as confirmed network delivery.
3. `displayed`: the existing client presentation/impression mechanism acknowledges the exact receipt ID and final selected beach/window after that output is rendered. Merely fetching, preloading, caching or receiving a response must not emit this acknowledgement. It is evidence of rendering, not proof of human attention.

Keep absent acknowledgements unknown. Account for Home's current-call translation: a server receipt is not the displayed output if the client changes it. Capture the final rendered output and client revision in the existing acknowledgement, or explicitly mark display equivalence unestablished. Do not remove that translation or change physical rules in this task.

For historical evaluation, require independently retained pre-session evidence. A client acknowledgement uploaded after the session with an earlier client clock is not sufficient by itself. Preserve late uploads, cache age, time offsets, outbox retries and receipt timing as separate provenance classes. Do not retroactively promote the frozen retrospective cases.

## Separate minimal compatible observation-provenance patch

The current correction's confirmation marker survives local drafts, but not the session insert/outbox payload, session row or snapshot actuals. `sessions.source` is title/test-source classification, not observation origin. Optional feedback contexts do not cover every session or establish origin per tag. Older installed clients can continue sending prefilled tags after release. Wave height also still accepts a clearly labelled forecast estimate and stores it in `wave_height_ft`; that value is not necessarily an independent observation.

Propose one nullable additive `sessions.observation_provenance` JSON field, with a small versioned schema. Record per-field origin, including characteristics and height: explicit manual selection, explicitly confirmed restored choices, forecast estimate, omitted, or unknown. Include client source, app version/build and OTA/code identity when available, with a server receipt time. Treat client-supplied provenance as a client assertion, not independently attested ground truth.

Carry it through the existing payload, durable outbox, create/edit paths and snapshot synchronization. Preserve provenance on unrelated edits; changed observations without matching new provenance must become unknown, not inherit an earlier manual certification. Old clients remain compatible because the field is optional. Missing provenance stays unknown. Do not backfill origin from release date, `source`, a matching tag value, or an old touched-field marker.

## Small acceptance gate

- One generated/served receipt remains byte-stable after forecast/config changes; an output without a client acknowledgement is not called displayed.
- One real native render acknowledges the exact receipt and final beach/window/output; prefetch alone does not. Mismatched or withheld output cannot acknowledge a different call.
- One pre-session receipt links to a later explicit observation without a post-session replay becoming historical prediction evidence.
- Retried capture/acknowledgement creates no duplicate logical receipt; offline/late acknowledgement retains its weaker timing evidence.
- Old-client create/edit, new manual selection, confirmed draft and omission preserve the intended origin without certifying legacy rows.
- Ownership/RLS, retention, privacy and loopback-only write tests apply. No production mutation without separate approval.

Deliver a small evaluated patch and a few traceable fixtures, not an accuracy claim. Physical prediction evaluation begins only after this capture mechanism supplies suitable cases and separately approved targets.
