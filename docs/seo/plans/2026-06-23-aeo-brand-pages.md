# AEO Brand Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the net-new `/vs/surfline/free` head-to-head page plus brand+AEO reinforcement of two existing learn articles and P1 drift fixes on `/vs/surfline`, in a single deploy.

**Architecture:** `/vs/surfline/free` is a sibling **server component** copied from `app/vs/surfline/page.tsx` (self-contained cream design, ISR `revalidate=86400`), re-pointed metadata/canonical to `/vs/surfline/free`, with a free-$0 wedge, a hardcoded social-proof stat row, a live cam wall fed by the existing `getBeachesWithCameras()` server action, a roadmap comparison row, and an `/app` + `/roadmap` link layer. The two learn edits are **data-only** changes to object literals in `lib/data/learn-articles.ts` (internal-link rails + an inline "where next" line + `dateModified` bump) — no title/description/meta churn. `/vs/surfline` gets a dated-pricing + calibration-language refresh only.

**Tech Stack:** Next.js 16 App Router (server components, ISR), TypeScript (strict), Tailwind, Supabase server action (`getBeachesWithCameras`), Jest (unit), Playwright (e2e).

**Spec:** `docs/seo/specs/2026-06-23-aeo-brand-pages-design.md`

---

## Ground rules (read once before starting)

- **Run all commands from the `quiver/` directory with Node 22.** `yarn test:unit` = Jest; `yarn test` = Playwright — never confuse them.
- **Copy guardrails (from spec §3):** describe Quiver as a free Surfline alternative while keeping the geographic coverage and optional Pro personalization alongside the price claim; never claim "no paywall" or "free forever," publish fabricated head-to-head MAE numbers vs Surfline, or present the in-sample concordance as live fact.
- **`/vs/surfline` must NOT gain the word "free":** `__tests__/app/vs-surfline-metadata.test.ts` asserts `/\bfree\b/i` is absent from `/vs/surfline` metadata AND page source. Phase C edits to that file must avoid the word "free."
- **`FAQSchema` is a deliberate no-op** (returns `null`; Google restricts FAQ rich results). FAQ copy still helps AI Overviews (they read the visible Q&A) but produces no FAQPage rich snippet — do not expect one.
- **Beach links use `buildBeachUrl({slug, city, state})`** from `@/lib/utils/beach-url-utils` → `/<state>/<city>/<beachSlug>`. Do NOT link `/forecast/<beachSlug>` (region-only path that 301-redirects).
- **Social-proof numbers:** stat row hardcodes `2.5M+` forecasts and `280+` breaks (mark with a `// marketing constant — bump periodically` comment); cam count is derived live from the fetched list. No counts for sessions/alerts/emails/roadmap (too small — see spec §3).
- **Single deploy:** all phases ship together; do not deploy phases piecemeal (spec §9).

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `app/vs/surfline/free/page.tsx` | Create | The new head-to-head page (server component) |
| `__tests__/app/vs-surfline-free-metadata.test.ts` | Create | Metadata assertions for the new page |
| `e2e/guest-seo-updated-surfaces.spec.ts` | Modify | Add a `/vs/surfline/free` render+intent test block |
| `app/sitemap.ts` | Modify | Register `/vs/surfline/free` (and optionally `/roadmap`) |
| `lib/data/learn-articles.ts` | Modify | `how-to-read-surf-conditions` + `groundswell-vs-wind-swell` internal links, where-next line, `dateModified` |
| `app/vs/surfline/page.tsx` | Modify | P1 drift: refresh pricing-checked date, soften "every beach" calibration language |
| `CHANGELOG.md` | Modify | `[Unreleased]` entry |

Reused without modification: `getBeachesWithCameras()` (`actions/beach/cam-actions.ts`), `buildBeachUrl` (`@/lib/utils/beach-url-utils`), `buildPageMetadata` (`@/lib/seo/meta`), `BreadcrumbStructuredData`/`WebPageSchema`/`FAQSchema` (`components/seo/*`), `FadeInSection`/`AnimatedStickerBadge`/`AnimatedFeatureRow`/`VsAnimationStyles` (`app/vs/surfline/animations.tsx`).

---

## Phase A — `/vs/surfline/free` page

### Task A1: Metadata test (TDD red first)

**Files:**
- Create: `__tests__/app/vs-surfline-free-metadata.test.ts`

- [ ] **Step 1: Write the failing test** (mirrors `__tests__/app/vs-surfline-metadata.test.ts`, inverted for "free")

```ts
import { metadata } from "@/app/vs/surfline/free/page";

describe("/vs/surfline/free metadata", () => {
  it("targets the free-surfline-alternative query", () => {
    expect(metadata.title).toBe("Free Surfline Alternative: Quiver");
    expect(String(metadata.description)).toMatch(/free/i);
    expect(String(metadata.description)).toMatch(/no subscription/i);
  });

  it("canonicalizes to /vs/surfline/free (not /vs/surfline)", () => {
    const canonical = String(metadata.alternates?.canonical ?? "");
    expect(canonical).toMatch(/\/vs\/surfline\/free$/);
  });

  it("includes free-intent keywords", () => {
    expect(metadata.keywords).toEqual(
      expect.arrayContaining(["free surfline alternative"]),
    );
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `yarn test:unit __tests__/app/vs-surfline-free-metadata.test.ts`
Expected: FAIL — `Cannot find module '@/app/vs/surfline/free/page'`.

### Task A2: Scaffold the page from `/vs/surfline` and re-point metadata

**Files:**
- Create: `app/vs/surfline/free/page.tsx` (start by copying `app/vs/surfline/page.tsx` verbatim, then apply the edits below)

- [ ] **Step 1: Copy the source page**

Run: `cp app/vs/surfline/page.tsx app/vs/surfline/free/page.tsx`

- [ ] **Step 2: Fix the animations import path** (the new file is one folder deeper)

In `app/vs/surfline/free/page.tsx`, change every `from "./animations"` to `from "../animations"`.
Expected import line becomes:
```ts
import { FadeInSection, AnimatedStickerBadge, AnimatedFeatureRow, VsAnimationStyles } from "../animations";
```

- [ ] **Step 3: Replace the `metadata` export** (re-points title/description/path/keywords → own canonical via `path`)

```ts
export const metadata: Metadata = buildPageMetadata({
  title: "Free Surfline Alternative: Quiver",
  description:
    "Quiver is a free Surfline alternative: check 280+ US, Hawaii, Puerto Rico and Baja breaks with forecasts, tides, and live cams, no subscription required.",
  path: "/vs/surfline/free",
  keywords: [
    "free surfline alternative",
    "free alternative to surfline",
    "surfline free alternative",
    "free alternative to surfline premium",
    "no subscription surf forecast",
    "free surf forecast app",
    "free surf cams",
    "surfline premium alternative",
  ],
  image: "/api/og/guide?title=Free%20Surfline%20Alternative&region=Compare",
});
```
(Keep `export const revalidate = 86400;` unchanged. Note: the OG route's `SAFE_TEXT_RE` allows letters/space only — "Free Surfline Alternative" and "Compare" are safe.)

- [ ] **Step 4: Re-point the breadcrumb leaf** (find the `BreadcrumbStructuredData` items array, ~page.tsx:386 in the source)

```tsx
<BreadcrumbStructuredData
  items={[
    { name: "Home", url: "/" },
    { name: "Compare", url: "/vs/surfline" },
    { name: "Free Surfline Alternative", url: "/vs/surfline/free" },
  ]}
/>
```

- [ ] **Step 5: Run the metadata test, verify it passes**

Run: `yarn test:unit __tests__/app/vs-surfline-free-metadata.test.ts`
Expected: PASS (all 3).

- [ ] **Step 6: Typecheck + commit**

Run: `yarn typecheck`
Expected: no errors.
```bash
git add app/vs/surfline/free/page.tsx __tests__/app/vs-surfline-free-metadata.test.ts
git commit -m "feat(seo): scaffold /vs/surfline/free head-to-head page"
```

### Task A3: Free-$0 wedge copy + stat row + roadmap row + native-app/roadmap links

**Files:**
- Modify: `app/vs/surfline/free/page.tsx`

- [ ] **Step 1: Rewrite the hero copy to lead with the free wedge** (the source hero downplays price; here it leads). Replace the hero eyebrow / H1 / subhead text with:

- Eyebrow: `QUIVER VS SURFLINE · THE FREE READ`
- H1: `Looking for a free Surfline alternative?`
- Subhead: `Quiver lets you check 280+ breaks across the US coasts, Hawaii, Puerto Rico, and Baja — free, no subscription to read conditions. A Pro tier adds session-based personalization. Surfline is global but paywalls its forecasts.`
- Keep both CTAs; primary label `Start free`.

- [ ] **Step 2: Add the stat row** directly under the hero CTAs (server-rendered; `camBeaches` is fetched in Step 5 — place this JSX after the cam fetch is wired, or use the literal `73` first and switch to `camCount` in Step 6). Insert:

```tsx
<div className="grid grid-cols-3 gap-2 mt-5">
  {[
    { n: "2.5M+", l: "forecasts crunched" }, // marketing constant — bump periodically
    { n: "280+", l: "breaks dialed in" },    // marketing constant — keep in sync with coverage
    { n: `${camCount}`, l: "live cams" },     // live: derived from getBeachesWithCameras()
  ].map((s, i) => (
    <div
      key={s.l}
      className={`bg-[#252D6B] text-[#F5EEDC] rounded-[12px_4px_14px_6px] shadow-[2px_3px_0_rgba(0,0,0,0.3)] px-3 py-3 ${["rotate-[-1deg]", "rotate-[1.2deg]", "rotate-[-0.6deg]"][i]}`}
    >
      <div className="font-heading font-bold text-2xl leading-none">{s.n}</div>
      <div className="font-mono text-[10px] tracking-wider uppercase text-[#00D4AA] mt-1">{s.l}</div>
    </div>
  ))}
</div>
```

- [ ] **Step 3: Add a roadmap row to `COMPARISON_FEATURES`** (append one `FeatureRow`; both the desktop table and mobile cards map the array, so no JSX change):

```ts
{
  feature: "Public roadmap",
  description: "Vote on what gets built next and submit requests.",
  quiver: "included",
  quiverNote: "Vote + submit",
  surfline: "none",
},
```

- [ ] **Step 4: Add a roadmap proof row + roadmap quick-link.** Append to `PROOF_ITEMS`:

```ts
{
  icon: <Compass className="h-5 w-5" aria-hidden />, // reuse an already-imported lucide icon; swap if Compass isn't imported
  title: "Built in the open",
  description: "Vote on what we build next — the roadmap is public and yours to shape.",
  href: "/roadmap",
},
```
And add to the bottom quick-links rail (where the other `QuickTextLink`s render):
```tsx
<QuickTextLink href="/roadmap">Vote on the roadmap</QuickTextLink>
```

- [ ] **Step 5: Wire the cam wall** (Task A4 implements the section; this step adds the data fetch). Make the default export `async` and fetch the list at the top of the component body:

```tsx
import { getBeachesWithCameras } from "@/actions/beach/cam-actions";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
// ...
export default async function VsSurflineFreePage() {
  const camBeaches = await getBeachesWithCameras();
  const camCount = camBeaches.length;
  // ...existing JSX, now able to reference camCount + camBeaches
}
```

- [ ] **Step 6: Add the native-app link block** (links to the canonical `/app` hub which already hosts the App Store badge + Android waitlist — avoids hardcoding store URLs). Place it after the decision cards:

```tsx
<div className="flex items-center gap-3 bg-[#FFFDF7] border-2 border-[#11100D] rounded-[10px] px-4 py-3 mt-6">
  <div>
    <div className="font-heading font-bold text-[15px]">Get it on your phone</div>
    <span className="font-sans text-[11.5px] text-[#6b6557]">iOS live now · Android waitlist open</span>
  </div>
  <Link href="/app" className="ml-auto font-heading font-bold text-xs bg-[#11100D] text-[#F5EEDC] rounded-lg px-3 py-2">
    Get the app
  </Link>
</div>
```

- [ ] **Step 7: Typecheck + scoped lint**

Run: `yarn typecheck`
Run: `NODE_OPTIONS="--max-old-space-size=8192" npx eslint --max-warnings=0 app/vs/surfline/free/page.tsx`
Expected: both clean. (If the chosen lucide icon isn't imported, add it to the existing `lucide-react` import.)

- [ ] **Step 8: Commit**

```bash
git add app/vs/surfline/free/page.tsx
git commit -m "feat(seo): free wedge, stat row, roadmap row, app links on /vs/surfline/free"
```

### Task A4: Live cam wall section

**Files:**
- Modify: `app/vs/surfline/free/page.tsx`

- [ ] **Step 1: Add the cam-wall section** (after the native-app block). Renders up to 12 cam tiles linked via `buildBeachUrl`, then a "see all" link to `/cams`:

```tsx
<section aria-labelledby="cam-wall-heading" className="mt-12">
  <div className="flex items-baseline justify-between mb-3">
    <h2 id="cam-wall-heading" className="font-mono text-[11px] tracking-[0.16em] font-bold uppercase text-[#252D6B]">
      Watch any break · free
    </h2>
    <span className="font-mono text-[10px] text-[#6b6557]">{camCount} live cams</span>
  </div>
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
    {camBeaches.slice(0, 12).map((b) => (
      <Link
        key={b.id}
        href={buildBeachUrl({ slug: b.slug, city: b.city, state: b.state })}
        className="rounded-md overflow-hidden border border-[#11100D] block"
      >
        <div className="h-12 bg-gradient-to-br from-[#3a4896] to-[#252D6B] relative">
          <span className="absolute top-1 left-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00D4AA]" aria-hidden />
            <span className="font-mono text-[7px] tracking-wider text-white">LIVE</span>
          </span>
        </div>
        <div className="bg-[#FFFDF7] px-1.5 py-1">
          <div className="font-sans text-[10px] font-medium text-[#11100D] leading-tight truncate">{b.name}</div>
          <div className="font-mono text-[7px] tracking-wide text-[#6b6557] uppercase">{b.city}, {b.state}</div>
        </div>
      </Link>
    ))}
  </div>
  <Link href="/cams" className="inline-flex items-center gap-1 mt-3 font-heading font-bold text-sm text-[#F78E42]">
    See all {camCount} cams →
  </Link>
</section>
```

- [ ] **Step 2: Verify the page builds and renders cams**

Run: `yarn build 2>&1 | grep -E "vs/surfline/free|error" | head`
Expected: the route compiles with no error (cam fetch runs at build/ISR time via the cached server action).

- [ ] **Step 3: Typecheck, lint, commit**

Run: `yarn typecheck && NODE_OPTIONS="--max-old-space-size=8192" npx eslint --max-warnings=0 app/vs/surfline/free/page.tsx`
```bash
git add app/vs/surfline/free/page.tsx
git commit -m "feat(seo): live cam wall on /vs/surfline/free"
```

### Task A5: Refresh JSON-LD + disclosure dates on the new page

**Files:**
- Modify: `app/vs/surfline/free/page.tsx`

- [ ] **Step 1: Keep Quiver's `Offer` price `"0"`** in `ComparisonStructuredData()` (already correct — confirm it reads `price: "0"`).

- [ ] **Step 2: Re-verify Surfline pricing and refresh the audit date.** Confirm Surfline's current public plan prices. Update the hardcoded `surflineApp.offers` `AggregateOffer` (`lowPrice`/`highPrice`/`priceValidUntil`) only if changed, and update every "checked … 2026" string in `FAQ_ITEMS` and the disclosure section to today's verification date. The visible copy must keep "Varies by plan and region" (no specific dollar figure on-page).

- [ ] **Step 3: Typecheck + commit**

Run: `yarn typecheck`
```bash
git add app/vs/surfline/free/page.tsx
git commit -m "chore(seo): dated Surfline pricing disclosure on /vs/surfline/free"
```

### Task A6: e2e render + intent test

**Files:**
- Modify: `e2e/guest-seo-updated-surfaces.spec.ts`

- [ ] **Step 1: Add a test block** mirroring the existing "/vs/surfline targets alternative intent without free positioning" test (~lines 60–74), inverted to assert free positioning IS present, using the file's `setupErrorDetection`/`assertNoErrors`/`gotoPublicPage` helpers:

```ts
test("/vs/surfline/free targets the free-alternative intent", async ({ page }) => {
  await gotoPublicPage(page, "/vs/surfline/free");
  await expect(page).toHaveTitle(/Free Surfline Alternative/i);
  await expect(page.locator("h1")).toContainText(/free surfline alternative/i);
  const body = await page.locator("body").innerText();
  expect(body).toMatch(/\bfree\b/i);
  expect(body).toMatch(/live cams/i);
});
```

- [ ] **Step 2: Run it**

Run: `npx playwright test e2e/guest-seo-updated-surfaces.spec.ts -g "free-alternative intent"`
Expected: PASS, no console errors.

- [ ] **Step 3: Commit**

```bash
git add e2e/guest-seo-updated-surfaces.spec.ts
git commit -m "test(e2e): cover /vs/surfline/free intent and cam wall"
```

### Task A7: Register in sitemap

**Files:**
- Modify: `app/sitemap.ts`

- [ ] **Step 1: Add the route** to the `getStaticRoutes()` string array (after the `/vs/surfline` entry, ~line 142):

```ts
"/vs/surfline/free",
```

- [ ] **Step 2: Give it an explicit priority** in the priority ternary (lines ~147–154), before the final `: 0.7`:

```ts
: route === "/vs/surfline/free" ? 0.78
```

- [ ] **Step 3 (optional, recommended): register `/roadmap`** — its sitemap entry was deferred post-freeze and we now link it. Add `"/roadmap"` to the same array and `: route === "/roadmap" ? 0.6` to the ternary. Skip if you prefer to keep the roadmap-sitemap decision separate.

- [ ] **Step 4: Run sitemap tests + typecheck**

Run: `yarn test:unit __tests__/app/sitemap.test.ts && yarn typecheck`
Expected: PASS. If the test asserts a URL count, update the expected count in the same commit.

- [ ] **Step 5: Commit**

```bash
git add app/sitemap.ts __tests__/app/sitemap.test.ts
git commit -m "feat(seo): add /vs/surfline/free to sitemap"
```

---

## Phase B — Learn article reinforcement (data-only)

> No title/description/FAQ-meta churn (those are pinned by `__tests__/lib/data/learn-articles.test.ts` and the SEO-stability policy). The lever here is internal links — inbound from the new `/free` page plus tightened cross-links — and an inline "where next" line. Bump `dateModified`.

### Task B1: `how-to-read-surf-conditions`

**Files:**
- Modify: `lib/data/learn-articles.ts` (object at ~lines 38–180)

- [ ] **Step 1: Replace `relatedLinks`** with the tightened cluster (keep it ≤6):

```ts
relatedLinks: [
  { label: "Groundswell vs Wind Swell", href: "/learn/groundswell-vs-wind-swell", description: "Why a 2-ft groundswell can out-surf a 6-ft wind swell." },
  { label: "Swell Period Explained", href: "/learn/swell-period-explained", description: "What the seconds in a forecast actually tell you." },
  { label: "How Accurate Are Surf Forecasts?", href: "/learn/how-accurate-are-surf-forecasts", description: "How far out to trust the numbers." },
  { label: "Quiver vs Surfline", href: "/vs/surfline", description: "How Quiver's per-beach call compares." },
  { label: "Best Surf Conditions for Beginners", href: "/learn/best-surf-conditions-for-beginners", description: "The friendliest windows to paddle out." },
  { label: "What Is the Best Tide for Surfing?", href: "/learn/best-tide-for-surfing", description: "How tide reshapes the same swell." },
],
```

- [ ] **Step 2: Append a "where next" line** to the END of the `content` HTML string of the last section (`id="reading-order"`). It must be a valid HTML string (rendered via `dangerouslySetInnerHTML`); plain `<p>`/`<a>`, no Tailwind classes:

```html
<p>Want the read done for you? Quiver scores 280+ breaks by tide, wind, and swell and learns the days you rate — see <a href="/vs/surfline/free">how it compares to Surfline</a> or <a href="/roadmap">vote on what we build next</a>. Runs in any browser, or <a href="/app">get the iOS app</a>.</p>
```

- [ ] **Step 3: Bump `dateModified`** on this article to `"2026-06-23"`.

- [ ] **Step 4: Verify (title/description unchanged → pinned test still green)**

Run: `yarn typecheck && yarn test:unit __tests__/lib/data/learn-articles.test.ts`
Expected: PASS.

### Task B2: `groundswell-vs-wind-swell`

**Files:**
- Modify: `lib/data/learn-articles.ts` (object at ~lines 451–587)

- [ ] **Step 1: Replace `relatedLinks`** with the tightened cluster:

```ts
relatedLinks: [
  { label: "How to Read a Surf Report", href: "/learn/how-to-read-surf-conditions", description: "Period, direction, wind, tide, then height." },
  { label: "Swell Period Explained", href: "/learn/swell-period-explained", description: "Why period separates power from mush." },
  { label: "How Swell Direction Affects Surf", href: "/learn/how-swell-direction-affects-surf", description: "Whether your break even catches the swell." },
  { label: "How Surf Forecasts Work", href: "/learn/how-surf-forecasts-work", description: "Where the swell data comes from." },
  { label: "Quiver vs Surfline", href: "/vs/surfline", description: "Per-beach calls vs a regional star." },
],
```

- [ ] **Step 2: Append the "where next" line** to the END of the `content` of the last section (`id="reading-both"`):

```html
<p>Skip the chart-reading? Quiver tags primary groundswell vs secondary wind swell for 280+ breaks and learns the days you rate — see <a href="/vs/surfline/free">how it compares to Surfline</a> or <a href="/roadmap">vote on what we build next</a>. Runs in any browser, or <a href="/app">get the iOS app</a>.</p>
```

- [ ] **Step 3: Bump `dateModified`** to `"2026-06-23"`. Do NOT touch `title`/`description` (the description is at the 155-char ceiling and pinned by test).

- [ ] **Step 4: Verify + scoped lint**

Run: `yarn typecheck && yarn test:unit __tests__/lib/data/learn-articles.test.ts`
Run: `NODE_OPTIONS="--max-old-space-size=8192" npx eslint --max-warnings=0 lib/data/learn-articles.ts`
Expected: all clean.

- [ ] **Step 5: Commit Phase B**

```bash
git add lib/data/learn-articles.ts
git commit -m "feat(seo): tighten internal-link cluster + cross-sell on learn guides"
```

---

## Phase C — `/vs/surfline` P1 drift fixes

> Must NOT introduce the word "free" (keeps `__tests__/app/vs-surfline-metadata.test.ts` green). Title/description unchanged.

**Files:**
- Modify: `app/vs/surfline/page.tsx`

- [ ] **Step 1: Refresh the pricing-checked date.** Update every "checked … 2026" string in `FAQ_ITEMS` and the disclosure section to today's re-verification date, and re-verify/refresh the hardcoded `surflineApp.offers` `AggregateOffer` (`lowPrice`/`highPrice`/`priceValidUntil`) in `ComparisonStructuredData()` if Surfline's pricing changed.

- [ ] **Step 2: Soften any uniform-calibration language.** Grep the file and adjust:

Run: `grep -niE "every beach|all 279 beaches.*(calibrat|tuned)|calibrat" app/vs/surfline/page.tsx`
For any phrasing implying *every* beach gets identical face-height calibration, reword to "per-beach" / "where calibrated" (only ~117 of ~280 beaches are fully shoaling-calibrated). Coverage statements like "All 279 beaches" (about how many breaks exist) are fine — only fix calibration/accuracy claims.

- [ ] **Step 3: Confirm no curated MAE/concordance is presented as live fact.**

Run: `grep -niE "0\.30|0\.35|mae|concordance|75%|accurate than surfline" app/vs/surfline/page.tsx`
Expected: no on-page head-to-head MAE/concordance claims (the accuracy story lives behind a link to `/forecast-accuracy`). If any appear as live fact, remove or hedge per spec §3.

- [ ] **Step 4: Verify guardrail tests still green**

Run: `yarn test:unit __tests__/app/vs-surfline-metadata.test.ts && yarn typecheck`
Expected: PASS (title/description unchanged; no "free" added).

- [ ] **Step 5: Commit**

```bash
git add app/vs/surfline/page.tsx
git commit -m "chore(seo): refresh dated pricing + soften calibration language on /vs/surfline"
```

---

## Phase D — CHANGELOG + full verification

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add an `[Unreleased]` entry**

```markdown
### Added
- `/vs/surfline/free` head-to-head page (free-Surfline-alternative intent) with social-proof stat row, live cam wall, public-roadmap comparison row, and App/roadmap links.

### Changed
- Learn guides (`how-to-read-surf-conditions`, `groundswell-vs-wind-swell`): tightened internal-link cluster + cross-sell, refreshed `dateModified`.
- `/vs/surfline`: refreshed dated pricing disclosure and softened per-beach calibration language.
```

- [ ] **Step 2: Full verification sweep**

Run: `yarn typecheck`
Run: `NODE_OPTIONS="--max-old-space-size=8192" npx eslint --max-warnings=0 app/vs/surfline/free/page.tsx app/vs/surfline/page.tsx app/sitemap.ts lib/data/learn-articles.ts`
Run: `yarn test:unit __tests__/app/vs-surfline-free-metadata.test.ts __tests__/app/vs-surfline-metadata.test.ts __tests__/lib/data/learn-articles.test.ts __tests__/app/sitemap.test.ts`
Run: `npx playwright test e2e/guest-seo-updated-surfaces.spec.ts`
Run: `yarn build`
Expected: all green; `yarn build` compiles `/vs/surfline/free` as a static/ISR route.

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog for AEO brand pages"
```

- [ ] **Step 4: Deploy note (do NOT auto-deploy).** All phases ship in one deploy to `prod` (spec §9). `quiver/` deploys from the `prod` branch — after merge, verify the deployed commit SHA and that `https://www.quiversurf.app/vs/surfline/free` returns 200 with `rel=canonical` → `/vs/surfline/free`. Hold further SEO changes for the stability window.

---

## Self-Review (completed by plan author)

**Spec coverage:** `/vs/surfline/free` (A1–A7) ✓ · heavier headlines (Task A3 uses `font-heading font-bold`; prod 900 cut is a token concern, not page code) ✓ · stat row (A3) ✓ · cam wall + 73 internal links (A4) ✓ · roadmap row + link + sitemap (A3, A7) ✓ · native-app links (A3) ✓ · learn internal-link reinforcement (B1–B2) ✓ · `/vs/surfline` drift (C) ✓ · copy guardrails enforced throughout (ground rules + C3) ✓ · single deploy (D4) ✓.

**Known intentional scope cuts (per spec / stability):** learn `title`/`description`/FAQ text unchanged (avoid pinned-test churn + SEO churn); no shared-component extraction (copy-and-edit chosen for lower blast radius on the working `/vs/surfline`); sessions/alerts/emails rendered as capability copy with no counts.

**Type consistency:** new `FeatureRow` roadmap entry matches the existing `{ feature, description, quiver, quiverNote?, surfline, surflineNote? }` shape; `PROOF_ITEMS` entry matches `{ icon, title, description, href? }`; `getBeachesWithCameras()` returns `CamBeachWithRegion[]` with `{id,name,slug,city,state}` consumed by `buildBeachUrl` and the tiles.
