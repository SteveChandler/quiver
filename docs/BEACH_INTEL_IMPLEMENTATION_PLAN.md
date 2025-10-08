# 📋 Beach Intel Implementation Plan: Multiple Daily Updates

## 🎯 Goals

1. Generate surf intel for **top 10 beaches** (hybrid approach)
2. Update **3 times per day**: 6 AM, 10 AM, 2 PM PT
3. Store in Supabase for instant client access
4. Zero Vercel edge function costs

---

## 🏖️ Beach Selection Strategy

### **Phase 1: Manual Curated Top 10** (Launch)

Start with iconic San Diego surf spots with complete data

### **Phase 2: Data-Driven Expansion** (Post-launch)

Automatically add beaches based on:

- Session count (user activity)
- Favorites count
- Forecast data quality

---

## 📊 Database Schema

### **Create: `beach_daily_intel` Table**

```sql
-- supabase/migrations/[timestamp]_create_beach_daily_intel.sql

CREATE TABLE beach_daily_intel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beach_id UUID NOT NULL REFERENCES beaches(id) ON DELETE CASCADE,

  -- Generation metadata
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generation_time TEXT NOT NULL, -- '06:00', '10:00', '14:00'
  forecast_date DATE NOT NULL,

  -- Best window recommendation
  best_window_start TIME,
  best_window_end TIME,
  best_window_description TEXT, -- "6-8am on mid-tide"

  -- Surf conditions
  surf_min_ft NUMERIC,
  surf_max_ft NUMERIC,
  surf_description TEXT, -- "waist-high", "chest-high"

  -- Tide information
  tide_height_ft NUMERIC,
  tide_time TIME,
  tide_status TEXT, -- "rising", "falling", "slack"
  tide_optimal_range TEXT, -- "2-5 ft"
  next_tide_type TEXT, -- "HIGH", "LOW"
  next_tide_time TEXT,
  next_tide_height_ft NUMERIC,

  -- Wind conditions
  wind_speed_mph NUMERIC,
  wind_direction_deg NUMERIC,
  wind_direction_text TEXT, -- "N", "NW", etc
  wind_quality TEXT, -- "offshore", "onshore", "cross-shore"
  wind_description TEXT, -- "5 mph offshore (clean)"

  -- Swell details
  primary_swell_height_ft NUMERIC,
  primary_swell_period_s NUMERIC,
  primary_swell_direction_deg NUMERIC,
  primary_swell_direction_text TEXT,

  secondary_swell_height_ft NUMERIC,
  secondary_swell_period_s NUMERIC,
  secondary_swell_direction_deg NUMERIC,
  secondary_swell_direction_text TEXT,

  -- Analysis
  confidence TEXT NOT NULL, -- "Low", "Medium", "High"
  recommendation TEXT, -- Human-readable summary paragraph
  conditions_score INTEGER, -- 0-100

  -- Full data for advanced display
  raw_intel_data JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT beach_daily_intel_unique
    UNIQUE (beach_id, forecast_date, generation_time)
);

-- Indexes for fast lookups
CREATE INDEX idx_beach_daily_intel_lookup
  ON beach_daily_intel (beach_id, forecast_date, generation_time DESC);

CREATE INDEX idx_beach_daily_intel_latest
  ON beach_daily_intel (beach_id, generated_at DESC);

CREATE INDEX idx_beach_daily_intel_cleanup
  ON beach_daily_intel (created_at);

-- RLS Policies (public read)
ALTER TABLE beach_daily_intel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
  ON beach_daily_intel FOR SELECT
  USING (true);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_beach_daily_intel_updated_at
    BEFORE UPDATE ON beach_daily_intel
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-cleanup old intel (keep last 3 days)
CREATE OR REPLACE FUNCTION cleanup_old_intel()
RETURNS void AS $$
BEGIN
    DELETE FROM beach_daily_intel
    WHERE created_at < NOW() - INTERVAL '3 days';
END;
$$ LANGUAGE plpgsql;
```

---

## 🏗️ Implementation Phases

### **Phase 1: Database Setup** (30 min)

**Tasks:**

1. Create migration file
2. Run migration in Supabase
3. Verify table and indexes created
4. Test RLS policies

**Files:**

- `supabase/migrations/[timestamp]_create_beach_daily_intel.sql`

---

### **Phase 2: Intel Generation Service** (3-4 hours)

#### 2.1 Extract Reusable Intel Logic

**File:** `lib/services/intel-generation-service.ts`

```typescript
/**
 * Reusable service for generating beach surf intel
 * Used by both scheduled workflow and on-demand generation
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  deriveSurfRange,
  recommendTideWindow,
  primarySecondarySwell,
  windAt,
  bestWindowHeuristic,
  confidenceHeuristic,
  analyzeConditions,
} from "@/lib/utils/morning-intel-utils";

export class IntelGenerationService {
  private supabase;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient<Database>(supabaseUrl, supabaseKey);
  }

  /**
   * Check if beach can have intel generated
   */
  async canGenerateIntel(beachId: string): Promise<boolean> {
    const { data: beach } = await this.supabase
      .from("beaches")
      .select("tide_min_ft, tide_max_ft, wind_offshore_deg")
      .eq("id", beachId)
      .single();

    return !!(
      beach &&
      beach.tide_min_ft !== null &&
      beach.tide_max_ft !== null
    );
  }

  /**
   * Generate intel for a specific beach
   */
  async generateIntel(beachId: string, targetTime: string = "06:00") {
    // 1. Fetch beach preferences
    const beachPrefs = await this.fetchBeachPreferences(beachId);

    // 2. Fetch forecast data
    const forecasts = await this.fetchForecasts(beachId);

    // 3. Analyze conditions
    const intel = this.analyzeForecasts(forecasts, beachPrefs, targetTime);

    return intel;
  }

  private async fetchBeachPreferences(beachId: string) {
    // Reuse logic from morningIntel.ts
  }

  private async fetchForecasts(beachId: string) {
    // Reuse logic from morningIntel.ts
  }

  private analyzeForecasts(forecasts, beachPrefs, targetTime) {
    // Reuse logic from morningIntel.ts
    // Return structured intel data
  }

  /**
   * Save intel to database
   */
  async saveIntel(beachId: string, intel: any, generationTime: string) {
    const today = new Date().toISOString().split("T")[0];

    const { error } = await this.supabase.from("beach_daily_intel").upsert({
      beach_id: beachId,
      forecast_date: today,
      generation_time: generationTime,
      generated_at: new Date().toISOString(),

      // Best window
      best_window_start: intel.bestWindow.start,
      best_window_end: intel.bestWindow.end,
      best_window_description: intel.bestWindow.description,

      // Surf
      surf_min_ft: intel.surf.min,
      surf_max_ft: intel.surf.max,
      surf_description: intel.surf.description,

      // Tide
      tide_height_ft: intel.tide.height,
      tide_time: intel.tide.recommendedTime,
      tide_status: intel.tide.direction,
      tide_optimal_range: intel.tide.optimalRange,
      next_tide_type: intel.tide.nextEvent?.type,
      next_tide_time: intel.tide.nextEvent?.time,
      next_tide_height_ft: intel.tide.nextEvent?.height,

      // Wind
      wind_speed_mph: intel.wind.speed,
      wind_direction_deg: intel.wind.direction,
      wind_direction_text: intel.wind.cardinal,
      wind_quality: intel.wind.quality,
      wind_description: intel.wind.description,

      // Swells
      primary_swell_height_ft: intel.swells.primary?.height,
      primary_swell_period_s: intel.swells.primary?.period,
      primary_swell_direction_deg: intel.swells.primary?.direction,
      primary_swell_direction_text: intel.swells.primary?.cardinal,

      secondary_swell_height_ft: intel.swells.secondary?.height,
      secondary_swell_period_s: intel.swells.secondary?.period,
      secondary_swell_direction_deg: intel.swells.secondary?.direction,
      secondary_swell_direction_text: intel.swells.secondary?.cardinal,

      // Analysis
      confidence: intel.confidence,
      recommendation: intel.notes,
      conditions_score: intel.conditions?.score,

      // Full data
      raw_intel_data: intel,
    });

    if (error) throw error;
  }
}
```

---

#### 2.2 Batch Generation Script

**File:** `scripts/generate-daily-intel.ts`

```typescript
/**
 * Generate intel for top beaches
 * Run 3x daily: 6am, 10am, 2pm PT
 */

import { config } from "dotenv";
import { IntelGenerationService } from "@/lib/services/intel-generation-service";
import { formatInTimeZone } from "date-fns-tz";

config();

// Phase 1: Manually curated top 10 San Diego beaches
const TOP_BEACHES_MANUAL = [
  "65d177de-e75a-4ad8-aa0d-48a67c0851b0", // 1. Ocean Beach Pier - Intermediate, iconic
  "91df193c-f2c8-4e6c-984e-b859bd741061", // 2. Tourmaline Surf Park - Beginner, very popular
  "cc7c0837-257c-42c3-9d98-634911e73a6a", // 3. Crystal Pier (Pacific Beach) - Beginner
  "cdcf733b-a704-45ef-affc-d8152ffde1e4", // 4. Mission Beach (Central) - Beginner
  "13ef0aa1-c857-4d82-a40d-a83612110943", // 5. PB Point - Intermediate, iconic point break
  "4b0cf129-c706-4e24-8210-2219defc5ea7", // 6. Scripps (La Jolla) - Intermediate
  "15c7337e-5258-4339-9dc3-c435c666926b", // 7. Ocean Beach (general) - Intermediate
  "ca2b1d6f-2428-4273-ab02-7555eeec4323", // 8. Birdrock (La Jolla) - Advanced, reef
  "d305ba0d-47cd-4494-b790-f924dac7bf1f", // 9. Sunset Cliffs (Garbage) - Advanced, iconic
  "30e68b00-c27d-4d22-ba57-2d92156964c6", // 10. Horseshoe (La Jolla) - Advanced, reef
];

/**
 * Phase 2: Get additional beaches based on activity
 * (Uncomment after launch when you have user data)
 */
async function getTopBeachesByActivity(limit: number = 20): Promise<string[]> {
  const service = new IntelGenerationService(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Query beaches by sessions + favorites
  // Return beach IDs
  return [];
}

/**
 * Get current generation time (06:00, 10:00, or 14:00)
 */
function getCurrentGenerationTime(): string {
  const now = new Date();
  const hour = parseInt(formatInTimeZone(now, "America/Los_Angeles", "HH"));

  if (hour >= 6 && hour < 10) return "06:00";
  if (hour >= 10 && hour < 14) return "10:00";
  return "14:00";
}

/**
 * Main generation function
 */
async function generateDailyIntel() {
  const startTime = Date.now();
  const generationTime = getCurrentGenerationTime();

  console.log("🌊 Beach Intel Generation");
  console.log(`📅 ${new Date().toISOString()}`);
  console.log(`⏰ Generation time: ${generationTime}`);
  console.log("─".repeat(50));

  // Phase 1: Use manual list
  let beachIds = [...TOP_BEACHES_MANUAL];

  // Phase 2: Add data-driven beaches (uncomment after launch)
  // const activityBeaches = await getTopBeachesByActivity(20);
  // beachIds = [...new Set([...beachIds, ...activityBeaches])].slice(0, 50);

  console.log(`Generating intel for ${beachIds.length} beaches...\n`);

  const service = new IntelGenerationService(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let successCount = 0;
  let failCount = 0;

  for (const beachId of beachIds) {
    try {
      // Check if beach can generate intel
      const canGenerate = await service.canGenerateIntel(beachId);
      if (!canGenerate) {
        console.log(`⏭️  ${beachId} - Missing preferences, skipped`);
        continue;
      }

      // Generate intel
      const intel = await service.generateIntel(beachId, generationTime);

      // Save to database
      await service.saveIntel(beachId, intel, generationTime);

      successCount++;
      console.log(`✅ ${beachId} - Success`);
    } catch (error) {
      failCount++;
      console.error(`❌ ${beachId} - ${error.message}`);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("\n" + "─".repeat(50));
  console.log(`🎉 Generation complete in ${duration}s`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Failed: ${failCount}`);
  console.log(`   Total: ${beachIds.length}`);
}

// Run if called directly
if (require.main === module) {
  generateDailyIntel()
    .then(() => {
      console.log("\n✅ All done!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Fatal error:", error);
      process.exit(1);
    });
}

export { generateDailyIntel };
```

**Package.json:**

```json
{
  "scripts": {
    "generate-daily-intel": "tsx scripts/generate-daily-intel.ts"
  }
}
```

---

### **Phase 3: GitHub Actions Workflow** (30 min)

**File:** `.github/workflows/daily-intel.yml`

```yaml
name: Generate Beach Intel (3x Daily)

on:
  schedule:
    # 6:00 AM PT (13:00 UTC PDT / 14:00 UTC PST)
    - cron: "0 13 * * *" # PDT
    - cron: "0 14 * * *" # PST

    # 10:00 AM PT (17:00 UTC PDT / 18:00 UTC PST)
    - cron: "0 17 * * *" # PDT
    - cron: "0 18 * * *" # PST

    # 2:00 PM PT (21:00 UTC PDT / 22:00 UTC PST)
    - cron: "0 21 * * *" # PDT
    - cron: "0 22 * * *" # PST

  workflow_dispatch: # Manual trigger

env:
  NODE_VERSION: "18"
  TZ: "America/Los_Angeles"

jobs:
  generate-intel:
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Set timezone
        run: |
          echo "TZ=America/Los_Angeles" >> $GITHUB_ENV
          echo "Current PT time: $(TZ=America/Los_Angeles date '+%Y-%m-%d %H:%M %Z')"

      - name: Generate Beach Intel
        id: generate
        run: |
          echo "🌊 Generating beach intel..."
          if npm run generate-daily-intel 2>&1 | tee intel_output.log; then
            echo "✅ Intel generation completed"
            echo "success=true" >> $GITHUB_OUTPUT
          else
            echo "❌ Intel generation failed"
            echo "success=false" >> $GITHUB_OUTPUT
            exit 1
          fi
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}

      - name: Upload logs
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: intel-generation-log-${{ github.run_number }}
          path: intel_output.log
          retention-days: 7

      - name: Create summary
        if: always()
        run: |
          echo "## 🌊 Beach Intel Generation Report" >> $GITHUB_STEP_SUMMARY
          echo "**Date:** $(TZ=America/Los_Angeles date '+%Y-%m-%d %H:%M %Z')" >> $GITHUB_STEP_SUMMARY
          echo "**Status:** ${{ steps.generate.outputs.success == 'true' && '✅ Success' || '❌ Failed' }}" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY

          if [ -f intel_output.log ]; then
            echo "### Output Log" >> $GITHUB_STEP_SUMMARY
            echo "\`\`\`" >> $GITHUB_STEP_SUMMARY
            cat intel_output.log >> $GITHUB_STEP_SUMMARY
            echo "\`\`\`" >> $GITHUB_STEP_SUMMARY
          fi

      - name: Notify on failure
        if: failure()
        run: |
          echo "🚨 Beach Intel Generation Failed"
          if [ -f intel_output.log ]; then
            echo "Last 10 lines:"
            tail -10 intel_output.log
          fi
```

---

### **Phase 4: Client Component** (2-3 hours)

**File:** `components/beach-detail/best-surf-window.tsx`

```typescript
"use client";

import { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { createBrowserClient } from "@/lib/supabase";
import {
  Clock,
  Waves,
  Wind,
  TrendingUp,
  AlertCircle,
  Share2,
} from "lucide-react";

interface BestSurfWindowProps {
  beachId: string;
  beachName: string;
}

export function BestSurfWindow({ beachId, beachName }: BestSurfWindowProps) {
  // Fetch latest intel directly from Supabase
  const fetchIntel = useCallback(async () => {
    const supabase = createBrowserClient();
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("beach_daily_intel")
      .select("*")
      .eq("beach_id", beachId)
      .eq("forecast_date", today)
      .order("generated_at", { ascending: false })
      .limit(1)
      .single();

    if (error) throw error;
    return data;
  }, [beachId]);

  const { data: intel, loading, error, refetch } = useDataFetcher(fetchIntel);

  // Loading state
  if (loading) {
    return (
      <Card className="rounded-3xl border-blue-100/60">
        <CardContent className="p-6">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-6 w-full mb-2" />
          <Skeleton className="h-6 w-full mb-2" />
          <Skeleton className="h-6 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  // Error or no intel available
  if (error || !intel) {
    return (
      <Card className="rounded-3xl border-yellow-100/60 bg-yellow-50/50">
        <CardContent className="p-6 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-yellow-800">
              Intel not available for this beach yet. Check back soon!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Format time for display
  const formatTime = (time: string) => {
    if (!time) return "";
    return new Date(`2000-01-01T${time}`).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const generatedTime = new Date(intel.generated_at).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <Card className="rounded-3xl border-blue-100/60 bg-gradient-to-br from-blue-50/50 to-white shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-xl font-bold text-blue-900">
            🌊 Best Time to Surf Today
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              /* Share functionality */
            }}
            className="h-8 w-8 p-0"
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Updated at {generatedTime}
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Optimal Window */}
        <div className="bg-blue-100/50 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-5 w-5 text-blue-600" />
            <h4 className="font-semibold text-blue-900">Optimal Window</h4>
          </div>
          <p className="text-2xl font-bold text-blue-600">
            {formatTime(intel.best_window_start)} -{" "}
            {formatTime(intel.best_window_end)}
          </p>
          {intel.best_window_description && (
            <p className="text-sm text-blue-700 mt-1">
              {intel.best_window_description}
            </p>
          )}
        </div>

        {/* Conditions Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Surf */}
          <div className="bg-white/80 rounded-xl p-3 border border-blue-100">
            <div className="flex items-center gap-2 mb-1">
              <Waves className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-medium text-muted-foreground">
                Surf
              </span>
            </div>
            <p className="font-semibold text-gray-900">
              {intel.surf_min_ft}-{intel.surf_max_ft} ft
            </p>
            <p className="text-xs text-muted-foreground">
              {intel.surf_description}
            </p>
          </div>

          {/* Wind */}
          <div className="bg-white/80 rounded-xl p-3 border border-blue-100">
            <div className="flex items-center gap-2 mb-1">
              <Wind className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-medium text-muted-foreground">
                Wind
              </span>
            </div>
            <p className="font-semibold text-gray-900">
              {intel.wind_speed_mph} mph {intel.wind_direction_text}
            </p>
            <p className="text-xs text-muted-foreground">
              {intel.wind_quality}
            </p>
          </div>

          {/* Tide */}
          <div className="bg-white/80 rounded-xl p-3 border border-blue-100">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-medium text-muted-foreground">
                Tide
              </span>
            </div>
            <p className="font-semibold text-gray-900">
              {intel.tide_height_ft} ft @ {formatTime(intel.tide_time)}
            </p>
            {intel.tide_optimal_range && (
              <p className="text-xs text-muted-foreground">
                Optimal: {intel.tide_optimal_range}
              </p>
            )}
          </div>

          {/* Confidence */}
          <div className="bg-white/80 rounded-xl p-3 border border-blue-100">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-muted-foreground">
                Confidence
              </span>
            </div>
            <p className="font-semibold text-gray-900">{intel.confidence}</p>
            {intel.conditions_score && (
              <p className="text-xs text-muted-foreground">
                Score: {intel.conditions_score}/100
              </p>
            )}
          </div>
        </div>

        {/* Recommendation */}
        {intel.recommendation && (
          <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100/50">
            <p className="text-sm text-gray-700 leading-relaxed">
              {intel.recommendation}
            </p>
          </div>
        )}

        {/* Next tide */}
        {intel.next_tide_type && (
          <p className="text-xs text-muted-foreground text-center">
            Next {intel.next_tide_type}: {intel.next_tide_height_ft}ft @{" "}
            {intel.next_tide_time}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

---

#### 4.2 Update ForecastAndTides Component

**File:** `components/beach-detail/forecast-and-tides.tsx`

```typescript
// Add to imports
import { BestSurfWindow } from "./best-surf-window";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

// In the Today tab content:
<TabsContent value="today" className="mt-4">
  {/* Check if beach has intel available */}
  <BestSurfWindow beachId={beach.id} beachName={beach.name} />

  {/* Collapsible detailed forecast table */}
  <Collapsible className="mt-4">
    <CollapsibleTrigger asChild>
      <Button variant="ghost" className="w-full justify-between">
        <span>View Detailed Forecast</span>
        <ChevronDown className="h-4 w-4" />
      </Button>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <Card className="rounded-3xl border-blue-100/60 bg-white/95 shadow-lg mt-2">
        <CardContent className="p-6">
          <SimplifiedForecastTable forecasts={todaysForecasts} />
        </CardContent>
      </Card>
    </CollapsibleContent>
  </Collapsible>
</TabsContent>;
```

---

### **Phase 5: Testing** (2 hours)

#### 5.1 Test Intel Generation Locally

```bash
# Set env vars
export SUPABASE_URL="your-url"
export SUPABASE_SERVICE_ROLE_KEY="your-key"

# Run generation
npm run generate-daily-intel
```

#### 5.2 Test Component

- Navigate to beach with intel
- Verify data displays correctly
- Test loading states
- Test error states
- Test mobile responsive

#### 5.3 Test Workflow

- Manual trigger in GitHub Actions
- Verify it runs at scheduled times
- Check logs for errors

---

## 📁 Files Summary

### **New Files (6)**

1. `supabase/migrations/[timestamp]_create_beach_daily_intel.sql`
2. `lib/services/intel-generation-service.ts`
3. `scripts/generate-daily-intel.ts`
4. `.github/workflows/daily-intel.yml`
5. `components/beach-detail/best-surf-window.tsx`
6. `scripts/analyze-top-beaches.sql`

### **Modified Files (4)**

1. `components/beach-detail/forecast-and-tides.tsx`
2. `scripts/morningIntel.ts` - Refactor to use IntelGenerationService
3. `package.json` - Add script
4. `CHANGELOG.md` - Document changes

---

## ⏱️ Timeline

| Phase                    | Time             | Blocker?                 |
| ------------------------ | ---------------- | ------------------------ |
| 0. Select Top 10 Beaches | 30 min           | **YES** - Need beach IDs |
| 1. Database Setup        | 30 min           | NO                       |
| 2. Intel Service         | 3-4 hours        | NO                       |
| 3. GitHub Workflow       | 30 min           | NO                       |
| 4. Client Component      | 2-3 hours        | NO                       |
| 5. Testing               | 2 hours          | NO                       |
| **Total**                | **8.5-11 hours** |                          |

---

## 🚀 Next Steps

### **Step 1: Identify Top 10 Beaches**

Run this SQL query in Supabase to see beach candidates:

```sql
-- Find San Diego beaches with complete preferences
SELECT
    id,
    name,
    location,
    break_type,
    skill_level,
    tide_min_ft,
    tide_max_ft,
    wind_offshore_deg
FROM beaches
WHERE location ILIKE '%San Diego%'
  AND tide_min_ft IS NOT NULL
  AND tide_max_ft IS NOT NULL
ORDER BY name;
```

**Manual Selection Criteria:**

- ✅ Iconic/popular surf spots
- ✅ Geographic diversity (North, Central, South San Diego)
- ✅ Good forecast coverage
- ✅ Complete beach preferences

**Suggested Top 10:**

1. Ocean Beach Pier ✅ (already have ID)
2. Pacific Beach
3. Mission Beach
4. La Jolla Shores
5. Blacks Beach
6. Tourmaline Surf Park
7. Swami's (Encinitas)
8. Cardiff Reef
9. Oceanside Pier
10. Del Mar

### **Step 2: Add Beach IDs to Script**

Update `scripts/generate-daily-intel.ts`:

```typescript
const TOP_BEACHES_MANUAL = [
  "65d177de-e75a-4ad8-aa0d-48a67c0851b0", // Ocean Beach Pier
  "beach-id-2", // Pacific Beach
  "beach-id-3", // Mission Beach
  // ... add remaining 7
];
```

### **Step 3: Begin Implementation**

Start with Phase 1 (Database Setup)

---

## 💰 Cost Analysis

| Service            | Usage                                                 | Cost                   |
| ------------------ | ----------------------------------------------------- | ---------------------- |
| **GitHub Actions** | 3 runs/day × 2 min = 6 min/day = 180 min/month        | FREE (2,000 min/month) |
| **Supabase**       | 10 beaches × 3 times/day × 30 days = 900 writes/month | FREE (included)        |
| **Vercel**         | 0 edge function calls                                 | FREE                   |

**Total: $0/month** ✅

---

## 🎁 Benefits

### **User Experience**

- ✅ Instant intel (pre-computed)
- ✅ Fresh data (3x daily updates)
- ✅ No loading delays
- ✅ Actionable recommendations

### **Technical**

- ✅ Zero Vercel costs
- ✅ Scalable to 100+ beaches
- ✅ Reliable (pre-generated)
- ✅ DRY (reuses morning-intel logic)

### **Growth**

- ✅ Helps users decide when to surf
- ✅ Builds trust (accurate recommendations)
- ✅ Differentiates from competitors
- ✅ Shareable intel summaries

---

## 📝 Future Enhancements

**After Launch:**

1. Add share to social media functionality
2. Push notifications for optimal surf windows
3. Historical accuracy tracking
4. Personalized recommendations based on skill level
5. Expand to more beaches (top 50-100)
6. Comparison mode (compare multiple beaches)
7. Weather alerts integration

---

**Last Updated:** October 7, 2025  
**Status:** Ready for implementation  
**Next Action:** Select top 10 beaches
