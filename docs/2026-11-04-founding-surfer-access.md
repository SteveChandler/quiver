# Founding surfer access (2026-11-04)

## Why

Retention, not revenue, is the goal. Of 112 real accounts that saw a paywall since Aug 7 and never trialed or paid, the median was active on 1 day. Only 14% of those who saw it 14+ days ago were active in the last 14 days (see `docs/analysis/2026-11-04-free-user-retention.md` on the session branch). Pro feature gates earned 1 trial or purchase from about 24 paywall views. The onboarding paywall earned 8 from 90. Free users who set an alert, logged a session or made a custom spot came back 3+ days at 43%, against 10% for those who didn't.

Steven's decision (2026-11-04):
- Keep the onboarding paywall as it is.
- Add a supporter angle.
- Give every signed-in free user the Pro features as a surprise "founding surfer" gift.
- Put all of it behind one switch. Off returns everyone to today's gates and upgrade prompts.

## The switch

One row in the database. The server and the app both read it, so a flip needs no redeploy and no app release.

- Table `public.app_runtime_flags (key text primary key, enabled boolean not null default false, note text, updated_at timestamptz not null default now())`. RLS is on, with no direct grants to `anon` or `authenticated`.
- Seed row `('founding_access', false)`. Shipping the migration changes nothing.
- `public.founding_access_enabled() returns boolean`: `stable`, `security definer`, `set search_path = public`. Returns `coalesce((select enabled from app_runtime_flags where key = 'founding_access'), false)`. Execute is granted to `authenticated` and `service_role`.
- Turn on: `update public.app_runtime_flags set enabled = true, updated_at = now() where key = 'founding_access';` This is a production write and needs Steven's approval every time.
- Turn off: the same with `false`.
- Propagation: the server caches the value for at most 60 s per instance. The app re-reads it at most every 5 min and on foreground. A failed server read keeps the instance's last successful value for another 60 s; with no earlier success it resolves to **off** (fail closed to today's gates). A successful read of off turns it off at once.

"Founding access" means: the switch is on **and** the user is signed in **and** the user is not Pro. Pro users already have everything. Guests are not covered.

## What founding access unlocks

The rule is that the founding user gets what Pro gets on every **feature gate**. Billing, subscription state, the paywall and trial logic never change.

Server (`../quiver`):

| Gate | Where | With founding access |
|---|---|---|
| Curated-beach favorites cap (3) | `toggle_favorite_spot_guarded` RPC | No cap |
| Alert tier: caps, presets, home-beach-only | `lib/alerts/entitlements.ts` `getUserEntitlement`, `canCreateRule` | `premium` |
| Alert delivery caps | `app/api/cron/condition-alert-evaluate` `resolveEntitlement` | Premium caps |
| `similarity_match` eligibility | `lib/personalization/eligibility.ts` | Eligible |
| Personal match | DB `user_match_access_result`, `get_user_match_candidates` | Not locked for reason `free` |
| Discover entitlement and personalization layers | `app/api/surf/discover/route.ts`, personalization and similarity layers, `now-recommendation`, `canonical-surf-call` | Treated as paid |
| Board picks | `scored/[beachId]`, `surf-discovery-orchestrator` | Treated as paid |
| Best-spot teaser gate | `surf-discovery-gating.ts` | Not gated |

Additive contract: `/api/surf/discover` `entitlement` gains `foundingAccess: boolean`. Existing fields keep their meaning for real Pro, and `hasPaidAccess`/`canSeeBestSpot` become true for founding users. No field is renamed or removed.

Server rule: one helper resolves `{ isPro, foundingAccess, hasFeatureAccess }` for a user. Every gate above uses `hasFeatureAccess`. Billing code (RevenueCat webhook, trial-ending push, lifecycle and offer emails, auto-managed similarity alerts created by the webhook) keeps reading real `isPro` only.

Native:

| Gate | Where | With founding access |
|---|---|---|
| Week Scout locked days | `week-scout.tsx` `gateWeekScoutDays` | All days |
| Home looking-ahead locked days, ranked rail, hero pager, board pick | `home.tsx` `canUsePaidDiscovery` | Paid discovery |
| Personalization eligibility (ranked windows, personal match, personal alert) | `use-personalization-eligibility.ts` / `lib/personalization/eligibility.ts` | Eligible |
| Similarity alert toggle | `similarity-alert-toggle.tsx` | Allowed |
| Hero board-pick name | `beach-hero.tsx` | Shown |
| Custom spot surf decision | `use-custom-spot-detail-model.ts` | Paid |
| Second-chance return paywall | `use-second-chance-offer.ts` | Suppressed |
| Value-moment offer | `use-value-moment-offer.ts` | Suppressed |
| New-user personal-forecast Pro rail | `home.tsx` `showNewUserProRail` | Suppressed |

Native rule: a new hook `useFoundingAccess()` returns `{ foundingAccess: boolean }` from the `founding_access_enabled` RPC, using TanStack Query and a key from the existing key factory. `hasFeatureAccess = isPro || foundingAccess` is applied **only at gate sites**. `useEntitlement().isPro` is never changed. Paywall auto-dismiss, onboarding trial or review stations, Settings, purchase and restore stay on real `isPro`.

## The gift moment

One time per user per device (AsyncStorage key `@quiver/founding-gift-shown/<userId>`), on Home focus. It shows when all of these hold:
- founding access is on
- the user is not Pro
- Home is ready
- no pending post-onboarding paywall intent
- no boat overlay
- no deep link

New users therefore see it right after they decline the onboarding paywall (boat "skip" or hybrid "maybe later" both land on Home). Existing free users see it on their next visit.

Copy (sheet):
- Title: "You're a founding surfer"
- Body: "We've opened up Quiver for you — free. The full forecast week, unlimited spots, every alert and your personal calls."
- Supporter line: "Pro members keep it free for everyone."
- Primary: "Start exploring" (dismiss)
- Secondary: "Become a supporter" opens `Paywall` with `source: 'founding_gift'`.

Analytics: `founding_gift_shown`, `founding_gift_dismissed` (`{ action: 'explore' | 'supporter' }`).

Supporter angle on the paywall: when founding access is on, the onboarding trial step and the Paywall show one extra line, "Pro members keep Quiver free for every surfer." Everything else on the paywall is unchanged. With the switch off the paywall is exactly today's.

## Turning it off

- Week Scout, Home, personalization and the board pick re-gate on the next read.
- Upgrade prompts come back.
- Favorites a user saved above 3 stay saved, but they can't add more (the cap only blocks adds).
- Alert rules above the free caps stay stored. Delivery drops back to the free rule cap, so only the 3 oldest rules deliver, whatever their preset or beach. That matches how a lapsed Pro user's rules behave today: the free preset and home-beach gates apply when a rule is created, not at delivery. New rules must pass the free gates again. Users with more than 3 rules may notice alerts going quiet. That is the accepted cost of a reversible switch.
- The gift sheet won't show again to the same user on the same device.

## Measuring

The main number is 14-day return for free users, currently 14%, with a target of 25%. The leading indicator is new users who set an alert in week 1, currently about 18%. Use the query in the retention analysis, split by account creation before and after the flip date.

## Release

1. The web PR (migration plus helper) merges to `main`. It reaches prod through the daily release pool; add a RELEASE-POOL line for the migration.
2. The native PR merges to `main` and reaches iOS through an OTA (Steven's call).
3. Flip the switch only once both are live (Steven's call).
