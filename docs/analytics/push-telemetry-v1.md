# Push telemetry v1

Schema: `push_telemetry.v1`. The unit is one `notification_events.id` with at least one push attempt. A message enters the report when its **first** `notification_delivery_attempts` push row has `created_at` in the complete local-day window `[start, end)`. All push rows for that ID through `asOf` resolve its final status, ordered by `created_at`, then `id`. A deferred row followed by a sent row counts once as provider accepted. `attempt_number` does not order the rows.

The report uses `loadProfileExclusions` on `recipient_user_id`; excluded messages are counted by reason and removed from the stages. It includes `window`, `asOf`, and maximum observed timestamps in `sourceFreshness`. `ttlFloor` is `asOf` minus 90 days; `windowStartsBeforeTtlFloor` flags when expiring `user_events` can make historical signals incomplete.

## Stages and joins

1. `messages`: distinct anchored notification events after exclusions.
2. `finalOutcome`: final push row `sent` → `provider_accepted`; `failed_provider` or `failed_internal` → `provider_failed`; `skipped_*` → `skipped` with status detail; final `deferred_quiet_hours` → `deferred_unresolved`.
3. `attempted`: accepted plus failed messages. `providerAccepted` counts `sent` messages. `tokenOutcomes` sums `provider_response.success`, `failed`, and `invalidTokenCount` (or `invalidTokens.length`) from final rows. These are token counts; stages count messages.
4. `deviceReceipt`: not captured. Expo receipts are never fetched and ticket IDs are discarded. Expo/FCM acceptance does not establish device delivery.
5. `opened`: exact `user_events.native_open_from_push` metadata `notification_event_id` (falling back to `message_instance_id`) = message ID, `user_id` = recipient, and `created_at` in `[first attempt, first attempt + open horizon)`. The denominator is provider-accepted messages with a fully elapsed open horizon; immature accepted messages and their observed opens are separate. `openUserMismatch` counts matching IDs with a different user in the horizon. `orphanOpens` counts opens created in the window whose ID has no push attempt through `asOf`, grouped by `notification_type`. `pushDrivenAppReturn` is the same tap. `anyActivityWithinHorizon` is a **baseline, not attributed**: a recipient `user_events` row in `MEANINGFUL_ACTIVITY_EVENTS` after the first attempt and through the open horizon.
6. `decisionAfterOpen`: one of `decision_loop_completed`, `beach_view`, `forecast_interaction`, `home_nearby_spot_tap`, `watch_spot_tapped`, `alert_rule_created`, or `session_log_start` for the same user after the matched open and within the decision horizon. Its denominator contains opens with a fully elapsed decision horizon; immature opens are separate. `serverStages` counts messages with each exact `alert_*` stage where metadata `message_instance_id` = message ID and `delivery_channel` = `push`. Only `forecast_alert` and `watched_call_update` can produce these server stages.

Each stage is broken down by the active iOS/Android platform set at the first attempt (`ios_only`, `android_only`, `mixed`, `none_active`), last stored registration or permission-denial signal strictly before the attempt, notification type, and platform set × type. Web-only devices fall into `none_active` because that label describes the native iOS/Android set. Android delivery is exact only for `android_only` recipients; mixed recipients' tokens cannot be split by platform because provider responses store counts rather than per-token outcomes. Opens are also grouped by their `_platform` metadata. A registration or denial signal is historical evidence, not current OS permission; no current permission state or permission-enabled device count is stored. `registeredDevices` is an active-device snapshot at `window.end` among non-excluded users.

The `legacy` counts use the same window: `allChannelAttemptRows` includes every channel and recipient, `sentPushEventIds` counts distinct non-excluded IDs with a push sent row, and `alertLedgerSentPushMessageInstances` counts distinct non-null non-excluded sent push message IDs from `alert_delivery_attempts` and how many exist in `notification_events`. The alert ledger is per rule and covers only some push messages. `notification_delivery_targets` is not used for any stage; its row count appears only in `sourceFreshness`.

## Run

Use Node 22. The runner uses the read-only Supabase guard and performs no writes to production.

```bash
source ~/.nvm/nvm.sh && nvm use 22
npx tsx scripts/push-telemetry-report.ts --start 2026-09-01 --end 2026-09-08 --tz America/Los_Angeles --as-of 2026-09-10T00:00:00Z --output-json /tmp/push-telemetry.json --output-md /tmp/push-telemetry.md
```

Use `--days N` instead of `--start`/`--end` for the latest complete local days. Defaults: seven days, `America/Los_Angeles`, 24-hour open horizon, 60-minute decision horizon, current time for `asOf`. Without `--output-json`, JSON is printed to stdout. Rates are represented by numerator, denominator, and rate; empty denominators have a null rate.
