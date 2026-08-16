# Trial Conversion Audit — 2026-08-13

## Evidence boundary

Audit window: **2026-05-18 through 2026-08-09**, normalized to
`America/Los_Angeles`. This is a complete 84-day window as of 2026-08-12. The
current three-day freshness check was 2026-08-10 through 2026-08-12.

Production read access was attempted and remained read-only, but the sandbox could
not resolve the production Supabase pooler hostname and the PostHog HTTP request
failed at the network boundary. No production write or probe transaction was run by
this audit. The data-correctness verifier therefore returned **FAIL**: both the
Postgres and PostHog sources had zero retrieved rows against a one-row minimum, both
lacked freshness, and the stored GSC snapshot was stale by 312 hours. The snapshot is
not a substitute for an app-funnel denominator.

> **Resolved 2026-08-13 (main session).** The blocked sources were subsequently read
> from outside the Codex sandbox: production Postgres via `POSTGRES_URL_NON_POOLING`
> (read-only `SELECT`s only, no transactions, no writes) and PostHog via its HTTP query
> API using `POSTHOG_PERSONAL_API_KEY` (project 424662). §2 is now **Verified** rather
> than Unavailable, and the window was reset to start at the **App Store launch,
> 2026-05-25** rather than 2026-05-18 — pre-launch weeks are not comparable. §§3–6 and
> the original §7 list were written under the no-access constraint and are unchanged
> except where explicitly marked.
>
> Two claims elsewhere in this file were checked against production and **confirmed**:
> the `user_events_event_type_check` constraint is widened (`onboarding_paywall_viewed`
> is accepted, and rows began landing 2026-08-13), so the Iteration-2 correction in
> `connect-and-prove-20260812.md` is accurate.

Numbers below are labeled as one of:

- **Verified:** directly supported by current repository/code evidence or the dated
  2026-08-12 production probe record.
- **Prior snapshot:** copied from `.planning/connect-and-prove-20260812.md`; useful for
  direction, not independently re-run in this audit.
- **Unavailable:** the required live source could not be reached.
- **Assumption:** explicitly marked and not presented as a measured result.

## 1. Verdict

> **Superseded 2026-08-13 (main session).** The original Codex verdict was "cannot
> determine," reached because its sandbox had no network access to production. With the
> data retrieved (§2), the question is now answerable. The original reasoning is kept
> below the line because its *configuration* caveats still stand.

**This is a top-of-funnel volume problem, not a persuasion problem, and not a broken
mechanism.**

Since the App Store launch on 2026-05-25: **136 users entered onboarding, 109 completed
it (80%), 83 saw the trial prompt, 6 tapped the trial CTA, 3 trials materialized, and 2
of those converted to paid.** Nothing is currently trialing.

Three findings decide it:

1. **The offer works when seen.** Trial→paid is 2/3 — roughly double the 26–34%
   published utility benchmark. Both converters are still paying $39.99/yr. The May 31
   trial row carries `presented_offering_id: "default"` with `period_type: TRIAL`, which
   **rules out** the "intro offer not attached to the offering" hypothesis.
2. **Almost nobody starts one.** Entrant→trial is ~2.2% against a 13.8% benchmark. This
   is the largest absolute loss in the funnel by a wide margin: 109 → 6.
3. **Volume makes experimentation useless right now.** ~10 paywall views/week and 8
   users/week on the new v2 flow. Any paywall copy, trial-length, or timing test needs
   months per variant. Optimizing the paywall would, at current rates, buy roughly one
   extra trial per quarter.

**Nothing broke on 2026-07-04.** The rate was always ~0–1 trial/month; it has simply
been zero for 40 days. The prior snapshot's "zero purchase success since 2026-07-04"
framing is incorrect — see §2.

**Two real defects worth fixing regardless of strategy**, both cheap:

- **3 of 6 trial attempts failed at the purchase call**, and `paywall_purchase_failed`
  ships with a null reason, so we cannot tell abandonment from error. Fix the
  instrumentation first; it is a one-line payload change that decides whether there is a
  mechanism bug at all.
- **The v2 experiment split is 7 control / 2 value_first**, with `value_first` silent
  since 2026-08-10. Verify assignment before trusting any variant readout.

Promoting `main` to `prod` does not address any of the above, and is not a
recommendation of this audit.

---

*Original Codex verdict, retained for its configuration caveats:*

The strongest conclusion available without network access was **cannot determine:
configuration and measurement health are not proven**. The native paywall code fails
closed when RevenueCat has no offering or selected package, while the web checkout path
is fail-closed because its production Funnel URL is empty. Code and tests do not prove
that production RevenueCat offerings, territory eligibility, keys, webhook delivery, or
entitlements are live. **These caveats still stand for the web checkout path and for
territory eligibility**, neither of which §2 measured.

## 2. Measured funnel

> **Filled in 2026-08-13 (main session).** The sections below were `Unavailable` in the
> Codex run because its sandbox could not resolve the production Supabase pooler or reach
> PostHog. They were subsequently measured directly from production Postgres
> (`POSTGRES_URL_NON_POOLING`, read-only `SELECT`s) and the PostHog HTTP query API
> (project 424662). Window starts at the **App Store launch, 2026-05-25** — pre-launch
> data is not comparable and is excluded.

### Onboarding funnel since App Store launch — VERIFIED

Unique users, PostHog, `timestamp >= 2026-05-25`:

| Stage | Users | Step conversion |
|---|---:|---:|
| `onboarding_intro_get_started` | 136 | — |
| `onboarding_video_started` | 125 | 92% |
| `onboarding_step_completed` | 114 | 91% |
| `onboarding_completed` | **109** | **80% of entrants** |
| `paywall_opened` @ `paywall_step=trial_prompt` | 83 | — |
| `onboarding_paywall_skipped` | **107** | — |
| `onboarding_trial_started` (CTA tapped) | **6** | **~4.4% of entrants** |
| Real trials materialized (RevenueCat) | **3** | 50% of taps |
| Converted trial → paid | **2** | **67% of trials** |

`onboarding_paywall_skipped` (107) exceeds `paywall_opened@trial_prompt` (83) because
skip fires across sessions and weeks; do not compute a single-session rate from the pair.
Treat "~93% skip" as directional, not exact.

**Onboarding itself is not the leak — 80% completion is healthy.** The loss is entirely
at the trial prompt.

### Entitlement ground truth — VERIFIED

`public.user_entitlements`, all time (16 rows):

| Segment | Rows |
|---|---:|
| PROMOTIONAL comps | 5 |
| APP_STORE **PRODUCTION** (genuine) | **4** |
| SANDBOX (APP_STORE + RC_BILLING) | 3 |
| Null store (older/incomplete rows) | 4 |
| **Currently trialing** | **0** |

The four genuine production rows:

| Created | Event | Period | Outcome |
|---|---|---|---|
| 2026-05-31 | EXPIRATION | **TRIAL** | Lapsed 2026-06-14, `UNSUBSCRIBE` — never converted |
| 2026-06-14 | RENEWAL | NORMAL | `is_trial_conversion: true` → paying $39.99/yr |
| 2026-06-15 | CANCELLATION | NORMAL | Cancelled 2026-08-06 |
| 2026-07-04 | RENEWAL | NORMAL | `is_trial_conversion: true` → paying $39.99/yr |

**Three real trials have ever existed. Two converted. Zero are active.** Last trial
started 2026-07-04.

This **supersedes** the prior snapshot's "zero `paywall_purchase_success` since
2026-07-04" framing, which this audit repeated in §1. That claim is wrong twice over:
`paywall_purchase_success` has 9 PostHog events (most recent 2026-08-12), and that most
recent one carries `expo_channel=development, app_build=17` — an unreleased dev build,
not a customer. What actually stopped on 2026-07-04 is `trial_active` /
`trial_entitlement_received`.

### Trial-attempt reconciliation — VERIFIED, and it reconciles exactly

Since launch: **6 `onboarding_trial_started` → 3 `paywall_purchase_failed` → 3 real
trials.** Half of everyone who tried to start a trial failed at the purchase call
(2026-06-26, 2026-07-01, 2026-07-22). A seventh attempt on 2026-08-10 recorded
`paywall_trial_cta_tapped` + `onboarding_purchase_started` and then **no outcome event
at all** — neither success nor failure.

**`paywall_purchase_failed` is emitted with no failure reason in production**:
`error_code`, `error_message`, and `user_cancelled` are all null on every occurrence,
even though `components/onboarding/steps/trial-prompt-step.tsx:502` has a `cancelled`
flag in scope. **We therefore cannot distinguish normal Apple-sheet abandonment from a
purchase-call error.** At n=6 this is the single highest-value instrumentation gap in
the funnel: it is the difference between "50% mechanism failure" and "ordinary checkout
drop-off."

### Against published benchmarks

| Metric | Quiver | Benchmark (§6) |
|---|---:|---|
| Entrant → trial | **~2.2% realized (3/136)** | 13.8% install→trial (Adapty, utilities) |
| Trial → paid | **67% (2/3)** | 26.2% (Adapty) / 34.2% (RevenueCat NA utilities) |

The offer converts roughly **twice as well as the benchmark once someone starts a
trial**. Entrants start one at roughly **one-sixth** the benchmark rate. n=3 makes the
67% statistically meaningless on its own, but the direction is consistent across both
available trials-that-converted.

**Largest absolute loss: the onboarding trial prompt.** 109 users complete onboarding;
6 tap the trial CTA.

### Growth context — VERIFIED

Web and app are separate funnels and are reported separately; web visits are **not**
treated as an app-install denominator.

- **Web** grew ~5x since mid-May (320 → 1,233–1,662 weekly visitors). Engagement rose
  alongside it (scroll-depth 18–28% → 32–41%; `forecast_ready` scales proportionally),
  so the growth is real humans, not crawler inflation.
- **App opens are flat**: 22 → 73/week across the same period, oscillating 30–73 with no
  trend.
- **Onboarding entrants are declining**: 23 (w/o 2026-07-19) → 13 (w/o 08-02) → 5
  (w/o 08-09, partial week).

### v2 onboarding rollout — VERIFIED

The new flow is live and reaching production users, but thinly:

| Week | v2 users |
|---|---:|
| 2026-06-28 | 0 |
| 2026-07-12 | 2 |
| 2026-07-19 | 2 |
| 2026-08-02 | 3 |
| 2026-08-09 | **8** |

On the shipped App Store build (1.0.2 build 16, `expo_channel=production`) v2 has
reached **9 users total: 7 `control`, 2 `value_first`**.

Three problems:

1. ~~**~40% of active app users cannot see it.**~~ **RETRACTED 2026-08-13.** That claim
   was a windowing artifact: a 14-day aggregate spanning the 1.0.1→1.0.2 migration, which
   double-counted users who had since updated. **Measured daily, 1.0.1 active users hit
   zero on 2026-08-12 and have stayed there** (Aug 10: 5 · Aug 11: 2 · Aug 12: 0 ·
   Aug 13: 0), while 1.0.2 runs 12–19/day. App Store Connect confirms 1.0.2 is
   `READY_FOR_SALE`, `releaseType=AFTER_APPROVAL`, with **no phased release active**
   (`appStoreVersionPhasedRelease` is null) — it is at 100% availability.
   **Version adoption is complete and is not a constraint on v2 exposure.**

   The real constraint is that the app has only **12–19 daily active users on 1.0.2**, and
   only *new* users pass through onboarding at all. v2 exposure is bounded by new installs,
   not by version migration. This reinforces §7 option C rather than adding a new task.

   *Method note for future audits:* `expo_channel` only began populating around
   2026-08-11. Rows with a null channel are pre-instrumentation, not a distinct cohort —
   filtering on it without checking its start date will manufacture a fake user segment.
2. **The experiment split is broken.** 7 `control` vs 2 `value_first`, and `value_first`
   has not fired since 2026-08-10. Verify assignment before reading variant performance.
3. **Zero trial taps since 2026-07-19.** v2 has produced no trial attempt yet, so there
   is no outcome evidence for or against it.

At 8 users/week on v2, detecting even a large lift takes **6+ months**. The flow may be
better; it cannot be proven at this volume.

## 3. Is the purchase path intact?

**Verdict: cannot determine live end to end. The native code path is fail-closed and
instrumented, but live offer, checkout, webhook, and entitlement evidence is missing.**

### Offer and trial configuration

- Native source defines a 14-day trial and considers a package trial-configured only
  when the package has a zero-price introductory phase lasting 14 days and one cycle
  (`quiver-native/src/lib/subscription/paywall-analytics.ts`). This proves the client
  contract, not RevenueCat or App Store Connect/Google Play state.
- The RevenueCat client requires a production-prefixed iOS/Android key and returns an
  unavailable offering when no current offering exists. No RevenueCat API key was
  available in the audit environment, and live RevenueCat/ASC/Play requests were not
  completed.
- App Store source copy lists `$4.99/month`, `$39.99/year`, and a 14-day trial. That
  document is now marked as source copy rather than live store truth.

### Native render, eligibility, and purchase

- `paywall_opened` fires on paywall mount; `paywall_ready` fires after offering load
  and eligibility resolution; purchase start and success/failure events are emitted
  around the provider call.
- When there is no offering or no selected package, the paywall renders an explicit
  unavailable state and does not expose an enabled purchase action. This is a safe
  failure mode, not proof that an eligible user sees a purchasable offer.
- Eligibility is fail-closed when a package is not configured for the expected trial
  or the provider cannot verify it. A false eligibility result is therefore not proof
  that the trial is unavailable in the store.
- Native `main` is at `8c73fef7`; app config stages version `1.0.2`, iOS build 17,
  Android version code 16. Users are documented as remaining on build 16. Commit
  `e3d88416` adds the `rc-38aee70261` return path for immediate web-purchase
  redemption, but it is not in users' binaries. Shared Supabase user ID/App User ID
  means entitlement refresh is not inherently blocked on build 17; the new binary
  mainly improves immediate return UX.

### Web checkout and entitlement sync

- The promotion queue records `NEXT_PUBLIC_REVENUECAT_WEB_CHECKOUT_URL` as present but
  empty in Vercel Production on 2026-08-13. The helper rejects empty, invalid, or
  non-HTTPS values, so the CTA is inert rather than falsely clickable. This audit did
  not independently re-read Vercel because the CLI did not return usable environment
  state.
- The existing subscription provider identifies RevenueCat with the Supabase user ID,
  refreshes entitlement on foreground, and does not convert configuration failure into
  free entitlement. This is a code-path fact, not live customer evidence.

### Gates and measurement holes

| Gate/measurement | Code or historical evidence | Live status |
|---|---|---|
| `FREE_GROWTH_PHASE` | Exact string flag; defaults off | Unavailable; operator must check production env. |
| `SURF_DISCOVERY_BEST_SPOT_GATE` | When enabled outside free growth, recommendations can be emptied into a locked teaser | Unavailable; operator must check production env. |
| `ALERT_PREVIEW_MODE` | When true, entitlement resolver treats users as premium for alert behavior | Unavailable; operator must check production env. |
| Native event constraint | Migration `20260812130000...` is stamped as applied to production on 2026-08-12; prior rollback verification says 11/11 accepted and unknown types remained rejected | Current live recheck unavailable. Historical rejected rows are not recoverable. |
| RevenueCat lifecycle funnel | `impl/funnel-measurement` @ `792f9071b` adds webhook-backed trial/paid/cancel/lapse events | Unmerged; no production evidence. |
| Web Funnel URL | Queue records empty production value | Current Vercel value not independently readable in this run. |

## 4. Docs claims vs truth

The following stale or over-broad claims were updated in place with dated notes:

| Document | Stale claim or ambiguity | Correction |
|---|---|---|
| `.planning/connect-and-prove-20260812.md` | Said the native event migration was merged but unapplied | Corrected to record the 2026-08-12 production apply and the current audit's inability to repeat the live check. |
| `docs/free-growth/gate-audit.md` | `NEEDS-OPERATOR` said `None` despite no current production flag proof | Added an operator check for the three relevant flags. |
| `docs/guides/APP_STORE_CONTENT.md` | Pricing/trial/version values could be mistaken for a live App Store snapshot | Marked as repository source copy; live listing and territory offer state remain unverified. |
| `docs/plans/2026-03-30-free-tools-funnel.md` | Proposal status was not explicit; “free tools” could be read as current monetization truth | Marked as a design proposal and scoped free claims to the tools. |
| `docs/geo/show-hn-copy.md` | “No paywalled tiers” contradicted the native optional Pro surface | Scoped free claim to the core forecast and session log; added a dated monetization note. |
| `docs/geo/youtube-script.md` | “The whole thing is free” contradicted the native optional Pro surface | Scoped free claim to the core forecast and session log; added a dated monetization note. |

`docs/analytics/launch-campaign-reporting.md` remains aligned: it forbids checkout
claims until RevenueCat Web Billing, webhook filtering, entitlement sync, and native
unlock are verified. The Brand Guide's “charge for something new” principle remains a
product-positioning principle rather than a live offer assertion.

## 5. Built, not shipped

| Work | Current state | Conversion relevance | Required gate |
|---|---|---|---|
| `impl/funnel-measurement` @ `792f9071b` | Local branch only; not on `main`/`prod` | Adds idempotent RevenueCat webhook lifecycle events and trial-to-paid attribution | Review, promote, confirm webhook delivery, and verify a test user produces both lifecycle row and entitlement. It does not add viewer/eligibility denominators. |
| Web checkout CTA @ `4e01545e0` | On `main`, not yet on `prod`; production URL is recorded empty | Provides the web purchase entry point | Set a real HTTPS Funnel URL, verify signed-in CTA rendering and return/unlock behavior; promotion alone is insufficient. |
| Native redemption scheme @ `e3d88416` | On native `main`; build 17 staged, users on build 16 | Makes return from web checkout immediately redeem and show unlock feedback | Release/test the binary after the web path is configured; do not imply the scheme makes the purchase path live by itself. |
| Native event constraint migration | Not unshipped: merged/stamped/applied 2026-08-12 | Stops future native analytics drops; does not restore historical rejected rows | Current live recheck when connectivity is available; no edit to the applied migration. |

No other unmerged paid-path implementation was found in the local refs beyond these
items. The audit did not fetch remote refs.

## 6. What the field says

Sources were accessed on **2026-08-13**. These are directional benchmarks, not Quiver
results, and should not be used to backfill missing denominators.

| Source | Relevant evidence | Fit and limitation |
|---|---|---|
| [RevenueCat State of Subscription Apps 2026 — Utilities](https://www.revenuecat.com/state-of-subscription-apps-2026-utilities) | North America utility median trial-to-paid is reported as 34.2%; 17–32-day trials as 42.5%; hard-paywall median day-0-to-paid as 10.7% versus 2.1% for freemium | Closest category signal, but benchmark population, store mix, and implementation quality differ from Quiver. |
| [Adapty Utilities subscription benchmarks](https://adapty.io/blog/utilities-app-subscription-benchmarks/) | Reports global utility install-to-trial at 13.8%, trial-to-paid at 26.2%, and first renewal at 58.1%, with most trials starting on day 0 | Useful directional utility comparison; third-party benchmark methodology is not Quiver's event model. |
| [RevenueCat State of Subscription Apps 2024](https://www.revenuecat.com/state-of-subscription-apps-2024) | Reports 86% of utility trials starting within 24 hours and discusses matching trial length to product usage cadence and delivering value in the first session | Supports testing timing/value moments only after instrumentation works; not a reason to select seven or fourteen days in advance. |
| [RevenueCat State of Subscription Apps 2025](https://www.revenuecat.com/state-of-subscription-apps-2025) | Describes paywall placement, trial length, same-day starts, and cancellation timing as conversion levers | Directional mobile subscription evidence; not a Quiver causal result. |
| [Apple auto-renewable subscriptions](https://developer.apple.com/app-store/subscriptions/) | Apple recommends presenting subscriptions when users understand the value, including during onboarding or at contextual value moments, with clear renewal price/duration and restore paths | Official platform guidance; it does not prove Quiver's offer is configured or that a particular prompt will win. |
| [Apple introductory offers](https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-introductory-offers-for-auto-renewable-subscriptions) | Introductory offers are configured by product and territory, with eligibility governed by subscription group rules | Direct operator check for offer attachment; not evidence of the current store state. |
| [ChartMogul free-to-paid report](https://chartmogul.com/reports/saas-conversion-report/) | Reports roughly 30% free-to-paid for card-required SaaS trials and more than five times the no-card rate, while warning that requiring a card reduces signup volume | SaaS, not mobile utility; use only as a mechanism hypothesis, not as a Quiver target. |
| [Personalized free-trial randomized study](https://arxiv.org/abs/2006.13420) | A large SaaS experiment found trial-length/personalization effects, with product-specific treatment differences | B2B/SaaS and not directly transferable; supports experimentation discipline, not a predetermined trial length. |

The field evidence supports three hypotheses: show value before or at the upsell,
measure the offer and entitlement path separately from persuasion, and compare trial
length only after enough volume exists. It does not support claiming that a seven-day
or fourteen-day trial will fix the current zero-success observation.

## 7. Options, not a plan

> **Reprioritized 2026-08-13 (main session)** against the measured data in §2. The
> original list below was written without production access, so every option is a
> measurement or configuration task. With the funnel measured, the ranking changes and
> the actual bottleneck — entrant volume — was missing from it entirely.
>
> **Revised ranking:**
>
> **A. Attach a failure reason to `paywall_purchase_failed`** (hours, not weeks). The
> `cancelled` flag is already in scope at
> `components/onboarding/steps/trial-prompt-step.tsx:502` but is not sent. Until this
> ships, we cannot tell whether 3-of-6 trial attempts hit a bug or just backed out of
> the Apple sheet. Everything else about the purchase path is guesswork until this
> lands. Highest value per unit cost in the whole audit.
>
> **B. Fix the v2 experiment assignment** (small). 7 control / 2 `value_first`, variant
> silent since 2026-08-10. A broken split means the new onboarding cannot be evaluated
> no matter how long it runs.
>
> **C. Grow onboarding entrants — the actual bottleneck.** 109 users completed
> onboarding *in eleven weeks*. Entrants are declining (23 → 13 → 5/week). No paywall
> change can outrun that: even a 3x paywall improvement on current volume yields ~1
> extra trial/month. This is where the leverage is, and it is a distribution question
> (installs, 1.0.2 adoption, app-install intent from web) rather than a paywall
> question. Note ~40% of active users are still on 1.0.1 and cannot see v2 at all.
>
> **D. Original options 1–3 (proof, lifecycle instrumentation, denominators)** — still
> worth doing, but partly answered by §2. The offer *is* correctly attached
> (`presented_offering_id: default`, `period_type: TRIAL`); the entitlement path *does*
> work end to end twice over. Scope these down to what §2 did not cover: web checkout,
> territory eligibility, and webhook/lapse observability.
>
> **E. Original options 4–5 (value-moment placement, trial length / card
> requirements)** — **do not start these yet.** §2 shows trial→paid already runs at
> roughly double the published benchmark; the conversion step is not the weak link, and
> at 8 v2 users/week neither test can produce a readable result inside six months.
>
> *Original Codex ranking follows.*

1. **Operator proof of the current purchase path.** Hypothesis: the observed gap is
   caused by missing/invalid offer, checkout, webhook, or entitlement configuration.
   Evidence: one eligible iOS and Android offer check plus one signed-in test account
   that produces paywall-open → purchase-start → RevenueCat transaction/webhook →
   entitlement refresh. Cost: **0.5–1 week**. Signal readability: **very high**.

2. **Ship the backend lifecycle instrumentation.** Hypothesis: the current system can
   unlock users but cannot reliably observe trial-to-paid/cancel/lapse outcomes.
   Evidence: idempotent RevenueCat event rows joined to user ID and product, with
   duplicate-delivery tests. Cost: **1–2 weeks**. Signal readability: **high**.

3. **Close the exposure and eligibility denominator.** Hypothesis: the current
   `paywall_opened` stream does not distinguish trial-prompt, contextual, eligible,
   unavailable, and purchase-started users well enough to locate loss. Evidence: a
   bot-excluded cohort table by platform, app version, paywall step, offering state,
   trial eligibility, and purchase result. Cost: **1–2 weeks**. Signal readability:
   **high**, subject to traffic.

4. **Test value-moment placement after options 1–3.** Hypothesis: a contextual prompt
   after a completed forecast/session value moment will outperform an onboarding-only
   prompt without blocking the free loop. Evidence: randomized exposure with a
   predeclared primary outcome and enough users for a readable interval. Cost:
   **2–4 weeks** at current volume. Signal readability: **medium-to-low** until
   traffic grows.

5. **Test trial length or card requirements.** Hypothesis: trial duration or payment
   friction changes downstream paid retention more than it changes trial starts.
   Evidence: store-compliant experiment with exact offer cohorts and post-trial
   renewal/lapse tracking. Cost: **3–6 weeks** plus store/configuration lead time.
   Signal readability: **low at current volume**; do not start from benchmarks alone.

## 8. Open questions and operator checks

> **RESOLVED 2026-08-13 (main session).** Seven of eight were answerable with network
> access, the App Store Connect API key, and read-only production Postgres. Answers
> below; the original list follows for traceability.

### Q1 — 12-bucket extract: **DONE**

Weekly **signup cohorts** from `auth.users` since the App Store launch. Excludes
`deleted_at IS NOT NULL` and emails matching `(test|mock|example\.com|\+e2e|qa@)`.

**Reconciliation first:** `auth.users` = 273, `public.profiles` = 286 (**13 orphan
profiles — unreconciled, flagged**), 1 deleted user, 2 test emails. Cohort base after
exclusions since 2026-05-25: **169 signups**.

| Signup week | Signups | Activated | Saw paywall | Tapped trial | Got trial | Paid |
|---|---:|---:|---:|---:|---:|---:|
| 2026-05-25 | 23 | 11 | 12 | 1 | 1 | 0 |
| 2026-06-01 | 8 | 5 | 6 | 0 | 0 | 0 |
| 2026-06-08 | 28 | 18 | 18 | 1 | 0 | 1 |
| 2026-06-15 | 12 | 10 | 11 | 1 | 0 | 0 |
| 2026-06-22 | 7 | 6 | 6 | 1 | 0 | 0 |
| 2026-06-29 | 15 | 11 | 11 | 2 | 0 | 1 |
| 2026-07-06 | 14 | 8 | 6 | 0 | 0 | 0 |
| 2026-07-13 | 11 | 8 | 7 | 0 | 0 | 0 |
| 2026-07-20 | 15 | 12 | 12 | 1 | 0 | 0 |
| 2026-07-27 | 9 | 8 | 8 | 0 | 0 | 0 |
| 2026-08-03 | 16 | 9 | 9 | 0 | 0 | 0 |
| 2026-08-10 | 11 | 9 | 7 | 1 | 0 | 0 |
| **Total** | **169** | **115** | **113** | **8** | 1* | **2** |

\* `Got trial` counts only rows still carrying trial state; the 2 converted rows now read
`period_type=NORMAL` with a null `trial_ends_at`. **True trial count is 3.**

Stage rates, denominators explicit:

- signup → activated: **115/169 = 68%**
- signup → saw paywall: **113/169 = 67%**
- **saw paywall → tapped trial: 8/113 = 7.1%** ← the loss
- tapped trial → trial granted: **3/8 = 38%**
- trial → paid: **2/3 = 67%**
- signup → paid: **2/169 = 1.2%**

**`saw_paywall` (113) ≈ `activated` (115)** — paywall *exposure* is effectively universal
because the prompt sits in onboarding. Exposure is not the problem; the tap is.

**Seven consecutive weekly cohorts (2026-07-06 → 2026-08-10, ~90 signups) produced zero
trials and zero paid conversions.**

**Small-N warning:** weekly cohorts are 7–28 signups with 0–2 trial taps. **No
week-over-week difference in this table is statistically distinguishable from noise.**
Read the totals row, not the trend. Opposite proof for any "zero" cell is a single
contradicting `user_entitlements` row or `user_events` row for a user in that cohort.

Cross-source check: `user_events` and PostHog agree closely (`trial_active` 9 = 9,
`onboarding_trial_started` 6 = 6, `paywall_purchase_started` 14 vs 12), so neither sink
is silently dropping the funnel.

### Q2 — Web checkout URL: **ANSWERED — still inert, condition NOT disproven**

`vercel env pull --environment=production` returns
**`NEXT_PUBLIC_REVENUECAT_WEB_CHECKOUT_URL=""`** — an empty string. The Vercel listing
shows it was re-saved **1 day ago**, but the stored value is still empty. The helper is
fail-closed, so the CTA does not render. **Unchanged from the original finding.**

### Q3 — RevenueCat offering / App User ID: **PARTIALLY ANSWERED**

No RevenueCat API key is available, so the dashboard was not read. From production
entitlement rows instead:

- **App User ID == Supabase `user.id`: confirmed.** 12 of 16 rows match exactly; the
  other 4 have a null `app_user_id` (the older null-store rows). **Zero mismatches.**
- Two offerings are live in production data: **`default`** (APP_STORE, annual + monthly)
  and **`web_acquisition`** (RC_BILLING, `quiver_pro_web_annual`).
- **Still unverified:** Android/Play attachment of the default offering.

### Q4 — App Store Connect product + trial state: **ANSWERED (iOS), open (Android)**

Queried live via the ASC API (app `6759300320`, group `Quiver Pro` `22043718`):

| Product | State | Period | Intro offer |
|---|---|---|---|
| `app.quiversurf.surf.pro.annual` | **APPROVED** | ONE_YEAR | **FREE_TRIAL, TWO_WEEKS, 1 period, all territories, no end date** |
| `app.quiversurf.surf.pro.monthly` | **APPROVED** | ONE_MONTH | **FREE_TRIAL, TWO_WEEKS, 1 period, all territories, no end date** |

App version **1.0.2 is `READY_FOR_SALE`, `releaseType=AFTER_APPROVAL`, phased release
null** (100% availability, not throttled).

**The 14-day trial is correctly configured and active.** This closes the "intro offer not
attached" hypothesis for iOS. **Google Play base-plan/offer state remains unverified** —
no Play API credential was available. A live test transaction was **not** performed.

### Q5 — Webhook lifecycle: **ANSWERED — a real defect**

`public.user_entitlements_failed_webhooks` holds **10 rows, all `PURCHASE_REDEEMED`, all
on 2026-08-12, all `error_message = "Missing app_user_id"`, all `retry_count = 0`, all
with a null `user_id`.**

`PURCHASE_REDEEMED` is the web-purchase redemption event. **The redemption webhook path
failed 10/10 and never retried**, so no lifecycle row and no entitlement was written for
any of them. These coincide with the 2026-08-12 dev-build testing
(`expo_channel=development`, `app_build=17`), so they are likely self-inflicted — but the
handler's behaviour under a missing `app_user_id` is a genuine defect that would drop a
real customer's redemption silently. Note this is the **same root cause** the promotion
queue flags for web checkout: a purchase made without a signed-in `app_user_id` has
nothing to attach to.

Idempotency under duplicate delivery is **not** proven by this — no duplicate-delivery
test was run.

### Q6 — Live `user_events_event_type_check`: **ANSWERED — all 11 ALLOWED**

Rechecked against production. All eleven previously-rejected native types are now
accepted: `onboarding_paywall_viewed`, `onboarding_free_selected`,
`onboarding_purchase_started`, `onboarding_purchase_success`,
`onboarding_purchase_failed`, `onboarding_purchase_cancelled`,
`onboarding_restore_result`, `community_filter_selected`, `siri_shortcut_opened`,
`garmin_connect_viewed`, `garmin_designated_activity_set`.

Rows are landing: `onboarding_paywall_viewed` (3) and `onboarding_free_selected` (1) from
2026-08-13. Migration not edited.

### Q7 — Production gate flags: **ANSWERED**

| Flag | Production value | Effect |
|---|---|---|
| `ALERT_PREVIEW_MODE` | **`"true"`** | `lib/alerts/entitlements.ts:76` → `return "premium"` for every user, **within the alerts subsystem only**. See scope + measured impact below. |
| `FREE_GROWTH_PHASE` | **not set** | `lib/flags/free-growth-phase.ts:5` checks `=== "true"` → **off** |
| `SURF_DISCOVERY_BEST_SPOT_GATE` | **not set** | `surf-discovery-gating.ts` checks `=== "1"` → **off** |

#### `ALERT_PREVIEW_MODE` — scope and measured impact

> **Correction 2026-08-13.** An earlier revision of this section claimed the flag gives
> away "the flagship paid capability" and "plausibly explains the 7.1% paywall-tap rate."
> **Both overstated it.** Scope and measurement below; the claim is withdrawn.

**Scope is the alerts subsystem, not all Pro features.** Only `getUserEntitlement()` and
`resolveEntitlement()` consult `envBypassTier()`. The pure helper `entitlementFromRow()`
does **not**, and three Pro surfaces call it directly:

| Path | Bypassed? |
|---|---|
| `app/api/alerts/rules/route.ts:128,243` (rule create/update) | **Yes** |
| `app/api/cron/condition-alert-evaluate/route.ts:196` (evaluate + deliver) | **Yes** |
| `app/api/surf/call/route.ts:299` | No — real entitlement enforced |
| `app/api/surf/discover/route.ts:180` | No |
| `app/api/surf/session-decision/route.ts:95` | No |

**What it unlocks** (`CAPS`): free = 1 beach / 3 rules / `mellow_session` preset only /
**home beach only** (with `FREE_GROWTH_PHASE` off); premium = 10 beaches / 50 rules / all
presets / any beach.

**The mechanism is live — verified, not assumed.** 7 non-paying users hold 8 alert rules
on non-home beaches. Under the free wall `canCreateRule` returns `PERSONALIZATION_LOCKED`,
so those rows are impossible without the bypass.

**But the exercised leak is small:**

| Cohort | Users with rules | Total rules | Users with non-home rules |
|---|---:|---:|---:|
| Not paying | 94 | 139 | **7** (8 rules) |
| Paying | 9 | 26 | 4 (14 rules) |

Only **7 of 94** free users ever went past the wall — most never attempt a second beach.
**This is a real invariant violation** (the docstring says "NEVER set this in prod
runtime") **and worth closing as hygiene, but it does not explain the funnel.** Treat it
as a correctness fix, not a conversion lever.

### Q8 — Promotion decision kept separate: **HONORED**

This audit does not recommend promoting `main` to `prod` as a conversion action. The
empty checkout URL, the Play-side gap, the webhook defect, and `ALERT_PREVIEW_MODE` are
each independent of promotion and none is resolved by it.

---

*Original open-question list, for traceability:*

1. Re-run the 12-bucket production extract after network access is restored. Use
   `profiles`/`auth.users`, native `user_events`, RevenueCat/webhook lifecycle rows,
   and entitlement state. Exclude bots/crawlers, mock/test/system/deleted users and
   duplicate webhook deliveries. Reconcile every stage before computing rates.
2. Confirm the live production value of
   `NEXT_PUBLIC_REVENUECAT_WEB_CHECKOUT_URL` is a real HTTPS Funnel URL. A non-empty
   value and a rendered signed-in CTA disprove the “web CTA is inert” condition.
3. In RevenueCat, confirm the default offering is attached to iOS and Android, the
   annual/monthly products are active, the 14-day intro offer is attached in required
   territories, and the App User ID equals the Supabase `user.id`.
4. In App Store Connect and Google Play, confirm product/base-plan state, trial
   eligibility, price/territory availability, and that a test account can purchase or
   enter the trial. One successful test transaction plus entitlement refresh disproves
   “purchase path unproven,” but does not establish conversion rate.
5. Confirm the RevenueCat webhook endpoint receives the test event, filters the right
   event types, writes an idempotent lifecycle row, and leaves an entitlement that the
   current native build can read on foreground refresh.
6. Recheck the live `user_events_event_type_check` constraint and record the 11 native
   event types. The migration was historically verified as applied; the current
   recheck is the remaining operational proof. Do not edit the applied migration.
7. Record production values for `FREE_GROWTH_PHASE`,
   `SURF_DISCOVERY_BEST_SPOT_GATE`, and `ALERT_PREVIEW_MODE`. The code defaults alone
   cannot establish what users saw.
8. Once exact rows exist, report platform and app-version cohorts, signup-to-activation,
   activation-to-paywall, paywall-step split, start-to-trial, trial-to-paid, and
   retained-past-trial. For every percentage, include the denominator and a small-N
   warning; a new event or exact cohort that contradicts a zero result is the required
   opposite proof.
9. Keep the promotion decision separate from the evidence decision. This audit does
   not recommend “promote `main` to `prod`” as a sufficient conversion action; the
   configuration, live-store, webhook, and measurement gates must be resolved
   independently.
