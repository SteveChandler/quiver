# ISR Build Optimization — Remove generateStaticParams

**Date:** 2026-03-17
**Status:** Approved
**Goal:** Eliminate ~120s of static generation from the Vercel build by converting 4 page types (93 pages) from build-time static generation to on-demand ISR.

## Context

The Vercel build takes ~290s. Static generation accounts for ~120s, pre-rendering 93 pages that make sequential Supabase queries at build time. Most of these pages already use `revalidate` (ISR), so the only difference is whether the first render happens at build time or on first visit.

## Changes

### 1. `app/beaches/usa/[state]/page.tsx` — 51 pages

- Remove `generateStaticParams` function
- Keep `export const revalidate = 86400`
- Pages render on first visit, cached for 24h

### 2. `app/spots/[slug]/page.tsx` — 21 pages

- Remove `generateStaticParams` function
- Keep `export const revalidate = 3600`
- Pages render on first visit, cached for 1h

### 3. `app/guides/[slug]/page.tsx` — 13 pages

- Remove `generateStaticParams` function
- Keep `export const revalidate = 3600`
- Pages render on first visit, cached for 1h

### 4. `app/cams/[region]/page.tsx` — 8 pages

- Remove `generateStaticParams` function
- Keep `export const revalidate = 3600`
- Pages render on first visit, cached for 1h

## What stays the same

- All `revalidate` values
- All page rendering logic
- All `generateMetadata` functions
- SEO (pages still SSR with full meta tags, sitemap still lists all URLs)
- No changes to API routes, components, or data fetching

## Risk

- First visitor after deploy gets 1-2s cold render instead of instant static
- Mitigated by: Googlebot crawls, uptime monitors, organic traffic warming cache
- Optional future enhancement: post-deploy warm-up script hitting high-traffic URLs

## Expected Impact

- Build time: ~290s → ~170s (save ~120s)
- Combined with earlier lockfile/Sentry fixes: baseline was ~285s, target is ~170s
