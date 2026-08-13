# Audit Remediation Backlog

Source: `.planning/impeccable-audit-logged-in-surfaces-20260813.md` plus findings
from the UGC branch review. Worked top-down by an autonomous loop.

**Status legend:** `TODO` · `IN_PROGRESS` · `DONE` · `BLOCKED(reason)`

**Working rules for every item**
- One concern per branch. Branch from `main`, worktree under `~/codex-worktrees/`.
- Never commit to `main`, never push, never merge, never deploy, never mutate production.
- Gates before marking DONE: `yarn typecheck`, scoped `npx eslint --max-warnings=0`,
  `npx jest` on affected suites. Paste real output; never claim an unrun gate.
- **CI is live.** Verified 2026-08-13: Main Gate and Prod Gate ran green through
  2026-08-11 and `.github/workflows/main-gate.yml:70` runs `yarn lint` on every PR.
  The "Actions disabled since 2026-05-06" line in root `AGENTS.md` is STALE — do not
  rely on it. Anything that fails lint will fail CI. (`yarn lint` OOMs *locally*
  without `NODE_OPTIONS=--max-old-space-size=8192`; scope to changed files instead.)
- Every fix needs a test that **fails without the fix** — prove it by reverting.
- Local Supabase: `yarn db:local` (never migration replay).

---

## Queue

### 1. DONE — Hover-only reveals make controls unreachable on touch
**Severity:** Critical-class (same defect as audit C-2, different files)
- `components/media/session-photo-upload.tsx:394` — 24×24px remove button behind
  `opacity-0 group-hover:opacity-100`. No hover on touch, so session photos cannot
  be removed on a phone. Also lacks an accessible name.
- `components/media/session-photo-gallery.tsx:435` — same pattern on gallery actions.
- `components/forecast/buoy-station-link.tsx:195` and
  `components/landing-page/popular-beaches-section.tsx:101` — decorative only;
  assess whether they hide meaning before changing.

**Fix pattern** (already applied in `components/session-forms/PhotoSelectionSection.tsx`):
drop `opacity-0`, size to `h-8 w-8` with `after:absolute after:-inset-[6px]` for a
44px hit area, add `aria-label`.

### 2. DONE — Orange-on-white CTAs re-introduce a known WCAG AA failure
**Severity:** High · WCAG 1.4.3 · **9 sites** (a 10th is fixed on `feat/ugc-media-upload-ui`)

`bg-[#F78E42]` + `text-white` = **2.36:1**. `tailwind.config.ts:23-31` documents this
and says never to do it. Replace with `bg-ocean-blue text-white` (5.82:1) or
`bg-[#F78E42] text-[#11100D]` (8.07:1) — pick per surface so the orange survives where
it is the brand accent.

Sites: `app/not-found.tsx:30`, `app/tools/water-quality/page.tsx:371`,
`components/beach-detail.tsx:1005`, `components/beach-detail/beach-alert-cta.tsx:238`,
`components/ui/public-content-gate.tsx:192`, `components/ui/sticky-signup-bar.tsx:196`,
`components/profile/referral-leaderboard.tsx:265`,
`components/profile/set-home-break-cta.tsx:85`, `components/seo/alert-capture-cta.tsx:166`.

Three sit on the signup funnel (`public-content-gate`, `sticky-signup-bar`,
`alert-capture-cta`) — relevant to plan 065.

**Also ship the ratchet — approach settled by research 2026-08-13:**
`no-restricted-syntax` in the shared rules block of `eslint.config.mjs` (flat config,
ESLint 9 + typescript-eslint). Two selectors, `Literal` and `TemplateElement`,
**unscoped** — not narrowed to `JSXAttribute`, because this repo's canonical CTA
pattern is a module-level class constant (`components/landing-page/hero-section.tsx:37`).
A `(?!/)` lookahead keeps opacity variants (`bg-[#F78E42]/10`) legal: without it, 7 of
17 same-line matches are false positives. Include a `bg-ocean-blue-decorative` arm —
same colour via alias, 6 usages already exist. Verified against the tree: exactly 10
hits, zero false positives. Precedent for this rule shape already exists at
`eslint.config.mjs:88-104` (`no-restricted-globals`, `no-restricted-properties`).

**SEQUENCING — the rule and the 10 fixes must land in the SAME commit.** `yarn lint`
runs `--max-warnings=0` and Main Gate runs it on every PR, so landing the rule alone
turns CI red.

**Known gaps — accept them, this is a tripwire not a contrast checker:** tokens split
across separate `cn()` arguments, interpolated variables, conditional branches,
cross-component composition (parent passes `text-white`, child supplies the bg — the
highest-probability real escape), lowercase hex, inline styles and CSS, and paths
ESLint ignores. General coverage would be `jest-axe` (already a devDependency) or a
Playwright axe scan — separate, larger work.

### 3. DONE — Focus indicator removed with no replacement
**Severity:** High · WCAG 2.4.7
`components/forecast/forecast-feedback-capture.tsx:407` sets `outline-none`; its
wrapping `<span>` (line ~390) has no `focus-within:` styling, so focus is invisible.
Match the sibling textarea at line ~431: move a ring onto the wrapper.

### 4. DONE — Unlabeled icon-only buttons
**Severity:** High · WCAG 4.1.2
`components/session-detail-view.tsx:372` (Trash2 — destructive, announced only as
"button"), `components/journal/journal-view.tsx:348` (Settings),
`components/beach/beach-reviews-list.tsx:182` (Edit3),
`components/forecast/forecast-accuracy-summary.tsx:114` (RefreshCw).

### 5. DONE — Tide table clips on mobile
**Severity:** High · Responsive
`components/forecast/tide-hourly-table.tsx:219` uses unconditional `grid-cols-2`
around two 12-column tables inside `overflow-hidden`, so content is clipped rather
than scrollable. Use `grid-cols-1 md:grid-cols-2` and `overflow-x-auto`.
"Data is sacred" is design principle #1.

### 6. BLOCKED(premise falsified — needs an operator design call) — mint `#00D4AA`
**The audit was wrong to call this off-palette.** It is absent from `zine.css`'s 27
tokens, but it is documented as brand-sanctioned elsewhere:

- `components/map/swell-map-theme.ts` — `wind: "#00D4AA", // Pacific Teal (the ONE
  sanctioned teal; NOT #38bdf8 cyan)` — a deliberate data-viz choice giving the map
  three distinguishable layers (orange s1, gold s2, teal wind). The comment
  pre-empts exactly this confusion.
- `components/map/conditions-callout-data.ts:7` — `// Pacific Teal (brand-sanctioned;
  never cyan)`
- Also live in `map/map-marker-builder.ts`, `app/embed/map/embed-map-client.tsx`
  (Wind legend), `app/api/og/forecast-window/route.tsx`, and
  `app/vs/surfline/free/page-content.tsx` — **8 sites the audit never scanned**,
  because it only covered the logged-in surfaces.

A branch (`fix/audit-06-off-palette-mint`) exists with 6 non-map files recoloured and
4 tokens promoted from `.zine-tab` to `:root` in `zine.css`. It is **NOT committed**.
Its map change was reverted during review: it swapped wind to `--stamp-blue` (#0B3A75,
dark navy) on a #161A40 map background — near-invisible — while leaving
`swell-map-theme.ts` at teal, so the two disagreed.

**The real question is a design one:** Pacific Teal is clearly sanctioned for *wind*
data-viz. Is it also intended for *status/verdict* chips (fit picker, confidence
badge, roadmap chip, best-surf-windows)? If yes, close this item — there is no defect.
If no, the branch is ready apart from that decision. Do not land a recolour on the
audit's original premise; it does not hold.

### 7. DONE — `spot-overview.tsx` is an un-migrated glassmorphism artifact
**Severity:** Medium · Anti-pattern · needs design judgement, not mechanical edit
`components/beach-detail/spot-overview.tsx:152-155` stacks `backdrop-blur`,
cyan→teal gradients, `rounded-2xl` and `shadow-lg` on a white surface. Also fails
contrast: `text-teal-600` on `bg-teal-100` = 3.32:1; `text-cyan-600` on `bg-cyan-50`
= 3.54:1 (also in `beach-hero-compact.tsx:82,93` and `best-surf-window.tsx:1097`).
Rebuild on `ZineSurface` with cream paper, ink text, `--stamp-blue` icon.

### 8. DONE — Framer Motion animates `height: 0 → auto`
**Severity:** Medium · Performance
`components/session-forms/VisibilitySection.tsx:63-97`. Forces layout every frame.
Use a `grid-template-rows: 0fr → 1fr` transition.

### 9. DONE — Framer Motion without reduced-motion guard
**Severity:** Medium · WCAG 2.3.3
`components/session-forms/VisibilitySection.tsx`, `components/beach-detail/beach-hero-compact.tsx:198`.
The global CSS guard at `app/globals.css:392` kills CSS animation but cannot stop
JS-driven transforms — these need `useReducedMotion`.

### 10. DONE — Session-video orphan retention cron
**Severity:** Medium · durable follow-up to the client-side fix in `00b58827b`
Client cleanup is best-effort; a closed tab between upload and finalize still strands
an object. Mirror `app/api/cron/community-photo-retention/route.ts` for
`session-videos`: reclaim objects with no `session_media` row older than ~24h.

### 11. DONE — Decorative `alt=""` on a content image
**Severity:** Medium · WCAG 1.1.1
`components/session-detail-view.tsx:184` — the shared-session preview is the primary
content of that view. Compare the correct pattern at `zine/atoms/index.tsx:349-357`.

### 12. DONE — Focus-ring consistency on raw `<button>`
**Severity:** Medium · 45 elements across 25 files
Not a WCAG failure (no global outline reset — verified), but the UA default ring is
inconsistent on cream and low-contrast on twilight, while `ui/button` ships
`focus-visible:ring-2`. Introduce a shared utility and apply.

### 13. DONE — `transition-all` (57 uses)
**Severity:** Medium · Performance. Narrow to `transition-colors` / `transition-transform`.
Heaviest: `app-header.tsx` (7), `BeachChip.tsx`, `swell-event-card.tsx`,
`beach-conditions-grid.tsx`, `forecast-tab.tsx`, `alert-rule-card.tsx` (3 each).

### 14. DONE — Heading level skip
**Severity:** Low · `components/beaches-enhanced-forecast.tsx:807` jumps h3 → h5.

### 15. DONE(partial, scoped) — Token extraction (1,199 hard-coded hex literals)
**Severity:** Low severity, high leverage. **Do item 2's lint rule first**, else it regresses.
`#11100D` ×382, `#F78E42` ×197, `#F4EBD8` ×71 all exist as tokens in `app/styles/zine.css`.
Worst files: `alerts-management-page.tsx` (124), `beach-detail/tabs/forecast-tab.tsx` (79),
`SessionScrollForm.tsx` (69). Introduce Tailwind utilities for the zine palette, then codemod.

---

### 16. CLOSED(not a real defect) — 'flaky suites' were an env artifact
**Severity:** Medium · test infrastructure · NOT caused by any audit branch
**There is no pollution.** The suite turns any unexpected `console.warn` into a
failure, and `NEXT_PUBLIC_SITE_URL` is absent from `.env.local`, so the env-validation
warning surfaced as a test failure in whichever suite happened to load the config.

Compounding it, the first attempted fix set the var to a *guessed* value
(`https://quiversurf.app`), which broke `__tests__/lib/seo/meta.test.ts` and
`__tests__/app/pbsc-page.test.tsx` — those derive expectations from the var with a
`|| "http://localhost:3000"` fallback.

**Set `NEXT_PUBLIC_SITE_URL=http://localhost:3000`** — the documented default — and the
full suite is green: 1278 suites, 16629 tests, 0 failures. No test-infrastructure
change is needed. A Codex run hunting the phantom pollution was stopped mid-flight; it
had made no changes.

---

## Merge notes — READ BEFORE INTEGRATING

- **Merge `fix/audit-02-orange-contrast-ratchet` BEFORE `refactor/audit-15-zine-token-utilities`.**
  Item 15 introduces a `bg-q-orange` utility that resolves to the same #F78E42. The
  ratchet was amended to cover that alias (verified: all three of `bg-[#F78E42]`,
  `bg-ocean-blue-decorative`, `bg-q-orange` paired with `text-white` are caught, while
  `bg-q-orange/20` and orange-with-ink stay legal). Without the amendment the token
  migration would have silently reopened the WCAG hole item 2 closed.
- **`components/session/post-session-share.tsx` will conflict** between
  `feat/audit-ugc-media-upload-ui` and `fix/audit-02-orange-contrast-ratchet` — both fix
  the same orange CTA line. Trivial to resolve.
- **The `/harden` work is still uncommitted in the main working tree** and touches
  `alert-creation-popover`, `anon-alert-capture-form`, `BeachChip` — the same three files
  item 2 fixed on its branch. Commit or discard it before merging item 2.
- `refactor/audit-15` touches `tailwind.config.ts`; `fix/audit-02` touches
  `eslint.config.mjs`. No overlap, but both are repo-wide config.
- `style(a11y)` item 12 touches 92 files — merge it early or late, not in the middle,
  to keep conflicts in one place.

## Done

### 1 — Hover-only reveals · `fix/audit-01-hover-only-reveals` · `ff1e1808f`
session-photo-upload remove button and session-photo-gallery edit/delete are now
always visible, 44px hit areas via `after:` pseudo-elements, descriptively named;
preview `alt` names the file instead of "Preview". buoy-station-link and
popular-beaches-section deliberately left alone — decorative reinforcement only.
Gates re-run independently: typecheck clean, eslint clean, 2/2 tests, and the fix
verified load-bearing (reverting it turns the test red).

### 5 — Tide table responsive · `fix/audit-05-tide-table-responsive` · `00153a518`
All three tables in the file now scroll instead of clipping; grid is single-column
with an md: two-column modifier; scroll containers are keyboard-reachable.

### 8+9 — Motion perf + reduced-motion · `fix/audit-08-motion-perf-and-reduced` · `a9b3aa63d`
height 0->auto replaced with grid-template-rows 0fr->1fr; useReducedMotion added to
both components. The `<label>` was preserved as the inner wrapper so the checkbox
keeps its implicit association.

### 14 — Heading hierarchy · `fix/audit-14-heading-hierarchy` · `51e072de7`
Four h5 promoted to h4; visual size unchanged (it came from classes, not the tag).

### 3+4 — Focus ring + icon-button names · `fix/audit-03-focus-and-labels` · `2e0b72420`
Ring moved onto the wrapper in forecast-feedback-capture; four icon-only buttons named,
plus extras found in the same files (edit/delete review, share, feed-visibility toggle),
icons marked aria-hidden. Verified independently: typecheck clean, eslint clean on source
files, 18 tests across 5 suites, and both fixes proven load-bearing by reverting them.
Note `yarn lint` ignores `__tests__/**` and `e2e/**`, so pre-existing warnings in untouched
test files do not reach CI — scope lint to changed SOURCE files when gating.

### 2 — Orange-on-white CTAs + lint ratchet · `fix/audit-02-orange-contrast-ratchet` · `dc8d753c5`
**13 sites, not 10** — the extra three (`alert-creation-popover`,
`anon-alert-capture-form`, `BeachChip`) were already fixed by the `/harden` pass but
those fixes are *uncommitted* in the main working tree, so they were still broken on
committed `main`. The original count came from a dirty tree; **when the `/harden`
work commits, these three will conflict.**
8 sites moved to `bg-ocean-blue`, the rest kept orange with ink text. Ratchet added
to `eslint.config.mjs`. Verified independently: zero errors after fixes, rule fires
when a site is re-broken, opacity variants and the correct
`bg-ocean-blue-decorative + text-background` landing CTAs are not flagged.
