# Top Spots Photo Backgrounds Design

**Date:** 2026-01-13
**Status:** Approved

## Overview

Add photo backgrounds to the "Your Top Spots" carousel cards on the authenticated home screen, reusing the same photo infrastructure from the landing page.

## Decisions Made

| Decision | Choice |
|----------|--------|
| Card layout | Full bleed photo background with dark gradient overlay |
| Score badge position | Top-right corner (unchanged) |
| Missing photo fallback | Blue gradient (`from-blue-400 to-blue-600`) |
| Wave icon | Keep existing Lucide `<Waves />` icon |
| Text colors | White with varying opacity on dark background |

## Visual Design

**Card with photo:**
```
┌─────────────────────────┐
│ [Photo Background]      │
│ ┌───┐            ┌───┐  │
│ │ 🌊│            │8.1│  │  ← Wave icon (top-left), Score (top-right)
│ └───┘            └───┘  │
│                         │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  ← Dark gradient overlay (bottom 40%)
│ Big Jetty               │  ← Beach name (white, semibold)
│ 📏 2.8 ft  💨 5 mph E   │  ← Conditions (white/gray)
│ 0.4 mi away             │  ← Distance (light gray)
└─────────────────────────┘
```

**Gradient fallback (no photo):**
- Background: `bg-gradient-to-br from-blue-400 to-blue-600`
- Same layout structure
- Wave icon: `bg-white/20 backdrop-blur-sm`

**Styling details:**
- Photo: `object-cover` to fill card
- Bottom gradient: `bg-gradient-to-t from-black/70 via-black/30 to-transparent`
- Featured card: keeps orange ring highlight
- Text: white with opacity variants for hierarchy

## Data Flow

**Photo resolution order:**
1. Query `beach_photos` table for beach ID (approved photos only)
2. Check `FALLBACK_IMAGE_BY_NAME[beach.name]` for hardcoded fallbacks
3. Return `null` → component renders gradient

**Enrichment location:**
```
Current: getRecommendations() → return recommendations
New:     getRecommendations() → enrichWithPhotos() → return recommendations
```

**Type change:**
```typescript
// In SurfDiscoveryRecommendation
beach: Beach & { photo_url?: string | null }
```

## Implementation Scope

**Files to modify:**

| File | Change |
|------|--------|
| `app/api/personalization/surf-discovery/route.ts` | Add photo enrichment step |
| `components/home-screen/compact-spot-card.tsx` | Photo background + styling |
| `types/personalization.ts` | Add optional `photo_url` to beach type |

**Files to reuse (no changes):**
- `lib/utils/image-utils.ts` → `getProxiedImageUrl()`
- `lib/constants/featured-beaches-config.ts` → `FALLBACK_IMAGE_BY_NAME`
- `lib/supabase/query-builders.ts` → `withApprovedPhotos()`

**Component changes:**
1. Add Next.js Image import for optimized loading
2. Outer container: `relative overflow-hidden`
3. Photo/gradient as absolute-positioned background layer
4. Content with `relative z-10`
5. Conditional photo vs gradient rendering
6. Updated text colors for dark background

**Edge cases:**
- Deleted/unapproved photos → filtered by `withApprovedPhotos()`
- External URLs → proxied through `getProxiedImageUrl()`
- Image load failure → gradient shows through (CSS fallback)
- No photo + no fallback → gradient background

## Out of Scope

- Skeleton animation changes
- Landing page modifications
- New database tables or migrations
