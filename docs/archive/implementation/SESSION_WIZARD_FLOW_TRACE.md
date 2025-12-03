# Session Wizard Flow Trace Report
**Generated:** 2025-11-22  
**Purpose:** Document the current "Plan Session" CTA flow from Surf Discovery and Personalized Forecast features to understand integration points for prefill functionality.

---

## Executive Summary

**Current State:**
- Two "Plan Session" CTAs exist: Surf Discovery and Personalized Forecast
- Both currently route to `/sessions/new?mode=plan&beach={beachId}` or `/sessions/wizard?beachId={beachId}`
- **CRITICAL ISSUE:** `/sessions/wizard` route is defunct and returns 404
- Session wizard does NOT currently read URL parameters for prefill
- BeachSelector component supports `initialValue` prop but wizard doesn't leverage URL params

**Required Changes:**
1. Update both CTAs to use correct route: `/sessions/new?mode=plan`
2. Extend wizard to read and apply URL parameters for beach and time window prefill
3. Update useSessionForm hook to accept initial state
4. Maintain backward compatibility with existing flows

---

## 1. Current CTA Locations & Routing

### 1.1 Surf Discovery - Beach Discovery List

**File:** `/components/discover/beach-discovery-list.tsx`

**Current Implementation (Lines 63-65):**
```typescript
const handlePlanSession = (beachId: string) => {
  router.push(`/sessions/wizard?beachId=${beachId}`);
};
```

**⚠️ ISSUE:** Routes to defunct `/sessions/wizard` path (404)

**Data Available at CTA Click:**
```typescript
interface SurfDiscoveryRecommendation {
  beach: Beach;                    // Full beach object with id, name, slug, location
  window: PersonalizedForecastWindow; // Optimal time window
  forecast: EnhancedForecastEntity;   // Full forecast data
  score: number;
  matchQuality: 'perfect' | 'excellent' | 'good' | 'fair';
  summary: string;
  reasons: string[];
  warnings: string[];
}

interface PersonalizedForecastWindow {
  start: Date;      // Window start time (e.g., "2025-11-22T06:00:00")
  end: Date;        // Window end time (typically 3 hours after start)
  tide: string;     // "Rising", "High Slack"
  wind: string;     // "10 mph SW"
  waveHeight: string; // "3-4 ft"
  wavePeriod: string; // "12s"
  confidence: number; // 0-100
}
```

---

### 1.2 Personalized Forecast Card

**File:** `/components/home-screen/forecast-tab.tsx`

**Current Implementation (Lines 302-317):**
```typescript
const handlePlanSession = useCallback(() => {
  if (!recommendation?.beach?.id) return;

  const url = `/sessions/new?mode=plan&beach=${recommendation.beach.id}`;

  // Track the action
  track("personalized_forecast_plan_session", {
    beach_id: recommendation.beach.id,
    beach_slug: slugify(recommendation.beach.name),
    score: recommendation.score,
    personalized: recommendation.personalized,
    source: "home_forecast_tab",
  });

  router.push(url);
}, [recommendation, router]);
```

**✅ CORRECT ROUTE:** Uses `/sessions/new` but **only passes beachId**

**Data Available at CTA Click:**
```typescript
interface PersonalizedForecastRecommendation {
  beach: Beach;
  window: PersonalizedForecastWindow; // AVAILABLE BUT NOT PASSED
  forecast: EnhancedForecastEntity;
  score: number;
  breakdown: PersonalizedScore['breakdown'];
  summary: string;
  reasons: string[];
  personalized: boolean;
}
```

---

## 2. Session Wizard Architecture

### 2.1 Route Structure

**Primary Route:** `/app/sessions/new/page.tsx`  
**Defunct Route:** `/sessions/wizard` (404 - does not exist)

**URL Parameters Currently Read (Lines 24-25):**
```typescript
const mode = (searchParams.get("mode") as SessionFormMode) || "plan";
const convertSessionId = searchParams.get("convert");
```

**⚠️ NO PREFILL PARAMETERS READ:** Beach, date, time not currently extracted from URL

---

### 2.2 Component Hierarchy

```
/app/sessions/new/page.tsx
└─> NewSessionPageContent (uses Suspense)
    └─> SessionWizard
        └─> AnimatedSessionWizard
            ├─> useSessionForm hook
            └─> Step Components:
                ├─> LocationStep (Beach selection)
                │   └─> BeachSelector
                ├─> DateTimeSection (Date/Time selection)
                ├─> EquipmentStep
                ├─> GoalsSection (plan mode)
                └─> SessionDetailsSection (log mode)
```

---

### 2.3 Session Wizard Steps (Plan Mode)

**File:** `/components/session/wizard/AnimatedSessionWizard.tsx`

**Current Steps (Lines 150-185):**
```typescript
const WIZARD_STEPS_V2: Record<SessionFormMode, WizardStep[]> = {
  plan: [
    {
      id: "location",
      title: "Location",
      description: "Choose where you'll be surfing",
      component: "LocationStep",
      isRequired: true,
    },
    {
      id: "datetime",
      title: "When",
      description: "Set your session date and time",
      component: "DateTimeSection",
      isRequired: true,
    },
    {
      id: "goals",
      title: "Goals",
      description: "What do you want to focus on?",
      component: "GoalsSection",
      isRequired: false,
    },
    {
      id: "notes",
      title: "Notes & Invites",
      description: "Add notes and invite friends",
      component: "NotesSection",
      isRequired: false,
    },
  ],
};
```

**Step Validation Logic (Lines 300-318):**
```typescript
const isStepValid = useCallback(
  (step: number): boolean => {
    const wizardStep = steps[step];
    if (!wizardStep) return false;

    switch (wizardStep.id) {
      case "location":
        return Boolean(formState.selectedBeach);
      case "datetime":
        if (mode === "plan") {
          return Boolean(formState.selectedDate && formState.selectedTime);
        }
        return Boolean(formState.selectedDate);
      default:
        return true;
    }
  },
  [steps, formState, mode]
);
```

---

## 3. Data Structures

### 3.1 SessionFormState

**File:** `/hooks/use-session-form.ts`

**Complete Type Definition (Lines 10-58):**
```typescript
export type SessionFormState = {
  selectedBeach: string;      // Beach name (display)
  selectedBeachId?: string;   // Beach UUID
  selectedDate: string;        // ISO date string "YYYY-MM-DD"
  selectedTime: string;        // 24h time string "HH:MM"
  selectedBoard: string;
  boardId?: string;
  duration: string;            // "60m", "2h 30m"
  waveQuality: string;
  waterTemp: string;
  crowdLevel: string;
  parkingEase: string;
  overallRating: string;
  notes: string;
  photos: File[];
  waveTypes: string[];
  
  // Conditions (log mode)
  waveHeight?: number;
  windSpeed?: number;
  windDirection?: string;
  forecastAccuracy?: "accurate" | "somewhat" | "inaccurate";
  
  // Session Planner Pro (plan mode)
  optimalTimes?: Array<{...}>;
  selectedOptimalTime?: string;
  boardSuggestions?: Array<{...}>;
  invitees?: Array<{...}>;
  invitationMessage?: string;
};
```

**Default Values (Lines 71-98):**
```typescript
const [formState, setFormState] = useState<SessionFormState>({
  selectedBeach: "",
  selectedBeachId: "",
  selectedDate: new Date().toISOString().split("T")[0], // Today
  selectedTime: "06:00", // Dawn patrol default
  selectedBoard: "",
  boardId: undefined,
  duration: "60m",
  // ... rest defaults to empty/undefined
});
```

---

### 3.2 PersonalizedForecastWindow

**File:** `/types/personalization.ts`

**Time Window Structure (Lines 20-35):**
```typescript
export interface PersonalizedForecastWindow {
  start: Date;        // JavaScript Date object
  end: Date;          // JavaScript Date object
  tide: string;
  wind: string;
  waveHeight: string;
  wavePeriod: string;
  confidence: number;
}
```

**Example Data:**
```json
{
  "start": "2025-11-22T06:00:00.000Z",
  "end": "2025-11-22T09:00:00.000Z",
  "tide": "Rising",
  "wind": "10 mph SW",
  "waveHeight": "3-4 ft",
  "wavePeriod": "12s",
  "confidence": 85
}
```

---

### 3.3 Beach Object

**File:** `/types/database.ts`

**Relevant Fields:**
```typescript
interface Beach {
  id: string;           // UUID
  name: string;         // "Pacific Beach"
  slug: string;         // "pacific-beach"
  city: string;         // "San Diego"
  state: string;        // "CA"
  
  // ⚠️ COORDINATE NAMING CONVENTION
  center_lat: number;   // Database uses center_lat (PostGIS)
  center_lng: number;   // Database uses center_lng (PostGIS)
  
  // NOT: latitude, longitude (do not exist in DB)
  // Components must map: latitude={beach.center_lat} longitude={beach.center_lng}
}
```

---

## 4. Key Components Deep Dive

### 4.1 LocationStep Component

**File:** `/components/session-forms/LocationStep.tsx`

**Props:**
```typescript
interface LocationStepProps {
  formState: SessionFormState;
  beaches: Beach[];
  mode: SessionFormMode;
  updateField: <K extends keyof SessionFormState>(
    field: K,
    value: SessionFormState[K]
  ) => void;
}
```

**Current Implementation (Lines 24-42):**
```typescript
export function LocationStep({ formState, beaches, mode, updateField }: LocationStepProps) {
  return (
    <div className="space-y-4">
      <BeachSelector
        initialValue={formState.selectedBeach}  // ✅ SUPPORTS PREFILL
        onBeachSelected={(beach) => {
          updateField("selectedBeach", beach.name);
          updateField("selectedBeachId", beach.id);
          
          // Analytics tracking
          if (mode === "log" && beach?.name) {
            track("session_log_start", { beach_slug: slugify(beach.name) });
          }
        }}
      />
    </div>
  );
}
```

**✅ GOOD:** BeachSelector already supports `initialValue` prop

---

### 4.2 BeachSelector Component

**File:** `/components/BeachSelector.tsx`

**Props:**
```typescript
{
  onBeachSelected: (beach: Beach) => void;
  initialValue?: string;  // ✅ PREFILL SUPPORT
  inputId?: string;
  listId?: string;
}
```

**Initialization Logic (Lines 22-24, 81-87):**
```typescript
const [query, setQuery] = useState(initialValue || "");
const [selectionMade, setSelectionMade] = useState(!!initialValue);

// React to initialValue changes
useEffect(() => {
  if (initialValue && initialValue !== query) {
    setQuery(initialValue);
    setSelectionMade(true);
  }
}, [initialValue, query]);
```

**✅ READY:** Component already handles prefill correctly

---

### 4.3 DateTimeSection Component

**File:** `/components/session-forms/DateTimeSection.tsx`

**Props:**
```typescript
interface DateTimeSectionProps {
  mode: SessionFormMode;
  formState: SessionFormState;
  updateField: <K extends keyof SessionFormState>(
    field: K,
    value: SessionFormState[K]
  ) => void;
  sessionCreated?: boolean;
}
```

**Date Input (Lines 125-139):**
```typescript
<Input
  ref={dateInputRef}
  type="date"
  defaultValue={formState.selectedDate || ""}  // ✅ USES formState
  onChange={handleDateChange}
  max={dateConstraints.max}
  min={dateConstraints.min}
/>
```

**Time Input (Lines 154-163):**
```typescript
<Input
  type="time"
  value={formState.selectedTime || ""}  // ✅ USES formState
  onChange={handleTimeChange}
/>
```

**✅ READY:** Component already reads from formState, just needs proper initialization

---

### 4.4 useSessionForm Hook

**File:** `/hooks/use-session-form.ts`

**Current Function Signature (Line 62):**
```typescript
export function useSessionForm(initialMode: SessionFormMode = "plan") {
  // ⚠️ NO INITIAL STATE PARAMETER
}
```

**Initialization (Lines 71-98):**
```typescript
const [formState, setFormState] = useState<SessionFormState>({
  selectedBeach: "",
  selectedBeachId: "",
  selectedDate: new Date().toISOString().split("T")[0],
  selectedTime: "06:00",
  // ... hardcoded defaults
});
```

**⚠️ LIMITATION:** Cannot initialize with custom values - needs extension

---

## 5. Existing Patterns

### 5.1 URL Parameter Passing (Other Features)

**Example 1: Beach Detail with Source Tracking**
```typescript
// From beach-discovery-list.tsx:55-60
const urlWithSource = beachUrl.includes("?")
  ? `${beachUrl}&from=surf_discovery`
  : `${beachUrl}?from=surf_discovery`;

router.push(urlWithSource);
```

**Example 2: Session Mode Parameter**
```typescript
// From app/sessions/new/page.tsx:24
const mode = (searchParams.get("mode") as SessionFormMode) || "plan";
```

**Pattern:** Query parameters are read using `searchParams.get(key)` in page components

---

### 5.2 Navigation Utilities

**File:** `/lib/navigation-utils.ts`

**Existing Helpers:**
```typescript
export const appNavigation = {
  toLogSession: (): string => "/sessions/new?mode=log",
  toPlanSession: (): string => "/sessions/new?mode=plan",
  
  navigateToLogSession: (router: AppRouterInstance): void => {
    router.push(appNavigation.toLogSession());
  },
  navigateToPlanSession: (router: AppRouterInstance): void => {
    router.push(appNavigation.toPlanSession());
  },
};
```

**⚠️ MISSING:** No helpers for planning with beach/time prefill

---

### 5.3 Data Serialization Patterns

**Date Handling:**
```typescript
// Window times come as Date objects
window.start: Date  // 2025-11-22T06:00:00.000Z

// Need to convert to:
selectedDate: "2025-11-22"
selectedTime: "06:00"
```

**URL Safe Encoding:**
```typescript
// Beach ID (UUID) - safe to pass directly
beachId: "123e4567-e89b-12d3-a456-426614174000"

// Date/Time - ISO format is URL safe
date: "2025-11-22"
time: "06:00"  // or encode as "06%3A00" if needed
```

---

## 6. Complete Data Flow Diagrams

### 6.1 Current Flow (Broken)

```
┌──────────────────────────────────────────────────────────────────┐
│ SURF DISCOVERY - CURRENT FLOW (BROKEN)                          │
└──────────────────────────────────────────────────────────────────┘

User clicks "Plan Session" on Discovery Card
         │
         │  recommendation.beach.id
         ▼
  router.push("/sessions/wizard?beachId=...")  ⚠️ 404 ERROR
         │
         ▼
    [Route Not Found]


┌──────────────────────────────────────────────────────────────────┐
│ PERSONALIZED FORECAST - CURRENT FLOW (PARTIAL)                  │
└──────────────────────────────────────────────────────────────────┘

User clicks "Plan Session" on Forecast Card
         │
         │  recommendation.beach.id
         │  recommendation.window (NOT USED)
         ▼
  router.push("/sessions/new?mode=plan&beach=...")
         │
         ▼
  /app/sessions/new/page.tsx
         │
         │  ⚠️ Does NOT read beach parameter
         ▼
  SessionWizard (mode="plan")
         │
         ▼
  useSessionForm(mode)
         │
         │  Hardcoded defaults:
         │  - selectedBeach: ""
         │  - selectedBeachId: ""
         │  - selectedDate: today
         │  - selectedTime: "06:00"
         ▼
  AnimatedSessionWizard
         │
         ▼
  LocationStep (empty - user must select beach manually)
         │
  DateTimeSection (today @ 06:00 - user must adjust manually)
```

---

### 6.2 Proposed Flow (Fixed with Prefill)

```
┌──────────────────────────────────────────────────────────────────┐
│ SURF DISCOVERY - PROPOSED FLOW                                  │
└──────────────────────────────────────────────────────────────────┘

User clicks "Plan Session" on Discovery Card
         │
         │  recommendation = {
         │    beach: { id, name, slug, ... },
         │    window: { start, end, tide, wind, ... }
         │  }
         ▼
  Build URL with encoded parameters:
    /sessions/new?mode=plan
      &beachId={beach.id}
      &beachName={beach.name}
      &date={window.start → "YYYY-MM-DD"}
      &time={window.start → "HH:MM"}
      &source=surf_discovery
         │
         ▼
  router.push(url)
         │
         ▼
  /app/sessions/new/page.tsx
         │
         │  Read searchParams:
         │  - mode = "plan"
         │  - beachId = "..."
         │  - beachName = "..."
         │  - date = "2025-11-22"
         │  - time = "06:00"
         │  - source = "surf_discovery"
         ▼
  Pass to SessionWizard as prefillData prop:
    {
      selectedBeach: beachName,
      selectedBeachId: beachId,
      selectedDate: date,
      selectedTime: time
    }
         │
         ▼
  SessionWizard receives prefillData
         │
         ▼
  useSessionForm(mode, prefillData)
         │
         │  Initialize state with prefill:
         │  - selectedBeach: "Pacific Beach"
         │  - selectedBeachId: "uuid-..."
         │  - selectedDate: "2025-11-22"
         │  - selectedTime: "06:00"
         ▼
  AnimatedSessionWizard
         │
         ▼
  LocationStep
         │
         │  BeachSelector initialValue="Pacific Beach"
         │  → Beach is pre-selected, user can change
         ▼
  DateTimeSection
         │
         │  Date input shows "2025-11-22"
         │  Time input shows "06:00"
         │  → Optimal time pre-filled, user can adjust
         ▼
  GoalsSection → NotesSection → Submit
         │
         ▼
  Track analytics with source="surf_discovery"
```

---

## 7. Files Requiring Modification

### 7.1 High Priority (Core Flow)

| File | Changes | Complexity |
|------|---------|-----------|
| `/components/discover/beach-discovery-list.tsx` | Update `handlePlanSession` to use `/sessions/new` with encoded params | Low |
| `/components/home-screen/forecast-tab.tsx` | Extend `handlePlanSession` to include time window params | Low |
| `/app/sessions/new/page.tsx` | Read URL params and build prefillData object | Medium |
| `/components/session/wizard/SessionWizard.tsx` | Accept and pass prefillData prop | Low |
| `/components/session/wizard/AnimatedSessionWizard.tsx` | Accept and pass prefillData to useSessionForm | Low |
| `/hooks/use-session-form.ts` | Extend to accept initialState parameter | Medium |

### 7.2 Medium Priority (Enhancements)

| File | Changes | Complexity |
|------|---------|-----------|
| `/lib/navigation-utils.ts` | Add helper functions for session planning with prefill | Low |
| `/components/home-screen/personalized-forecast-card.tsx` | Update `handlePlanSession` to use new pattern | Low |

### 7.3 Low Priority (Testing & Documentation)

| File | Changes | Complexity |
|------|---------|-----------|
| `/e2e/session-wizard.spec.ts` | Add tests for URL parameter prefill | Medium |
| Tests for modified components | Unit tests for prefill logic | Medium |

---

## 8. Potential Blockers & Gotchas

### 8.1 Date/Time Conversion

**Challenge:** Window times are Date objects, form expects strings

**Solution:**
```typescript
// Convert window.start Date to form format
const windowDate = new Date(window.start);
const selectedDate = windowDate.toISOString().split('T')[0]; // "2025-11-22"
const selectedTime = windowDate.toTimeString().slice(0, 5);  // "06:00"
```

**Edge Case:** Timezone conversions
- Window times may be UTC
- User's local time might differ
- **Recommendation:** Convert to user's local timezone before prefill

---

### 8.2 URL Character Encoding

**Challenge:** Beach names may contain special characters

**Solution:**
```typescript
const url = `/sessions/new?mode=plan&beachId=${encodeURIComponent(beach.id)}&beachName=${encodeURIComponent(beach.name)}&date=${date}&time=${encodeURIComponent(time)}`;
```

**Why:**
- Beach name: "La Jolla" → "La%20Jolla"
- Time with colon: "06:00" → "06%3A00"

---

### 8.3 Backward Compatibility

**Challenge:** Existing links/bookmarks to `/sessions/new?mode=plan`

**Solution:**
```typescript
// In useSessionForm hook
export function useSessionForm(
  initialMode: SessionFormMode = "plan",
  initialState?: Partial<SessionFormState>  // ✅ Optional parameter
) {
  const [formState, setFormState] = useState<SessionFormState>({
    // Default values
    selectedBeach: "",
    selectedBeachId: "",
    selectedDate: new Date().toISOString().split("T")[0],
    selectedTime: "06:00",
    // ... other defaults
    
    // Override with initialState if provided
    ...initialState,  // ✅ Spreads prefill values
  });
}
```

**Benefits:**
- If no initialState → works exactly as before
- If initialState provided → prefills form
- No breaking changes

---

### 8.4 Beach Name vs Beach ID Mismatch

**Challenge:** What if beachName doesn't match beachId in database?

**Solution:**
```typescript
// Priority order in LocationStep:
// 1. If both beachId and beachName provided → fetch beach by ID to verify
// 2. If only beachName → use BeachSelector's fuzzy search
// 3. If only beachId → fetch beach by ID to get name

// Example defensive logic:
useEffect(() => {
  if (formState.selectedBeachId && !formState.selectedBeach) {
    // Fetch beach name by ID
    fetchBeachById(formState.selectedBeachId).then(beach => {
      if (beach) {
        updateField("selectedBeach", beach.name);
      }
    });
  }
}, [formState.selectedBeachId, formState.selectedBeach]);
```

---

### 8.5 Form Validation with Prefilled Values

**Challenge:** Step validation must recognize prefilled values

**Current Validation (Lines 300-318 in AnimatedSessionWizard.tsx):**
```typescript
const isStepValid = useCallback(
  (step: number): boolean => {
    const wizardStep = steps[step];
    
    switch (wizardStep.id) {
      case "location":
        return Boolean(formState.selectedBeach);  // ✅ Works with prefill
      case "datetime":
        if (mode === "plan") {
          return Boolean(formState.selectedDate && formState.selectedTime);  // ✅ Works with prefill
        }
        return Boolean(formState.selectedDate);
      default:
        return true;
    }
  },
  [steps, formState, mode]
);
```

**✅ GOOD:** Validation already checks formState, will work with prefill

---

### 8.6 Analytics Tracking

**Challenge:** Need to track prefill source for analytics

**Solution:**
```typescript
// Include source in URL
const url = `/sessions/new?mode=plan&beachId=${beachId}&source=surf_discovery`;

// Track in session creation
track("session_planned", {
  beach_id: beachId,
  prefill_source: searchParams.get("source"),  // "surf_discovery" or "personalized_forecast"
  prefilled: true,
});
```

---

## 9. Recommended Implementation Plan

### Phase 1: Fix Critical Routing (Immediate)

**Priority:** P0 - Blocking user flow

**Changes:**
1. Update Surf Discovery CTA route from `/sessions/wizard` → `/sessions/new?mode=plan&beachId={id}`
2. Test that users can reach session wizard

**Files:**
- `/components/discover/beach-discovery-list.tsx`

**Time Estimate:** 15 minutes  
**Risk:** Low

---

### Phase 2: Add Basic Prefill (Core Feature)

**Priority:** P1 - High value, low risk

**Changes:**
1. Extend `useSessionForm` to accept `initialState` parameter
2. Update `/app/sessions/new/page.tsx` to read URL params
3. Pass prefill data through component chain
4. Update both CTAs to include time window data

**Files:**
- `/hooks/use-session-form.ts`
- `/app/sessions/new/page.tsx`
- `/components/session/wizard/SessionWizard.tsx`
- `/components/session/wizard/AnimatedSessionWizard.tsx`
- `/components/discover/beach-discovery-list.tsx`
- `/components/home-screen/forecast-tab.tsx`

**Time Estimate:** 2-3 hours  
**Risk:** Low (backward compatible)

---

### Phase 3: Add Navigation Helpers (Polish)

**Priority:** P2 - Nice to have

**Changes:**
1. Create utility functions in `/lib/navigation-utils.ts`
2. Refactor CTAs to use helpers

**Files:**
- `/lib/navigation-utils.ts`
- Update CTA components to use helpers

**Time Estimate:** 1 hour  
**Risk:** Very Low

---

### Phase 4: Testing & Analytics (Quality)

**Priority:** P2 - Essential for production

**Changes:**
1. Add E2E tests for prefill flow
2. Add unit tests for URL parameter handling
3. Verify analytics tracking

**Files:**
- `/e2e/session-wizard.spec.ts`
- New test files for prefill logic

**Time Estimate:** 2-3 hours  
**Risk:** Low

---

## 10. Code Examples for Implementation

### 10.1 Updated Surf Discovery CTA

```typescript
// File: /components/discover/beach-discovery-list.tsx

const handlePlanSession = (beachId: string) => {
  // Find the recommendation to get time window data
  const recommendation = discovery?.recommendations.find(r => r.beach.id === beachId);
  
  if (!recommendation) {
    console.warn(`Beach ${beachId} not found in recommendations`);
    // Fallback: just pass beach ID
    router.push(`/sessions/new?mode=plan&beachId=${beachId}&source=surf_discovery`);
    return;
  }
  
  // Extract optimal time from window
  const windowDate = new Date(recommendation.window.start);
  const date = windowDate.toISOString().split('T')[0];
  const time = windowDate.toTimeString().slice(0, 5);
  
  // Build URL with all prefill data
  const params = new URLSearchParams({
    mode: 'plan',
    beachId: recommendation.beach.id,
    beachName: recommendation.beach.name,
    date: date,
    time: time,
    source: 'surf_discovery',
  });
  
  // Track analytics
  track("surf_discovery_plan_session", {
    beach_id: recommendation.beach.id,
    beach_slug: slugify(recommendation.beach.name),
    score: recommendation.score,
    match_quality: recommendation.matchQuality,
    window_start: recommendation.window.start.toISOString(),
  });
  
  router.push(`/sessions/new?${params.toString()}`);
};
```

---

### 10.2 Updated Personalized Forecast CTA

```typescript
// File: /components/home-screen/forecast-tab.tsx

const handlePlanSession = useCallback(() => {
  if (!recommendation?.beach?.id) return;

  // Extract optimal time from window
  const windowDate = new Date(recommendation.window.start);
  const date = windowDate.toISOString().split('T')[0];
  const time = windowDate.toTimeString().slice(0, 5);

  // Build URL with prefill data
  const params = new URLSearchParams({
    mode: 'plan',
    beachId: recommendation.beach.id,
    beachName: recommendation.beach.name,
    date: date,
    time: time,
    source: 'personalized_forecast',
  });

  // Track the action
  track("personalized_forecast_plan_session", {
    beach_id: recommendation.beach.id,
    beach_slug: slugify(recommendation.beach.name),
    score: recommendation.score,
    personalized: recommendation.personalized,
    window_start: recommendation.window.start.toISOString(),
    source: "home_forecast_tab",
  });

  router.push(`/sessions/new?${params.toString()}`);
}, [recommendation, router]);
```

---

### 10.3 Updated Session Page to Read Params

```typescript
// File: /app/sessions/new/page.tsx

function NewSessionPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuth();
  const [showCelebration, setShowCelebration] = useState(false);

  // Get mode from URL params (default to 'plan')
  const mode = (searchParams.get("mode") as SessionFormMode) || "plan";
  const convertSessionId = searchParams.get("convert");
  
  // 🆕 Read prefill parameters from URL
  const prefillData = useMemo(() => {
    const beachId = searchParams.get("beachId");
    const beachName = searchParams.get("beachName");
    const date = searchParams.get("date");
    const time = searchParams.get("time");
    const source = searchParams.get("source");
    
    // Only return prefill data if we have at least a beach
    if (!beachId && !beachName) {
      return undefined;
    }
    
    return {
      selectedBeachId: beachId || undefined,
      selectedBeach: beachName || undefined,
      selectedDate: date || undefined,
      selectedTime: time || undefined,
      // Store source for analytics
      _prefillSource: source || undefined,
    };
  }, [searchParams]);
  
  // ... rest of component
  
  return (
    <div className="min-h-screen bg-gray-50 relative">
      <SessionWizard
        mode={mode}
        prefillData={prefillData}  // 🆕 Pass prefill data
        onComplete={handleSessionComplete}
        onCancel={handleCancel}
        className="min-h-screen"
      />
      {/* ... celebration overlay */}
    </div>
  );
}
```

---

### 10.4 Updated SessionWizard Component

```typescript
// File: /components/session/wizard/SessionWizard.tsx

interface SessionWizardProps {
  mode: SessionFormMode;
  prefillData?: Partial<SessionFormState>;  // 🆕 Accept prefill data
  onComplete?: (sessionData: any) => void;
  onCancel?: () => void;
  className?: string;
}

export function SessionWizard({
  mode,
  prefillData,  // 🆕
  onComplete,
  onCancel,
  className,
}: SessionWizardProps) {
  return (
    <AnimatedSessionWizard
      initialMode={mode}
      initialState={prefillData}  // 🆕 Pass to animated wizard
      onComplete={onComplete}
      onCancel={onCancel}
      className={className}
    />
  );
}
```

---

### 10.5 Updated AnimatedSessionWizard Component

```typescript
// File: /components/session/wizard/AnimatedSessionWizard.tsx

interface AnimatedSessionWizardProps {
  initialMode: SessionFormMode;
  initialState?: Partial<SessionFormState>;  // 🆕 Accept initial state
  className?: string;
  onComplete?: (sessionData: any) => Promise<void>;
  onCancel?: () => void;
}

export function AnimatedSessionWizard({
  initialMode,
  initialState,  // 🆕
  className,
  onComplete,
  onCancel,
}: AnimatedSessionWizardProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  // ... other state

  const {
    mode,
    loading,
    setLoading,
    boards,
    beaches,
    formState,
    updateField,
    refreshBoards,
    isPlanning,
  } = useSessionForm(initialMode, initialState);  // 🆕 Pass initial state
  
  // ... rest of component
}
```

---

### 10.6 Updated useSessionForm Hook

```typescript
// File: /hooks/use-session-form.ts

export function useSessionForm(
  initialMode: SessionFormMode = "plan",
  initialState?: Partial<SessionFormState>  // 🆕 Optional initial state
) {
  const { user } = useAuth();
  const [mode, setMode] = useState<SessionFormMode>(initialMode);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [boards, setBoards] = useState<Board[]>([]);
  const [beaches, setBeaches] = useState<Beach[]>([]);

  // 🆕 Merge default values with initialState
  const [formState, setFormState] = useState<SessionFormState>(() => {
    const defaults: SessionFormState = {
      selectedBeach: "",
      selectedBeachId: "",
      selectedDate: new Date().toISOString().split("T")[0],
      selectedTime: "06:00",
      selectedBoard: "",
      boardId: undefined,
      duration: "60m",
      waveQuality: "",
      waterTemp: "",
      crowdLevel: "",
      parkingEase: "",
      overallRating: "",
      notes: "",
      photos: [],
      waveTypes: [],
      waveHeight: undefined,
      windSpeed: undefined,
      windDirection: undefined,
      forecastAccuracy: undefined,
      optimalTimes: undefined,
      selectedOptimalTime: undefined,
      boardSuggestions: undefined,
      invitees: [],
      invitationMessage: "",
    };
    
    // 🆕 Override defaults with initialState if provided
    return {
      ...defaults,
      ...initialState,
    };
  });
  
  // ... rest of hook remains unchanged
}
```

---

### 10.7 Navigation Helper Utilities

```typescript
// File: /lib/navigation-utils.ts

// 🆕 Add to existing appNavigation object
export const appNavigation = {
  // ... existing methods
  
  /**
   * Navigate to plan session page with prefilled beach and time
   */
  toPlanSessionWithPrefill: (
    beachId: string,
    beachName: string,
    date?: string,
    time?: string,
    source?: string
  ): string => {
    const params = new URLSearchParams({
      mode: 'plan',
      beachId,
      beachName,
    });
    
    if (date) params.set('date', date);
    if (time) params.set('time', time);
    if (source) params.set('source', source);
    
    return `/sessions/new?${params.toString()}`;
  },
  
  /**
   * Navigate to plan session with data from surf discovery recommendation
   */
  toPlanSessionFromDiscovery: (
    recommendation: SurfDiscoveryRecommendation
  ): string => {
    const windowDate = new Date(recommendation.window.start);
    const date = windowDate.toISOString().split('T')[0];
    const time = windowDate.toTimeString().slice(0, 5);
    
    return appNavigation.toPlanSessionWithPrefill(
      recommendation.beach.id,
      recommendation.beach.name,
      date,
      time,
      'surf_discovery'
    );
  },
  
  /**
   * Navigate to plan session with data from personalized forecast
   */
  toPlanSessionFromForecast: (
    recommendation: PersonalizedForecastRecommendation
  ): string => {
    const windowDate = new Date(recommendation.window.start);
    const date = windowDate.toISOString().split('T')[0];
    const time = windowDate.toTimeString().slice(0, 5);
    
    return appNavigation.toPlanSessionWithPrefill(
      recommendation.beach.id,
      recommendation.beach.name,
      date,
      time,
      'personalized_forecast'
    );
  },
};
```

---

## 11. Testing Strategy

### 11.1 Manual Testing Checklist

**Test Case 1: Surf Discovery Prefill**
- [ ] Navigate to home screen with Surf Discovery recommendations
- [ ] Click "Plan Session" on top recommendation
- [ ] Verify redirected to `/sessions/new?mode=plan&beachId=...&date=...&time=...`
- [ ] Verify LocationStep shows correct beach pre-selected
- [ ] Verify DateTimeSection shows correct date and time
- [ ] Verify can change beach and proceed
- [ ] Verify can change date/time and proceed
- [ ] Verify can complete session planning

**Test Case 2: Personalized Forecast Prefill**
- [ ] Navigate to home screen Forecast tab
- [ ] Click "Plan Session" on personalized forecast card
- [ ] Verify same prefill behavior as Test Case 1
- [ ] Verify source tracking

**Test Case 3: Direct Navigation (No Prefill)**
- [ ] Navigate directly to `/sessions/new?mode=plan`
- [ ] Verify form starts with defaults (no prefill)
- [ ] Verify can complete session planning normally

**Test Case 4: Partial Prefill (Backward Compatibility)**
- [ ] Navigate to `/sessions/new?mode=plan&beachId=xxx` (no time)
- [ ] Verify beach is prefilled
- [ ] Verify date/time default to today and dawn patrol
- [ ] Verify can complete session

**Test Case 5: Invalid Beach ID**
- [ ] Navigate with invalid beachId parameter
- [ ] Verify form gracefully handles missing beach
- [ ] Verify user can select beach manually

---

### 11.2 E2E Test Scenarios

```typescript
// File: /e2e/session-wizard-prefill.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Session Wizard Prefill', () => {
  test('should prefill beach and time from surf discovery CTA', async ({ page }) => {
    // Navigate to home with discovery recommendations
    await page.goto('/');
    await page.waitForSelector('[data-testid="discovery-card"]');
    
    // Click "Plan Session" on first recommendation
    await page.click('[data-testid="discovery-card"] button:has-text("Plan Session")');
    
    // Verify redirected to session wizard
    await expect(page).toHaveURL(/\/sessions\/new\?mode=plan/);
    
    // Verify beach is prefilled in LocationStep
    const beachInput = page.locator('[data-testid="beach-search-input"]');
    await expect(beachInput).not.toBeEmpty();
    
    // Verify date is prefilled in DateTimeSection
    const dateInput = page.locator('[data-testid="session-date-input"]');
    await expect(dateInput).not.toBeEmpty();
    
    // Verify time is prefilled
    const timeInput = page.locator('[data-testid="session-time-input"]');
    await expect(timeInput).not.toBeEmpty();
    
    // Verify step validation passes (can proceed to next step)
    const nextButton = page.locator('button:has-text("Next")');
    await expect(nextButton).toBeEnabled();
  });
  
  test('should allow user to change prefilled values', async ({ page }) => {
    // Start with prefilled URL
    await page.goto('/sessions/new?mode=plan&beachId=test-id&beachName=Test Beach&date=2025-11-25&time=08:00');
    
    // Change beach
    const beachInput = page.locator('[data-testid="beach-search-input"]');
    await beachInput.clear();
    await beachInput.fill('Pacific Beach');
    await page.keyboard.press('Enter');
    
    // Change date
    const dateInput = page.locator('[data-testid="session-date-input"]');
    await dateInput.fill('2025-11-30');
    
    // Change time
    const timeInput = page.locator('[data-testid="session-time-input"]');
    await timeInput.fill('10:00');
    
    // Verify validation still passes
    const nextButton = page.locator('button:has-text("Next")');
    await expect(nextButton).toBeEnabled();
  });
  
  test('should work without prefill (backward compatibility)', async ({ page }) => {
    // Navigate without prefill parameters
    await page.goto('/sessions/new?mode=plan');
    
    // Verify form is empty
    const beachInput = page.locator('[data-testid="beach-search-input"]');
    await expect(beachInput).toBeEmpty();
    
    // Fill out form manually
    await beachInput.fill('Ocean Beach');
    await page.keyboard.press('Enter');
    
    const dateInput = page.locator('[data-testid="session-date-input"]');
    await dateInput.fill('2025-12-01');
    
    const timeInput = page.locator('[data-testid="session-time-input"]');
    await timeInput.fill('06:00');
    
    // Verify can proceed
    const nextButton = page.locator('button:has-text("Next")');
    await expect(nextButton).toBeEnabled();
  });
});
```

---

## 12. Conclusion

### Summary of Findings

1. **Critical Bug:** Surf Discovery CTA routes to defunct `/sessions/wizard` (404)
2. **Missing Feature:** Session wizard doesn't read URL parameters for prefill
3. **Architecture Ready:** BeachSelector and DateTimeSection already support prefill via formState
4. **Low Risk:** Changes are backward compatible with existing flows

### Recommended Action

**Immediate:** Fix Surf Discovery routing bug (15 minutes)  
**Short-term:** Implement prefill functionality (2-3 hours)  
**Medium-term:** Add navigation helpers and comprehensive testing (3-4 hours)

**Total Effort:** ~6-8 hours for complete implementation and testing

### Success Metrics

- [ ] Zero 404 errors from "Plan Session" CTAs
- [ ] 100% of sessions planned from recommendations have prefilled beach
- [ ] 90%+ of sessions planned from recommendations use suggested time window
- [ ] Analytics tracking shows prefill source for attribution
- [ ] No regressions in existing direct navigation flows

---

**End of Report**
