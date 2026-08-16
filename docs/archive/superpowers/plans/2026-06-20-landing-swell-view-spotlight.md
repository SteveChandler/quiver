# Landing: Swell View spotlight + badged feature grid — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Spec: `docs/archive/superpowers/specs/2026-06-20-landing-swell-view-spotlight-design.md`.

**Goal:** Add a zine-styled "Swell View" launch spotlight to the `/` field-guide landing and rework the feature list into a FREE/PRO badged grid — mirroring the Dispersed landing's *structure*, in Quiver's existing zine aesthetic.

**Architecture:** New `FieldGuideSpotlight` server component inserted between `FieldGuideHero` and `FieldGuideFeatures` in `QuiverFieldGuideLanding`. `FieldGuideFeatures` gains a `tier` field per feature + a FREE/PRO chip, and two new PRO cards. A captured Swell View frame ships as a static `public/` asset. All styling reuses existing zine primitives (`ZineSurface`, `QuiverSticker`, `SaltyEyebrow`, the hero's CTA classes).

**Tech Stack:** Next.js 16 / React 19 / TS, Tailwind, `next/image`, Jest + Testing Library, Node 22. Package manager: Yarn.

---

## File Structure
- **Create:** `components/landing-page/field-guide/field-guide-spotlight.tsx` — the launch spotlight (text + captured Swell View image).
- **Create:** `public/images/landing/swell-view-preview.png` — captured Swell View frame.
- **Create:** `__tests__/components/landing/field-guide-spotlight.test.tsx`
- **Modify:** `components/landing-page/field-guide/field-guide-features.tsx` — add `tier` + FREE/PRO chip + 2 new cards.
- **Modify:** `components/landing-page/field-guide/quiver-field-guide-landing.tsx` — render the spotlight.
- **Modify (if present):** `__tests__/components/landing/field-guide-features.test.tsx` — add tier/badge assertions; else create it.

---

## Task 1: Branch + capture the Swell View asset

**Files:** `public/images/landing/swell-view-preview.png`

- [ ] **Step 1: Branch off main, Node 22**
```bash
cd /Users/stevenchandler/Desktop/dev/quiver
git fetch origin --prune
git checkout -b feat/landing-swell-view-spotlight origin/main
node --version   # must be v22.x
```

- [ ] **Step 2: Capture the Swell View frame**
The Swell View (WebGL swell field) is live on `main` → `dev.quiversurf.app/map`. Capture a clean frame:
```bash
mkdir -p public/images/landing
```
Use Playwright (or `npx playwright`) to open the map and screenshot the canvas — **wait for the field to actually paint** (per `.claude/skills/quiver-map-verify`): expose is `window.__quiverMapInstance`; wait until `map.loaded() && map.isStyleLoaded()` then `map.once('idle')`. Screenshot the `canvas.mapboxgl-canvas` element (NOT `toDataURL`). Save → `public/images/landing/swell-view-preview.png`, then optimize (≤~250 KB; `pngquant`/`sharp`).
Expected: a coastal frame with the swell field visible (angled swell marks + spot height pills), no blank navy canvas.

**If the swell layer will not paint after waiting, STOP and report** — do not ship a placeholder.

- [ ] **Step 3: Commit the asset**
```bash
git add public/images/landing/swell-view-preview.png
git commit -m "feat(landing): add captured Swell View preview asset"
```

---

## Task 2: FieldGuideSpotlight component

**Files:**
- Create: `components/landing-page/field-guide/field-guide-spotlight.tsx`
- Test: `__tests__/components/landing/field-guide-spotlight.test.tsx`

- [ ] **Step 1: Write the failing test**
```tsx
import { render, screen } from "@testing-library/react";

import { FieldGuideSpotlight } from "@/components/landing-page/field-guide/field-guide-spotlight";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt = "" }: { alt?: string }) => <img alt={alt} />,
}));

describe("FieldGuideSpotlight", () => {
  it("renders the Swell View launch copy, free chip, CTA, and image", () => {
    render(<FieldGuideSpotlight platform="ios" />);

    expect(
      screen.getByRole("heading", { name: /swell view is here/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/free · new in the app/i)).toBeInTheDocument();
    expect(screen.getByText(/free, in the app/i)).toBeInTheDocument();
    expect(screen.getByText(/318 breaks · 73 cams/i)).toBeInTheDocument();

    const cta = screen.getByRole("link", { name: /get the app/i });
    expect(cta).toHaveAttribute(
      "href",
      "/download?source=landing_swell_view&placement=spotlight&platform=ios",
    );
    expect(
      screen.getByRole("img", { name: /swell view/i }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it — expect FAIL (module not found)**
```bash
yarn test:unit __tests__/components/landing/field-guide-spotlight.test.tsx
```
Expected: FAIL — cannot find `field-guide-spotlight`.

- [ ] **Step 3: Implement the component**
```tsx
import type { ReactElement } from "react";
import Image from "next/image";
import Link from "next/link";

import { QuiverSticker, ZineSurface } from "@/components/zine";
import type { FirstTouchPlatform } from "@/lib/analytics/web-context";

interface FieldGuideSpotlightProps {
  platform: FirstTouchPlatform;
}

export function FieldGuideSpotlight({
  platform,
}: FieldGuideSpotlightProps): ReactElement {
  const downloadHref = `/download?source=landing_swell_view&placement=spotlight&platform=${platform}`;

  return (
    <ZineSurface
      sectionLabel="Now free"
      data-testid="field-guide-spotlight"
      className="bg-[#0D1020] px-3 py-0 sm:px-6 sm:py-0"
      stageClassName="mx-auto max-w-6xl !py-0"
      paperClassName="relative overflow-hidden !px-5 !py-7 sm:!px-8 sm:!py-8"
      showMasthead={false}
    >
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)] md:items-center">
        <div className="relative z-10">
          <span className="inline-block -rotate-2 rounded-[10px_4px_10px_4px] border-2 border-[#11100D] bg-[#C0DD97] px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[#27500A]">
            Free · new in the app
          </span>
          <p className="mt-3 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-[#0B3A75]">
            318 breaks · 73 cams · wave maps for the other 245
          </p>
          <h2 className="zine-h1 mt-2 max-w-xl leading-[0.96] text-[#11100D] md:!text-[clamp(40px,4.4vw,58px)]">
            Quiver&apos;s Swell View is here.
          </h2>
          <p className="mt-3 max-w-xl font-mono text-sm leading-relaxed text-[#11100D]/80">
            We built it as an internal tool for our forecast team a year ago.
            Over a million images analyzed and classified.
          </p>
          <p className="mt-2 max-w-xl font-mono text-sm font-bold leading-relaxed text-[#11100D]">
            Today we&apos;re releasing it — free, in the app.
          </p>
          <div className="mt-4">
            <Link
              href={downloadHref}
              className="inline-flex min-h-12 items-center justify-center rounded-[14px_6px_16px_6px] bg-[#F78E42] px-6 py-3 font-mono text-sm font-bold uppercase tracking-[0.14em] text-[#11100D] shadow-[2px_4px_0_rgba(0,0,0,0.18)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B3A75]"
            >
              Get the app
            </Link>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md">
          <QuiverSticker
            sticker="creamCoastMap"
            className="pointer-events-none absolute -left-5 -top-6 z-20 w-24 -rotate-6"
            sizes="6rem"
          />
          <div className="halftone-photo relative aspect-[4/3] w-full overflow-hidden border-2 border-[#11100D] bg-[#0D1020] shadow-[3px_5px_0_rgba(0,0,0,0.2)]">
            <Image
              src="/images/landing/swell-view-preview.png"
              alt="Quiver Swell View — live swell field over a stretch of coast"
              fill
              sizes="(max-width: 768px) 100vw, 470px"
              className="object-cover"
            />
            <div className="absolute bottom-1.5 right-1.5 z-10 border border-[#11100D] bg-[#F4EBD8]/85 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[#11100D]">
              Swell View
            </div>
          </div>
        </div>
      </div>
    </ZineSurface>
  );
}
```
Note: `creamCoastMap` is unused elsewhere on the landing (hero uses halftoneCircle/orangeTape/breakingWave). Before finalizing, grep the landing components for `sticker="creamCoastMap"` to confirm it isn't used elsewhere on the page (no-duplicate-sticker-per-surface rule); if it is, swap to another unused key from `lib/ui/quiver-sticker-assets.ts`.

- [ ] **Step 4: Run it — expect PASS**
```bash
yarn test:unit __tests__/components/landing/field-guide-spotlight.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add components/landing-page/field-guide/field-guide-spotlight.tsx __tests__/components/landing/field-guide-spotlight.test.tsx
git commit -m "feat(landing): add Swell View launch spotlight"
```

---

## Task 3: Rework FieldGuideFeatures into a FREE/PRO badged grid

**Files:**
- Modify: `components/landing-page/field-guide/field-guide-features.tsx`
- Test: `__tests__/components/landing/field-guide-features.test.tsx`

- [ ] **Step 1: Write/extend the failing test**
```tsx
import { render, screen, within } from "@testing-library/react";

import { FieldGuideFeatures } from "@/components/landing-page/field-guide/field-guide-features";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt = "" }: { alt?: string }) => <img alt={alt} />,
}));

describe("FieldGuideFeatures badged grid", () => {
  it("shows 3 FREE and 3 PRO feature cards", () => {
    render(<FieldGuideFeatures />);
    expect(screen.getAllByText("Free")).toHaveLength(3);
    expect(screen.getAllByText("Pro")).toHaveLength(3);
  });

  it("badges Smart alerts and Custom spots as Pro", () => {
    render(<FieldGuideFeatures />);
    for (const title of ["Smart alerts", "Custom spots"]) {
      const heading = screen.getByRole("heading", { name: new RegExp(title, "i") });
      const card = heading.closest("div");
      expect(within(card as HTMLElement).getByText("Pro")).toBeInTheDocument();
    }
  });
});
```

- [ ] **Step 2: Run it — expect FAIL**
```bash
yarn test:unit __tests__/components/landing/field-guide-features.test.tsx
```
Expected: FAIL — no "Free"/"Pro" chips yet (and Smart alerts / Custom spots cards don't exist).

- [ ] **Step 3: Implement — add `tier`, two PRO cards, the chip**
In `field-guide-features.tsx`: add the `cn` import, extend `Feature`, replace the `FEATURES` array (FREE first, then PRO), and add the chip inside the card.

Add import (with the others):
```tsx
import { cn } from "@/lib/utils";
```
Replace the interface + array:
```tsx
interface Feature {
  sticker: QuiverStickerProps["sticker"];
  title: string;
  body: string;
  tier: "free" | "pro";
}

const FEATURES: Feature[] = [
  {
    sticker: "forecastWaveMark",
    title: "Honest forecasts",
    body: "Per-break wave heights and confidence without making every morning sound epic.",
    tier: "free",
  },
  {
    sticker: "spotWindRead",
    title: "Wind & tide reads",
    body: "Plain-language calls on the wind, tide window, and hour worth protecting.",
    tier: "free",
  },
  {
    sticker: "blogSessionLog",
    title: "Session log + crew",
    body: "Save what happened, remember the board, and share the call with the people you surf with.",
    tier: "free",
  },
  {
    sticker: "spotSwellMatch",
    title: "Board-aware picks",
    body: "Tell Quiver what's in your quiver. It matches the swell to the board that should actually go.",
    tier: "pro",
  },
  {
    sticker: "navyLightning",
    title: "Smart alerts",
    body: "Get pinged when your spots line up for the boards you own.",
    tier: "pro",
  },
  {
    sticker: "spotLocation",
    title: "Custom spots",
    body: "Drop your own breaks and get the same honest read anywhere.",
    tier: "pro",
  },
];
```
Inside the `.notebook` card (which is already `relative`), add the chip as the FIRST child of the card div:
```tsx
<span
  className={cn(
    "absolute right-4 top-4 rounded-[8px_3px_8px_3px] border-2 border-[#11100D] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em]",
    feature.tier === "free"
      ? "bg-[#C0DD97] text-[#27500A]"
      : "bg-[#F78E42] text-[#5C2E0C]",
  )}
>
  {feature.tier === "free" ? "Free" : "Pro"}
</span>
```
Keep the existing grid (`md:grid-cols-2`), sticker, h3, and body markup unchanged. `navyLightning` (Smart alerts) and `spotLocation` (Custom spots) are unused elsewhere on the landing — grep `sticker="navyLightning"` / `sticker="spotLocation"` across the landing components to confirm before finalizing (no-duplicate-sticker rule); swap to another unused key if either collides.

- [ ] **Step 4: Run it — expect PASS**
```bash
yarn test:unit __tests__/components/landing/field-guide-features.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add components/landing-page/field-guide/field-guide-features.tsx __tests__/components/landing/field-guide-features.test.tsx
git commit -m "feat(landing): badge feature grid FREE/PRO + add Smart alerts & Custom spots"
```

---

## Task 4: Wire the spotlight into the landing

**Files:** Modify `components/landing-page/field-guide/quiver-field-guide-landing.tsx`

- [ ] **Step 1: Add import + render between hero and features**
Add import:
```tsx
import { FieldGuideSpotlight } from "@/components/landing-page/field-guide/field-guide-spotlight";
```
In the returned JSX, insert between `<FieldGuideHero .../>` and `<FieldGuideFeatures />`:
```tsx
      <FieldGuideHero platform={platform} />
      <FieldGuideSpotlight platform={platform} />
      <FieldGuideFeatures />
```

- [ ] **Step 2: Verify the wiring renders**
```bash
yarn test:unit __tests__/components/landing/field-guide-spotlight.test.tsx __tests__/components/landing/field-guide-features.test.tsx
```
Expected: both PASS.

- [ ] **Step 3: Commit**
```bash
git add components/landing-page/field-guide/quiver-field-guide-landing.tsx
git commit -m "feat(landing): render Swell View spotlight in field-guide landing"
```

---

## Task 5: Full verification + PR

- [ ] **Step 1: Typecheck + build + the landing suite (Node 22)**
```bash
yarn typecheck
yarn test:unit __tests__/components/landing __tests__/app/features-page.test.tsx
yarn build
```
Expected: all green. Fix anything the change broke (same-commit rule).

- [ ] **Step 2: Landing smoke (guest), against a local prod build (flag on)**
```bash
APP_FIRST_LANDING_ENABLED= PORT=3000 yarn start &
# wait for http://localhost:3000/api/health == 200
CI=true SKIP_AUTH_SETUP=true BASE_URL=http://127.0.0.1:3000 \
  npx playwright test --grep @smoke --project=guest e2e/guest-landing.spec.ts
```
Expected: PASS. (Local-only Vercel-insights `404` console noise is benign — green on a real deploy.)

- [ ] **Step 3: Open PR to main**
```bash
git push -u origin feat/landing-swell-view-spotlight
gh pr create --base main --title "feat(landing): Swell View launch spotlight + FREE/PRO feature grid" --body "Implements docs/archive/superpowers/specs/2026-06-20-landing-swell-view-spotlight-design.md. Zine-styled Swell View spotlight + badged feature grid; captured Swell View asset. No pricing/map/hero-copy changes."
```
Report the branch, files changed, and verification results. Promotion to prod follows the team's slice-promotion pattern (separate step).

---

## Out of scope
Pricing/plans page, `/map` itself, the surf-map reskin promotion, the clean-SaaS visual direction, the unused `appFirst` prop. Copy accuracy ("year ago", "million images") is the owner's to confirm — see spec gates.
