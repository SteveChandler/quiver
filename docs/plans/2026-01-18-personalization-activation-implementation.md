# Personalization Activation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire existing personalization infrastructure to the UI so users see personalized scores, favorites in carousels, and their learned surf style.

**Architecture:** Create two new hooks (`useBeachPersonalization`, `useUserPreferences`) and one API endpoint (`/api/user/preferences`). Modify discovery orchestrator to merge favorites. Update UI components to display personalization data.

**Tech Stack:** Next.js 14, React hooks, TypeScript, Supabase, existing `personalized-scoring-service` and `preference-learning-service`.

---

## Phase 1: Foundation

### Task 1: Create useUserPreferences Hook

**Files:**
- Create: `hooks/use-user-preferences.ts`
- Test: `__tests__/hooks/use-user-preferences.test.ts`

**Step 1: Write the failing test**

```typescript
// __tests__/hooks/use-user-preferences.test.ts
import { renderHook, waitFor } from "@testing-library/react";
import { useUserPreferences } from "@/hooks/use-user-preferences";

// Mock auth context
jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

import { useAuth } from "@/context/auth-context";

describe("useUserPreferences", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null when user is not authenticated", () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });

    const { result } = renderHook(() => useUserPreferences());

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("fetches preferences when user is authenticated", async () => {
    const mockPrefs = {
      wave_min_ft: 3,
      wave_max_ft: 5,
      confidence: 0.75,
      sample_size: 12,
    };

    (useAuth as jest.Mock).mockReturnValue({ user: { id: "user-123" } });
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockPrefs }),
    });

    const { result } = renderHook(() => useUserPreferences());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockPrefs);
    expect(global.fetch).toHaveBeenCalledWith("/api/user/preferences");
  });

  it("returns null on fetch error", async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "user-123" } });
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const { result } = renderHook(() => useUserPreferences());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/hooks/use-user-preferences.test.ts`
Expected: FAIL with "Cannot find module '@/hooks/use-user-preferences'"

**Step 3: Write minimal implementation**

```typescript
// hooks/use-user-preferences.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/auth-context";
import type { UserSurfPreferences } from "@/lib/services/preference-learning-service";

interface UseUserPreferencesResult {
  data: UserSurfPreferences | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useUserPreferences(): UseUserPreferencesResult {
  const { user } = useAuth();
  const [data, setData] = useState<UserSurfPreferences | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPreferences = useCallback(async () => {
    if (!user) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/user/preferences");
      if (!res.ok) {
        setData(null);
        return;
      }
      const json = await res.json();
      setData(json.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch preferences"));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  return { data, loading, error, refetch: fetchPreferences };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/hooks/use-user-preferences.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add hooks/use-user-preferences.ts __tests__/hooks/use-user-preferences.test.ts
git commit -m "feat: add useUserPreferences hook for fetching learned surf preferences"
```

---

### Task 2: Create /api/user/preferences Endpoint

**Files:**
- Create: `app/api/user/preferences/route.ts`
- Test: `__tests__/api/user/preferences.test.ts`

**Step 1: Write the failing test**

```typescript
// __tests__/api/user/preferences.test.ts
import { GET } from "@/app/api/user/preferences/route";
import { createSupabaseServerClient } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(),
}));

describe("GET /api/user/preferences", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    const mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    };
    (createSupabaseServerClient as jest.Mock).mockReturnValue(mockSupabase);

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns user preferences when authenticated", async () => {
    const mockPrefs = {
      wave_min_ft: 3,
      wave_max_ft: 5,
      confidence: 0.8,
      sample_size: 15,
    };

    const mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
          error: null,
        }),
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockPrefs, error: null }),
          }),
        }),
      }),
    };
    (createSupabaseServerClient as jest.Mock).mockReturnValue(mockSupabase);

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toEqual(mockPrefs);
  });

  it("returns null data when no preferences exist", async () => {
    const mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
          error: null,
        }),
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    };
    (createSupabaseServerClient as jest.Mock).mockReturnValue(mockSupabase);

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/api/user/preferences.test.ts`
Expected: FAIL with "Cannot find module '@/app/api/user/preferences/route'"

**Step 3: Write minimal implementation**

```typescript
// app/api/user/preferences/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: preferences, error: prefsError } = await supabase
      .from("user_surf_preferences")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (prefsError && prefsError.code !== "PGRST116") {
      // PGRST116 = no rows returned, which is fine
      console.error("Error fetching preferences:", prefsError);
      return NextResponse.json({ error: "Failed to fetch preferences" }, { status: 500 });
    }

    return NextResponse.json({ data: preferences ?? null });
  } catch (error) {
    console.error("Unexpected error in /api/user/preferences:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/api/user/preferences.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/api/user/preferences/route.ts __tests__/api/user/preferences.test.ts
git commit -m "feat: add /api/user/preferences endpoint"
```

---

### Task 3: Create useBeachPersonalization Hook

**Files:**
- Create: `hooks/use-beach-personalization.ts`
- Test: `__tests__/hooks/use-beach-personalization.test.ts`

**Step 1: Write the failing test**

```typescript
// __tests__/hooks/use-beach-personalization.test.ts
import { renderHook, waitFor } from "@testing-library/react";
import { useBeachPersonalization } from "@/hooks/use-beach-personalization";

jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(),
}));

global.fetch = jest.fn();

import { useAuth } from "@/context/auth-context";

describe("useBeachPersonalization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null when beachId is null", () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "user-123" } });

    const { result } = renderHook(() => useBeachPersonalization(null, 75));

    expect(result.current).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns null when user is not authenticated", () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });

    const { result } = renderHook(() => useBeachPersonalization("beach-123", 75));

    expect(result.current).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("fetches personalized score when user and beachId are provided", async () => {
    const mockScore = {
      score: 85,
      personalized: true,
      breakdown: { base: 75, onboardingPrefs: 5, learnedPrefs: 5, affinity: 0 },
    };

    (useAuth as jest.Mock).mockReturnValue({ user: { id: "user-123" } });
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockScore }),
    });

    const { result } = renderHook(() => useBeachPersonalization("beach-123", 75));

    await waitFor(() => {
      expect(result.current).not.toBeNull();
    });

    expect(result.current).toEqual(mockScore);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/beach/personalized-score?beachId=beach-123&baseScore=75"
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/hooks/use-beach-personalization.test.ts`
Expected: FAIL with "Cannot find module '@/hooks/use-beach-personalization'"

**Step 3: Write minimal implementation**

```typescript
// hooks/use-beach-personalization.ts
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import type { PersonalizedScore } from "@/lib/services/personalized-scoring-service";

export function useBeachPersonalization(
  beachId: string | null,
  baseScore: number
): PersonalizedScore | null {
  const { user } = useAuth();
  const [data, setData] = useState<PersonalizedScore | null>(null);

  useEffect(() => {
    if (!user || !beachId) {
      setData(null);
      return;
    }

    let cancelled = false;

    fetch(`/api/beach/personalized-score?beachId=${beachId}&baseScore=${baseScore}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((json) => {
        if (!cancelled) {
          setData(json.data ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user, beachId, baseScore]);

  return data;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/hooks/use-beach-personalization.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add hooks/use-beach-personalization.ts __tests__/hooks/use-beach-personalization.test.ts
git commit -m "feat: add useBeachPersonalization hook"
```

---

## Phase 2: UI Integration

### Task 4: Add isFavorite Field to SurfDiscoveryRecommendation

**Files:**
- Modify: `types/personalization.ts`

**Step 1: Add the field**

Find the `SurfDiscoveryRecommendation` interface in `types/personalization.ts` and add:

```typescript
export interface SurfDiscoveryRecommendation {
  // ... existing fields

  /** True if this beach is in user's favorites */
  isFavorite?: boolean;
}
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add types/personalization.ts
git commit -m "feat: add isFavorite field to SurfDiscoveryRecommendation"
```

---

### Task 5: Update CompactSpotCard to Show Heart Badge

**Files:**
- Modify: `components/home-screen/compact-spot-card.tsx`
- Test: `__tests__/components/home-screen/compact-spot-card.test.tsx`

**Step 1: Write the failing test**

```typescript
// __tests__/components/home-screen/compact-spot-card.test.tsx
import { render, screen } from "@testing-library/react";
import { CompactSpotCard } from "@/components/home-screen/compact-spot-card";
import type { SurfDiscoveryRecommendation } from "@/types/personalization";

// Mock next/image
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}));

const createMockRecommendation = (
  overrides: Partial<SurfDiscoveryRecommendation> = {}
): SurfDiscoveryRecommendation => ({
  beach: {
    id: "beach-123",
    name: "Test Beach",
    slug: "test-beach",
    city: "Test City",
    state: "CA",
    photo_url: null,
  } as any,
  score: 85,
  matchQuality: "excellent",
  summary: "Great conditions",
  reasons: ["Good swell"],
  warnings: [],
  window: {
    start: "2026-01-18T08:00:00Z",
    end: "2026-01-18T12:00:00Z",
    waveHeight: { min: 3, max: 5 },
    dataSource: "Forecast",
  } as any,
  ...overrides,
});

describe("CompactSpotCard", () => {
  it("shows heart icon when isFavorite is true", () => {
    const rec = createMockRecommendation({ isFavorite: true });

    render(<CompactSpotCard recommendation={rec} onTap={jest.fn()} />);

    const heartIcon = screen.getByTestId("favorite-heart");
    expect(heartIcon).toBeInTheDocument();
  });

  it("does not show heart icon when isFavorite is false", () => {
    const rec = createMockRecommendation({ isFavorite: false });

    render(<CompactSpotCard recommendation={rec} onTap={jest.fn()} />);

    const heartIcon = screen.queryByTestId("favorite-heart");
    expect(heartIcon).not.toBeInTheDocument();
  });

  it("does not show heart icon when isFavorite is undefined", () => {
    const rec = createMockRecommendation();

    render(<CompactSpotCard recommendation={rec} onTap={jest.fn()} />);

    const heartIcon = screen.queryByTestId("favorite-heart");
    expect(heartIcon).not.toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/components/home-screen/compact-spot-card.test.tsx`
Expected: FAIL with "Unable to find an element by: [data-testid="favorite-heart"]"

**Step 3: Modify CompactSpotCard**

In `components/home-screen/compact-spot-card.tsx`, add the Heart import and badge:

```typescript
// Add to imports
import { Heart } from "lucide-react";

// Inside the component, add after the Card opening tag:
{recommendation.isFavorite && (
  <div
    data-testid="favorite-heart"
    className="absolute top-2 left-2 z-10 bg-white/90 rounded-full p-1 shadow-sm"
  >
    <Heart className="h-3 w-3 text-red-500 fill-red-500" />
  </div>
)}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/components/home-screen/compact-spot-card.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add components/home-screen/compact-spot-card.tsx __tests__/components/home-screen/compact-spot-card.test.tsx
git commit -m "feat: show heart badge on favorite spots in carousel"
```

---

### Task 6: Update Discovery Orchestrator to Merge Favorites

**Files:**
- Modify: `lib/services/discovery/surf-discovery-orchestrator.ts`
- Test: `__tests__/lib/services/discovery/surf-discovery-orchestrator.test.ts`

**Step 1: Write the failing test**

Add to existing test file or create new:

```typescript
// In __tests__/lib/services/discovery/surf-discovery-orchestrator.test.ts

describe("favorites merging", () => {
  it("places favorite beaches first with isFavorite flag", async () => {
    // Mock getFavoriteBeaches to return 2 favorites
    jest.spyOn(favoriteActions, "getFavoriteBeaches").mockResolvedValue([
      { id: "fav-1", name: "Favorite Beach 1" } as any,
      { id: "fav-2", name: "Favorite Beach 2" } as any,
    ]);

    // Mock algo recs including one that's also a favorite
    const algoRecs = [
      { beach: { id: "algo-1" }, score: 90 },
      { beach: { id: "fav-1" }, score: 85 }, // duplicate
      { beach: { id: "algo-2" }, score: 80 },
    ] as any;

    const result = await getDiscoveryRecommendations("user-123", {
      homeBeachId: "home-beach",
      timeSlot: "any",
    });

    // First items should be favorites
    expect(result[0].isFavorite).toBe(true);
    expect(result[1].isFavorite).toBe(true);

    // No duplicates
    const ids = result.map((r) => r.beach.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it("excludes favorites with score below 50", async () => {
    jest.spyOn(favoriteActions, "getFavoriteBeaches").mockResolvedValue([
      { id: "fav-low", name: "Low Score Fav" } as any,
    ]);

    // Mock scoring to return low score for this beach
    jest.spyOn(scoringModule, "scoreBeachForConditions").mockReturnValue(40);

    const result = await getDiscoveryRecommendations("user-123", {
      homeBeachId: "home-beach",
      timeSlot: "any",
    });

    const favInResults = result.find((r) => r.beach.id === "fav-low");
    expect(favInResults).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/lib/services/discovery/surf-discovery-orchestrator.test.ts`
Expected: FAIL

**Step 3: Modify the orchestrator**

In `lib/services/discovery/surf-discovery-orchestrator.ts`, add favorites merging logic. Find the main export function and add:

```typescript
import { getFavoriteBeaches } from "@/actions/beach/beach-favorite-actions";

// Inside the main function, after getting algo recommendations:

// Merge user favorites (if authenticated)
if (userId) {
  try {
    const favorites = await getFavoriteBeaches(userId);

    if (favorites && favorites.length > 0) {
      const favoriteIds = new Set(favorites.map((b) => b.id));
      const scoredFavorites: SurfDiscoveryRecommendation[] = [];

      // Score up to 3 favorites
      for (const fav of favorites.slice(0, 3)) {
        // Get forecast and score for this beach
        const forecast = await getBeachForecast(fav.id, options);
        if (!forecast) continue;

        const score = scoreBeachForWindow(fav, forecast, options);

        // Only include if conditions are decent (score >= 50)
        if (score >= 50) {
          scoredFavorites.push({
            beach: fav,
            score,
            matchQuality: getMatchQuality(score),
            summary: generateSummary(fav, forecast),
            reasons: generateReasons(fav, forecast, score),
            warnings: [],
            window: forecast,
            isFavorite: true,
          });
        }
      }

      // Sort favorites by score descending
      scoredFavorites.sort((a, b) => b.score - a.score);

      // Remove duplicates from algo recs
      const dedupedAlgo = recommendations.filter(
        (r) => !favoriteIds.has(r.beach.id)
      );

      // Merge: favorites first, then algo
      recommendations = [...scoredFavorites, ...dedupedAlgo];
    }
  } catch (error) {
    console.error("Failed to merge favorites:", error);
    // Continue with algo recs only
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/lib/services/discovery/surf-discovery-orchestrator.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/services/discovery/surf-discovery-orchestrator.ts __tests__/lib/services/discovery/surf-discovery-orchestrator.test.ts
git commit -m "feat: merge favorite beaches into discovery recommendations"
```

---

### Task 7: Add Surf Style Card to Profile Header

**Files:**
- Modify: `components/profile-view.tsx`
- Test: `__tests__/components/profile-view.test.tsx`

**Step 1: Write the failing test**

```typescript
// Add to __tests__/components/profile-view.test.tsx

describe("Surf Style Card", () => {
  it("shows surf style when preferences have high confidence", async () => {
    // Mock useUserPreferences to return preferences
    jest.spyOn(require("@/hooks/use-user-preferences"), "useUserPreferences")
      .mockReturnValue({
        data: {
          wave_min_ft: 3,
          wave_max_ft: 5,
          confidence: 0.8,
          sample_size: 12,
        },
        loading: false,
      });

    render(<ProfileView />);

    expect(screen.getByText("Your Surf Style")).toBeInTheDocument();
    expect(screen.getByText(/3-5ft waves/)).toBeInTheDocument();
    expect(screen.getByText(/Based on 12 sessions/)).toBeInTheDocument();
  });

  it("shows progress bar when confidence is low", async () => {
    jest.spyOn(require("@/hooks/use-user-preferences"), "useUserPreferences")
      .mockReturnValue({
        data: {
          wave_min_ft: null,
          wave_max_ft: null,
          confidence: 0.3,
          sample_size: 2,
        },
        loading: false,
      });

    render(<ProfileView />);

    expect(screen.getByText(/Log 3 more sessions/)).toBeInTheDocument();
  });

  it("hides surf style section when no preferences", async () => {
    jest.spyOn(require("@/hooks/use-user-preferences"), "useUserPreferences")
      .mockReturnValue({
        data: null,
        loading: false,
      });

    render(<ProfileView />);

    expect(screen.queryByText("Your Surf Style")).not.toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/components/profile-view.test.tsx`
Expected: FAIL

**Step 3: Modify ProfileView**

In `components/profile-view.tsx`:

1. Add import:
```typescript
import { useUserPreferences } from "@/hooks/use-user-preferences";
```

2. Inside the component, add the hook:
```typescript
const { data: preferences } = useUserPreferences();
```

3. Add the surf style card in the header (after UserAvatar):
```typescript
{/* Surf Style Card */}
{preferences && (
  <div className="mt-4 bg-white/10 rounded-lg p-3 backdrop-blur">
    <p className="text-white/80 text-xs uppercase tracking-wide font-medium">
      Your Surf Style
    </p>
    {preferences.confidence > 0.5 ? (
      <>
        <p className="text-white text-sm mt-1">
          {preferences.wave_min_ft && preferences.wave_max_ft
            ? `${preferences.wave_min_ft}-${preferences.wave_max_ft}ft waves`
            : "Learning your preferences..."}
          {preferences.preferred_tide_statuses?.length > 0 &&
            ` • ${preferences.preferred_tide_statuses.join(", ")} tide`}
        </p>
        <p className="text-white/60 text-xs mt-1">
          Based on {preferences.sample_size} sessions
        </p>
      </>
    ) : (
      <>
        <p className="text-white text-sm mt-1">
          Log {Math.max(0, 5 - (preferences.sample_size || 0))} more sessions
          to unlock personalized recommendations
        </p>
        <div className="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all"
            style={{
              width: `${Math.min(100, ((preferences.sample_size || 0) / 5) * 100)}%`,
            }}
          />
        </div>
      </>
    )}
  </div>
)}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/components/profile-view.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add components/profile-view.tsx __tests__/components/profile-view.test.tsx
git commit -m "feat: add surf style card to profile header"
```

---

## Phase 3: Polish & Integration

### Task 8: Add Personalized Badge to BeachDiscoveryCard

**Files:**
- Modify: `components/discover/beach-discovery-card.tsx`

**Step 1: Add personalization hook and badge**

```typescript
// Add import
import { useBeachPersonalization } from "@/hooks/use-beach-personalization";
import { PersonalizedBadge } from "@/components/personalized-badge";

// Inside component, add hook
const personalization = useBeachPersonalization(
  recommendation.beach.id,
  recommendation.score
);

// In the render, add badge (near score display):
{personalization?.personalized && (
  <PersonalizedBadge
    score={personalization.score}
    breakdown={personalization.breakdown}
  />
)}
```

**Step 2: Verify it renders**

Run: `npm run dev`
Navigate to discovery page with an authenticated user who has preferences.

**Step 3: Commit**

```bash
git add components/discover/beach-discovery-card.tsx
git commit -m "feat: show personalized badge on discovery cards"
```

---

### Task 9: Add Analytics Events

**Files:**
- Modify: `components/discover/beach-discovery-card.tsx`
- Modify: `components/home-screen/compact-spot-card.tsx`
- Modify: `components/profile-view.tsx`

**Step 1: Add tracking calls**

In each file, add tracking for the relevant events:

```typescript
// Discovery card - when personalized score shown
useEffect(() => {
  if (personalization?.personalized) {
    track("personalized_score_shown", {
      beach_id: recommendation.beach.id,
      score: personalization.score,
      breakdown: personalization.breakdown,
    });
  }
}, [personalization, recommendation.beach.id]);

// Compact spot card - when favorite shown
useEffect(() => {
  if (recommendation.isFavorite) {
    track("favorite_shown_in_carousel", {
      beach_id: recommendation.beach.id,
      score: recommendation.score,
    });
  }
}, [recommendation.isFavorite, recommendation.beach.id, recommendation.score]);

// Profile view - when surf style shown
useEffect(() => {
  if (preferences?.confidence > 0.5) {
    track("surf_profile_viewed", {
      confidence: preferences.confidence,
      sample_size: preferences.sample_size,
    });
  } else if (preferences) {
    track("surf_profile_progress_shown", {
      sessions_needed: Math.max(0, 5 - (preferences.sample_size || 0)),
    });
  }
}, [preferences]);
```

**Step 2: Verify tracking works**

Check browser console or analytics dashboard.

**Step 3: Commit**

```bash
git add components/discover/beach-discovery-card.tsx components/home-screen/compact-spot-card.tsx components/profile-view.tsx
git commit -m "feat: add analytics events for personalization features"
```

---

### Task 10: Final Integration Test

**Step 1: Run full test suite**

```bash
npm test
```

**Step 2: Run E2E tests**

```bash
npx playwright test --grep "discovery|profile"
```

**Step 3: Manual QA checklist**

- [ ] Authenticated user with 5+ sessions sees "For You" badges
- [ ] Favorite beaches appear first in Top Spots carousel with heart
- [ ] Profile header shows surf style or progress bar
- [ ] Unauthenticated users see no personalization (graceful degradation)
- [ ] No console errors
- [ ] Mobile responsive

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: complete personalization activation integration"
```

---

## Summary

| Task | Description | Estimated Time |
|------|-------------|----------------|
| 1 | useUserPreferences hook | 30 min |
| 2 | /api/user/preferences endpoint | 30 min |
| 3 | useBeachPersonalization hook | 30 min |
| 4 | Add isFavorite field | 10 min |
| 5 | Heart badge on CompactSpotCard | 30 min |
| 6 | Merge favorites in orchestrator | 1 hour |
| 7 | Surf style card in profile | 45 min |
| 8 | Personalized badge on discovery | 30 min |
| 9 | Analytics events | 30 min |
| 10 | Integration testing | 45 min |

**Total: ~6 hours**
