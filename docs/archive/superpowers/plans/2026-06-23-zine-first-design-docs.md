# Zine-First Design Docs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update Quiver's design documentation so the zine layer (cream paper on a twilight stage) is the canonical app-wide aesthetic and the dark-dashboard guidance is retired.

**Architecture:** Documentation-only change across 8 files in 3 locations (`quiver/` repo, `quiver-native/` repo, and the non-versioned `Brand-Vault/` + `dev/` roots). `app/styles/zine.css` is the single canonical token source; prose docs reference it instead of re-listing hexes. No product code is touched.

**Tech Stack:** Markdown. Verification via `grep` and `git diff`.

**Spec:** `docs/archive/superpowers/specs/2026-06-23-zine-first-design-docs-design.md`

---

## Canonical reference (use these exact values in every doc)

From `app/styles/zine.css` `.zine-tab` block — **do not introduce any other hexes as defaults:**

- **Twilight stage** (backdrop only): `#0D1020 → #1A1535 → #252D6B` gradient.
- **Cream paper** (default content surface): `--paper #F4EBD8`, `--q-cream #F5EEDC`, shadow `#E5D4B3`, deep `#D9C49C`.
- **Ink** (text on paper): `--ink #11100D`.
- **Primary accent:** Charming Orange `#F78E42`.
- **Craft accents:** stamp red `#B91C1C`, stamp blue `#0B3A75`, tape `#C8A46B`, hi-yellow `#F2C94C`, ocean `#7FA7B8`.
- **Native verdict semantics (retained):** Pacific Teal `#00D4AA` (YES), Paradise Gold `#FDB84B` ("best of"/ratings).
- **Canonical shell:** `ZineSurface` (`components/zine/zine-surface.tsx`) / `.zine-tab` namespace.
- **Demoted:** Dawn Patrol (`#182540`/`#2A4A6B`/`#C07840`/`#C4A97D`/`#F0ECE3`) = mood board, superseded by the tokens above.

**The model, stated identically everywhere:** dark survives only as the *twilight stage* (page backdrop). Content sits on *cream paper* with *ink* text. Charming Orange is the single primary accent. Accents tuned for dark do not survive on cream — orange on paper is for fills/marks/stamps, not small body text; secondary text on paper uses reduced-opacity ink, not the white-on-dark tiers.

---

## File Structure

| # | File | Repo / location | Committable |
|---|------|-----------------|-------------|
| 1 | `CLAUDE.md` (Design Context) | `quiver/` | yes |
| 2 | `docs/STYLE_GUIDE.md` | `quiver/` | yes |
| 3 | `docs/BRAND_GUIDE.md` | `quiver/` | yes |
| 4 | `docs/DESIGN_PRINCIPLES.md` | `quiver/` | yes |
| 5 | `style-guide/source-docs/DESIGN_SYSTEM.md` | `Brand-Vault/` | no (not a repo) |
| 6 | `style-guide/STYLE-GUIDE.md` | `Brand-Vault/` | no (not a repo) |
| 7 | `CLAUDE.md` | `quiver-native/` | yes (separate repo) |
| 8 | `CLAUDE.md` (workspace root) | `dev/` | no (not a repo) |

**Commit grouping:** Tasks 1–4 → one `quiver/` commit (Task 5). Tasks 6–7 (Brand-Vault) → no commit. Task 8 (native) → one `quiver-native/` commit (Task 9). Task 10 (dev root) → no commit. Commits execute only when the user has authorized committing.

---

## Task 1: `quiver/CLAUDE.md` — Design Context

**Files:**
- Modify: `CLAUDE.md` (Design Context → Aesthetic Direction)

- [ ] **Step 1: Flip the Visual tone bullet**

Replace exactly:

```
- **Visual tone**: Retro 80s-90s surf culture. Deep Twilight navy (`#252D6B`) base, Charming Orange (`#F78E42`) primary accent. Always-dark theme.
```

with:

```
- **Visual tone**: Retro 80s-90s surf-zine culture. Cream paper (`#F4EBD8`) content surfaces with ink (`#11100D`) text, set on a Deep Twilight (`#252D6B → #1A1535 → #0D1020`) stage. Charming Orange (`#F78E42`) is the single primary accent. The twilight stage is the backdrop only — content lives on cream paper, not on dark cards. Canonical token source: `app/styles/zine.css`; canonical page shell: `ZineSurface` (`components/zine/`).
```

- [ ] **Step 2: Keep the texture/sticker bullets, retire "always-dark" framing**

In the **Texture** bullet and surrounding Aesthetic Direction text, ensure no remaining phrase mandates a dark content theme. The sticker rules (rotated badges, "Never repeat the same sticker on a single card or page") stay verbatim. If the **Anti-references** mention "always-dark"/"dark mode," reword to target "corporate SaaS" and "generic AI slop" only (those lines already exist — leave them, just don't reintroduce a dark-theme mandate).

- [ ] **Step 3: Verify**

Run: `grep -n "Always-dark\|always-dark" CLAUDE.md`
Expected: no matches.

Run: `grep -n "zine.css\|ZineSurface\|cream paper" CLAUDE.md`
Expected: at least one match (the new Visual tone bullet).

---

## Task 2: `quiver/docs/STYLE_GUIDE.md`

**Files:**
- Modify: `docs/STYLE_GUIDE.md` (§4, §5, §10, §11, §13, §14)

- [ ] **Step 1: §10 Brand Colors — reframe as stage + add cream paper default**

Rewrite the section intro so it states the cream-paper-on-twilight model. Convert the "Sunset/twilight palette" table into two labeled groups:
- **Twilight stage (backdrop only):** `#252D6B` / `#1A1535` / `#0D1020` gradient. Note these are the *stage*, not content surfaces.
- **Cream paper (default content surface):** `--paper #F4EBD8`, `--q-cream #F5EEDC`, shadow `#E5D4B3`, deep `#D9C49C`; ink text `#11100D`.

Keep Charming Orange `#F78E42` as the primary accent row. Add a one-line note marking the old dark card surfaces `#2D357D` / `#354090` as **legacy (stage-layer only, not default content)**. Add: "Canonical token source: `app/styles/zine.css`. Do not introduce new hexes — reference these tokens."

- [ ] **Step 2: §11 Landing & App Visual Alignment — replace "dark background"**

Replace the bullet `**Same dark background:** Deep Twilight #252D6B as the global page background` with:

```
- **Same twilight stage + cream paper content:** Deep Twilight (`#252D6B → #1A1535 → #0D1020`) as the page stage, cream paper (`#F4EBD8`) as the default content surface — shared by landing and app via the zine layer (`app/styles/zine.css`, `ZineSurface`).
```

Update the "Gradients encouraged… against the dark background" bullet to "against the twilight stage."

- [ ] **Step 3: §13 Text Emphasis — scope white-on-dark to the stage, add ink-on-paper**

Retitle the section's framing: the `text-white` / `text-high` / `text-medium` three-tier system is **for the twilight stage and masthead** (white on dark). Add a parallel **ink-on-paper** subsection for content surfaces: primary text `--ink #11100D` (full), secondary text reduced-opacity ink, never the white-on-dark tiers on cream. Add the legibility rule: Charming Orange on cream is for fills/marks/stamps, not small body text.

- [ ] **Step 4: §14 Texture & Grain — reframe noise as stage texture, add paper texture**

Note that `noise-texture*` utilities apply to the twilight stage layer. Add the zine content-surface texture language (paper grain, halftone, torn-edge, tape), pointing to `app/styles/zine.css` for the implementations. Keep the "where NOT to apply" guidance.

- [ ] **Step 5: §4/§5 Typography — add the zine display/marker layer**

Keep the Space Grotesk / DM Sans / Space Mono trio rules (still accurate). Add a note: the zine layer adds display/marker fonts (Bowlby One / Big Shoulders Stencil via `--font-zine-display`; Permanent Marker / Caveat via `--font-zine-marker` / `--font-handwritten`) for headings and hand-lettered accents on zine surfaces.

- [ ] **Step 6: Add a redirect note at the top of §10**

Add one line at the start of §10: "**Direction:** Quiver is zine-first — cream paper content on a twilight stage. See `app/styles/zine.css` (canonical tokens) and the Design Context in `CLAUDE.md`. The dark card surfaces below are legacy stage-layer values."

- [ ] **Step 7: Verify**

Run: `grep -n "Same dark background" docs/STYLE_GUIDE.md`
Expected: no matches.

Run: `grep -n "cream paper\|twilight stage\|zine.css\|ink (#11100D)\|#11100D" docs/STYLE_GUIDE.md`
Expected: multiple matches across §10/§11/§13.

---

## Task 3: `quiver/docs/BRAND_GUIDE.md`

**Files:**
- Modify: `docs/BRAND_GUIDE.md` (Visual identity → Color palette — Dawn Patrol)

- [ ] **Step 1: Replace the Dawn Patrol palette table with a mapping onto zine tokens**

Replace the `### Color palette — Dawn Patrol` table with a mapping that keeps the narrative but defers values to `zine.css`:

```
### Color palette

Dawn Patrol is the originating mood board (pre-dawn, salt air, quiet water). Its intent is now implemented by the zine layer's canonical tokens in `app/styles/zine.css` — use those, not the mood-board hexes:

| Mood (Dawn Patrol) | Canonical zine token | Hex | Role |
|---|---|---|---|
| Midnight navy / Deep ocean | twilight stage | `#252D6B → #1A1535 → #0D1020` | Page backdrop (stage only) |
| Sun-bleached | cream paper | `#F4EBD8` / `#F5EEDC` | Default content surface |
| (ink) | ink | `#11100D` | Text on paper |
| Amber dawn | Charming Orange | `#F78E42` | Primary accent |
| Warm sand | tape / paper-deep | `#C8A46B` / `#D9C49C` | Craft accents |

The Dawn Patrol hexes (`#182540`, `#2A4A6B`, `#C07840`, `#C4A97D`, `#F0ECE3`) are superseded mood references — do not use them as implementation values.
```

- [ ] **Step 2: Affirm the zine layer as the implementation**

In the Visual identity intro (which already says the analog direction "applies to… the product itself"), add a sentence: "This is implemented today by the zine layer — `app/styles/zine.css` and `ZineSurface` (`components/zine/`) — which is Quiver's canonical app-wide visual system." Leave the "Colors to avoid," texture, typography-direction, and "Quiver is not a data dashboard" sections as-is (already consistent).

- [ ] **Step 3: Verify**

Run: `grep -n "zine layer\|app/styles/zine.css\|superseded mood" docs/BRAND_GUIDE.md`
Expected: matches in the Color palette + Visual identity sections.

Run: `grep -n "Dawn Patrol" docs/BRAND_GUIDE.md`
Expected: present, but only as labeled mood-board references (no standalone hex table mandating those values).

---

## Task 4: `quiver/docs/DESIGN_PRINCIPLES.md`

**Files:**
- Modify: `docs/DESIGN_PRINCIPLES.md` (add a new principle section)

- [ ] **Step 1: Add a "Visual Language" principle**

Insert a new section (after "Transparency & User Trust" or near the other product-facing principles):

```
## Visual Language

Quiver is **zine-first**: cream paper content on a twilight stage. The dark twilight gradient (`#252D6B → #1A1535 → #0D1020`) is the page backdrop only; content sits on cream paper (`#F4EBD8`) with ink (`#11100D`) text, Charming Orange (`#F78E42`) as the single primary accent, and craft accents (stamps, tape, halftone) for character.

- **Canonical tokens:** `app/styles/zine.css` — do not introduce competing hexes.
- **Canonical page shell:** `ZineSurface` (`components/zine/`) / the `.zine-tab` namespace. New surfaces adopt it.
- **Legibility first:** accents tuned for dark do not survive on cream; orange on paper is for fills/marks, not small text.

References: `docs/STYLE_GUIDE.md`, `docs/BRAND_GUIDE.md`, `CLAUDE.md` (Design Context)
```

- [ ] **Step 2: Verify**

Run: `grep -n "Visual Language\|zine-first\|ZineSurface" docs/DESIGN_PRINCIPLES.md`
Expected: matches.

---

## Task 5: Commit `quiver/` doc changes (only if committing is authorized)

**Files:** the 4 quiver docs above + this plan + the spec.

- [ ] **Step 1: Confirm only docs changed**

Run: `git -C /Users/stevenchandler/Desktop/dev/quiver diff --name-only`
Expected: only `.md` paths (`CLAUDE.md`, `docs/STYLE_GUIDE.md`, `docs/BRAND_GUIDE.md`, `docs/DESIGN_PRINCIPLES.md`, `docs/archive/superpowers/specs/...`, `docs/archive/superpowers/plans/...`). No `.css`/`.ts`/`.tsx`.

- [ ] **Step 2: Stage and commit**

```bash
cd /Users/stevenchandler/Desktop/dev/quiver
git add CLAUDE.md docs/STYLE_GUIDE.md docs/BRAND_GUIDE.md docs/DESIGN_PRINCIPLES.md docs/archive/superpowers/specs/2026-06-23-zine-first-design-docs-design.md docs/archive/superpowers/plans/2026-06-23-zine-first-design-docs.md
git commit -m "docs: make zine layer the canonical app-wide aesthetic (retire dark-dashboard guidance)"
```

Note: do not stage the unrelated pre-existing modified files in the working tree. Stage only the paths listed.

---

## Task 6: `Brand-Vault/style-guide/source-docs/DESIGN_SYSTEM.md` — invert the cream lock-in

**Files:**
- Modify: `/Users/stevenchandler/Desktop/dev/Brand-Vault/style-guide/source-docs/DESIGN_SYSTEM.md` (Palette lock-ins)

- [ ] **Step 1: Rewrite the Cream lock-in**

Replace the Cream bullet:

```
- **Cream `#F5EEDC`** — hero and marketing surfaces only (bleeding headlines, zine layouts, onboarding heroes). **Never on app chrome** — nav bars, cards, tab bars, list rows, buttons are off-limits.
```

with:

```
- **Cream `#F5EEDC` / paper `#F4EBD8`** — the **default content surface** app-wide (cards, list rows, content panels, hero/zine layouts). Text on cream is ink `#11100D`. This is the zine direction: content lives on cream paper, not dark cards.
```

- [ ] **Step 2: Reframe Deep Twilight as the stage**

Replace the Deep Twilight bullet:

```
- **Deep Twilight `#252D6B`** — the canvas. Never pure black, never pure white.
```

with:

```
- **Deep Twilight `#252D6B`** — the **stage** (page backdrop behind cream paper), via the gradient `#0D1020 → #1A1535 → #1E1040 → #252D6B`. Not a content surface. Never pure black, never pure white.
```

- [ ] **Step 3: Keep verdict semantics, add cream-contrast guidance**

Leave the Pacific Teal `#00D4AA` (YES) and Paradise Gold `#FDB84B` lock-ins. Append to each a note that on cream surfaces they must meet contrast (use the deeper/ink-bordered treatment for small text; reserve the bright fills for marks and verdict chips). Charming Orange `#F78E42` lock-in stays; add "on cream, orange is for fills/marks/CTAs, not small body text."

- [ ] **Step 4: Update the BgStops note and intro**

The "Background gradient stops… Do not use these on app chrome" sentence: change to "Background gradient stops for the twilight stage live in `BgStops` (`#0D1020 → #1A1535 → #1E1040 → #252D6B`) — the stage behind cream paper." Update the doc intro line if it implies cream is marketing-only. Note `src/constants/theme.ts` as where the runtime token change will land (out of scope for this docs pass).

- [ ] **Step 5: Verify**

Run: `grep -n "Never on app chrome\|hero and marketing surfaces only" /Users/stevenchandler/Desktop/dev/Brand-Vault/style-guide/source-docs/DESIGN_SYSTEM.md`
Expected: no matches.

Run: `grep -n "default content surface\|stage" /Users/stevenchandler/Desktop/dev/Brand-Vault/style-guide/source-docs/DESIGN_SYSTEM.md`
Expected: matches in the Palette lock-ins.

---

## Task 7: `Brand-Vault/style-guide/STYLE-GUIDE.md` — align quick guide

**Files:**
- Modify: `/Users/stevenchandler/Desktop/dev/Brand-Vault/style-guide/STYLE-GUIDE.md`

- [ ] **Step 1: Read and align**

Run: `cat /Users/stevenchandler/Desktop/dev/Brand-Vault/style-guide/STYLE-GUIDE.md`

Update any summary that states cream is marketing-only or twilight is the content canvas to match Task 6: cream paper = default content surface, twilight = stage, Charming Orange = primary accent, verdict teal/gold retained. Keep it a quick reference (do not duplicate the full token table — point to `source-docs/DESIGN_SYSTEM.md`).

- [ ] **Step 2: Verify**

Run: `grep -ni "marketing only\|marketing surfaces only\|the canvas" /Users/stevenchandler/Desktop/dev/Brand-Vault/style-guide/STYLE-GUIDE.md`
Expected: no matches that contradict the new model (any remaining "canvas" reference must mean the stage).

---

## Task 8: `quiver-native/CLAUDE.md` — add cream-first zine-translation guidance

**Files:**
- Modify: `/Users/stevenchandler/Desktop/dev/quiver-native/CLAUDE.md`

- [ ] **Step 1: Locate the design/styling section**

Run: `grep -niE "tamagui|theme|design|palette|color|aesthetic" /Users/stevenchandler/Desktop/dev/quiver-native/CLAUDE.md`

- [ ] **Step 2: Add the zine-translation note**

Add (in or near the design/styling guidance):

```
### Visual direction — zine-first (cream on twilight stage)

Quiver is zine-first: cream paper content on a twilight stage (see `Brand-Vault/style-guide/source-docs/DESIGN_SYSTEM.md`). Native cannot consume the web zine CSS layer (`app/styles/zine.css` is web-only) — it adopts the *spirit*:

- **Cream paper (`#F4EBD8` / `#F5EEDC`)** is the default content surface (cards, rows, panels), with **ink (`#11100D`)** text.
- **Deep Twilight (`#252D6B`, gradient `#0D1020 → #1A1535 → #1E1040 → #252D6B`)** is the stage/backdrop only, not a content surface.
- **Charming Orange `#F78E42`** is the single primary accent; **Pacific Teal `#00D4AA`** (YES verdicts) and **Paradise Gold `#FDB84B`** ("best of") are retained semantics. On cream, bright accents are for marks/chips/CTAs, not small body text.
- Runtime tokens live in `src/constants/theme.ts`; the token change to make cream the default is future work (this is a direction note, not an implemented migration).
```

- [ ] **Step 3: Verify**

Run: `grep -n "zine-first\|cream paper\|twilight stage" /Users/stevenchandler/Desktop/dev/quiver-native/CLAUDE.md`
Expected: matches.

---

## Task 9: Commit `quiver-native/` change (only if committing is authorized)

**Files:** `quiver-native/CLAUDE.md`

- [ ] **Step 1: Confirm only the doc changed**

Run: `git -C /Users/stevenchandler/Desktop/dev/quiver-native diff --name-only`
Expected: `CLAUDE.md` only (plus any pre-existing unrelated changes — stage only `CLAUDE.md`).

- [ ] **Step 2: Commit**

```bash
cd /Users/stevenchandler/Desktop/dev/quiver-native
git add CLAUDE.md
git commit -m "docs: zine-first visual direction (cream content on twilight stage)"
```

---

## Task 10: `dev/CLAUDE.md` (workspace root) — light pointer update

**Files:**
- Modify: `/Users/stevenchandler/Desktop/dev/CLAUDE.md`

- [ ] **Step 1: Add a one-line direction note**

In the "Design Systems" paragraph, after the existing DESIGN_SYSTEM.md pointer, add: "The canonical direction is **zine-first**: cream paper content on a twilight stage (not a dark dashboard). `app/styles/zine.css` holds the web token source; native translates the same model via `src/constants/theme.ts`." Keep the existing "update the vault docs and runtime tokens together" sentence.

- [ ] **Step 2: Verify**

Run: `grep -n "zine-first\|cream paper" /Users/stevenchandler/Desktop/dev/CLAUDE.md`
Expected: match.

(No commit — `dev/` is not a git repo.)

---

## Task 11: Final cross-doc consistency + no-code-touched verification

- [ ] **Step 1: Residual dark-mandate sweep across all 8 files**

```bash
grep -rniE "always-dark|never on app chrome|hero and marketing surfaces only|same dark background" \
  /Users/stevenchandler/Desktop/dev/quiver/CLAUDE.md \
  /Users/stevenchandler/Desktop/dev/quiver/docs/STYLE_GUIDE.md \
  /Users/stevenchandler/Desktop/dev/quiver/docs/BRAND_GUIDE.md \
  /Users/stevenchandler/Desktop/dev/quiver/docs/DESIGN_PRINCIPLES.md \
  /Users/stevenchandler/Desktop/dev/Brand-Vault/style-guide/source-docs/DESIGN_SYSTEM.md \
  /Users/stevenchandler/Desktop/dev/Brand-Vault/style-guide/STYLE-GUIDE.md \
  /Users/stevenchandler/Desktop/dev/quiver-native/CLAUDE.md \
  /Users/stevenchandler/Desktop/dev/CLAUDE.md
```

Expected: no matches.

- [ ] **Step 2: Confirm the reconciled model appears consistently**

```bash
grep -rni "cream paper\|twilight stage" \
  /Users/stevenchandler/Desktop/dev/quiver/CLAUDE.md \
  /Users/stevenchandler/Desktop/dev/quiver/docs/STYLE_GUIDE.md \
  /Users/stevenchandler/Desktop/dev/quiver/docs/DESIGN_PRINCIPLES.md \
  /Users/stevenchandler/Desktop/dev/Brand-Vault/style-guide/source-docs/DESIGN_SYSTEM.md \
  /Users/stevenchandler/Desktop/dev/quiver-native/CLAUDE.md
```

Expected: matches in each file.

- [ ] **Step 3: Confirm no product code was touched**

```bash
git -C /Users/stevenchandler/Desktop/dev/quiver diff --name-only
git -C /Users/stevenchandler/Desktop/dev/quiver-native diff --name-only
```

Expected: only `.md` files in each (plus already-staged unrelated pre-existing changes, which this work must not touch).
