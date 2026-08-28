# Reddit-Informed Feature Implementation Guide

**Design-Reviewed Implementation Roadmap for Quiver**

This guide provides step-by-step instructions for implementing Reddit user-informed features following Quiver's architecture patterns, DRY principles, and growth-focused strategy.

**Last Updated:** January 2025 (Implementation Status Review)  
**Status:** Phase 1 Partially Complete (3/7 features), Phase 2 Partially Complete (1/6 features)

## Overall Implementation Progress

**Phase 1 (MVP)**: 3 of 7 features complete (43%)

- ✅ 1.2 Observed vs. Modeled Labels
- ✅ 1.4 Confidence Indicator
- ✅ 1.5 Session Logging & Rating Foundation (partial)
- ❌ 1.1 Beginner Fit Badges
- ❌ 1.3 Water Temperature & Anomaly Alerts
- ❌ 1.6 Initial Education Content
- ❌ 1.7 Crowd/Safety Disclaimer

**Phase 2 (Advanced Personalization)**: 1 of 6 features complete (17%)

- ✅ 2.1 Preference Modeling & Match Scores (backend complete, UI pending)
- ❌ 2.2 Explainer Panel
- ❌ 2.3 Toggle Observed Heights
- ❌ 2.4 Expanded Education
- 🔶 2.5 Community Notes (Intel system exists)
- ❌ 2.6 Regional Fairness

**Phase 3 (Full Release)**: 0 of 3 features complete (0%)

---

## 📋 Table of Contents

1. [Implementation Status](#implementation-status)
2. [Phase 1: MVP - Core UX and Data Features](#phase-1-mvp---core-ux-and-data-features)
3. [Phase 2: Advanced Personalization & UX](#phase-2-advanced-personalization--ux-enhancements)
4. [Phase 3: Full Release](#phase-3-full-release---refinement--equity)
5. [Architectural Guidelines](#architectural-guidelines)
6. [Testing Requirements](#testing-requirements)

---

## Implementation Status

### ✅ Completed Features

**Phase 1 - Core UX Features:**

- **1.2 Observed vs. Modeled Labels** - Implemented via `components/forecast/forecast-data-source-indicator.tsx`

  - Shows CDIP buoy data vs NOAA forecast data
  - Displays confidence scores and data source details
  - Includes fallback location indicators

- **1.4 Confidence Indicator** - Implemented via `components/forecast/forecast-confidence-badge.tsx`

  - Visual badges showing High/Medium/Low confidence (75%/50% thresholds)
  - Color-coded indicators integrated into forecast displays

- **1.5 Session Logging & Rating Foundation** - Partially implemented
  - Sessions table includes basic `rating` field (smallint)
  - Session creation and logging fully functional
  - ⚠️ Missing: Separate `experience_rating` and `conditions_accuracy` fields (see recommendations below)

**Additional Implemented Features:**

- **Forecast Accuracy Verification** - `forecast_accuracy_votes` table with voting system

  - Users can vote on forecast accuracy
  - Tracks actual vs predicted conditions
  - Streak tracking for verification contributions

- **Beach Photos** - Openverse API integration for beach imagery

  - Automated photo fetching and storage
  - Attribution tracking for CC-licensed photos

- **Intel Posts** - Community condition reporting system

  - Deduplication for duplicate posts
  - Tagging system (conditions, parking, crowd, access)
  - Geographic location tracking

- **Beach Reviews** - Comprehensive 5-category rating system
  - Overall, wave quality, crowd density, parking, accessibility ratings

### 🚧 In Progress / Not Yet Implemented

**Phase 1 - Remaining Features:**

- **1.1 Beginner "Fit" Badges** - Not implemented
- **1.3 Water Temperature & Anomaly Alerts** - Not implemented
- **1.6 Initial Education Content** - Not implemented
- **1.7 Crowd/Safety Disclaimer** - Not implemented

**Phase 2 - Advanced Personalization:**

- **2.1 Preference Modeling & Match Scores** - ✅ **PARTIALLY IMPLEMENTED**
  - `lib/services/preference-learning-service.ts` - Learns preferences from session history
  - `lib/services/personalized-scoring-service.ts` - Scores beaches for users
  - User surf preferences table (`user_surf_preferences`) tracks learned preferences
  - Beach affinity system (`user_beach_affinity`) tracks familiarity
  - ⚠️ Missing: UI components to display match scores to users
  - ⚠️ Missing: Explainer panels for "why this forecast" recommendations
- **2.2 "Why This Forecast?" Explainer Panel** - ❌ Not implemented
- **2.3 Toggle Observed Surf Heights** - ❌ Not implemented
- **2.4 Expanded Education Modules** - ❌ Not implemented
- **2.5 Community Notes & Heuristics** - 🔶 Intel posts system exists, but not formal heuristics
- **2.6 Regional Fairness Adjustments** - ❌ Not implemented

#### Beginner practice-day heuristic

Reddit feedback suggests beginners should not wait for perfect surf or use a rigid
wave-height cutoff. Recommend a session when waves are small, soft, and catchable,
with manageable local hazards at a familiar or sheltered break. Small waves with
short period or onshore wind can still be useful practice, but strong chop, current,
poor visibility, or an uncertain exit should move the recommendation to wait, find a
cleaner window, or go with someone more experienced.

Product guidance: describe these as **good for practice**, not automatically “good
surf.” Wave height is contextual; wave shape, period, wind, break exposure, and
local safety conditions determine whether a beginner should go.

**Phase 3 - Full Release:**

- All features pending (advanced guides, anomaly analysis, performance optimization)

### 📝 Recommendations for Next Implementation

1. **Complete Session Rating System** - Add separate experience and accuracy ratings
2. **Implement Beginner Badges** - High value, medium complexity
3. **Add Temperature Anomaly Detection** - Leverage existing buoy data
4. **Create Education Content** - Modal/page with basic primers on forecast reading

---

## 🏗️ Architectural Guidelines

### Core Principles

**DRY (Don't Repeat Yourself)**

- Reuse existing components from [components/](../components/)
- Extend base UI components from [components/ui/](../components/ui/)
- Follow compound component patterns

**Data Access Pattern**

```typescript
// ✅ CORRECT: Use data gateway
import { data } from "@/lib/data/client";

// ✅ CORRECT: Extend data gateway for new endpoints
// Add to lib/data/client.ts:
export const data = {
  forecasts: {
    async getConfidence(beachId: string) {
      const res = await fetch(`/api/beaches/${beachId}/forecast/confidence`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Failed to load confidence: ${res.status}`);
      return res.json();
    },
  },
};
```

**Component Patterns**

```typescript
// Standard component interface
interface ComponentProps {
  // Required props first
  data: DataType;
  onAction: (param: Type) => void;

  // Optional configuration
  variant?: "default" | "compact" | "detailed";
  size?: "sm" | "md" | "lg";

  // Display options
  loading?: boolean;
  error?: string | null;
  className?: string;
}
```

**Mobile-First Design**

- Start with mobile layouts
- Use responsive breakpoints: `sm:`, `md:`, `lg:`, `xl:`
- Touch-friendly targets (minimum 44px)
- Test on actual devices

**Semantic Colors**

```tsx
// ✅ USE: Semantic colors from design system
<div className="bg-background text-foreground border-border">

// ❌ AVOID: Hard-coded colors
<div className="bg-white text-black border-gray-200">
```

---

## Phase 1: MVP - Core UX and Data Features

### 1.1 Beginner "Fit" Badges

**User Need**: Replace numeric beginner score with intuitive visual indicators

**Complexity**: Medium | **Value**: High | **Dependencies**: Existing wave/wind/tide data

#### Step 1: Create Badge Component

Create `components/forecast/beginner-fit-badges.tsx`:

```typescript
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface BeginnerFitBadgesProps {
  waveHeight?: number;
  wavePeriod?: number;
  windSpeed?: number;
  crowdLevel?: string;
  variant?: "compact" | "detailed";
  className?: string;
}

type FitBadge = {
  label: string;
  description: string;
  active: boolean;
  color: "success" | "warning" | "default";
};

export function BeginnerFitBadges({
  waveHeight,
  wavePeriod,
  windSpeed,
  crowdLevel,
  variant = "compact",
  className,
}: BeginnerFitBadgesProps) {
  const badges: FitBadge[] = [
    {
      label: "Soft Roll",
      description: "Wave height under 3ft with long period (12s+)",
      active: (waveHeight || 0) < 3 && (wavePeriod || 0) >= 12,
      color:
        (waveHeight || 0) < 3 && (wavePeriod || 0) >= 12
          ? "success"
          : "default",
    },
    {
      label: "Small Faces",
      description: "Wave faces suitable for beginners (2-4ft)",
      active: (waveHeight || 0) >= 2 && (waveHeight || 0) <= 4,
      color:
        (waveHeight || 0) >= 2 && (waveHeight || 0) <= 4
          ? "success"
          : "default",
    },
    {
      label: "Low Wind",
      description: "Light winds (under 10mph) for clean conditions",
      active: (windSpeed || 0) < 10,
      color: (windSpeed || 0) < 10 ? "success" : "default",
    },
    {
      label: "Friendly Currents",
      description: "Minimal rip current risk",
      active: (waveHeight || 0) < 3 && (windSpeed || 0) < 15,
      color:
        (waveHeight || 0) < 3 && (windSpeed || 0) < 15 ? "success" : "default",
    },
  ];

  return (
    <div className={`flex flex-wrap gap-2 ${className || ""}`}>
      {badges.map((badge) => (
        <TooltipProvider key={badge.label}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant={badge.active ? "default" : "outline"}
                className={
                  badge.active ? "bg-success text-success-foreground" : ""
                }
              >
                {badge.label}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-sm">{badge.description}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  );
}
```

#### Step 2: Integrate into Forecast Display

Update [components/forecast/forecast-display.tsx](../components/forecast/forecast-display.tsx):

```typescript
import { BeginnerFitBadges } from "./beginner-fit-badges";

// Inside the forecast display component:
<section className="space-y-2">
  <h3 className="text-sm font-medium">Beginner Conditions</h3>
  <BeginnerFitBadges
    waveHeight={forecast.waveHeight}
    wavePeriod={forecast.wavePeriod}
    windSpeed={forecast.windSpeed}
    variant="compact"
  />
</section>;
```

#### Step 3: Add Unit Tests

Create `__tests__/components/forecast/beginner-fit-badges.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { BeginnerFitBadges } from "@/components/forecast/beginner-fit-badges";

describe("BeginnerFitBadges", () => {
  it("shows active Soft Roll badge for ideal conditions", () => {
    render(
      <BeginnerFitBadges waveHeight={2.5} wavePeriod={14} windSpeed={5} />
    );

    const softRollBadge = screen.getByText("Soft Roll");
    expect(softRollBadge).toBeInTheDocument();
    expect(softRollBadge.parentElement).toHaveClass("bg-success");
  });

  it("shows inactive badges for non-beginner conditions", () => {
    render(<BeginnerFitBadges waveHeight={8} wavePeriod={8} windSpeed={20} />);

    const badges = screen.getAllByRole("status");
    badges.forEach((badge) => {
      expect(badge).not.toHaveClass("bg-success");
    });
  });
});
```

#### Step 4: E2E Testing

Add to `e2e/forecast-components.spec.ts`:

```typescript
test("displays beginner fit badges with correct states", async ({ page }) => {
  await page.goto("/beach/ocean-beach");

  // Check badges are visible
  await expect(page.getByText("Soft Roll")).toBeVisible();
  await expect(page.getByText("Small Faces")).toBeVisible();

  // Verify tooltip shows on hover
  await page.getByText("Soft Roll").hover();
  await expect(page.getByText(/Wave height under 3ft/)).toBeVisible();
});
```

---

### 1.2 Observed vs. Modeled Labels

**User Need**: Distinguish buoy data from model forecasts

**Complexity**: Low | **Value**: High | **Dependencies**: Data provenance tracking

#### Step 1: Create Data Source Indicator Component

Create `components/forecast/data-source-badge.tsx`:

```typescript
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Eye, Brain } from "lucide-react";

type DataSource = "observed" | "modeled" | "hybrid";

interface DataSourceBadgeProps {
  source: DataSource;
  confidence?: number; // 0-100
  variant?: "compact" | "detailed";
  className?: string;
}

export function DataSourceBadge({
  source,
  confidence,
  variant = "compact",
  className,
}: DataSourceBadgeProps) {
  const sourceConfig = {
    observed: {
      label: "Observed",
      icon: Eye,
      description: "Real-time data from NOAA buoys and cameras",
      color: "bg-success text-success-foreground",
    },
    modeled: {
      label: "Modeled",
      icon: Brain,
      description: "WaveWatch III forecast model",
      color: "bg-accent text-accent-foreground",
    },
    hybrid: {
      label: "Hybrid",
      icon: Eye,
      description: "Combination of observed and modeled data",
      color: "bg-secondary text-secondary-foreground",
    },
  };

  const config = sourceConfig[source];
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`${config.color} ${className || ""}`}
          >
            <Icon className="w-3 h-3 mr-1" />
            {config.label}
            {confidence !== undefined && variant === "detailed" && (
              <span className="ml-1 text-xs">({confidence}%)</span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="text-sm font-medium">{config.description}</p>
            {confidence !== undefined && (
              <p className="text-xs text-muted-foreground">
                Confidence: {confidence}%
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

#### Step 2: Add Data Source to API Response

Create migration `supabase/migrations/[timestamp]_add_forecast_source.sql`:

```sql
-- Add source column to forecast data
ALTER TABLE forecasts ADD COLUMN IF NOT EXISTS data_source VARCHAR(20) DEFAULT 'modeled';
ALTER TABLE forecasts ADD COLUMN IF NOT EXISTS confidence_score INTEGER;

-- Add index for filtering
CREATE INDEX IF NOT EXISTS idx_forecasts_data_source ON forecasts(data_source);

-- Add constraint
ALTER TABLE forecasts ADD CONSTRAINT check_data_source
  CHECK (data_source IN ('observed', 'modeled', 'hybrid'));
```

#### Step 3: Update Data Gateway

Add to [lib/data/client.ts](../lib/data/client.ts):

```typescript
export const data = {
  // ... existing code
  forecasts: {
    async getWithSource(beachId: string, date: string) {
      const res = await fetch(
        `/api/beaches/${beachId}/forecast?date=${date}&includeSource=true`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        }
      );
      if (!res.ok) throw new Error(`Failed to load forecast: ${res.status}`);
      const json = await res.json();
      return json.data;
    },
  },
};
```

#### Step 4: Integrate into Forecast Components

Update forecast display components to show data source:

```typescript
import { DataSourceBadge } from "./data-source-badge";

// In forecast display:
<div className="flex items-center gap-2 mb-4">
  <h3 className="text-lg font-semibold">Wave Conditions</h3>
  <DataSourceBadge
    source={forecast.dataSource}
    confidence={forecast.confidenceScore}
    variant="detailed"
  />
</div>;
```

---

### 1.3 Water Temperature & Anomaly Alerts

**User Need**: Detect upwelling events and temperature anomalies

**Complexity**: Medium | **Value**: High | **Dependencies**: Buoy network data

#### Step 1: Create Temperature Anomaly Component

Create `components/buoy/temperature-anomaly-alert.tsx`:

```typescript
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Thermometer, AlertTriangle } from "lucide-react";

interface TemperatureAnomalyAlertProps {
  buoyTemp: number;
  forecastTemp: number;
  threshold?: number; // Default 4°F
  className?: string;
}

export function TemperatureAnomalyAlert({
  buoyTemp,
  forecastTemp,
  threshold = 4,
  className,
}: TemperatureAnomalyAlertProps) {
  const delta = Math.abs(buoyTemp - forecastTemp);
  const isAnomaly = delta >= threshold;
  const isUpwelling = buoyTemp < forecastTemp - threshold;

  if (!isAnomaly) return null;

  return (
    <Alert
      variant={isUpwelling ? "destructive" : "default"}
      className={className}
    >
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        <Thermometer className="h-4 w-4" />
        Temperature Anomaly Detected
      </AlertTitle>
      <AlertDescription>
        <div className="space-y-2 text-sm">
          <p>
            <strong>Buoy reading:</strong> {buoyTemp}°F |{" "}
            <strong>Forecast:</strong> {forecastTemp}°F
          </p>
          <p className="text-muted-foreground">
            Difference of {delta.toFixed(1)}°F detected.
            {isUpwelling && (
              <span className="block mt-1 font-medium text-destructive">
                Possible upwelling event. Water may be colder than expected.
              </span>
            )}
          </p>
        </div>
      </AlertDescription>
    </Alert>
  );
}
```

#### Step 2: Add Temperature Comparison Logic

Create `lib/utils/temperature-anomaly.ts`:

```typescript
export interface TemperatureData {
  buoyTemp: number;
  forecastTemp: number;
  satelliteTemp?: number;
}

export interface AnomalyResult {
  hasAnomaly: boolean;
  delta: number;
  isUpwelling: boolean;
  severity: "low" | "medium" | "high";
  message: string;
}

export function detectTemperatureAnomaly(
  data: TemperatureData,
  threshold = 4
): AnomalyResult {
  const delta = Math.abs(data.buoyTemp - data.forecastTemp);
  const hasAnomaly = delta >= threshold;
  const isUpwelling = data.buoyTemp < data.forecastTemp - threshold;

  let severity: "low" | "medium" | "high" = "low";
  if (delta >= 7) severity = "high";
  else if (delta >= 5) severity = "medium";

  let message = "Water temperature matches forecast.";
  if (hasAnomaly) {
    message = isUpwelling
      ? `Upwelling detected: Water ${delta.toFixed(1)}°F colder than forecast.`
      : `Temperature anomaly: ${delta.toFixed(1)}°F difference detected.`;
  }

  return {
    hasAnomaly,
    delta,
    isUpwelling,
    severity,
    message,
  };
}
```

#### Step 3: Integrate into Beach Detail Page

Update buoy display in beach detail:

```typescript
import { TemperatureAnomalyAlert } from "@/components/buoy/temperature-anomaly-alert";
import { detectTemperatureAnomaly } from "@/lib/utils/temperature-anomaly";

// In beach detail component:
const anomaly = detectTemperatureAnomaly({
  buoyTemp: buoyData.waterTemp,
  forecastTemp: forecast.waterTemp,
});

return (
  <div className="space-y-4">
    {/* Existing buoy display */}

    {anomaly.hasAnomaly && (
      <TemperatureAnomalyAlert
        buoyTemp={buoyData.waterTemp}
        forecastTemp={forecast.waterTemp}
      />
    )}
  </div>
);
```

---

### 1.4 Confidence Indicator

**User Need**: Visual representation of forecast reliability

**Complexity**: Low | **Value**: Medium | **Dependencies**: Confidence scores

#### Step 1: Create Confidence Bar Component

Create `components/forecast/confidence-bar.tsx`:

```typescript
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ConfidenceBarProps {
  confidence: number; // 0-100
  variant?: "minimal" | "detailed";
  showLabel?: boolean;
  className?: string;
}

export function ConfidenceBar({
  confidence,
  variant = "minimal",
  showLabel = true,
  className,
}: ConfidenceBarProps) {
  const getConfidenceLevel = (score: number) => {
    if (score >= 80) return { label: "High", color: "bg-success" };
    if (score >= 60) return { label: "Medium", color: "bg-warning" };
    return { label: "Low", color: "bg-destructive" };
  };

  const level = getConfidenceLevel(confidence);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`space-y-1 ${className || ""}`}>
            {showLabel && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Forecast Confidence</span>
                <span className="font-medium text-foreground">
                  {level.label} ({confidence}%)
                </span>
              </div>
            )}
            <Progress value={confidence} className="h-2" />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1 text-xs">
            <p className="font-medium">Confidence: {level.label}</p>
            <p className="text-muted-foreground">
              Based on data quality, model agreement, and historical accuracy
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

#### Step 2: Integrate into Forecast Cards

Add confidence bars to all forecast displays:

```typescript
import { ConfidenceBar } from "@/components/forecast/confidence-bar";

// In forecast card:
<Card>
  <CardHeader>
    <CardTitle>12:00 PM</CardTitle>
    <ConfidenceBar confidence={forecast.confidence} variant="minimal" />
  </CardHeader>
  <CardContent>{/* Forecast details */}</CardContent>
</Card>;
```

---

### 1.5 Session Logging & Rating Foundation

**User Need**: Capture actual surf experience for personalization

**Complexity**: Low | **Value**: High | **Dependencies**: Session table

#### Step 1: Add Rating Field to Database

Create migration `supabase/migrations/[timestamp]_add_session_rating.sql`:

```sql
-- Add rating column to sessions
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS experience_rating INTEGER;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS conditions_accuracy INTEGER;

-- Add constraints
ALTER TABLE sessions ADD CONSTRAINT check_experience_rating
  CHECK (experience_rating BETWEEN 1 AND 5);

ALTER TABLE sessions ADD CONSTRAINT check_conditions_accuracy
  CHECK (conditions_accuracy BETWEEN 1 AND 5);

-- Add comment for documentation
COMMENT ON COLUMN sessions.experience_rating IS 'User rating of session experience (1-5 stars)';
COMMENT ON COLUMN sessions.conditions_accuracy IS 'User rating of forecast accuracy (1-5 stars)';
```

#### Step 2: Create Rating Widget Component

Create `components/session-forms/session-rating-widget.tsx`:

```typescript
import { Star } from "lucide-react";
import { Label } from "@/components/ui/label";

interface SessionRatingWidgetProps {
  value: number;
  onChange: (rating: number) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

export function SessionRatingWidget({
  value,
  onChange,
  label,
  description,
  disabled = false,
}: SessionRatingWidgetProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            disabled={disabled}
            className="focus:outline-none focus:ring-2 focus:ring-primary rounded"
            aria-label={`Rate ${star} stars`}
          >
            <Star
              className={`w-8 h-8 transition-colors ${
                star <= value
                  ? "fill-primary text-primary"
                  : "text-muted-foreground"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
```

#### Step 3: Integrate into Session Form

Update [components/session-forms/SessionForm.tsx](../components/session-forms/SessionForm.tsx):

```typescript
import { SessionRatingWidget } from "./session-rating-widget";

// Add to form state:
const [experienceRating, setExperienceRating] = useState(0);
const [conditionsAccuracy, setConditionsAccuracy] = useState(0);

// Add to form UI (in a new section):
<section className="space-y-4">
  <h3 className="text-lg font-semibold">Rate Your Session</h3>

  <SessionRatingWidget
    value={experienceRating}
    onChange={setExperienceRating}
    label="Overall Experience"
    description="How was your surf session?"
  />

  <SessionRatingWidget
    value={conditionsAccuracy}
    onChange={setConditionsAccuracy}
    label="Forecast Accuracy"
    description="How accurate was the forecast?"
  />
</section>;
```

#### Step 4: Update Session Actions

Update session creation action to include ratings:

```typescript
// In actions/session-actions.ts
export async function createSession(data: SessionFormData) {
  const session = await supabase
    .from("sessions")
    .insert({
      ...data,
      experience_rating: data.experienceRating,
      conditions_accuracy: data.conditionsAccuracy,
    })
    .select()
    .single();

  return session;
}
```

---

### 1.6 Initial Education Content

**User Need**: Help users understand forecast data

**Complexity**: Low | **Value**: Medium | **Dependencies**: None

#### Step 1: Create Education Modal Component

Create `components/education/learn-modal.tsx`:

```typescript
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LearnModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTopic?: "forecasts" | "tides" | "buoys" | "safety";
}

export function LearnModal({
  open,
  onOpenChange,
  initialTopic = "forecasts",
}: LearnModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Learn to Read Surf Conditions</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue={initialTopic} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="forecasts">Forecasts</TabsTrigger>
            <TabsTrigger value="tides">Tides</TabsTrigger>
            <TabsTrigger value="buoys">Buoys</TabsTrigger>
            <TabsTrigger value="safety">Safety</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[60vh] mt-4">
            <TabsContent value="forecasts" className="space-y-4">
              <section>
                <h3 className="font-semibold mb-2">
                  Understanding Wave Forecasts
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Wave forecasts use computer models to predict ocean
                  conditions. Here's what the key metrics mean:
                </p>

                <div className="space-y-3">
                  <div className="bg-muted p-3 rounded-lg">
                    <h4 className="font-medium text-sm">Wave Height</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Measured from trough to crest. Face height (what surfers
                      see) is typically 1.5-2x the reported height.
                    </p>
                  </div>

                  <div className="bg-muted p-3 rounded-lg">
                    <h4 className="font-medium text-sm">Wave Period</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Time between waves in seconds. Longer periods (12s+) mean
                      more powerful waves with better shape.
                    </p>
                  </div>

                  <div className="bg-muted p-3 rounded-lg">
                    <h4 className="font-medium text-sm">Swell Direction</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Compass direction waves are coming from. Different beaches
                      work better with different directions.
                    </p>
                  </div>
                </div>
              </section>
            </TabsContent>

            <TabsContent value="tides" className="space-y-4">
              <section>
                <h3 className="font-semibold mb-2">Reading Tide Charts</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Tides dramatically affect surf conditions. Most breaks have a
                  preferred tide window.
                </p>

                <div className="space-y-3">
                  <div className="bg-muted p-3 rounded-lg">
                    <h4 className="font-medium text-sm">
                      Incoming (Flooding) Tide
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Water level rising. Can improve some breaks as it covers
                      shallow rocks.
                    </p>
                  </div>

                  <div className="bg-muted p-3 rounded-lg">
                    <h4 className="font-medium text-sm">
                      Outgoing (Ebbing) Tide
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Water level dropping. May create stronger currents but
                      better waves at some spots.
                    </p>
                  </div>

                  <div className="bg-muted p-3 rounded-lg">
                    <h4 className="font-medium text-sm">High/Low Tide</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Extreme points of tide cycle. Each break performs
                      differently at these times.
                    </p>
                  </div>
                </div>
              </section>
            </TabsContent>

            <TabsContent value="buoys" className="space-y-4">
              <section>
                <h3 className="font-semibold mb-2">Understanding Buoy Data</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Buoys provide real-time ocean observations from offshore
                  instruments.
                </p>

                <div className="space-y-3">
                  <div className="bg-muted p-3 rounded-lg">
                    <h4 className="font-medium text-sm">Why Buoys Matter</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Buoy data is observed (real), not modeled. Use it to
                      verify forecasts and detect anomalies.
                    </p>
                  </div>

                  <div className="bg-muted p-3 rounded-lg">
                    <h4 className="font-medium text-sm">Wave Spectrum</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Shows energy distribution across frequencies. Helps
                      identify multiple swells.
                    </p>
                  </div>

                  <div className="bg-muted p-3 rounded-lg">
                    <h4 className="font-medium text-sm">Water Temperature</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Real-time water temp. Large differences from forecast may
                      indicate upwelling.
                    </p>
                  </div>
                </div>
              </section>
            </TabsContent>

            <TabsContent value="safety" className="space-y-4">
              <section>
                <h3 className="font-semibold mb-2">Ocean Safety Basics</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Understanding conditions helps you make safe decisions.
                </p>

                <div className="space-y-3">
                  <div className="bg-destructive/10 p-3 rounded-lg border border-destructive">
                    <h4 className="font-medium text-sm text-destructive">
                      Rip Currents
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Fast-moving channels of water going offshore. Swim
                      parallel to shore to escape.
                    </p>
                  </div>

                  <div className="bg-muted p-3 rounded-lg">
                    <h4 className="font-medium text-sm">Know Your Limits</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Start with small conditions. Gradually progress as your
                      skills improve.
                    </p>
                  </div>

                  <div className="bg-muted p-3 rounded-lg">
                    <h4 className="font-medium text-sm">Local Knowledge</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Talk to locals. Every break has unique hazards and
                      etiquette.
                    </p>
                  </div>
                </div>
              </section>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
```

#### Step 2: Add Learn Button to App Header

Update [components/app-header.tsx](../components/app-header.tsx):

```typescript
import { BookOpen } from "lucide-react";
import { LearnModal } from "./education/learn-modal";
import { useState } from "react";

// Inside AppHeader component:
const [learnModalOpen, setLearnModalOpen] = useState(false);

// Add to header navigation:
<Button
  variant="ghost"
  size="sm"
  onClick={() => setLearnModalOpen(true)}
>
  <BookOpen className="h-4 w-4 mr-2" />
  Learn
</Button>

<LearnModal open={learnModalOpen} onOpenChange={setLearnModalOpen} />
```

---

### 1.7 Crowd/Safety Disclaimer

**User Need**: Clear communication that crowd predictions aren't provided

**Complexity**: Low | **Value**: Essential | **Dependencies**: None

#### Step 1: Create Disclaimer Component

Create `components/ui/crowd-safety-disclaimer.tsx`:

```typescript
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

export function CrowdSafetyDisclaimer() {
  return (
    <Alert variant="default" className="border-muted">
      <Info className="h-4 w-4" />
      <AlertDescription className="text-xs text-muted-foreground">
        <strong>Note:</strong> Quiver does not predict crowd levels or guarantee
        safety conditions. Always assess conditions yourself, check with locals,
        and surf within your ability level. Ocean conditions can change rapidly
        and forecasts are not always accurate.
      </AlertDescription>
    </Alert>
  );
}
```

#### Step 2: Add to Key Pages

Add disclaimer to beach detail and forecast pages:

```typescript
import { CrowdSafetyDisclaimer } from "@/components/ui/crowd-safety-disclaimer";

// In beach detail page:
<section className="space-y-4">
  <ForecastDisplay forecast={forecast} />
  <CrowdSafetyDisclaimer />
</section>;
```

#### Step 3: Add to FAQ/Help Page

Create or update help documentation:

```markdown
## What Quiver Does NOT Provide

### Crowd Predictions

Quiver does not predict how crowded a beach will be. Crowd levels vary by:

- Time of day and week
- Season and weather
- Local events
- Surf quality

We recommend checking webcams, arriving early, or asking locals for crowd information.

### Safety Guarantees

Forecasts are predictions, not guarantees. Always:

- Assess conditions yourself before entering the water
- Know your limits and surf within them
- Be aware of local hazards
- Check with lifeguards when available
- Understand rip currents and how to escape them
```

---

## Phase 2: Advanced Personalization & UX Enhancements

### 2.1 Preference Modeling & Match Scores

**User Need**: Personalized condition recommendations based on past sessions

**Complexity**: High | **Value**: High | **Dependencies**: Rated session data (Phase 1.5)

#### Step 1: Create Preference Model Types

Create `lib/types/preference-model.ts`:

```typescript
export interface UserPreferences {
  userId: string;
  preferredWaveHeight: { min: number; max: number; ideal: number };
  preferredWavePeriod: { min: number; ideal: number };
  preferredWindSpeed: { max: number };
  preferredWindDirection: string[];
  preferredTideStage: ("low" | "mid" | "high")[];
  confidenceLevel: number; // Based on number of rated sessions
  lastUpdated: Date;
}

export interface ConditionMatchScore {
  overall: number; // 0-100
  breakdown: {
    waveHeight: number;
    wavePeriod: number;
    wind: number;
    tide: number;
  };
  reasoning: string[];
}
```

#### Step 2: Create Preference Learning Algorithm

Create `lib/services/preference-learner.ts`:

```typescript
import {
  UserPreferences,
  ConditionMatchScore,
} from "@/lib/types/preference-model";

interface SessionDataPoint {
  experienceRating: number;
  waveHeight: number;
  wavePeriod: number;
  windSpeed: number;
  windDirection: string;
  tideStage: string;
}

export class PreferenceLearner {
  /**
   * Infer user preferences from rated sessions
   * Uses weighted average based on ratings
   */
  static inferPreferences(
    sessions: SessionDataPoint[],
    userId: string
  ): UserPreferences {
    // Filter to well-rated sessions (4-5 stars)
    const goodSessions = sessions.filter((s) => s.experienceRating >= 4);

    if (goodSessions.length === 0) {
      // Return defaults for new users
      return this.getDefaultPreferences(userId);
    }

    // Calculate weighted averages
    const totalWeight = goodSessions.reduce(
      (sum, s) => sum + s.experienceRating,
      0
    );

    const avgWaveHeight =
      goodSessions.reduce(
        (sum, s) => sum + s.waveHeight * s.experienceRating,
        0
      ) / totalWeight;

    const avgWavePeriod =
      goodSessions.reduce(
        (sum, s) => sum + s.wavePeriod * s.experienceRating,
        0
      ) / totalWeight;

    const avgWindSpeed =
      goodSessions.reduce(
        (sum, s) => sum + s.windSpeed * s.experienceRating,
        0
      ) / totalWeight;

    // Calculate ranges (standard deviation)
    const heightStdDev = this.calculateStdDev(
      goodSessions.map((s) => s.waveHeight),
      avgWaveHeight
    );

    return {
      userId,
      preferredWaveHeight: {
        min: Math.max(0, avgWaveHeight - heightStdDev),
        max: avgWaveHeight + heightStdDev,
        ideal: avgWaveHeight,
      },
      preferredWavePeriod: {
        min: avgWavePeriod - 2,
        ideal: avgWavePeriod,
      },
      preferredWindSpeed: {
        max: avgWindSpeed + 5,
      },
      preferredWindDirection: this.getMostFrequentDirections(goodSessions),
      preferredTideStage: this.getMostFrequentTideStages(goodSessions),
      confidenceLevel: Math.min(100, (goodSessions.length / 10) * 100),
      lastUpdated: new Date(),
    };
  }

  /**
   * Calculate match score for given conditions
   */
  static calculateMatchScore(
    conditions: {
      waveHeight: number;
      wavePeriod: number;
      windSpeed: number;
      windDirection: string;
      tideStage: string;
    },
    preferences: UserPreferences
  ): ConditionMatchScore {
    const reasoning: string[] = [];

    // Wave height score (0-100)
    const heightScore = this.scoreInRange(
      conditions.waveHeight,
      preferences.preferredWaveHeight.min,
      preferences.preferredWaveHeight.max,
      preferences.preferredWaveHeight.ideal
    );
    if (heightScore >= 80) {
      reasoning.push(
        `Wave height (${conditions.waveHeight}ft) matches your preference`
      );
    } else if (heightScore < 50) {
      reasoning.push(`Wave height is outside your typical range`);
    }

    // Wave period score
    const periodScore =
      conditions.wavePeriod >= preferences.preferredWavePeriod.min ? 100 : 50;
    if (periodScore === 100) {
      reasoning.push(`Good wave period (${conditions.wavePeriod}s)`);
    }

    // Wind score
    const windScore =
      conditions.windSpeed <= preferences.preferredWindSpeed.max
        ? 100
        : Math.max(
            0,
            100 -
              (conditions.windSpeed - preferences.preferredWindSpeed.max) * 10
          );
    if (windScore >= 80) {
      reasoning.push("Wind conditions favorable");
    } else if (windScore < 50) {
      reasoning.push("Wind may be too strong for your preference");
    }

    // Tide score
    const tideScore = preferences.preferredTideStage.includes(
      conditions.tideStage as any
    )
      ? 100
      : 50;
    if (tideScore === 100) {
      reasoning.push(`${conditions.tideStage} tide matches your preference`);
    }

    // Overall weighted score
    const overall = Math.round(
      heightScore * 0.4 + periodScore * 0.3 + windScore * 0.2 + tideScore * 0.1
    );

    return {
      overall,
      breakdown: {
        waveHeight: heightScore,
        wavePeriod: periodScore,
        wind: windScore,
        tide: tideScore,
      },
      reasoning,
    };
  }

  private static scoreInRange(
    value: number,
    min: number,
    max: number,
    ideal: number
  ): number {
    if (value < min || value > max) {
      // Outside range - score based on distance
      const distanceFromRange = value < min ? min - value : value - max;
      return Math.max(0, 100 - distanceFromRange * 20);
    }

    // Inside range - score based on distance from ideal
    const distanceFromIdeal = Math.abs(value - ideal);
    return Math.max(0, 100 - distanceFromIdeal * 10);
  }

  private static calculateStdDev(values: number[], mean: number): number {
    const squareDiffs = values.map((v) => Math.pow(v - mean, 2));
    const avgSquareDiff =
      squareDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquareDiff);
  }

  private static getMostFrequentDirections(
    sessions: SessionDataPoint[]
  ): string[] {
    const directionCounts = sessions.reduce((acc, s) => {
      acc[s.windDirection] = (acc[s.windDirection] || 0) + s.experienceRating;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(directionCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([dir]) => dir);
  }

  private static getMostFrequentTideStages(
    sessions: SessionDataPoint[]
  ): ("low" | "mid" | "high")[] {
    const stageCounts = sessions.reduce((acc, s) => {
      acc[s.tideStage] = (acc[s.tideStage] || 0) + s.experienceRating;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(stageCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .map(([stage]) => stage as "low" | "mid" | "high");
  }

  private static getDefaultPreferences(userId: string): UserPreferences {
    return {
      userId,
      preferredWaveHeight: { min: 2, max: 5, ideal: 3 },
      preferredWavePeriod: { min: 10, ideal: 12 },
      preferredWindSpeed: { max: 15 },
      preferredWindDirection: [],
      preferredTideStage: ["mid", "high"],
      confidenceLevel: 0,
      lastUpdated: new Date(),
    };
  }
}
```

#### Step 3: Create Match Score Display Component

Create `components/forecast/condition-match-score.tsx`:

```typescript
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ConditionMatchScore } from "@/lib/types/preference-model";

interface ConditionMatchScoreProps {
  score: ConditionMatchScore;
  variant?: "compact" | "detailed";
  className?: string;
}

export function ConditionMatchScoreDisplay({
  score,
  variant = "compact",
  className,
}: ConditionMatchScoreProps) {
  const getScoreColor = (value: number) => {
    if (value >= 80) return "text-success";
    if (value >= 60) return "text-warning";
    return "text-destructive";
  };

  const getScoreLabel = (value: number) => {
    if (value >= 80) return "Great Match";
    if (value >= 60) return "Good Match";
    if (value >= 40) return "Fair Match";
    return "Poor Match";
  };

  if (variant === "compact") {
    return (
      <div className={`flex items-center gap-2 ${className || ""}`}>
        <Badge variant={score.overall >= 70 ? "default" : "outline"}>
          {getScoreLabel(score.overall)}
        </Badge>
        <span className={`text-sm font-medium ${getScoreColor(score.overall)}`}>
          {score.overall}%
        </span>
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Match for Your Preferences</span>
          <span
            className={`text-2xl font-bold ${getScoreColor(score.overall)}`}
          >
            {score.overall}%
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {Object.entries(score.breakdown).map(([key, value]) => (
            <div key={key} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="capitalize">
                  {key.replace(/([A-Z])/g, " $1").trim()}
                </span>
                <span className={getScoreColor(value)}>{value}%</span>
              </div>
              <Progress value={value} className="h-1" />
            </div>
          ))}
        </div>

        {score.reasoning.length > 0 && (
          <div className="space-y-1 pt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground">
              Why this score:
            </p>
            <ul className="text-xs space-y-1">
              {score.reasoning.map((reason, i) => (
                <li key={i} className="text-muted-foreground">
                  • {reason}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

#### Step 4: Create Preference Sync Hook

Create `lib/hooks/use-user-preferences.ts`:

```typescript
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import { PreferenceLearner } from "@/lib/services/preference-learner";
import { UserPreferences } from "@/lib/types/preference-model";

export function useUserPreferences() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setPreferences(null);
      setLoading(false);
      return;
    }

    const fetchPreferences = async () => {
      try {
        setLoading(true);

        // Fetch user's rated sessions
        const response = await fetch(
          `/api/users/${user.id}/sessions?rated=true`
        );
        if (!response.ok) throw new Error("Failed to fetch sessions");

        const { sessions } = await response.json();

        // Calculate preferences
        const prefs = PreferenceLearner.inferPreferences(sessions, user.id);
        setPreferences(prefs);

        // Cache preferences
        localStorage.setItem(
          `preferences_${user.id}`,
          JSON.stringify({
            ...prefs,
            lastUpdated: prefs.lastUpdated.toISOString(),
          })
        );
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));

        // Try to load from cache
        const cached = localStorage.getItem(`preferences_${user.id}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          setPreferences({
            ...parsed,
            lastUpdated: new Date(parsed.lastUpdated),
          });
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPreferences();
  }, [user]);

  return { preferences, loading, error };
}
```

#### Step 5: Integrate into Forecast Display

Update forecast components to show match scores:

```typescript
import { useUserPreferences } from "@/lib/hooks/use-user-preferences";
import { PreferenceLearner } from "@/lib/services/preference-learner";
import { ConditionMatchScoreDisplay } from "@/components/forecast/condition-match-score";

// In forecast display component:
const { preferences } = useUserPreferences();

const matchScore = preferences
  ? PreferenceLearner.calculateMatchScore(
      {
        waveHeight: forecast.waveHeight,
        wavePeriod: forecast.wavePeriod,
        windSpeed: forecast.windSpeed,
        windDirection: forecast.windDirection,
        tideStage: forecast.tideStage,
      },
      preferences
    )
  : null;

return (
  <Card>
    <CardHeader>
      <CardTitle>Forecast for {time}</CardTitle>
      {matchScore && (
        <ConditionMatchScoreDisplay score={matchScore} variant="compact" />
      )}
    </CardHeader>
    <CardContent>{/* Forecast details */}</CardContent>
  </Card>
);
```

---

### 2.2 "Why This Forecast?" Explainer Panel

**User Need**: Understand forecast logic and inputs

**Complexity**: Medium | **Value**: Medium | **Dependencies**: Model inputs

#### Step 1: Create Explainer Panel Component

Create `components/forecast/forecast-explainer-panel.tsx`:

```typescript
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface ForecastExplainerPanelProps {
  forecast: {
    waveHeight: number;
    wavePeriod: number;
    swellDirection: string;
    windSpeed: number;
    windDirection: string;
    modelInputs?: {
      primarySwell: { height: number; period: number; direction: string };
      secondarySwell?: { height: number; period: number; direction: string };
      localWind: { speed: number; direction: string };
      tidalEffect: string;
      bathymetry: string;
    };
  };
  className?: string;
}

export function ForecastExplainerPanel({
  forecast,
  className,
}: ForecastExplainerPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          <Info className="w-4 h-4 mr-2" />
          {isOpen ? "Hide" : "Show"} Forecast Explanation
          <ChevronDown
            className={`w-4 h-4 ml-auto transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-2">
        <Card>
          <CardContent className="pt-4 space-y-4">
            <div>
              <h4 className="text-sm font-semibold mb-2">
                How We Calculate This Forecast
              </h4>
              <p className="text-xs text-muted-foreground">
                This forecast combines multiple data sources and oceanographic
                models to predict conditions at this beach.
              </p>
            </div>

            <div className="space-y-3">
              <div className="bg-muted p-3 rounded-lg">
                <h5 className="text-xs font-medium mb-1">Primary Swell</h5>
                <p className="text-xs text-muted-foreground">
                  <strong>
                    {forecast.modelInputs?.primarySwell.height ||
                      forecast.waveHeight}
                    ft @{" "}
                    {forecast.modelInputs?.primarySwell.period ||
                      forecast.wavePeriod}
                    s
                  </strong>
                  {" from "}
                  <strong>
                    {forecast.modelInputs?.primarySwell.direction ||
                      forecast.swellDirection}
                  </strong>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  The main wave energy driving surf at this location. Generated
                  by distant storms.
                </p>
              </div>

              {forecast.modelInputs?.secondarySwell && (
                <div className="bg-muted p-3 rounded-lg">
                  <h5 className="text-xs font-medium mb-1">Secondary Swell</h5>
                  <p className="text-xs text-muted-foreground">
                    <strong>
                      {forecast.modelInputs.secondarySwell.height}ft @{" "}
                      {forecast.modelInputs.secondarySwell.period}s
                    </strong>
                    {" from "}
                    <strong>
                      {forecast.modelInputs.secondarySwell.direction}
                    </strong>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Additional wave energy that may mix with the primary swell.
                  </p>
                </div>
              )}

              <div className="bg-muted p-3 rounded-lg">
                <h5 className="text-xs font-medium mb-1">Local Wind Effects</h5>
                <p className="text-xs text-muted-foreground">
                  <strong>
                    {forecast.windSpeed}mph from {forecast.windDirection}
                  </strong>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {forecast.windSpeed < 10
                    ? "Light winds won't significantly affect wave quality."
                    : forecast.windSpeed < 20
                    ? "Moderate winds may create some chop on wave faces."
                    : "Strong winds will create choppy, difficult conditions."}
                </p>
              </div>

              <div className="bg-muted p-3 rounded-lg">
                <h5 className="text-xs font-medium mb-1">Bathymetry & Tide</h5>
                <p className="text-xs text-muted-foreground">
                  {forecast.modelInputs?.bathymetry ||
                    "Local seafloor shape affects wave breaking patterns."}{" "}
                  {forecast.modelInputs?.tidalEffect ||
                    "Tide stage influences wave shape and power."}
                </p>
              </div>
            </div>

            <div className="border-t pt-3">
              <p className="text-xs text-muted-foreground">
                <strong>Data Sources:</strong> NOAA WaveWatch III (offshore
                swell), NDBC buoys (validation), NOAA CO-OPS (tides), GFS (local
                wind)
              </p>
            </div>
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}
```

#### Step 2: Integrate into Beach Detail

Add explainer to forecast displays:

```typescript
import { ForecastExplainerPanel } from "@/components/forecast/forecast-explainer-panel";

// In beach detail or forecast view:
<div className="space-y-4">
  <ForecastDisplay forecast={forecast} />
  <ForecastExplainerPanel forecast={forecast} />
</div>;
```

---

### Remaining Features (2.3-2.6)

Due to length constraints, here's the implementation approach for remaining Phase 2 features:

**2.3 Toggle Observed Surf Heights**

- Create a toggle component using `Switch` from ui/
- Add conditional rendering logic in forecast display
- Store preference in localStorage or user settings
- Show cam/report data when toggle is active

**2.4 Expanded Education Modules**

- Create dedicated `/learn` route
- Use existing tab/card components for lessons
- Add interactive diagrams with SVG/canvas
- Include video embeds for visual learners
- Track progress with localStorage

**2.5 Community Notes & Heuristics**

- Extend intel system (already exists at `components/intel/`)
- Add generic tips without user-generated crowd data
- Use existing confirmation system for validation
- Add disclaimers to all community notes

**2.6 Regional Fairness Adjustments**

- Create cam availability checker
- Display "No live cam" badge when unavailable
- Emphasize buoy data in cam-sparse regions
- Add regional data coverage map

---

## Phase 3: Full Release - Refinement & Equity

**Phase 3 features focus on advanced content, historical analysis, and performance:**

**3.1 Stormsurf-Style Guides**

- Create comprehensive markdown content
- Consider partnerships with surf educators
- Add downloadable PDFs
- Include regional specific guides

**3.2 Advanced Anomaly Analysis**

- Build historical data aggregation
- Compare current conditions to climatology
- Add anomaly detection algorithms
- Visualize with charts (use existing chart components)

**3.3 Performance & Scale**

- Profile with React DevTools
- Implement virtual scrolling for long lists
- Add lazy loading for images
- Optimize bundle size with code splitting
- Use Suspense boundaries for async components

---

## Testing Requirements

### Unit Tests (Jest + React Testing Library)

**Required for Each Component:**

```typescript
describe("ComponentName", () => {
  it("renders with required props", () => {
    /* ... */
  });
  it("handles user interactions", () => {
    /* ... */
  });
  it("displays loading states", () => {
    /* ... */
  });
  it("shows error states appropriately", () => {
    /* ... */
  });
  it("is accessible (a11y)", () => {
    /* ... */
  });
});
```

**Run tests:**

```bash
npm run test:unit
```

### E2E Tests (Playwright)

**Critical User Journeys:**

1. View forecast with new features
2. Rate a session
3. View personalized match scores
4. Open education modal
5. Toggle data source views

**Example E2E test:**

```typescript
// e2e/forecast-personalization.spec.ts
import { test, expect } from "@playwright/test";

test("displays personalized match score after rating sessions", async ({
  page,
}) => {
  // Login
  await page.goto("/sign-in");
  // ... auth flow

  // Rate a session
  await page.goto("/journal");
  await page.getByText("Yesterday's Session").click();
  await page.getByLabel("Rate 5 stars").click();
  await page.getByRole("button", { name: "Save" }).click();

  // View forecast
  await page.goto("/beach/ocean-beach");

  // Check for match score
  await expect(page.getByText(/Match for Your Preferences/)).toBeVisible();
  await expect(page.getByText(/\d+%/)).toBeVisible();
});
```

**Run E2E tests:**

```bash
BASE_URL=http://localhost:3000 npx playwright test
```

---

## Deployment Checklist

Before deploying each phase:

- [ ] All unit tests pass
- [ ] All E2E tests pass
- [ ] Accessibility audit (axe DevTools)
- [ ] Mobile testing on real devices
- [ ] Performance profiling (Lighthouse)
- [ ] Database migrations applied
- [ ] API endpoints documented
- [ ] Error handling tested
- [ ] Loading states implemented
- [ ] Analytics tracking added
- [ ] Changelog updated
- [ ] User documentation created

---

## Growth Strategy Integration

Each feature aligns with growth goals:

1. **Beginner badges** → Lower barrier to entry
2. **Data transparency** → Build trust
3. **Education content** → Retain users, reduce churn
4. **Personalization** → Increase engagement
5. **Regional fairness** → Expand addressable market

---

## Support & Maintenance

**Documentation Locations:**

- [Components Architecture](../components/ARCHITECTURE.md)
- [Styles Guide](../styles/ARCHITECTURE.md)
- [E2E Testing](../e2e/ARCHITECTURE.md)
- [API Documentation](../app/api/)

**Getting Help:**

- Check existing patterns in codebase
- Review component examples in `/components`
- Test with Playwright MCP for UI validation
- Follow DRY principles - don't rebuild what exists

---

**Last Updated:** January 2025
**Version:** 1.0
**Status:** Ready for implementation

**Key Principle:** Build incrementally, test thoroughly, align with user needs from Reddit research.
