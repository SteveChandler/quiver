# Session Created North-Star Contract

## Decision

Add one canonical event: `session_created`.

No existing web event is universal for "a real `sessions` row was inserted." `session_log_submit` is partial and overloaded: it fires after standard web session saves and after conditions-report session backfills, while the client also emits it as submit/success telemetry. `first_session_logged` is a milestone threshold, not a per-insert event. `session_log` is not an accepted `user_events` event in web code; it appears only as a launch-campaign destination label for `/sessions` routes.

`session_created` is the only north-star logged-session event. Intent, funnel, CTA, selected, abandon, and milestone events never count as logged sessions.

## Existing Session Taxonomy

| Event | Fires Here | Counts As North-Star |
| --- | --- | --- |
| `session_created` | `actions/session-actions.ts` after `sessions.insert`; `actions/conditions-report-actions.ts` after conditions-report `sessions.insert` | Yes |
| `session_log_submit` | Server-side `actions/session-actions.ts`; server-side `actions/conditions-report-actions.ts`; client-side `app/sessions/new/useSessionSubmission.ts` after successful action | No |
| `first_session_logged` | Web milestone detection in `lib/services/personalization-milestone-service.ts` when session count reaches 1; historical/native `user_events` rows may exist | No |
| `session_log` | No web event emitter; `lib/analytics/launch-campaign.ts` destination label only | No |
| `session_log_start` | `components/session-forms/SessionScrollForm.tsx`; `components/session-forms/LocationStep.tsx` | No |
| `session_log_beach_selected` | `components/session-forms/SessionScrollForm.tsx` | No |
| `session_log_rating_set` | `components/session-forms/SessionScrollForm.tsx` | No |
| `session_log_photo_added` | `components/session-forms/SessionScrollForm.tsx` | No |
| `session_log_abandon` | `components/session-forms/SessionScrollForm.tsx` on unmount/cancel | No |
| `session_share_opened_post_save` | `app/sessions/new/useSessionSubmission.ts` | No |
| `session_share_closed_post_save` | `app/sessions/new/useSessionSubmission.ts` | No |
| `session_log_from_intel` | `components/intel/intel-tab-simple.tsx`; external analytics only | No |
| `plan_session_from_intel` | Declared in taxonomy; no web emitter found | No |
| `home_first_session_cta_tap` | Declared in taxonomy; no web emitter found | No |
| `session_action` | Declared as generic engagement taxonomy; no specific web emitter found | No |
| `session_log_draft_opened` | Declared in taxonomy; no web emitter found | No |
| `session_log_time_selected` | Declared in taxonomy; no web emitter found | No |
| `session_log_draft_progress` | Declared in taxonomy; no web emitter found | No |
| `session_log_conditions_set` | Declared in web taxonomy; current production notes identify native as intended emitter | No |
| `session_log_validation_failed` | Accepted by `/api/events`; no current web emitter found in source | No |
| `session_spot_search_no_results` | Declared in taxonomy; no web emitter found | No |
| `session_custom_spot_cta_tapped` | Accepted by `/api/events`; E2E covers persistence; no session insert | No |
| `session_custom_spot_returned` | Declared in taxonomy; no web emitter found | No |
| `session_photo_upload_started` | Declared in taxonomy for native/upload observability | No |
| `session_photo_upload_succeeded` | Declared in taxonomy for native/upload observability | No |
| `session_photo_upload_failed` | Declared in taxonomy for native/upload observability | No |
| `session_board_fit_feedback_selected` | Session-form board fit feedback telemetry | No |
| `session_decomposition_selected` | Match-feature/session-intelligence selection telemetry | No |

## Web Instrumentation

`session_created` is emitted only after the `sessions` insert succeeds.

Paths covered in this web slice:

| Source | Surface | Insert Path |
| --- | --- | --- |
| `web-session-form` | `sessions/new` | `actions/session-actions.ts:createLoggedSession` |
| `web-conditions-report` | `conditions-report` | `actions/conditions-report-actions.ts:submitConditionsReport` |

Excluded before emit: profiles with `is_mock=true`, `is_system_account=true`, `analytics_is_real_user=false`, or `deleted_at` set. Existing `session_log_submit` and funnel events remain unchanged for continuity.

## Event Contract

Storage source: `public.user_events`, importable to PostHog via `scripts/import-posthog-history.ts` with `$insert_id=supabase_user_events:<row.id>`.

Event:

```json
{
  "event_type": "session_created",
  "user_id": "<authenticated user id>",
  "beach_id": "<beach id or null>",
  "metadata": {
    "source": "web-session-form | web-conditions-report | native-*",
    "surface": "sessions/new | conditions-report | native-*",
    "is_first_session": true,
    "spot_type": "beach | custom",
    "user_id": "<authenticated user id>",
    "session_id": "<sessions.id>"
  }
}
```

Native is deferred: `quiver-native` direct PostgREST session inserts and device verification are a follow-up slice. Native must emit the same `session_created` contract after its `sessions` insert succeeds.

## Dashboard Metrics

All metrics filter to `event_type = 'session_created'` and exclude mock/internal users by construction. Break down every metric by `metadata.source` and optionally `metadata.surface`.

| Metric | Definition |
| --- | --- |
| Daily logged sessions | Count `session_created` events by day. |
| Activation / first-session | Count distinct users where `metadata.is_first_session = true`; conversion denominator is signed-up real users. |
| Repeat >=3 / 21d | Count distinct users with at least 3 `session_created` events in a rolling 21-day window. |
| Time-to-first-session | For each real user, first `session_created.created_at - profiles.created_at`; report median and p75 by signup cohort and source. |
