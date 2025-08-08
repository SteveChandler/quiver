# Session Forms Components Architecture

## 🎯 **PURPOSE**

The session forms components provide a comprehensive, multi-step session planning and logging system with forecast integration, equipment management, and community features.

## 📁 **COMPONENT STRUCTURE**

```
components/session-forms/
├── SessionForm.tsx               # Main container with business logic
├── SessionFormWrapper.tsx       # Auth wrapper and error boundaries
├── SessionFormHeader.tsx        # Mode-aware header component
├── ProgressIndicator.tsx        # Step progress visualization
├── FormNavigation.tsx           # Step navigation controls
├── DateTimeSection.tsx          # Date/time selection (dual mode)
├── DateTimeStep.tsx             # Dedicated step for planning mode
├── LocationStep.tsx             # Beach selection step
├── EquipmentStep.tsx            # Board selection with creation
├── ConditionsSection.tsx        # Session conditions and ratings
├── GoalsSection.tsx             # Session goals and expectations
├── NotesSection.tsx             # Session notes and observations
├── PhotoSelectionSection.tsx    # Photo upload integration
├── OptimalTimesSection.tsx      # AI-powered time recommendations
├── GearSuggestionsSection.tsx   # Smart board recommendations
└── GroupInvitationsSection.tsx  # Social session invitations
```

## 🏗️ **ARCHITECTURE PATTERNS**

### **Dual-Mode Architecture**

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

### **Step-Based State Management**

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

### **Controlled Form Pattern**

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

## 📊 **COMPONENT RESPONSIBILITIES**

### **SessionForm** (Main Controller)

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

### **SessionFormWrapper** (Security & Error Handling)

- **Purpose**: Authentication wrapper and error boundaries
- **Features**:
  - Authentication requirement enforcement
  - Error boundary implementation
  - Loading state management
  - Fallback UI for errors

### **Step Components** (Modular UI)

#### **DateTimeSection/DateTimeStep**

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

#### **LocationStep**

- **Purpose**: Beach selection with search and filtering
- **Features**:
  - Beach search functionality
  - Favorites integration
  - Distance-based sorting
  - Recent beaches prioritization

#### **EquipmentStep**

- **Purpose**: Board selection with inline creation
- **Features**:
  - User's board collection display
  - Inline board creation form
  - Board recommendation system
  - Equipment suggestions based on conditions

#### **ConditionsSection** (Logging Mode)

- **Purpose**: Session condition rating and feedback
- **Features**:
  - Wave quality rating (1-5 stars)
  - Crowd level assessment
  - Parking ease rating
  - Weather condition notes

```typescript
// Rating component pattern
function RatingInput({
  label,
  value,
  onChange,
  ratingType,
  emptyText,
}: RatingInputProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Button
            key={star}
            variant={parseInt(value) >= star ? "default" : "outline"}
            size="sm"
            onClick={() => onChange(star.toString())}
          >
            ⭐
          </Button>
        ))}
      </div>
    </div>
  );
}
```

#### **OptimalTimesSection** (Planning Mode)

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

#### **GearSuggestionsSection**

- **Purpose**: Smart board recommendations based on conditions
- **Features**:
  - Historical usage analysis
  - Condition-based matching
  - Confidence scoring
  - Alternative suggestions

#### **PhotoSelectionSection**

- **Purpose**: Photo upload integration for logged sessions
- **Features**:
  - Multiple file selection
  - File validation and preview
  - Drag & drop support
  - Size limit enforcement

## 🎨 **DESIGN PATTERNS**

### **Progressive Disclosure**

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

### **Conditional Rendering by Mode**

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

### **Smart Defaults and Persistence**

```typescript
// Intelligent form defaults
const getSmartDefaults = (): Partial<SessionFormState> => {
  return {
    sessionDate: new Date().toISOString().split("T")[0],
    sessionTime: getCurrentTimeRounded(),
    beachId: user?.defaultBeachId || "",
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

## 🚀 **PERFORMANCE OPTIMIZATIONS**

### **Lazy Loading of Heavy Components**

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

### **Debounced Auto-Save**

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

### **Memoized Expensive Calculations**

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

## 🔄 **DATA INTEGRATION**

### **Forecast Integration**

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

### **Server Actions Integration**

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

## 📱 **MOBILE OPTIMIZATION**

### **Touch-Friendly Interface**

```typescript
// Large touch targets for ratings
<Button
  size="lg"
  variant={isSelected ? "default" : "outline"}
  className="min-h-[44px] min-w-[44px]"
  onClick={handleRatingClick}
>
  ⭐
</Button>
```

### **Mobile-Specific Features**

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

## 🧪 **TESTING CONSIDERATIONS**

### **Component Testing**

- Step navigation functionality
- Form validation and submission
- Mode switching behavior
- Photo upload integration

### **Integration Testing**

- Complete session creation flows
- Forecast data integration
- Server action integration
- Error handling scenarios

## 🔮 **FUTURE ENHANCEMENTS**

### **Planned Features**

- Voice notes integration
- Advanced photo editing
- Session templates
- Collaborative planning
- Real-time weather alerts

### **Performance Improvements**

- Form state optimization
- Background data sync
- Offline capability
- Progressive web app features

---

**Last Updated**: January 2025  
**Status**: Production-ready with comprehensive session management  
**Next Review**: After voice notes implementation
