# Personalization Activation Design

**Date:** 2026-01-18
**Status:** Draft
**Goal:** Surface existing personalization infrastructure to users, creating a visible feedback loop that rewards session logging.

---

## Executive Summary

Quiver has sophisticated personalization infrastructure that users can't see:
- Preference learning from session history
- Personalized scoring algorithms
- Favorite beaches with ranking
- Forecast feedback collection

This design activates that infrastructure by wiring it to the UI at key moments in the user journey.

**This is integration work, not new feature development.**

---

## Problem Statement

### What Exists But Isn't Working

| Component | Location | Problem |
|-----------|----------|---------|
| `user_surf_preferences` | DB table | Computed nightly, but scores aren't shown in discovery |
| `favorite_beaches` | DB table + Profile tab | Buried in profile, not prominent on home |
| `preference-learning-service` | Cron job | Runs, but nobody sees the output |
| `personalized-scoring-service` | API endpoint | Exists at `/api/beach/personalized-score` but discovery doesn't call it |
| `LearnedPreferencesDisplay` | Component | Hidden in Profile → Surf Profile tab |
| `PersonalizedBadge` | Component | `BeachCard` supports it, but callers don't pass the data |

### The Gap

Users experience Quiver as a generic forecast app because personalization never surfaces. Only 1 of 4 scoring criteria considers user data.

### The Opportunity

Connect the existing backend to the UI. The algorithms, API endpoints, and components already exist.

---

## The Personalization Loop

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   LOG SESSION ──► LEARN PREFERENCES ──► PERSONALIZED SCORES    │
│        ▲                                        │               │
│        │                                        ▼               │
│        └─────────── BETTER RECOMMENDATIONS ◄────┘               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Success metric:** Users with 5+ sessions see "Personalized for you" badges on beach recommendations, and engagement (sessions logged) increases as the feedback loop becomes visible.

---

## Integration Points

### Integration Point #1: Discovery Cards Show Personalized Scores

**Goal:** When authenticated users browse surf recommendations, show personalized match scores with "For You" badges.

#### Current Flow
```
Discovery Page → useSurfDiscovery() → BeachDiscoveryCard
                                           │
                                           └── Shows generic score only
```

#### Proposed Flow
```
Discovery Page → useSurfDiscovery() → useBeachPersonalization() → BeachDiscoveryCard
                                           │                            │
                                           │                            └── Shows personalized badge
                                           └── Fetches /api/beach/personalized-score
```

#### Implementation

**1. Create hook:**

```typescript
// hooks/use-beach-personalization.ts
export function useBeachPersonalization(beachId: string | null, baseScore: number) {
  const { user } = useAuth();
  const [data, setData] = useState<PersonalizedScore | null>(null);

  useEffect(() => {
    if (!user || !beachId) return;
    fetch(`/api/beach/personalized-score?beachId=${beachId}&baseScore=${baseScore}`)
      .then(res => res.json())
      .then(response => setData(response.data))
      .catch(() => setData(null));
  }, [user, beachId, baseScore]);

  return data;
}
```

**2. Update BeachDiscoveryCard:**

```typescript
// components/discover/beach-discovery-card.tsx
export function BeachDiscoveryCard({ recommendation, rank, ... }) {
  const personalization = useBeachPersonalization(
    recommendation.beach.id,
    recommendation.score
  );

  return (
    <Card>
      {personalization?.personalized && (
        <PersonalizedBadge
          score={personalization.score}
          breakdown={personalization.breakdown}
        />
      )}
      {/* ... rest of card */}
    </Card>
  );
}
```

#### UX Details

- Badge shows: "92 • For You" with sparkle icon
- Tooltip on tap: "Based on 12 sessions: you prefer 3-5ft, mid-tide, light winds"
- If no personalization data: show nothing (graceful degradation)
- Loading: subtle shimmer on score area, no blocking

#### Files to Modify

- `hooks/use-beach-personalization.ts` (new)
- `components/discover/beach-discovery-card.tsx`
- `components/personalized-badge.tsx` (may need tooltip enhancement)

---

### Integration Point #2: Merge Favorites into Top Spots Carousel

**Goal:** Show user's favorite beaches first in the existing "Your Top Spots" carousel, marked with ❤️, then fill with algorithmic picks.

#### Current Flow
```
TopSpotsCarousel
└── spots: SurfDiscoveryRecommendation[] (pure algorithm)
```

#### Proposed Flow
```
TopSpotsCarousel
└── spots: SurfDiscoveryRecommendation[]
    ├── [0-N] Favorites with today's conditions (isFavorite: true)
    └── [N+1...] Algorithmic picks (deduplicated)
```

#### Visual Design
```
Your Top Spots
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│ ❤️ 85   │ │ ❤️ 78   │ │    82   │ │    79   │
│Trestles │ │Salt Crk │ │ Lowers  │ │ Uppers  │
│ 3-5ft   │ │ 2-4ft   │ │ 4-6ft   │ │ 3-4ft   │
└─────────┘ └─────────┘ └─────────┘ └─────────┘
  favorite    favorite    algo pick   algo pick
```

#### Implementation

**1. Extend the recommendation type:**

```typescript
// types/personalization.ts
export interface SurfDiscoveryRecommendation {
  // ... existing fields
  isFavorite?: boolean;  // ← Add this
}
```

**2. Update discovery orchestrator to merge favorites:**

```typescript
// lib/services/discovery/surf-discovery-orchestrator.ts

export async function getDiscoveryRecommendations(
  userId: string | null,
  options: DiscoveryOptions
): Promise<SurfDiscoveryRecommendation[]> {

  // Get algorithmic recommendations (existing logic)
  const algoRecs = await getAlgorithmicRecommendations(options);

  if (!userId) return algoRecs;

  // Fetch user's favorites
  const favorites = await getFavoriteBeaches(userId);
  if (!favorites.length) return algoRecs;

  // Score favorites for today's conditions
  const favoriteIds = new Set(favorites.map(b => b.id));
  const scoredFavorites: SurfDiscoveryRecommendation[] = [];

  for (const fav of favorites.slice(0, 3)) { // Max 3 favorites shown
    const forecast = await getForecastForBeach(fav.id, options.timeSlot);
    if (!forecast) continue;

    const score = scoreBeachForConditions(fav, forecast, options);
    if (score >= 50) { // Only show if conditions are decent
      scoredFavorites.push({
        beach: fav,
        score,
        window: forecast.window,
        isFavorite: true,
        // ... other fields
      });
    }
  }

  // Sort favorites by score
  scoredFavorites.sort((a, b) => b.score - a.score);

  // Dedupe algo recs (remove any that are already in favorites)
  const dedupedAlgo = algoRecs.filter(r => !favoriteIds.has(r.beach.id));

  // Merge: favorites first, then algo picks
  return [...scoredFavorites, ...dedupedAlgo];
}
```

**3. Update CompactSpotCard to show heart:**

```typescript
// components/home-screen/compact-spot-card.tsx

export function CompactSpotCard({ recommendation, onTap, featured }: Props) {
  const { beach, score, isFavorite } = recommendation;

  return (
    <Card onClick={() => onTap(beach.id)} className="...">
      {/* Favorite indicator */}
      {isFavorite && (
        <div className="absolute top-2 left-2 z-10">
          <Heart className="h-4 w-4 text-red-500 fill-red-500" />
        </div>
      )}

      {/* Score circle */}
      <div className="absolute top-2 right-2 ...">
        {formatDiscoveryScore(score)}
      </div>

      {/* ... rest of card */}
    </Card>
  );
}
```

#### UX Details

- Max 3 favorites shown (don't overwhelm)
- Only show favorites with score ≥ 50 (decent conditions)
- Heart icon: solid red, top-left corner
- If no favorites have good conditions today, show pure algo picks
- Empty favorites: no change to current behavior

#### Files to Modify

- `types/personalization.ts` (add `isFavorite` field)
- `lib/services/discovery/surf-discovery-orchestrator.ts`
- `components/home-screen/compact-spot-card.tsx`

---

### Integration Point #3: Surf Profile in Profile Header

**Goal:** Make learned preferences visible and valuable, not buried in a Profile sub-tab.

#### Current State
```
Profile Page
├── Sessions tab (default)
├── Photos tab
├── Boards tab
├── Beaches tab (favorites here)
└── Surf Profile tab ← Hidden here, users rarely find it
    └── SurfProfileSection
        └── LearnedPreferencesDisplay
```

#### Proposed Changes

**1. Add "Your Surf Style" card to Profile header:**

```typescript
// components/profile-view.tsx (in the header area)

<div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6">
  {/* Existing avatar and name */}
  <UserAvatar ... />

  {/* NEW: Surf Style Summary */}
  {preferences && preferences.confidence > 0.5 && (
    <div className="mt-4 bg-white/10 rounded-lg p-3 backdrop-blur">
      <p className="text-white/80 text-xs uppercase tracking-wide">Your Surf Style</p>
      <p className="text-white text-sm mt-1">
        {preferences.wave_min_ft}-{preferences.wave_max_ft}ft waves •
        {formatTidePrefs(preferences.preferred_tide_statuses)} •
        Light winds
      </p>
      <p className="text-white/60 text-xs mt-1">
        Based on {preferences.sample_size} sessions
      </p>
    </div>
  )}
</div>
```

**2. Show progress for new users:**

```typescript
{!preferences || preferences.confidence < 0.5 ? (
  <div className="mt-4 bg-white/10 rounded-lg p-3 backdrop-blur">
    <p className="text-white/80 text-xs uppercase tracking-wide">Your Surf Style</p>
    <p className="text-white text-sm mt-1">
      Log {5 - (preferences?.sample_size || 0)} more sessions to unlock personalized recommendations
    </p>
    <div className="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
      <div
        className="h-full bg-white rounded-full transition-all"
        style={{ width: `${((preferences?.sample_size || 0) / 5) * 100}%` }}
      />
    </div>
  </div>
) : null}
```

**3. Link to full Surf Profile:**

```typescript
<Link href="/profile?tab=surf-profile" className="text-white/80 text-xs underline">
  View full surf profile →
</Link>
```

#### Implementation

**1. Create hook for preferences:**

```typescript
// hooks/use-user-preferences.ts
export function useUserPreferences() {
  const { user } = useAuth();

  const fetchPrefs = useCallback(async () => {
    if (!user) return null;
    const res = await fetch('/api/user/preferences');
    if (!res.ok) return null;
    return res.json();
  }, [user]);

  return useDataFetcher(fetchPrefs, { skip: !user });
}
```

**2. Add API endpoint:**

```typescript
// app/api/user/preferences/route.ts
export async function GET() {
  const { user } = await getAuthenticatedUser();
  if (!user) return createErrorResponse('Unauthorized', 401);

  const prefs = await getUserSurfPreferences(user.id);
  return createSuccessResponse(prefs);
}
```

#### UX Details

- Only show if confidence > 50% (meaningful data)
- New users see progress bar toward unlock
- Tapping opens full Surf Profile tab
- Keep existing Surf Profile tab for detailed view/overrides

#### Files to Modify

- `hooks/use-user-preferences.ts` (new)
- `app/api/user/preferences/route.ts` (new)
- `components/profile-view.tsx`

---

## What We're NOT Building

- No new scoring algorithms (use existing `personalized-scoring-service`)
- No new preference learning (use existing `preference-learning-service`)
- No new database tables (all exist)
- No new API endpoints beyond preferences fetch
- No changes to session wizard feedback (already exists)

---

## Rollout Plan

### Summary

| # | Integration | Effort | Dependencies |
|---|-------------|--------|--------------|
| 1 | Discovery cards show personalized scores | 2-3h | None |
| 2 | Merge favorites into Top Spots carousel | 3-4h | None |
| 3 | Surf Profile in profile header | 2h | None |

**Total estimated effort:** 7-9 hours

### Implementation Order

```
Phase 1: Foundation (can parallelize)
├── Create useBeachPersonalization hook
├── Create useUserPreferences hook
└── Add /api/user/preferences endpoint

Phase 2: UI Integration
├── Update BeachDiscoveryCard with personalization
├── Update surf-discovery-orchestrator to merge favorites
├── Update CompactSpotCard with heart badge
└── Update ProfileView header with surf style

Phase 3: Polish
├── Add loading states / skeletons
├── Handle edge cases (no data, errors)
└── Analytics events for tracking
```

### Rollout Strategy

1. **Dev/staging:** Full implementation
2. **Soft launch:** Enable for users with 5+ sessions first (they benefit immediately)
3. **Full launch:** All authenticated users
4. **Monitor:** Watch for performance impact on discovery queries

---

## Success Metrics

| Metric | Current | Target | How to Measure |
|--------|---------|--------|----------------|
| Sessions logged per user/month | ? | +20% | Supabase query |
| Users with 5+ sessions | ? | +15% | Drives preference learning |
| "For You" badge impressions | 0 | >50% of discovery views | Analytics event |
| Favorites used | ? | +30% | favorite_beaches inserts |

### Analytics Events to Add

```typescript
// Discovery personalization
track("personalized_score_shown", { beach_id, score, breakdown });
track("personalized_score_clicked", { beach_id, score });

// Favorites in carousel
track("favorite_shown_in_carousel", { beach_id, score });
track("favorite_clicked_in_carousel", { beach_id });

// Surf profile
track("surf_profile_viewed", { confidence, sample_size });
track("surf_profile_progress_shown", { sessions_needed });
```

---

## Files Summary

### New Files
- `hooks/use-beach-personalization.ts`
- `hooks/use-user-preferences.ts`
- `app/api/user/preferences/route.ts`

### Modified Files
- `types/personalization.ts`
- `lib/services/discovery/surf-discovery-orchestrator.ts`
- `components/discover/beach-discovery-card.tsx`
- `components/home-screen/compact-spot-card.tsx`
- `components/personalized-badge.tsx`
- `components/profile-view.tsx`

---

## Open Questions

1. Should personalized scores be cached client-side to reduce API calls?
2. Do we need a feature flag for gradual rollout?
3. Should we show personalization on the map view as well?

---

## References

- `docs/GAPS_AND_IMPLEMENTATION_PLAN.md` — Original gap analysis
- `docs/reference/PERSONALIZATION_STRATEGY.md` — Full personalization vision
- `lib/services/personalized-scoring-service.ts` — Existing scoring implementation
- `lib/services/preference-learning-service.ts` — Existing learning implementation
