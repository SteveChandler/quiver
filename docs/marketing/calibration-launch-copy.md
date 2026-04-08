# Calibration Launch Copy

## Final tooltip microcopy

**Buoy forecast. Haven't surfed this one enough to call face height.**

(12 words. Designer's alternate #3. Picked over the primary because it's the most voice-accurate — it's a local shrugging, not a product explaining. "Haven't surfed this one enough" carries the earned humility the brand is built on; "isn't dialed in yet" reads slightly more product-manager by comparison.)

## CHANGELOG entry

### Added
- **Calibration honesty layer on wave-height numbers** — beaches where the displayed height comes from a raw buoy forecast (not a calibrated face-height estimate) now render with a leading `~`, a dotted underline under the digits, and a "Forecast height" label instead of "Face height". Hover reveals one line: "Buoy forecast. Haven't surfed this one enough to call face height." A Waimea local doesn't call Rincon with the same confidence — the app shouldn't either. No warning colors, no beta badges, no modal; the typography does the work. 117 of 180 beaches render as face height today; the remaining 63 get the honesty treatment until they're dialed in.

### Changed
- **Shoaling calibration extended to [N] more breaks** — [Beach A], [Beach B], [Beach C, ...and the rest]. These beaches moved from the ML-only forecast pipeline to the per-period shoaling pipeline calibrated against a year of paired face-height observations, which means the displayed number is now what you'd actually see paddling out, not what the buoy sees offshore. Same wave-height component, same number format — the `~` and the "Forecast height" label just quietly drop off these spots. Calibration pipeline at `seaside/scripts/shoaling_calibration_pipeline/`.

## Push notification variants

### Variant 1: Minimal
- Title: `[N] more breaks just got dialed in`
- Body: `Face heights for [N] spots moved from forecast to calibrated. Open Quiver to check your home break.`

### Variant 2: Specific name-drop
- Title: `We know [Beach A] now`
- Body: `[Beach A], [Beach B], and [N-2] more breaks just got dialed in. Face heights are calibrated to what you actually see at the break.`

### Variant 3: Philosophical
- Title: `Face heights got more honest`
- Body: `[N] more breaks now show face height instead of a buoy forecast. A local doesn't call every spot with the same confidence — neither should the app.`

## Tweet thread

**Tweet 1**
Wave-height numbers in Quiver now tell you which ones we've actually dialed in. Calibrated breaks render like always. The ones we haven't surfed enough to call face height show a `~` and a dotted underline. One extra character, zero warning colors. That's the whole thing.

**Tweet 2**
And today [N] more breaks moved from forecast to calibrated: [Beach A], [Beach B], [Beach C, ...]. Face heights at these spots are now scaled against a year of paired observations instead of a raw buoy signal. The `~` quietly comes off.

**Tweet 3**
We don't know every break equally. A local doesn't either. Showing that distinction is the point — not a disclaimer, just honesty. Open the app and check your home break.

## Voice notes / alternates

- **Why "dialed in" over "calibrated"** across the push notifications and tweets: "calibrated" is the accurate technical term and earns its place in the changelog, but in the app-facing voice it's a lab word. "Dialed in" is what a surfer says about a break they know cold. Kept the changelog technical-ish (the audience is developers + power users reading release notes) and the push/tweet voice surfer-to-surfer.
- **Why no `~` as a written word** in any of the copy: the visual marker carries that meaning in the app. Describing it in prose as "the tilde" or "the squiggle" undercuts the restraint. The tweet mentions it as `~` because showing the character is more honest than naming it.
- **Why the label swap isn't the hero of the changelog bullet**: the dotted underline + `~` is the moment a user actually notices the feature. "Forecast height" vs "Face height" is the semantic backstop for screen readers and for users who learn the pattern over time. Led with the visual because that's what people will see first.
- **Rejected tweet 1 opener**: "A small thing shipped today: every wave-height number in Quiver now tells you..." — too "dear diary", felt like a changelog entry trying to be a tweet. Cut.
- **Rejected push variant**: "Title: 'New: calibrated face heights' / Body: 'N breaks updated.'" — "New:" is product-launch voice, not surf voice. Cut.
- **Rejected philosophical push body**: "A Waimea local wouldn't call Rincon the same way. Now the app admits it too." — too cute, and "admits" frames it as an apology, which is exactly what the spec warns against. Softened to "a local doesn't call every spot with the same confidence — neither should the app."
- **Tweet 3 almost ended** with "Your home break is probably already dialed in." — cut because it risks reading like a reassurance for people whose home break *isn't* dialed in. The current ending is neutral and trusts the reader to check.
