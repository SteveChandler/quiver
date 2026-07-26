# Android Install Attribution Runbook

## Contract

The `/android-beta` acquisition path keeps Google Group membership, closed-test
opt-in, attributed install, first open, and authenticated join as separate
evidence stages. After the existing handoff is unlocked, the page requests a
30-day link from `POST /api/install-attribution/issue`. The Play URL contains
only a 32-byte base64url token as its `referrer`.

The server stores only the token's SHA-256 hash. The referrer contains no email
address, Quiver or Google user ID, native install ID, coordinate, precise
timestamp, arbitrary UTM value, IP address, or user agent, and redemption
returns lifecycle dates only. Token lifecycle and audit rows retain exact
server timestamps for expiry, replay protection, and operations, but those
timestamps are not tied to PII, a device, or an account identity.

Native redeems through `POST /api/install-attribution/redeem` with:

```json
{
  "token": "<43-character base64url token>",
  "redemptionId": "<43-character base64url retry key>"
}
```

`redemptionId` is a cryptographically random retry key for this redemption,
not a native install identifier. Native must persist it before the first
request and reuse it after a timeout or lost response.

Successful responses use:

```json
{
  "outcome": "attributed",
  "retryable": false,
  "attribution": {
    "source": "landing_hero",
    "surface": "landing-page",
    "placement": "hero_primary",
    "campaign": "app_first_v1",
    "createdOn": "2026-07-25",
    "expiresOn": "2026-08-24"
  }
}
```

Unknown, malformed, expired, or different-key replay responses are HTTP 200
with `outcome: "unattributed_terminal"`. Transient resolution failures are HTTP
200 with `outcome: "unattributed_retryable"`. The static rate limiter may
return 429; native treats it as retryable and never blocks launch. Every route
and Next header path is `private, no-store, no-cache, must-revalidate`.

## Analytics and identity

Web and native both identify PostHog people with the Supabase Auth user ID:
web uses `identifyPostHogUser(user.id)` and native uses the same `user.id`
through its PostHog bridge. The durable authenticated join event is
`native_install_attribution_joined`; it is not anonymous-allowed or pre-auth.
Its metadata is limited to source, surface, placement, campaign, created-on,
expires-on, attribution outcome, and the existing native install ID.

Use this implemented funnel:

1. `android_waitlist_cta_click`
2. `android_install_cta_click`
3. `native_app_first_open`
4. `native_install_attribution_joined`
5. `first_session_logged`

`app_handoff_link_opened` remains an implemented route event, but it has not
been observed in live PostHog and must not be used as rollout evidence until
production telemetry confirms it.

## Rollout

1. Review `20260725200000_create_install_attribution_tokens.sql`.
2. Obtain migration approval under `docs/MIGRATION_SAFETY.md`; back up first.
3. Apply the migration through the tracked production owner connection.
4. Regenerate `types/database.generated.ts` from the applied schema.
5. Deploy web issue/redeem routes and the Android handoff together.
6. Validate the browser flow and Android simulator contract.
7. Set `INSTALL_ATTRIBUTION_REDEMPTION_ENABLED=true` and validate redemption
   independently.
8. Release the native Install Referrer build and monitor production outcomes.
9. In a separate approval, set
   `INSTALL_ATTRIBUTION_ISSUANCE_ENABLED=true` for the internal cohort.
10. Expand issuance only after the internal observation window passes.

Both controls default off:

```text
INSTALL_ATTRIBUTION_ISSUANCE_ENABLED=false
INSTALL_ATTRIBUTION_REDEMPTION_ENABLED=false
```

Issuance-off creates no token or audit row and gives the Android CTA the
ordinary Play listing. Existing tokens remain redeemable while redemption is
enabled. Redemption-off returns `unattributed_retryable` before creating a
service-role client or calling the consume RPC, so it cannot consume, expire,
or terminally mutate a token.

Do not apply the migration, change either production control, or deploy from a
feature branch without the corresponding explicit approval.

## Rollback

1. Set `INSTALL_ATTRIBUTION_ISSUANCE_ENABLED=false`.
2. Keep redemption enabled until either the 30-day token lifetime passes or the
   monitoring query reports zero live tokens.
3. Set `INSTALL_ATTRIBUTION_REDEMPTION_ENABLED=false`.

Do not reverse steps 1 and 3. Disabling redemption first strands issued tokens
and prevents the required drain.

## Monitoring

The audit contains only a 12-character token-hash prefix, action, outcome, and
server timestamp. It intentionally excludes IP, user agent, auth identity, and
device identity.

```sql
SELECT
  date_trunc('hour', created_at) AS hour,
  action,
  outcome,
  count(*) AS attempts
FROM public.install_attribution_audit
WHERE created_at >= now() - interval '24 hours'
GROUP BY 1, 2, 3
ORDER BY 1 DESC, 2, 3;
```

```sql
SELECT
  count(*) FILTER (WHERE consumed_at IS NULL AND expires_at > now()) AS live,
  count(*) FILTER (WHERE consumed_at IS NOT NULL) AS consumed,
  count(*) FILTER (WHERE consumed_at IS NULL AND expires_at <= now()) AS expired
FROM public.install_attribution_tokens;
```

Alert when redemption `unavailable` exceeds 10% over an hour with at least 20
attempts, when issue-route 5xx exceeds 2%, or when
`native_install_attribution_joined` disappears while
`android_install_cta_click` continues. Simulator validation plus production
monitoring is the normal release gate; use a physical device only for a defect
that the simulator and production telemetry cannot represent.

## Retention

Expired unconsumed rows and consumed rows older than the approved analytics
retention window may be deleted by a separately reviewed cleanup change. This
migration intentionally creates no unapproved production cron or destructive
operation.
