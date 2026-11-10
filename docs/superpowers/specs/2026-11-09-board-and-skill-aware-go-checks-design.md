# Board- and skill-aware "go" checks — design

**Date:** 2026-11-09
**Owner:** Steven
**Status:** Approved by Steven on 2026-11-09 (all of section 9). Nothing is built.
**Repos:** `quiver` (scoring, Daily Call, swell alert, Week Scout, one new response field). `quiver-native` only for the D5 notice.
**Code read at:** `origin/main` 8bf24c561 (2026-11-09). All line numbers are from that commit.
**Builds on:** `docs/superpowers/specs/2026-10-11-one-surf-call-ranking-design.md` (one judge for every surf call).

## 1. Why

Steven, 2026-11-09:

- "There are days when the forecast can say poor but would be good for a beginner."
- "Ideally we would have the personal score also use the user's boards as well."

On 2026-11-09 we set `CALL_SHARED_RANKING_ENABLED=true` for the 4 Daily Call accounts. With it on, the Daily Call push needs three checks to say "go" (`lib/cron/daily-call-runner.ts` `buildSharedCall`):

1. Week Scout's personal verdict for the day pick (`:766`).
2. The forecast check on the peak row, `evaluateForecastVerdict` (`:824`).
3. The canonical decision for the window (`:826`).

Two of these checks disagree about the same surf, in ways that hurt beginners and people who ride soft or long boards:

- **Boards.** Week Scout scores each window once per saved board and keeps the best score (`week-scout.ts:718-722`, `window-scorer.ts:129-204`). The forecast check scores with no boards (`lib/alerts/canonical-forecast-verdict.ts:36`). A beginner with a longboard on a clean 1 ft morning can get "go" from Week Scout and "no" from the forecast check. Then no push is sent (`ranking_verdict_mismatch`).
- **The character gate ignores skill and board.** Week Scout's label passes through `getRecommendationLabelGated` (`response-formatter.ts:197-209`). Only `large-clean`, `medium-clean`, `small-quality` and `small-clean` can be "Worth it". The categories come from `getConditionCharacter` (`lib/domains/scoring/condition-character.ts:255-345`), which reads the snapshot with `preferences: null` (`recommendation-label.ts:31-35`). So the rules are the same for a beginner on a foamie and an expert on a shortboard:
  - Under 2 ft, a period under 8 s is `small-weak`.
  - At 2–5 ft, `medium-clean` needs good wind, good tide and a period of 10 s or more. Every other medium day is `medium-mixed` or `medium-rough`.
  - So a clean 2–3 ft, 8–9 s morning is capped at "Maybe". That can be a very good beginner day.
- **No skill level.** 54 of 149 users active in the last 30 days have no `experience_level`. Three places treat them differently:
  - The row score uses intermediate (`window-scorer.ts:136-139`).
  - Week Scout uses beginner (`getSkillLevelOrDefault`, `week-scout.ts:703`; `DEFAULT_SKILL_LEVEL = 'beginner'` in `lib/domains/user-preferences/skill-level.ts:21`).
  - The canonical engine uses beginner's 4 ft wave cap, but it skips the beach-skill check.

Data (prod, read-only, 2026-11-09):

- With today's non-shared path, the Daily Call found a go window on 76–79% of days since Oct 12 for all 4 accounts. That includes the one beginner account (`bcacdc51`, 22 of 29 days).
- 54% of active beginners have a saved board. The most common types are mid-length (10), softboard (8) and longboard (12, both fin setups).

## 2. Goals

- **G1.** Each "go" check scores a window the same way, with the user's skill and saved boards. The forecast check and Week Scout give the same score for the same row, user and beach.
- **G2.** The character gate uses skill and board. A clean small day that suits a beginner or a soft or long board can be "Worth it" for that user.
- **G3.** One default for a user with no skill level, the same in every check.
- **G4.** Every push producer that uses the forecast check gets the same rule: the Daily Call (both paths) and the swell alert (`swell-alert-runner.ts:601`).

## 3. Non-goals

- No change to the safety vetoes in the canonical engine (`engine.ts:59-109`, `:188-193`): the skill wave cap, the beach-skill check, zero or unknown height, a missing beach `skill_level`.
- No change to the 70 / 40 score thresholds (`engine.ts:31`, `response-formatter.ts:158-162`).
- No change to the condition character labels that users read (for example "Small & clean — glassy conditions"). Only which categories may be "Worth it" changes.
- No change to scores or labels for a user with no saved boards and a known skill level (G1). G2 can change their label only when they are a beginner.
- No change to the personal match SQL (`compute_user_match_scores`). It already learns from the board in each session and from `session_board_fit`.
- No native scoring change. D5 adds one native notice and nothing else. Native Week Scout reads the server's labels. Native Beach Detail scores on the phone (`surf-decision.ts`); it can disagree with the server until a later change (see section 8).

## 4. Anti-goals (a failure even if it works)

- A board makes a day "go" for a beginner above the beginner wave cap (4 ft) or at a beach rated above beginner. The vetoes must still win.
- The same window shows "Worth it" on Week Scout and "Maybe" in the push, or the reverse.
- A choppy onshore day becomes "Worth it" because the user owns a foamie.
- Users with no boards and a known non-beginner skill see their Week Scout labels change.

## 5. Design

### D1. The forecast check uses the user's boards

- `evaluateForecastVerdict` (`canonical-forecast-verdict.ts:27`) takes an optional `boardClasses: readonly BoardClass[]` and passes it to `scoreWindowConditionScore` as the 5th argument, with `rideabilityBand` `null`. This is the same call Week Scout makes (`week-scout.ts:650-651`).
- Move the board loader out of `week-scout.ts:631-645` into one shared function, for example `lib/profile/board-classes.ts` `fetchUserBoardClasses(supabase, userId)`. It reads `boards.board_type` where `retired_at is null` and maps each with the existing board-class mapping. Week Scout, the Daily Call and the swell alert all use it.
- `DailyCallProfile` (`daily-call-runner.ts:~100`) gets `boardClasses`. `loadDailyCallProfiles` (`:851`) loads them for the profiles it returns, in one query for all users, not one per user.
- The swell alert's profile loader does the same, and its `evaluateForecastVerdict` call (`swell-alert-runner.ts:601`) passes them.
- Result: for a user with no boards, nothing changes. For a user with boards, the row score can only go up (the scorer keeps the best of the baseline and each board, `window-scorer.ts:153-203`). The vetoes are still applied after the score.
- **Boards count for every user, free or Pro (my call).** Week Scout already scores with boards for everyone, with no entitlement check. The swell alert also reads boards through `fetchUserBoardContext(..., tier === "premium")` (`swell-alert-runner.ts:653`) for the board pick it shows. That entitlement rule stays for the board pick, but the go check uses the shared, ungated loader.
- **One score per row, everywhere it is read (my call).** In the swell alert, the same board-aware verdict also feeds `buildScoreHistory` (the "first good day after flat" logic) and `peakScore` ordering. That is intended: a user must not get a different score for the same row in two parts of one push.

### D1b. The forecast check gets the same character gate as Week Scout (my call)

- Today `evaluateForecastVerdict` labels the row with `getRecommendationLabel(score)` and no character gate (`canonical-forecast-verdict.ts:66`). Only Week Scout gates.
- D1 raises scores for board owners. Without a gate, the non-shared Daily Call path and the swell alert could send a choppy onshore day that a foamie lifted to 70 or more. That breaks anti-goal 3.
- So, behind the flag, `evaluateForecastVerdict` computes the character (as `resolveRecommendationLabel` does) and uses the D2 gate with the same learner context. The forecast check and Week Scout then agree on the label as well as the score.

### D2. The character gate uses skill and board

- `getRecommendationLabelGated(score, category)` gets a third argument: `context: { skill: SkillLevel; boardClass: BoardClass | null; snapshot facts needed below }`.
- `boardClass` is the board that gave the best score. `scoreWindowConditionDetails` already returns it (`window-scorer.ts:128`, `boardClass` field). `null` means no board beat the baseline.
- A **"learner context"** applies when the skill is `beginner`, or when the best board's rideability band has `prefersClean: true` (foamie, longboard, mid-length, funboard, SUP; `lib/domains/rideability/rideability.ts:23-35`).
- In learner context, two more cases can be "Worth it" (the score must still be 70 or more):
  1. `medium-mixed` when the wave height is under 3 ft and the wind is not rough (the case is `medium-mixed`, not `medium-rough`, so it is already not rough).
  2. `small-weak` from the "Weak swell — minimal energy" branch only: 1 ft or more, a period of 6 s or more, and not onshore over 5 mph. The two "choppy — onshore wind" branches stay capped.
- These thresholds (3 ft, 1 ft, 6 s) are my call. Steven checks them (section 9).
- `getConditionCharacter` returns which `small-weak` branch it took, so the gate does not re-derive it. Add a field to its result, for example `reason: 'onshore-chop' | 'weak-swell' | 'marginal'`. The user-facing `label` text does not change.
- `resolveRecommendationLabel` (`recommendation-label.ts:16`) takes the skill and best board and passes them on. Week Scout calls it at `week-scout.ts:739` and already has both.
- **Every caller of the gate follows D2 behind the flag (my call).** Besides Week Scout and D1b, `resolveRecommendationLabel` / `getRecommendationLabelGated` are called from `surf-discovery-orchestrator.ts` (2 places), `lib/services/forecast/bulk-decision-context.ts:213` and `lib/utils/surf-call-logic.ts:751`. All of them pass the learner context, so an allowlisted user does not see "Worth it" on Week Scout and "Maybe" on Beach Detail or the timeline (anti-goal 2). Where a caller has no user boards today, it loads them with the shared loader. The builder lists every caller with `git grep` and covers each one.
- Outside learner context the gate is exactly as today.

### D3. One default for no skill level

D3 has two parts. Both apply only behind the flag, at the call sites, not inside the shared scorer or engine. `resolveNativeSkillLevel(..., "intermediate")` in the scorer and the engine's `"unknown"` skill stay as they are for flag-off and non-flagged callers, so "flag off is identical" holds.

- **D3a. The score (my call, always with the flag).** The flagged call sites resolve a null skill to beginner before they call the scorer. Week Scout already scores these users as beginners (`week-scout.ts:703`). So the forecast check moves to Week Scout's choice. This is needed for G1: without it, the forecast check scores these 54 users as intermediate and Week Scout scores them as beginners.
- **D3b. The engine (Steven: yes, 2026-11-09, "no skill users are treated as beginner").** The flagged call sites also pass beginner as `profileExperience` to the canonical engine instead of null. Effects for these users:
  - the beach-skill check runs, so beaches rated above beginner are vetoed;
  - the personal match verdict starts to apply (today the engine skips it when skill is unknown, `engine.ts` `skill === "unknown" ? null`).
- The default is a server rating rule. It does not write `experience_level` to the profile. The user stays "no level set", and D5 tells them.
- **Audience trap.** Do not set `skillSource` or `userTier` for these users. Native decides "general" vs "personal" from null-ness (native `use-surf-call.ts:648`, `:703`; `surf-decision.ts:140`). A non-null value would add "for your level" copy for a level the user never gave.
- About five call sites pass `profileExperience` (Week Scout `week-scout.ts:1236`, `bulk-decision-context.ts`, `resolveHeldBeaches`, the swell alert, the Daily Call). Each is flag-gated with its own test.

### D5. Tell no-skill users why they see a beginner rating (Steven, 2026-11-09)

Steven: "we should have a popup on next time they come and let them know why they are seeing the rating they are and how to change".

**Server signal.** Native cannot read the Vercel flag or the allowlist. So the server adds one optional boolean, `skillDefaultApplied`, to the `/api/surf/call` report, next to `skillSource` and `userTier`. It is `true` only when the flag is on, the user is allowlisted, the profile skill is null or blank, and the server scored this response as beginner. Otherwise the field is absent. An older server or flag off means no field, so the notice never shows (it fails closed). The field can also go on `/api/forecasts/scored/[beachId]` (`route.ts:575`) if Beach Detail needs it later.

**Trigger.** The first Home focus after a surf-call response with `source === 'api'` and `skillDefaultApplied === true`. It does not wait for a second visit, because the rating has already changed. Not in the session where the user finishes onboarding. Not for guests.

**Build.** Copy the founding gift (native #668, `src/features/founding-access/`):

- New folder `src/features/skill-default-notice/`: `useSkillDefaultNotice({ isFocused, ready: homeOfferReady, serverApplied })` and `SkillDefaultNoticeSheet`, with its own entry point like `gift.ts`.
- Mount in `home.tsx` next to `FoundingGiftSheet`. Gate on `homeOfferReady`, `InteractionManager`, a 1.5 s settle, the `canPresent` checks from `use-founding-gift.ts:46-64`, and `claimSessionAsk('skill_default_notice')`.
- Show once per user per device: AsyncStorage key `@quiver/skill-default-notice-shown/<uid>`, written at show time, plus an in-process Set.
- At present time, check again that the profile skill is still null. Never show while the profile is loading (`undefined`).
- **Look: a wooden sign that falls down on chains (Steven, 2026-11-09, with a reference picture).** Not a bottom sheet. A hanging sign drops from the top of the screen on two chains over a dimmed Home, swings, and comes to rest level:
  - Sign face: a wide wooden plank board (warm honey-brown wood with horizontal grain), a thin gold frame with a darker inner edge, and a brass nail in each corner. Two brass chains run from the top safe area to the top corners of the board.
  - Draw it ourselves (vector or our own bitmap asset). Do not use the reference picture, because its owner is unknown.
  - **Two looks, Steven picks from the mock:** (A) "Wood": the realistic plank above. (B) "Quiver style": the same plank and chains drawn flat in the app's own language: 2 px ink outlines, two or three flat wood tones from the brand palette, simple grain lines, ink chain links, brass nails as flat dots. Both use the same motion and copy. **Steven picked (B) "Quiver style" on 2026-11-09.** The wood look is not built.
  - **One look for every pop-up (Steven, 2026-11-09: "i want all popup notifications to look the same").** Build the sign as a shared component (for example `src/components/quiver-sign/`), not inside the notice folder. The notice is its first user. Later in-app pop-ups (the Record first-look pop-up, the founding gift, the second-chance offer) move to it in their own changes. System prompts (push permission, App Store review) stay as the OS draws them.
  - Text sits on the wood in dark ink with enough contrast (WCAG AA): the title as the sign heading (one line), then body and hint. The two buttons sit on the board: primary "Set my level", secondary "Keep beginner".
  - Motion (Reanimated): the sign drops with a spring and a small overshoot (about 600 ms), swings twice with damping (at most ±6°, pivot at the rope tops), and stops at 0°. Light haptic when it settles. On dismiss, the sign pulls back up (about 300 ms) and the dim fades.
  - **Sound (Steven, 2026-11-09: "like chains then when it hits the end").** A short chain rattle plays during the drop, and a wooden clunk plays when the sign reaches the end of the chains (the bottom of the drop, with the haptic). The pull-up exit plays a short, quiet chain rattle. Rules:
    - **Picked by Steven (2026-11-09):** `sign-chain.mp3` (0.6 s cut of "bike chain", freesound_community on Pixabay, sound 67811) and `sign-clunk.mp3` (0.45 s cut of "Wooden Thud (Mono)", freesound_community on Pixabay, sound 6244). Both are under the Pixabay Content License (free in an app, no credit; do not ship the files alone). The files and `SOURCES.md` are in quiver-native `docs/mocks/sounds/`; the build copies the two `sign-*` files into the app's assets. The exit plays `sign-chain.mp3` at a lower volume.
    - Use the audio library that the app already uses (the builder confirms it on `origin/main`). Do not add a new dependency for this.
    - Obey the iOS silent switch: no sound when the phone is silent. Mix with other audio and duck it; never stop the user's music or podcast.
    - Quiet volume (about 0.5). The sound plays one time for each show; it does not loop.
    - Reduced motion: no chain rattle, but the soft clunk plays at the fade-in.
    - When the sound fails to load or play, the sign still shows. A sound error is never shown to the user.
  - Reduced motion: no drop and no swing. The sign fades in at rest (about 200 ms).
  - Backdrop tap and Android back mean "Keep beginner". No emoji.
  - Brand note: the wood-and-chain look and the swing are an exception that Steven asked for. The rest of the app stays flat paper and ink. The tilt happens only in motion, and the sign rests straight.
- The behaviour (trigger, once only, latch, gates) still copies the founding gift; only the visual changes.

**Copy (brand voice).**

- Title: "Rated for a beginner" (other choice: "Calls set for a beginner").
- Body: "You haven't picked a level, so Quiver rates each call as if you're just starting out. Pick yours and the calls fit how you surf."
- Hint: "Change it anytime in Settings, under Surfing."
- Primary: "Set my level". Secondary: "Keep beginner".

**Actions.**

- "Set my level" closes the notice and opens the existing `SkillSheet` in place on Home. `SkillSheet` needs a `source` prop (today it hard-codes `source: 'value_first'`, `skill-sheet.tsx:37-41`) and must render outside the `showHomePersonalize` gate (`home.tsx:4647-4654`). On save, `useUpdateProfile` already refetches profile, surf call, discovery and Week Scout (`use-update-profile.ts:25-34`), so Home re-rates at once.
- "Keep beginner" closes the notice and writes nothing to the profile. The rating stays beginner. The notice does not return.

**Analytics (PostHog only).** `skill_default_notice_shown`; `skill_default_notice_dismissed { action: 'set_level' | 'keep' | 'backdrop' | 'back' }`; the existing `skill_added` with `source: 'default_notice'`. Measure the set-level rate.

**Order of release.** Server field first (absent while the flag is off). Then the native OTA (dormant until the field arrives). Then the flag and allowlist. Each prod step needs Steven's yes.

### D4. Rollout

- One env flag, `SKILL_AWARE_GO_CHECKS_ENABLED`, with an allowlist `SKILL_AWARE_GO_CHECKS_USER_ALLOWLIST`. Copy the pattern of `lib/flags/shared-call-ranking.ts`. Flag off means today's behavior, byte for byte, and every existing test passes unchanged with it off.
- D1, D2 and D3 all sit behind the flag. Week Scout reads the flag per user, so labels change only for allowlisted users.
- Steps (each prod env change needs Steven's yes):
  1. Ship dark through the daily release pool.
  2. Turn on for the same 4 Daily Call accounts. The parity task `daily-call-shared-ranking-parity` (07:00 PT, through Nov 23) already covers 3 of them, including the beginner `bcacdc51`.
  3. After one clean week, clear the allowlist.
- Before step 2, run a read-only replay (section 6) and show Steven the before/after go counts.

## 6. How we know it works

- **Replay script** (read-only, new): for the 4 accounts and a sample of 20 active beginners with boards, score the last 7 days of `enhanced_forecasts` in their pool both ways (flag off / flag on). Print, per user: go windows per day, days with at least one go, and every window that changed label, with height, period, wind and the deciding board. `enhanced_forecasts` keeps only about a week of history, so 7 days is the limit.
- **Parity:** `scripts/check-call-parity.ts` must keep saying AGREE for each allowlisted account. A new DIFFER after the flag turns on is a bug.
- **Expected direction:** more go days for the beginner account and for users with soft or long boards. No change for users with no boards and a non-beginner skill.

### 6a. Preview on Steven's accounts (2026-11-09, read-only)

A spike behind `SPIKE_GO_CHECKS` (local only, never committed) and `scripts/tmp-go-check-preview.ts` scored Nov 10–16 for both of Steven's accounts. Days with a Daily Call push:

| Account | Old path (no sessions) | Shared ranking (live at the next prod deploy) | Shared + this design |
|---|---|---|---|
| 610a5745 (intermediate, longboard) | 6 of 7 | 1 of 7 | 3 of 7 (adds Nov 11 and Nov 12, Scripps 7–9:30 AM, longboard) |
| 73040cff (advanced, shortboard) | 6 of 7 | 4 of 7 | 5 of 7 (adds Nov 12, La Fonda 1–3:30 PM, longboard); scores +3 to +5 |

- 610a5745 had 14 windows that changed label. All are `medium-mixed`, under 3 ft, with a longboard as the best board. No `small-weak` window changed. 73040cff had none.
- Adversarial checks: the design lens and the flag-off lens did not refute the spike (all 455 windows match the rule; flag off is unchanged).
- **Limit.** The harness does not reproduce this morning's sends (Mission Beach for 610a5745; Renes for 73040cff). Production sets `HOURLY_BRIDGE_ENABLED`, `NEXT_PUBLIC_WAVE_FIT_PLATEAU_ENABLED`, `TRUSTED_FORECAST_*` and `NEXT_PUBLIC_TIDE_SWING_ENABLED`, and the harness ran with them unset. Turning on the plateau flag alone moved Mission Beach from 74 to 88. Also, 73040cff's location fix was overwritten after the send. So the exact beaches can differ in production. The difference between the columns is valid, because all three columns use the same harness. The flag-and-allowlist gate matched the forced shared path for both accounts.
- **Finding for the shared-ranking rollout.** With the shared ranking alone, 610a5745 gets a push on 1 day of 7. The parity task watches beach agreement, not this drop in send days.

## 7. Tests

- `evaluateForecastVerdict`: no boards gives today's score; a longboard on 1 ft clean gives a higher score; a board never lets a beginner pass the 4 ft cap or an above-beginner beach.
- Daily Call: a beginner with a longboard on a clean 1–2 ft row now sends on the shared path (the verdict no longer mismatches); the same user with no boards behaves as today.
- Gate: in learner context, `medium-mixed` at 2.5 ft is "Worth it" at score 72 and "Maybe" at 3.5 ft; the onshore `small-weak` branches stay "Maybe"; outside learner context nothing changes.
- Null skill (D3): row score, Week Scout score and engine all use beginner; `skillSource` and `userTier` stay null.
- `skillDefaultApplied`: true only with flag on, allowlisted, null skill; absent otherwise. Paired contract fixtures in both repos.
- D5 notice: copy `use-founding-gift.test.tsx` (shows once, latch loses to another ask, skill set before show means no show and no key, guest never sees it, Keep writes nothing).
- Flag off: all existing tests pass unchanged.
- Before auto-merge: `/code-review high` (scoring and alert logic).

## 8. Left to the builder

- The exact file for the shared board loader and how the Daily Call batches it.
- How the flag reaches the gate (argument or a resolved context object).
- Whether `small-weak`'s branch is a new field or a finer category, as long as the label text and other callers do not change.
- Whether the board band already lowers the score for chop. D1b's gate is the guard either way; note what you find in the PR.
- **Must check: Week Scout caching.** Confirm that no cache keyed without the flag state serves one user's labels to another, or serves flag-off labels to an allowlisted user. If a cache key needs the flag state, add it.
- Native Beach Detail: record in the PR whether its phone-side score now disagrees with Week Scout for allowlisted users, and open a follow-up issue if it does. Do not change native in this work.

## 9. Steven decides

1. **D2 thresholds: approved** (2026-11-09, after the preview in section 6a). "Worth it" for learners on `medium-mixed` under 3 ft, and on weak-swell `small-weak` at 1 ft or more with a period of 6 s or more.
2. **D3b: decided yes** (2026-11-09). No-skill users are treated as beginners, engine included, and D5 tells them.
3. **Learner scope: decided yes** (2026-11-09). An intermediate on a longboard gets the learner gate.
4. **D5 "Keep beginner" (my call, open to change):** it writes nothing to the profile. Writing `beginner` would make the call "personal" with "for your level" copy.
