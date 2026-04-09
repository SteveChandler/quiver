# Calibration Honesty Layer — Visual Spec

**Status:** Ready for implementation
**Scope:** `components/ui/wave-height-display.tsx` (web) + `quiver-native/src/components/beach-card.tsx` and any native wave-height render site (native)
**Owner:** Design
**Implementation owner:** Engineer
**Brand reviewer:** Marketer (tooltip copy final call)

---

## 1. Context

Quiver surfaces a wave-height number for every beach. Today there are two backend pipelines producing that number:

| Pipeline | Count | What the number means | Visual treatment today |
|---|---|---|---|
| **Shoaling-calibrated** | 117 beaches | Face height at the break (what a surfer sees paddling out), derived from buoy data scaled by per-period shoaling factors calibrated against a year of Surfline LOTUS observations. | Standard number render. |
| **ML-only observable** | 63 beaches | Significant wave height at the buoy — NOAA/Open-Meteo forecast corrected by XGBoost. **Not the same physical quantity as face height.** Under-reports what a surfer sees at the break, often by 1.5–2.5×. | Standard number render (identical). |

A surfer reads `4 ft` at Blacks (face height) and `4 ft` at an ML-only beach (buoy Hs) without any signal that those numbers mean different things. That's a silent trust gap, and trust is the whole brand.

This spec adds a lightweight visual qualifier to the ML-only state. The happy-path calibrated number is unchanged.

---

## 2. Design Principles for this Feature

1. **The honest shrug is the brand voice.** A Waimea local doesn't call Rincon with the same confidence. Quiver showing that distinction is the brand speaking, not the brand apologizing.
2. **Qualify, don't warn.** The uncalibrated state is not an error. No red, no yellow, no alert icon. Just "we haven't dialed this one in yet."
3. **Character-level, not chrome-level.** The qualifier lives inside the number typography. No modals, no banners, no first-run explainers, no "BETA" badges.
4. **Text is the semantic layer.** Screen readers and keyboard users get the same signal from the `~` prefix and the label swap that sighted users get from the dotted underline.

---

## 3. Two States

### State A — Calibrated (happy path, 117 beaches)

**No visual change from today.**

```
┌────────────────────┐
│                    │
│   3-4 ft           │
│   Face height      │
│                    │
└────────────────────┘
```

- Number renders normally via existing component path.
- Label reads **"Face height"**.
- No prefix, no underline, no opacity change.

### State B — Uncalibrated (honesty layer, 63 beaches)

```
┌────────────────────┐
│                    │
│   ~ 3-4 ft         │
│     ⎯⎯⎯⎯⎯          ← 1px dotted, muted, digits only
│   Forecast height  │
│                    │
└────────────────────┘
```

- **Prefix:** `~` character, leading, with `0.5em` of trailing space before the number. The `~` is **not** underlined and **not** muted — it reads as part of the number typography but without the dotted decoration.
- **Dotted underline:** 1px dotted border under the digits only (not under the `~`, not under the ` ft` unit if we can isolate it — but the ` ft` unit is acceptable inside the underline if splitting the node adds implementation cost; see §4.3).
- **Color:** muted foreground, about 60% intensity. No warning color.
- **Label:** **"Forecast height"** replaces "Face height". Same position, weight, and size as the calibrated label.
- **Hover / focus (web only):** Radix tooltip reveals one line of microcopy (see §7).
- **Native:** No tooltip. Numeric node gets `opacity={0.7}`, the `~` prefix and label swap do the semantic work.

---

## 4. Web Implementation

### 4.1 Props

The existing `WaveHeightDisplayProps` interface already carries `dataSource`, `confidenceScore`, and `isMlCalibrated`. Add one new prop:

```ts
interface WaveHeightDisplayProps {
  height: string | null | undefined;
  showTooltip?: boolean;
  className?: string;
  dataSource?: string | null;
  confidenceScore?: number | null;
  isMlCalibrated?: boolean;
  /** True when this beach has shoaling-calibrated face-height. False = ML-only (buoy Hs). */
  isShoalingCalibrated?: boolean;
}
```

`isShoalingCalibrated` is the single switch between State A and State B. Default `true` (fail-safe to the happy path if a caller forgets to pass it).

> Implementation note for engineer: the backend flag to wire through is whatever the ML team exposes on the beach row (e.g. `beaches.has_shoaling_factors IS NOT NULL` or a dedicated `is_shoaling_calibrated` column). Designer is not prescribing the backend shape.

### 4.2 Tailwind class stack (copy/paste ready)

**Container span (State B):**
```tsx
<span className="inline-flex items-baseline gap-[0.5em]">
  <span aria-hidden="true" className="text-current">~</span>
  <span className="border-b border-dotted border-muted-foreground/60">
    {displayHeight}
  </span>
</span>
```

**Key class decisions:**

| Class | Why |
|---|---|
| `inline-flex items-baseline` | Prefix and digits share a baseline; no misalignment when font rendering varies. |
| `gap-[0.5em]` | Exactly 0.5em of horizontal space between `~` and the number, per spec. Scales with font-size. |
| `border-b` | Bottom border, 1px by default. |
| `border-dotted` | **Required.** Do NOT use the `underline` utility — `underline` is solid and reads as a link. Dotted reads as "approximate / penciled in". |
| `border-muted-foreground/60` | Muted foreground at 60% alpha. Low-key, not shouting. Adapts to theme tokens automatically. |
| `aria-hidden="true"` on `~` | The screen reader gets the calibration state from the label swap (§4.4), not from the tilde — prevents "tilde three dash four feet" read-out. |

**Calibrated state (State A) stays exactly as the existing component returns it** — no new classes, no wrapper changes. Pass `isShoalingCalibrated={true}` (or omit) and branch early:

```tsx
if (isShoalingCalibrated) {
  // existing render path, unchanged
}
// else — State B treatment below
```

### 4.3 What gets underlined

**Design intent:** only the digits + units get the dotted underline. The `~` prefix sits outside the underline.

**Acceptable simplification:** the full `{displayHeight}` string (e.g. `3-4 ft`) lives inside the underlined span. We are not asking the engineer to tokenize `3-4` vs ` ft` — a single span around the whole `displayHeight` string is correct.

**Not acceptable:** underlining the `~` as well, or underlining the entire container including the gap. The `~` must be visually outside the dotted line.

### 4.4 Label swap

The `wave-height-display.tsx` component as it stands today does not render a label — the label ("Face height", "Forecast height") is rendered by whichever parent surface embeds the component (beach card, forecast detail, sidebar, etc.). This spec does not move label rendering into the component; it simply documents the required label text at every call site.

**Rule for all surfaces that render a wave-height number with a label today:**

- `isShoalingCalibrated === true` → label text = **"Face height"** (this matches current copy for calibrated beaches — if the current copy is different, migrate it to "Face height" in the same PR).
- `isShoalingCalibrated === false` → label text = **"Forecast height"**.

No other styling changes to the label. Same weight, size, color, position as today.

### 4.5 Tooltip (web only)

Reuse the existing Radix `Tooltip` pattern in `components/ui/wave-height-display.tsx:140–216`. Do **not** introduce a new tooltip library. Do **not** add a second tooltip on top of the existing rich tooltip.

**Behavior:**

- When `isShoalingCalibrated === false`, the tooltip's primary content is the microcopy from §7.
- The existing rich tooltip content (data source, confidence score, ML badge explainer, data priority list) is **removed for State B**. One line is enough. The whole point of the honesty layer is restraint — do not re-add the corporate SaaS explainer just because we have a tooltip slot.
- When `isShoalingCalibrated === true`, the existing rich tooltip is kept as-is. State A is unchanged.
- `showTooltip={false}` callers (e.g. dense list views) still skip the tooltip entirely for both states. The `~` prefix, dotted underline, and label swap are enough on their own.

**Trigger target:** the entire inline-flex container (prefix + underlined digits). Not just the digits.

**Keyboard:** Radix's `TooltipTrigger` is focusable by default. No extra work — do not add `tabIndex` or `role="button"`. Confirm with a tab-through in dev.

---

## 5. Native Implementation

### 5.1 Scope

Native has multiple render sites for wave-height numbers (`beach-card.tsx`, beach detail header, forecast list row, etc.). This spec applies to **every** wave-height render site. The native team should extract a shared `WaveHeightText` component or helper if one does not exist — the designer is not prescribing where it lives, only what it renders.

### 5.2 Tamagui / React Native treatment

State B in native:

```tsx
<XStack alignItems="baseline" gap="$0.5">
  <Text color="$color" accessibilityElementsHidden>
    ~
  </Text>
  <Text color="$color" opacity={0.7}>
    {formattedWaveHeight}
  </Text>
</XStack>
```

**Key decisions:**

- **No tooltip.** Tooltips/popovers are not a pattern in `quiver-native` and introducing one is out of scope for this feature. The three-signal approach (`~` prefix, 70% opacity, label swap) carries the full weight of the honesty layer on mobile.
- **No dotted underline.** React Native does not support CSS `border-style: dotted` on text nodes reliably across iOS and Android, and faking it with a background image would be fragile. On native, **opacity replaces the dotted underline** as the "not dialed in" signal. The `~` prefix and label swap remain identical to web.
- **Opacity value:** `opacity={0.7}`. If the Tamagui opacity scale exposes a token like `$alpha.strong` or similar, prefer it — but literal `0.7` is fine and maps 1:1 to the web treatment's feel.
- **Gap:** `gap="$0.5"` on the XStack gives roughly 0.5× the base spacing token. If that reads tight at the current base font size, bump to `gap="$1"` — visual intent is "a noticeable but not awkward space", not a specific pixel count.
- **Baseline alignment:** `alignItems="baseline"`. If Tamagui's XStack does not support baseline alignment on the current version, fall back to `alignItems="center"` — the visual difference at the target font sizes is negligible.

### 5.3 Contrast check (native specifically)

Native always-dark theme base is Twilight navy `#252D6B`. The wave-height text color on beach cards is `Colors.white` or equivalent (see `beach-card.tsx:216`). At 70% opacity against Twilight navy:

- `#FFFFFF` × 0.7 on `#252D6B` ≈ effective foreground `#B2B2B2` on `#252D6B`
- Contrast ratio ≈ **7.1:1** — passes WCAG AA (4.5:1) and AAA (7:1) for normal text.

Safe to ship. The engineer should re-verify once the actual render site is wired up (the beach-card wave-height text sits on a dark photo gradient, not the flat card background, and the gradient is the relevant surface to test against).

### 5.4 Label swap (native)

Same rule as web: wherever a surface renders a "Face height" label today next to a wave-height number, swap it to **"Forecast height"** when `isShoalingCalibrated === false`.

In `beach-card.tsx` today there is no explicit "Face height" label — the wave-height number sits inside a conditions overlay badge. For the beach card specifically, **no label swap is needed in the overlay**; the `~` prefix and 70% opacity carry the signal. The label swap applies to surfaces that already render a "Face height" label (beach detail header, forecast list, etc.).

### 5.5 Accessibility (native)

- The `~` `Text` node should set `accessibilityElementsHidden` (iOS) / `importantForAccessibility="no"` (Android) so VoiceOver/TalkBack don't read "tilde three to four feet". The wave-height `Text` node announces its own content normally.
- Surfaces that swap the label ("Face height" → "Forecast height") inherit the semantic signal through the label text itself. No additional `accessibilityLabel` needed on the number.
- Opacity `0.7` is a presentation detail; screen readers ignore it. That is why the `~` prefix and label swap are non-negotiable — they are the *only* signals a screen reader user receives.

---

## 6. Spacing, Alignment, Hierarchy

| Concern | Decision |
|---|---|
| Does `~` add horizontal space or overlay? | **Adds space.** `~` and the number read as one unit (`~3-4 ft`), not as a badge floating next to a number. `gap-[0.5em]` on web, `gap="$0.5"` on native. |
| Does the dotted underline extend under the `~`? | **No.** Only under the digits + unit. The `~` is the qualifier; the dotted line is the "not dialed in" marker. They do different jobs and must read as separate signals. |
| Label position relative to number | **Unchanged from today.** Whatever pattern each surface already uses (label below number, label to the side, label in a tooltip) stays. This spec only changes the label *text*, not its position, weight, or size. |
| Line-height / baseline | Use `items-baseline` (web) and `alignItems="baseline"` (native). The number sets the line height; the `~` rides on the same baseline. No custom line-height tweaks. |
| Font weight | Same as the existing wave-height number. No bold, no light. The `~` inherits the same weight as the digits. |
| Font family | Inherits. On web, whatever the parent already sets (likely Space Grotesk or DM Sans per BRAND_GUIDE). On native, Inter. The `~` character is present in both — no fallback needed. |

---

## 7. Tooltip Microcopy (Web Only)

**Primary recommendation:**

> **"Buoy forecast. Face height at this break isn't dialed in yet."**

12 words, two sentences, no second-person, no apology, hints at eventual improvement without promising a date. "Dialed in" is surf vocabulary and carries the right connotation — it's something a local says, not something a brand says.

**Alternates (marketer picks):**

1. *"Buoy forecast — face height not yet dialed in for this break."* (original from requirements — 11 words, em-dash, works)
2. *"Raw buoy forecast. This break hasn't been dialed in yet."* (10 words, more passive, "raw" adds a subtle "we're showing you the unvarnished source" beat)
3. *"Buoy forecast. Haven't surfed this one enough to call face height."* (12 words, most voice-accurate — explicitly frames it as the local shrugging)

**Designer's pick if forced:** recommendation #1 ("Buoy forecast. Face height at this break isn't dialed in yet."). It is the shortest of the four that still carries the "we know the difference, we just haven't closed the gap at this specific spot" subtext.

**Marketer decision needed:** pick one of the four. The engineer will hardcode whichever is chosen as a constant in the component file. Do not make this user-configurable, do not A/B test it — it's 12 words, ship the one that sounds right.

**Rejected framings (do not use):**

- ~~"We're working on calibrating this beach. Check back soon!"~~ — corporate apology, second-person "we", exclamation mark, promises a date we can't keep.
- ~~"⚠️ Uncalibrated forecast — accuracy may vary."~~ — warning icon, the word "uncalibrated" is jargon, "accuracy may vary" is disclaimer text from a mutual fund prospectus.
- ~~"Beta: ML-only forecast for this break."~~ — "Beta" and "ML" are internal implementation vocabulary, not user language.
- ~~"This is a buoy forecast, not a calibrated face-height estimate derived from empirical shoaling factors."~~ — technically correct, terminally unreadable.

---

## 8. Brand Voice Alignment — Red Flags to Avoid

| Anti-pattern | Why not |
|---|---|
| **Modal overlay on first view** explaining the two-pipeline distinction | Corporate transparency theater. A local doesn't pull you aside and hand you a disclaimer before they tell you the surf report. |
| **Red or yellow warning color** on the uncalibrated number | We are not saying the number is wrong. We're saying face height at *this* break isn't dialed in. Warning colors imply error; this is humility. |
| **"BETA" badge** or similar label clutter | The dotted underline IS the badge. Adding a word next to it is belt-and-suspenders and reads like a corporate product tour. |
| **Info icon** (`InfoIcon` / `ⓘ`) next to the number | The `~` prefix is the only character-level decoration. An info icon makes the number look like a footnote from a tax form. |
| **Tooltip with a paragraph explainer** | One sentence. The existing rich tooltip content in `wave-height-display.tsx:149–211` is removed for State B, not augmented. |
| **Different font / weight / color** for the uncalibrated number | The typography is the same. Only the dotted underline + `~` prefix + 70% opacity (native) changes. The number itself is still the number. |

---

## 9. Accessibility Summary

| Signal | Sighted user | Screen reader user | Keyboard user |
|---|---|---|---|
| `~` prefix | Sees the tilde | **`aria-hidden` / `accessibilityElementsHidden`** — skipped | Not focusable on its own |
| Dotted underline (web) | Sees the dotted line | Ignored (CSS border, not semantic) | Not focusable |
| 70% opacity (native) | Sees the muted number | Ignored (presentation) | N/A |
| Label text swap ("Face height" → "Forecast height") | Reads the label | **Reads the label** — this is the primary semantic signal | Reads in source order |
| Tooltip (web only) | Hover / focus reveals | Radix exposes via `aria-describedby` | Tab to trigger, tooltip opens on focus |

**Key guarantee:** a screen reader user distinguishes calibrated from uncalibrated entirely from the label text ("Face height" vs "Forecast height"). The dotted underline, opacity, and `~` prefix are visual redundancy for sighted users. This is why the label swap is non-negotiable on every surface that renders a label today.

**Contrast:**
- Web dotted underline uses `border-muted-foreground/60`, which inherits from the theme's muted foreground token. The existing `muted-foreground` token already passes WCAG AA against all Quiver surface backgrounds (this is its job). 60% alpha on a token that passes at 100% is still legible for its role as a decorative border (it is not body text). Acceptable.
- Native 70% opacity on `#FFFFFF` against Twilight navy `#252D6B` = 7.1:1 contrast ratio. Passes AAA.

**Reduced motion:** this feature adds no animation. Nothing to gate on `prefers-reduced-motion` / `AccessibilityInfo.isReduceMotionEnabled`.

---

## 10. Implementation Checklist for the Engineer

- [ ] Add `isShoalingCalibrated?: boolean` prop to `WaveHeightDisplayProps` (default `true`)
- [ ] Wire the backend flag through from the beach row to every call site of `WaveHeightDisplay` (web) and the equivalent native helper
- [ ] Branch early in `wave-height-display.tsx`: if `isShoalingCalibrated`, return existing render path unchanged
- [ ] Implement State B JSX per §4.2
- [ ] Replace rich tooltip content with single-line microcopy (§7) for State B
- [ ] Update every parent surface that renders a "Face height" label to swap to "Forecast height" when `isShoalingCalibrated === false`
- [ ] Native: implement State B `XStack` per §5.2
- [ ] Native: update every label-rendering surface (detail header, forecast list) to swap label text
- [ ] Verify keyboard tab-through on web opens the tooltip on focus (Radix default behavior)
- [ ] Verify VoiceOver / TalkBack reads "Forecast height three to four feet" for State B (not "tilde three to four feet")
- [ ] Playwright MCP smoke test: screenshot State A and State B side by side on a beach card and on a beach detail page
- [ ] No console errors, no TypeScript errors, no lint warnings

---

## 11. Open Questions for Day 2

1. **Backend flag name.** What is the canonical prop/field — `isShoalingCalibrated`, `hasShoalingFactors`, `calibrationPipeline: 'shoaling' | 'ml'`? Designer has no opinion; engineer or ML team picks. Spec uses `isShoalingCalibrated` as a placeholder.
2. **Current "Face height" label copy.** Some surfaces today may render "Wave height", "Surf", "Size", or nothing at all instead of "Face height". If the label is currently "Wave height" on calibrated beaches, does the spec still require migrating it to "Face height"? Designer's recommendation: **yes** — "Face height" is the accurate name for the calibrated quantity, and making the label precise on State A is half the reason State B's "Forecast height" swap carries signal. But this is a scope expansion worth confirming with the PM before the engineer touches every call site.
3. **Forecast list density.** On surfaces like the 7-day forecast list where a tooltip is impractical (dense rows, hover per cell feels noisy), should the tooltip be suppressed via `showTooltip={false}` in State B? Designer's recommendation: **yes** — the `~` prefix + dotted underline + label swap are enough without a hover target on every cell. Engineer should default `showTooltip` to the existing behavior and only override in list contexts where hover-per-row is already suppressed for State A.
4. **Tooltip final copy.** Four options in §7. Marketer picks.

---

**End of spec.**
