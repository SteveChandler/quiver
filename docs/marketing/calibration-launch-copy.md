# Calibration Launch Copy

## Final tooltip microcopy

**Buoy forecast. Haven't surfed this one enough to call face height.**

(12 words. Designer's alternate #3. Picked over the primary because it's the most voice-accurate — it's a local shrugging, not a product explaining. "Haven't surfed this one enough" carries the earned humility the brand is built on; "isn't dialed in yet" reads slightly more product-manager by comparison.)

## CHANGELOG entry

### Added
- **Calibration honesty layer on wave-height numbers** — every wave-height number in Quiver now tells you whether it's a calibrated face-height estimate or a raw buoy forecast. Beaches we've dialed in keep rendering the same way under a "Face height" label. Beaches we haven't surfed enough to call get a leading `~`, a dotted underline under the digits, and a "Forecast height" label. Hover reveals one line: "Buoy forecast. Haven't surfed this one enough to call face height." No warning colors, no beta badges, no modal — the typography does the work. A Waimea local doesn't call Rincon with the same confidence, and the app shouldn't either; showing you which breaks we know cold and which ones we don't is the point. 117 of 180 beaches render as face height today; the remaining 63 get the honesty treatment until they're dialed in.

## Push notification variants

### Variant 1: Direct
- Title: `Which heights are dialed in, which aren't`
- Body: `Quiver now shows you which wave-height numbers we've actually calibrated and which ones are still a raw buoy forecast. Open the app and check your home break.`

### Variant 2: Surfer-vocab
- Title: `Face height vs. forecast height`
- Body: `117 breaks we've surfed enough to call. 63 we haven't yet. Those ones render with a tilde and a dotted underline now, so you always know what you're reading.`

### Variant 3: Brand-philosophy
- Title: `Some breaks we know cold. Some we don't.`
- Body: `A local doesn't call every spot with the same confidence. Quiver doesn't either. Every wave-height number now shows you which side of that line it's on.`

## Tweet thread

**Tweet 1**
A Waimea local doesn't call Rincon with the same confidence. Quiver shouldn't either. Every wave-height number in the app now tells you whether it's a break we've actually dialed in, or one we haven't surfed enough yet to call face height. That's the whole update.

**Tweet 2**
The calibrated breaks render like always, under a "Face height" label. The ones we haven't dialed in get a leading `~`, a dotted underline, and "Forecast height" instead. One extra character, zero warning colors. No beta badges, no modal, no apology — just the number and what it is.

**Tweet 3**
117 of 180 breaks are calibrated against a year of paired face-height observations. The other 63 are honest about being a raw buoy signal until they aren't. Knowing which is which is more useful than pretending every number means the same thing. Check your home break.

## Voice notes / alternates

- **Why "dialed in" over "calibrated"** across the push notifications and tweets: "calibrated" is the accurate technical term and earns its place in the changelog, but in the app-facing voice it's a lab word. "Dialed in" is what a surfer says about a break they know cold. Kept the changelog technical-ish (the audience is developers + power users reading release notes) and the push/tweet voice surfer-to-surfer.
- **Why no `~` as a written word** in any of the copy: the visual marker carries that meaning in the app. Describing it in prose as "the tilde" or "the squiggle" undercuts the restraint. The tweet mentions it as `~` because showing the character is more honest than naming it.
- **Why the label swap isn't the hero of the changelog bullet**: the dotted underline + `~` is the moment a user actually notices the feature. "Forecast height" vs "Face height" is the semantic backstop for screen readers and for users who learn the pattern over time. Led with the visual because that's what people will see first.
- **Rejected tweet 1 opener**: "A small thing shipped today: every wave-height number in Quiver now tells you..." — too "dear diary", felt like a changelog entry trying to be a tweet. Cut.
- **Rejected push variant**: "Title: 'New: calibrated face heights' / Body: 'N breaks updated.'" — "New:" is product-launch voice, not surf voice. Cut.
- **Rejected philosophical push body**: "A Waimea local wouldn't call Rincon the same way. Now the app admits it too." — too cute, and "admits" frames it as an apology, which is exactly what the spec warns against. Softened to "a local doesn't call every spot with the same confidence — neither should the app."
- **Tweet 3 almost ended** with "Your home break is probably already dialed in." — cut because it risks reading like a reassurance for people whose home break *isn't* dialed in. The current ending is neutral and trusts the reader to check.
- **Why tweet 1 leads with Waimea/Rincon** in the reframe: the honesty layer is the whole launch now, so the brand-defining analogy earns the opener. It puts the philosophy in front and lets the mechanic (tweet 2) and the receipts (tweet 3) back it up, instead of burying the point in tweet 3 like the original draft did.
- **Why "117 of 180" is stated explicitly** in tweet 3: with no "N new breaks" hook, the proof that we've actually done the work has to live somewhere. The raw count is the receipt — it makes "we've dialed in the ones we've dialed in" a provable claim instead of a posture.

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
