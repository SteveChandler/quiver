# Session Wizard URL Prefill Feature

## Overview

The Session Wizard can now be prefilled with beach and time data via URL parameters. This enables seamless "Plan Session" CTAs from Personalized Forecast, Surf Discovery, and other features.

## Implementation Details

### Architecture

```
URL Parameters
    ↓
parseSessionWizardParams() [validation]
    ↓
extractFormState() [transformation]
    ↓
SessionWizard → AnimatedSessionWizard → useSessionForm
```

### Components Modified

1. **`/app/sessions/new/page.tsx`**
   - Parses URL parameters using `parseSessionWizardParams()`
   - Validates and transforms parameters
   - Passes prefill data to SessionWizard component
   - Handles graceful degradation for invalid params

2. **`/components/session/wizard/SessionWizard.tsx`**
   - Added `initialFormState` and `targetStep` props
   - Passes props through to AnimatedSessionWizard

3. **`/components/session/wizard/AnimatedSessionWizard.tsx`**
   - Already had support for `initialFormState` and `targetStep`
   - Passes initialFormState to `useSessionForm` hook
   - Auto-jumps to target step after validation

### URL Parameter Schema

```typescript
interface SessionWizardPrefillParams {
  mode: 'plan' | 'log';           // Session mode (default: 'plan')
  beach: string;                   // Beach UUID (validated)
  beachName: string;               // Beach display name (sanitized)
  startTime: string;               // ISO 8601 timestamp
  endTime: string;                 // ISO 8601 timestamp
  step: string;                    // Target wizard step (1-4)
}
```

## Usage Examples

### Valid URL (Full Prefill)

```
/sessions/new?mode=plan&beach=abc-123-def-456&beachName=Pacific%20Beach&startTime=2025-11-22T06:00:00.000Z&endTime=2025-11-22T10:00:00.000Z&step=3
```

**Result:**
- Beach: "Pacific Beach" (ID: abc-123-def-456)
- Date: 2025-11-22
- Time: 06:00 (local time)
- Wizard jumps to step 3 (Goals)

### Minimal URL (No Prefill)

```
/sessions/new
```

**Result:**
- Empty form (default behavior)
- Starts at step 1 (Location)

### Invalid URL (Graceful Degradation)

```
/sessions/new?beach=invalid-uuid&startTime=not-a-date
```

**Result:**
- Validation fails
- Falls back to empty form
- Optionally shows toast: "Some prefill data was invalid and was ignored"
- Starts at step 1 (Location)

## Building Prefill URLs

Use the `buildSessionWizardUrl()` utility:

```typescript
import { buildSessionWizardUrl } from '@/lib/utils/session-wizard-params';

// From Personalized Forecast
const url = buildSessionWizardUrl({
  mode: 'plan',
  beachId: recommendation.beach.id,
  beachName: recommendation.beach.name,
  startTime: recommendation.window.start,
  endTime: recommendation.window.end,
  targetStep: 3, // Jump to Goals step
});

router.push(url);
```

## Validation & Security

### Input Validation

All parameters are validated using Zod schemas:

- **UUIDs**: Must be valid UUID v4 format
- **Timestamps**: Must be valid ISO 8601 format
- **Time Range**: End time must be after start time
- **Duration**: Max 12 hours between start and end
- **Step Number**: Must be 1-4 (inclusive)
- **Beach Name**: Max 200 characters, trimmed, sanitized

### Security Measures

1. **No Direct Trust**: URL parameters are never used directly
2. **Validation**: All inputs validated via Zod schemas
3. **Sanitization**: Beach name is sanitized for XSS prevention
4. **Beach ID Priority**: Beach UUID is used for DB operations (not name)
5. **Graceful Degradation**: Invalid params don't break the wizard

## Error Handling

### Validation Errors

```typescript
const result = parseSessionWizardParams(searchParams);

if (!result.success) {
  // result.error: Human-readable error message
  // result.defaults: Safe fallback values
  console.warn('Validation failed:', result.error);

  // Show non-blocking notification
  toast.warning('Some prefill data was invalid');

  // Use defaults (empty form)
  initializeWizard(result.defaults);
}
```

### Network Errors

Network errors are handled at the API level (not relevant to prefill).

## Testing

### Manual Testing

1. **Valid prefill**:
   ```
   /sessions/new?mode=plan&beach=<valid-uuid>&beachName=Test%20Beach&startTime=2025-11-23T06:00:00.000Z&endTime=2025-11-23T10:00:00.000Z&step=3
   ```
   - ✅ Form prefills with beach and time
   - ✅ Wizard jumps to step 3

2. **Invalid UUID**:
   ```
   /sessions/new?beach=invalid-uuid&beachName=Test
   ```
   - ✅ Validation fails gracefully
   - ✅ Shows empty form
   - ✅ Optionally shows toast warning

3. **No parameters**:
   ```
   /sessions/new
   ```
   - ✅ Shows empty form (default behavior)
   - ✅ Starts at step 1

4. **Invalid timestamp**:
   ```
   /sessions/new?beach=<valid-uuid>&startTime=invalid-date
   ```
   - ✅ Validation fails
   - ✅ Falls back to defaults

### Automated Testing

E2E tests should be added in `/e2e/session-wizard-prefill.spec.ts`:

```typescript
test('Session wizard prefill from URL parameters', async ({ page }) => {
  const beachId = 'test-beach-id';
  const url = `/sessions/new?mode=plan&beach=${beachId}&beachName=Test%20Beach&startTime=2025-11-23T06:00:00.000Z&endTime=2025-11-23T10:00:00.000Z&step=3`;

  await page.goto(url);

  // Verify beach is prefilled
  await expect(page.getByText('Test Beach')).toBeVisible();

  // Verify wizard jumped to step 3
  await expect(page.getByText('Goals')).toBeVisible();
});
```

## Future Enhancements

1. **Board Prefill**: Add `boardId` parameter
2. **Notes Prefill**: Add `notes` parameter
3. **Invitees Prefill**: Add `invitees` parameter (comma-separated emails)
4. **Analytics**: Track prefill usage and conversion rates

## Backwards Compatibility

✅ **100% Backwards Compatible**

- URLs without parameters work exactly as before
- Existing `mode` and `convert` parameters still work
- No breaking changes to existing functionality

## Related Files

- `/types/session-wizard.ts` - Type definitions
- `/lib/validation/schemas.ts` - Zod validation schema
- `/lib/utils/session-wizard-params.ts` - Parsing and building utilities
- `/hooks/use-session-form.ts` - Form state management
- `/components/session/wizard/AnimatedSessionWizard.tsx` - Wizard component
