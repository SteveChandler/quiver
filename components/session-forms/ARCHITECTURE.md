# Session Forms Components Architecture

> Current funnel telemetry contract: [`docs/SESSION_FUNNEL_TELEMETRY.md`](../../docs/SESSION_FUNNEL_TELEMETRY.md)

## PURPOSE

The session forms components provide a comprehensive, multi-step session planning and logging system with forecast integration, equipment management, and community features.

## COMPONENT STRUCTURE

```
components/session-forms/
├── SessionForm.tsx                  # Main container — UI state, effects, JSX only (~460 LOC)
├── session-submit-handler.ts        # Submission orchestration (validation, create, redirect)
├── session-conversion-handler.ts    # Planned-to-completed conversion logic
├── session-invitation-handler.ts    # Fire-and-forget invitation sending
├── SessionFormWrapper.tsx           # Auth wrapper and error boundaries
├── SessionFormHeader.tsx            # Mode-aware header component
├── session-wizard.tsx               # Phase 2 Wizard Component (Primary Interface)
├── index.ts                         # Component exports
├── ProgressIndicator.tsx            # Step progress visualization
├── FormNavigation.tsx               # Step navigation controls
├── DateTimeSection.tsx              # Date/time selection (dual mode)
├── DateTimeStep.tsx                 # Dedicated step for planning mode
├── LocationStep.tsx                 # Beach selection step
├── EquipmentStep.tsx                # Board selection with creation
├── ConditionsSection.tsx            # Session conditions and ratings
├── GoalsSection.tsx                 # Session goals and expectations
├── NotesSection.tsx                 # Session notes and observations
├── PhotoSelectionSection.tsx        # Photo upload integration
├── OptimalTimesSection.tsx          # AI-powered time recommendations
├── GearSuggestionsSection.tsx       # Smart board recommendations
└── GroupInvitationsSection.tsx      # Social session invitations

# Shared session data builder (used by BOTH SessionForm + useSessionSubmission):
lib/utils/session-data-builder.ts    # buildSessionPayload() — single source of truth for 6 condition fields
```

## ARCHITECTURE PATTERNS

### Dual-Mode Architecture

```typescript
type SessionFormMode = "plan" | "log";

// Mode-aware component behavior
const getFormSteps = (mode: SessionFormMode) => {
  if (mode === "plan") {
    return ["datetime", "location", "equipment", "goals", "optimal-times"];
  }
  return ["datetime", "location", "equipment", "conditions", "notes", "photos"];
};
```

### Step-Based State Management

```typescript
interface SessionFormState {
  // Core session data
  mode: SessionFormMode;
  currentStep: number;
  sessionDate: string;
  sessionTime: string;
  beachId: string;
  boardId: string;

  // Planning-specific
  goals: string[];
  groupInvitations: string[];

  // Logging-specific
  conditions: ConditionsData;
  notes: string;
  photos: File[];
}
```

### Controlled Form Pattern

```typescript
// Centralized state management
const [formState, setFormState] = useState<SessionFormState>(initialState);

const updateField = <K extends keyof SessionFormState>(
  field: K,
  value: SessionFormState[K]
) => {
  setFormState((prev) => ({ ...prev, [field]: value }));
};
```

## SESSION LOGGING DATA FLOW (CRITICAL)

### Overview

Session logging has **two code paths** that both use `buildSessionPayload()` from `lib/utils/session-data-builder.ts` as a **single source of truth** for mapping condition fields. This eliminates the historical risk of the two paths falling out of sync.

### Data Flow Diagram

```
UI Layer: ConditionsSection.tsx
│
│  User interacts with:
│  - Wave height input
│  - Wind speed/direction selectors
│  - Tide height/status inputs
│  - Forecast accuracy buttons (Yes/Kinda/No)
│
└─▶ formState (via updateField callback)
    │
    │  State fields updated:
    │  - formState.waveHeight (number)
    │  - formState.windSpeed (number)
    │  - formState.windDirection (string)
    │  - formState.tideHeight (number)
    │  - formState.tideStatus (string)
    │  - formState.forecastAccuracy ("accurate" | "somewhat" | "inaccurate")
    │
    ├─▶ Path 1: SessionForm.tsx → session-submit-handler.ts
    │   │
    │   └─▶ buildSessionPayload(formState, userId, isPlanning)
    │       │  from lib/utils/session-data-builder.ts
    │       └─▶ createLoggedSession() / createPlannedSession()
    │
    └─▶ Path 2: useSessionSubmission.ts (wizard page)
        │
        └─▶ buildSessionPayload(sessionData, userId, isPlanning)
            │  from lib/utils/session-data-builder.ts
            └─▶ createLoggedSession() / createPlannedSession()

    Both paths → Supabase sessions table
                 Columns populated:
                 - wave_height_ft (float)
                 - wind_speed_mph (float)
                 - wind_direction (text)
                 - tide_height_ft (float)
                 - tide_status (text)
                 - forecast_accuracy (text: 'accurate'|'somewhat'|'inaccurate')
```

### Condition Fields Reference

| Form State Field | Database Column | Type | Values |
|-----------------|-----------------|------|--------|
| `waveHeight` | `wave_height_ft` | float | 0-50 |
| `windSpeed` | `wind_speed_mph` | float | 0-100 |
| `windDirection` | `wind_direction` | text | N, NE, E, SE, S, SW, W, NW, OFFSHORE, ONSHORE, CROSS |
| `tideHeight` | `tide_height_ft` | float | -10 to 50 |
| `tideStatus` | `tide_status` | text | rising, falling, high, low |
| `forecastAccuracy` | `forecast_accuracy` | text | accurate, somewhat, inaccurate |

### Adding New Condition Fields

When adding new condition fields to `ConditionsSection.tsx`:

1. Add the field to `SessionFormState` type in `hooks/use-session-form.ts`
2. Update `ConditionsSection.tsx` to use `updateField()` for the new field
3. Add the field mapping in `lib/utils/session-data-builder.ts` (`buildSessionPayload`)
4. Add the field to the `SessionPayloadInput` and `SessionPayload` interfaces
5. Update `actions/session-actions.ts` if the server action needs changes
6. Add a test case in `__tests__/lib/utils/session-data-builder.test.ts`

Because both code paths use `buildSessionPayload()`, a single change ensures parity.

Failure to update both paths will result in data loss where the field appears to work in the UI but is never persisted to the database.

## SESSION-LOG FUNNEL TELEMETRY

`SessionScrollForm` creates one transient `sessionLogFlowId` per form attempt.
The ID is carried through the web funnel events so the canonical report can
join stages without stitching separate attempts from the same user. Funnel
events also include `client_stage_at` for logical ordering and
`schema_version: 1` for contract versioning.

The successful web submit has two analytics outputs: the existing browser
analytics event and an internal `/api/events` event. The internal event is the
joinable source and includes the persisted `sessions.id` as
`metadata.session_id`. The top-level analytics `session_id` remains the
anonymous-browser attribution field and must not be used as the surf-session
join key.

Native session-form telemetry already supplies the same correlation fields and
also emits validation-code arrays. The web save gate currently prevents a
validation-failure callback, so web validation failures are not yet represented
as `session_log_validation_failed` rows. Keep this distinction visible in
funnel reports.

When changing session-form telemetry, update the contract document and preserve
the focused tests for flow ID propagation, persisted submit correlation, and
event deduplication semantics.

### Historical Bug Reference (January 2025)

A bug was fixed where `forecast_accuracy` and other condition fields were not being saved to the database. The root cause was that `app/sessions/new/page.tsx` had its own `handleSessionComplete` function that built `loggedSessionData` without including these fields, even though:
- `ConditionsSection.tsx` correctly captured user input
- `AnimatedSessionWizard.tsx` correctly passed the data
- The server action was capable of storing the fields

The fix required adding all condition field mappings to the page-level handler.

## COMPONENT RESPONSIBILITIES

### SessionWizard (Phase 2 Primary Interface)

- **Purpose**: Modern wizard-style interface for session creation with enhanced UX
- **Features**:
  - Step-based navigation with visual progress
  - Phase 2 motion animations throughout
  - Auto-save functionality with visual feedback
  - Form validation with animated error states
  - Celebration animations on completion
  - Mobile-optimized touch interactions
  - Accessibility features (keyboard navigation, screen readers)

**Key Architecture Patterns:**

```typescript
// Wizard step configuration
interface WizardStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  component: React.ComponentType<WizardStepProps>;
  validateStep?: (formState: SessionFormState) => string | null;
}

// Auto-save with animation feedback
const useAutoSave = (formState: SessionFormState, delay: number = 2000) => {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  // Implements PHASE2_ANIMATIONS.sessionWizard.autoSave
};
```

**Phase 2 Motion Integration:**

```typescript
// Step transitions with spring animation
variants={PHASE2_ANIMATIONS.sessionWizard.stepTransition}
initial="initial"
animate="animate"
exit="exit"

// Progress bar with scale animation
variants={PHASE2_ANIMATIONS.sessionWizard.progressBar}
style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}

// Field focus states with scale and border color
variants={PHASE2_ANIMATIONS.sessionWizard.fieldFocus}
animate={isCurrent ? "focus" : "initial"}

// Form validation with shake and color changes
variants={PHASE2_ANIMATIONS.formValidation.error}
```

**Wizard Flow:**
1. **DateTime Step**: Date/time selection with validation
2. **Location Step**: Beach selection with search
3. **Equipment Step**: Board selection with creation
4. **Goals/Conditions Step**: Mode-specific content (planning vs logging)
5. **Photos Step**: Media upload (logging mode only)

**Success Metrics:**
- Reduced form abandonment through step-by-step guidance
- Enhanced user engagement with motion animations
- Improved completion rates with auto-save functionality
- Better mobile experience with touch-optimized interface

### SessionForm (Legacy Main Controller)

- **Purpose**: Orchestrates the entire session form experience
- **Features**:
  - Mode switching (plan/log)
  - Step navigation logic
  - Data persistence and submission
  - Forecast integration
  - URL state management

**Key State Management:**

```typescript
// URL-based mode detection
useEffect(() => {
  const urlMode = searchParams.get("mode");
  if (urlMode === "plan" || urlMode === "log") {
    setFormState((prev) => ({ ...prev, mode: urlMode }));
  }
}, [searchParams]);

// Planned session loading
useEffect(() => {
  const plannedSessionId = searchParams.get("plannedSessionId");
  if (plannedSessionId && formState.mode === "log") {
    loadPlannedSession(plannedSessionId);
  }
}, [searchParams, formState.mode]);
```

### SessionFormWrapper (Security & Error Handling)

- **Purpose**: Authentication wrapper and error boundaries
- **Features**:
  - Authentication requirement enforcement
  - Error boundary implementation
  - Loading state management
  - Fallback UI for errors

### Step Components (Modular UI)

#### DateTimeSection/DateTimeStep

- **Purpose**: Date and time selection with mode-specific behavior
- **Features**:
  - Past date validation for logging
  - Future date validation for planning
  - Time picker integration
  - Session conflict detection

```typescript
// Mode-aware date validation
const validateDate = (date: string, mode: SessionFormMode) => {
  const selectedDate = new Date(date);
  const today = new Date();

  if (mode === "log" && selectedDate > today) {
    return "Cannot log future sessions";
  }

  if (mode === "plan" && selectedDate < today) {
    return "Cannot plan past sessions";
  }

  return null;
};
```

#### LocationStep

- **Purpose**: Beach selection with search and filtering
- **Features**:
  - Beach search functionality
  - Favorites integration
  - Distance-based sorting
  - Recent beaches prioritization

#### EquipmentStep

- **Purpose**: Board selection with inline creation
- **Features**:
  - User's board collection display
  - Inline board creation form
  - Board recommendation system
  - Equipment suggestions based on conditions

#### ConditionsSection (Logging Mode)

- **Purpose**: Session condition rating and forecast accuracy feedback
- **Features**:
  - Wave quality rating (1-5 stars)
  - Crowd level assessment
  - Parking ease rating
  - Weather condition inputs (wave height, wind, tide)
  - Forecast accuracy feedback (Yes/Kinda/No buttons)
  - Auto-prefill from forecast data with user override capability

**Condition Fields:**

```typescript
// Field state tracking for auto-prefill
type FieldState = "empty" | "prefilled" | "user-edited";

// Fields managed by ConditionsSection
interface ConditionFields {
  waveHeight: number;           // Wave height in feet
  windSpeed: number;            // Wind speed in mph
  windDirection: string;        // Wind direction code
  tideHeight: number;           // Tide height in feet
  tideStatus: string;           // rising | falling | high | low
  forecastAccuracy: string;     // accurate | somewhat | inaccurate
}
```

**Forecast Accuracy Options:**

```typescript
const accuracyOptions = [
  { value: "accurate", label: "Yes", description: "Forecast was spot on" },
  { value: "somewhat", label: "Kinda", description: "Close but not perfect" },
  { value: "inaccurate", label: "No", description: "Forecast was wrong" },
];
```

#### OptimalTimesSection (Planning Mode)

- **Purpose**: AI-powered optimal session time recommendations
- **Features**:
  - Forecast-based time analysis
  - Condition scoring and ranking
  - Visual timeline display
  - Reasoning explanations

```typescript
interface OptimalTimeSlot {
  time: string;
  score: number;
  conditions: {
    waveHeight: number;
    waveQuality: string;
    windSpeed: number;
    windDirection: string;
    confidence: number;
    weatherCondition: string;
  };
  rating: "poor" | "fair" | "good" | "excellent";
  reasons: string[];
}
```

#### GearSuggestionsSection

- **Purpose**: Smart board recommendations based on conditions
- **Features**:
  - Historical usage analysis
  - Condition-based matching
  - Confidence scoring
  - Alternative suggestions

#### PhotoSelectionSection

- **Purpose**: Photo upload integration for logged sessions
- **Features**:
  - Multiple file selection
  - File validation and preview
  - Drag & drop support
  - Size limit enforcement

## DESIGN PATTERNS

### Progressive Disclosure

```typescript
// Show advanced options based on user progress
{
  formState.beachId && (
    <GearSuggestionsSection formState={formState} updateField={updateField} />
  );
}

{
  formState.mode === "plan" && formState.sessionDate && (
    <OptimalTimesSection formState={formState} updateField={updateField} />
  );
}
```

### Conditional Rendering by Mode

```typescript
// Mode-specific section rendering
{
  formState.mode === "log" ? (
    <>
      <ConditionsSection {...props} />
      <NotesSection {...props} />
      <PhotoSelectionSection {...props} />
    </>
  ) : (
    <>
      <GoalsSection {...props} />
      <OptimalTimesSection {...props} />
      <GroupInvitationsSection {...props} />
    </>
  );
}
```

### Smart Defaults and Persistence

```typescript
// Intelligent form defaults
const getSmartDefaults = (): Partial<SessionFormState> => {
  return {
    sessionDate: new Date().toISOString().split("T")[0],
    sessionTime: getCurrentTimeRounded(),
    beachId: user?.homeBeachId || "",
    boardId: user?.preferredBoardId || "",
  };
};

// Form state persistence
useEffect(() => {
  const savedState = localStorage.getItem("sessionFormDraft");
  if (savedState) {
    setFormState(JSON.parse(savedState));
  }
}, []);

useEffect(() => {
  localStorage.setItem("sessionFormDraft", JSON.stringify(formState));
}, [formState]);
```

## PERFORMANCE OPTIMIZATIONS

### Lazy Loading of Heavy Components

```typescript
// Dynamic imports for complex sections
const OptimalTimesSection = lazy(() => import("./OptimalTimesSection"));
const GearSuggestionsSection = lazy(() => import("./GearSuggestionsSection"));

// Conditional loading based on need
{
  shouldShowOptimalTimes && (
    <Suspense fallback={<SectionSkeleton />}>
      <OptimalTimesSection {...props} />
    </Suspense>
  );
}
```

### Debounced Auto-Save

```typescript
// Auto-save form progress
const debouncedSave = useMemo(
  () =>
    debounce(async (state: SessionFormState) => {
      await saveFormDraft(state);
    }, 1000),
  []
);

useEffect(() => {
  debouncedSave(formState);
}, [formState, debouncedSave]);
```

### Memoized Expensive Calculations

```typescript
// Memoize gear suggestions
const gearSuggestions = useMemo(() => {
  return calculateBoardRecommendations(
    userBoards,
    forecastData,
    historicalData
  );
}, [userBoards, forecastData, historicalData]);
```

## DATA INTEGRATION

### Forecast Integration

```typescript
// Real-time forecast data loading
useEffect(() => {
  const loadForecast = async () => {
    if (formState.beachId && formState.sessionDate) {
      setForecastLoading(true);
      try {
        const forecast = await getForecastForDate(
          formState.beachId,
          formState.sessionDate
        );
        setForecastData(forecast);
      } catch (error) {
        setForecastError(error.message);
      } finally {
        setForecastLoading(false);
      }
    }
  };

  loadForecast();
}, [formState.beachId, formState.sessionDate]);
```

### Server Actions Integration

```typescript
// Form submission with proper error handling
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsSubmitting(true);

  try {
    if (formState.mode === "plan") {
      const result = await createPlannedSessionAction(formState);
      if (result.success) {
        router.push(`/sessions/planned/${result.data.id}`);
      }
    } else {
      const result = await createLoggedSessionAction(formState, selectedFiles);
      if (result.success) {
        router.push(`/sessions/${result.data.id}`);
      }
    }
  } catch (error) {
    toast.error("Failed to save session");
  } finally {
    setIsSubmitting(false);
  }
};
```

## MOBILE OPTIMIZATION

### Touch-Friendly Interface

```typescript
// Large touch targets for ratings
<Button
  size="lg"
  variant={isSelected ? "default" : "outline"}
  className="min-h-[44px] min-w-[44px]"
  onClick={handleRatingClick}
>
  Star
</Button>
```

### Mobile-Specific Features

```typescript
// Mobile photo capture
<input
  type="file"
  accept="image/*"
  capture="environment" // Use camera for mobile
  multiple
  onChange={handlePhotoSelect}
/>
```

## TESTING CONSIDERATIONS

### Component Testing

- Step navigation functionality
- Form validation and submission
- Mode switching behavior
- Photo upload integration
- **Condition field data persistence** (verify fields reach database)

### Integration Testing

- Complete session creation flows
- Forecast data integration
- Server action integration
- Error handling scenarios
- **Dual code path validation** (test both wizard and page handlers)

### Regression Testing

When modifying condition fields, verify:
1. UI captures the value correctly
2. formState is updated via updateField
3. Both submission handlers include the field
4. Server action persists to database
5. Database column contains expected value

## FUTURE ENHANCEMENTS

### Planned Features

- Voice notes integration
- Advanced photo editing
- Session templates
- Collaborative planning
- Real-time weather alerts

### Performance Improvements

- Form state optimization
- Background data sync
- Offline capability
- Progressive web app features

## PHASE 2 MIGRATION STRATEGY

### Component Relationship

The **SessionWizard** component represents the modern Phase 2 interface that builds on the solid foundation of the existing **SessionForm** architecture:

- **SessionWizard**: New primary interface with enhanced UX and Phase 2 motion
- **SessionForm**: Legacy interface maintained for backward compatibility
- **Shared Step Components**: Both interfaces use the same underlying step components
- **Common State Management**: Both use `useSessionForm` hook for consistency

### Migration Path

```typescript
// Phase 2: Introduce wizard as alternative interface
import { SessionWizard } from "@/components/session-forms";

// Gradual rollout with feature flag
const useWizardInterface = user?.preferences?.useWizard ?? true;

return useWizardInterface ? (
  <SessionWizard initialMode={mode} />
) : (
  <SessionForm initialMode={mode} />
);
```

### Benefits of Dual Architecture

1. **Risk Mitigation**: Maintain proven SessionForm while introducing new features
2. **A/B Testing**: Compare user engagement between interfaces
3. **Gradual Migration**: Users can opt into new experience
4. **Feature Parity**: Both interfaces provide identical functionality
5. **Shared Components**: Minimize code duplication through reusable step components

---

**Last Updated**: August 12, 2026
**Status**: Production-ready with Phase 2 wizard interface and comprehensive session management. SessionForm refactored: business logic extracted to handler files, shared session data builder ensures condition field parity.
**Next Review**: After wizard A/B testing results, user feedback analysis, or a session telemetry contract change
