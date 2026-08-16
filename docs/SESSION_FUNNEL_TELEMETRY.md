# Session Funnel Telemetry Contract

Status: Active

Last updated: 2026-08-12

This is the current contract for session-log funnel telemetry. Historical
reports and design documents remain useful context, but this document is the
source of truth for event correlation fields and verification rules.

## Canonical funnel

The report measures the ordered path:

```text
start -> form_view -> submit -> persisted_session
```

An attempt is keyed by `(user_events.user_id, metadata.flow_id)`. Events from
different attempts must not be stitched together by user or timestamp alone.
The top-level `user_events.session_id` is anonymous-browser attribution; it is
not the persisted surf-session join key.

The persisted-session join uses:

1. `session_log_submit.metadata.session_id`;
2. the matching `sessions.id`;
3. the same session owner;
4. a completed, non-deleted session row.

`first_session_logged` is database-truth telemetry coverage for a first saved
session. It is not a substitute for `session_log_submit` and does not advance
the canonical funnel.

## Correlation metadata

All current web session-form funnel events use the following shared metadata:

| Field | Meaning | Requirement |
| --- | --- | --- |
| `flow_id` | Stable ID for one form attempt | Required for canonical joins |
| `client_stage_at` | ISO timestamp captured at the client stage | Used for stage ordering |
| `schema_version` | Funnel metadata contract version | Currently `1` |
| `event_id` | Stable event ID for deduplication | Present on web start, beach selection, and submit |
| `session_id` | Persisted `sessions.id` | Required on successful submit |

Validation metadata supports `validation_errors` as an array,
`validation_error_count`, and `validation_first_field`. Native validation
events currently emit the array. The web form does not currently emit a
`session_log_validation_failed` event because its save gate prevents the
submission callback until the required fields are present.

## Platform coverage

| Platform | Current behavior |
| --- | --- |
| Web `SessionScrollForm` | Generates one flow ID per form, correlates start/beach/rating/photo/abandon/fit events, and emits a Supabase submit event with the persisted session ID |
| Native `SessionForm` | Already emits flow ID, client stage time, event ID, validation arrays, and persisted session correlation through the native durable analytics path |
| Legacy browser location callback | Retains the browser analytics start event and now carries the active flow ID when available |

The web and native events may be compared in aggregate, but canonical
attempt-level conversion should only include rows that satisfy the full
correlation contract.

## Event delivery and deduplication

Web `session_log_submit` is sent to the internal `/api/events` path with
`debounceMs: 0` after the session action returns the persisted ID. The browser
analytics copy is retained for existing analytics consumers; the internal
Supabase event is the source for exact funnel joins.

Canonical reports deduplicate events with a non-empty `event_id` at
`(event_type, event_id)` grain. Conflicting copies are excluded from canonical
measurement and counted as a data-quality finding. Rows without stable IDs
remain visible as coverage gaps and are not silently treated as duplicates.

## Verification after release

After the web build is deployed, run the read-only session acquisition report
and confirm at least one real-user web flow has:

- the same non-empty `flow_id` on start and submit;
- valid nondecreasing `client_stage_at` values;
- a submit `metadata.session_id` that matches `sessions.id` for that user;
- no duplicate or conflicting `event_id` groups.

Use the report and its saved-artifact validator rather than manually joining
raw identifiers into a report. Keep raw user, flow, event, and session IDs out
of Markdown, JSON evidence, and operator handoffs.

## Code ownership

- Web flow state: `hooks/use-session-form.ts`
- Web event metadata: `lib/analytics/session-log-funnel.ts`
- Web form events: `components/session-forms/SessionScrollForm.tsx`
- Legacy location event: `components/session-forms/LocationStep.tsx`
- Persisted web submit: `app/sessions/new/useSessionSubmission.ts`
- Shared metadata types: `types/implicit-preferences.ts`
- Canonical report: `scripts/session-acquisition-funnel-report.ts`
