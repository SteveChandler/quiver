# Top Spots Photo Backgrounds Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add photo backgrounds to the "Your Top Spots" carousel cards, reusing existing photo infrastructure.

**Architecture:** Enrich surf discovery recommendations with photo URLs at the service layer, then update the CompactSpotCard component to display photos as backgrounds with gradient overlay and white text.

**Tech Stack:** Next.js, React, Supabase, Tailwind CSS, next/image

---

## Task 1: Add photo_url to SurfDiscoveryRecommendation Type

**Files:**
- Modify: `types/personalization.ts:143-168`

**Step 1: Update the SurfDiscoveryRecommendation interface**

Add optional `photo_url` to the beach object within the recommendation.

```typescript
// In types/personalization.ts, update the SurfDiscoveryRecommendation interface
export interface SurfDiscoveryRecommendation {
  /** Beach with location coordinates and optional photo */
  beach: Beach & { photo_url?: string | null };
  /** Optimal time window for surfing */
  window: PersonalizedForecastWindow;
  // ... rest stays the same
}
```

**Step 2: Verify TypeScript compilation**

Run: `yarn typecheck`
Expected: PASS (no errors)

**Step 3: Commit**

```bash
git add types/personalization.ts
git commit -m "feat(types): add photo_url to SurfDiscoveryRecommendation beach"
```

---

## Task 2: Create Photo Enrichment Function

**Files:**
- Modify: `lib/services/surf-discovery-service.ts`

**Step 1: Add imports at the top of the file**

After the existing imports (around line 37), add:

```typescript
import { withApprovedPhotos } from '@/lib/supabase/query-builders';
import { FALLBACK_IMAGE_BY_NAME } from '@/lib/constants/featured-beaches-config';
```

**Step 2: Create the enrichWithPhotos helper function**

Add this function before the `discoverSurfSpots` function (around line 55):

```typescript
/**
 * Enrich recommendations with beach photo URLs
 *
 * Photo resolution order:
 * 1. Approved photo from beach_photos table
 * 2. Named fallback from FALLBACK_IMAGE_BY_NAME
 * 3. null (component will render gradient)
 */
async function enrichWithPhotos(
  recommendations: SurfDiscoveryRecommendation[]
): Promise<SurfDiscoveryRecommendation[]> {
  if (recommendations.length === 0) return recommendations;

  const supabase = createSupabaseServiceRoleClient();
  const beachIds = recommendations.map((r) => r.beach.id);

  // Fetch approved photos for all beaches in one query
  const baseQuery = supabase
    .from('beach_photos')
    .select('beach_id, image_url')
    .in('beach_id', beachIds)
    .order('created_at', { ascending: false });

  const { data: photos } = await withApprovedPhotos(baseQuery);

  // Build beach_id -> photo_url map (first photo per beach)
  const photoMap = new Map<string, string>();
  if (photos) {
    for (const photo of photos) {
      if (!photoMap.has(photo.beach_id)) {
        photoMap.set(photo.beach_id, photo.image_url);
      }
    }
  }

  // Enrich each recommendation
  return recommendations.map((rec) => {
    // Try database photo first
    let photoUrl = photoMap.get(rec.beach.id) || null;

    // Fall back to named fallback
    if (!photoUrl) {
      photoUrl = FALLBACK_IMAGE_BY_NAME[rec.beach.name as keyof typeof FALLBACK_IMAGE_BY_NAME] || null;
    }

    return {
      ...rec,
      beach: {
        ...rec.beach,
        photo_url: photoUrl,
      },
    };
  });
}
```

**Step 3: Call enrichWithPhotos in discoverSurfSpots**

Find the return statement in `discoverSurfSpots` (around line 209) and modify it:

```typescript
// Before (around line 202-224):
const ranked = scored.sort((a, b) => b.score - a.score).slice(0, maxResults);

// After:
const ranked = scored.sort((a, b) => b.score - a.score).slice(0, maxResults);

// Enrich with photos
const enrichedRanked = await enrichWithPhotos(ranked);

const duration = Date.now() - startTime;
console.log(
  `✅ Discovery complete in ${duration}ms: ${enrichedRanked.length} recommendations from ${finalCandidates.length} candidates`
);

return {
  recommendations: enrichedRanked,  // Changed from 'ranked'
  // ... rest stays the same
};
```

**Step 4: Verify TypeScript compilation**

Run: `yarn typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/services/surf-discovery-service.ts
git commit -m "feat(discovery): enrich recommendations with beach photos"
```

---

## Task 3: Update CompactSpotCard Component

**Files:**
- Modify: `components/home-screen/compact-spot-card.tsx`

**Step 1: Add imports**

Replace the current imports (lines 1-8) with:

```typescript
"use client";

import React from "react";
import Image from "next/image";
import { Waves, Ruler, Wind } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDiscoveryScore } from "@/lib/utils/rating-formatters";
import { getProxiedImageUrl } from "@/lib/utils/image-utils";
import type { SurfDiscoveryRecommendation } from "@/types/personalization";
```

**Step 2: Remove old background helper functions**

Delete these functions (around lines 24-34):

```typescript
// DELETE these functions:
function getBackgroundClass(): string {
  return "bg-white border-gray-100 shadow-sm";
}

function getScoreColor(): string {
  return "bg-accent-orange text-white";
}
```

**Step 3: Replace the entire CompactSpotCard component**

Replace the component (lines 58-145) with:

```typescript
export const CompactSpotCard = React.memo(function CompactSpotCard({
  recommendation,
  onTap,
  featured = false,
}: CompactSpotCardProps) {
  const { beach, score, window, distanceMiles } = recommendation;
  const formattedScore = formatDiscoveryScore(score);
  const photoUrl = beach.photo_url;

  return (
    <Card
      className={cn(
        "w-[140px] xs:w-[160px] sm:w-[180px] h-[160px] xs:h-[180px] sm:h-[200px]",
        "shrink-0 snap-start cursor-pointer",
        "transition-all duration-200 hover:shadow-md motion-safe:hover:scale-[1.02]",
        "motion-safe:active:scale-[0.98]",
        "touch-manipulation",
        "relative overflow-hidden",
        featured && "ring-2 ring-accent-orange ring-offset-2"
      )}
      onClick={() => onTap(beach.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onTap(beach.id);
        }
      }}
      aria-label={`${beach.name}, score ${formattedScore} out of 10`}
      data-testid="compact-spot-card"
    >
      {/* Background: Photo or Gradient */}
      {photoUrl ? (
        <Image
          src={getProxiedImageUrl(photoUrl)}
          alt=""
          fill
          className="object-cover"
          sizes="(max-width: 640px) 160px, 180px"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-blue-600" />
      )}

      {/* Dark gradient overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

      {/* Content */}
      <div className="relative z-10 h-full p-2.5 xs:p-3 sm:p-4 flex flex-col">
        {/* Top row: Wave icon and score */}
        <div className="flex items-start justify-between">
          {/* Wave icon */}
          <div className="p-1 xs:p-1.5 rounded-md bg-white/20 backdrop-blur-sm">
            <Waves className="h-3.5 w-3.5 xs:h-4 xs:w-4 text-white" />
          </div>

          {/* Score circle */}
          <div
            className={cn(
              "w-9 h-9 xs:w-10 xs:h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center",
              "font-bold text-xs xs:text-sm shadow-sm",
              "bg-accent-orange text-white"
            )}
          >
            {formattedScore}
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1 min-h-2" />

        {/* Bottom content */}
        <div className="space-y-1 xs:space-y-1.5">
          {/* Beach name */}
          <h3
            className="font-semibold text-xs xs:text-sm text-white leading-tight line-clamp-2"
            title={beach.name}
          >
            {beach.name}
          </h3>

          {/* Conditions with icons */}
          <div className="flex items-center gap-1 xs:gap-1.5 text-[10px] xs:text-xs text-white/80">
            <Ruler className="h-3 w-3 text-white/70 shrink-0" />
            <span className="font-medium truncate">{window.waveHeight}</span>
            <Wind className="h-3 w-3 text-white/70 shrink-0 ml-1" />
            <span className="truncate">{window.wind}</span>
          </div>

          {/* Distance */}
          {distanceMiles !== undefined && distanceMiles > 0 && (
            <p className="text-[10px] xs:text-xs text-white/60">
              {distanceMiles < 10
                ? distanceMiles.toFixed(1)
                : Math.round(distanceMiles)}{" "}
              mi away
            </p>
          )}
        </div>
      </div>
    </Card>
  );
});
```

**Step 4: Update the skeleton component**

Replace CompactSpotCardSkeleton (around line 148-175) with:

```typescript
export function CompactSpotCardSkeleton() {
  return (
    <div
      className="w-[140px] xs:w-[160px] sm:w-[180px] h-[160px] xs:h-[180px] sm:h-[200px] shrink-0 snap-start rounded-lg overflow-hidden animate-pulse relative"
      data-testid="compact-spot-card-skeleton"
    >
      {/* Gradient background placeholder */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300" />

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

      <div className="relative z-10 h-full p-2.5 xs:p-3 sm:p-4 flex flex-col">
        {/* Top row skeleton */}
        <div className="flex items-start justify-between">
          <div className="w-7 h-7 xs:w-8 xs:h-8 rounded-md bg-white/30" />
          <div className="w-9 h-9 xs:w-10 xs:h-10 sm:w-11 sm:h-11 rounded-full bg-orange-200" />
        </div>

        <div className="flex-1 min-h-2" />

        {/* Bottom content skeleton */}
        <div className="space-y-1.5 xs:space-y-2">
          <div className="h-3 xs:h-4 bg-white/40 rounded w-4/5" />
          <div className="h-2.5 xs:h-3 bg-white/30 rounded w-3/5" />
          <div className="h-2.5 xs:h-3 bg-white/20 rounded w-2/5" />
        </div>
      </div>
    </div>
  );
}
```

**Step 5: Verify TypeScript compilation**

Run: `yarn typecheck`
Expected: PASS

**Step 6: Commit**

```bash
git add components/home-screen/compact-spot-card.tsx
git commit -m "feat(ui): add photo backgrounds to CompactSpotCard"
```

---

## Task 4: Manual Testing

**Step 1: Start the development server**

Run: `yarn dev`

**Step 2: Test with logged-in user**

1. Log in to the app
2. Navigate to home screen
3. Verify "Your Top Spots" carousel shows:
   - Photo backgrounds for beaches with photos
   - Blue gradient for beaches without photos
   - White text readable on all cards
   - Score badge visible in top-right
   - Wave icon visible in top-left

**Step 3: Test edge cases**

1. Check skeleton loading state appears correctly
2. Check featured card has orange ring
3. Check cards are clickable and navigate correctly

**Step 4: Commit final state**

```bash
git add -A
git commit -m "feat: complete Top Spots photo backgrounds implementation"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add photo_url to type | `types/personalization.ts` |
| 2 | Create photo enrichment | `lib/services/surf-discovery-service.ts` |
| 3 | Update card component | `components/home-screen/compact-spot-card.tsx` |
| 4 | Manual testing | N/A |

**Total estimated commits:** 4
