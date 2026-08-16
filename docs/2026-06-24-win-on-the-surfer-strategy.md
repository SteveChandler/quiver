# Win on the Surfer, Not the Number

**Quiver product strategy · 2026-06-24**
Companion docs: the Surf Zone Intelligence design (`docs/archive/superpowers/specs/2026-06-20-surf-zone-intelligence-design.md`), the last-mile translation spec (`docs/archive/superpowers/specs/2026-06-24-last-mile-translation-runtime-spec.md`), the native activation plans (`../quiver-native/plans/`).

## The call

Quiver doesn't win by having a righter wave-height number. The number's already good, and "whose forecast is righter" is a game we can't win. We win on the **surfer** — knowing them, remembering their good days, talking straight, and putting their crew in the app. Everything below is downstream of that.

## Why the number isn't the game

- **Our forecast is already honest.** The face-height transform sits **~0.15 m off observed surfer truth** and beats raw Open-Meteo. Nobody feels a sub-0.2 ft difference on a call that's a range anyway (`~head-high to overhead`).
- **We can't out-observe Surfline.** Their edge is 25 years of cams and forecaster reports — an observation moat, not a model. Racing them on accuracy is a race nobody's scoring.
- **We proved it the cheap way.** The seaside face-height ML dig shelved the learned model on a years-scale truth runway and kept the deterministic transformer as champion (committed, `seaside main`). The bottleneck was never the model — it's surfers and sessions.

## What "win on the surfer" means

A surfer opens Quiver before dawn to make one call: paddle out or not. They don't ask "what's the exact face height." They ask:

- Does it **know me** — my skill, my board, the kind of day I love?
- Does it **remember** — "this is shaping up like that morning you rated five stars"?
- Does it **talk straight** — `too big for you today · clean till the ~10am onshore · best mid-incoming` — not just numbers?
- Is my **crew** here — the log, the share, the reason to open it tomorrow?

The good news the data-starved model couldn't give us: **this runs on each surfer's own handful of sessions** — memory and retrieval, not ocean-scale training. The 55 sessions that starve a forecast model are plenty to remember one surfer's good days.

## The honest part — we're already building it

Recon across both repos: the human layer is largely built or planned. Stacking more plans on top is not the move.

| The bet | Already exists as | Status | The real gap |
|---|---|---|---|
| Fix session-log intake | native `plans/001`, `002` | **shipped** | did it move D7? (unmeasured) |
| Remember my good days | "Plan My Next Session" (`PLAN_MY_NEXT_SESSION_AUDIT`, Phases 13–18); `lib/alerts/best-days.ts` + similarity RPC | planned / email-only | surface the *memory* in-app, framed as memory — not a neutral list |
| Talk straight (last-mile call) | Surf Zone Intelligence (`specs/2026-06-20`) | designed; internal + offline | the **user-facing** turn — see the spec |
| My crew | following, shares, XP/badges, NPCs | built; feed/leaderboard designed | wire the loop — but hold at low density |

## The real gap isn't plans. It's measurement.

Twenty native plans, a real match engine, gamification — we're executing "win on the surfer" hard. But **D7 retention is ~4.5%**, session completion leaks **41 → 7**, and `plan 014` (measure D7) isn't done while everything downstream is gated on it.

That's the seaside mistake one level up: **building ahead of the constraint.** A 24-plan pile is still blind without knowing which surfer-bet moves the surfer.

And we don't have to wait — **D7 is retrospective.** Pull the cohorts backward in PostHog (bots excluded, anchored by day-0, before/after the shipped plans) and read two things: the number, and whether N is even big enough to trust it.

**Measured 2026-06-24 (PostHog, via Codex):** the first cut (native-only) read tiny — and that was the misleading part.
- **Before-ship clean cohort:** 65 D7-mature users, **5 retained = ~8%**.
- **After-ship:** not mature yet (read after ~2026-06-29).
- That native-only slice was **corrupted and undercounted** — PostHog flags *all* native traffic as `Automation`, forcing a hand-rolled bot filter.

**Reconciliation:** the truer top-of-funnel is **~130+ real new users in the last 30 days** (web + native). So acquisition is **modest but real**, not absent — and that relocates the leak to where it actually is: **a large input arrived and didn't come back.** ~5 of 65 returned at D7; session-logging leaks **41 → 7**. The binding constraint isn't acquisition and isn't the forecast — it's **activation/return: surfers show up once, never reach the value moment, and don't come back.** That's also *why* the flywheel is starved — no completed sessions, no truth, no personalization signal. Plug the come-back leak and the rest unlocks.

*(Still to nail, so the fix can be aimed: the exact return rate and the web-vs-native split — and fix the native `Automation` bot-flag first, or the native surface stays invisible. But the gross leak — large in, few back — is visible regardless of N.)*

## What to actually do (updated 2026-06-24, post-measurement)

1. **Plug the come-back leak — that's the bottleneck.** Surfers arrive (~130/mo) and don't return; the flywheel starves because they never complete the loop. This is where the human-layer work earns its keep — it was **never premature, it's the medicine**: fix session-log completion (41 → 7), surface the value/memory ("like your five-star day"), make the first call legible and personal. These *are* retention features, and retention is the leak.
2. **Measure the come-back loop to aim the fix.** Get the real return rate on the full ~130 cohort, split web vs native; fix the native `Automation` bot-flag so the native surface is visible at all. Watch *return* and *first-session completion*, not D7 alone — they have enough N to read the gross leak.
3. **Don't pour more into a leaking bucket.** Acquisition is modest but real; ramping it before plugging the come-back leak just wastes the surfers you already get. Plug first, *then* turn up the funnel.
4. **The forecast / match / translation assets are the come-back hooks** — the reason to return is a useful, personal, legible call. They just have to actually reach a new surfer in their first days, before they bounce.

The deferred surfer-features (last-mile call, Plan-My-Next-Session-as-memory) aren't on the shelf after all — **they're the fix.** Ship the ones that get a new surfer to a value moment and back, fastest.

This is MY surf app. Made by surfers, for surfers — and the job is getting the ones who show up to come back.
