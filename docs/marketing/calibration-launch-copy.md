# Calibration Launch Copy

Final copy for Release #187 launch-day fire. All surfaces below are locked
and launch-ready after Brand Guardian + Behavioral Nudge Engine review
(2026-04-09). Fire sequence documented at the bottom.

## Final tooltip microcopy

**Buoy forecast. Haven't surfed this one enough to call face height.**

(12 words. Designer's alternate #3. Picked because it's a local shrugging,
not a product explaining. Already hard-coded in
`components/ui/wave-height-display.tsx` as `UNCALIBRATED_TOOLTIP_COPY`.)

## CHANGELOG entry

Already committed to `main` under `[Unreleased] → Added` as of
`e5d9e931` (in Release PR #187). Tightened per Brand Guardian review
(`2d7086fe..`): replaced "keep rendering the same way under a" with
"render as" to drop the engineer-voice tell.

## Push notification — fire this variant

Only ONE variant ships. V3 was picked over V1 and V2 because its title is
a philosophy statement, not a feature announcement — which is the whole
wedge against the competitor positioning. Brand Guardian + Behavioral
Nudge Engine both converged on V3.

### ✅ CHOSEN: V3 — Brand-philosophy

- **Title:** `Some breaks we know cold. Some we don't.` (40 chars)
- **Body:** `A local doesn't call every spot with the same confidence. Quiver doesn't either. Every wave-height number now shows you whether we've surfed it enough to call it.` (164 chars)

Nudge Engine tweaked the body ending from "which side of that line it's on"
to "whether we've surfed it enough to call it" — uses the load-bearing
surf vernacular verb **call** twice in the package (also in tweet 1) to
tighten voice and give the reader a concrete visualizable action instead
of an abstract metaphor.

### Why not the alternates

- **V1 — Direct:** `Which heights are dialed in, which aren't` / explainer body. Reads like a product changelog. Gets swiped on a lockscreen glance. Nudge Engine: "'calibrated' is a system word, not a surfer word."
- **V2 — Surfer-vocab:** `Face height vs. forecast height` / "117 breaks... 63 we haven't." Brand Guardian: repeats the 117/63 receipt that's already in the CHANGELOG AND tweet 3, which starts to feel like you're asking the reader to be impressed by the coverage ratio. The local who knows doesn't quote his own stats. Killed.

## Tweet thread — reordered to 1 → 3 → 2

Nudge Engine flagged the original 1→2→3 order had a drop-off risk at
tweet 2 (pure mechanic, no emotional payoff). Reordered so the reader
gets philosophy → receipts → mechanic. Philosophy hooks, receipts earn
trust, mechanic is the last slot for the committed reader who's still
engaged. Brand Guardian's "no apology" cut applied to the now-final tweet.

### Tweet 1 (philosophy hook — unchanged)
> A Waimea local doesn't call Rincon with the same confidence. Quiver shouldn't either. Every wave-height number in the app now tells you whether it's a break we've actually dialed in, or one we haven't surfed enough yet to call face height. That's the whole update.

### Tweet 2 (receipts + CTA — was tweet 3)
> 117 of 180 breaks are calibrated against a year of paired face-height observations. The other 63 are honest about being a raw buoy signal until they aren't. Knowing which is which is more useful than pretending every number means the same thing. Check your home break.

### Tweet 3 (mechanic — was tweet 2, "no apology" cut)
> The calibrated breaks render like always, under a "Face height" label. The ones we haven't dialed in get a leading `~`, a dotted underline, and "Forecast height" instead. One extra character, zero warning colors. No beta badges, no modal — just the number and what it is.

## Launch timing

**Fire the push at 6:45–7:15pm LOCAL time**, segmented by user timezone.

Behavioral Nudge Engine's recommendation. Dawn-patrol users are actively
using the app to check real conditions — interrupting a real surf check
with meta-information about the app itself is the worst possible context.
Evening is when surfers do **reflective checking** (tomorrow's forecast,
weekend planning), which is exactly the cognitive mode where a trust-signal
update lands. Bonus: higher Twitter engagement window overlaps.

If timezone segmentation isn't supported by the broadcast endpoint today,
fire in a Pacific time window (largest user concentration is California)
and accept the East Coast users get it a little late, not early.

## Fire sequence (after PR #187 merges and www.quiversurf.app deploys)

1. **Verify prod deploy** — same Playwright check that passed on dev.
   Blacks (`/ca/san-diego/blacks`) shows 3 "Face height" labels, 0 `~`
   prefixes. Bolinas (`/ca/bolinas/bolinas-bolinas-ca`) shows the
   honesty layer with `~` prefix, dotted underline class, "Forecast
   height" label, and the tooltip copy on hover.
2. **Smoke-test the broadcast endpoint** — `POST /api/admin/broadcast-push`
   with `{"title": "test", "body": "test", "maxUsers": 1}` pointed at
   your own user ID first. Verify FCM round-trip.
3. **Fire the real broadcast push** with the V3 copy above, during the
   6:45–7:15pm local window. Admin session required.
4. **Post the 3-tweet thread** manually. 60-second gap between tweets.
5. **Post-launch spot-check** — 3 calibrated + 3 uncalibrated beaches,
   confirm render is stable across cache layers (Vercel ISR + Next.js
   page cache + any CDN in front).

## Voice notes / rejected alternates

- **Why "dialed in" over "calibrated"** across push + tweets: "calibrated"
  is the accurate technical term and earns its place in the changelog,
  but in the app-facing voice it's a lab word. "Dialed in" is what a
  surfer says about a break they know cold. Kept the changelog
  technical-ish (audience is developers + power users reading release
  notes) and the push/tweet voice surfer-to-surfer.
- **Why no `~` as a written word** in any of the copy: the visual marker
  carries that meaning in the app. Describing it in prose as "the tilde"
  or "the squiggle" undercuts the restraint. The tweet mentions it as
  `~` because showing the character is more honest than naming it.
- **Why the label swap isn't the hero of the changelog bullet**: the
  dotted underline + `~` is the moment a user actually notices the
  feature. "Forecast height" vs "Face height" is the semantic backstop
  for screen readers and for users who learn the pattern over time.
  Led with the visual because that's what people will see first.
- **"No apology" was cut from the mechanic tweet** (per Brand Guardian):
  naming the thing you're trying not to do makes the reader notice you
  were tempted. The restraint itself is the flex; no need to flag it.
- **Rejected tweet 1 opener**: "A small thing shipped today: every
  wave-height number in Quiver now tells you..." — too "dear diary",
  felt like a changelog entry trying to be a tweet. Cut.
- **Rejected push variant**: "Title: 'New: calibrated face heights' /
  Body: 'N breaks updated.'" — "New:" is product-launch voice, not surf
  voice. Cut.
- **Rejected philosophical push body**: "A Waimea local wouldn't call
  Rincon the same way. Now the app admits it too." — too cute, and
  "admits" frames it as an apology, which is exactly what the spec warns
  against. Softened to "a local doesn't call every spot with the same
  confidence — neither should the app."
- **Tweet 3 almost ended** with "Your home break is probably already
  dialed in." — cut because it risks reading like a reassurance for
  people whose home break *isn't* dialed in.

## Post-launch brand watch (Brand Guardian flag)

Don't let "our new honesty layer" become a phrase in any future
marketing surface. The internal feature name is fine. The public-facing
wedge is **showing** honesty, not **claiming** it. The moment the word
"honesty" appears in a tweet or a push title, the wedge turns into a
brag. Keep it in engineering docs only.

## Why the "N new breaks dialed in" angle was dropped

Original Day 1 plan included a Workstream B that would run the shoaling
calibration pipeline against the 63 observable ML-only beaches and produce
a "N new breaks just got dialed in" launch hook. SQL audit on launch eve
showed that ALL 183 uncalibrated beaches (63 observable + 120 not) have
`cdip_station IS NULL` — the calibration pipeline cannot run on them
without first assigning CDIP stations, which is a manual analyst task
(multi-hour spike) that's now deferred to a follow-up.

So the launch is the honesty layer alone. The existing 117 calibrated
beaches still get the "Face height" label (no change), the 63 ML-only
beaches get the new ~ + dotted underline + "Forecast height" treatment.

Future launches can pull the "N new breaks dialed in" angle back in
once the analyst spike has produced new cdip_station assignments and
a fresh shoaling pipeline run has populated their factors.
