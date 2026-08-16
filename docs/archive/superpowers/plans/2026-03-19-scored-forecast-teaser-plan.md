# Scored Forecast Teaser Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 6 generic signup CTAs on web beach detail pages with a single scored forecast teaser that shows real data for free and drives app waitlist signups.

**Architecture:** A `useScoredForecast` hook fetches from the existing `/api/forecasts/scored/[beachId]` endpoint. The parent `beach-detail.tsx` calls the hook and uses `hasScoredData` to conditionally hide old CTAs. A new `ScoredForecastTeaser` component receives the data as a prop and renders golden window banner + score bars + conditions chips + app CTA card.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, existing `useDataFetcher` hook, existing `UnifiedAuthModal`

**Spec:** `docs/archive/superpowers/specs/2026-03-19-scored-forecast-teaser-design.md`

---

## Chunk 1: Event Type Registration + Data Hook

**Working directory:** `/Users/stevenchandler/Desktop/cookin/quiver`

### Task 1: Register 3 new event types

**Files:**
- Modify: `types/implicit-preferences.ts`
- Modify: `app/api/events/route.ts`

- [ ] **Step 1: Add to ImplicitEventType union**

In `types/implicit-preferences.ts`, add to the `ImplicitEventType` union (after `match_score_teaser_view` at ~line 75):

```typescript
  | 'scored_forecast_view'
  | 'scored_forecast_cta_view'
  | 'scored_forecast_cta_click'
```

- [ ] **Step 2: Add to EVENT_WEIGHTS**

In `types/implicit-preferences.ts`, add to the `EVENT_WEIGHTS` record (after `match_score_teaser_view: 0,`):

```typescript
  scored_forecast_view: 0,
  scored_forecast_cta_view: 0,
  scored_forecast_cta_click: 0,
```

- [ ] **Step 3: Add to VALID_EVENTS**

In `app/api/events/route.ts`, add to the `VALID_EVENTS` array (after `'match_score_teaser_view'`):

```typescript
  'scored_forecast_view',
  'scored_forecast_cta_view',
  'scored_forecast_cta_click',
```

- [ ] **Step 4: Add to ANONYMOUS_ALLOWED_EVENTS**

In `app/api/events/route.ts`, add to the `ANONYMOUS_ALLOWED_EVENTS` array (after `'match_score_teaser_click'`):

```typescript
  'scored_forecast_view',
  'scored_forecast_cta_view',
  'scored_forecast_cta_click',
```

- [ ] **Step 5: Add to PRE_AUTH_ONLY_EVENTS**

In `app/api/events/route.ts`, add to the `PRE_AUTH_ONLY_EVENTS` array (after `'auth_modal_closed_without_action'`):

```typescript
  'scored_forecast_view',
  'scored_forecast_cta_view',
  'scored_forecast_cta_click',
```

- [ ] **Step 6: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`

Expected: No errors related to the new event types.

- [ ] **Step 7: Commit**

```bash
git add types/implicit-preferences.ts app/api/events/route.ts
git commit -m "feat: register scored_forecast event types in type system and event arrays"
```

---

### Task 2: Create `useScoredForecast` hook

**Files:**
- Create: `hooks/use-scored-forecast.ts`
- Create: `__tests__/hooks/use-scored-forecast.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/hooks/use-scored-forecast.test.ts`:

```typescript
import { renderHook, waitFor } from "@testing-library/react";
import { useScoredForecast } from "@/hooks/use-scored-forecast";

// Mock the fetch
global.fetch = jest.fn();

const mockResponse = {
  timeSlots: [
    {
      forecastAt: "2026-03-19T06:00:00Z",
      surfHeight: { min: 3, max: 5 },
      swells: [{ height: 4, period: 14, direction: 250, compass: "WSW" }],
      windSpeed: 5,
      windDirection: "E",
      windDirectionDeg: 90,
      isOffshore: true,
      tideHeight: 3.2,
      tideStatus: "Rising",
      waterTemp: "60°F",
      airTemp: "65°F",
      compositeScore: 82,
      rideableWavesPerHour: 18,
      waveFrequencyConfidence: "high",
      swellTrains: 1,
      dominantBeatIntervalS: null,
      forecastDataConfidence: 85,
    },
    {
      forecastAt: "2026-03-19T09:00:00Z",
      surfHeight: { min: 4, max: 6 },
      swells: [{ height: 4.5, period: 14, direction: 250, compass: "WSW" }],
      windSpeed: 8,
      windDirection: "W",
      windDirectionDeg: 270,
      isOffshore: false,
      tideHeight: 4.8,
      tideStatus: "Falling",
      waterTemp: "60°F",
      airTemp: "68°F",
      compositeScore: 65,
      rideableWavesPerHour: 12,
      waveFrequencyConfidence: "medium",
      swellTrains: 1,
      dominantBeatIntervalS: null,
      forecastDataConfidence: 80,
    },
  ],
  goldenWindows: [
    {
      startTime: "2026-03-19T06:00:00Z",
      endTime: "2026-03-19T09:00:00Z",
      peakTime: "2026-03-19T06:00:00Z",
      peakScore: 82,
      durationMinutes: 180,
      peakWavesPerHour: 18,
      waveFrequencyConfidence: "high",
    },
  ],
  beach: { aspectDeg: 270, breakType: "beach" },
};

describe("useScoredForecast", () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockReset();
  });

  it("returns data on successful fetch", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const { result } = renderHook(() => useScoredForecast("beach-123"));
    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(result.current.data?.timeSlots).toHaveLength(2);
    expect(result.current.data?.goldenWindows).toHaveLength(1);
  });

  it("returns null data when beachId is empty", () => {
    const { result } = renderHook(() => useScoredForecast(""));
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("returns error on fetch failure", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network error"));
    const { result } = renderHook(() => useScoredForecast("beach-123"));
    await waitFor(() => expect(result.current.error).not.toBeNull());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/hooks/use-scored-forecast.test.ts --no-coverage`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook**

Create `hooks/use-scored-forecast.ts`:

```typescript
"use client";

import { useCallback } from "react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";

export interface ScoredTimeSlot {
  forecastAt: string;
  surfHeight: { min: number; max: number };
  swells: Array<{
    height: number;
    period: number;
    direction: number;
    compass: string;
  }>;
  windSpeed: number;
  windDirection: string;
  windDirectionDeg: number;
  isOffshore: boolean;
  tideHeight: number;
  tideStatus: string;
  waterTemp: string;
  airTemp: string;
  compositeScore: number;
  rideableWavesPerHour: number;
  waveFrequencyConfidence: "high" | "medium" | "low";
  swellTrains: number;
  dominantBeatIntervalS: number | null;
  forecastDataConfidence: number;
}

export interface GoldenWindowResponse {
  startTime: string;
  endTime: string;
  peakTime: string;
  peakScore: number;
  durationMinutes: number;
  peakWavesPerHour: number;
  waveFrequencyConfidence: "high" | "medium" | "low";
}

export interface ScoredForecastData {
  timeSlots: ScoredTimeSlot[];
  goldenWindows: GoldenWindowResponse[];
  beach: { aspectDeg: number | null; breakType: string | null };
}

export function useScoredForecast(beachId: string) {
  const fetchFn = useCallback(async (): Promise<ScoredForecastData> => {
    const res = await fetch(`/api/forecasts/scored/${beachId}`);
    if (!res.ok) throw new Error(`Failed to fetch scored forecast: ${res.status}`);
    return res.json();
  }, [beachId]);

  return useDataFetcher<ScoredForecastData>(fetchFn, {
    enabled: !!beachId,
    cacheKey: `scored-forecast-${beachId}`,
    cacheTTL: 10 * 60 * 1000, // 10 minutes
  });
}
```

- [ ] **Step 4: Run tests**

Run: `npx jest __tests__/hooks/use-scored-forecast.test.ts --no-coverage`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add hooks/use-scored-forecast.ts __tests__/hooks/use-scored-forecast.test.ts
git commit -m "feat: add useScoredForecast hook — fetches scored forecast data with caching"
```

---

## Chunk 2: ScoredForecastTeaser Component

### Task 3: Create `ScoredForecastTeaser` component

**Files:**
- Create: `components/beach-detail/scored-forecast-teaser.tsx`
- Create: `__tests__/components/scored-forecast-teaser.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/components/scored-forecast-teaser.test.tsx`:

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import { ScoredForecastTeaser } from "@/components/beach-detail/scored-forecast-teaser";
import type { ScoredForecastData } from "@/hooks/use-scored-forecast";

// Mock useAuth
jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(() => ({ user: null, isLoading: false })),
}));

// Mock trackEvent
jest.mock("@/lib/analytics/track-event", () => ({
  trackEvent: jest.fn(),
}));

import { useAuth } from "@/context/auth-context";
const mockUseAuth = useAuth as jest.Mock;

const mockData: ScoredForecastData = {
  timeSlots: [
    {
      forecastAt: "2026-03-19T06:00:00Z",
      surfHeight: { min: 3, max: 5 },
      swells: [{ height: 4, period: 14, direction: 250, compass: "WSW" }],
      windSpeed: 5,
      windDirection: "E",
      windDirectionDeg: 90,
      isOffshore: true,
      tideHeight: 3.2,
      tideStatus: "Rising",
      waterTemp: "60°F",
      airTemp: "65°F",
      compositeScore: 82,
      rideableWavesPerHour: 18,
      waveFrequencyConfidence: "high",
      swellTrains: 1,
      dominantBeatIntervalS: null,
      forecastDataConfidence: 85,
    },
    {
      forecastAt: "2026-03-19T09:00:00Z",
      surfHeight: { min: 4, max: 6 },
      swells: [{ height: 4.5, period: 14, direction: 250, compass: "WSW" }],
      windSpeed: 8,
      windDirection: "W",
      windDirectionDeg: 270,
      isOffshore: false,
      tideHeight: 4.8,
      tideStatus: "Falling",
      waterTemp: "60°F",
      airTemp: "68°F",
      compositeScore: 65,
      rideableWavesPerHour: 12,
      waveFrequencyConfidence: "medium",
      swellTrains: 1,
      dominantBeatIntervalS: null,
      forecastDataConfidence: 80,
    },
  ],
  goldenWindows: [
    {
      startTime: "2026-03-19T06:00:00Z",
      endTime: "2026-03-19T09:00:00Z",
      peakTime: "2026-03-19T06:00:00Z",
      peakScore: 82,
      durationMinutes: 180,
      peakWavesPerHour: 18,
      waveFrequencyConfidence: "high",
    },
  ],
  beach: { aspectDeg: 270, breakType: "beach" },
};

describe("ScoredForecastTeaser", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: false });
  });

  it("renders golden window headline", () => {
    render(<ScoredForecastTeaser data={mockData} beachId="beach-123" />);
    expect(screen.getByText(/18 waves\/hr/)).toBeInTheDocument();
    expect(screen.getByText("BEST WINDOW TODAY")).toBeInTheDocument();
  });

  it("renders score timeline bars", () => {
    render(<ScoredForecastTeaser data={mockData} beachId="beach-123" />);
    const bars = screen.getAllByRole("img", { hidden: true });
    // Each bar has aria-label
    expect(bars.length).toBeGreaterThanOrEqual(2);
  });

  it("renders conditions chips", () => {
    render(<ScoredForecastTeaser data={mockData} beachId="beach-123" />);
    expect(screen.getByText("3-5ft")).toBeInTheDocument();
    expect(screen.getByText(/WSW/)).toBeInTheDocument();
    expect(screen.getByText(/60°F/)).toBeInTheDocument();
  });

  it("shows CTA card for anonymous users", () => {
    render(<ScoredForecastTeaser data={mockData} beachId="beach-123" />);
    expect(screen.getByText("Join the Waitlist")).toBeInTheDocument();
    expect(screen.getByText(/This is a snapshot/)).toBeInTheDocument();
  });

  it("hides CTA card for authenticated users", () => {
    mockUseAuth.mockReturnValue({ user: { id: "user-1" }, isLoading: false });
    render(<ScoredForecastTeaser data={mockData} beachId="beach-123" />);
    // Still shows data
    expect(screen.getByText(/18 waves\/hr/)).toBeInTheDocument();
    // But no CTA
    expect(screen.queryByText("Join the Waitlist")).not.toBeInTheDocument();
  });

  it("renders nothing when data is null", () => {
    const { container } = render(
      <ScoredForecastTeaser data={null} beachId="beach-123" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when fewer than 2 time slots", () => {
    const sparseData = {
      ...mockData,
      timeSlots: [mockData.timeSlots[0]],
    };
    const { container } = render(
      <ScoredForecastTeaser data={sparseData} beachId="beach-123" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows no-golden-window fallback when no windows exist", () => {
    const noGoldenData = { ...mockData, goldenWindows: [] };
    render(<ScoredForecastTeaser data={noGoldenData} beachId="beach-123" />);
    expect(screen.getByText(/No prime windows today/)).toBeInTheDocument();
  });

  it("opens auth modal when CTA clicked", () => {
    render(<ScoredForecastTeaser data={mockData} beachId="beach-123" />);
    fireEvent.click(screen.getByText("Join the Waitlist"));
    // Auth modal should appear
    expect(screen.getByTestId("unified-auth-modal")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/components/scored-forecast-teaser.test.tsx --no-coverage`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

Create `components/beach-detail/scored-forecast-teaser.tsx`:

```typescript
"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import type { ScoredForecastData, ScoredTimeSlot } from "@/hooks/use-scored-forecast";

function getPlatformCopy(): string {
  if (typeof navigator === "undefined") return "coming to your phone";
  const ua = navigator.userAgent;
  if (/iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document))
    return "coming to iOS";
  if (/Android/.test(ua)) return "coming to Android";
  return "coming to your phone";
}

function scoreToColor(score: number): string {
  if (score >= 70) return "bg-[#00D4AA]";
  if (score >= 50) return "bg-[#FFD639]";
  if (score >= 30) return "bg-[#FF8C42]";
  return "bg-[#FF5C5C]";
}

function formatHour(isoString: string): string {
  const d = new Date(isoString);
  const h = d.getHours();
  if (h === 0) return "12a";
  if (h === 12) return "12p";
  return h > 12 ? `${h - 12}p` : `${h}a`;
}

function formatTimeRange(start: string, end: string): string {
  return `${formatHour(start)} – ${formatHour(end)}`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  return hours === 1 ? "1 hour" : `${hours} hours`;
}

interface ScoredForecastTeaserProps {
  data: ScoredForecastData | null;
  beachId: string;
}

export function ScoredForecastTeaser({ data, beachId }: ScoredForecastTeaserProps) {
  const { user } = useAuth();
  const [showAuth, setShowAuth] = useState(false);

  // Render nothing if no usable data
  if (!data || data.timeSlots.length < 2) return null;

  const goldenWindow = data.goldenWindows[0] ?? null;
  const peakSlot = goldenWindow
    ? data.timeSlots.find((s) => s.forecastAt === goldenWindow.peakTime) ?? data.timeSlots[0]
    : data.timeSlots.reduce((best, s) =>
        s.compositeScore > best.compositeScore ? s : best,
        data.timeSlots[0]
      );

  const isGoldenSlot = (slot: ScoredTimeSlot) =>
    goldenWindow != null && slot.compositeScore >= 60;

  return (
    <div className="px-4 sm:px-6 mb-4">
      {/* Golden Window Banner */}
      <div className="bg-[#111D35] border border-[#1E2D4D] rounded-2xl p-4 mb-3">
        <div className="flex items-center gap-2 mb-2.5">
          <span
            className="w-2 h-2 rounded-full bg-[#FFD639] motion-safe:animate-pulse"
            aria-hidden="true"
          />
          <span className="text-[10px] text-[#FFD639] tracking-[1.5px] font-bold">
            {goldenWindow ? "BEST WINDOW TODAY" : "No prime windows today"}
          </span>
        </div>

        {goldenWindow ? (
          <div className="text-[22px] font-bold text-white leading-tight mb-3">
            {formatTimeRange(goldenWindow.startTime, goldenWindow.endTime)}
            <br />
            <span className="text-[#00D4AA]">
              ~{goldenWindow.peakWavesPerHour} waves/hr
            </span>{" "}
            for {formatDuration(goldenWindow.durationMinutes)}
          </div>
        ) : (
          <div className="text-lg font-bold text-white mb-3">
            Best slot: {formatHour(peakSlot.forecastAt)} · Score {peakSlot.compositeScore}
          </div>
        )}

        {/* Score Timeline Bars */}
        <div className="flex gap-1 mb-1">
          {data.timeSlots.map((slot, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={`w-full h-2 rounded-full ${scoreToColor(slot.compositeScore)} ${
                  isGoldenSlot(slot) ? "opacity-100" : "opacity-50"
                }`}
                role="img"
                aria-label={`${formatHour(slot.forecastAt)}: score ${slot.compositeScore}, ${
                  slot.compositeScore >= 70
                    ? "good conditions"
                    : slot.compositeScore >= 50
                    ? "fair conditions"
                    : "poor conditions"
                }`}
              />
              <span
                className={`text-[9px] ${
                  isGoldenSlot(slot) ? "text-white font-semibold" : "text-[#9AABC6]"
                }`}
              >
                {formatHour(slot.forecastAt)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Conditions Chips */}
      <div className="grid grid-cols-4 gap-1.5 mb-3">
        <ConditionChip label="Height" color="text-[#FF3B8B]">
          {peakSlot.surfHeight.min}-{peakSlot.surfHeight.max}ft
        </ConditionChip>
        <ConditionChip label="Swell" color="text-[#00D4AA]">
          {peakSlot.swells[0]?.compass ?? "–"} {peakSlot.swells[0]?.period ?? 0}s
        </ConditionChip>
        <ConditionChip
          label="Wind"
          color={peakSlot.isOffshore ? "text-[#00D4AA]" : "text-[#FFD639]"}
        >
          {peakSlot.isOffshore ? "Offshore" : "Onshore"} {Math.round(peakSlot.windSpeed)}
        </ConditionChip>
        <ConditionChip label="Water" color="text-[#9AABC6]">
          {peakSlot.waterTemp || "–"}
        </ConditionChip>
      </div>

      {/* App CTA Card — anonymous only */}
      {!user && (
        <>
          <div className="bg-[#FFD639]/[0.06] border border-[#FFD639]/15 rounded-2xl p-4">
            <div className="text-center">
              <p className="text-sm font-semibold text-white mb-1.5">
                This is a snapshot.
              </p>
              <p className="text-xs text-[#9AABC6] leading-relaxed mb-3.5">
                The full Living Timeline is {getPlatformCopy()} — scrub through
                time, feel the swell with haptics, get session briefings like
                &ldquo;be here at 6:47am.&rdquo;
              </p>
              <button
                onClick={() => setShowAuth(true)}
                className="w-full bg-[#FF3B8B] hover:bg-[#FF3B8B]/90 text-white font-semibold text-[15px] py-3.5 rounded-xl transition-colors"
              >
                Join the Waitlist
              </button>
              <p className="text-[11px] text-[#9AABC6] mt-2">
                We&apos;ll email you when it drops. No spam.
              </p>
            </div>
          </div>

          <UnifiedAuthModal
            isOpen={showAuth}
            onClose={() => setShowAuth(false)}
            source={`scored-forecast-${beachId}`}
          />
        </>
      )}
    </div>
  );
}

function ConditionChip({
  label,
  color,
  children,
}: {
  label: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#111D35] border border-[#1E2D4D] rounded-[10px] p-2">
      <div className={`text-[9px] font-bold tracking-wide ${color}`}>{label}</div>
      <div className="text-[13px] font-semibold text-[#F0F0F0] mt-0.5 truncate">
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npx jest __tests__/components/scored-forecast-teaser.test.tsx --no-coverage`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/beach-detail/scored-forecast-teaser.tsx __tests__/components/scored-forecast-teaser.test.tsx
git commit -m "feat: add ScoredForecastTeaser component — golden window banner, score bars, conditions chips, app waitlist CTA"
```

---

## Chunk 3: Integration — Beach Detail + Route + Forecast Tab

### Task 4: Integrate into `beach-detail.tsx` — add teaser, hide old CTAs

**Files:**
- Modify: `components/beach-detail.tsx`

- [ ] **Step 1: Add imports**

At the top of `components/beach-detail.tsx`, add:

```typescript
import { useScoredForecast } from "@/hooks/use-scored-forecast";
import { ScoredForecastTeaser } from "@/components/beach-detail/scored-forecast-teaser";
```

- [ ] **Step 2: Call the hook**

Inside the `BeachDetail` component function (after other hooks, near the existing `useAuth` call), add:

```typescript
const { data: scoredData } = useScoredForecast(beach.id);
const hasScoredData = !!scoredData && scoredData.timeSlots.length >= 2;
```

- [ ] **Step 3: Replace MatchScoreTeaser + InlineSignupCta with ScoredForecastTeaser**

Find the block at ~lines 560-582 that renders `MatchScoreTeaser` and `InlineSignupCta`. Replace:

```typescript
{publicMode && (
  <div className="mb-4 -mt-2">
    <MatchScoreTeaser
      beachId={beach.id}
      beachName={beach.name}
      variant="card"
    />
  </div>
)}

{publicMode ? (
  <div className="mb-6">
    <InlineSignupCta
      ...
    />
  </div>
) : (
  surfReportSlot
)}
```

With:

```typescript
{hasScoredData ? (
  <ScoredForecastTeaser data={scoredData} beachId={beach.id} />
) : publicMode ? (
  <>
    <div className="mb-4 -mt-2">
      <MatchScoreTeaser
        beachId={beach.id}
        beachName={beach.name}
        variant="card"
      />
    </div>
    <div className="mb-6">
      <InlineSignupCta
        title={`Get Alerts for ${beach.name}`}
        description="Get notified when conditions are good, see the full 12-day outlook, and get your personalized surf call"
        primaryButtonText="Get Alerts — Free"
        source={`beach-detail-${slugify(beach.name)}`}
      />
    </div>
  </>
) : (
  surfReportSlot
)}

{!hasScoredData && !publicMode && surfReportSlot}
```

**Note:** When `hasScoredData` is true, surfReportSlot is not shown (the scored forecast replaces it for both anon and auth). When `hasScoredData` is false and user is authenticated, surfReportSlot shows as before.

- [ ] **Step 4: Hide Horizon Strip Upsell when scored data available**

Find the Horizon Strip Upsell block at ~lines 612-652 (starts with `{publicMode && horizonDaySummaries.length > 3 && (`). Wrap the condition:

Change `{publicMode && horizonDaySummaries.length > 3 && (` to `{publicMode && !hasScoredData && horizonDaySummaries.length > 3 && (`

- [ ] **Step 5: Run existing tests**

Run: `npx jest --testPathPattern="beach-detail" --no-coverage 2>&1 | tail -20`

Expected: Existing tests PASS (or update if they assert on removed CTAs).

- [ ] **Step 6: Commit**

```bash
git add components/beach-detail.tsx
git commit -m "feat: integrate ScoredForecastTeaser into beach detail — conditionally replaces old CTAs"
```

---

### Task 5: Remove `StickySignupBar` from route file

**Files:**
- Modify: `app/[intent]/[city]/[beachSlug]/page.tsx`

- [ ] **Step 1: Remove StickySignupBar**

In `app/[intent]/[city]/[beachSlug]/page.tsx`:

1. Remove the import at line 9: `import { StickySignupBar } from "@/components/ui/sticky-signup-bar";`
2. Remove the `<StickySignupBar ... />` block at ~lines 304-312.

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add "app/[intent]/[city]/[beachSlug]/page.tsx"
git commit -m "feat: remove StickySignupBar from beach detail route — replaced by scored forecast CTA"
```

---

### Task 6: Remove `PersonalizedForecastTeaser` + `PublicContentGate` blur from forecast tab

**Files:**
- Modify: `components/beach-detail/tabs/forecast-tab.tsx`

- [ ] **Step 1: Remove PersonalizedForecastTeaser**

In `components/beach-detail/tabs/forecast-tab.tsx`:

Find the block at ~lines 277-284:
```tsx
{!user && (
  <PersonalizedForecastTeaser
    beachId={beach.id}
    beachName={beach.name}
    className="mx-4 sm:mx-6"
  />
)}
```

Remove this entire block. Also remove the import at ~line 38.

- [ ] **Step 2: Remove PublicContentGate on Best Surf Window**

Find the block at ~lines 487-497:
```tsx
return publicMode ? (
  <PublicContentGate
    ctaTitle={...}
    ...
  >
    {bestSurfWindowContent}
  </PublicContentGate>
) : bestSurfWindowContent;
```

Replace with just:
```tsx
return bestSurfWindowContent;
```

Also remove the `PublicContentGate` import at ~line 34 if it's no longer used elsewhere in this file.

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

Expected: No errors.

- [ ] **Step 4: Run forecast tab tests**

Run: `npx jest --testPathPattern="forecast" --no-coverage 2>&1 | tail -20`

Expected: PASS (update tests if they assert on removed components).

- [ ] **Step 5: Commit**

```bash
git add components/beach-detail/tabs/forecast-tab.tsx
git commit -m "feat: remove PersonalizedForecastTeaser + PublicContentGate blur from forecast tab — data is free now"
```

---

### Task 7: Final verification

- [ ] **Step 1: Run full typecheck**

Run: `npx tsc --noEmit --pretty`

Expected: No errors.

- [ ] **Step 2: Run all affected tests**

Run: `npx jest --no-coverage 2>&1 | tail -20`

Expected: All PASS.

- [ ] **Step 3: Manual smoke test**

Run: `yarn dev` and visit a beach detail page (e.g., `/ca/san-diego/blacks`).

Verify:
- Anonymous: Scored forecast teaser visible with golden window, bars, chips, CTA
- Anonymous: No MatchScoreTeaser, InlineSignupCta, StickySignupBar, PersonalizedForecastTeaser, or PublicContentGate blur
- Anonymous: "Join the Waitlist" opens auth modal
- Authenticated: Scored data visible, no CTA card
- Error fallback: If API fails, old CTAs should show (test by temporarily breaking the endpoint URL)
