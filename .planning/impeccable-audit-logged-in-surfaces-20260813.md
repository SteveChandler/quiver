# Interface Audit — Quiver Web, Core Logged-In Surfaces

**Date:** 2026-08-13
**Scope:** 166 files — beach detail (`components/beach-detail/**`, `app/beach/**`, `app/[intent]/**`), forecast (`components/forecast/**`, `app/forecast/**`), journal & sessions (`components/journal/**`, `components/session*`, `components/session-forms/**`), alerts (`components/alerts/**`, `app/alerts/**`), zine shell (`components/beach-detail/zine/**`).
**Design context:** `quiver/.impeccable.md` + `quiver/CLAUDE.md` §Design Context.
**Method:** static scan + manual verification of every reported finding. Candidates that turned out to be correctly implemented are listed under *Verified Non-Issues* rather than reported.

> **Remediation status (2026-08-13, `/harden` pass on `components/alerts/` + `components/session-forms/`)**
> **Closed:** C-1, C-2, H-2 (both directories), H-3, and the 4 in-directory instances of H-1.
> Re-scan of both directories reports 25 form controls / **0 unnamed**, 0 orange-on-white CTAs, 0 sub-4.5:1 placeholders, 0 hover-only reveals, 0 colour-only validation states.
> Verified by `__tests__/components/alerts/condition-builder.a11y.test.tsx` (7 tests, confirmed to fail when the `aria-label`s are removed), `yarn typecheck`, scoped ESLint, and 883 passing Jest tests.
> **Still open:** H-1 at 16 sites outside these two directories, H-4, H-5, H-6, and all Medium/Low findings.

---

## 1. Anti-Patterns Verdict

**PASS, with one contained failure.**

If you showed these surfaces to someone and said "AI made this," they would not believe you. The zine identity is real and load-bearing: 68 intentional `rotate-*` utilities, 124 mono-type usages, asymmetric radii (`rounded-[14px_6px_16px_6px]`), hard offset shadows (`shadow-[2px_2px_0_...]`) instead of soft drop shadows, cream-on-twilight rather than dark-mode-with-glow. Empty states are written by someone who thought about them (`zine-recent-sessions.tsx:28` deliberately renders *nothing* rather than a "No sessions yet" shrug; `beach-alert-cta.tsx:81` avoids flashing "no alerts" during load).

Checked against the full DON'T list:

| AI slop tell | Status |
|---|---|
| Gradient text (`bg-clip-text`) | **Clean** — 0 occurrences |
| Nested cards | **Clean** — 0 occurrences |
| Hero-metric template | **Clean** |
| Bounce/elastic easing as default | **Clean** — springs are used on discrete state changes, not page load |
| Generic fonts (Inter/Roboto) | **Clean** — Space Grotesk / DM Sans / Space Mono / Caveat |
| Identical card grids | **Mostly clean** — 46 `grid-cols-3/4`, but they hold *data* (stats, forecast days), not icon+heading+text cards |
| Rounded-2xl + generic drop shadow | **7 occurrences** — minor |
| Glassmorphism | **16 files** — concentrated, see below |
| AI color palette (cyan-on-dark, purple gradients) | **FAIL in 5 files** |

**The one real failure — `components/beach-detail/spot-overview.tsx:152-155`:**

```
rounded-2xl backdrop-blur-sm bg-gradient-to-br from-white/80 to-cyan-50/60
border-cyan-200/50 shadow-lg
  ↳ CardHeader: bg-gradient-to-r from-cyan-50/80 to-teal-50/80
  ↳ <MapPin className="text-teal-600" /> "Spot Summary"
```

That is glassmorphism + cyan/teal gradient + rounded-2xl + soft drop shadow, stacked on one component, on a white surface rather than cream paper. It hits four anti-references at once and reads as a different product than the card next to it. This component predates the zine migration and was never brought across.

Secondary: `#00D4AA` (mint) appears in `SessionFitPicker.tsx:131`, `session-intelligence/best-surf-windows.tsx:38`, `source-confidence-badge.tsx:53`. It is not in the 27-token palette in `app/styles/zine.css`, and mint-on-navy is the exact anti-reference the design context names.

---

## 2. Executive Summary

**19 findings: 2 Critical · 6 High · 7 Medium · 4 Low.**

The design layer is in good shape. **The failures are almost entirely in the plumbing beneath it** — form semantics and color literals — and they cluster in the two surfaces that carry the most product weight: **the alert rule builder** (the premium feature) and **the session log form** (the core habit loop).

Top 5:

1. **The alert rule builder is unusable with a screen reader.** `condition-builder.tsx` has 8 form controls with no accessible name at all — the visible labels are `<span>` elements with no programmatic association. WCAG 1.3.1 / 4.1.2 **Level A**.
2. **Session photos cannot be removed on a phone.** The remove-photo button is `opacity-0 group-hover:opacity-100` — there is no hover on touch — and it is 24×24px with no accessible name. WCAG 2.1.1 **Level A**.
3. **A WCAG fix that already shipped has silently regressed.** `tailwind.config.ts:26-30` documents that `#F78E42` on white is 2.36:1 and says *"NEVER use as button background with white text."* The token was changed to `#9E5010` (5.82:1) — but **20 components repo-wide (6 in this scope) still hard-code `bg-[#F78E42] text-white`**, routing around the fix.
4. **Visual-only labels across the session log form.** `<label>` without `htmlFor`, input as a sibling — the label is decoration, not a label. Confirmed in `DateTimeSection.tsx` (×3), `NotesSection.tsx`, `ConditionsStep.tsx` (×4).
5. **Four placeholder-text contrast failures**, worst at 1.67:1.

**Quality score: 7/10.** Design identity 9/10. Accessibility 4/10. Theming discipline 5/10. Performance 8/10. Responsive 8/10.

**Next step:** `/harden` on `components/alerts/` and `components/session-forms/` clears both Criticals and three of the six Highs.

---

## 3. Detailed Findings

### Critical

---

**C-1 · Alert rule builder has no accessible names on any control**
**Location:** `components/alerts/condition-builder.tsx` — lines 225, 240, 263, 296, 309, 325, 340, 363
**Category:** Accessibility · **WCAG 1.3.1 Info and Relationships (A), 4.1.2 Name Role Value (A)**

The condition label renders as a plain `<span>` (line 219) with no `id`, and the inputs carry no `id`, `aria-label`, or `aria-labelledby`. The `<select>` at line 296 (wind direction: Offshore / Onshore / Cross-shore) has no accessible name whatsoever.

**Impact:** A screen reader user building an alert hears "edit, blank" eight times in a row. Two number inputs distinguished only by the placeholders "min ft" / "max ft" are announced identically once focused. This is the premium subscription feature — the paywalled capability is inaccessible.

**Recommendation:** Give the wrapper `<span>` an `id`, point each control at it with `aria-labelledby`, and add `aria-label` for the min/max distinction (`aria-label="Minimum swell height (ft)"`). The `<select>` needs its own `aria-label="Wind direction"`.
**Command:** `/harden`

---

**C-2 · Session photos cannot be removed on touch devices**
**Location:** `components/session-forms/PhotoSelectionSection.tsx:292-296`
**Category:** Accessibility / Responsive · **WCAG 2.1.1 Keyboard (A), 4.1.2 (A), 2.5.5 Target Size (AAA)**

```tsx
<Button type="button" variant="destructive" size="sm"
  className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0
             opacity-0 group-hover:opacity-100 transition-opacity">
  <X className="h-3 w-3" />
</Button>
```

Three compounding failures: (a) `opacity-0` with reveal only on `group-hover` — touch devices have no hover state, so the control is invisible and effectively nonexistent on mobile; (b) `h-6 w-6` = 24×24px against a 44px guideline; (c) no `aria-label` on a destructive action.

**Impact:** Quiver's core loop is *log the session at the beach* — on a phone. A surfer who attaches the wrong photo cannot remove it without abandoning the form. Keyboard users can focus an invisible button.

**Recommendation:** Drop `opacity-0`, or gate it behind `@media (hover: hover)`. Size to `h-11 w-11` (or keep the visual dot and expand the hit area with a pseudo-element). Add `aria-label={`Remove photo ${index + 1}`}`.
**Command:** `/harden`, then `/adapt` for the touch-target pass

---

### High

---

**H-1 · Primary CTAs re-introduce a documented 2.36:1 contrast failure**
**Location:** 6 in scope — `beach-detail.tsx:1005`, `beach-detail/beach-alert-cta.tsx:238`, `session-forms/BeachChip.tsx:79`, `alerts/anon-alert-capture-form.tsx:193`, `alerts/alert-creation-popover.tsx:343`, `session/post-session-share.tsx:165`. **20 repo-wide.**
**Category:** Accessibility / Theming · **WCAG 1.4.3 Contrast Minimum (AA)**

`bg-[#F78E42]` + `text-white` = **2.36:1** (AA requires 4.5:1). `tailwind.config.ts:23-31` already carries the fix and the warning:

```ts
// Updated to #9E5010 (27° 82% 34%) — WCAG AA compliant: 5.82:1 on white.
// Previous value #F78E42 was 2.36:1 (WCAG AA fail for normal text).
"ocean-blue": "#9E5010",
// NEVER use as button background with white text — 2.36:1 fails WCAG AA.
"ocean-blue-decorative": "#F78E42",
```

The token layer is correct and the landing-page components use it correctly (`bg-ocean-blue-decorative text-background` = 5.34:1). These 20 sites bypass the token with a raw hex literal, so the fix never reached them and no lint rule catches it.

**Impact:** "Create Alert," "Save Session," and "Share" — the highest-intent buttons in the product — are hard to read in daylight. This is the pre-dawn-on-the-beach use case exactly. It is also a compliance regression on an already-remediated issue.

**Recommendation:** Replace with `bg-ocean-blue text-white` (5.82:1) or `bg-ocean-blue-decorative text-background` (5.34:1, keeps the orange). Then add an ESLint `no-restricted-syntax` rule banning the literal `#F78E42` in `className` so it cannot regress a third time.
**Command:** `/normalize` (+ a lint guard)

---

**H-2 · Visual-only labels across the session log form**
**Location:** `session-forms/DateTimeSection.tsx:118, 138, 161` · `session-forms/NotesSection.tsx:40` · `app/(journal)/new/steps/ConditionsStep.tsx` (×4) · `alerts/alert-creation-popover.tsx` (×3) · `alerts/alerts-management-page.tsx` (×2)
**Category:** Accessibility · **WCAG 1.3.1 (A), 3.3.2 Labels or Instructions (A), 4.1.2 (A)**

17 of 29 `<label>` elements in scope have no `htmlFor`. Verified pattern in `DateTimeSection.tsx`:

```tsx
<label className="block text-sm font-medium mb-2">Date Surfed</label>
<Input ref={dateInputRef} type="date" ... />   {/* sibling, no id */}
```

The label is a styled block of text sitting above an unnamed input.

**Impact:** "Date Surfed," "Time Started," "Session Experience," and the duration select are announced without names. Clicking the label text also fails to focus the field — a silent usability tax for everyone, not just AT users.

**Recommendation:** Add `id` to each control and `htmlFor` to its label (or nest the control inside the label, as `forecast-feedback-capture.tsx:391` already does correctly).
**Command:** `/harden`

---

**H-3 · Four placeholder-text contrast failures**
**Category:** Accessibility · **WCAG 1.4.3 (AA)**

| Location | Pair | Ratio |
|---|---|---|
| `alerts/alert-creation-popover.tsx:303`, `alerts/anon-alert-capture-form.tsx:158` | `placeholder:text-gray-600` on `bg-[#252D6B]` | **1.67:1** |
| `alerts/alerts-management-page.tsx:550` | `placeholder:text-[#403A2E]/55` on `#F4EBD8` | **2.90:1** |
| `session-forms/NotesSection.tsx:44` | `placeholder:text-[#8B9EC2]` on `bg-[#354090]` | **3.40:1** |

**Impact:** At 1.67:1 the placeholder is essentially invisible on the twilight background. Because H-2 leaves several of these fields with no real label, the placeholder is currently the *only* affordance telling a user what the field is — an unreadable placeholder on an unlabeled input is an empty box.

**Recommendation:** On twilight, use `#9AABC6` (5.41:1). On cream, use `#5F5646` (6.10:1). Both are existing in-system values.
**Command:** `/normalize`

---

**H-4 · Focus indicator removed with no replacement**
**Location:** `components/forecast/forecast-feedback-capture.tsx:407`
**Category:** Accessibility · **WCAG 2.4.7 Focus Visible (AA)**

The observed-face-height input sets `outline-none`, and its wrapping `<span>` (line 390) has no `focus-within:` styling — so focus is invisible. Verified: `app/globals.css` has no global focus-visible fallback, and the sibling textarea at line 431 *does* carry `focus:ring-2`, so this is an omission rather than a house style.

**Impact:** Keyboard users lose their place in the forecast-accuracy feedback flow — the mechanism that feeds ground-truth data back into the model.

**Recommendation:** Move the ring to the wrapper: `focus-within:ring-2 focus-within:ring-[#0B3A75]`, matching line 431.
**Command:** `/harden`

---

**H-5 · Unlabeled icon-only buttons, including a destructive one**
**Location:** `session-detail-view.tsx:372` (Trash2 — delete session) · `journal/journal-view.tsx:348` (Settings) · `beach/beach-reviews-list.tsx:182` (Edit3) · `forecast/forecast-accuracy-summary.tsx:114` (RefreshCw)
**Category:** Accessibility · **WCAG 4.1.2 (A)**

No `aria-label`, `title`, or `sr-only` text; the only child is a Lucide icon.

**Impact:** Delete-session is announced as "button" with no indication it destroys data.

**Recommendation:** `aria-label="Delete session"`, `"Journal settings"`, `"Edit review"`, `"Refresh accuracy data"`.
**Command:** `/harden`

---

**H-6 · Tide table renders two columns at every viewport**
**Location:** `components/forecast/tide-hourly-table.tsx:219`
**Category:** Responsive

```tsx
<div className="grid grid-cols-2 gap-4">   {/* no sm:/md: prefix */}
  <div className="overflow-hidden rounded-lg border ...">
    <table className="w-full text-xs"> ...
```

Two 12-column tables side by side, unconditionally, each wrapped in `overflow-hidden` — so at 375px the content is **clipped, not scrollable**. This is the only table in scope without a scroll container; the other three (`detailed-forecast-table`, `forecast-table`, `tide-diagnostics-panel`) all handle it correctly.

**Impact:** Tide data is unreadable on a phone. "Data is sacred" is design principle #1.

**Recommendation:** `grid-cols-1 md:grid-cols-2`, and swap `overflow-hidden` for `overflow-x-auto` on the table wrappers.
**Command:** `/adapt`

---

### Medium

---

**M-1 · `spot-overview.tsx` is an un-migrated glassmorphism/cyan artifact**
**Location:** `components/beach-detail/spot-overview.tsx:152-155` · **Category:** Theming / Anti-pattern
Detailed in §1. Also fails contrast: `text-teal-600` on `bg-teal-100` = **3.32:1**, and `text-cyan-600` on `bg-cyan-50` = **3.54:1** (`beach-hero-compact.tsx:82,93`, `best-surf-window.tsx:1097`) — both below AA.
**Impact:** On the highest-traffic logged-in page, one card reads as a different product. Undermines the "made by surfers, for surfers" goal.
**Recommendation:** Rebuild on `ZineSurface` with cream paper, ink text, `--stamp-blue` for the icon. Delete the gradients and `backdrop-blur`.
**Command:** `/normalize`

**M-2 · `#00D4AA` is off-palette**
`SessionFitPicker.tsx:131` · `session-intelligence/best-surf-windows.tsx:38` · `source-confidence-badge.tsx:53` · **Category:** Theming
A mint accent that exists in no token file. Mint-on-navy is a named anti-reference. Map to `--hi-yellow` or `--q-orange` depending on whether it signals *good* or *notable*. → `/normalize`

**M-3 · Framer Motion animates `height: 0 → auto`**
`session-forms/VisibilitySection.tsx:63-97` · **Category:** Performance
Two `motion` elements animate `height`, forcing layout recalculation every frame inside the session form. The skill's guidance — and the cheaper fix — is a `grid-template-rows: 0fr → 1fr` transition. → `/optimize`

**M-4 · Two Framer Motion components ignore reduced-motion**
`session-forms/VisibilitySection.tsx` · `beach-detail/beach-hero-compact.tsx:198` · **Category:** Accessibility · **WCAG 2.3.3 (AAA)**
`app/globals.css:392` has a global `animation: none !important` safeguard — but that only kills *CSS* animation. Framer Motion drives inline transforms from JS and sails straight through it. The other 8 Framer Motion components in scope call `useReducedMotion` correctly; these two are the gap. Design principle #5 says all animation must honor the preference. → `/animate`

**M-5 · 45 raw `<button>` elements rely on the UA default focus ring**
Across 25 files · **Category:** Accessibility (consistency)
Verified there is *no* global outline reset, so focus is technically visible — this is not a WCAG failure. But the browser default ring is inconsistent against cream paper and low-contrast against the twilight stage, while the neighboring `ui/button` component ships `focus-visible:ring-2 focus-visible:ring-ring`. → `/polish`

**M-6 · 57 uses of `transition-all`**
Heaviest: `app-header.tsx` (7), `BeachChip.tsx`, `swell-event-card.tsx`, `beach-conditions-grid.tsx`, `forecast-tab.tsx`, `alert-rule-card.tsx` (3 each) · **Category:** Performance
`transition-all` includes layout properties, so any incidental size change animates and triggers layout. Narrow to `transition-colors` / `transition-transform`. → `/optimize`

**M-7 · Decorative `alt=""` on a content image**
`session-detail-view.tsx:184` · **Category:** Accessibility · **WCAG 1.1.1 (A)**
The shared-session preview image is the primary content of the shared-session view, marked as decorative. (For contrast, `zine/atoms/index.tsx:353` handles the same situation correctly — `alt=""` on the `<img>` with `role="img"` + `aria-label` on the parent.) → `/harden`

---

### Low

**L-1 · 1,199 hard-coded hex literals across 166 files** — `#11100D` ×382, `#F78E42` ×197, `#F4EBD8` ×71, all of which exist as tokens in `app/styles/zine.css`. Worst offenders: `alerts-management-page.tsx` (124), `beach-detail/tabs/forecast-tab.tsx` (79), `SessionScrollForm.tsx` (69). Low severity on its own — but this is the *mechanism* behind H-1 and M-2, and it makes a palette change a 1,199-site edit. → `/extract` then `/normalize`

**L-2 · Heading level skip** — `beaches-enhanced-forecast.tsx:807` jumps h3 → h5. WCAG 1.3.1. → `/harden`

**L-3 · `rounded-2xl` + `shadow-lg`** — 7 occurrences of the generic-card silhouette, against a house style of hard offset shadows and asymmetric radii. → `/polish`

**L-4 · `will-change` used once in scope** — only `conditions-ticker.tsx`. The zine rotations and sticker transforms are cheap enough that this is a micro-optimization, noted for completeness. → `/optimize`

---

## 4. Patterns & Systemic Issues

1. **Form semantics are the weak layer.** 26 of 39 form controls in scope lack a programmatic name; 17 of 29 `<label>`s lack `htmlFor`. Visual labeling is consistently good, programmatic labeling consistently absent — which reads as a team that designs in the browser and never tabbed through with a screen reader. Both Criticals and two Highs are this one root cause.
2. **Design tokens exist but nothing enforces them.** `zine.css` defines 27 tokens; `tailwind.config.ts` carries an explicit WCAG warning in a comment. Neither is enforceable, so 1,199 hex literals accumulated and the `#F78E42` fix regressed at 20 sites. **A comment is not a guardrail** — this needs a lint rule.
3. **Contrast failures cluster on placeholders and small badges**, never on primary body text. Ink-on-cream (16.06:1) and body copy are excellent. What escapes review is text that is *deliberately* de-emphasized — where "muted" was chosen by eye rather than measured.
4. **Pre-zine components survive in high-traffic places.** `spot-overview.tsx` and the cyan difficulty badges are visibly from the earlier design era and sit on the beach page. The zine migration was never swept for stragglers.
5. **Global CSS safeguards create a false sense of coverage.** The `prefers-reduced-motion` block in `globals.css:392` looks total (`*, *::before, *::after`) but cannot reach JS-driven animation. Anything relying on it for Framer Motion is unprotected.

---

## 5. Positive Findings

Worth protecting and replicating:

- **The zine identity is genuinely distinctive.** Cream-paper-on-twilight, hard offset shadows, asymmetric radii, 68 intentional rotations, 4 purposeful typefaces. It does not read as AI output, and it does not read as a template.
- **`beach-tabs.tsx` is exemplary.** Radix `Tabs` gives correct roving tabindex, arrow-key navigation, and `aria-selected` for free, *and* it prefetches each tab's module on interaction (`prefetchTabModules`). Accessibility and performance solved together. Use this as the reference for any new tabbed surface.
- **Empty states are thought through, not boilerplate.** `zine-recent-sessions.tsx:28` renders nothing rather than a dead "No sessions yet"; `beach-alert-cta.tsx:81` avoids flashing "no alerts" mid-load; `beach-search-autocomplete.tsx:260` distinguishes "no results" from "fetch failed."
- **`ui/button` sizing is correct by default** — `default` h-11 (44px), `icon` h-11 w-11, with `focus-visible:ring-2` in the base variant. Where components use it, touch targets and focus are right.
- **The tokens caught the right bug.** `tailwind.config.ts:23-31` shows someone measured `#F78E42` at 2.36:1, fixed the token, and documented why. The analysis was correct; only the rollout was incomplete.
- **Zero nested cards, zero gradient text, zero AI-palette gradients in the migrated components.** The zine surfaces are clean.
- **Memoization is proportionate** — `forecast-tab.tsx` 8 `useMemo`, `beach-detail.tsx` 9 `useCallback`. No sign of render thrash in the heavy components.
- **`zine/atoms/index.tsx:349-357`** models the correct decorative-image pattern (`role="img"` + `aria-label` on the container, `alt=""` on the child).

---

## 6. Recommendations by Priority

**Immediate — this week**
1. C-1 alert rule builder accessible names — `condition-builder.tsx`, 8 controls, ~30 min
2. C-2 photo removal on touch — `PhotoSelectionSection.tsx`, ~15 min
3. H-1 the 6 in-scope orange/white CTAs, **plus a lint rule** so it cannot regress again

**Short-term — this sprint**
4. H-2 `htmlFor`/`id` across session-log and alert forms
5. H-3 placeholder contrast (4 sites, mechanical)
6. H-4 focus ring on the feedback input
7. H-5 4 icon-button labels
8. H-6 tide table responsive fix
9. Extend H-1 to the remaining 14 repo-wide sites (`ui/public-content-gate.tsx`, `ui/sticky-signup-bar.tsx`, `seo/alert-capture-cta.tsx` and others — several sit on the signup funnel and are relevant to plan 065)

**Medium-term — next sprint**
10. M-1 rebuild `spot-overview.tsx` on `ZineSurface`; retire the cyan difficulty badges
11. M-2 map `#00D4AA` onto a real token
12. M-3/M-4 `VisibilitySection` height animation + the two reduced-motion gaps
13. M-5 shared focus-ring utility for raw `<button>`s

**Long-term**
14. L-1 token extraction — introduce Tailwind utilities for the zine palette and codemod the 1,199 literals. Do this *after* the lint rule, so the ratchet holds.
15. M-6 narrow `transition-all`
16. L-2 / L-3 / L-4

---

## 7. Suggested Commands

| Command | Addresses | Findings |
|---|---|---|
| `/harden` | Form labels, accessible names, focus indicators, alt text | C-1, C-2, H-2, H-4, H-5, M-7, L-2 — **7** |
| `/normalize` | Token compliance, contrast pairs, off-palette colors, spot-overview | H-1, H-3, M-1, M-2 — **4** |
| `/optimize` | Layout-property animation, `transition-all`, GPU hints | M-3, M-6, L-4 — **3** |
| `/adapt` | Tide table breakpoints, touch targets | H-6, C-2 (target size) — **2** |
| `/animate` | Reduced-motion guards on Framer Motion | M-4 — **1** |
| `/polish` | Focus-ring consistency, generic card silhouettes | M-5, L-3 — **2** |
| `/extract` | Pull the 1,199 hex literals into design-system utilities | L-1 — **1** |

Start with `/harden` scoped to `components/alerts/` and `components/session-forms/` — that single pass clears both Criticals and three Highs.

---

## Appendix — Verified Non-Issues

Flagged by scan, confirmed correct on inspection. Recorded so they are not re-reported:

- **`app-header.tsx:274`** — `focus:outline-none focus:ring-0` looks like focus removal, but the parent (line 263) carries `focus-within:border-primary focus-within:ring-4`. Correct pattern.
- **`today-surf-call.tsx:111,267`** — `w-[520px]` / `w-[640px]` are `max-w-*`, not fixed widths.
- **`best-surf-windows.tsx:78`** — `bg-[#F78E42]/15 text-white` is orange at 15% over a dark ground; white text passes. Not part of H-1.
- **`zine/atoms/index.tsx:353`** — `alt=""` is correct; the parent supplies `role="img"` + `aria-label`.
- **34 files with CSS animation and no local reduced-motion guard** — covered by the global block at `globals.css:392`. Only the two JS-driven cases (M-4) are real.
- **`beach-tabs.tsx`** — no local `role="tab"`/`onKeyDown` because Radix `Tabs` provides them.
- **Multiple `<h1>` per file** in `alerts-management-page.tsx`, `session-detail-view.tsx`, `forecast/[beachId]/page.tsx` — conditional branches, one renders at a time.
- **`ocean-blue-decorative` + `text-background`** on landing components — 5.34:1, passes AA.
- **Nested cards** — 0 across all 166 files.
