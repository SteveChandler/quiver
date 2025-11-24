# Session Wizard Prefill Usage Examples

This document demonstrates how to use the new prefill and auto-jump features in the `AnimatedSessionWizard` and `SessionWizard` components.

## Overview

The session wizard now supports:
1. **Prefilling form data** via `initialFormState`
2. **Auto-jumping to a specific step** via `targetStep`
3. **Step validation** to ensure required fields are present before jumping

## Basic Usage

### 1. Normal Flow (No Prefill)

```tsx
import { SessionWizard } from '@/components/session/wizard/SessionWizard';

function MyComponent() {
  return (
    <SessionWizard
      mode="plan"
      onComplete={handleComplete}
    />
  );
}
```

**Behavior**: Wizard starts at step 1 (Location), user navigates manually.

---

### 2. Prefill Without Auto-Jump

```tsx
import { SessionWizard } from '@/components/session/wizard/SessionWizard';

function MyComponent() {
  return (
    <SessionWizard
      mode="plan"
      initialFormState={{
        selectedBeachId: 'beach-abc-123',
        selectedBeach: 'Pacific Beach',
        selectedDate: '2025-11-22',
        selectedTime: '06:00',
      }}
      onComplete={handleComplete}
    />
  );
}
```

**Behavior**:
- Wizard starts at step 1 (Location)
- Form fields are pre-populated with provided data
- User can review/edit and navigate manually

---

### 3. Prefill WITH Auto-Jump (Plan Session Use Case)

```tsx
import { SessionWizard } from '@/components/session/wizard/SessionWizard';

function PlanSessionButton({ beach, optimalTime }) {
  const handlePlanSession = () => {
    // Open wizard with prefilled data and jump to Goals step
    return (
      <SessionWizard
        mode="plan"
        initialFormState={{
          selectedBeachId: beach.id,
          selectedBeach: beach.name,
          selectedDate: optimalTime.date,
          selectedTime: optimalTime.time,
          // Optional: Include other prefill data
          notes: 'Planned based on optimal forecast',
        }}
        targetStep={3} // Jump to Goals step (1-indexed)
        onComplete={handleComplete}
      />
    );
  };

  return (
    <button onClick={handlePlanSession}>
      Plan Session at {beach.name}
    </button>
  );
}
```

**Behavior**:
1. Wizard validates required fields (beach, date, time)
2. If validation passes, jumps directly to step 3 (Goals)
3. User can add goals, notes, and invites
4. User can navigate back to review/edit location and time if needed

---

## Step Numbers Reference

When using `targetStep`, use these 1-indexed values:

### Plan Mode Steps
1. Location (required)
2. Date/Time (required)
3. Goals (optional)
4. Notes & Invites (optional)

### Log Mode Steps (Consolidated)
1. Location (required)
2. Date/Time (required)
3. Equipment (optional)
4. Session Details (optional - includes conditions, photos, notes)

---

## Validation Rules

The wizard validates required fields before auto-jumping:

### Jumping to Step 2 (Date/Time)
✅ **Required**: `selectedBeachId` must be present

### Jumping to Step 3 (Goals/Equipment)
✅ **Required**:
- `selectedBeachId` must be present
- `selectedDate` must be present
- `selectedTime` must be present (only for **plan mode**)

### Jumping to Step 4 (Notes/Session Details)
✅ **Required**: Same as Step 3

---

## Edge Cases

### Invalid Target Step
```tsx
<SessionWizard
  mode="plan"
  targetStep={10} // Invalid - only 4 steps exist
  initialFormState={{ ... }}
/>
```
**Behavior**: Warning logged, wizard starts at step 1

---

### Missing Required Fields
```tsx
<SessionWizard
  mode="plan"
  targetStep={3} // Try to jump to Goals
  initialFormState={{
    selectedBeach: 'Pacific Beach',
    // Missing: selectedBeachId, selectedDate, selectedTime
  }}
/>
```
**Behavior**:
- Validation fails
- Warning logged to console
- Wizard starts at step 1
- Partial prefill data is still applied

---

### Log Mode (Time Optional)
```tsx
<SessionWizard
  mode="log"
  targetStep={3}
  initialFormState={{
    selectedBeachId: 'beach-123',
    selectedBeach: 'Malibu',
    selectedDate: '2025-11-22',
    // Time is optional for log mode
  }}
/>
```
**Behavior**:
- Validation passes (time not required for log mode)
- Wizard jumps to step 3 (Equipment)

---

## Real-World Example: Session Planner Integration

```tsx
import { SessionWizard } from '@/components/session/wizard/SessionWizard';
import { useState } from 'react';

function SessionPlannerCard({ beach, forecast }) {
  const [showWizard, setShowWizard] = useState(false);

  // Get optimal time from forecast
  const optimalTime = forecast.optimalTimes[0]; // Best time

  const handlePlanSession = () => {
    setShowWizard(true);
  };

  const handleComplete = async (sessionData) => {
    console.log('Session created:', sessionData);
    setShowWizard(false);
    // Redirect or show success message
  };

  if (showWizard) {
    return (
      <SessionWizard
        mode="plan"
        initialFormState={{
          selectedBeachId: beach.id,
          selectedBeach: beach.name,
          selectedDate: optimalTime.date,
          selectedTime: optimalTime.time,
          optimalTimes: forecast.optimalTimes,
          selectedOptimalTime: optimalTime.time,
          boardSuggestions: forecast.boardSuggestions,
        }}
        targetStep={3} // Jump to Goals
        onComplete={handleComplete}
        onCancel={() => setShowWizard(false)}
      />
    );
  }

  return (
    <div className="card">
      <h3>{beach.name}</h3>
      <p>Best time: {optimalTime.time}</p>
      <p>Conditions: {optimalTime.conditions.waveHeight}ft</p>
      <button onClick={handlePlanSession}>
        Plan Session
      </button>
    </div>
  );
}
```

---

## Type Safety

The `initialFormState` parameter is fully type-safe:

```tsx
import type { SessionFormState } from '@/hooks/use-session-form';

// TypeScript will validate these fields
const prefillData: Partial<SessionFormState> = {
  selectedBeachId: 'beach-123',     // ✅ Valid
  selectedBeach: 'Malibu',          // ✅ Valid
  selectedDate: '2025-11-22',       // ✅ Valid
  selectedTime: '06:00',            // ✅ Valid
  invalidField: 'test',             // ❌ Type error
};

<SessionWizard
  mode="plan"
  initialFormState={prefillData}
  targetStep={3}
/>
```

---

## Testing Scenarios

### Test 1: Normal Flow
```tsx
<SessionWizard mode="plan" />
```
Expected: Starts at step 1, no prefill

### Test 2: Prefill Only
```tsx
<SessionWizard
  mode="plan"
  initialFormState={{ selectedBeachId: 'beach-123', selectedBeach: 'Malibu' }}
/>
```
Expected: Starts at step 1 with beach prefilled

### Test 3: Valid Jump
```tsx
<SessionWizard
  mode="plan"
  initialFormState={{
    selectedBeachId: 'beach-123',
    selectedBeach: 'Malibu',
    selectedDate: '2025-11-22',
    selectedTime: '06:00',
  }}
  targetStep={3}
/>
```
Expected: Jumps to step 3 (Goals)

### Test 4: Invalid Jump (Missing Data)
```tsx
<SessionWizard
  mode="plan"
  initialFormState={{ selectedBeach: 'Malibu' }} // Missing ID, date, time
  targetStep={3}
/>
```
Expected: Starts at step 1, validation failed

### Test 5: User Navigation After Jump
After auto-jump to step 3, user should be able to:
- Click Previous to go back to step 2
- Click Previous again to go to step 1
- Edit any field
- Navigate forward again

---

## Implementation Notes

1. **Single Jump**: Auto-jump happens only once after initial render
2. **Validation**: Required fields are validated before jumping
3. **Backwards Compatible**: Works without new props
4. **Focus Management**: Focus is properly managed after auto-jump
5. **User Control**: Users can navigate freely after auto-jump

---

## Common Pitfalls

❌ **Don't**: Assume auto-jump always succeeds
```tsx
// This might not jump if validation fails
<SessionWizard targetStep={3} />
```

✅ **Do**: Provide required fields
```tsx
<SessionWizard
  targetStep={3}
  initialFormState={{
    selectedBeachId: 'beach-123',
    selectedBeach: 'Malibu',
    selectedDate: '2025-11-22',
    selectedTime: '06:00',
  }}
/>
```

---

❌ **Don't**: Use 0-indexed step numbers
```tsx
<SessionWizard targetStep={2} /> // This is step 3 in the UI!
```

✅ **Do**: Use 1-indexed step numbers
```tsx
<SessionWizard targetStep={3} /> // Goals step
```

---

## Debugging

Enable console logging to see validation details:

```tsx
// The wizard logs:
// - "Auto-jumping to step X (index Y)" on successful jump
// - "Cannot jump to step X - missing [field]" on validation failure
// - "Invalid targetStep: X" if step number is out of range
```

Check the browser console when testing auto-jump functionality.
