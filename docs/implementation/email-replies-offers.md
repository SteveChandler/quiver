# Email replies and offers

## Reply check

Lifecycle sending performs one bounded, on-demand Gmail metadata check after
eligibility refresh and before the first dispatch. It runs only when at least
one lifecycle candidate is due. Configure a Gmail filter for `To:
support@quiversurf.app`, apply the `quiver-support` label, and tick “Never send
it to Spam”. Set `EMAIL_GMAIL_REPLY_LABEL` to that user-label name.

The check resolves the label case-insensitively, then calls
`users/me/messages` with that label and `maxResults=100`, follows at most three
pages, and examines only the newest 300 labelled messages. It filters known
message IDs through `gmail_reply_known(text[])`, fetches metadata only, and records matching replies through
`record_gmail_reply_v2`. A message deleted between search and metadata fetch is
skipped at debug level. No cursor, history ID, lease, gap table, or independent
minute cron remains.

The lifecycle run summary always includes `reply_check`:

```json
{ "status": "skipped" | "ok" | "failed", "checked": 0, "recorded": 0 }
```

`failed` also includes a sanitized `reason`; the run is marked `error`, Sentry
records warning fingerprint `email-reply-check-failed`, and no message is sent.
The admin endpoint `POST /api/admin/email/replies/sync` invokes the same manual
check. It is not scheduled independently.

## Offers

The approved offer rules remain unchanged: five distinct completed sessions can
earn one month of promotional Pro access, while manually selected falling-off
recipients can earn three months. Awards remain account-bound, non-stacking,
fixed-expiry rights with service-role-only issuance and reconciliation.

## Operator environment contract

Still required for the on-demand check:

- `EMAIL_GMAIL_ACCOUNT`
- `EMAIL_REPLY_MAILBOX`
- `EMAIL_GMAIL_CLIENT_ID`
- `EMAIL_GMAIL_CLIENT_SECRET`
- `EMAIL_GMAIL_REFRESH_TOKEN`
- `EMAIL_GMAIL_REPLY_LABEL` (defaults to `quiver-support`)

The OAuth refresh token needs only the `https://www.googleapis.com/auth/gmail.metadata`
scope.

Now unused and removed: `EMAIL_GMAIL_REPLY_SYNC_ENABLED` and
`EMAIL_REPLY_INGESTION_VERIFIED`.

The Gmail credential is read-only OAuth. No production OAuth, mailbox, offer,
database, deployment, or schedule change is implied by this document.
