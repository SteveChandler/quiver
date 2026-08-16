# About Page Rewrite Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the /about page from generic corporate copy with fake stats to an authentic founder letter with real data, normalized to the dark theme used throughout the rest of the app.

**Architecture:** Replace `ABOUT_CONTENT` in content constants with new founder-letter structure, rewrite the `about-client.tsx` component to render 5 dark-themed sections (hero, problem, solution+stats, what's next, CTA), update metadata, fix tests.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Framer Motion

**Spec:** `docs/archive/superpowers/specs/2026-03-13-about-page-rewrite-design.md`

---

## Task 1: Update content constants and fix imports

**Files:**
- Modify: `lib/constants/content.ts:1-74`

- [ ] **Step 1: Replace ABOUT_CONTENT and clean up Heart import**

Replace lines 1-74 of `lib/constants/content.ts`. The `Heart` icon is only used by the old `ABOUT_CONTENT.mission.values[0]` — remove it from the import. All other icons (`Shield`, `Users`, `Target`, `Waves`, `Globe`, `Lock`, `Eye`, `UserCheck`, `Database`, `Trash2`, `Mail`, `Settings`) are still used by `PRIVACY_CONTENT` and `FEATURES_EXTENDED_CONTENT`.

New imports (line 1):
```ts
import {
  Shield,
  Users,
  Target,
  Waves,
  Globe,
  Lock,
  Eye,
  UserCheck,
  Database,
  Trash2,
  Mail,
  Settings,
} from "lucide-react";
```

New `ABOUT_CONTENT` (replaces lines 17-74):
```ts
export const ABOUT_CONTENT = {
  hero: {
    title: "I built Quiver because I was tired of being wrong.",
    subtitle:
      "Wrong about the swell. Wrong about the wind. Wrong about whether it was even worth getting out of bed at 5am.",
  },
  problem: [
    "I was checking five different apps before every session. Surfline for the cam, Magic Seaweed for the swell, NOAA for the wind, some tide app, and then a group text to see if anyone was going out. And half the time I'd show up and conditions were nothing like what any of them said.",
    "The worst part? There was no way to say \"hey, this is wrong.\" No way to tell the next person that the south wind was actually hammering Blacks even though the forecast said offshore. You just showed up, got skunked, and drove home.",
  ],
  solution: {
    intro:
      "So I started building something different. Not another forecast aggregator — a platform that pulls real data from real sources and actually lets surfers tell each other what's happening.",
    stats: [
      { value: "279", label: "beaches" },
      { value: "131", label: "cities" },
      { value: "17", label: "states" },
      { value: "42K+", label: "forecasts" },
    ],
    closer:
      "Every forecast is built from NOAA buoy data and ML models trained on real ocean observations — not just recycled from the same source everyone else uses.",
  },
  whatsNext: [
    "Quiver is early. I'm not going to pretend it's finished. But that's kind of the point — I want the people who use it to help shape what it becomes.",
    "If the forecast was off at your spot, tell me. If there's a beach we're missing, tell me. If you want a feature that would make you actually open this thing every morning, I want to hear it.",
  ],
  cta: {
    title: "Come check it out.",
    subtitle:
      "Free. No credit card. No spam. Just better data for your next session.",
    primaryLabel: "Check the forecast",
    primaryHref: "/",
    secondaryLabel: "Drop me a line",
    secondaryHref: "mailto:support@quiversurf.app",
  },
} as const;
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit lib/constants/content.ts 2>&1 | head -20`

If TypeScript errors about `Heart` being used elsewhere, re-check. It should only be referenced in the old `ABOUT_CONTENT.mission.values`.

---

## Task 2: Rewrite the about page component

**Files:**
- Modify: `app/about/about-client.tsx` (full rewrite)
- Modify: `app/about/page.tsx:8-21` (metadata update)

- [ ] **Step 1: Rewrite `about-client.tsx`**

Replace the entire file. The new component renders 5 sections on dark navy background with Framer Motion fade-ins that respect `prefers-reduced-motion`.

```tsx
"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ABOUT_CONTENT } from "@/lib/constants/content";
import { motion, useReducedMotion } from "framer-motion";

function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay }}
    >
      {children}
    </motion.div>
  );
}

export default function AboutPageClient() {
  const { hero, problem, solution, whatsNext, cta } = ABOUT_CONTENT;

  return (
    <div className="min-h-screen bg-[#252D6B]">
      {/* Hero */}
      <section className="pt-20 pb-12 px-4">
        <div className="max-w-3xl mx-auto">
          <FadeIn>
            <h1 className="text-3xl md:text-5xl font-heading font-bold text-white mb-6 leading-tight">
              {hero.title}
            </h1>
          </FadeIn>
          <FadeIn delay={0.2}>
            <p className="text-xl md:text-2xl text-high font-sans leading-relaxed">
              {hero.subtitle}
            </p>
          </FadeIn>
        </div>
      </section>

      {/* The Problem */}
      <section className="py-12 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          {problem.map((paragraph, index) => (
            <FadeIn key={index} delay={index * 0.15}>
              <p className="text-lg text-high font-sans leading-relaxed">
                {paragraph}
              </p>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* What Quiver Actually Does */}
      <section className="py-16 px-4 bg-white/[0.04]">
        <div className="max-w-4xl mx-auto">
          <FadeIn>
            <p className="text-lg text-high font-sans leading-relaxed max-w-3xl mb-12">
              {solution.intro}
            </p>
          </FadeIn>

          {/* Stats Bar */}
          <FadeIn delay={0.2}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
              {solution.stats.map((stat) => (
                <div
                  key={stat.label}
                  className="bg-[#2D357D] border border-white/10 rounded-lg p-6 text-center"
                >
                  <div className="text-3xl font-heading font-bold text-white mb-1">
                    {stat.value}
                  </div>
                  <div className="text-sm text-medium">{stat.label}</div>
                  <div className="text-xs text-medium mt-0.5">and counting</div>
                </div>
              ))}
            </div>
          </FadeIn>

          <FadeIn delay={0.3}>
            <p className="text-lg text-high font-sans leading-relaxed max-w-3xl">
              {solution.closer}
            </p>
          </FadeIn>
        </div>
      </section>

      {/* What's Next */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          {whatsNext.map((paragraph, index) => (
            <FadeIn key={index} delay={index * 0.15}>
              <p className="text-lg text-high font-sans leading-relaxed">
                {paragraph}
              </p>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section
        className="py-20 px-4"
        style={{
          boxShadow: "inset 0 0 120px rgba(247, 142, 66, 0.08)",
        }}
      >
        <div className="max-w-3xl mx-auto text-center">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-white mb-4">
              {cta.title}
            </h2>
          </FadeIn>
          <FadeIn delay={0.15}>
            <p className="text-lg text-high font-sans mb-8">{cta.subtitle}</p>
          </FadeIn>
          <FadeIn delay={0.3}>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                size="lg"
                className="bg-white text-[#252D6B] hover:bg-gray-50 px-8 py-4 text-lg font-heading font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
                asChild
              >
                <Link href={cta.primaryHref}>
                  {cta.primaryLabel}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="border border-white/30 text-white hover:bg-white/10 px-8 py-4 text-lg font-heading font-semibold rounded-full transition-all duration-300"
                asChild
              >
                <a href={cta.secondaryHref}>{cta.secondaryLabel}</a>
              </Button>
            </div>
          </FadeIn>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Update metadata in `page.tsx`**

Replace the metadata export in `app/about/page.tsx` (lines 8-21). Keep `revalidate = 3600`.

```ts
export const metadata: Metadata = buildPageMetadata({
  title: "About Quiver — Why I Built This",
  description:
    "I was tired of checking five apps before every session and showing up to conditions that didn't match. So I built Quiver — real surf data from real sources, for surfers who want to make the call.",
  path: "/about",
  keywords: [
    "about Quiver",
    "surf forecast app",
    "surf data",
    "surf conditions",
    "real surf data",
  ],
});
```

- [ ] **Step 3: Verify build compiles**

Run: `npx next build --no-lint 2>&1 | tail -30`

Look for: no errors related to `app/about/` or `lib/constants/content.ts`. The about page should appear in the output.

---

## Task 3: Update tests (same-commit rule)

**Files:**
- Modify: `__tests__/lib/constants/content.test.ts:12-31`

- [ ] **Step 1: Replace the ABOUT_CONTENT test**

Replace the test block at lines 12-31 with assertions matching the new structure:

```ts
  test("ABOUT_CONTENT has required structure and non-empty strings", () => {
    // Hero
    expect(typeof ABOUT_CONTENT.hero.title).toBe("string");
    expect(ABOUT_CONTENT.hero.title.length).toBeGreaterThan(0);
    expect(typeof ABOUT_CONTENT.hero.subtitle).toBe("string");
    expect(ABOUT_CONTENT.hero.subtitle.length).toBeGreaterThan(0);

    // Problem
    expect(Array.isArray(ABOUT_CONTENT.problem)).toBe(true);
    expect(ABOUT_CONTENT.problem).toHaveLength(2);
    for (const p of ABOUT_CONTENT.problem) {
      expect(typeof p).toBe("string");
      expect(p.length).toBeGreaterThan(0);
    }

    // Solution
    expect(typeof ABOUT_CONTENT.solution.intro).toBe("string");
    expect(ABOUT_CONTENT.solution.intro.length).toBeGreaterThan(0);
    expect(typeof ABOUT_CONTENT.solution.closer).toBe("string");
    expect(ABOUT_CONTENT.solution.closer.length).toBeGreaterThan(0);
    expect(Array.isArray(ABOUT_CONTENT.solution.stats)).toBe(true);
    expect(ABOUT_CONTENT.solution.stats).toHaveLength(4);
    for (const stat of ABOUT_CONTENT.solution.stats) {
      expect(typeof stat.value).toBe("string");
      expect(stat.value.length).toBeGreaterThan(0);
      expect(typeof stat.label).toBe("string");
      expect(stat.label.length).toBeGreaterThan(0);
    }

    // What's Next
    expect(Array.isArray(ABOUT_CONTENT.whatsNext)).toBe(true);
    expect(ABOUT_CONTENT.whatsNext).toHaveLength(2);
    for (const p of ABOUT_CONTENT.whatsNext) {
      expect(typeof p).toBe("string");
      expect(p.length).toBeGreaterThan(0);
    }

    // CTA
    expect(typeof ABOUT_CONTENT.cta.title).toBe("string");
    expect(ABOUT_CONTENT.cta.title.length).toBeGreaterThan(0);
    expect(typeof ABOUT_CONTENT.cta.subtitle).toBe("string");
    expect(typeof ABOUT_CONTENT.cta.primaryLabel).toBe("string");
    expect(typeof ABOUT_CONTENT.cta.primaryHref).toBe("string");
    expect(typeof ABOUT_CONTENT.cta.secondaryLabel).toBe("string");
    expect(typeof ABOUT_CONTENT.cta.secondaryHref).toBe("string");
    expect(ABOUT_CONTENT.cta.secondaryHref).toMatch(/^mailto:/);
  });
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx jest __tests__/lib/constants/content.test.ts --verbose`

Expected: All 3 tests pass (ABOUT_CONTENT, PRIVACY_CONTENT, FEATURES_EXTENDED_CONTENT).

---

## Task 4: Update ARCHITECTURE.md documentation

**Files:**
- Modify: `lib/constants/ARCHITECTURE.md:174-192`

- [ ] **Step 1: Update ABOUT_CONTENT shape in ARCHITECTURE.md**

Replace the code block at lines 174-192 with the new structure:

```typescript
export const ABOUT_CONTENT = {
  hero: {
    title: "I built Quiver because...",
    subtitle: "Wrong about the swell...",
  },
  problem: [
    "I was checking five different apps...",
    "The worst part?...",
  ],
  solution: {
    intro: "So I started building...",
    stats: [
      { value: "279", label: "beaches" },
      // ... more stats
    ],
    closer: "Every forecast is built from NOAA buoy data...",
  },
  whatsNext: [
    "Quiver is early...",
    "If the forecast was off...",
  ],
  cta: {
    title: "Come check it out.",
    subtitle: "Free. No credit card...",
    primaryLabel: "Check the forecast",
    primaryHref: "/",
    secondaryLabel: "Drop me a line",
    secondaryHref: "mailto:support@quiversurf.app",
  },
} as const;
```

---

## Task 5: Visual verification and commit

- [ ] **Step 1: Run full test suite for affected files**

Run: `npx jest __tests__/lib/constants/content.test.ts --verbose`

Expected: All 3 tests pass.

- [ ] **Step 2: Visual check with Playwright MCP**

Navigate to `http://localhost:3000/about` and take screenshots at:
- Desktop viewport (1280px)
- Mobile viewport (375px)

Verify:
- All sections render on dark navy background
- No light mode styles visible
- Stats bar shows 4 cards with real numbers
- CTA buttons render correctly
- No console errors

- [ ] **Step 3: Commit all changes together**

```bash
git add lib/constants/content.ts app/about/about-client.tsx app/about/page.tsx __tests__/lib/constants/content.test.ts lib/constants/ARCHITECTURE.md
git commit -m "refactor(about): rewrite as founder letter with real stats and dark theme

Replace generic corporate copy and fake stats with authentic founder
voice, real data (279 beaches, 131 cities, 42K+ forecasts), and dark
theme consistent with the rest of the app.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```
