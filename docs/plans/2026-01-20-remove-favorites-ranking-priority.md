# Fix 1: Remove Favorites Ranking Priority

## Problem

The home screen "Best Bet" (hero) and "Your Top Spots" (carousel) sections prioritize favorited beaches over score, causing:
- A favorite beach with score 52 appearing as "Best Bet" over a non-favorite with score 95
- User confusion when "Your Top Spots" shows higher scores than the "Best Bet"

## Current Behavior

In `lib/services/discovery/surf-discovery-orchestrator.ts:576-604`:

```typescript
// Separate favorites from scored recommendations
const favoriteRecs: SurfDiscoveryRecommendation[] = [];
const nonFavoriteRecs: SurfDiscoveryRecommendation[] = [];

for (const rec of scored) {
  if (favoriteBeachIds.has(rec.beach.id)) {
    if (rec.score >= 50) {
      favoriteRecs.push({ ...rec, isFavorite: true });
    }
  } else {
    nonFavoriteRecs.push(rec);
  }
}

// Sort each group by score
favoriteRecs.sort((a, b) => b.score - a.score);
nonFavoriteRecs.sort((a, b) => b.score - a.score);

// Merge: favorites FIRST, then non-favorites
const merged = [...favoriteRecs, ...nonFavoriteRecs].slice(0, maxResults);
```

This puts ALL qualifying favorites before ANY non-favorites, regardless of actual scores.

## Desired Behavior

- Rank ALL beaches purely by score (highest first)
- Mark favorites with `isFavorite: true` for badge display only
- The `CompactSpotCard` component already displays a heart badge when `isFavorite` is true

## Implementation

### File: `lib/services/discovery/surf-discovery-orchestrator.ts`

Replace lines 576-608 with:

```typescript
// 4. Mark favorites and sort all recommendations by score
let favoriteBeachIds = new Set<string>();
try {
  const favoriteBeachesResponse = await getFavoriteBeaches(userId);
  if (favoriteBeachesResponse.success && favoriteBeachesResponse.data) {
    favoriteBeachIds = new Set(favoriteBeachesResponse.data.map((b: Beach) => b.id));
    log.debug(`Found ${favoriteBeachIds.size} favorite beaches for user ${userId}`);
  } else {
    log.warn(`Failed to fetch favorites: ${favoriteBeachesResponse.error || 'Unknown error'}`);
  }
} catch (error) {
  log.error('Error fetching favorite beaches, continuing with regular recommendations:', error);
}

// Mark favorites with badge flag, but do NOT prioritize in ranking
const allRecs: SurfDiscoveryRecommendation[] = [];

for (const rec of scored) {
  // Null safety: skip malformed recommendations
  if (!rec?.beach?.id || typeof rec.score !== 'number') {
    log.warn('Skipping malformed recommendation in favorites loop', { rec });
    continue;
  }

  allRecs.push({
    ...rec,
    isFavorite: favoriteBeachIds.has(rec.beach.id),
  });
}

// Sort ALL recommendations by score descending (pure score ranking)
allRecs.sort((a, b) => b.score - a.score);

// Take top results
const merged = allRecs.slice(0, maxResults);

const favoriteCount = merged.filter(r => r.isFavorite).length;
log.debug(
  `Merged recommendations: ${favoriteCount} favorites in top ${merged.length} (pure score ranking)`
);
```

### Key Changes

1. **Remove the score >= 50 filter for favorites** - All beaches are now treated equally
2. **Single array instead of two** - No separation of favorites vs non-favorites
3. **Pure score ranking** - `allRecs.sort((a, b) => b.score - a.score)` without any favorites-first logic
4. **isFavorite badge preserved** - Favorites still get marked for heart badge display

## Testing

1. **Unit test**: Verify that a non-favorite with score 95 ranks above a favorite with score 52
2. **Manual test**:
   - Add a beach as favorite
   - Check that it appears in correct score order, not at the top
   - Verify heart badge still displays

## Files Changed

- `lib/services/discovery/surf-discovery-orchestrator.ts` (lines 576-608)

## Rollback

If issues arise, revert to previous commit. The change is isolated to the ranking logic.
