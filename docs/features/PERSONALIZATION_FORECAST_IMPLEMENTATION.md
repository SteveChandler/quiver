# Implementation Plan: Personalization Engine & Forecast Transparency

**Version:** 2.0 (Simplified for small user base)
**Timeline:** 4 weeks
**Rollout:** Direct deployment (no feature flags needed)
**Status:** 🟢 Approved - Ready for implementation
**Created:** 2025-11-03

---

## Executive Summary

This plan implements two high-priority growth features to enhance user engagement and trust:

1. **Forecast Transparency** — Expose existing multi-source forecast data with confidence indicators
2. **Personalization Engine** — Learn user preferences and provide tailored recommendations

**Key Innovation:** Integrate surf preference questions into existing onboarding to capture explicit preferences upfront, then refine with learned behavior over time.

**Infrastructure Status:**
- Forecast transparency: 80% complete (data exists, needs UI)
- Personalization: 40% complete (tracking exists, learning missing)

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

## Phase 1: Forecast Transparency (Week 1)

**Goal:** Expose existing forecast source data to users to build trust and differentiate from competitors
**Effort:** 3-4 days
**Risk:** Low (read-only UI changes)

### Background

Quiver already has comprehensive multi-source forecast infrastructure:
- **Sources:** NOAA WaveWatch III, CDIP buoys, NDBC, CO-OPS tides
- **Confidence scoring:** 0-100 based on data sources, freshness, and time ahead
- **Quality validation:** Outlier detection, sensor glitch rejection
- **Storage:** `enhanced_forecasts.raw_forecast` contains full source metadata

**Problem:** This rich metadata is stored but never shown to users.

### Workpath 1.1: UI Components

**Agent:** `frontend-developer`

**Files to create:**
- `components/forecast/ForecastSourceBadge.tsx`
- `components/forecast/ConfidenceIndicator.tsx`
- `components/forecast/DataFreshnessIndicator.tsx`
- `components/forecast/BuoyStationLink.tsx`

#### ForecastSourceBadge.tsx

**Purpose:** Display data source with icon and color coding

**Props:**
```typescript
interface ForecastSourceBadgeProps {
  source: 'CDIP' | 'NOAA_NWS' | 'FALLBACK';
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
- >75: Green dot + "High confidence"
- 50-75: Yellow dot + "Medium confidence"
- <50: Red dot + "Low confidence"
- Click to expand: Show factor breakdown

**Example:**
```tsx
<ConfidenceIndicator
  score={82}
  factors={{
    dataSources: ['CDIP', 'NOAA'],
    hoursAhead: 2,
    hasBuoyData: true
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
  format?: 'relative' | 'absolute';
}
```

**UI Behavior:**
- Use `date-fns` `formatDistanceToNow()`
- <30 min: "Updated just now" (green)
- 30-120 min: "Updated X min ago" (yellow)
- >120 min: "Updated X hours ago" (orange)

**Example:**
```tsx
<DataFreshnessIndicator updatedAt={new Date('2025-11-03T10:45:00Z')} />
// Renders: "Updated 15 minutes ago"
```

#### BuoyStationLink.tsx

**Purpose:** Link to buoy station details with distance

**Props:**
```typescript
interface BuoyStationLinkProps {
  stationId: string;
  stationName: string;
  distance?: number; // km
  beachLocation: { latitude: number; longitude: number };
}
```

**UI Behavior:**
- Display: "CDIP 220 - Scripps Pier (2.3 km)"
- Link to: `/buoys/[stationId]` (future page)
- Show distance if provided

**Tests:**
- Unit tests for each component
- Snapshot tests for visual regression
- Accessibility tests (ARIA labels, keyboard navigation)
- Prop validation tests

### Workpath 1.2: Data Integration

**Agent:** `nextjs-developer`

**Files to modify:**
- `app/(authenticated)/beaches/[beach_id]/page.tsx`
- `app/(authenticated)/map/components/ForecastCard.tsx`
- `lib/actions/forecast-actions.ts`

#### Expose Metadata in Forecast Actions

**File:** `lib/actions/forecast-actions.ts`

**Changes:**
```typescript
export async function getEnhancedForecast(beachId: string, date: Date) {
  return withAuthenticatedAction(async (user, supabase) => {
    const { data: forecast } = await supabase
      .from('enhanced_forecasts')
      .select(`
        *,
        raw_forecast,
        data_source,
        confidence_score,
        updated_at
      `)
      .eq('beach_id', beachId)
      .eq('forecast_date', format(date, 'yyyy-MM-dd'))
      .single();

    // Expose source metadata
    return {
      ...forecast,
      metadata: {
        primarySource: forecast.data_source,
        allSources: forecast.raw_forecast?.data_sources || [],
        confidenceScore: forecast.confidence_score || 50,
        lastUpdated: forecast.updated_at,
        cdipStation: forecast.raw_forecast?.cdip_data?.stationId,
        cdipStationName: forecast.raw_forecast?.cdip_data?.stationName,
      }
    };
  });
}
```

#### Integrate into Beach Page

**File:** `app/(authenticated)/beaches/[beach_id]/page.tsx`

**Changes:**
```tsx
import { ForecastSourceBadge } from '@/components/forecast/ForecastSourceBadge';
import { ConfidenceIndicator } from '@/components/forecast/ConfidenceIndicator';
import { DataFreshnessIndicator } from '@/components/forecast/DataFreshnessIndicator';

export default async function BeachPage({ params }) {
  const forecast = await getEnhancedForecast(params.beach_id, new Date());

  return (
    <div>
      {/* Existing beach content */}

      <div className="forecast-metadata mt-4 flex items-center gap-3">
        <ForecastSourceBadge
          source={forecast.metadata.primarySource}
          confidence={forecast.metadata.confidenceScore}
        />

        <ConfidenceIndicator
          score={forecast.metadata.confidenceScore}
          factors={{
            dataSources: forecast.metadata.allSources,
            hoursAhead: calculateHoursAhead(forecast.forecast_time),
            hasBuoyData: !!forecast.metadata.cdipStation
          }}
        />

        <DataFreshnessIndicator
          updatedAt={new Date(forecast.metadata.lastUpdated)}
        />

        {forecast.metadata.cdipStation && (
          <BuoyStationLink
            stationId={forecast.metadata.cdipStation}
            stationName={forecast.metadata.cdipStationName}
            beachLocation={{
              latitude: beach.latitude,
              longitude: beach.longitude
            }}
          />
        )}
      </div>
    </div>
  );
}
```

**Tests:**
- Integration test: Forecast actions return metadata
- E2E test: "Beach page displays forecast transparency"
- E2E test: "Confidence indicator shows correct color"
- E2E test: "Data freshness updates correctly"

---

## Phase 2: Enhanced Onboarding with Surf Preferences (Week 1-2)

**Goal:** Capture surf preferences during onboarding + fix existing data loss bugs
**Effort:** 1 week
**Risk:** Medium (database migration + critical user flow)

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

### Workpath 2.1: Fix Data Loss + Add New Fields

**Agent:** `supabase-db-expert`

**Migration:** `20250103000000_onboarding_preferences_enhancement.sql`

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

**Tests:**
- Migration test: Apply and rollback successfully
- Constraint test: display_name uniqueness enforced
- Constraint test: Invalid wave_size rejected
- Index test: Indexes created and used in queries

### Workpath 2.2: Update Onboarding Components

**Agent:** `fullstack-engineer`

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
      selected={data.preferredWaveSize === 'small'}
      onClick={() => updateData({ preferredWaveSize: 'small' })}
      icon="🌊"
      title="Small waves"
      description="1-3 ft - Perfect for learning"
    />
    <SelectCard
      selected={data.preferredWaveSize === 'medium'}
      onClick={() => updateData({ preferredWaveSize: 'medium' })}
      icon="🌊🌊"
      title="Medium waves"
      description="3-6 ft - The sweet spot"
    />
    <SelectCard
      selected={data.preferredWaveSize === 'large'}
      onClick={() => updateData({ preferredWaveSize: 'large' })}
      icon="🌊🌊🌊"
      title="Large waves"
      description="6+ ft - For experienced surfers"
    />
    <SelectCard
      selected={data.preferredWaveSize === 'any'}
      onClick={() => updateData({ preferredWaveSize: 'any' })}
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
      selected={data.preferredBreakType === 'beach'}
      onClick={() => updateData({ preferredBreakType: 'beach' })}
      icon="🏖️"
      title="Beach break"
      description="Sandy bottom, forgiving"
    />
    <SelectCard
      selected={data.preferredBreakType === 'point'}
      onClick={() => updateData({ preferredBreakType: 'point' })}
      icon="🪨"
      title="Point break"
      description="Long, consistent rides"
    />
    <SelectCard
      selected={data.preferredBreakType === 'reef'}
      onClick={() => updateData({ preferredBreakType: 'reef' })}
      icon="🪸"
      title="Reef break"
      description="Powerful, hollow waves"
    />
    <SelectCard
      selected={data.preferredBreakType === 'any'}
      onClick={() => updateData({ preferredBreakType: 'any' })}
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
      selected={data.crowdPreference === 'social'}
      onClick={() => updateData({ crowdPreference: 'social' })}
      icon="👥"
      title="Love the crew"
      description="More people, more fun"
    />
    <SelectCard
      selected={data.crowdPreference === 'moderate'}
      onClick={() => updateData({ crowdPreference: 'moderate' })}
      icon="🧘"
      title="A few people is fine"
      description="I can share the lineup"
    />
    <SelectCard
      selected={data.crowdPreference === 'solitude'}
      onClick={() => updateData({ crowdPreference: 'solitude' })}
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
  ℹ️ These preferences are optional. We'll also learn from your surf sessions over time to personalize recommendations.
</p>
```

#### Update Validation Schema

**File:** `lib/schemas/onboarding-schemas.ts`

```typescript
import { z } from 'zod';

export const preferencesSchema = z.object({
  // Existing required fields
  experienceLevel: z.enum(['beginner', 'intermediate', 'advanced', 'expert'], {
    required_error: 'Please select your experience level'
  }),
  surfStyles: z.array(z.string()).min(1, 'Select at least one surf style'),

  // NEW: All optional
  preferredWaveSize: z.enum(['small', 'medium', 'large', 'any']).optional(),
  preferredBreakType: z.enum(['beach', 'point', 'reef', 'any']).optional(),
  crowdPreference: z.enum(['social', 'moderate', 'solitude']).optional(),
});

export type PreferencesFormData = z.infer<typeof preferencesSchema>;
```

#### Update Zustand Store

**File:** `store/onboarding-store.ts`

```typescript
interface OnboardingData {
  // Existing fields
  fullName?: string;
  displayName?: string;  // Will now be saved!
  homeBeachId?: string;
  homeBeachName?: string;
  experienceLevel?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  surfStyles?: string[];  // Will now be saved!
  referralCode?: string;
  pushEnabled?: boolean;
  emailEnabled?: boolean;

  // NEW: Optional preference fields
  preferredWaveSize?: 'small' | 'medium' | 'large' | 'any';
  preferredBreakType?: 'beach' | 'point' | 'reef' | 'any';
  crowdPreference?: 'social' | 'moderate' | 'solitude';
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
      updateData: (newData) => set((state) => ({
        data: { ...state.data, ...newData }
      })),
      nextStep: () => set((state) => ({
        currentStep: Math.min(state.currentStep + 1, 6)
      })),
      prevStep: () => set((state) => ({
        currentStep: Math.max(state.currentStep - 1, 0)
      })),
      reset: () => set({ data: {}, currentStep: 0 }),
    }),
    {
      name: 'onboarding-storage',
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

### Workpath 2.3: Update Onboarding Save Action

**Agent:** `fullstack-engineer`

**File:** `actions/onboarding-actions.ts`

**Changes:**
```typescript
'use server';

import { withAuthenticatedAction } from '@/lib/server-action-utils';
import type { OnboardingData } from '@/store/onboarding-store';

export async function saveOnboardingData(data: OnboardingData) {
  return withAuthenticatedAction(async (user, supabase) => {
    // 1. Update profiles with ALL collected data
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        // Existing fields
        full_name: data.fullName,
        home_beach_id: data.homeBeachId,
        experience_level: data.experienceLevel,
        onboarding_completed_at: new Date().toISOString(),

        // FIX: Previously not saved
        display_name: data.displayName,
        surf_styles: data.surfStyles,

        // NEW: Optional preference fields
        preferred_wave_size: data.preferredWaveSize || null,
        preferred_break_type: data.preferredBreakType || null,
        crowd_preference: data.crowdPreference || null,
      })
      .eq('id', user.id);

    if (profileError) {
      throw new Error(`Failed to save profile: ${profileError.message}`);
    }

    // 2. Award XP for completing onboarding
    const { error: xpError } = await supabase
      .from('xp_events')
      .insert({
        user_id: user.id,
        action: 'complete_onboarding',
        xp_amount: 100,
      });

    if (xpError) {
      console.error('Failed to award onboarding XP:', xpError);
      // Don't fail the whole operation
    }

    // 3. Handle referral code if provided
    if (data.referralCode) {
      try {
        await processReferralCode(user.id, data.referralCode);
      } catch (error) {
        console.error('Failed to process referral:', error);
        // Don't fail the whole operation
      }
    }

    // 4. Update notification preferences
    if (data.pushEnabled !== undefined || data.emailEnabled !== undefined) {
      await supabase
        .from('profiles')
        .update({
          push_notifications_enabled: data.pushEnabled ?? true,
          email_notifications_enabled: data.emailEnabled ?? true,
        })
        .eq('id', user.id);
    }

    return { success: true };
  });
}

async function processReferralCode(userId: string, code: string) {
  // Existing referral logic
  // ...
}
```

**Tests:**
- Integration test: All fields saved correctly to profiles
- Integration test: Optional fields can be NULL
- Integration test: display_name uniqueness enforced (duplicate rejected)
- Integration test: Invalid enum values rejected
- Integration test: Referral code processed
- Integration test: XP awarded
- E2E test: "Complete onboarding with all preferences"
- E2E test: "Complete onboarding with minimal data"

### Workpath 2.4: Regenerate Database Types

**Agent:** `fullstack-engineer`

**Command:**
```bash
# After migration is applied
npx supabase gen types typescript --project-id <project-id> > types/database.generated.ts
```

**Verify new fields in generated types:**
```typescript
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          // ... existing fields
          display_name: string | null;
          surf_styles: string[] | null;
          preferred_wave_size: 'small' | 'medium' | 'large' | 'any' | null;
          preferred_break_type: 'beach' | 'point' | 'reef' | 'any' | null;
          crowd_preference: 'social' | 'moderate' | 'solitude' | null;
        }
      }
    }
  }
}
```

---

## Phase 3: Session Conditions Capture (Week 2)

**Goal:** Store forecast snapshot when sessions are created
**Effort:** 1 week
**Risk:** Medium (requires migration + backfill strategy)

### Background

**Problem:** Current sessions table doesn't store the forecast conditions at the time of the surf. This makes it impossible to learn user preferences from their surf history.

**Solution:** Create a `session_conditions` table to store a snapshot of forecast data when each session is created.

### Workpath 3.1: Database Schema

**Agent:** `supabase-db-expert`

**Migration:** `20250103000001_session_conditions_capture.sql`

```sql
-- Create session_conditions table
CREATE TABLE session_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,

  -- Wave conditions at session time
  wave_height_ft numeric(4,1),
  wave_period_s numeric(4,1),
  wave_direction_deg int CHECK (wave_direction_deg >= 0 AND wave_direction_deg <= 360),

  -- Wind conditions
  wind_speed_mph numeric(4,1),
  wind_direction_deg int CHECK (wind_direction_deg >= 0 AND wind_direction_deg <= 360),

  -- Tide conditions
  tide_status text,
  tide_height_ft numeric(4,2),

  -- Metadata
  data_source text NOT NULL, -- 'CDIP', 'NOAA_NWS', 'FALLBACK'
  confidence_score int CHECK (confidence_score >= 0 AND confidence_score <= 100),
  forecast_time timestamptz NOT NULL,
  backfilled boolean DEFAULT false, -- True if added retroactively

  created_at timestamptz DEFAULT now(),

  -- Ensure one conditions record per session
  CONSTRAINT unique_session_conditions UNIQUE(session_id)
);

-- Indexes for queries
CREATE INDEX idx_session_conditions_session ON session_conditions(session_id);
CREATE INDEX idx_session_conditions_forecast_time ON session_conditions(forecast_time);
CREATE INDEX idx_session_conditions_backfilled ON session_conditions(backfilled) WHERE backfilled = false;

-- RLS policies
ALTER TABLE session_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their session conditions"
  ON session_conditions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM sessions
    WHERE sessions.id = session_conditions.session_id
    AND sessions.user_id = auth.uid()
  ));

-- No INSERT/UPDATE policies needed - only server actions will write

-- Comments
COMMENT ON TABLE session_conditions IS 'Forecast conditions snapshot at the time of each surf session';
COMMENT ON COLUMN session_conditions.backfilled IS 'True if conditions were added retroactively from historical forecast data';
COMMENT ON COLUMN session_conditions.confidence_score IS 'Forecast confidence at time of capture (0-100)';
```

**Rollback Migration:**
```sql
DROP TABLE IF EXISTS session_conditions CASCADE;
```

**Tests:**
- Migration test: Apply and rollback successfully
- Constraint test: Unique session_id enforced
- Constraint test: Check constraints on degrees (0-360)
- RLS test: Users can only see their own conditions
- Index test: Indexes created and used

### Workpath 3.2: Forecast Snapshot Service

**Agent:** `backend-developer`

**File:** `lib/services/session-conditions-service.ts`

```typescript
import { createApiServerClient } from '@/lib/supabase/api-server-client';
import { format } from 'date-fns';

export interface SessionConditions {
  wave_height_ft: number | null;
  wave_period_s: number | null;
  wave_direction_deg: number | null;
  wind_speed_mph: number | null;
  wind_direction_deg: number | null;
  tide_status: string | null;
  tide_height_ft: number | null;
  data_source: string;
  confidence_score: number;
  forecast_time: string;
}

/**
 * Captures a snapshot of forecast conditions at the time of a surf session
 * Queries enhanced_forecasts for the closest matching forecast (within ±3 hours)
 */
export async function captureForecastSnapshot(params: {
  beachId: string;
  timestamp: Date;
}): Promise<SessionConditions> {
  const supabase = createApiServerClient();
  const { beachId, timestamp } = params;

  // Query enhanced_forecasts for matching beach + time
  const forecastDate = format(timestamp, 'yyyy-MM-dd');
  const forecastHour = timestamp.getHours();

  const { data: forecast, error } = await supabase
    .from('enhanced_forecasts')
    .select('*')
    .eq('beach_id', beachId)
    .eq('forecast_date', forecastDate)
    .gte('forecast_hour', forecastHour - 3)
    .lte('forecast_hour', forecastHour + 3)
    .order('forecast_hour', { ascending: true })
    .limit(1)
    .single();

  if (error || !forecast) {
    throw new Error(`No forecast found for beach ${beachId} at ${timestamp}`);
  }

  // Calculate confidence based on time delta
  const timeDeltaHours = Math.abs(timestamp.getHours() - forecast.forecast_hour);
  const confidencePenalty = timeDeltaHours * 5; // -5 points per hour
  const adjustedConfidence = Math.max(0, (forecast.confidence_score || 50) - confidencePenalty);

  return {
    wave_height_ft: forecast.wave_height || null,
    wave_period_s: forecast.wave_period || null,
    wave_direction_deg: forecast.wave_direction || null,
    wind_speed_mph: forecast.wind_speed || null,
    wind_direction_deg: forecast.wind_direction || null,
    tide_status: forecast.tide_status || null,
    tide_height_ft: forecast.tide_height || null,
    data_source: forecast.data_source || 'UNKNOWN',
    confidence_score: adjustedConfidence,
    forecast_time: forecast.forecast_time,
  };
}

/**
 * Backfills conditions for an existing session from historical forecast data
 * Used for retroactive data population
 */
export async function backfillSessionConditions(
  sessionId: string
): Promise<SessionConditions | null> {
  const supabase = createApiServerClient();

  // Get session details
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('beach_id, arrival_time')
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) {
    console.error('Session not found:', sessionId);
    return null;
  }

  try {
    const conditions = await captureForecastSnapshot({
      beachId: session.beach_id,
      timestamp: new Date(session.arrival_time),
    });

    // Insert with backfilled flag
    const { error: insertError } = await supabase
      .from('session_conditions')
      .insert({
        session_id: sessionId,
        ...conditions,
        backfilled: true,
      });

    if (insertError) {
      throw new Error(`Failed to insert conditions: ${insertError.message}`);
    }

    return conditions;
  } catch (error) {
    console.error('Failed to backfill conditions:', error);
    return null;
  }
}

/**
 * Gets session conditions if they exist
 */
export async function getSessionConditions(
  sessionId: string
): Promise<SessionConditions | null> {
  const supabase = createApiServerClient();

  const { data, error } = await supabase
    .from('session_conditions')
    .select('*')
    .eq('session_id', sessionId)
    .single();

  if (error || !data) return null;

  return {
    wave_height_ft: data.wave_height_ft,
    wave_period_s: data.wave_period_s,
    wave_direction_deg: data.wave_direction_deg,
    wind_speed_mph: data.wind_speed_mph,
    wind_direction_deg: data.wind_direction_deg,
    tide_status: data.tide_status,
    tide_height_ft: data.tide_height_ft,
    data_source: data.data_source,
    confidence_score: data.confidence_score,
    forecast_time: data.forecast_time,
  };
}
```

**Tests:**
- Unit test: `captureForecastSnapshot` with exact time match
- Unit test: `captureForecastSnapshot` with 2-hour offset
- Unit test: `captureForecastSnapshot` throws on missing data
- Unit test: Confidence penalty calculation
- Integration test: `backfillSessionConditions` for existing session
- Integration test: `getSessionConditions` retrieves data

### Workpath 3.3: Session Action Integration

**Agent:** `fullstack-engineer`

**File:** `lib/actions/session-actions.ts`

**Changes:**
```typescript
import { captureForecastSnapshot } from '@/lib/services/session-conditions-service';

export async function createSession(data: SessionInput) {
  return withAuthenticatedAction(async (user, supabase) => {
    // 1. Create session
    const { data: session, error } = await supabase
      .from('sessions')
      .insert({
        user_id: user.id,
        beach_id: data.beach_id,
        arrival_time: data.arrival_time,
        duration_minutes: data.duration_minutes,
        rating: data.rating,
        notes: data.notes,
        // ... other session fields
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create session: ${error.message}`);
    }

    // 2. Capture forecast conditions (non-blocking)
    try {
      const conditions = await captureForecastSnapshot({
        beachId: data.beach_id,
        timestamp: new Date(data.arrival_time),
      });

      await supabase
        .from('session_conditions')
        .insert({
          session_id: session.id,
          ...conditions,
          backfilled: false,
        });

      console.log(`✅ Captured conditions for session ${session.id}`);
    } catch (conditionError) {
      // Log but don't fail session creation
      console.error('⚠️ Failed to capture session conditions:', conditionError);
      // Could add to a retry queue here
    }

    return session;
  });
}

export async function updateSession(sessionId: string, data: Partial<SessionInput>) {
  return withAuthenticatedAction(async (user, supabase) => {
    // Update session
    const { data: session, error } = await supabase
      .from('sessions')
      .update(data)
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update session: ${error.message}`);
    }

    // If arrival_time changed, recapture conditions
    if (data.arrival_time) {
      try {
        // Delete old conditions
        await supabase
          .from('session_conditions')
          .delete()
          .eq('session_id', sessionId);

        // Capture new conditions
        const conditions = await captureForecastSnapshot({
          beachId: session.beach_id,
          timestamp: new Date(data.arrival_time),
        });

        await supabase
          .from('session_conditions')
          .insert({
            session_id: sessionId,
            ...conditions,
            backfilled: false,
          });
      } catch (conditionError) {
        console.error('Failed to recapture conditions:', conditionError);
      }
    }

    return session;
  });
}
```

**Tests:**
- Integration test: `createSession` captures conditions
- Integration test: Session creation succeeds even if conditions fail
- Integration test: `updateSession` recaptures conditions on time change
- E2E test: "Create session and verify conditions stored"

### Workpath 3.4: Historical Backfill Script

**Agent:** `backend-developer`

**File:** `scripts/backfill-session-conditions.ts`

```typescript
#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import { backfillSessionConditions } from '../lib/services/session-conditions-service';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function backfillAllSessions() {
  console.log('🔄 Starting session conditions backfill...');

  // Get all sessions without conditions
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('id, arrival_time, beach_id')
    .not('id', 'in',
      supabase
        .from('session_conditions')
        .select('session_id')
    )
    .order('arrival_time', { ascending: false })
    .limit(1000);

  if (error) {
    console.error('❌ Failed to fetch sessions:', error);
    return;
  }

  console.log(`📊 Found ${sessions.length} sessions without conditions`);

  let successCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const session of sessions) {
    try {
      const conditions = await backfillSessionConditions(session.id);

      if (conditions) {
        successCount++;
        console.log(`✅ ${successCount}/${sessions.length} - Session ${session.id.substring(0, 8)}`);
      } else {
        skippedCount++;
        console.log(`⏭️  Skipped ${session.id.substring(0, 8)} (no forecast data)`);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      failedCount++;
      console.error(`❌ Failed ${session.id}:`, error);
    }
  }

  console.log('\n📈 Backfill Summary:');
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ⏭️  Skipped: ${skippedCount}`);
  console.log(`   ❌ Failed: ${failedCount}`);
}

backfillAllSessions().catch(console.error);
```

**Usage:**
```bash
# Set environment variables
export NEXT_PUBLIC_SUPABASE_URL="..."
export SUPABASE_SERVICE_ROLE_KEY="..."

# Run backfill
npx tsx scripts/backfill-session-conditions.ts
```

**Tests:**
- Integration test: Backfill script processes sessions
- Integration test: Script handles missing forecast data gracefully
- Integration test: Script respects rate limits

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

### Workpath 4.1: Database Schema + Trigger

**Agent:** `supabase-db-expert`

**Migration:** `20250103000002_beach_affinity.sql`

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

### Workpath 4.2: Initial Affinity Computation Script

**Agent:** `backend-developer`

**File:** `scripts/compute-initial-affinities.ts`

```typescript
#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function computeInitialAffinities() {
  console.log('🔄 Computing initial beach affinities...');

  // Use database function to populate affinity table from existing sessions
  const { data, error } = await supabase.rpc('compute_all_affinities_initial');

  if (error) {
    console.error('❌ Failed:', error);
    return;
  }

  console.log(`✅ Computed affinities for all users`);
}

computeInitialAffinities().catch(console.error);
```

**SQL Function (add to migration):**
```sql
-- Helper function for initial computation
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
```

**Usage:**
```bash
# After migration is applied
npx tsx scripts/compute-initial-affinities.ts
```

---

## Phase 5: Preference Learning (Week 3)

**Goal:** Learn user surf preferences from session history
**Effort:** 1 week
**Risk:** Medium (algorithm complexity + cron job)

### Background

**Concept:** Analyze sessions with captured conditions to learn:
- Preferred wave height range (10th-90th percentile)
- Preferred wave period range
- Maximum wind tolerance
- Preferred wind directions
- Preferred tide statuses

**Confidence Score:** Based on sample size (5 sessions = 0.5 confidence, 20+ = 0.95)

### Workpath 5.1: Database Schema

**Agent:** `supabase-db-expert`

**Migration:** `20250103000003_user_surf_preferences.sql`

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

### Workpath 5.2: Preference Learning Service

**Agent:** `backend-developer`

**File:** `lib/services/preference-learning-service.ts`

```typescript
import { createApiServerClient } from '@/lib/supabase/api-server-client';

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
    .from('sessions')
    .select(`
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
    `)
    .eq('user_id', userId)
    .gte('rating', 3) // Only learn from good sessions
    .not('session_conditions', 'is', null)
    .order('arrival_time', { ascending: false })
    .limit(50);

  if (error || !sessions || sessions.length < 5) {
    console.log(`Not enough data for user ${userId}: ${sessions?.length || 0} sessions`);
    return null;
  }

  // 2. Extract arrays of values
  const waveHeights = sessions
    .map(s => s.session_conditions?.[0]?.wave_height_ft)
    .filter((v): v is number => v != null);

  const wavePeriods = sessions
    .map(s => s.session_conditions?.[0]?.wave_period_s)
    .filter((v): v is number => v != null);

  const windSpeeds = sessions
    .map(s => s.session_conditions?.[0]?.wind_speed_mph)
    .filter((v): v is number => v != null);

  const windDirections = sessions
    .map(s => s.session_conditions?.[0]?.wind_direction_deg)
    .filter((v): v is number => v != null);

  const tideStatuses = sessions
    .map(s => s.session_conditions?.[0]?.tide_status)
    .filter((v): v is string => v != null);

  // 3. Compute statistics
  const preferences: UserSurfPreferences = {
    wave_min_ft: waveHeights.length >= 5 ? percentile(waveHeights, 10) : null,
    wave_max_ft: waveHeights.length >= 5 ? percentile(waveHeights, 90) : null,
    wave_period_min_s: wavePeriods.length >= 5 ? percentile(wavePeriods, 10) : null,
    wave_period_max_s: wavePeriods.length >= 5 ? percentile(wavePeriods, 90) : null,
    max_wind_mph: windSpeeds.length >= 5 ? percentile(windSpeeds, 90) : null,
    preferred_wind_directions: windDirections.length >= 5
      ? findModeDirections(windDirections, 45)
      : null,
    preferred_tide_statuses: tideStatuses.length >= 5
      ? findModes(tideStatuses, 0.2)
      : null,
    confidence: calculateConfidence(sessions.length),
    sample_size: sessions.length,
  };

  // 4. Upsert to database
  const { error: upsertError } = await supabase
    .from('user_surf_preferences')
    .upsert({
      user_id: userId,
      ...preferences,
      last_computed_at: new Date().toISOString(),
    });

  if (upsertError) {
    throw new Error(`Failed to save preferences: ${upsertError.message}`);
  }

  console.log(`✅ Computed preferences for user ${userId} (${sessions.length} sessions)`);

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
    .from('user_surf_preferences')
    .select('*')
    .eq('user_id', userId)
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
function findModeDirections(directions: number[], tolerance: number = 45): number[] {
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

### Workpath 5.3: Nightly Cron Job

**Agent:** `backend-developer`

**File:** `app/api/cron/preferences/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { computeUserPreferences } from '@/lib/services/preference-learning-service';
import { createApiServerClient } from '@/lib/supabase/api-server-client';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createApiServerClient();

  try {
    // Get users with recent sessions (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: recentUsers, error } = await supabase
      .from('sessions')
      .select('user_id')
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('user_id');

    if (error) {
      throw new Error(`Failed to fetch users: ${error.message}`);
    }

    // Deduplicate user IDs
    const uniqueUserIds = [...new Set(recentUsers.map(s => s.user_id))];

    console.log(`Processing ${uniqueUserIds.length} users with recent activity`);

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

    console.log('✅ Preference computation complete:', results);

    return Response.json({
      success: true,
      results,
      processed: uniqueUserIds.length,
    });
  } catch (error) {
    console.error('❌ Cron job failed:', error);
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

### Workpath 6.1: Personalized Scoring Service

**Agent:** `backend-developer`

**File:** `lib/services/personalized-scoring-service.ts`

```typescript
import { getUserSurfPreferences } from './preference-learning-service';
import { createApiServerClient } from '@/lib/supabase/api-server-client';
import type { EnhancedForecast } from '@/types/forecast';

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
    .from('profiles')
    .select('preferred_wave_size, preferred_break_type, crowd_preference')
    .eq('id', userId)
    .single();

  if (profile) {
    // Match wave size preference
    if (profile.preferred_wave_size && profile.preferred_wave_size !== 'any') {
      if (matchesWaveSize(forecast, profile.preferred_wave_size)) {
        score += 10;
        breakdown.onboardingPrefs += 10;
        personalized = true;
      }
    }

    // Match break type preference
    if (profile.preferred_break_type && profile.preferred_break_type !== 'any') {
      const { data: beach } = await supabase
        .from('beaches')
        .select('break_type')
        .eq('id', beachId)
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
    .from('user_beach_affinity')
    .select('affinity_score, session_count')
    .eq('user_id', userId)
    .eq('beach_id', beachId)
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
    case 'small':
      return height >= 1 && height <= 3;
    case 'medium':
      return height > 3 && height <= 6;
    case 'large':
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
  prefs: { max_wind_mph: number | null; preferred_wind_directions: number[] | null }
): boolean {
  const windSpeed = forecast.wind_speed;
  const windDir = forecast.wind_direction;

  // Check wind speed tolerance
  if (prefs.max_wind_mph && windSpeed) {
    if (windSpeed > prefs.max_wind_mph) return false;
  }

  // Check wind direction preference (within ±30 degrees)
  if (prefs.preferred_wind_directions && windDir) {
    return prefs.preferred_wind_directions.some(prefDir =>
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

### Workpath 6.2: Update Morning Recommendations API

**Agent:** `fullstack-engineer`

**File:** `app/api/recommendations/morning/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { createApiServerClient } from '@/lib/supabase/api-server-client';
import { createSuccessResponse, handleApiError } from '@/lib/api-utils';
import { scoreBeachForUser } from '@/lib/services/personalized-scoring-service';
import { getUser } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const supabase = createApiServerClient();

    // 1. Get user's home beach
    const { data: profile } = await supabase
      .from('profiles')
      .select('home_beach_id')
      .eq('id', user.id)
      .single();

    if (!profile?.home_beach_id) {
      return createSuccessResponse({ recommendations: [] });
    }

    // 2. Get base recommendations (existing coach picks logic)
    const { data: baseRecs, error } = await supabase
      .rpc('get_coach_picks', {
        _beach_id: profile.home_beach_id,
        _radius_km: 16, // 10 miles
        _limit: 10, // Get more than needed for re-ranking
      });

    if (error) {
      throw new Error(`Failed to get coach picks: ${error.message}`);
    }

    // 3. Get current forecasts for each beach
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentHour = now.getHours();

    const beachIds = baseRecs.map(r => r.beach_id);

    const { data: forecasts } = await supabase
      .from('enhanced_forecasts')
      .select('*')
      .in('beach_id', beachIds)
      .eq('forecast_date', today)
      .gte('forecast_hour', currentHour)
      .lte('forecast_hour', currentHour + 2);

    // Create forecast map
    const forecastMap = new Map();
    forecasts?.forEach(f => {
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
      personalized: topRecs.some(r => r.personalized),
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

### Workpath 6.3: Add Personalized Badge Component

**Agent:** `frontend-developer`

**File:** `components/recommendations/PersonalizedBadge.tsx`

```tsx
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
  affinityData
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
                    <p>Your preferences: +{breakdown.onboardingPrefs.toFixed(0)} pts</p>
                  )}
                  {breakdown.learnedPrefs > 0 && (
                    <p>Learned from history: +{breakdown.learnedPrefs.toFixed(0)} pts</p>
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
import { PersonalizedBadge } from '@/components/recommendations/PersonalizedBadge';

<div className="recommendation-card">
  <h3>{rec.beachName}</h3>

  <PersonalizedBadge
    personalized={rec.personalized}
    breakdown={rec.breakdown}
    affinityData={
      rec.affinity ? {
        sessionCount: rec.affinity.session_count,
        lastSurfed: new Date(rec.affinity.last_surfed_at)
      } : undefined
    }
  />

  {/* Rest of recommendation card */}
</div>
```

**Tests:**
- Unit test: Badge renders when personalized
- Unit test: Badge hidden when not personalized
- Unit test: Tooltip shows breakdown
- Unit test: Affinity badge shows session count
- Accessibility test: Badge has proper ARIA labels

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
describe('preference-learning-service', () => {
  describe('percentile', () => {
    it('calculates 50th percentile correctly', () => {
      expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
    });

    it('handles 10th percentile', () => {
      expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 10)).toBe(1.9);
    });
  });

  describe('calculateConfidence', () => {
    it('returns 0.5 for 5 sessions', () => {
      expect(calculateConfidence(5)).toBeCloseTo(0.5, 1);
    });

    it('returns 0.95+ for 20+ sessions', () => {
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
describe('session-actions', () => {
  it('creates session and captures conditions', async () => {
    const session = await createSession({
      beach_id: 'test-beach-id',
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
test('beach page displays forecast source badges', async ({ page }) => {
  await page.goto('/beaches/mission-beach');

  // Verify source badge visible
  await expect(page.locator('[data-testid="forecast-source-badge"]')).toBeVisible();

  // Verify confidence indicator
  await expect(page.locator('[data-testid="confidence-indicator"]')).toBeVisible();

  // Verify last updated timestamp
  await expect(page.locator('[data-testid="data-freshness"]')).toContainText(/Updated .* ago/);
});
```

2. **Enhanced Onboarding**
```typescript
test('complete onboarding with surf preferences', async ({ page }) => {
  await page.goto('/onboarding');

  // Step 1: Welcome
  await page.click('button:has-text("Get Started")');

  // Step 2: Profile
  await page.fill('input[name="fullName"]', 'Test User');
  await page.fill('input[name="displayName"]', 'testuser');
  await page.click('button:has-text("Continue")');

  // Step 3: Home Beach
  await page.fill('input[placeholder*="Search"]', 'Mission Beach');
  await page.click('text=Mission Beach');
  await page.click('button:has-text("Continue")');

  // Step 4: Preferences (existing + new)
  await page.click('text=Intermediate');
  await page.click('text=Shortboard');

  // NEW: Wave size preference
  await page.click('text=Medium waves');

  // NEW: Break type preference
  await page.click('text=Beach break');

  // NEW: Crowd preference
  await page.click('text=A few people is fine');

  await page.click('button:has-text("Continue")');

  // Complete flow...
  await page.click('button:has-text("Finish")');

  // Verify profile saved correctly
  const profile = await getProfile(userId);
  expect(profile.display_name).toBe('testuser');
  expect(profile.surf_styles).toContain('shortboard');
  expect(profile.preferred_wave_size).toBe('medium');
  expect(profile.preferred_break_type).toBe('beach');
  expect(profile.crowd_preference).toBe('moderate');
});
```

3. **Session Conditions Capture**
```typescript
test('create session and verify conditions captured', async ({ page }) => {
  await page.goto('/sessions/new');

  await page.fill('input[name="beach"]', 'Mission Beach');
  await page.click('text=Mission Beach');

  await page.fill('input[name="arrivalTime"]', '2025-11-03T08:00');
  await page.fill('input[name="duration"]', '90');
  await page.click('button:has-text("5 stars")');

  await page.click('button:has-text("Save Session")');

  // Verify session created
  await expect(page.locator('text=Session saved')).toBeVisible();

  // Navigate to session details
  await page.click('text=View Session');

  // Verify conditions displayed (future feature)
  await expect(page.locator('text=Wave Height')).toBeVisible();
  await expect(page.locator('text=Wind Speed')).toBeVisible();
});
```

4. **Personalized Recommendations**
```typescript
test('morning recommendations show personalized badge', async ({ page }) => {
  // User with preferences and history
  await setupUserWithPreferences(userId);
  await createSessions(userId, 10); // Create history

  await page.goto('/');

  // Check morning recommendations
  await expect(page.locator('text=Best for you this morning')).toBeVisible();

  // Verify personalized badge
  const firstRec = page.locator('[data-testid="recommendation-card"]').first();
  await expect(firstRec.locator('text=✨ Personalized for you')).toBeVisible();

  // Hover to see breakdown
  await firstRec.locator('[data-testid="personalized-badge"]').hover();
  await expect(page.locator('text=Your preferences:')).toBeVisible();
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
│   ├── ForecastSourceBadge.tsx                     # NEW
│   ├── ConfidenceIndicator.tsx                     # NEW
│   ├── DataFreshnessIndicator.tsx                  # NEW
│   └── BuoyStationLink.tsx                         # NEW
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
│   ├── forecast/ForecastSourceBadge.test.tsx       # NEW
│   ├── forecast/ConfidenceIndicator.test.tsx       # NEW
│   └── recommendations/PersonalizedBadge.test.tsx  # NEW
└── e2e/
    ├── forecast-transparency.spec.ts               # NEW
    ├── onboarding-preferences.spec.ts              # NEW
    └── personalized-recommendations.spec.ts        # NEW

vercel.json                                         # MODIFIED (add cron)
```

---

## Agent Assignment Summary

| Week | Phase | Agent | Primary Workpath | Estimated Hours |
|------|-------|-------|------------------|-----------------|
| 1 | Transparency | frontend-developer | Forecast UI components | 8-10h |
| 1 | Transparency | nextjs-developer | Data integration | 6-8h |
| 1-2 | Onboarding | supabase-db-expert | Migration (fix + new fields) | 4-6h |
| 1-2 | Onboarding | fullstack-engineer | Enhance preferences step | 10-12h |
| 2 | Conditions | supabase-db-expert | Session conditions schema | 4-6h |
| 2 | Conditions | backend-developer | Snapshot service + backfill | 12-15h |
| 2 | Conditions | fullstack-engineer | Session action integration | 4-6h |
| 2-3 | Affinity | supabase-db-expert | Affinity table + trigger + function | 6-8h |
| 2-3 | Affinity | backend-developer | Initial computation script | 2-4h |
| 3 | Preferences | supabase-db-expert | Preferences schema | 3-4h |
| 3 | Preferences | backend-developer | Learning service + cron | 15-18h |
| 4 | Scoring | backend-developer | Personalized scoring service | 10-12h |
| 4 | Integration | fullstack-engineer | Morning API + UI badges | 8-10h |
| 4 | Testing | qa-expert | E2E test suite | 8-10h |

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
- [ ] `CHANGELOG.md` — Add to `[Unreleased]` section
- [ ] `README.md` — Update features list
- [ ] `docs/PERSONALIZATION_STRATEGY.md` — Mark phases as complete
- [ ] `docs/ARCHITECTURE_REVIEW.md` — Document new services
- [ ] Component README files for new UI components

---

**Status:** 🟢 APPROVED — Ready for Implementation
**Implementation Start:** 2025-11-03
**Target Completion:** 2025-12-01 (4 weeks)
**Point of Contact:** Engineering Lead

**Built with ❤️ by surfers, for surfers** 🏄‍♂️🌊
