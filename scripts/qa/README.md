# Reusable Quiver QA accounts

One local registry, eight reusable confirmed logins. These are separate from the existing parallel-browser worker pool so manual resets cannot overwrite its baseline. No inbox creation or production credentials required. Implemented in the web repo; the generated environment works with local web and the iOS development build. Native free/gift overrides require the accompanying local native change.

```bash
yarn qa:accounts list
yarn qa:accounts prepare five
yarn qa:accounts prepare five --apply
yarn qa:accounts status five
yarn qa:accounts verify-email
yarn qa:accounts release five --apply
```

`prepare` without `--apply` is a preview and does not connect to a backend. Prepare/reset reuses the same auth UUID and password, replaces that account's session fixtures transactionally, updates its local access fixture, and proves real password login and authenticated session visibility. Names: fresh, free, four, five, trial, paid, gift, expired. Completed sessions include ratings and stable UUIDs; repeated preparation does not accumulate sessions. Fresh resets onboarding completion only; it does not replay every install/onboarding preference.

The existing local Supabase project must be running (`project_id = "quiver"`) and contain reference beaches. The tool reads credentials from `supabase status --output json`, validates exact loopback hosts, and verifies both API and database ports against the running local Docker containers. It never falls back to a hosted project or reads a production `.env` file. Account ownership is checked in Auth metadata and again inside the SQL transaction. Existing worker-pool, personal and customer users are excluded. Provider-managed entitlements refuse reset; real store/RevenueCat history is never deleted.

Credentials live under `~/.quiver/qa-accounts/local-quiver/<scenario>.env` (files 600, directory 700), outside Git. They include local web/native Supabase settings, the local web API on port 3000, Maestro credentials and disabled outbound email/purchase/analytics settings. Do not commit them or print their contents into logs. The `.json` file beside each environment is the private account registry and two-hour worktree lease. Another worktree cannot prepare a leased account; release from the owning worktree before handoff. A process lock serializes each command. After a killed command, inspect the local process before removing a stale `.lock` file.

To run web, load the chosen environment in that shell, then start `yarn dev` on port 3000. To run native, load it before starting Metro in the native repo. The native development-only override consumes the same expiration date as the backend fixture; free, paid, trial, gift and expired states are explicit. This is a UI/data fixture, not a provider transaction. Production builds ignore these overrides. Existing native settings can load additional local files; verify the running bundle uses the local API/Supabase URLs before a device test. Android emulators require host forwarding (for example `adb reverse tcp:54321 tcp:54321` and `adb reverse tcp:3000 tcp:3000`); physical-device LAN setup is not configured here.

These accounts are mock users with outbound email and push disabled. Lifecycle consent/reply/delivery tests run separately in `verify-email`: the existing disposable SQL and PostgreSQL/PostgREST contract runners exercise real lifecycle/offer logic with fake provider responses and isolated campaign state. They cannot send to customers or grant real Pro. The older running local app database need not be upgraded or have its campaign history erased to run those checks.

`verify-email` checks free/paid/trial/active-grant exclusion, concurrent/idempotent reservations, five historical completed sessions, claim ownership, provider receipt → entitlement mirror, lost-response reconciliation and reply pause. Store sandbox/Test Store purchases and genuine inbox receipt/replies remain separate integration evidence. The initial release does not provision hosted QA accounts, change Apple/Google tester configuration, send a Resend test or reset real subscriptions.
