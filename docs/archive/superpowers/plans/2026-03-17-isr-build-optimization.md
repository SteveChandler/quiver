# ISR Build Optimization — Remove generateStaticParams

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate ~120s of static generation from the Vercel build by removing `generateStaticParams` from 4 page types (93 pages).

**Architecture:** Remove the `generateStaticParams` export from 4 files. Each file already has `revalidate` set, so pages will render on first visit and cache via ISR. No other code changes needed.

**Tech Stack:** Next.js 16 App Router, ISR (Incremental Static Regeneration)

**Spec:** `docs/archive/superpowers/specs/2026-03-17-isr-build-optimization-design.md`

---

### Task 1: Remove generateStaticParams from US state pages

**Files:**
- Modify: `app/beaches/usa/[state]/page.tsx:41-49`

- [ ] **Step 1: Remove generateStaticParams function**

Delete lines 41-49:
```ts
/**
 * Generate static params for all US states at build time.
 * This pre-renders state pages for faster initial loads.
 */
export async function generateStaticParams() {
  // Use the known list of US state slugs
  const stateSlugs = Object.values(US_STATE_SLUGS);
  return stateSlugs.map((state) => ({ state }));
}
```

- [ ] **Step 2: Remove unused US_STATE_SLUGS import if no other references**

Check if `US_STATE_SLUGS` is used elsewhere in the file. If only used by `generateStaticParams`, remove it from the import on line 12.

- [ ] **Step 3: Verify page still loads locally**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/beaches/usa/ca`
Expected: `200`

---

### Task 2: Remove generateStaticParams from surf spots

**Files:**
- Modify: `app/spots/[slug]/page.tsx:36-38`

- [ ] **Step 1: Remove generateStaticParams function**

Delete lines 36-38:
```ts
export async function generateStaticParams() {
  return SURF_SPOT_SLUGS.map((slug) => ({ slug }));
}
```

- [ ] **Step 2: Check if SURF_SPOT_SLUGS import is still needed**

`SURF_SPOT_SLUGS` may be used elsewhere in the file (e.g., validation). Only remove from imports if unused.

- [ ] **Step 3: Verify page still loads locally**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/spots/blacks-beach`
Expected: `200`

---

### Task 3: Remove generateStaticParams from hub guides

**Files:**
- Modify: `app/guides/[slug]/page.tsx:19-23`

- [ ] **Step 1: Remove generateStaticParams function**

Delete lines 19-23:
```ts
export async function generateStaticParams() {
  return HUB_REGION_SLUGS.map((region) => ({
    slug: `surfing-${region}`,
  }));
}
```

- [ ] **Step 2: Check if HUB_REGION_SLUGS import is still needed**

`HUB_REGION_SLUGS` may be used in validation logic. Only remove from imports if unused.

- [ ] **Step 3: Verify page still loads locally**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/guides/surfing-southern-california`
Expected: `200`

---

### Task 4: Remove generateStaticParams from cam regions

**Files:**
- Modify: `app/cams/[region]/page.tsx:34-36`

- [ ] **Step 1: Remove generateStaticParams function**

Delete lines 34-36:
```ts
export function generateStaticParams() {
  return getAllCamRegionSlugs().map((region) => ({ region }));
}
```

- [ ] **Step 2: Check if getAllCamRegionSlugs import is still needed**

`getAllCamRegionSlugs` is likely only used by `generateStaticParams`. If so, remove from the import on line 9.

- [ ] **Step 3: Verify page still loads locally**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/cams/southern-california`
Expected: `200`

---

### Task 5: Build verification and commit

- [ ] **Step 1: Run the build locally**

Run: `yarn build 2>&1 | tail -30`
Expected: Build succeeds. Static generation section should show significantly fewer pages.

- [ ] **Step 2: Commit all changes**

```bash
git add app/beaches/usa/\[state\]/page.tsx app/spots/\[slug\]/page.tsx app/guides/\[slug\]/page.tsx app/cams/\[region\]/page.tsx
git commit -m "perf: convert 93 static pages to ISR to eliminate build-time generation

Remove generateStaticParams from US state pages (51), surf spots (21),
hub guides (13), and cam regions (8). All pages already use revalidate
for ISR caching — this just moves the first render from build time to
first visit. Expected build time savings: ~120s."
```

- [ ] **Step 3: Push and verify Vercel build time**

```bash
git push origin main
```

Monitor the Vercel deployment. Expected build time: ~170s (down from ~290s).
