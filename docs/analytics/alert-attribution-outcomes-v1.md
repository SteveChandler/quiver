# Alert attribution outcomes v1

Schema: `alert_attribution_outcomes.v1`. The unit is one sent message instance: a distinct non-null `alert_delivery_attempts.message_instance_id` with at least one `sent` row. Its first sent `attempted_at` anchors the complete local-day window `[start, end)`. Multiple rule rows and retries for the same channel and ID count once. Sent rows with no ID are reported separately and cannot enter attribution rates.

Push identity joins `message_instance_id = notification_events.id` and `user_id = recipient_user_id`; type is `notification_events.type`. Email identity joins `message_instance_id = email_send_log.message_instance_id` and `user_id`; type is `email_send_log.email_type`, with the route's `conditions_alert` fallback for a missing log. Missing or mismatched identity is counted as an unmatched delivery. Identity shared by different ledger users is flagged and excluded. Eligible types are push `forecast_alert`, `watched_call_update`, and identity-bearing `similarity_match`, plus email `conditions_alert`. Other identified types, including `daily_call`, are counted as not attributable by construction. NULL-ID sent rows have unknown type and appear under `deliveryCapability.withoutIdentityRows` as incapable of attribution; their historical type cannot be recovered from this ledger.

Interaction is an exact recipient and ID match: push `user_events.native_open_from_push` via the push telemetry loader and matcher; email `user_events.native_open_from_email`. The default interaction horizon is 72 hours after send. Stages come from `user_events` (`alert_message_activated`, `alert_app_returned`, `alert_return_to_decision`, `alert_decision_action`) and require recipient, message ID, and delivery channel to match. Stage outcomes use the seven-day interval from send through `asOf`. Wrong-channel stages count under `channelMismatch`. `missingAttribution` measures exact interactions without an activation stage. Provider `email_delivery_events` opens and `email_click_events` clicks are **raw** only, joined by `email_send_log_id` or `resend_message_id`; Apple Mail Privacy Protection and scanner traffic are not filtered. They never become an interaction or return.

`attributedReturnRate` uses D7-mature sent instances as its denominator. `returnToDecisionRate` and `decisionActionRate` divide by instances with an attributed app return. D1 and D7 return denominators require send plus 24 hours or seven days to be no later than `asOf`. `baselineActivityD1/D7` counts any recipient `MEANINGFUL_ACTIVITY_EVENTS` event in `(send, send + horizon]`, without attribution. An occasion groups a user's messages connected by shared `queue_id`; messages with no queue ID group by local send date and alert type. An occasion with both channels returning contributes one deduped outcome, assigned to the earliest returning channel. The occasion rate requires all member instances to be D7 mature.

Profiles are excluded using `loadProfileExclusions`, and excluded instance counts are reported by reason. `ttlFloor = asOf - 90 days` flags windows whose `user_events` may have expired. The report cannot recover attribution for NULL-ID sends, route-dropped stages, users without event consent, expired events, web opens, provider-only email opens, or actual device receipt. Delivery `sent` is a ledger outcome, not proof of receipt.

Run with Node 22, for example:

```bash
source ~/.nvm/nvm.sh && nvm use 22
npx tsx scripts/alert-attribution-outcomes-report.ts --start 2026-09-01 --end 2026-09-08 --tz America/Los_Angeles --as-of 2026-09-16T00:00:00Z --open-horizon-hours 72 --output-json /tmp/alert-attribution.json --output-md /tmp/alert-attribution.md
```

`--days N` replaces `--start` and `--end`. Without `--output-json`, JSON prints to stdout. Reads use the guarded read-only Supabase client.
