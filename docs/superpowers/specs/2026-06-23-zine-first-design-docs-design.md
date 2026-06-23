# Zine-First Design Docs — Design Spec

**Date:** 2026-06-23
**Status:** Approved (design), pending spec review
**Type:** Documentation direction change (no product code changes)

---

## Problem

Quiver's design documentation mandates a **dark dashboard** aesthetic (Deep Twilight `#252D6B` background, `#2D357D`/`#354090` dark card surfaces, white-on-dark three-tier text, noise on dark). Meanwhile the product has been shipping a different, opposite aesthetic — the **zine layer** (`app/styles/zine.css`, cream paper on a twilight stage, ink text, stencil/marker fonts, stamps/tape/halftone) — which has already spread well beyond beach-detail into learn, blog, field-guide landing, pricing, cams, and forecast surfaces.

The docs have not kept up, and they have drifted into **three competing palettes**:

1. **Dashboard** (`docs/STYLE_GUIDE.md`): `#252D6B` bg, `#2D357D`/`#354090` cards, `#F78E42` orange, white-on-dark text.
2. **Dawn Patrol** (`docs/BRAND_GUIDE.md`): Midnight navy `#182540`, Deep ocean `#2A4A6B`, Amber dawn `#C07840`, Warm sand `#C4A97D`, Sun-bleached `#F0ECE3`. (BRAND_GUIDE is already *philosophically* zine — "analog surf culture… hand-drawn sticker sheets… applies to… the product itself," "Quiver is not a data dashboard" — but its palette table is a third hex set.)
3. **Zine** (`app/styles/zine.css`): paper `#F4EBD8` / cream `#F5EEDC`, ink `#11100D`, twilight stage `#0D1020 → #1A1535 → #252D6B`, orange `#F78E42`, stamp red `#B91C1C`, stamp blue `#0B3A75`, tape `#C8A46B`, hi-yellow `#F2C94C`, ocean `#7FA7B8`.

The canonical **native** design doc (`Brand-Vault/style-guide/source-docs/DESIGN_SYSTEM.md`) actively contradicts the target direction with hard lock-ins:

> Cream `#F5EEDC` — hero and marketing surfaces only… **Never on app chrome** — nav bars, cards, tab bars, list rows, buttons are off-limits.
> Deep Twilight `#252D6B` — the canvas.

## Goal

Update the design documentation so the **zine layer is the canonical, app-wide aesthetic** and the dark-dashboard guidance is retired. "Move away from dark dashboard" means **cream paper content on a twilight stage** (keep the dark backdrop as the stage; cream-paper surfaces with ink text become the default content treatment) — *not* a full light theme.

## Scope & Constraints

- **Docs only.** No edits to `zine.css`, no component re-skins, no `quiver-native/src/constants/theme.ts` token changes, no de-namespacing of `.zine-tab`. The docs declare direction; the migration of dark-dashboard surfaces is future work, out of scope here.
- **Edit in place, no new canonical file.** Each existing doc is edited where it lives. (Risk accepted: this is the structure that previously produced the 3-palette drift. Mitigated by the source-of-truth model below.)
- **Full native inversion.** Native guidance is rewritten so cream-paper content is the default app-wide, twilight only as the stage — reversing the current "cream never on chrome" lock-in.
- **All 8 doc surfaces** in scope (web docs + Brand-Vault canonical + native CLAUDE.md + workspace root pointer).

## Source-of-Truth Model (drift mitigation)

`app/styles/zine.css` (its `.zine-tab` custom-property block) is declared the **single canonical token table**. Every doc *references* it for hex values rather than re-listing them. Each doc keeps only the rules it needs locally and links to `zine.css` for the canonical values. This is the mechanism that lets "edit in place" avoid spawning a fourth competing palette: there is exactly one place hexes are defined, and the prose docs point at it.

## The Reconciled Visual Model

All docs describe one identical system:

- **Twilight stage** — the page backdrop: `#0D1020 → #1A1535 → #252D6B` gradient. This is the *only* place "dark" survives — it is the stage, not content.
- **Cream paper** — the default content surface: `--paper #F4EBD8` / `--q-cream #F5EEDC`, shadow `#E5D4B3`, deep `#D9C49C`; text in `--ink #11100D`. Replaces dark `#2D357D`/`#354090` cards as the default content treatment.
- **Charming Orange `#F78E42`** — remains the single primary accent (CTAs, active states).
- **Zine craft accents** — stamp red `#B91C1C`, stamp blue `#0B3A75`, tape `#C8A46B`, hi-yellow `#F2C94C`, ocean `#7FA7B8`; plus native's semantic verdict accents (Pacific Teal `#00D4AA` = YES verdicts, Paradise Gold `#FDB84B` = "best of"/ratings) retained as semantics.
- **Dawn Patrol** (`#182540`/`#2A4A6B`/`#C07840`/`#C4A97D`/`#F0ECE3`) — demoted to "mood board, superseded by `zine.css` tokens." Its *intent* maps onto zine tokens (navy → twilight stage, amber → Charming Orange, sun-bleached → cream paper). It is not a parallel palette.
- **`ZineSurface` / `.zine-tab`** (`components/zine/`, `components/beach-detail/zine/`) — documented as the canonical page shell that new surfaces adopt.

## Text / Type / Texture Reconciliation

- **Ink-on-paper is the primary text system.** The existing white-on-dark three-tier system (`text-white` / `text-high` / `text-medium`) is **scoped to the twilight stage and masthead**, not deleted.
- **Legibility callout (must appear in the docs):** accents tuned for dark do not survive on cream. Charming Orange `#F78E42` on paper is for fills/marks/stamps, **not** small body text. Secondary text on paper uses ink-tier opacities (ink at reduced opacity), not the white-on-dark tiers.
- **Fonts:** zine display/marker fonts (Bowlby One / Big Shoulders Stencil, Permanent Marker / Caveat) are documented alongside Space Grotesk (heading), DM Sans (body), Space Mono (data). The existing Google-Fonts font-family rules remain accurate for the base trio; zine fonts are added as the display/character layer (loaded via the `--font-zine-display` / `--font-zine-marker` / `--font-handwritten` next/font variables referenced in `zine.css`).
- **Texture:** the dark `noise-texture*` utilities (STYLE_GUIDE §14) are reframed as stage-layer texture; zine's paper grain / halftone / torn-edge / tape treatments are documented as the content-surface texture language.

## Per-Doc Change Spec

### 1. `quiver/CLAUDE.md` — Design Context section
- Replace "Always-dark theme" with the cream-paper-on-twilight model; state zine layer is the app-wide aesthetic.
- Rewrite **Aesthetic Direction** bullets: lead with cream paper content + twilight stage + Charming Orange accent; reference `app/styles/zine.css` and `ZineSurface`.
- Keep the existing sticker/texture/anti-reference voice (it is already zine-aligned). Update any "dark theme" / "dark background" phrasing to "twilight stage."
- Keep the "never repeat the same sticker on a single card/page" rule.

### 2. `quiver/docs/STYLE_GUIDE.md`
- **§10 Brand Colors:** reframe the dark dashboard table as the **stage layer**; add the cream-paper content surface tokens as the default; point to `zine.css` as canonical token source. Charming Orange `#F78E42` unchanged as primary accent. Mark `#2D357D`/`#354090` dark card surfaces as legacy/secondary (stage-only).
- **§11 Landing & App Visual Alignment:** rewrite "Same dark background" → "Same twilight stage + cream paper content." Both landing and app share the zine system.
- **§13 Text Emphasis System:** keep the white-on-dark tiers but retitle/scope them to the **twilight stage/masthead**; add the **ink-on-paper** primary text rules for content surfaces.
- **§14 Texture & Grain:** reframe `noise-texture*` as stage texture; add paper grain / halftone / tape / torn-edge as the content-surface texture language, pointing to `zine.css`.
- **§4/§5 Typography:** add the zine display/marker font layer alongside the base trio.
- Add a deprecation/redirect note near the top of the dark-dashboard sections steering readers to the zine model + `zine.css`.

### 3. `quiver/docs/BRAND_GUIDE.md`
- **Visual identity → Color palette:** reconcile "Dawn Patrol" to `zine.css` tokens. Keep the analog/sticker/VHS narrative (already correct); replace the standalone Dawn Patrol hex table with a mapping onto canonical zine tokens, labeling Dawn Patrol as the originating mood board.
- Affirm the zine layer (`app/styles/zine.css`, `ZineSurface`) as the concrete implementation of the already-stated "applies to… the product itself" direction.
- The "Quiver is not a data dashboard" section stays and is now consistent with the rest of the docs.

### 4. `quiver/docs/DESIGN_PRINCIPLES.md`
- Add a **Visual Language** principle: cream-paper-on-twilight zine system as the app-wide aesthetic, with `ZineSurface` / `.zine-tab` as the canonical shell and `zine.css` as the token source. Cross-link STYLE_GUIDE and BRAND_GUIDE.

### 5. `Brand-Vault/style-guide/source-docs/DESIGN_SYSTEM.md` (native canonical)
- **Invert the cream lock-in:** cream `#F5EEDC` becomes the default content/card surface; rewrite "Never on app chrome" to the new rule. Deep Twilight `#252D6B` is reframed as the **stage**, not the content canvas.
- **Preserve verdict semantics:** Pacific Teal `#00D4AA` (YES verdicts) and Paradise Gold `#FDB84B` ("best of"/ratings) remain; specify their use **on cream surfaces** with contrast guidance.
- Note `src/constants/theme.ts` as where the runtime token changes will eventually land (code change is out of scope for this docs pass).
- Keep typography helper table; note which helpers now sit on cream vs stage.

### 6. `Brand-Vault/style-guide/STYLE-GUIDE.md` (quick guide)
- Align the quick-reference summary with the inverted DESIGN_SYSTEM: cream content default, twilight stage, Charming Orange accent, verdict teal/gold.

### 7. `quiver-native/CLAUDE.md`
- Add cream-first zine-translation guidance: native cannot consume `zine.css` (Tamagui, not CSS), so it adopts the **spirit/translation** — cream content surfaces, twilight stage, ink text, Charming Orange accent, verdict teal/gold.
- Point to `Brand-Vault/.../DESIGN_SYSTEM.md` as canonical and `src/constants/theme.ts` as the runtime token home for the eventual implementation.

### 8. `dev/CLAUDE.md` (workspace root)
- One-line update to the canonical-design-system pointer so it reflects the zine-first / cream-on-twilight direction (the existing sentence describes DESIGN_SYSTEM.md as "palette, type, voice, anti-patterns" — keep, but ensure it does not imply the old cream-is-marketing-only lock-in).

## Verification (docs are internally consistent)

This is documentation work; verification is review-based plus a residual-mandate sweep:

1. **Residual-mandate grep** — after edits, no doc still *mandates* the dark dashboard as the default content treatment. Search the 8 files for: `Always-dark`, `dark background` (as a mandate), `cream.*marketing.*only`, `Never on app chrome`, `#2D357D` / `#354090` presented as default content surfaces. Each remaining hit must be either removed or explicitly reframed as the stage layer.
2. **Single-token-source check** — confirm no doc introduces a hex value that conflicts with `zine.css`; Dawn Patrol hexes appear only as labeled "superseded mood board" references.
3. **Internal-consistency read** — the reconciled visual model section reads identically (same stage/paper/accent model) across CLAUDE.md, STYLE_GUIDE, BRAND_GUIDE, and the native canonical doc.
4. **No code touched** — `git diff` shows only `.md` files (no `.css`, `.ts`, `.tsx`).

## Out of Scope

- Editing `app/styles/zine.css` or any component.
- Re-skinning any dark-dashboard surface (app shell, dashboard, sessions, settings, etc.).
- Changing `quiver-native/src/constants/theme.ts` tokens or any native code.
- De-namespacing `.zine-tab`.
- A migration plan for converting surfaces (separate future effort).

## Open Questions

None. All scoping forks resolved during brainstorming:
- Deliverable: docs only (direction).
- Surface: everything (web + Brand-Vault + native + workspace pointer).
- Semantics: cream paper on twilight stage.
- Structure: edit in place, no new file.
- Native depth: full inversion (cream content default).
