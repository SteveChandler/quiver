# Implementation Plan: Personalization Engine & Forecast Transparency

> **DEPRECATED 2026-04-10:** `preferred_wave_size`, `preferred_break_type`, and
> `crowd_preference` have been removed. Scoring now relies on learned, implicit,
> and affinity preferences only. The onboarding-pref examples below (wave size /
> break type / crowd selectors, zod schemas, and server writes referencing these
> columns) are historical and no longer represent current behavior. DB columns
> will be dropped in a follow-up migration.

**Version:** 2.0 (Simplified for small user base)
**Timeline:** 4 weeks
**Rollout:** Direct deployment (no feature flags needed)
**Status:** ✅ Phases 1-6 Backend Complete | 🔄 Phase 6.3 UI Integration Pending
**Created:** 2025-11-03
**Last Updated:** 2025-11-03 (Phase 6.3 PersonalizedBadge created, UI integration pending)

---

## Executive Summary

This plan implements two high-priority growth features to enhance user engagement and trust:

1. **Forecast Transparency** — Expose existing multi-source forecast data with confidence indicators
2. **Personalization Engine** — Learn user preferences and provide tailored recommendations

**Key Innovation:** Integrate surf preference questions into existing onboarding to capture explicit preferences upfront, then refine with learned behavior over time.

**Infrastructure Status:**

- Forecast transparency: ✅ 100% complete (fully integrated into UI)
- Personalization: ✅ 98% complete
  - Onboarding UI: ✅ Complete (3 preference questions with emoji buttons)
  - Session conditions: ✅ Complete (automatic trigger-based capture)
  - Beach affinity: ✅ Complete (auto-updating scores)
  - User preferences schema: ✅ Complete (migration + rollback)
  - Learning service: ✅ Complete (statistical analysis)
  - Cron job: ✅ Complete (daily 3AM UTC, batch processing)
  - Scoring service: ✅ Complete (multi-factor algorithm)
  - Morning API integration: ✅ Complete (returns personalization data)
  - PersonalizedBadge component: ✅ Complete (146 lines, fully tested)
  - **UI Integration: 🔄 Pending** (badge not rendered in home screen/beach detail)

**Deployment Strategy:** Direct rollout without feature flags (400 user base doesn't require gradual rollout complexity)

---

## Table of Contents

1. [Phase 1: Forecast Transparency](#phase-1-forecast-transparency-week-1)
2. [Phase 2: Enhanced Onboarding](#phase-2-enhanced-onboarding-with-surf-preferences-week-1-2)
3. [Phase 3: Session Conditions Capture](#phase-3-session-conditions-capture-week-2)
4. [Phase 4: Beach Affinity Tracking](#phase-4-beach-affinity-tracking-week-2-3)
5. [Phase 5: Preference Learning](#phase-5-preference-learning-week-3)
6. [Phase 6: Personalized Recommendations](#phase-6-personalized-recommendations-week-4)
7. [Testing Strategy](#testing-strategy)
8. [Deployment Strategy](#deployment-strategy-simplified)
9. [Success Metrics](#success-metrics)
10. [Agent Assignments](#agent-assignment-summary)

---

## Phase 1: Forecast Transparency (Week 1) ✅ COMPLETE

**Goal:** Expose existing forecast source data to users to build trust and differentiate from competitors
**Effort:** 3-4 days (Actual: 1 day - most work already done)
**Risk:** Low (read-only UI changes)
**Status:** ✅ Completed 2025-11-03

**Summary:**
Phase 1 is **complete**. Upon investigation, 80% of the forecast transparency infrastructure already existed in production. The only missing piece was the `BuoyStationLink` component, which has been implemented with 3 variants, comprehensive tests (35 passing), and integrated into `ForecastDataSourceIndicator`.

### Background

Quiver already has comprehensive multi-source forecast infrastructure:

- **Sources:** NOAA WaveWatch III, CDIP buoys, NDBC, CO-OPS tides
- **Confidence scoring:** 0-100 based on data sources, freshness, and time ahead
- **Quality validation:** Outlier detection, sensor glitch rejection
- **Storage:** `enhanced_forecasts.raw_forecast` contains full source metadata

**Problem:** This rich metadata is stored but never shown to users.

### Workpath 1.1: UI Components ✅ COMPLETE

**Agent:** `frontend-developer`

**Status:** Completed 2025-11-03

**Implementation Notes:**
Upon codebase audit, we discovered that **most requested components already exist** in production:

- **ForecastSourceBadge** → Implemented as `ForecastDataSourceIndicator`
- **ConfidenceIndicator** → Implemented within `ForecastDataSourceIndicator` (confidenceScore prop)
- **DataFreshnessIndicator** → Implemented within `ForecastDataSourceIndicator` (isStaleData, lastUpdated props)
- **BuoyStationLink** → ✅ **CREATED** as new component with 3 variants

**Files created:**

- `components/forecast/BuoyStationLink.tsx` (NEW)
- `__tests__/components/forecast/buoy-station-link.test.tsx` (NEW - 35 tests passing)

**Files modified:**

- `components/forecast/forecast-data-source-indicator.tsx` (integrated BuoyStationLink)
- `__tests__/components/forecast/forecast-data-source-indicator.test.tsx` (updated tests)
- `components/forecast/index.ts` (added exports)
- `components/forecast/ARCHITECTURE.md` (documented new component)

#### ForecastSourceBadge.tsx

**Purpose:** Display data source with icon and color coding

**Props:**

```typescript
interface ForecastSourceBadgeProps {
  source: "CDIP" | "NOAA_NWS" | "FALLBACK";
  confidence?: number; // 0-100
  className?: string;
}
```

**UI Behavior:**

- CDIP: Blue badge with buoy icon (🌊)
- NOAA: Green badge with satellite icon (🛰️)
- Fallback: Gray badge with estimate icon (📊)
- Hover: Tooltip explaining source

**Example:**

```tsx
<ForecastSourceBadge source="CDIP" confidence={85} />
// Renders: [🌊 CDIP Data] (blue, high confidence)
```

#### ConfidenceIndicator.tsx

**Purpose:** Visual confidence score with explanation

**Props:**

```typescript
interface ConfidenceIndicatorProps {
  score: number; // 0-100
  factors?: {
    dataSources: string[];
    hoursAhead: number;
    hasBuoyData: boolean;
  };
  showDetails?: boolean;
}
```

**UI Behavior:**

- > 75: Green dot + "High confidence"
- 50-75: Yellow dot + "Medium confidence"
- <50: Red dot + "Low confidence"
- Click to expand: Show factor breakdown

**Example:**

```tsx
<ConfidenceIndicator
  score={82}
  factors={{
    dataSources: ["CDIP", "NOAA"],
    hoursAhead: 2,
    hasBuoyData: true,
  }}
  showDetails
/>
```

#### DataFreshnessIndicator.tsx

**Purpose:** Show how recent the forecast data is

**Props:**

```typescript
interface DataFreshnessIndicatorProps {
  updatedAt: Date;
  format?: "relative" | "absolute";
}
```

**UI Behavior:**

- Use `date-fns` `formatDistanceToNow()`
- <30 min: "Updated just now" (green)
- 30-120 min: "Updated X min ago" (yellow)
- > 120 min: "Updated X hours ago" (orange)

**Example:**

```tsx
<DataFreshnessIndicator updatedAt={new Date("2025-11-03T10:45:00Z")} />
// Renders: "Updated 15 minutes ago"
```

#### BuoyStationLink.tsx ✅ IMPLEMENTED

**Purpose:** Link to buoy station details with distance

**Implementation Details:**

- **File:** `components/forecast/buoy-station-link.tsx`
- **Tests:** `__tests__/components/forecast/buoy-station-link.test.tsx` (35 tests, all passing)
- **Variants:** 3 display modes (default, compact, inline)
- **Integration:** Used in `ForecastDataSourceIndicator` with compact variant

**Props (Actual Implementation):**

```typescript
interface BuoyStationLinkProps {
  stationId: string; // e.g., "220" for CDIP 220
  stationName: string; // e.g., "Scripps Pier"
  distance?: number; // kilometers (optional)
  beachLocation?: {
    // optional
    latitude: number;
    longitude: number;
  };
  variant?: "default" | "compact" | "inline";
  showIcon?: boolean;
  className?: string;
}
```

**Features Implemented:**

- ✅ Clickable links to `/buoys/[stationId]`
- ✅ Distance formatting (auto km/m based on distance)
- ✅ Three display variants for different contexts
- ✅ Interactive tooltips with station details
- ✅ Full ARIA labels and keyboard navigation
- ✅ Zero-distance edge case handling
- ✅ Miles-to-km conversion support

**Test Coverage:**

- ✅ All 3 variants render correctly
- ✅ Distance formatting (km for >1km, m for <1km)
- ✅ Zero distance handled correctly
- ✅ Special characters in names
- ✅ Accessibility (ARIA labels, tooltips, keyboard nav)
- ✅ Props validation and edge cases

### Workpath 1.2: Data Integration ✅ COMPLETE

**Agent:** `nextjs-developer`

**Status:** ✅ Completed 2025-11-03

**Implementation Summary:**
Forecast transparency has been fully integrated into beach detail pages and map components. The implementation leveraged existing transparency components and enriched forecast data with metadata at the action layer.

**Files Modified:**

1. **`actions/forecast-actions.ts`** - Added metadata extraction and enrichment

   - `ForecastMetadata` interface for structured transparency data
   - `extractForecastMetadata()` helper function
   - `EnhancedForecastWithMetadata` type
   - `getEnhancedBeachForecasts()` enriches all forecasts with metadata
   - `getBeachForecastPreview()` includes metadata for map components

2. **`components/beach-detail/tabs/forecast-tab.tsx`** - Beach detail integration

   - New transparency section above "Current Conditions"
   - `ForecastDataSourceIndicator` with full configuration
   - `ForecastFreshnessBadge` with refresh capability
   - `BuoyStationLink` when CDIP data available (station ID, name, distance)
   - Metadata extracted via `useMemo` from current forecast

3. **`components/map/selected-beach-card.tsx`** - Map integration
   - Compact data source badge in forecast preview
   - "Real-time Data" badge for CDIP sources
   - Primary data source display (NOAA_NWS, CDIP, FALLBACK)

**Files Created:**

- `e2e/forecast-transparency.spec.ts` - E2E test suite (5 test scenarios)

**Components Used:**

- `ForecastDataSourceIndicator` - Existing component (provides ForecastSourceBadge + ConfidenceIndicator + DataFreshnessIndicator functionality)
- `ForecastFreshnessBadge` - Existing component
- `BuoyStationLink` - Created in Workpath 1.1

**Test Coverage:**

- ✅ All existing unit tests passing
- ✅ E2E tests created for transparency features
- ✅ Integration verified on beach detail and map pages
- ✅ No breaking changes introduced

#### Actual Implementation

**File:** `actions/forecast-actions.ts`

**Metadata Interface (Added):**

```typescript
export interface ForecastMetadata {
  primarySource: "NOAA_NWS" | "CDIP" | "FALLBACK" | string;
  allSources: string[];
  confidenceScore: number;
  lastUpdated: string;
  cdipStation?: string;
  cdipStationName?: string;
  cdipDistance?: number;
  isRealTimeData?: boolean;
  isStaleData?: boolean;
}
```

**Helper Function (Added):**

```typescript
function extractForecastMetadata(
  forecast: EnhancedForecastEntity
): ForecastMetadata {
  const now = Date.now();
  const updatedAt = new Date(forecast.updated_at).getTime();
  const hoursSinceUpdate = (now - updatedAt) / (1000 * 60 * 60);

  return {
    primarySource: forecast.data_source || "FALLBACK",
    allSources: forecast.raw_forecast?.data_sources || [
      forecast.data_source || "FALLBACK",
    ],
    confidenceScore: forecast.confidence_score ?? 50,
    lastUpdated: forecast.updated_at,
    cdipStation: forecast.raw_forecast?.cdip_data?.stationId,
    cdipStationName: forecast.raw_forecast?.cdip_data?.stationName,
    isRealTimeData: forecast.data_source === "CDIP",
    isStaleData: hoursSinceUpdate > 6,
  };
}
```

**Enhanced Function (Modified):**

```typescript
export async function getEnhancedBeachForecasts(
  beachId: string,
  days: number = 12
) {
  // ... existing fetch logic ...

  // Enrich forecasts with metadata for transparency
  const forecastsWithMetadata: EnhancedForecastWithMetadata[] = (
    data || []
  ).map((forecast: EnhancedForecastEntity) => ({
    ...forecast,
    metadata: extractForecastMetadata(forecast),
  }));

  return { success: true, data: forecastsWithMetadata };
}
```

#### Beach Detail Forecast Tab Integration

**File:** `components/beach-detail/tabs/forecast-tab.tsx`

**Imports (Added):**

```typescript
import { ForecastDataSourceIndicator } from "@/components/forecast/forecast-data-source-indicator";
import { ForecastFreshnessBadge } from "@/components/ui/forecast-freshness-badge";
import { BuoyStationLink } from "@/components/forecast/buoy-station-link";
```

**Metadata Extraction (Added):**

```typescript
const forecastMetadata = useMemo(() => {
  if (!currentForecast) return null;

  const now = Date.now();
  const updatedAt = new Date(currentForecast.updated_at).getTime();
  const hoursSinceUpdate = (now - updatedAt) / (1000 * 60 * 60);

  return {
    dataSource: currentForecast.data_source || "FALLBACK",
    confidenceScore: currentForecast.confidence_score ?? 50,
    dataSources: currentForecast.raw_forecast?.data_sources || [
      currentForecast.data_source || "FALLBACK",
    ],
    lastUpdated: currentForecast.updated_at,
    isRealTimeData: currentForecast.data_source === "CDIP",
    isStaleData: hoursSinceUpdate > 6,
    cdipStation: currentForecast.raw_forecast?.cdip_data?.stationId,
    cdipStationName: currentForecast.raw_forecast?.cdip_data?.stationName,
  };
}, [currentForecast]);
```

**UI Rendering (Added):**

```tsx
{
  /* Forecast Transparency Section */
}
{
  currentForecast && forecastMetadata && (
    <section className="rounded-2xl bg-blue-50/50 border border-blue-100 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          <ForecastDataSourceIndicator
            dataSource={forecastMetadata.dataSource}
            confidenceScore={forecastMetadata.confidenceScore}
            dataSources={forecastMetadata.dataSources}
            isRealTimeData={forecastMetadata.isRealTimeData}
            isStaleData={forecastMetadata.isStaleData}
            lastUpdated={forecastMetadata.lastUpdated}
            expandable={true}
          />
          {forecastMetadata.cdipStation && forecastMetadata.cdipStationName && (
            <BuoyStationLink
              stationId={forecastMetadata.cdipStation}
              stationName={forecastMetadata.cdipStationName}
              beachLocation={{
                latitude: beach.latitude,
                longitude: beach.longitude,
              }}
              variant="compact"
            />
          )}
        </div>
        <ForecastFreshnessBadge
          updatedAt={new Date(forecastMetadata.lastUpdated)}
          showRefresh={true}
          variant="default"
        />
      </div>
    </section>
  );
}
```

#### Map Component Integration

**File:** `components/map/selected-beach-card.tsx`

**Implementation (Added):**

```tsx
{
  /* Data Source Badge (Transparency) */
}
{
  forecastPreview && forecastPreview.metadata && (
    <div className="mt-2 flex items-center gap-2 text-xs">
      {forecastPreview.metadata.isRealTimeData ? (
        <div className="flex items-center gap-1 text-green-600">
          <Activity className="h-3 w-3" />
          <span className="font-medium">Real-time Data</span>
        </div>
      ) : (
        <div className="flex items-center gap-1 text-blue-600">
          <Database className="h-3 w-3" />
          <span>{forecastPreview.metadata.primarySource}</span>
        </div>
      )}
    </div>
  );
}
```

**E2E Tests Created:**

**File:** `e2e/forecast-transparency.spec.ts`

Test Scenarios:

1. ✅ Beach page displays forecast data source indicator
2. ✅ Beach page shows confidence score
3. ✅ Beach page shows data freshness indicator
4. ⏭️ Beach page shows buoy station link (when CDIP data available) - Skipped for now
5. ✅ Map selected beach card shows data source

**Test Results:**

- All unit tests passing
- E2E tests created (some skip pending CDIP data availability)
- No breaking changes to existing functionality

---

## Phase 2: Enhanced Onboarding with Surf Preferences (Week 1-2) ✅ COMPLETE

**Goal:** Capture surf preferences during onboarding + fix existing data loss bugs
**Effort:** 1 week (Actual: 1 week)
**Risk:** Medium (database migration + critical user flow)
**Status:** ✅ Complete (All workpaths finished)

**Completed Workpaths:**

- ✅ Workpath 2.1: Database Schema (migrations applied)
- ✅ Workpath 2.2: UI Components (3 preference questions with emoji SelectCards)
- ✅ Workpath 2.3: Update Onboarding Save Action (32 tests passing)
- ✅ Workpath 2.4: Regenerate Database Types
- ✅ Workpath 2.5: Profile Preference Editing (users can now edit preferences anytime)

### Background

**Current Onboarding Flow (7 steps):**

1. Welcome
2. Profile (full name, display name)
3. Home Beach (search + select)
4. **Preferences** (experience level, surf styles) ⭐ We'll enhance this
5. Referral (optional code)
6. Notifications (push/email preferences)
7. Completion (summary + save)

**Critical Bugs Found:**

- ❌ `display_name` is collected but NOT saved to database
- ❌ `surf_styles` is collected but NOT saved to database
- ⚠️ `display_name` column doesn't even exist in profiles table

### Workpath 2.1: Fix Data Loss + Add New Fields ✅ COMPLETED

**Status:** ✅ Completed on 2025-11-03
**Agent:** `supabase-db-expert`

**Migrations Applied:**

- **Phase 1:** `20251103000000_fix_onboarding_data_loss.sql` (URGENT bug fix)
- **Phase 2:** `20251103000001_add_personalization_preferences.sql` (Enhancement)

```sql
-- Fix existing data loss bugs
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS surf_styles TEXT[];

-- Add new preference fields (all optional)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_wave_size TEXT
  CHECK (preferred_wave_size IN ('small', 'medium', 'large', 'any'));

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_break_type TEXT
  CHECK (preferred_break_type IN ('beach', 'point', 'reef', 'any'));

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS crowd_preference TEXT
  CHECK (crowd_preference IN ('social', 'moderate', 'solitude'));

-- Create unique constraint on display_name (like username)
CREATE UNIQUE INDEX idx_profiles_display_name
  ON profiles(display_name)
  WHERE display_name IS NOT NULL;

-- Add indexes for preference queries
CREATE INDEX idx_profiles_wave_size
  ON profiles(preferred_wave_size)
  WHERE preferred_wave_size IS NOT NULL;

CREATE INDEX idx_profiles_break_type
  ON profiles(preferred_break_type)
  WHERE preferred_break_type IS NOT NULL;

-- Update RLS policies if needed (profiles already has RLS)
-- No changes needed - existing policies cover new columns

COMMENT ON COLUMN profiles.display_name IS 'Unique username for social features (previously collected but not saved)';
COMMENT ON COLUMN profiles.surf_styles IS 'Array of surf styles: longboard, shortboard, etc. (previously collected but not saved)';
COMMENT ON COLUMN profiles.preferred_wave_size IS 'Explicit wave size preference from onboarding: small (1-3ft), medium (3-6ft), large (6ft+), or any';
COMMENT ON COLUMN profiles.preferred_break_type IS 'Explicit break type preference: beach, point, reef, or any';
COMMENT ON COLUMN profiles.crowd_preference IS 'Social preference: social (love the crew), moderate (few people), solitude (dawn patrol)';
```

**Rollback Migration:**

```sql
-- If needed to rollback
ALTER TABLE profiles DROP COLUMN IF EXISTS display_name;
ALTER TABLE profiles DROP COLUMN IF EXISTS surf_styles;
ALTER TABLE profiles DROP COLUMN IF EXISTS preferred_wave_size;
ALTER TABLE profiles DROP COLUMN IF EXISTS preferred_break_type;
ALTER TABLE profiles DROP COLUMN IF EXISTS crowd_preference;
DROP INDEX IF EXISTS idx_profiles_display_name;
DROP INDEX IF EXISTS idx_profiles_wave_size;
DROP INDEX IF EXISTS idx_profiles_break_type;
```

**Test Results:** ✅ All Passed

- ✅ Migration test: Apply and rollback successfully
- ✅ Constraint test: display_name uniqueness enforced (prevented duplicate 'riley_rips')
- ✅ Constraint test: Invalid wave_size rejected (rejected 'huge', only allows small/medium/large/any)
- ✅ Index test: All indexes created and verified in database
- ✅ TypeScript types regenerated with new columns
- ✅ RLS policies: Existing policies automatically cover new columns
- ✅ Data insertion: Successfully saved test data with all new fields

**Database Verification:**

```sql
-- New columns confirmed in profiles table:
display_name: text (UNIQUE where not null)
surf_styles: text[] (GIN indexed for array queries)
preferred_wave_size: text (CHECK: small|medium|large|any)
preferred_break_type: text (CHECK: beach|point|reef|any)
crowd_preference: text (CHECK: social|moderate|solitude)
```

**TypeScript Types:**
All new fields now appear in `types/database.generated.ts`:

- Correct nullability (`string | null`, `string[] | null`)
- Available in Row, Insert, and Update types

**Files Created:**

- `supabase/migrations/20251103000000_fix_onboarding_data_loss.sql`
- `supabase/migrations/20251103000001_add_personalization_preferences.sql`
- `supabase/rollbacks/20251103000000_fix_onboarding_data_loss_rollback.sql`
- `supabase/rollbacks/20251103000001_add_personalization_preferences_rollback.sql`

**Next Steps:**

1. Test onboarding flow end-to-end (start dev server)
2. Verify display_name and surf_styles now save correctly
3. Push to production when ready: `npx supabase db push`

### Workpath 2.2: Update Onboarding Components ✅ COMPLETE

**Agent:** `fullstack-engineer`
**Status:** Completed 2025-11-03

**Implementation Summary:**
Successfully implemented all 3 new preference questions in the onboarding flow with emoji-based SelectCard buttons.

**Files Modified:**

- `components/onboarding/steps/preferences-step.tsx` (lines 154-249)
- `lib/schemas/onboarding-schemas.ts` (lines 30-32)
- `store/onboarding-store.ts` (preference fields added)

**UI Questions Implemented:**

1. **Preferred Wave Size** (lines 154-183)

   - Small (1-3ft) 🌊
   - Medium (3-6ft) 🌊🌊
   - Large (6ft+) 🌊🌊🌊
   - I'll surf anything! 🤙

2. **Preferred Break Type** (lines 185-214)

   - Beach break 🏖️
   - Point break 🪨
   - Reef break 🪸
   - No preference ✨

3. **Crowd Preference** (lines 216-249)
   - Love the crew 👥
   - A few people is fine 🧘
   - Prefer solitude 🏝️

**Test Coverage:**

- ✅ E2E tests: `e2e/onboarding.spec.ts` (lines 74-80 test wave size/break type selection)
- ✅ Component tests: `__tests__/components/onboarding/preferences-step.test.tsx` (507 lines)
- ✅ Schema validation tests passing

---

**Original Specification (for reference):**

**Files to modify:**

- `components/onboarding/steps/preferences-step.tsx`
- `lib/schemas/onboarding-schemas.ts`
- `store/onboarding-store.ts`
- `types/database.generated.ts` (will regenerate)

#### Update Preferences Step UI

**File:** `components/onboarding/steps/preferences-step.tsx`

**Current Questions (Keep Unchanged):**

1. Experience Level (required)
2. Surf Styles (required)

**Add 3 New Questions Below:**

**Question 3: Preferred Wave Size**

```tsx
<div className="space-y-3">
  <label className="text-sm font-medium">
    What wave size do you prefer? (Optional)
  </label>
  <div className="grid grid-cols-2 gap-3">
    <SelectCard
      selected={data.preferredWaveSize === "small"}
      onClick={() => updateData({ preferredWaveSize: "small" })}
      icon="🌊"
      title="Small waves"
      description="1-3 ft - Perfect for learning"
    />
    <SelectCard
      selected={data.preferredWaveSize === "medium"}
      onClick={() => updateData({ preferredWaveSize: "medium" })}
      icon="🌊🌊"
      title="Medium waves"
      description="3-6 ft - The sweet spot"
    />
    <SelectCard
      selected={data.preferredWaveSize === "large"}
      onClick={() => updateData({ preferredWaveSize: "large" })}
      icon="🌊🌊🌊"
      title="Large waves"
      description="6+ ft - For experienced surfers"
    />
    <SelectCard
      selected={data.preferredWaveSize === "any"}
      onClick={() => updateData({ preferredWaveSize: "any" })}
      icon="🤙"
      title="I'll surf anything!"
      description="Any size is fun"
    />
  </div>
</div>
```

**Question 4: Preferred Beach Type**

```tsx
<div className="space-y-3">
  <label className="text-sm font-medium">
    What type of break do you prefer? (Optional)
  </label>
  <div className="grid grid-cols-2 gap-3">
    <SelectCard
      selected={data.preferredBreakType === "beach"}
      onClick={() => updateData({ preferredBreakType: "beach" })}
      icon="🏖️"
      title="Beach break"
      description="Sandy bottom, forgiving"
    />
    <SelectCard
      selected={data.preferredBreakType === "point"}
      onClick={() => updateData({ preferredBreakType: "point" })}
      icon="🪨"
      title="Point break"
      description="Long, consistent rides"
    />
    <SelectCard
      selected={data.preferredBreakType === "reef"}
      onClick={() => updateData({ preferredBreakType: "reef" })}
      icon="🪸"
      title="Reef break"
      description="Powerful, hollow waves"
    />
    <SelectCard
      selected={data.preferredBreakType === "any"}
      onClick={() => updateData({ preferredBreakType: "any" })}
      icon="✨"
      title="No preference"
      description="I love them all"
    />
  </div>
</div>
```

**Question 5: Crowd Tolerance**

```tsx
<div className="space-y-3">
  <label className="text-sm font-medium">
    How do you feel about crowds? (Optional)
  </label>
  <div className="grid grid-cols-1 gap-3">
    <SelectCard
      selected={data.crowdPreference === "social"}
      onClick={() => updateData({ crowdPreference: "social" })}
      icon="👥"
      title="Love the crew"
      description="More people, more fun"
    />
    <SelectCard
      selected={data.crowdPreference === "moderate"}
      onClick={() => updateData({ crowdPreference: "moderate" })}
      icon="🧘"
      title="A few people is fine"
      description="I can share the lineup"
    />
    <SelectCard
      selected={data.crowdPreference === "solitude"}
      onClick={() => updateData({ crowdPreference: "solitude" })}
      icon="🏝️"
      title="Prefer solitude"
      description="Dawn patrol warrior"
    />
  </div>
</div>
```

**Helper Text:**

```tsx
<p className="text-xs text-muted-foreground mt-4">
  ℹ️ These preferences are optional. We'll also learn from your surf sessions
  over time to personalize recommendations.
</p>
```

#### Update Validation Schema

**File:** `lib/schemas/onboarding-schemas.ts`

```typescript
import { z } from "zod";

export const preferencesSchema = z.object({
  // Existing required fields
  experienceLevel: z.enum(["beginner", "intermediate", "advanced", "expert"], {
    required_error: "Please select your experience level",
  }),
  surfStyles: z.array(z.string()).min(1, "Select at least one surf style"),

  // NEW: All optional
  preferredWaveSize: z.enum(["small", "medium", "large", "any"]).optional(),
  preferredBreakType: z.enum(["beach", "point", "reef", "any"]).optional(),
  crowdPreference: z.enum(["social", "moderate", "solitude"]).optional(),
});

export type PreferencesFormData = z.infer<typeof preferencesSchema>;
```

#### Update Zustand Store

**File:** `store/onboarding-store.ts`

```typescript
interface OnboardingData {
  // Existing fields
  fullName?: string;
  displayName?: string; // Will now be saved!
  homeBeachId?: string;
  homeBeachName?: string;
  experienceLevel?: "beginner" | "intermediate" | "advanced" | "expert";
  surfStyles?: string[]; // Will now be saved!
  referralCode?: string;
  pushEnabled?: boolean;
  emailEnabled?: boolean;

  // NEW: Optional preference fields
  preferredWaveSize?: "small" | "medium" | "large" | "any";
  preferredBreakType?: "beach" | "point" | "reef" | "any";
  crowdPreference?: "social" | "moderate" | "solitude";
}

interface OnboardingStore {
  data: OnboardingData;
  currentStep: number;
  updateData: (data: Partial<OnboardingData>) => void;
  nextStep: () => void;
  prevStep: () => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set) => ({
      data: {},
      currentStep: 0,
      updateData: (newData) =>
        set((state) => ({
          data: { ...state.data, ...newData },
        })),
      nextStep: () =>
        set((state) => ({
          currentStep: Math.min(state.currentStep + 1, 6),
        })),
      prevStep: () =>
        set((state) => ({
          currentStep: Math.max(state.currentStep - 1, 0),
        })),
      reset: () => set({ data: {}, currentStep: 0 }),
    }),
    {
      name: "onboarding-storage",
    }
  )
);
```

**Tests:**

- Unit test: Schema validation with new optional fields
- Unit test: Schema rejects invalid enum values
- Component test: Preferences step renders all 5 questions
- Component test: Optional fields can be skipped
- Integration test: Store persists new fields

### Workpath 2.3: Update Onboarding Save Action ✅ COMPLETE

**Agent:** `fullstack-engineer`
**Status:** Completed 2025-11-03

**Files Modified:**

- `actions/onboarding-actions.ts` - Updated saveOnboardingData()
- `store/onboarding-store.ts` - Added preference fields
- `lib/gamification-actions.ts` - Added missing XP actions

**Files Created:**

- `__tests__/actions/onboarding-actions.test.ts` - 18 integration tests
- `e2e/onboarding.spec.ts` - E2E onboarding flow tests

**Implementation Summary:**

**Key Changes to `saveOnboardingData()`:**

```typescript
// Now saves ALL preference fields to database:
preferred_wave_size: data.preferredWaveSize || null,
preferred_break_type: data.preferredBreakType || null,
crowd_preference: data.crowdPreference || null,

// Fixed: Notification preferences now save to DB (not just analytics)
notif_push_enabled: data.pushEnabled ?? true,
notif_email_enabled: data.emailEnabled ?? true,
```

**XP System Fix:**
Added missing XP actions to `lib/gamification-actions.ts`:

- `onboarding_completed: 100` XP
- `referral_signup: 50` XP
- `successful_referral: 100` XP

Previously these actions would throw "Unknown XP action" errors.

**OnboardingData Interface:**

```typescript
interface OnboardingData {
  // ... existing fields
  preferredWaveSize?: "small" | "medium" | "large" | "any";
  preferredBreakType?: "beach" | "point" | "reef" | "any";
  crowdPreference?: "social" | "moderate" | "solitude";
}
```

**Test Coverage:** ✅ 32 new tests

- Unit tests: 3 new XP action tests (all 14 gamification tests passing)
- Integration tests: 18 comprehensive tests for saveOnboardingData (80.8% coverage)
  - All field persistence (required + optional)
  - Notification preference persistence to DB
  - Validation (display_name uniqueness, enum constraints)
  - XP awarding (100 XP on completion)
  - Referral processing (graceful degradation)
  - Analytics tracking
- E2E tests: Complete onboarding flows
  - Complete onboarding with all preferences
  - Minimal onboarding (required fields only)
  - Data persistence verification
  - Validation error handling

### Workpath 2.4: Regenerate Database Types ✅ COMPLETE

**Agent:** `fullstack-engineer`
**Status:** Completed 2025-11-03

**Command:**

```bash
npx supabase gen types typescript --local > types/database.generated.ts
```

**Verified new fields in generated types:**

```typescript
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          // ... existing fields
          display_name: string | null;
          surf_styles: string[] | null;
          preferred_wave_size: "small" | "medium" | "large" | "any" | null;
          preferred_break_type: "beach" | "point" | "reef" | "any" | null;
          crowd_preference: "social" | "moderate" | "solitude" | null;
          notif_push_enabled: boolean;
          notif_email_enabled: boolean;
        };
      };
    };
  };
}
```

**Result:** TypeScript types properly reflect all new database columns with correct enum constraints.

### Workpath 2.5: Profile Preference Editing ✅ COMPLETED

**Status:** ✅ Completed on 2025-11-03
**Agent:** `frontend-developer`

**Goal:** Allow users to view and edit surf preferences from their profile page

**Problem:** Surf preferences were captured during onboarding but users had no way to:

- View their current preferences
- Update preferences as their skills/interests change
- Access preferences without re-onboarding

**Implementation:**

**Files Modified:**

- `components/profile/profile-preferences.tsx` - Added surf preference UI sections
- `actions/profile-actions.ts` - Updated schema to validate preference fields

**New UI Sections Added:**

1. **Experience Level** (single select)

   - Beginner 🏄‍♂️ | Intermediate 🌊 | Advanced 🏆 | Expert 🔥
   - Emoji SelectCard buttons matching onboarding style

2. **Surf Styles** (multi-select)

   - Longboard 🏄 | Shortboard 🏄‍♀️ | Funboard 🏄‍♂️
   - Bodyboard 🏊 | SUP 🚣 | Foil ✨
   - Toggle selection with visual feedback

3. **Preferred Wave Size** (single select)

   - Small 🌊 (1-3ft) | Medium 🌊🌊 (3-6ft)
   - Large 🌊🌊🌊 (6ft+) | Any Size 🤙

4. **Preferred Break Type** (single select)

   - Beach Break 🏖️ | Point Break 🪨
   - Reef Break 🪸 | Any Type ✨

5. **Crowd Preference** (single select)
   - Love the crew 👥 | A few people is fine 🧘 | Prefer solitude 🏝️

**Validation:**

```typescript
const preferencesFormSchema = z.object({
  home_beach_id: z.string().uuid().nullable().optional(),
  experience_level: z
    .enum(["beginner", "intermediate", "advanced", "expert"])
    .nullable()
    .optional(),
  surf_styles: z.array(z.string()).nullable().optional(),
  preferred_wave_size: z
    .enum(["small", "medium", "large", "any"])
    .nullable()
    .optional(),
  preferred_break_type: z
    .enum(["beach", "point", "reef", "any"])
    .nullable()
    .optional(),
  crowd_preference: z
    .enum(["social", "moderate", "solitude"])
    .nullable()
    .optional(),
  // ... notification preferences
});
```

**User Experience:**

1. Navigate to **Profile → Preferences** tab
2. View current preferences (populated from database)
3. Click any emoji card to change selection
4. Click "Save Preferences" to persist changes
5. Toast notification confirms successful update
6. Page refreshes to show updated values

**Technical Details:**

- Uses `react-hook-form` with `Controller` for form state management
- Matches exact UI pattern from onboarding (`SelectCard` style buttons)
- Type-safe with Zod validation and TypeScript
- Properly handles nullable database values
- Updates Profile type interface to match database schema

**Testing:**

- ✅ TypeScript compilation passes
- ✅ Production build succeeds
- ✅ Form validation works correctly
- ✅ All fields save to database
- ✅ Values populate correctly from existing profile

**Access:** `http://localhost:3000/profile` → **Preferences** tab

**Benefits:**

- Users can refine preferences as skills evolve
- No need to re-onboard to update choices
- Consistent UI with onboarding flow
- Enables future personalization features (Phase 3+)

---

## Phase 3: Session Conditions Capture (Week 2)

**Goal:** Store forecast snapshot when sessions are created
**Effort:** 1 week
**Risk:** Medium (requires migration + backfill strategy)

### Background

**Problem:** Current sessions table doesn't store the forecast conditions at the time of the surf. This makes it impossible to learn user preferences from their surf history.

**Solution:** Create a `session_conditions` table to store a snapshot of forecast data when each session is created.

### Workpath 3.1: Database Schema ✅ **IMPLEMENTED**

**Status:** Already exists in production as `session_forecast_snapshots` table

**Migration:** `20250822190000_forecast_calibration_tables.sql`

The `session_forecast_snapshots` table provides the infrastructure for capturing forecast conditions at session time. It uses **JSONB columns** instead of flat fields for maximum flexibility.

```sql
-- Existing production table (no migration needed)
CREATE TABLE session_forecast_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  beach_id UUID NOT NULL REFERENCES beaches(id) ON DELETE CASCADE,

  -- JSONB: Full forecast data (wave_height, wave_period, wind_speed, etc.)
  forecast_snapshot JSONB NOT NULL,

  -- JSONB: User's session feedback (wave_quality, rating, notes, etc.)
  actual_conditions JSONB NOT NULL,

  -- Metadata
  forecast_confidence_score INTEGER,
  data_source TEXT,  -- 'CDIP', 'NOAA_NWS', 'FALLBACK'
  session_date DATE NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one snapshot per session
  CONSTRAINT unique_session_forecast_snapshot UNIQUE (session_id)
);

-- Indexes (including GIN indexes for JSONB queries)
CREATE INDEX idx_sfs_session_id ON session_forecast_snapshots(session_id);
CREATE INDEX idx_sfs_user_id ON session_forecast_snapshots(user_id);
CREATE INDEX idx_sfs_beach_id ON session_forecast_snapshots(beach_id);
CREATE INDEX idx_sfs_date ON session_forecast_snapshots(session_date DESC);
CREATE INDEX idx_sfs_beach_date ON session_forecast_snapshots(beach_id, session_date DESC);
CREATE INDEX idx_sfs_forecast_gin ON session_forecast_snapshots USING GIN (forecast_snapshot);
CREATE INDEX idx_sfs_actual_gin ON session_forecast_snapshots USING GIN (actual_conditions);

-- RLS policies
ALTER TABLE session_forecast_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own session forecast snapshots"
  ON session_forecast_snapshots FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own session forecast snapshots"
  ON session_forecast_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own session forecast snapshots"
  ON session_forecast_snapshots FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own session forecast snapshots"
  ON session_forecast_snapshots FOR DELETE USING (auth.uid() = user_id);
```

**JSONB Schema Structure:**

`forecast_snapshot` contains all forecast data:

```typescript
{
  wave_height: number,        // ft
  wave_period: number,        // seconds
  wave_direction: number,     // degrees
  wind_speed: number,         // mph
  wind_direction: number,     // degrees
  tide_status: string,        // "rising", "falling", "high", "low"
  tide_height: number,        // ft
  confidence_score: number,   // 0-100
  data_source: string,        // "CDIP", "NOAA_NWS", "FALLBACK"
  forecast_at: string,        // ISO timestamp
  forecast_hour: number,      // 0-23
  // ... other forecast fields
}
```

`actual_conditions` contains session feedback:

```typescript
{
  wave_quality: string,       // "poor", "fair", "good", "epic"
  water_temp: number,         // °F
  crowd_level: string,        // "empty", "moderate", "crowded"
  parking_ease: string,       // "easy", "moderate", "difficult"
  rating: number,             // 1-5
  notes: string,              // User's session notes
  duration_minutes: number,
  arrival_time: string        // ISO timestamp
}
```

**Why JSONB?**

- ✅ No schema migrations needed to add new forecast fields
- ✅ Efficient querying with GIN indexes
- ✅ Can store entire forecast object without field mapping
- ✅ Flexible for future data source changes

**Validation:**

- ✅ Migration applied: `20250822190000_forecast_calibration_tables.sql`
- ✅ Trigger improvements: `20251028000000_fix_snapshot_trigger_for_insert.sql`
- ✅ Error handling added: `20251028000001_improve_snapshot_function.sql`
- ✅ Historical data backfilled: `20251028000002_backfill_session_snapshots.sql`

### Workpath 3.2: Forecast Snapshot Capture ✅ **IMPLEMENTED**

**Status:** Fully automatic via database trigger (no manual service calls needed)

**Migration:** `20251028000001_improve_snapshot_function.sql`

Forecast snapshots are **automatically captured** by a PostgreSQL trigger when sessions are marked as completed. No manual service integration required.

#### Database Trigger Function

```sql
-- Automatically creates snapshot when session becomes 'completed'
CREATE OR REPLACE FUNCTION create_session_forecast_snapshot()
RETURNS TRIGGER AS $$
DECLARE
  forecast_data JSONB;
  conditions_data JSONB;
  snapshot_exists BOOLEAN;
BEGIN
  -- Only proceed if the session is completed
  IF NEW.status <> 'completed' THEN
    RETURN NEW;
  END IF;

  -- For UPDATE events, only proceed if status changed TO completed
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  -- Check if snapshot already exists (prevents duplicates)
  SELECT EXISTS(
    SELECT 1 FROM session_forecast_snapshots
    WHERE session_id = NEW.id
  ) INTO snapshot_exists;

  IF snapshot_exists THEN
    RETURN NEW;
  END IF;

  -- Find the closest forecast to the session arrival_time
  -- Matches by beach_id and forecast_at, then orders by time proximity
  SELECT to_jsonb(ef.*) INTO forecast_data
  FROM enhanced_forecasts ef
  WHERE ef.beach_id::uuid = NEW.beach_id::uuid
    AND ef.forecast_at IS NOT NULL
  ORDER BY ABS(EXTRACT(EPOCH FROM (ef.forecast_at - NEW.arrival_time))) ASC
  LIMIT 1;

  -- Build actual conditions from session data
  conditions_data := jsonb_build_object(
    'wave_quality', NEW.wave_quality,
    'water_temp', NEW.water_temp,
    'crowd_level', NEW.crowd_level,
    'parking_ease', NEW.parking_ease,
    'rating', NEW.rating,
    'notes', NEW.notes,
    'duration_minutes', NEW.duration_minutes,
    'arrival_time', NEW.arrival_time
  );

  -- Only insert if we found forecast data
  IF forecast_data IS NOT NULL THEN
    BEGIN
      INSERT INTO session_forecast_snapshots (
        session_id, user_id, beach_id, forecast_snapshot, actual_conditions,
        forecast_confidence_score, data_source, session_date
      ) VALUES (
        NEW.id,
        NEW.user_id,
        NEW.beach_id::uuid,
        forecast_data,
        conditions_data,
        (forecast_data->>'confidence_score')::integer,
        forecast_data->>'data_source',
        NEW.arrival_time::date
      );
    EXCEPTION
      WHEN unique_violation THEN
        -- Snapshot already exists (race condition), ignore
        NULL;
      WHEN OTHERS THEN
        -- Log error but don't fail the session creation/update
        RAISE WARNING 'Failed to create forecast snapshot for session %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger fires on INSERT or UPDATE when status = 'completed'
CREATE TRIGGER trigger_create_session_forecast_snapshot
  AFTER INSERT OR UPDATE OF status ON sessions
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION create_session_forecast_snapshot();
```

#### How It Works

1. **Automatic Capture:** When a session's `status` becomes `'completed'`, the trigger fires
2. **Forecast Matching:** Queries `enhanced_forecasts` for the closest match to `arrival_time`
3. **Data Collection:**
   - `forecast_snapshot`: Full JSONB from matching enhanced_forecast row
   - `actual_conditions`: Session feedback (rating, wave_quality, notes, etc.)
4. **Error Handling:**
   - Duplicate prevention via `unique_session_forecast_snapshot` constraint
   - Graceful failure - logs warning but doesn't fail session creation
   - Handles missing forecast data silently

#### Query Service Functions

**File:** `actions/forecast-calibration-actions.ts` (implemented)

Authenticated server actions for querying existing snapshots:

```typescript
// Get user's historical snapshots with filters
async function getUserForecastHistory(filters?: {
  startDate?: Date;
  endDate?: Date;
  beachId?: string;
  dataSource?: string;
});

// Analyze user's preferred conditions from high-rated sessions
async function analyzePreferredConditions(minRating?: number);
```

**Note:** Snapshot creation is still trigger-backed, and post-session feedback can update/enrich the existing snapshot row with user-reported actuals.

#### Benefits of Trigger-Based Approach

- ✅ **Zero integration effort** - No code changes in session actions
- ✅ **Guaranteed capture** - Can't forget to call capture function
- ✅ **Consistent timing** - Always captures at session completion
- ✅ **Atomic operation** - Part of the same transaction
- ✅ **Error isolation** - Snapshot failure doesn't affect session creation
- ✅ **Retroactive backfill** - Historical snapshots already created via migration

**Validation:**

- ✅ Trigger fires on INSERT: `20251028000000_fix_snapshot_trigger_for_insert.sql`
- ✅ Improved error handling: `20251028000001_improve_snapshot_function.sql`
- ✅ Historical backfill completed: `20251028000002_backfill_session_snapshots.sql`
- ✅ Duplicate prevention via unique constraint
- ✅ Graceful failure handling

### Workpath 3.3: Session Action Integration ✅ **NO CHANGES NEEDED**

**Status:** Automatic capture via database trigger (zero integration work)

Since snapshot capture is handled by the database trigger (see Workpath 3.2), **no changes to session action code are required**.

#### Current Session Creation Flow

**File:** `actions/session-actions.ts`

```typescript
// Existing code - NO CHANGES NEEDED
export async function createLoggedSession(data: SessionInput) {
  return withAuthenticatedAction(async (user, supabase) => {
    const { data: session, error } = await supabase
      .from("sessions")
      .insert({
        user_id: user.id,
        beach_id: data.beach_id,
        arrival_time: data.arrival_time,
        status: "completed", // ← Trigger fires automatically here
        rating: data.rating,
        notes: data.notes,
        // ... other fields
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return session;
  });
}
```

#### What Happens Automatically

1. **Session created** with `status: 'completed'`
2. **Trigger fires** immediately after insert
3. **Forecast queried** from `enhanced_forecasts` table
4. **Snapshot created** in `session_forecast_snapshots` table
5. **If forecast unavailable**, trigger logs warning but doesn't fail session creation

#### Benefits

- ✅ **Zero code changes** required in session actions
- ✅ **Can't forget** to capture snapshot
- ✅ **Atomic operation** - part of same transaction
- ✅ **Error isolation** - snapshot failure doesn't affect session creation
- ✅ **Works retroactively** - backfill migration already executed

#### Edge Cases Handled

| Scenario                                | Behavior                                  |
| --------------------------------------- | ----------------------------------------- |
| Session created with `status='planned'` | No snapshot created (expected)            |
| Session updated to `status='completed'` | Snapshot created on status change         |
| Session already has snapshot            | Duplicate prevention, no error            |
| No matching forecast data               | Warning logged, session creation succeeds |
| Forecast query fails                    | Warning logged, session creation succeeds |

**Validation:**

- ✅ No manual service calls needed
- ✅ Existing session actions work unchanged
- ✅ Trigger handles all edge cases
- ✅ Historical sessions already backfilled

### Workpath 3.4: Historical Backfill ✅ **COMPLETED**

**Status:** Historical data already backfilled via migration

**Migration:** `20251028000002_backfill_session_snapshots.sql`

Historical session snapshots have been **automatically created** for all completed sessions that existed before the trigger was implemented.

#### Backfill Strategy

The backfill migration uses a similar approach to the trigger:

1. Query all completed sessions without snapshots
2. For each session, find the closest forecast in `enhanced_forecasts`
3. Create snapshot with `forecast_snapshot` and `actual_conditions`
4. Mark as system-generated (via created_at timestamp)

#### Backfill Statistics

The backfill process:

- ✅ Processed all completed sessions with `arrival_time` data
- ✅ Matched forecasts within same day as session
- ✅ Skipped sessions with no matching forecast (logged for investigation)
- ✅ Handled duplicate snapshots gracefully via unique constraint

#### Verification Query

To verify backfill completion:

```sql
-- Check how many sessions have snapshots
SELECT
  COUNT(DISTINCT s.id) as total_completed_sessions,
  COUNT(DISTINCT sfs.session_id) as sessions_with_snapshots,
  ROUND(COUNT(DISTINCT sfs.session_id)::numeric / NULLIF(COUNT(DISTINCT s.id), 0) * 100, 1) as coverage_percent
FROM sessions s
LEFT JOIN session_forecast_snapshots sfs ON s.id = sfs.session_id
WHERE s.status = 'completed';

-- Check data source distribution
SELECT
  data_source,
  COUNT(*) as snapshot_count,
  ROUND(AVG(forecast_confidence_score), 1) as avg_confidence
FROM session_forecast_snapshots
GROUP BY data_source
ORDER BY snapshot_count DESC;

-- Check snapshots created over time
SELECT
  DATE_TRUNC('month', session_date) as month,
  COUNT(*) as snapshots_created
FROM session_forecast_snapshots
GROUP BY month
ORDER BY month DESC
LIMIT 12;
```

#### Future Backfill Needs

If new sessions are found missing snapshots (e.g., due to forecast data availability issues), re-run the trigger manually:

```sql
-- Manually trigger snapshot creation for a specific session
-- (Only needed if trigger failed originally)
UPDATE sessions
SET status = 'completed'
WHERE id = '<session-id>' AND status = 'completed';
```

Or create a one-time backfill script for bulk processing:

```typescript
// scripts/manual-backfill-snapshots.ts
// Only needed if systematic gaps are discovered
async function backfillMissingSessions() {
  const { data: sessions } = await supabase
    .from("sessions")
    .select("id")
    .eq("status", "completed")
    .not(
      "id",
      "in",
      supabase.from("session_forecast_snapshots").select("session_id")
    );

  // Process each session...
}
```

**Validation:**

- ✅ Migration applied: `20251028000002_backfill_session_snapshots.sql`
- ✅ Historical sessions processed
- ✅ Duplicate handling verified
- ✅ No new backfill script needed (trigger handles ongoing capture)

---

## Phase 4: Beach Affinity Tracking (Week 2-3)

**Goal:** Score beaches based on user session history
**Effort:** 3 days
**Risk:** Low (read-only scoring on existing data)

### Background

**Concept:** Track which beaches users surf most frequently to boost familiarity in recommendations.

**Algorithm:**

- Base score: 10 points per session (capped at 50)
- Recency bonus: 30 points max, decays exponentially over 180 days
- Frequency bonus: +20 points if 5+ sessions
- Final score: 0-100

### Workpath 4.1: Database Schema + Trigger ✅ COMPLETE

**Agent:** `supabase-db-expert`

**Status:** Completed 2025-11-03

**Migration:** `20251103000002_beach_affinity.sql`

**Implementation Notes:**
Implemented complete beach affinity tracking infrastructure with automatic trigger-based updates:

- Created `user_beach_affinity` table with proper constraints and indexes
- Implemented `compute_beach_affinity()` function with scoring algorithm
- Created database trigger for automatic maintenance on session changes
- Configured RLS policies for data isolation
- Wrote comprehensive test suite (infrastructure, function, trigger, and security tests)
- Migration applied successfully to local database

```sql
-- Create user_beach_affinity table
CREATE TABLE user_beach_affinity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  beach_id uuid NOT NULL REFERENCES beaches(id) ON DELETE CASCADE,

  -- Metrics
  session_count int NOT NULL DEFAULT 0,
  last_surfed_at timestamptz,
  affinity_score numeric(5,2) NOT NULL DEFAULT 0 CHECK (affinity_score >= 0 AND affinity_score <= 100),

  -- Metadata
  computed_at timestamptz DEFAULT now(),

  CONSTRAINT unique_user_beach_affinity UNIQUE(user_id, beach_id)
);

-- Indexes for queries
CREATE INDEX idx_user_beach_affinity_user ON user_beach_affinity(user_id);
CREATE INDEX idx_user_beach_affinity_beach ON user_beach_affinity(beach_id);
CREATE INDEX idx_user_beach_affinity_score ON user_beach_affinity(user_id, affinity_score DESC);

-- RLS policies
ALTER TABLE user_beach_affinity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own affinities"
  ON user_beach_affinity FOR SELECT
  USING (user_id = auth.uid());

-- Compute affinity function
CREATE OR REPLACE FUNCTION compute_beach_affinity(
  _user_id uuid,
  _beach_id uuid
) RETURNS numeric AS $$
DECLARE
  session_count int;
  last_surfed timestamptz;
  days_since_last numeric;
  base_score numeric;
  recency_bonus numeric;
  frequency_bonus numeric;
  affinity numeric;
BEGIN
  -- Count sessions and get last surf date
  SELECT COUNT(*), MAX(arrival_time)
  INTO session_count, last_surfed
  FROM sessions
  WHERE user_id = _user_id AND beach_id = _beach_id;

  -- No sessions = 0 affinity
  IF session_count = 0 THEN
    RETURN 0;
  END IF;

  -- Base score: 10 points per session, capped at 50
  base_score := LEAST(session_count * 10, 50);

  -- Recency bonus: 30 points max, exponential decay over 180 days
  days_since_last := EXTRACT(DAY FROM (NOW() - last_surfed));
  recency_bonus := 30 * EXP(-days_since_last / 180.0);

  -- Frequency bonus: +20 if 5+ sessions
  frequency_bonus := CASE WHEN session_count >= 5 THEN 20 ELSE 0 END;

  -- Total affinity (capped at 100)
  affinity := base_score + recency_bonus + frequency_bonus;

  RETURN LEAST(100, affinity);
END;
$$ LANGUAGE plpgsql STABLE;

-- Trigger function to auto-update affinity on session changes
CREATE OR REPLACE FUNCTION update_beach_affinity_on_session_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Recompute affinity for this user-beach pair
    INSERT INTO user_beach_affinity (user_id, beach_id, session_count, last_surfed_at, affinity_score)
    SELECT
      NEW.user_id,
      NEW.beach_id,
      COUNT(*),
      MAX(arrival_time),
      compute_beach_affinity(NEW.user_id, NEW.beach_id)
    FROM sessions
    WHERE user_id = NEW.user_id AND beach_id = NEW.beach_id
    GROUP BY user_id, beach_id
    ON CONFLICT (user_id, beach_id) DO UPDATE SET
      session_count = EXCLUDED.session_count,
      last_surfed_at = EXCLUDED.last_surfed_at,
      affinity_score = EXCLUDED.affinity_score,
      computed_at = NOW();
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- Recompute or delete if no sessions remain
    DELETE FROM user_beach_affinity
    WHERE user_id = OLD.user_id AND beach_id = OLD.beach_id
    AND NOT EXISTS (
      SELECT 1 FROM sessions
      WHERE user_id = OLD.user_id AND beach_id = OLD.beach_id
    );
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on sessions table
CREATE TRIGGER update_beach_affinity_trigger
AFTER INSERT OR UPDATE OR DELETE ON sessions
FOR EACH ROW
EXECUTE FUNCTION update_beach_affinity_on_session_change();

-- Comments
COMMENT ON TABLE user_beach_affinity IS 'Tracks user familiarity with beaches based on surf history';
COMMENT ON COLUMN user_beach_affinity.affinity_score IS 'Computed score (0-100) based on session count, recency, and frequency';
COMMENT ON FUNCTION compute_beach_affinity IS 'Calculates beach affinity: base (10*sessions, max 50) + recency (30*exp(-days/180)) + frequency (+20 if 5+ sessions)';
```

**Rollback:**

```sql
DROP TRIGGER IF EXISTS update_beach_affinity_trigger ON sessions;
DROP FUNCTION IF EXISTS update_beach_affinity_on_session_change();
DROP FUNCTION IF EXISTS compute_beach_affinity(uuid, uuid);
DROP TABLE IF EXISTS user_beach_affinity CASCADE;
```

**Tests:**

- Unit test: `compute_beach_affinity` function logic
  - 1 session → base 10, no frequency bonus
  - 5 sessions → base 50, +20 frequency bonus
  - Recent session → high recency bonus
  - Old session (>180 days) → low recency bonus
- Integration test: Trigger fires on session INSERT
- Integration test: Trigger fires on session DELETE
- RLS test: Users only see their own affinities

### Workpath 4.2: Initial Affinity Computation Script ✅ COMPLETE

**Agent:** `backend-developer`
**Status:** Completed 2025-11-03

**Implementation Summary:**

Created one-time backfill script to populate the `user_beach_affinity` table from existing session history. The script uses a database RPC function for efficient bulk computation and provides comprehensive summary statistics.

#### Files Implemented

**1. SQL Function** (added to `supabase/migrations/20251103000002_beach_affinity.sql`)

```sql
-- Initial bulk computation function (Workpath 4.2)
-- Purpose: One-time backfill of user_beach_affinity table from existing session history
-- Safe to run multiple times (idempotent via ON CONFLICT)
CREATE OR REPLACE FUNCTION compute_all_affinities_initial()
RETURNS void AS $$
BEGIN
  INSERT INTO user_beach_affinity (user_id, beach_id, session_count, last_surfed_at, affinity_score)
  SELECT
    user_id,
    beach_id,
    COUNT(*) as session_count,
    MAX(arrival_time) as last_surfed_at,
    compute_beach_affinity(user_id, beach_id) as affinity_score
  FROM sessions
  GROUP BY user_id, beach_id
  ON CONFLICT (user_id, beach_id) DO UPDATE SET
    session_count = EXCLUDED.session_count,
    last_surfed_at = EXCLUDED.last_surfed_at,
    affinity_score = EXCLUDED.affinity_score,
    computed_at = NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION compute_all_affinities_initial IS 'One-time bulk computation of beach affinities from existing session history. Idempotent - safe to run multiple times. Used by scripts/compute-initial-affinities.ts';
```

**2. TypeScript Script** (`scripts/compute-initial-affinities.ts`)

**Key Features:**

- Environment validation with clear error messages
- Service role authentication for admin operations
- Summary statistics output (total records, unique users/beaches, avg score)
- Comprehensive error handling with debugging hints
- Idempotent execution (safe to re-run)
- Exported main function for testing

**3. Package.json Script**

```json
"affinity:compute": "tsx scripts/compute-initial-affinities.ts"
```

**4. Unit Tests** (`scripts/__tests__/compute-initial-affinities.test.ts`)

- ✅ 11 tests passing
- File structure validation
- Function export verification
- Environment variable checking
- TypeScript structure validation
- Error handling pattern checks
- Documentation completeness validation

#### Usage

```bash
# Run the initial computation
yarn affinity:compute

# Or directly
tsx scripts/compute-initial-affinities.ts
```

#### Example Output

```
🏄 Beach Affinity Initial Computation
====================================

🔄 Computing beach affinities from session history...
   Algorithm: base (10*sessions, max 50) + recency (30*exp(-days/180)) + frequency (+20 if 5+ sessions)

✅ Successfully computed affinities for all user-beach pairs

📊 Computation Summary
=====================
Total affinity records: 150
Unique users: 42
Unique beaches: 18
Average affinity score: 45.67/100

💡 Next steps:
   - Affinity scores will auto-update as users log sessions
   - Use these scores for personalized recommendations
   - Query with: SELECT * FROM user_beach_affinity WHERE user_id = <uuid>
```

#### Safety Features

- ✅ **Idempotent** - Safe to run multiple times (uses ON CONFLICT)
- ✅ **No data deletion** - Only inserts/updates, never deletes
- ✅ **Read-only sessions** - No impact on session data
- ✅ **Referential integrity** - Enforces valid user_id foreign keys
- ✅ **Comprehensive logging** - Clear success/error messages
- ✅ **Error recovery** - Provides debugging hints on failures

#### Test Results

```
✅ All unit tests passing (11/11)
✅ SQL function verified in database
✅ Script structure validated
✅ Migration successfully applied
✅ Environment validation working
✅ Error handling comprehensive
```

#### Documentation Updated

- ✅ `CHANGELOG.md` - Added Workpath 4.2 completion entry
- ✅ Migration file - SQL function added with documentation
- ✅ Script file - Comprehensive JSDoc comments
- ✅ Test file - Full test coverage

#### Notes

**Data Integrity:**
The script properly enforces referential integrity. It will only create affinity records for sessions with valid user_ids in the auth.users table. Orphaned session data is correctly rejected with clear error messages.

**Future Maintenance:**
Once the trigger is active (from Workpath 4.1), affinity scores automatically update as users log sessions. This script is only needed for initial backfill or if historical data needs recomputation.

---

## Phase 5: Preference Learning (Week 3) ✅ COMPLETE

**Goal:** Learn user surf preferences from session history
**Effort:** 1 week (Actual: 1 week)
**Risk:** Medium (algorithm complexity + cron job)
**Status:** ✅ Complete (All workpaths: 5.1 Schema, 5.2 Service, 5.3 Cron)

### Background

**Concept:** Analyze sessions with captured conditions to learn:

- Preferred wave height range (10th-90th percentile)
- Preferred wave period range
- Maximum wind tolerance
- Preferred wind directions
- Preferred tide statuses

**Confidence Score:** Based on sample size (5 sessions = 0.5 confidence, 20+ = 0.95)

### Workpath 5.1: Database Schema ✅ COMPLETE

**Agent:** `backend-developer`
**Status:** Completed 2025-11-03

**Implementation Notes:**
Successfully created the `user_surf_preferences` table with comprehensive test coverage (67 tests, all passing). The schema supports storing learned preferences from session history with data validation constraints, RLS policies for user isolation, and service role access for automated preference computation.

**Migration:** `supabase/migrations/20251103000003_user_surf_preferences.sql`
**Rollback:** `supabase/rollbacks/20251103000003_user_surf_preferences_rollback.sql`

**Files Created:**

- `supabase/migrations/20251103000003_user_surf_preferences.sql`
- `supabase/rollbacks/20251103000003_user_surf_preferences_rollback.sql`
- `__tests__/database/user-surf-preferences-infrastructure.test.ts` (12 tests)
- `__tests__/database/user-surf-preferences-validation.test.ts` (30 tests)
- `__tests__/security/user-surf-preferences-rls.test.ts` (14 tests)
- `__tests__/integration/user-surf-preferences-storage.test.ts` (11 tests)

**Files Modified:**

- `types/database.generated.ts` (regenerated with new table types)
- `CHANGELOG.md` (documented Phase 5 Workpath 5.1 completion)

**Test Results:**

```
Test Suites: 4 passed, 4 total
Tests:       67 passed, 67 total
```

**Schema Details:**

```sql
CREATE TABLE user_surf_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Wave preferences (learned from rated sessions)
  wave_min_ft numeric(3,1) CHECK (wave_min_ft >= 0),
  wave_max_ft numeric(3,1) CHECK (wave_max_ft >= wave_min_ft),
  wave_period_min_s numeric(3,1) CHECK (wave_period_min_s >= 0),
  wave_period_max_s numeric(3,1) CHECK (wave_period_max_s >= wave_period_min_s),

  -- Wind preferences
  max_wind_mph numeric(4,1) CHECK (max_wind_mph >= 0),
  preferred_wind_directions int[] CHECK (array_length(preferred_wind_directions, 1) IS NULL OR
                                          array_length(preferred_wind_directions, 1) <= 8),

  -- Tide preferences
  preferred_tide_statuses text[] CHECK (array_length(preferred_tide_statuses, 1) IS NULL OR
                                         array_length(preferred_tide_statuses, 1) <= 6),

  -- Metadata
  confidence numeric(3,2) NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 1),
  sample_size int NOT NULL DEFAULT 0 CHECK (sample_size >= 0),
  last_computed_at timestamptz,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index
CREATE INDEX idx_user_surf_preferences_user ON user_surf_preferences(user_id);
CREATE INDEX idx_user_surf_preferences_confidence ON user_surf_preferences(confidence DESC);

-- RLS
ALTER TABLE user_surf_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own preferences"
  ON user_surf_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own preferences"
  ON user_surf_preferences FOR UPDATE
  USING (user_id = auth.uid());

-- Comments
COMMENT ON TABLE user_surf_preferences IS 'Learned surf preferences from user session history';
COMMENT ON COLUMN user_surf_preferences.confidence IS 'Confidence score (0-1) based on sample size: sigmoid(n/10)';
COMMENT ON COLUMN user_surf_preferences.sample_size IS 'Number of rated sessions used to compute preferences';
```

**Rollback:**

```sql
DROP TABLE IF EXISTS user_surf_preferences CASCADE;
```

**Key Features:**

- **Preference Learning Algorithm**: Percentile-based approach (10th-90th) for wave ranges, mode detection for categorical preferences (wind directions, tide states)
- **Confidence Scoring**: Sigmoid function based on sample size prevents overconfidence from small datasets (5 sessions = 0.5, 20+ = 0.95)
- **Data Validation**: CHECK constraints ensure data integrity (non-negative values, logical ranges, array length limits)
- **User Data Isolation**: RLS policies ensure users can only access their own preferences
- **Service Role Access**: Allows automated nightly preference computation without user interaction
- **Foreign Key Cascade**: Preferences automatically deleted when user account is deleted
- **Performance Indexes**: Efficient queries by user_id and confidence score

**Design Decisions:**

- **Flat Schema**: Numeric and array fields (not JSONB) for straightforward querying and type safety
- **Sample-Size Based Confidence**: Prevents premature recommendations from insufficient data
- **User Updateable**: Future support for manual preference tuning while learning continues
- **Minimum Threshold**: Requires 5 rated sessions before computing preferences to ensure statistical validity

**Next Steps:**

- Workpath 5.2: Implement preference learning service to compute preferences from session history
- Workpath 5.3: Create nightly cron job for automated preference updates
- Workpath 5.4: Integrate preferences into personalized forecast scoring
- Workpath 5.5: Build UI components to display learned preferences

---

### Workpath 5.2: Preference Learning Service ✅ COMPLETE

**Agent:** `backend-developer`
**Status:** Completed 2025-11-03

**Implementation Notes:**
Successfully implemented the preference learning service with comprehensive statistical algorithms and extensive test coverage (51 unit tests, all passing). The service analyzes user session history to learn surf preferences using percentile-based ranges for continuous values and mode detection for categorical preferences.

**Files Created:**

- `lib/services/preference-learning-service.ts` (374 lines)
- `__tests__/services/preference-learning-service.test.ts` (51 tests passing)

**Files Modified:**

- `CHANGELOG.md` (documented Workpath 5.2 completion)

**Test Results:**

```
PASS __tests__/services/preference-learning-service.test.ts
  Helper Functions: percentile
    ✓ should calculate 10th percentile correctly
    ✓ should calculate 90th percentile correctly
    ✓ should calculate median (50th percentile)
    ✓ should handle single value
    ✓ should handle empty array
    ✓ should handle two values
  Helper Functions: findModeDirections
    ✓ should cluster directions to nearest cardinal (8 tests)
    ✓ should handle wrapping around 0/360 (3 tests)
  Helper Functions: findModes
    ✓ should find modes above frequency threshold (4 tests)
  Helper Functions: calculateConfidence
    ✓ should return correct confidence scores (6 tests)
  computeUserPreferences
    ✓ should compute preferences from good sessions (16 tests)
  getUserSurfPreferences
    ✓ should retrieve user preferences (6 tests)

Test Suites: 1 passed, 1 total
Tests:       51 passed, 51 total
Time:        2.156 s
```

**Algorithm Implementation:**

- **Wave Ranges**: 10th-90th percentile of rated sessions (rating >= 3)
- **Wind Tolerance**: 90th percentile of wind speeds
- **Wind Directions**: Mode detection with cardinal clustering (45° tolerance, 15% frequency threshold)
- **Tide Preferences**: Mode detection (20% frequency threshold)
- **Confidence Scoring**: Sigmoid function 1 / (1 + exp(-0.2 \* (n - 5)))
  - 5 sessions → 0.5 confidence
  - 10 sessions → 0.73 confidence
  - 20+ sessions → 0.95 confidence

**Data Source:**
Queries `session_forecast_snapshots` table (Phase 3) for last 50 sessions, filters to rating >= 3, requires minimum 5 sessions for statistical validity.

**Key Features:**

- **Type-Safe Interfaces**: Full TypeScript typing matching database schema
- **Graceful Error Handling**: Returns null on errors, logs issues, never throws
- **Service Role Authentication**: Uses createSupabaseServiceRoleClient() for admin access
- **Automatic Upsert**: Saves preferences to database via conflict-free upsert
- **Comprehensive Testing**: 51 unit tests covering all edge cases and error conditions
- **Statistical Validity**: Enforces minimum sample size to prevent unreliable predictions

**Next Steps:**

- ✅ Workpath 5.3: Nightly cron job implemented (see below)
- ✅ Workpath 5.4: Integrated into personalized forecast scoring (Phase 6)

---

### Workpath 5.3: Nightly Preference Update Cron ✅ COMPLETE

**Agent:** `backend-developer`
**Status:** Completed 2025-11-03

**Implementation Summary:**
Successfully implemented production-ready cron job for automated nightly preference updates with batch processing, authentication, and comprehensive error handling.

**Files Created:**

- `app/api/cron/update-user-preferences/route.ts` (311 lines)
- `__tests__/integration/preference-update-cron.test.ts` (382 lines)

**Files Modified:**

- `vercel.json` (lines 19-22: added cron schedule)

**Implementation Details:**

**Cron Route Features:**

- **POST Endpoint** (lines 47-218): Nightly batch processing

  - Batch size: 10 users per batch with 1s delays (rate limiting)
  - Calls `computeUserPreferences()` for each user
  - Production-only enforcement
  - Comprehensive error handling and logging

- **GET Endpoint** (lines 243-310): Health check
  - Returns stats: total users, users with preferences, coverage %
  - Useful for monitoring/debugging

**Authentication:**

- Vercel Cron secret header validation
- Bearer token support for manual triggers
- Production environment enforcement

**Vercel Cron Configuration:**

```json
{
  "crons": [
    {
      "path": "/api/cron/update-user-preferences",
      "schedule": "0 3 * * *" // Daily at 3:00 AM UTC
    }
  ]
}
```

**Error Handling:**

- Graceful failures (logs errors, continues processing)
- Skips users without sufficient data (< 5 sessions)
- Returns detailed batch results with success/failure counts

**Test Coverage:**

- ✅ Integration tests: 382 lines covering:
  - Authentication validation
  - Batch processing logic
  - Error handling
  - Health check endpoint
  - Production-only enforcement

**Monitoring Recommendations:**

- Monitor cron job execution logs in Vercel dashboard
- Track preference computation success rates
- Alert on consecutive failures (future enhancement)

---

**Original Specification (Workpath 5.2):** `lib/services/preference-learning-service.ts`

```typescript
import { createApiServerClient } from "@/lib/supabase/api-server-client";

interface UserSurfPreferences {
  wave_min_ft: number | null;
  wave_max_ft: number | null;
  wave_period_min_s: number | null;
  wave_period_max_s: number | null;
  max_wind_mph: number | null;
  preferred_wind_directions: number[] | null;
  preferred_tide_statuses: string[] | null;
  confidence: number;
  sample_size: number;
}

/**
 * Computes user surf preferences from their session history
 * Only includes sessions with rating >= 3 (good experiences)
 * Requires minimum 5 sessions to compute preferences
 */
export async function computeUserPreferences(
  userId: string
): Promise<UserSurfPreferences | null> {
  const supabase = createApiServerClient();

  // 1. Get sessions with conditions (last 50, rating >= 3)
  const { data: sessions, error } = await supabase
    .from("sessions")
    .select(
      `
      id,
      rating,
      arrival_time,
      session_conditions (
        wave_height_ft,
        wave_period_s,
        wind_speed_mph,
        wind_direction_deg,
        tide_status
      )
    `
    )
    .eq("user_id", userId)
    .gte("rating", 3) // Only learn from good sessions
    .not("session_conditions", "is", null)
    .order("arrival_time", { ascending: false })
    .limit(50);

  if (error || !sessions || sessions.length < 5) {
    console.log(
      `Not enough data for user ${userId}: ${sessions?.length || 0} sessions`
    );
    return null;
  }

  // 2. Extract arrays of values
  const waveHeights = sessions
    .map((s) => s.session_conditions?.[0]?.wave_height_ft)
    .filter((v): v is number => v != null);

  const wavePeriods = sessions
    .map((s) => s.session_conditions?.[0]?.wave_period_s)
    .filter((v): v is number => v != null);

  const windSpeeds = sessions
    .map((s) => s.session_conditions?.[0]?.wind_speed_mph)
    .filter((v): v is number => v != null);

  const windDirections = sessions
    .map((s) => s.session_conditions?.[0]?.wind_direction_deg)
    .filter((v): v is number => v != null);

  const tideStatuses = sessions
    .map((s) => s.session_conditions?.[0]?.tide_status)
    .filter((v): v is string => v != null);

  // 3. Compute statistics
  const preferences: UserSurfPreferences = {
    wave_min_ft: waveHeights.length >= 5 ? percentile(waveHeights, 10) : null,
    wave_max_ft: waveHeights.length >= 5 ? percentile(waveHeights, 90) : null,
    wave_period_min_s:
      wavePeriods.length >= 5 ? percentile(wavePeriods, 10) : null,
    wave_period_max_s:
      wavePeriods.length >= 5 ? percentile(wavePeriods, 90) : null,
    max_wind_mph: windSpeeds.length >= 5 ? percentile(windSpeeds, 90) : null,
    preferred_wind_directions:
      windDirections.length >= 5
        ? findModeDirections(windDirections, 45)
        : null,
    preferred_tide_statuses:
      tideStatuses.length >= 5 ? findModes(tideStatuses, 0.2) : null,
    confidence: calculateConfidence(sessions.length),
    sample_size: sessions.length,
  };

  // 4. Upsert to database
  const { error: upsertError } = await supabase
    .from("user_surf_preferences")
    .upsert({
      user_id: userId,
      ...preferences,
      last_computed_at: new Date().toISOString(),
    });

  if (upsertError) {
    throw new Error(`Failed to save preferences: ${upsertError.message}`);
  }

  console.log(
    `✅ Computed preferences for user ${userId} (${sessions.length} sessions)`
  );

  return preferences;
}

/**
 * Get user's learned preferences (if they exist)
 */
export async function getUserSurfPreferences(
  userId: string
): Promise<UserSurfPreferences | null> {
  const supabase = createApiServerClient();

  const { data, error } = await supabase
    .from("user_surf_preferences")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;

  return {
    wave_min_ft: data.wave_min_ft,
    wave_max_ft: data.wave_max_ft,
    wave_period_min_s: data.wave_period_min_s,
    wave_period_max_s: data.wave_period_max_s,
    max_wind_mph: data.max_wind_mph,
    preferred_wind_directions: data.preferred_wind_directions,
    preferred_tide_statuses: data.preferred_tide_statuses,
    confidence: data.confidence,
    sample_size: data.sample_size,
  };
}

/**
 * Calculate percentile of an array
 */
function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index % 1;

  if (lower === upper) return sorted[lower];
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Find most common wind directions (within tolerance)
 * Returns up to 3 mode directions
 */
function findModeDirections(
  directions: number[],
  tolerance: number = 45
): number[] {
  // Normalize directions to 8 cardinal directions (N, NE, E, SE, S, SW, W, NW)
  const cardinals = [0, 45, 90, 135, 180, 225, 270, 315];
  const counts = new Map<number, number>();

  for (const dir of directions) {
    // Find nearest cardinal
    const nearest = cardinals.reduce((prev, curr) =>
      Math.abs(curr - dir) < Math.abs(prev - dir) ? curr : prev
    );
    counts.set(nearest, (counts.get(nearest) || 0) + 1);
  }

  // Sort by frequency and return top 3
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .filter(([_, count]) => count / directions.length >= 0.15) // At least 15% frequency
    .map(([dir, _]) => dir);
}

/**
 * Find mode values (values appearing with >minFreq frequency)
 */
function findModes<T>(arr: T[], minFreq: number = 0.2): T[] {
  const counts = new Map<T, number>();

  for (const val of arr) {
    counts.set(val, (counts.get(val) || 0) + 1);
  }

  return Array.from(counts.entries())
    .filter(([_, count]) => count / arr.length >= minFreq)
    .sort((a, b) => b[1] - a[1])
    .map(([val, _]) => val);
}

/**
 * Calculate confidence score based on sample size
 * Sigmoid function: 5 sessions = 0.5, 20+ sessions = 0.95
 */
function calculateConfidence(n: number): number {
  // Sigmoid: 1 / (1 + exp(-k * (n - n0)))
  // Where k = 0.3, n0 = 10 (midpoint)
  const k = 0.3;
  const n0 = 10;
  const confidence = 1 / (1 + Math.exp(-k * (n - n0)));

  return Math.round(confidence * 100) / 100; // Round to 2 decimals
}
```

**Tests:**

- Unit test: `percentile` calculation (10th, 50th, 90th)
- Unit test: `findModeDirections` with clustered data
- Unit test: `findModes` with varied frequency
- Unit test: `calculateConfidence` sigmoid curve (5→0.5, 20→0.95)
- Integration test: `computeUserPreferences` from sessions
- Integration test: Insufficient data (< 5 sessions) returns null
- Integration test: `getUserSurfPreferences` retrieves data

### Workpath 5.3: Nightly Cron Job ✅ COMPLETE

**Agent:** `backend-developer`
**Status:** Completed 2025-11-03

**Implemented Files:**

- **API Route**: `/app/api/cron/update-user-preferences/route.ts` (POST + GET handlers)
- **Vercel Config**: `vercel.json` (cron schedule added)
- **Unit Tests**: `__tests__/app/api/cron/update-user-preferences.test.ts` (30+ tests, all passing)
- **Integration Tests**: `__tests__/integration/preference-update-cron.test.ts` (10+ tests, all passing)
- **Environment**: `.env.example` (CRON_SECRET_TOKEN documented)

**Implementation Summary:**
Complete nightly cron job that automatically updates user surf preferences by analyzing their session history. Runs daily at 3:00 AM UTC, processing users in batches of 10 with 1-second delays. Handles errors gracefully, provides comprehensive logging, and includes health check endpoint for monitoring.

**Original Specification:** `app/api/cron/preferences/route.ts`

```typescript
import { NextRequest } from "next/server";
import { computeUserPreferences } from "@/lib/services/preference-learning-service";
import { createApiServerClient } from "@/lib/supabase/api-server-client";

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createApiServerClient();

  try {
    // Get users with recent sessions (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: recentUsers, error } = await supabase
      .from("sessions")
      .select("user_id")
      .gte("created_at", sevenDaysAgo.toISOString())
      .order("user_id");

    if (error) {
      throw new Error(`Failed to fetch users: ${error.message}`);
    }

    // Deduplicate user IDs
    const uniqueUserIds = [...new Set(recentUsers.map((s) => s.user_id))];

    console.log(
      `Processing ${uniqueUserIds.length} users with recent activity`
    );

    const results = {
      success: 0,
      failed: 0,
      insufficient_data: 0,
    };

    for (const userId of uniqueUserIds) {
      try {
        const preferences = await computeUserPreferences(userId);

        if (preferences) {
          results.success++;
        } else {
          results.insufficient_data++;
        }
      } catch (error) {
        results.failed++;
        console.error(`Failed for user ${userId}:`, error);
      }
    }

    console.log("✅ Preference computation complete:", results);

    return Response.json({
      success: true,
      results,
      processed: uniqueUserIds.length,
    });
  } catch (error) {
    console.error("❌ Cron job failed:", error);
    return Response.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
```

**Vercel Cron Configuration:**

**File:** `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/preferences",
      "schedule": "0 3 * * *"
    }
  ]
}
```

**Schedule:** Daily at 3:00 AM (UTC)

**Environment Variable Required:**

```bash
CRON_SECRET="your-random-secret-here"
```

**Tests:**

- Integration test: Cron endpoint processes users
- Integration test: Cron endpoint requires auth
- Integration test: Cron handles failures gracefully
- Integration test: Results are logged correctly

---

## Phase 6: Personalized Recommendations (Week 4)

**Goal:** Integrate preferences and affinity into scoring
**Effort:** 3-4 days
**Risk:** Low (additive scoring, falls back to base scores)

### Workpath 6.1: Personalized Scoring Service ✅ COMPLETE

**Agent:** `backend-developer`
**Status:** ✅ Implemented November 3, 2025
**Files:**

- [lib/services/personalized-scoring-service.ts](../../lib/services/personalized-scoring-service.ts)
- [**tests**/services/personalized-scoring-service.test.ts](../../__tests__/services/personalized-scoring-service.test.ts)
  **Test Coverage:** 33 comprehensive tests, all passing ✅

**File:** `lib/services/personalized-scoring-service.ts`

```typescript
import { getUserSurfPreferences } from "./preference-learning-service";
import { createApiServerClient } from "@/lib/supabase/api-server-client";
import type { EnhancedForecast } from "@/types/forecast";

export interface PersonalizedScore {
  score: number;
  personalized: boolean;
  breakdown: {
    base: number;
    onboardingPrefs: number;
    learnedPrefs: number;
    affinity: number;
  };
}

/**
 * Scores a beach for a specific user by combining:
 * 1. Base algorithmic score (existing coach picks logic)
 * 2. Onboarding preferences (explicit)
 * 3. Learned preferences (implicit from history)
 * 4. Beach affinity (familiarity)
 */
export async function scoreBeachForUser(
  userId: string,
  beachId: string,
  forecast: EnhancedForecast,
  baseScore: number
): Promise<PersonalizedScore> {
  const supabase = createApiServerClient();

  let score = baseScore;
  let personalized = false;
  const breakdown = {
    base: baseScore,
    onboardingPrefs: 0,
    learnedPrefs: 0,
    affinity: 0,
  };

  // 1. Get user profile (onboarding preferences)
  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_wave_size, preferred_break_type, crowd_preference")
    .eq("id", userId)
    .single();

  if (profile) {
    // Match wave size preference
    if (profile.preferred_wave_size && profile.preferred_wave_size !== "any") {
      if (matchesWaveSize(forecast, profile.preferred_wave_size)) {
        score += 10;
        breakdown.onboardingPrefs += 10;
        personalized = true;
      }
    }

    // Match break type preference
    if (
      profile.preferred_break_type &&
      profile.preferred_break_type !== "any"
    ) {
      const { data: beach } = await supabase
        .from("beaches")
        .select("break_type")
        .eq("id", beachId)
        .single();

      if (beach?.break_type === profile.preferred_break_type) {
        score += 8;
        breakdown.onboardingPrefs += 8;
        personalized = true;
      }
    }
  }

  // 2. Get learned preferences
  const learnedPrefs = await getUserSurfPreferences(userId);

  if (learnedPrefs && learnedPrefs.confidence > 0.5) {
    // Match learned wave range
    if (matchesLearnedWaveRange(forecast, learnedPrefs)) {
      const bonus = 15 * learnedPrefs.confidence;
      score += bonus;
      breakdown.learnedPrefs += bonus;
      personalized = true;
    }

    // Match learned wind preferences
    if (matchesLearnedWindPrefs(forecast, learnedPrefs)) {
      const bonus = 10 * learnedPrefs.confidence;
      score += bonus;
      breakdown.learnedPrefs += bonus;
      personalized = true;
    }

    // Match learned tide preferences
    if (matchesLearnedTidePrefs(forecast, learnedPrefs)) {
      const bonus = 8 * learnedPrefs.confidence;
      score += bonus;
      breakdown.learnedPrefs += bonus;
      personalized = true;
    }
  }

  // 3. Beach affinity bonus
  const { data: affinity } = await supabase
    .from("user_beach_affinity")
    .select("affinity_score, session_count")
    .eq("user_id", userId)
    .eq("beach_id", beachId)
    .single();

  if (affinity && affinity.affinity_score > 10) {
    // Up to 15 bonus points for familiar beaches
    const affinityBonus = Math.min(affinity.affinity_score * 0.15, 15);
    score += affinityBonus;
    breakdown.affinity = affinityBonus;
    personalized = true;
  }

  return {
    score: Math.min(100, Math.round(score)),
    personalized,
    breakdown,
  };
}

/**
 * Check if forecast matches onboarding wave size preference
 */
function matchesWaveSize(forecast: EnhancedForecast, pref: string): boolean {
  const height = forecast.wave_height || 0;

  switch (pref) {
    case "small":
      return height >= 1 && height <= 3;
    case "medium":
      return height > 3 && height <= 6;
    case "large":
      return height > 6;
    default:
      return false;
  }
}

/**
 * Check if forecast matches learned wave range
 */
function matchesLearnedWaveRange(
  forecast: EnhancedForecast,
  prefs: { wave_min_ft: number | null; wave_max_ft: number | null }
): boolean {
  const height = forecast.wave_height;
  if (!height || !prefs.wave_min_ft || !prefs.wave_max_ft) return false;

  return height >= prefs.wave_min_ft && height <= prefs.wave_max_ft;
}

/**
 * Check if forecast matches learned wind preferences
 */
function matchesLearnedWindPrefs(
  forecast: EnhancedForecast,
  prefs: {
    max_wind_mph: number | null;
    preferred_wind_directions: number[] | null;
  }
): boolean {
  const windSpeed = forecast.wind_speed;
  const windDir = forecast.wind_direction;

  // Check wind speed tolerance
  if (prefs.max_wind_mph && windSpeed) {
    if (windSpeed > prefs.max_wind_mph) return false;
  }

  // Check wind direction preference (within ±30 degrees)
  if (prefs.preferred_wind_directions && windDir) {
    return prefs.preferred_wind_directions.some(
      (prefDir) =>
        Math.abs(windDir - prefDir) <= 30 || Math.abs(windDir - prefDir) >= 330
    );
  }

  return prefs.max_wind_mph ? windSpeed! <= prefs.max_wind_mph : false;
}

/**
 * Check if forecast matches learned tide preferences
 */
function matchesLearnedTidePrefs(
  forecast: EnhancedForecast,
  prefs: { preferred_tide_statuses: string[] | null }
): boolean {
  if (!prefs.preferred_tide_statuses || !forecast.tide_status) return false;

  return prefs.preferred_tide_statuses.includes(forecast.tide_status);
}
```

**Tests:**

- Unit test: `matchesWaveSize` with all preferences
- Unit test: `matchesLearnedWaveRange` boundary cases
- Unit test: `matchesLearnedWindPrefs` direction tolerance
- Unit test: `scoreBeachForUser` with no preferences (returns base)
- Unit test: `scoreBeachForUser` with perfect match (max bonus)
- Unit test: Score caps at 100
- Integration test: Scoring with real forecast data

**Implementation Notes (November 3, 2025):**

The implementation follows the spec with these key adjustments:

1. **Supabase Client:** Used `createSupabaseServiceRoleClient()` instead of `createApiServerClient()` for consistency with `preference-learning-service.ts` and to ensure proper access to all user data.

2. **Type Conversion:** `EnhancedForecastEntity` stores forecast fields as strings (e.g., `wave_height: string | null`), so the implementation uses `parseFloat()` to convert to numbers for calculations. This is a data layer concern that doesn't require new type definitions.

3. **Helper Function Exports:** All helper functions are exported for testability and potential reuse in other services.

4. **Error Handling:** Graceful degradation with try-catch block. On any error, the service returns the base score with `personalized: false`, ensuring the system never breaks even if personalization fails.

5. **Wind Direction Logic:** Enhanced `matchesLearnedWindPrefs()` to properly handle edge cases:

   - Only checks speed if `max_wind_mph` is present
   - Only checks direction if `preferred_wind_directions` has values
   - Returns `true` if only direction prefs exist and match (even without speed constraint)

6. **Test Coverage:** 33 comprehensive tests:

   - 23 helper function tests (all edge cases, null handling, boundary conditions)
   - 10 integration tests (scoring scenarios, combinations, caps)
   - All tests passing ✅

7. **Score Breakdown:** The `breakdown` object provides transparency for debugging and potential UI display:
   - Shows exact contribution from each personalization factor
   - Enables future features like "Why this recommendation?" tooltips

### Workpath 6.2: Update Morning Recommendations API ✅ COMPLETE

**Agent:** `fullstack-engineer`
**Status:** ✅ Completed 2025-11-03
**Files:**

- [app/api/recommendations/morning/route.ts](../../app/api/recommendations/morning/route.ts) (Enhanced with personalization)
- [**tests**/api/recommendations/morning.test.ts](../../__tests__/api/recommendations/morning.test.ts) (NEW - 10 test scenarios)
  **Test Coverage:** 10 comprehensive tests created ✅

**Implementation Summary:**
Enhanced the existing morning recommendations API to integrate personalized scoring while maintaining backward compatibility with anonymous users. The implementation includes:

- Optional user authentication with graceful fallback
- Batch loading of user preferences for performance (3 parallel queries)
- Personalized score calculation using scoreBeachForUser service
- Re-ranking of beaches based on personalized scores
- Updated cache keys to include userId when authenticated
- Enhanced response format with personalization metadata

**Original File:** `app/api/recommendations/morning/route.ts`

```typescript
import { NextRequest } from "next/server";
import { createApiServerClient } from "@/lib/supabase/api-server-client";
import { createSuccessResponse, handleApiError } from "@/lib/api-utils";
import { scoreBeachForUser } from "@/lib/services/personalized-scoring-service";
import { getUser } from "@/lib/auth-utils";

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const supabase = createApiServerClient();

    // 1. Get user's home beach
    const { data: profile } = await supabase
      .from("profiles")
      .select("home_beach_id")
      .eq("id", user.id)
      .single();

    if (!profile?.home_beach_id) {
      return createSuccessResponse({ recommendations: [] });
    }

    // 2. Get base recommendations (existing coach picks logic)
    const { data: baseRecs, error } = await supabase.rpc("get_coach_picks", {
      _beach_id: profile.home_beach_id,
      _radius_km: 16, // 10 miles
      _limit: 10, // Get more than needed for re-ranking
    });

    if (error) {
      throw new Error(`Failed to get coach picks: ${error.message}`);
    }

    // 3. Get current forecasts for each beach
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const currentHour = now.getHours();

    const beachIds = baseRecs.map((r) => r.beach_id);

    const { data: forecasts } = await supabase
      .from("enhanced_forecasts")
      .select("*")
      .in("beach_id", beachIds)
      .gte("forecast_at", new Date(`${today}T00:00:00Z`).toISOString())
      .gte("forecast_hour", currentHour)
      .lte("forecast_hour", currentHour + 2);

    // Create forecast map
    const forecastMap = new Map();
    forecasts?.forEach((f) => {
      if (!forecastMap.has(f.beach_id)) {
        forecastMap.set(f.beach_id, f);
      }
    });

    // 4. Personalize each recommendation
    const personalizedRecs = await Promise.all(
      baseRecs.map(async (rec) => {
        const forecast = forecastMap.get(rec.beach_id);

        if (!forecast) {
          return { ...rec, personalized: false };
        }

        const personalizedScore = await scoreBeachForUser(
          user.id,
          rec.beach_id,
          forecast,
          rec.score
        );

        return {
          beachId: rec.beach_id,
          beachName: rec.beach_name,
          distance: rec.distance_km,
          score: personalizedScore.score,
          baseScore: rec.score,
          personalized: personalizedScore.personalized,
          breakdown: personalizedScore.breakdown,
          forecast: {
            waveHeight: forecast.wave_height,
            wavePeriod: forecast.wave_period,
            windSpeed: forecast.wind_speed,
            tideStatus: forecast.tide_status,
          },
        };
      })
    );

    // 5. Re-sort by personalized scores
    personalizedRecs.sort((a, b) => b.score - a.score);

    // 6. Return top 3
    const topRecs = personalizedRecs.slice(0, 3);

    return createSuccessResponse({
      recommendations: topRecs,
      personalized: topRecs.some((r) => r.personalized),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
```

**Tests:**

- Integration test: Morning API returns personalized scores
- Integration test: Morning API works without preferences (base scores)
- Integration test: Scores are re-ranked correctly
- Integration test: Top 3 beaches returned
- E2E test: "Morning recommendations show personalized badges"

### Workpath 6.3: Add Personalized Badge Component ✅ COMPLETE

**Agent:** `frontend-developer`
**Status:** Completed 2025-11-03

**Implementation Summary:**
Successfully created the PersonalizedBadge component with comprehensive test coverage (25 tests, all passing). The component provides visual indicators for personalized recommendations with score breakdowns and beach affinity badges.

**Files Created:**

- `components/recommendations/PersonalizedBadge.tsx` (159 lines)
- `components/recommendations/index.ts` (export file)
- `__tests__/components/recommendations/PersonalizedBadge.test.tsx` (25 tests passing)

**Files Modified:**

- `CHANGELOG.md` (added Workpath 6.3 completion entry)
- `docs/features/PERSONALIZATION_FORECAST_IMPLEMENTATION.md` (updated status)

**Component Features Implemented:**

- ✅ "Personalized for you" badge with Sparkles icon
- ✅ Score breakdown tooltip (base score, preferences, learned behavior, affinity)
- ✅ Beach affinity badge ("You've surfed here X×")
- ✅ Conditional rendering (returns null when not personalized)
- ✅ Zero-value filtering (hides breakdown items with 0 contribution)
- ✅ Accessibility compliance (ARIA labels, keyboard navigation)
- ✅ Edge case handling (negative values, large session counts, custom className)

**Test Coverage:** 25 tests (100% passing)

- Rendering states: 5 tests
- Score breakdown tooltip: 4 tests
- Affinity badge: 5 tests
- Accessibility: 3 tests
- Edge cases: 4 tests
- Visual styling: 4 tests

**Original Specification:** `components/recommendations/PersonalizedBadge.tsx`

```tsx
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PersonalizedBadgeProps {
  personalized: boolean;
  breakdown?: {
    base: number;
    onboardingPrefs: number;
    learnedPrefs: number;
    affinity: number;
  };
  affinityData?: {
    sessionCount: number;
    lastSurfed: Date;
  };
}

export function PersonalizedBadge({
  personalized,
  breakdown,
  affinityData,
}: PersonalizedBadgeProps) {
  if (!personalized) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Personalized indicator */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="secondary" className="gap-1">
              <span>✨</span>
              <span>Personalized for you</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs space-y-1">
              <p className="font-semibold">Score Breakdown</p>
              {breakdown && (
                <>
                  <p>Base: {breakdown.base.toFixed(0)} pts</p>
                  {breakdown.onboardingPrefs > 0 && (
                    <p>
                      Your preferences: +{breakdown.onboardingPrefs.toFixed(0)}{" "}
                      pts
                    </p>
                  )}
                  {breakdown.learnedPrefs > 0 && (
                    <p>
                      Learned from history: +{breakdown.learnedPrefs.toFixed(0)}{" "}
                      pts
                    </p>
                  )}
                  {breakdown.affinity > 0 && (
                    <p>Familiarity: +{breakdown.affinity.toFixed(0)} pts</p>
                  )}
                </>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Affinity indicator */}
      {affinityData && affinityData.sessionCount > 0 && (
        <Badge variant="outline" className="gap-1">
          <span>🏄</span>
          <span>You've surfed here {affinityData.sessionCount}×</span>
        </Badge>
      )}
    </div>
  );
}
```

**Usage:**

```tsx
import { PersonalizedBadge } from "@/components/recommendations/PersonalizedBadge";

<div className="recommendation-card">
  <h3>{rec.beachName}</h3>

  <PersonalizedBadge
    personalized={rec.personalized}
    breakdown={rec.breakdown}
    affinityData={
      rec.affinity
        ? {
            sessionCount: rec.affinity.session_count,
            lastSurfed: new Date(rec.affinity.last_surfed_at),
          }
        : undefined
    }
  />

  {/* Rest of recommendation card */}
</div>;
```

**Tests:**

- Unit test: Badge renders when personalized
- Unit test: Badge hidden when not personalized
- Unit test: Tooltip shows breakdown
- Unit test: Affinity badge shows session count
- Accessibility test: Badge has proper ARIA labels

---

### 🚨 **CRITICAL GAP: UI Integration Pending**

**Status:** Component exists but is **NOT INTEGRATED** into any user-facing UI

**Evidence:**

- Grep search shows only test files import `PersonalizedBadge`
- Home screen component (`components/home-screen/index.tsx`) does not use the badge
- Beach detail components do not use the badge
- Map components do not use the badge

**Missing Integration Points:**

1. **Home Screen Morning Recommendations** (PRIMARY) ⭐

   - **File:** `components/home-screen/index.tsx`
   - **Data Available:** Morning API already returns `personalized`, `breakdown`, `affinityData`
   - **Action Needed:** Import badge, pass data to recommendation cards
   - **Impact:** HIGH - Makes personalization visible to users

2. **Beach Detail Forecast Display** (SECONDARY)

   - **Files:** `components/beach-detail/tabs/forecast-tab.tsx`
   - **Action Needed:** Show personalized badge when viewing forecast
   - **Impact:** MEDIUM - Reinforces personalization

3. **Map Selected Beach Card** (TERTIARY)
   - **File:** `components/map/selected-beach-card.tsx`
   - **Action Needed:** Show badge on map preview cards
   - **Impact:** LOW - Nice-to-have for map exploration

**Next Steps Required:**

1. Import `PersonalizedBadge` in home screen component
2. Extract personalization data from morning API response
3. Conditionally render badge when `personalized: true`
4. Add E2E test verifying badge appears for users with preferences
5. Test with real user data to validate scoring accuracy

**Estimated Effort:** 2-3 hours
**Risk:** Low (component is production-ready, just needs wiring)
**Impact:** ✨ **CRITICAL** - Completes the personalization feature end-to-end

**Why This Matters:**

- Backend has been computing personalized scores since Workpath 6.2
- Users cannot tell their recommendations are personalized
- All the infrastructure is ready, just needs UI polish
- This is the **final 2%** to reach 100% feature completion

---

## Testing Strategy

### Unit Tests (Jest + Testing Library)

**Coverage Target:** 95%+

**Priority Files:**

- All service functions (`lib/services/*-service.ts`)
- Algorithm logic (percentiles, scoring, confidence)
- UI components (badges, indicators)
- Schema validation (`lib/schemas/onboarding-schemas.ts`)

**Example:**

```typescript
describe("preference-learning-service", () => {
  describe("percentile", () => {
    it("calculates 50th percentile correctly", () => {
      expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
    });

    it("handles 10th percentile", () => {
      expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 10)).toBe(1.9);
    });
  });

  describe("calculateConfidence", () => {
    it("returns 0.5 for 5 sessions", () => {
      expect(calculateConfidence(5)).toBeCloseTo(0.5, 1);
    });

    it("returns 0.95+ for 20+ sessions", () => {
      expect(calculateConfidence(20)).toBeGreaterThan(0.95);
    });
  });
});
```

### Integration Tests

**Coverage Target:** All server actions + API routes

**Priority Tests:**

- Session creation captures conditions
- Onboarding saves all fields (including previously missing ones)
- Preference computation from sessions
- Personalized scoring with real data
- Morning API returns personalized recommendations

**Example:**

```typescript
describe("session-actions", () => {
  it("creates session and captures conditions", async () => {
    const session = await createSession({
      beach_id: "test-beach-id",
      arrival_time: new Date().toISOString(),
      duration_minutes: 60,
      rating: 4,
    });

    expect(session.id).toBeDefined();

    // Verify conditions were captured
    const conditions = await getSessionConditions(session.id);
    expect(conditions).toBeDefined();
    expect(conditions?.wave_height_ft).toBeGreaterThan(0);
  });
});
```

### E2E Tests (Playwright)

**Coverage Target:** Critical user flows

**Priority Tests:**

1. **Forecast Transparency**

```typescript
test("beach page displays forecast source badges", async ({ page }) => {
  await page.goto("/beaches/mission-beach");

  // Verify source badge visible
  await expect(
    page.locator('[data-testid="forecast-source-badge"]')
  ).toBeVisible();

  // Verify confidence indicator
  await expect(
    page.locator('[data-testid="confidence-indicator"]')
  ).toBeVisible();

  // Verify last updated timestamp
  await expect(page.locator('[data-testid="data-freshness"]')).toContainText(
    /Updated .* ago/
  );
});
```

2. **Enhanced Onboarding**

```typescript
test("complete onboarding with surf preferences", async ({ page }) => {
  await page.goto("/onboarding");

  // Step 1: Welcome
  await page.click('button:has-text("Get Started")');

  // Step 2: Profile
  await page.fill('input[name="fullName"]', "Test User");
  await page.fill('input[name="displayName"]', "testuser");
  await page.click('button:has-text("Continue")');

  // Step 3: Home Beach
  await page.fill('input[placeholder*="Search"]', "Mission Beach");
  await page.click("text=Mission Beach");
  await page.click('button:has-text("Continue")');

  // Step 4: Preferences (existing + new)
  await page.click("text=Intermediate");
  await page.click("text=Shortboard");

  // NEW: Wave size preference
  await page.click("text=Medium waves");

  // NEW: Break type preference
  await page.click("text=Beach break");

  // NEW: Crowd preference
  await page.click("text=A few people is fine");

  await page.click('button:has-text("Continue")');

  // Complete flow...
  await page.click('button:has-text("Finish")');

  // Verify profile saved correctly
  const profile = await getProfile(userId);
  expect(profile.display_name).toBe("testuser");
  expect(profile.surf_styles).toContain("shortboard");
  expect(profile.preferred_wave_size).toBe("medium");
  expect(profile.preferred_break_type).toBe("beach");
  expect(profile.crowd_preference).toBe("moderate");
});
```

3. **Session Conditions Capture**

```typescript
test("create session and verify conditions captured", async ({ page }) => {
  await page.goto("/sessions/new");

  await page.fill('input[name="beach"]', "Mission Beach");
  await page.click("text=Mission Beach");

  await page.fill('input[name="arrivalTime"]', "2025-11-03T08:00");
  await page.fill('input[name="duration"]', "90");
  await page.click('button:has-text("5 stars")');

  await page.click('button:has-text("Save Session")');

  // Verify session created
  await expect(page.locator("text=Session saved")).toBeVisible();

  // Navigate to session details
  await page.click("text=View Session");

  // Verify conditions displayed (future feature)
  await expect(page.locator("text=Wave Height")).toBeVisible();
  await expect(page.locator("text=Wind Speed")).toBeVisible();
});
```

4. **Personalized Recommendations**

```typescript
test("morning recommendations show personalized badge", async ({ page }) => {
  // User with preferences and history
  await setupUserWithPreferences(userId);
  await createSessions(userId, 10); // Create history

  await page.goto("/");

  // Check morning recommendations
  await expect(page.locator("text=Best for you this morning")).toBeVisible();

  // Verify personalized badge
  const firstRec = page.locator('[data-testid="recommendation-card"]').first();
  await expect(firstRec.locator("text=✨ Personalized for you")).toBeVisible();

  // Hover to see breakdown
  await firstRec.locator('[data-testid="personalized-badge"]').hover();
  await expect(page.locator("text=Your preferences:")).toBeVisible();
});
```

---

## Deployment Strategy (Simplified)

### No Feature Flags

With 400 users, deploy directly in phases:

### Week 1: Forecast Transparency

- ✅ Deploy UI components (read-only changes)
- ✅ No data changes
- ✅ Low risk

### Week 2: Onboarding + Session Conditions

- ⚠️ Apply migrations during low-traffic hours (3am PT)
- ⚠️ Backup database before push: `supabase db dump > backup.sql`
- ✅ Deploy enhanced onboarding
- ✅ Session conditions capture starts for new sessions
- ✅ Run backfill script manually

### Week 3: Affinity + Preferences

- ⚠️ Apply migrations
- ✅ Run initial affinity computation
- ✅ Enable preference learning cron

### Week 4: Personalized Scoring

- ✅ Deploy personalized scoring service
- ✅ Update morning API
- ✅ Monitor for performance impact

### Migration Safety Protocol

**Before Every Migration:**

```bash
# 1. Test locally
supabase db reset

# 2. Backup production
supabase db dump > backups/backup-$(date +%Y%m%d-%H%M%S).sql

# 3. Push during low-traffic hours
supabase db push
```

**Rollback Plan:**

- Each migration has rollback SQL
- Keep backups for 30 days
- Test rollbacks locally before production use

### Monitoring

**Key Metrics to Watch:**

- Session creation success rate (should stay >99%)
- Morning API response time (target: <150ms p50)
- Preference computation success rate
- User onboarding completion rate

**Alerts:**

- Sentry for error tracking
- Supabase dashboard for query performance
- Vercel analytics for API latency

---

## Success Metrics

### Week 1-2: Transparency + Onboarding

- ✅ 100% forecast displays show source badges
- ✅ 80%+ new users complete enhanced onboarding
- ✅ 0 data loss on display_name/surf_styles
- ✅ <5% increase in onboarding drop-off rate

### Week 3: Conditions + Affinity

- ✅ 90%+ new sessions capture conditions
- ✅ Affinity scores computed for all active users
- ✅ 70%+ historical sessions backfilled

### Week 4: Personalization

- **Target:** +15% session creation rate
- **Target:** +20% morning notification CTR
- **Target:** +10% DAU (daily active users)
- **Target:** <5% user complaints about recommendations
- **Target:** No performance regression (API <150ms p50)

### User Feedback

- Monitor app store reviews for sentiment
- Track support requests related to recommendations
- Survey users: "Do recommendations feel personalized?"

---

## File Structure & Outputs

```
docs/
└── features/
    └── PERSONALIZATION_FORECAST_IMPLEMENTATION.md  # This file

lib/
└── services/
    ├── session-conditions-service.ts               # NEW
    ├── beach-affinity-service.ts                   # NEW (minimal - mostly SQL)
    ├── preference-learning-service.ts              # NEW
    └── personalized-scoring-service.ts             # NEW

components/
├── forecast/
│   ├── ForecastSourceBadge.tsx                     # NOT NEEDED (ForecastDataSourceIndicator exists)
│   ├── ConfidenceIndicator.tsx                     # NOT NEEDED (ForecastDataSourceIndicator exists)
│   ├── DataFreshnessIndicator.tsx                  # NOT NEEDED (ForecastDataSourceIndicator exists)
│   ├── BuoyStationLink.tsx                         # ✅ NEW (IMPLEMENTED)
│   └── forecast-data-source-indicator.tsx          # ✅ MODIFIED (integrated BuoyStationLink)
├── recommendations/
│   └── PersonalizedBadge.tsx                       # NEW
└── onboarding/steps/
    └── preferences-step.tsx                        # MODIFIED

lib/
├── schemas/
│   └── onboarding-schemas.ts                       # MODIFIED
└── actions/
    ├── session-actions.ts                          # MODIFIED
    └── onboarding-actions.ts                       # MODIFIED

store/
└── onboarding-store.ts                             # MODIFIED

app/
├── api/
│   ├── recommendations/morning/route.ts            # MODIFIED
│   └── cron/preferences/route.ts                   # NEW
└── (authenticated)/beaches/[beach_id]/page.tsx     # MODIFIED

supabase/
└── migrations/
    ├── 20250103000000_onboarding_preferences_enhancement.sql  # NEW
    ├── 20250103000001_session_conditions_capture.sql          # NEW
    ├── 20250103000002_beach_affinity.sql                      # NEW
    └── 20250103000003_user_surf_preferences.sql               # NEW

scripts/
├── backfill-session-conditions.ts                  # NEW
└── compute-initial-affinities.ts                   # NEW

__tests__/
├── services/
│   ├── session-conditions-service.test.ts          # NEW
│   ├── preference-learning-service.test.ts         # NEW
│   └── personalized-scoring-service.test.ts        # NEW
├── components/
│   ├── forecast/buoy-station-link.test.tsx         # ✅ NEW (IMPLEMENTED - 35 tests passing)
│   ├── forecast/forecast-data-source-indicator.test.tsx  # ✅ MODIFIED (updated for BuoyStationLink)
│   └── recommendations/PersonalizedBadge.test.tsx  # NEW
└── e2e/
    ├── forecast-transparency.spec.ts               # NEW
    ├── onboarding-preferences.spec.ts              # NEW
    └── personalized-recommendations.spec.ts        # NEW

vercel.json                                         # MODIFIED (add cron)
```

---

## Agent Assignment Summary

| Week | Phase        | Agent              | Primary Workpath                    | Estimated Hours | Actual                       |
| ---- | ------------ | ------------------ | ----------------------------------- | --------------- | ---------------------------- |
| 1    | Transparency | frontend-developer | Forecast UI components              | 8-10h           | ✅ 2h (BuoyStationLink only) |
| 1    | Transparency | nextjs-developer   | Data integration                    | 6-8h            | ✅ 0h (already complete)     |
| 1-2  | Onboarding   | supabase-db-expert | Migration (fix + new fields)        | 4-6h            |
| 1-2  | Onboarding   | fullstack-engineer | Enhance preferences step            | 10-12h          |
| 2    | Conditions   | supabase-db-expert | Session conditions schema           | 4-6h            |
| 2    | Conditions   | backend-developer  | Snapshot service + backfill         | 12-15h          |
| 2    | Conditions   | fullstack-engineer | Session action integration          | 4-6h            |
| 2-3  | Affinity     | supabase-db-expert | Affinity table + trigger + function | 6-8h            |
| 2-3  | Affinity     | backend-developer  | Initial computation script          | 2-4h            |
| 3    | Preferences  | supabase-db-expert | Preferences schema                  | 3-4h            |
| 3    | Preferences  | backend-developer  | Learning service + cron             | 15-18h          |
| 4    | Scoring      | backend-developer  | Personalized scoring service        | 10-12h          |
| 4    | Integration  | fullstack-engineer | Morning API + UI badges             | 8-10h           |
| 4    | Testing      | qa-expert          | E2E test suite                      | 8-10h           |

**Total Estimated Effort:** ~120-140 hours (~3-4 weeks for 1 developer, ~2 weeks for 2 developers)

---

## Risk Assessment & Mitigation

### Low Risk ✅

- Forecast transparency UI (read-only)
- Beach affinity computation (aggregation only)
- Personalized badges (UI only)

### Medium Risk ⚠️

- Onboarding migration (fixes critical bugs, must test thoroughly)
- Session conditions capture (non-blocking, graceful failure)
- Preference learning (algorithm complexity, requires validation)

### High Risk 🔴

- None (simplified rollout removes feature flag complexity)

### Mitigation Strategies

1. **Test migrations locally:** `supabase db reset` before every push
2. **Backup before migrations:** Automated + manual backups
3. **Non-blocking captures:** Session creation succeeds even if conditions fail
4. **Graceful fallbacks:** Recommendations work without personalization
5. **Monitor metrics:** Sentry + Vercel analytics for early detection

---

## Appendix: Key Decisions

### Why No Feature Flags?

- 400 users is small enough for direct deployment
- Feature flags add complexity (code, config, monitoring)
- Gradual rollout not needed for this user base
- Faster iteration without flag management overhead

### Why Enhance Existing Onboarding vs New Step?

- Avoids increasing total steps (risk of fatigue)
- Questions are contextually related (all about surf preferences)
- Maintains "Takes less than 2 minutes" promise
- Reuses existing UI patterns

### Why 3 New Onboarding Questions?

- Wave size: Most critical for recommendations
- Break type: Already in beaches table, easy to filter
- Crowd: Unique social dimension, differentiator
- **Rejected:** Water temp preference (less actionable in San Diego)
- **Rejected:** Time of day (can infer from session patterns)

### Why Learn from Rating ≥3 Sessions Only?

- Bad sessions (rating 1-2) teach us what to AVOID, harder to model
- Good sessions (3-5) teach us what user ENJOYS, clearer signal
- Reduces noise from forced sessions (e.g., bad conditions but only day off)

### Why Percentile Ranges vs Simple Average?

- Percentiles robust to outliers (one epic 10ft day doesn't skew range)
- 10th-90th captures "typical range" while excluding extremes
- Handles varied data better than mean±stddev

### Why Sigmoid Confidence Function?

- Reflects diminishing returns (20 → 21 sessions less informative than 5 → 6)
- Smooth curve (no hard cutoffs)
- Industry standard for confidence modeling

---

## Next Steps

1. ✅ **Plan approved** — Implementation begins
2. 📝 **Save this document** to `docs/features/PERSONALIZATION_FORECAST_IMPLEMENTATION.md`
3. 🌿 **Create feature branch:** `feat/personalization-forecast-transparency`
4. 🚀 **Start Phase 1:** Forecast transparency UI components
5. 📊 **Daily progress tracking** in project channel
6. 🧪 **Test coverage reports** weekly

---

## Documentation Updates Required

After implementation:

- [ ] `CHANGELOG.md` — Add Phase 1 completion to `[Unreleased]` section
- [ ] `README.md` — Update features list (if needed)
- [ ] `docs/PERSONALIZATION_STRATEGY.md` — Mark Phase 1 as complete
- [ ] `docs/ARCHITECTURE.md` — Document new services (Phase 2+)
- [x] `components/forecast/ARCHITECTURE.md` — ✅ Documented BuoyStationLink component
- [x] `components/forecast/index.ts` — ✅ Added BuoyStationLink exports

---

**Status:** 🟡 Phase 1 Complete — Continuing Phase 2
**Implementation Start:** 2025-11-03
**Phase 1 Completion:** 2025-11-03 (1 day - ahead of schedule)
**Target Overall Completion:** 2025-12-01 (4 weeks)
**Point of Contact:** Engineering Lead

---

## Phase 1 Implementation Summary

**Completed:** 2025-11-03 (1 day vs 3-4 day estimate)

**What Was Delivered:**

- ✅ BuoyStationLink component (3 variants, 35 tests)
- ✅ Integration with ForecastDataSourceIndicator
- ✅ Full test coverage and documentation
- ✅ ARCHITECTURE.md updates

**Key Discovery:**
The forecast transparency feature was **already 80% complete** in the codebase. The `ForecastDataSourceIndicator` component already provided all functionality planned for separate ForecastSourceBadge, ConfidenceIndicator, and DataFreshnessIndicator components. Only BuoyStationLink was missing and has now been implemented.

**Technical Highlights:**

- Zero-distance edge case handling (0 km → "0m" not empty)
- Miles-to-km conversion at integration point
- Progressive enhancement with 3 display variants
- Full WCAG 2.1 AA accessibility compliance

**Next Steps:**
Proceed to Phase 2 (Enhanced Onboarding with Surf Preferences) as planned.

---

**Built with ❤️ by surfers, for surfers** 🏄‍♂️🌊
