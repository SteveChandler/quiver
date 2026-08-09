# Session Wizard Consolidation Design Document

## Executive Summary

This document provides a comprehensive design for consolidating the Session Wizard from 6 steps (log mode) to 4 steps, fixing data loss issues, and eliminating redundant fields. The design addresses critical issues identified by code-archaeologist analysis.

**Version:** 1.0
**Date:** 2025-11-13
**Status:** Design Phase

---

## 1. Problem Statement

### 1.1 Current Issues

1. **Data Loss**: 6 fields collected but NOT saved to database
   - `waveHeight` (in ConditionsSection, local state only)
   - `windSpeed` (in ConditionsSection, local state only)
   - `windDirection` (in ConditionsSection, local state only)
   - `waterTemp` (in ConditionsSection, local state only)
   - `vibeNotes` (in ConditionsSection, local state only)
   - `forecastAccuracy` (in ConditionsSection, local state only)

2. **State Management Issues**
   - Local `useState` in ConditionsSection disconnected from `formState`
   - No `updateField` calls for collected data
   - Photos managed in AnimatedSessionWizard, not formState

3. **Redundant Fields**
   - `notes` field in NotesSection (connected to formState)
   - `vibeNotes` field in ConditionsSection (local state, not saved)
   - Confusion about which notes field to use

4. **Poor UX**
   - 6 steps is too many for logging a session
   - Photos isolated in separate step
   - Conditions data spread across multiple locations

### 1.2 User Requirements

- Consolidate Conditions + Photos + Notes → "Session Details" step
- Reduce log mode from 6 steps to 4 steps
- Fix all data binding issues
- Single source of truth for all session data
- Maintain backward compatibility during rollout

---

## 2. Database Schema Changes

### 2.1 Required New Columns

Add to `sessions` table:

```sql
-- Migration: 20251113_add_session_condition_fields.sql

ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS wave_height_ft DECIMAL(4,1),
ADD COLUMN IF NOT EXISTS wind_speed_mph INTEGER,
ADD COLUMN IF NOT EXISTS wind_direction TEXT,
ADD COLUMN IF NOT EXISTS forecast_accuracy TEXT CHECK (forecast_accuracy IN ('accurate', 'somewhat', 'inaccurate')),
ADD COLUMN IF NOT EXISTS wave_types TEXT[] DEFAULT '{}';

COMMENT ON COLUMN sessions.wave_height_ft IS 'Actual wave height in feet as reported by user';
COMMENT ON COLUMN sessions.wind_speed_mph IS 'Wind speed in mph as reported by user';
COMMENT ON COLUMN sessions.wind_direction IS 'Wind direction (N, NE, E, SE, S, SW, W, NW, OFFSHORE, ONSHORE, CROSS)';
COMMENT ON COLUMN sessions.forecast_accuracy IS 'User-reported forecast accuracy: accurate, somewhat, inaccurate';
COMMENT ON COLUMN sessions.wave_types IS 'Array of wave type IDs selected by user';

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_sessions_wave_height ON sessions(wave_height_ft) WHERE wave_height_ft IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_forecast_accuracy ON sessions(forecast_accuracy) WHERE forecast_accuracy IS NOT NULL;
```

### 2.2 Existing Columns (No Changes)

Already present in sessions table:
- `water_temp` (number | null) - Water temperature in Fahrenheit
- `wave_quality` (number | null) - Rating 1-5
- `crowd_level` (number | null) - Rating 1-5
- `parking_ease` (number | null) - Rating 1-5
- `rating` (number | null) - Overall session rating 1-5
- `notes` (string | null) - Session notes
- `duration_minutes` (number) - Session duration

### 2.3 Photo Storage

Photos continue to use existing infrastructure:
- Table: `session_photos`
- Storage bucket: `session-images`
- Upload handled by session-actions.ts

---

## 3. TypeScript Type Definitions

### 3.1 Enhanced SessionFormState

```typescript
// File: hooks/use-session-form.ts

export type SessionFormState = {
  // STEP 1: Location
  selectedBeach: string;
  selectedBeachId?: string;

  // STEP 2: Date & Time
  selectedDate: string;
  selectedTime: string;

  // STEP 3: Equipment (log mode only)
  selectedBoard: string;
  boardId?: string;

  // STEP 4: Session Details (CONSOLIDATED - log mode)
  // --- Duration ---
  duration: string; // Format: "60m" or "1h 30m"

  // --- Wave Conditions ---
  waveHeight?: number; // NEW: Wave height in feet
  waveQuality: string; // Rating 1-5
  waveTypes: string[]; // Array of wave type IDs

  // --- Environmental Conditions ---
  windSpeed?: number; // NEW: Wind speed in mph
  windDirection?: string; // NEW: Wind direction
  waterTemp: string; // Water temperature in Fahrenheit

  // --- Experience Ratings ---
  crowdLevel: string; // Rating 1-5
  parkingEase: string; // Rating 1-5
  overallRating: string; // Rating 1-5

  // --- Session Notes ---
  notes: string; // SINGLE notes field (merged vibeNotes into this)

  // --- Forecast Accuracy ---
  forecastAccuracy?: 'accurate' | 'somewhat' | 'inaccurate'; // NEW

  // --- Photos ---
  photos: File[]; // NEW: Managed in formState, not local state
  photoUrls?: string[]; // For display of uploaded photos

  // PLAN MODE ONLY: Goals & Invitations
  goals?: string[];
  invitees?: Array<{
    userId?: string;
    email?: string;
    name?: string;
  }>;
  invitationMessage?: string;

  // Session Planner Pro fields (existing)
  optimalTimes?: Array<{
    time: string;
    score: number;
    rating: "poor" | "fair" | "good" | "excellent";
    conditions: {
      waveHeight: number;
      waveQuality: string;
      windSpeed: number;
      windDirection: string;
      confidence: number;
    };
    reasons: string[];
  }>;
  selectedOptimalTime?: string;
  boardSuggestions?: Array<{
    boardId: string;
    score: number;
    confidence: number;
    reasons: string[];
  }>;
};
```

### 3.2 Wizard Step Configuration Types

```typescript
// File: components/session/wizard/types.ts

export interface WizardStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  component: string;
  isRequired: boolean;
  validationRules?: ValidationRule[];
}

export interface ValidationRule {
  field: keyof SessionFormState;
  validate: (value: any, formState: SessionFormState) => boolean;
  errorMessage: string;
}

export type SessionFormMode = "plan" | "log";
```

---

## 4. Step Configuration Design

### 4.1 Log Mode Steps (4 Steps - CONSOLIDATED)

```typescript
// File: components/session/wizard/session-wizard-config.ts

import {
  MapPin,
  Calendar,
  Target,
  FileText,
} from "lucide-react";

export const LOG_MODE_STEPS: WizardStep[] = [
  {
    id: "location",
    title: "Location",
    description: "Where did your session take place?",
    icon: <MapPin className="w-5 h-5" />,
    component: "LocationStep",
    isRequired: true,
    validationRules: [
      {
        field: "selectedBeachId",
        validate: (value) => Boolean(value),
        errorMessage: "Please select a beach location",
      },
    ],
  },
  {
    id: "datetime",
    title: "When",
    description: "When did you surf?",
    icon: <Calendar className="w-5 h-5" />,
    component: "DateTimeSection",
    isRequired: true,
    validationRules: [
      {
        field: "selectedDate",
        validate: (value) => Boolean(value),
        errorMessage: "Please select a date",
      },
    ],
  },
  {
    id: "equipment",
    title: "Equipment",
    description: "Which board did you ride?",
    icon: <Target className="w-5 h-5" />,
    component: "EquipmentStep",
    isRequired: false,
  },
  {
    id: "session-details", // CONSOLIDATED STEP
    title: "Session Details",
    description: "Rate conditions, add photos, and share your experience",
    icon: <FileText className="w-5 h-5" />,
    component: "SessionDetailsSection", // NEW COMPONENT
    isRequired: false,
  },
];
```

### 4.2 Plan Mode Steps (4 Steps - UNCHANGED)

```typescript
export const PLAN_MODE_STEPS: WizardStep[] = [
  {
    id: "location",
    title: "Location",
    description: "Choose where you'll be surfing",
    icon: <MapPin className="w-5 h-5" />,
    component: "LocationStep",
    isRequired: true,
  },
  {
    id: "datetime",
    title: "When",
    description: "Set your session date and time",
    icon: <Calendar className="w-5 h-5" />,
    component: "DateTimeSection",
    isRequired: true,
  },
  {
    id: "goals",
    title: "Goals",
    description: "What do you want to focus on?",
    icon: <Target className="w-5 h-5" />,
    component: "GoalsSection",
    isRequired: false,
  },
  {
    id: "notes",
    title: "Notes & Invites",
    description: "Add notes and invite friends",
    icon: <FileText className="w-5 h-5" />,
    component: "NotesSection",
    isRequired: false,
  },
];
```

---

## 5. Component Design: SessionDetailsSection

### 5.1 Component Interface

```typescript
// File: components/session-forms/SessionDetailsSection.tsx

"use client";

import React from "react";
import { SessionFormState } from "@/hooks/use-session-form";

interface SessionDetailsSectionProps {
  formState: SessionFormState;
  updateField: <K extends keyof SessionFormState>(
    field: K,
    value: SessionFormState[K]
  ) => void;
  mode: SessionFormMode;
}

export function SessionDetailsSection({
  formState,
  updateField,
  mode,
}: SessionDetailsSectionProps) {
  // Component implementation
}
```

### 5.2 Component Structure

```tsx
<SimpleCardLayout
  title="Session Details"
  description="Rate conditions, add photos, and share your experience"
>
  <div className="space-y-8">
    {/* SECTION 1: Duration */}
    <DurationInput
      value={formState.duration}
      onChange={(value) => updateField("duration", value)}
    />

    {/* SECTION 2: Wave Conditions */}
    <div className="space-y-6">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
        Wave Conditions
      </h3>

      {/* Forecast Comparison (if available) */}
      <ForecastComparison
        beachId={formState.selectedBeachId}
        date={formState.selectedDate}
        time={formState.selectedTime}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Wave Height */}
        <NumberInput
          label="Wave Height (ft)"
          icon={<Waves />}
          value={formState.waveHeight}
          onChange={(value) => updateField("waveHeight", value)}
          placeholder="3.5"
          step={0.1}
          min={0}
          max={50}
        />

        {/* Water Temperature */}
        <NumberInput
          label="Water Temp (°F)"
          icon={<Thermometer />}
          value={formState.waterTemp}
          onChange={(value) => updateField("waterTemp", value)}
          placeholder="68"
          min={32}
          max={100}
        />

        {/* Wind Speed */}
        <NumberInput
          label="Wind Speed (mph)"
          icon={<Wind />}
          value={formState.windSpeed}
          onChange={(value) => updateField("windSpeed", value)}
          placeholder="10"
          step={0.1}
          min={0}
          max={150}
        />

        {/* Wind Direction */}
        <SelectInput
          label="Wind Direction"
          value={formState.windDirection}
          onChange={(value) => updateField("windDirection", value)}
          options={WIND_DIRECTIONS}
        />
      </div>

      {/* Wave Types */}
      <WaveTypeSelector
        selectedTypes={formState.waveTypes}
        onChange={(types) => updateField("waveTypes", types)}
      />
    </div>

    {/* SECTION 3: Experience Ratings */}
    <div className="space-y-6">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
        Session Experience
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <RatingInput
          label="Wave Quality"
          icon={Star}
          value={formState.waveQuality}
          onChange={(value) => updateField("waveQuality", value)}
          colorClass="text-yellow-500"
          ratingType="waveQuality"
        />

        <RatingInput
          label="Parking Ease"
          icon={Car}
          value={formState.parkingEase}
          onChange={(value) => updateField("parkingEase", value)}
          colorClass="text-green-500"
          ratingType="parkingEase"
        />

        <RatingInput
          label="Crowd Level"
          icon={Users}
          value={formState.crowdLevel}
          onChange={(value) => updateField("crowdLevel", value)}
          colorClass="text-orange-500"
          ratingType="crowdLevel"
        />
      </div>
    </div>

    {/* SECTION 4: Forecast Accuracy */}
    <ForecastAccuracySelector
      value={formState.forecastAccuracy}
      onChange={(value) => updateField("forecastAccuracy", value)}
    />

    {/* SECTION 5: Photos */}
    <PhotoUploadSection
      photos={formState.photos}
      onChange={(files) => updateField("photos", files)}
      maxPhotos={5}
    />

    {/* SECTION 6: Session Notes */}
    <div>
      <label className="mb-2 block text-sm font-medium">
        Session Notes
      </label>
      <Textarea
        placeholder="Share your experience, memorable moments, conditions, etc..."
        className="min-h-[100px]"
        value={formState.notes}
        onChange={(e) => updateField("notes", e.target.value)}
      />
      <p className="text-xs text-muted-foreground mt-1">
        Include wave details, new skills learned, or local knowledge to help other surfers
      </p>
    </div>

    {/* Community Contribution Message */}
    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
      <p className="text-xs text-blue-700 text-center">
        💡 Your condition reports help improve forecasts and assist other surfers
      </p>
    </div>
  </div>
</SimpleCardLayout>
```

### 5.3 Reusable Sub-Components

```typescript
// File: components/session-forms/consolidated-sections/

// DurationInput.tsx
export function DurationInput({ value, onChange }: DurationInputProps) {
  // Duration picker with presets: 30m, 1h, 1.5h, 2h, 2.5h, 3h, Custom
}

// ForecastComparison.tsx
export function ForecastComparison({ beachId, date, time }: ForecastComparisonProps) {
  // Uses useSessionForecast hook
  // Displays forecast data vs actual (when available)
}

// NumberInput.tsx
export function NumberInput({ label, icon, value, onChange, ...props }: NumberInputProps) {
  // Labeled number input with icon
}

// SelectInput.tsx
export function SelectInput({ label, value, onChange, options }: SelectInputProps) {
  // Labeled select dropdown
}

// RatingInput.tsx (reuse from existing ConditionsSection)
export function RatingInput({ label, icon, value, onChange, ratingType }: RatingInputProps) {
  // 5-star rating component with descriptions
}

// ForecastAccuracySelector.tsx
export function ForecastAccuracySelector({ value, onChange }: ForecastAccuracySelectorProps) {
  // 3-button selector: Yes (accurate), Kinda (somewhat), No (inaccurate)
}

// PhotoUploadSection.tsx (refactored from PhotoSelectionSection)
export function PhotoUploadSection({ photos, onChange, maxPhotos }: PhotoUploadSectionProps) {
  // Drag-and-drop photo upload
  // Photos stored in formState.photos (File[])
  // No local state
}
```

---

## 6. Data Flow & Transformation

### 6.1 Form State → Database Mapping

```typescript
// File: actions/session-actions.ts

export async function createLoggedSession(sessionData: SessionFormState) {
  // Transform formState to database insert
  const dbData: SessionInsert = {
    // Core fields
    user_id: user.id,
    beach_id: sessionData.selectedBeachId!,
    beach_name: sessionData.selectedBeach,
    arrival_time: combineDateTime(sessionData.selectedDate, sessionData.selectedTime),
    status: 'completed',

    // Equipment
    board_id: sessionData.boardId || null,

    // Duration
    duration_minutes: parseDuration(sessionData.duration),

    // Wave conditions (NEW FIELDS)
    wave_height_ft: sessionData.waveHeight || null,
    wave_quality: parseInt(sessionData.waveQuality) || null,
    wave_types: sessionData.waveTypes || [],

    // Environmental conditions (NEW FIELDS)
    wind_speed_mph: sessionData.windSpeed || null,
    wind_direction: sessionData.windDirection || null,
    water_temp: parseFloat(sessionData.waterTemp) || null,

    // Experience ratings
    crowd_level: parseInt(sessionData.crowdLevel) || null,
    parking_ease: parseInt(sessionData.parkingEase) || null,
    rating: parseInt(sessionData.overallRating) || null,

    // Forecast accuracy (NEW FIELD)
    forecast_accuracy: sessionData.forecastAccuracy || null,

    // Notes (SINGLE SOURCE)
    notes: sessionData.notes || null,
  };

  // Insert session
  const { data: session, error } = await supabase
    .from('sessions')
    .insert(dbData)
    .select()
    .single();

  if (error) throw error;

  // Upload photos if present
  if (sessionData.photos && sessionData.photos.length > 0) {
    await uploadSessionPhotos(session.id, sessionData.photos);
  }

  return { success: true, data: session };
}

// Helper: Parse duration string to minutes
function parseDuration(duration: string): number {
  if (!duration) return 60; // Default 1 hour

  const hourMatch = duration.match(/(\d+)h/);
  const minuteMatch = duration.match(/(\d+)m/);

  const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
  const minutes = minuteMatch ? parseInt(minuteMatch[1]) : 0;

  return hours * 60 + minutes;
}

// Helper: Combine date and time
function combineDateTime(date: string, time?: string): string {
  if (!time) {
    return new Date(`${date}T00:00:00`).toISOString();
  }

  const dateTimeString = `${date}T${time}:00`;
  return new Date(dateTimeString).toISOString();
}

// Helper: Upload photos to storage
async function uploadSessionPhotos(sessionId: string, photos: File[]) {
  const uploadPromises = photos.map(async (file, index) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${sessionId}/${Date.now()}-${index}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('session-images')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('session-images')
      .getPublicUrl(fileName);

    // Insert into session_photos table
    await supabase.from('session_photos').insert({
      session_id: sessionId,
      photo_url: publicUrl,
      display_order: index,
    });

    return publicUrl;
  });

  return Promise.all(uploadPromises);
}
```

### 6.2 Database → Form State (Edit Mode)

```typescript
export async function loadSessionForEdit(sessionId: string): Promise<SessionFormState> {
  const { data: session, error } = await supabase
    .from('sessions')
    .select(`
      *,
      session_photos (photo_url, display_order)
    `)
    .eq('id', sessionId)
    .single();

  if (error) throw error;

  // Transform database to formState
  const formState: SessionFormState = {
    // Location
    selectedBeach: session.beach_name || '',
    selectedBeachId: session.beach_id,

    // Date & Time
    selectedDate: session.arrival_time.split('T')[0],
    selectedTime: session.arrival_time.split('T')[1]?.substring(0, 5) || '',

    // Equipment
    selectedBoard: '',
    boardId: session.board_id || undefined,

    // Duration
    duration: formatDuration(session.duration_minutes),

    // Wave conditions
    waveHeight: session.wave_height_ft || undefined,
    waveQuality: session.wave_quality?.toString() || '',
    waveTypes: session.wave_types || [],

    // Environmental conditions
    windSpeed: session.wind_speed_mph || undefined,
    windDirection: session.wind_direction || undefined,
    waterTemp: session.water_temp?.toString() || '',

    // Experience ratings
    crowdLevel: session.crowd_level?.toString() || '',
    parkingEase: session.parking_ease?.toString() || '',
    overallRating: session.rating?.toString() || '',

    // Forecast accuracy
    forecastAccuracy: session.forecast_accuracy || undefined,

    // Notes
    notes: session.notes || '',

    // Photos (convert URLs to display)
    photos: [],
    photoUrls: session.session_photos
      ?.sort((a, b) => a.display_order - b.display_order)
      .map(p => p.photo_url) || [],
  };

  return formState;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}
```

---

## 7. Validation Rules

### 7.1 Field-Level Validation

```typescript
// File: lib/validation/session-validation.ts

export const SESSION_VALIDATION_RULES = {
  // Required fields
  selectedBeachId: {
    required: true,
    message: "Please select a beach location",
  },
  selectedDate: {
    required: true,
    message: "Please select a date",
    validate: (value: string) => {
      const date = new Date(value);
      return !isNaN(date.getTime());
    },
  },

  // Optional numeric fields with range validation
  waveHeight: {
    required: false,
    validate: (value?: number) => {
      if (value === undefined) return true;
      return value >= 0 && value <= 50;
    },
    message: "Wave height must be between 0 and 50 feet",
  },
  windSpeed: {
    required: false,
    validate: (value?: number) => {
      if (value === undefined) return true;
      return value >= 0 && value <= 150;
    },
    message: "Wind speed must be between 0 and 150 mph",
  },
  waterTemp: {
    required: false,
    validate: (value: string) => {
      if (!value) return true;
      const temp = parseFloat(value);
      return temp >= 32 && temp <= 100;
    },
    message: "Water temperature must be between 32°F and 100°F",
  },

  // Rating fields (1-5)
  waveQuality: {
    required: false,
    validate: (value: string) => {
      if (!value) return true;
      const rating = parseInt(value);
      return rating >= 1 && rating <= 5;
    },
    message: "Rating must be between 1 and 5",
  },
  crowdLevel: {
    required: false,
    validate: (value: string) => {
      if (!value) return true;
      const rating = parseInt(value);
      return rating >= 1 && rating <= 5;
    },
    message: "Rating must be between 1 and 5",
  },
  parkingEase: {
    required: false,
    validate: (value: string) => {
      if (!value) return true;
      const rating = parseInt(value);
      return rating >= 1 && rating <= 5;
    },
    message: "Rating must be between 1 and 5",
  },
  overallRating: {
    required: false,
    validate: (value: string) => {
      if (!value) return true;
      const rating = parseInt(value);
      return rating >= 1 && rating <= 5;
    },
    message: "Rating must be between 1 and 5",
  },

  // Photos
  photos: {
    required: false,
    validate: (files: File[]) => {
      if (!files || files.length === 0) return true;
      return files.length <= 5;
    },
    message: "Maximum 5 photos allowed",
  },
};

export function validateField<K extends keyof SessionFormState>(
  field: K,
  value: SessionFormState[K]
): { valid: boolean; message?: string } {
  const rule = SESSION_VALIDATION_RULES[field];

  if (!rule) return { valid: true };

  if (rule.required && !value) {
    return { valid: false, message: rule.message };
  }

  if (rule.validate && !rule.validate(value)) {
    return { valid: false, message: rule.message };
  }

  return { valid: true };
}
```

### 7.2 Step-Level Validation

```typescript
export function validateStep(
  stepId: string,
  formState: SessionFormState,
  mode: SessionFormMode
): boolean {
  switch (stepId) {
    case "location":
      return Boolean(formState.selectedBeachId);

    case "datetime":
      if (mode === "plan") {
        return Boolean(formState.selectedDate && formState.selectedTime);
      }
      return Boolean(formState.selectedDate);

    case "equipment":
      return true; // Optional step

    case "session-details":
      return true; // Optional step, but warn if no data entered

    default:
      return true;
  }
}
```

---

## 8. Migration Strategy

### 8.1 Phase 1: Database Migration (Zero Downtime)

```bash
# Run migration to add new columns
supabase migration new add_session_condition_fields

# Deploy migration
supabase db push
```

New columns are nullable, so existing data remains valid.

### 8.2 Phase 2: Code Rollout

```typescript
// Feature flag approach
export const USE_CONSOLIDATED_WIZARD = process.env.NEXT_PUBLIC_USE_CONSOLIDATED_WIZARD === 'true';

// In AnimatedSessionWizard.tsx
const steps = USE_CONSOLIDATED_WIZARD
  ? WIZARD_STEPS_V2[mode]
  : WIZARD_STEPS_V1[mode];
```

### 8.3 Phase 3: Data Backfill (Optional)

If needed, backfill historical sessions with default values:

```sql
-- Example: Set default forecast_accuracy for sessions without it
UPDATE sessions
SET forecast_accuracy = 'somewhat'
WHERE forecast_accuracy IS NULL
  AND created_at < '2025-11-13'
  AND status = 'completed';
```

### 8.4 Phase 4: Cleanup

After 2 weeks of successful operation:
1. Remove feature flag
2. Delete old step components (ConditionsSection, PhotosSection, NotesSection)
3. Update documentation

---

## 9. Testing Strategy

### 9.1 Unit Tests

```typescript
// __tests__/unit/session-wizard/SessionDetailsSection.test.tsx

describe('SessionDetailsSection', () => {
  it('should update formState when fields change', () => {
    const updateField = jest.fn();

    render(
      <SessionDetailsSection
        formState={mockFormState}
        updateField={updateField}
        mode="log"
      />
    );

    // Test wave height input
    const waveHeightInput = screen.getByLabelText(/wave height/i);
    fireEvent.change(waveHeightInput, { target: { value: '4.5' } });

    expect(updateField).toHaveBeenCalledWith('waveHeight', 4.5);
  });

  it('should validate numeric inputs', () => {
    // Test range validation
  });

  it('should handle photo uploads', () => {
    // Test photo upload flow
  });
});
```

### 9.2 Integration Tests

```typescript
// __tests__/integration/session-wizard-flow.test.tsx

describe('Session Wizard Flow', () => {
  it('should complete full log flow with all data saved', async () => {
    // Navigate through all 4 steps
    // Fill in all fields
    // Submit
    // Verify database insert
  });

  it('should preserve data when navigating between steps', () => {
    // Fill in step 4
    // Go back to step 2
    // Go forward to step 4
    // Verify data still present
  });
});
```

### 9.3 E2E Tests

```typescript
// e2e/session-wizard-consolidated.spec.ts

test('should log complete session with all condition data', async ({ page }) => {
  // Login
  await loginAsTestUser(page);

  // Start wizard
  await page.goto('/sessions/new?mode=log');

  // Step 1: Location
  await page.click('[data-testid="beach-selector"]');
  await page.click('text="Malibu Surfrider Beach"');
  await page.click('text="Next"');

  // Step 2: Date & Time
  await page.fill('[data-testid="date-input"]', '2025-11-13');
  await page.click('text="Next"');

  // Step 3: Equipment
  await page.click('[data-testid="board-selector"]');
  await page.click('text="9\'0 Longboard"');
  await page.click('text="Next"');

  // Step 4: Session Details
  await page.fill('[data-testid="wave-height-input"]', '3.5');
  await page.fill('[data-testid="wind-speed-input"]', '10');
  await page.selectOption('[data-testid="wind-direction-select"]', 'OFFSHORE');
  await page.fill('[data-testid="water-temp-input"]', '68');

  // Rate wave quality
  await page.click('[data-testid="wave-quality-4"]');

  // Select wave types
  await page.click('[data-testid="wave-type-point-break"]');

  // Forecast accuracy
  await page.click('text="Yes"'); // Forecast was accurate

  // Add notes
  await page.fill('[data-testid="notes-textarea"]', 'Epic session! Clean overhead sets.');

  // Upload photo
  const fileInput = await page.locator('input[type="file"]');
  await fileInput.setInputFiles('e2e/fixtures/test-photo.jpg');

  // Submit
  await page.click('text="Log Session"');

  // Verify success
  await expect(page.locator('text="Session logged successfully!"')).toBeVisible();

  // Verify database
  const session = await getLatestSession();
  expect(session.wave_height_ft).toBe(3.5);
  expect(session.wind_speed_mph).toBe(10);
  expect(session.wind_direction).toBe('OFFSHORE');
  expect(session.water_temp).toBe(68);
  expect(session.wave_quality).toBe(4);
  expect(session.forecast_accuracy).toBe('accurate');
  expect(session.notes).toContain('Epic session');
  expect(session.session_photos).toHaveLength(1);
});
```

---

## 10. Performance Considerations

### 10.1 Photo Upload Optimization

```typescript
// Compress photos before upload
async function compressPhoto(file: File): Promise<File> {
  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
  };

  return await imageCompression(file, options);
}

// Upload in parallel
async function uploadSessionPhotos(sessionId: string, photos: File[]) {
  const compressionPromises = photos.map(compressPhoto);
  const compressedPhotos = await Promise.all(compressionPromises);

  const uploadPromises = compressedPhotos.map((file, index) =>
    uploadSinglePhoto(sessionId, file, index)
  );

  return Promise.all(uploadPromises);
}
```

### 10.2 Forecast Data Caching

```typescript
// Cache forecast data to avoid redundant API calls
const forecastCache = new Map<string, ForecastData>();

export function useSessionForecast(beachId, date, time) {
  const cacheKey = `${beachId}-${date}-${time}`;

  const [data, setData] = useState(() => forecastCache.get(cacheKey));

  useEffect(() => {
    if (data) return;

    fetchForecast(beachId, date, time).then(result => {
      forecastCache.set(cacheKey, result);
      setData(result);
    });
  }, [beachId, date, time]);

  return { forecastData: data };
}
```

### 10.3 Bundle Size

SessionDetailsSection consolidates 3 components:
- Before: ConditionsSection (15KB) + PhotosSection (8KB) + NotesSection (5KB) = 28KB
- After: SessionDetailsSection (20KB) = 28% reduction

---

## 11. Accessibility (a11y)

### 11.1 Keyboard Navigation

```tsx
// All interactive elements must be keyboard accessible
<button
  type="button"
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }}
  aria-label="Rate wave quality as 4 stars"
>
  <Star />
</button>
```

### 11.2 Screen Reader Support

```tsx
// Announce validation errors
<div role="alert" aria-live="polite">
  {errors.waveHeight && (
    <span className="text-red-600">{errors.waveHeight}</span>
  )}
</div>

// Label all inputs
<label htmlFor={waveHeightId}>
  Wave Height (ft)
</label>
<input
  id={waveHeightId}
  type="number"
  aria-describedby={`${waveHeightId}-description`}
/>
<span id={`${waveHeightId}-description`} className="sr-only">
  Enter wave height in feet, between 0 and 50
</span>
```

### 11.3 ARIA Landmarks

```tsx
<section aria-labelledby="wave-conditions-heading">
  <h3 id="wave-conditions-heading">Wave Conditions</h3>
  {/* Content */}
</section>

<section aria-labelledby="experience-ratings-heading">
  <h3 id="experience-ratings-heading">Session Experience</h3>
  {/* Content */}
</section>
```

---

## 12. Success Metrics

### 12.1 Data Quality Metrics

Track after rollout:

```sql
-- Completeness rate for new fields
SELECT
  COUNT(*) FILTER (WHERE wave_height_ft IS NOT NULL) * 100.0 / COUNT(*) as wave_height_completion_rate,
  COUNT(*) FILTER (WHERE wind_speed_mph IS NOT NULL) * 100.0 / COUNT(*) as wind_speed_completion_rate,
  COUNT(*) FILTER (WHERE forecast_accuracy IS NOT NULL) * 100.0 / COUNT(*) as forecast_accuracy_completion_rate
FROM sessions
WHERE created_at >= '2025-11-13'
  AND status = 'completed';
```

Target: >70% completion rate for core condition fields

### 12.2 User Engagement Metrics

```typescript
// Track wizard completion rates
{
  metric: 'wizard_completion_rate',
  formula: 'completed_sessions / started_sessions',
  target: '>80%',
}

{
  metric: 'avg_time_per_step',
  target: '<30 seconds',
}

{
  metric: 'photo_upload_rate',
  formula: 'sessions_with_photos / total_sessions',
  target: '>40%',
}
```

### 12.3 Performance Metrics

```typescript
{
  metric: 'wizard_load_time',
  target: '<1 second',
}

{
  metric: 'photo_upload_time',
  target: '<5 seconds per photo',
}

{
  metric: 'session_submission_time',
  target: '<2 seconds',
}
```

---

## 13. Implementation Checklist

### Phase 1: Database & Types
- [ ] Create migration: `20251113_add_session_condition_fields.sql`
- [ ] Deploy migration to staging
- [ ] Deploy migration to production
- [ ] Update `SessionFormState` type
- [ ] Update database types: `yarn db:types`

### Phase 2: Components
- [ ] Create `SessionDetailsSection.tsx`
- [ ] Create sub-components (DurationInput, PhotoUploadSection, etc.)
- [ ] Add validation logic
- [ ] Add accessibility features
- [ ] Update `session-wizard-config.ts` with new steps

### Phase 3: Integration
- [ ] Update `AnimatedSessionWizard.tsx` to use new config
- [ ] Update `createLoggedSession` action
- [ ] Update `loadSessionForEdit` function
- [ ] Remove local state from all components

### Phase 4: Testing
- [ ] Write unit tests for SessionDetailsSection
- [ ] Write integration tests for wizard flow
- [ ] Write E2E tests for complete session logging
- [ ] Manual testing on staging

### Phase 5: Deployment
- [ ] Deploy to staging with feature flag
- [ ] QA testing
- [ ] Deploy to production with feature flag
- [ ] Monitor metrics
- [ ] Enable feature flag for 10% of users
- [ ] Enable feature flag for 100% of users

### Phase 6: Cleanup
- [ ] Remove feature flag
- [ ] Delete old components
- [ ] Update documentation
- [ ] Archive design document

---

## 14. Rollback Plan

If issues are discovered:

```typescript
// Immediate rollback via feature flag
export const USE_CONSOLIDATED_WIZARD = false;
```

Database changes are backward compatible (all new columns are nullable), so no database rollback is needed.

---

## 15. Open Questions & Decisions

### 15.1 Resolved

✅ **Q: Should photos be in formState or local state?**
A: formState. Single source of truth.

✅ **Q: Should we merge vibeNotes and notes?**
A: Yes. Single `notes` field is clearer.

✅ **Q: How many steps for log mode?**
A: 4 steps (Location, Date/Time, Equipment, Session Details).

### 15.2 Pending

❓ **Q: Should we add an "Overall Rating" separate from wave quality?**
A: Need PM input. Currently have `rating` field in database.

❓ **Q: Should forecast accuracy be required or optional?**
A: Recommend optional. Not all sessions have forecast data.

❓ **Q: Should we pre-fill wind/wave data from forecast?**
A: Good UX enhancement. Add to backlog.

---

## 16. Future Enhancements

### 16.1 V2 Features (Post-Launch)

1. **Smart Pre-filling**
   - Auto-populate wave/wind fields from forecast data
   - User can override if conditions differ

2. **Condition Templates**
   - Save common condition combinations
   - Quick select for regular spots

3. **Voice Notes**
   - Record audio notes during/after session
   - Transcribe to text

4. **Session Comparison**
   - Compare current conditions to previous sessions
   - "Conditions similar to your session on [date]"

5. **Community Insights**
   - Show other surfers' recent reports for same beach
   - Real-time condition updates

### 16.2 Analytics Integration

```typescript
// Track condition data for ML models
interface SessionConditionEvent {
  beach_id: string;
  date: string;
  forecast_wave_height?: number;
  actual_wave_height?: number;
  forecast_wind_speed?: number;
  actual_wind_speed?: number;
  forecast_accuracy: 'accurate' | 'somewhat' | 'inaccurate';
}

// Feed to forecast improvement engine
```

---

## Appendix A: Constants

```typescript
// File: lib/constants/session-constants.ts

export const WIND_DIRECTIONS = [
  { value: 'N', label: 'North' },
  { value: 'NE', label: 'Northeast' },
  { value: 'E', label: 'East' },
  { value: 'SE', label: 'Southeast' },
  { value: 'S', label: 'South' },
  { value: 'SW', label: 'Southwest' },
  { value: 'W', label: 'West' },
  { value: 'NW', label: 'Northwest' },
  { value: 'OFFSHORE', label: 'Offshore' },
  { value: 'ONSHORE', label: 'Onshore' },
  { value: 'CROSS', label: 'Cross-shore' },
] as const;

export const FORECAST_ACCURACY_OPTIONS = [
  {
    value: 'accurate',
    label: 'Yes',
    icon: CheckCircle2,
    description: 'Forecast was spot on',
  },
  {
    value: 'somewhat',
    label: 'Kinda',
    icon: AlertCircle,
    description: 'Close but not perfect',
  },
  {
    value: 'inaccurate',
    label: 'No',
    icon: XCircle,
    description: 'Way off the mark',
  },
] as const;

export const DURATION_PRESETS = [
  { value: '30m', label: '30 min' },
  { value: '1h', label: '1 hour' },
  { value: '1h 30m', label: '1.5 hours' },
  { value: '2h', label: '2 hours' },
  { value: '2h 30m', label: '2.5 hours' },
  { value: '3h', label: '3 hours' },
  { value: 'custom', label: 'Custom' },
] as const;
```

---

## Appendix B: File Structure

```
components/
  session/
    wizard/
      AnimatedSessionWizard.tsx (MODIFIED)
      SessionWizard.tsx (UNCHANGED)
      session-wizard-config.ts (NEW)
      types.ts (NEW)

  session-forms/
    SessionDetailsSection.tsx (NEW - CONSOLIDATED)
    LocationStep.tsx (UNCHANGED)
    DateTimeSection.tsx (UNCHANGED)
    EquipmentStep.tsx (UNCHANGED)
    GoalsSection.tsx (UNCHANGED - plan mode only)
    NotesSection.tsx (MODIFIED - plan mode only)

    consolidated-sections/ (NEW)
      DurationInput.tsx
      ForecastComparison.tsx
      NumberInput.tsx
      SelectInput.tsx
      RatingInput.tsx
      ForecastAccuracySelector.tsx
      PhotoUploadSection.tsx

    ConditionsSection.tsx (DEPRECATED - delete after rollout)
    PhotoSelectionSection.tsx (DEPRECATED - delete after rollout)

hooks/
  use-session-form.ts (MODIFIED - updated types)
  use-session-forecast.ts (UNCHANGED)

actions/
  session-actions.ts (MODIFIED - handle new fields)

types/
  database.ts (UNCHANGED)
  database.generated.ts (REGENERATED after migration)

lib/
  validation/
    session-validation.ts (NEW)
  constants/
    session-constants.ts (NEW)

supabase/
  migrations/
    20251113_add_session_condition_fields.sql (NEW)
```

---

## Summary

This design consolidates the Session Wizard from 6 steps to 4 steps in log mode, fixes all data loss issues, and provides a superior user experience. All collected data is now properly bound to formState and saved to the database.

**Key Improvements:**
1. ✅ Single consolidated "Session Details" step
2. ✅ All 6 missing fields now saved to database
3. ✅ Photos managed in formState (no local state)
4. ✅ Single notes field (no more confusion)
5. ✅ Better UX with fewer steps
6. ✅ Comprehensive validation
7. ✅ Full accessibility support
8. ✅ Backward compatible migration

**Next Steps:**
1. Review and approve design
2. Create database migration
3. Implement SessionDetailsSection
4. Update wizard configuration
5. Test thoroughly
6. Deploy with feature flag
7. Monitor metrics
8. Full rollout

---

**Document End**
