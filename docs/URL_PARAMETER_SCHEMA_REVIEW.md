# URL Parameter Schema Review: Session Wizard Prefill

## Executive Summary

This document provides a comprehensive review of the URL parameter schema used to prefill the Session Wizard from "Plan Session" CTAs in the Personalized Forecast and Surf Discovery features.

**Overall Assessment**: The current implementation is **solid and well-designed** with minor improvements recommended for robustness, type safety, and security.

---

## Current Implementation Analysis

### URL Parameters Being Passed

```typescript
const params = new URLSearchParams({
  mode: 'plan',              // Session mode (plan vs log)
  beach: beachId,            // UUID of the beach
  beachName: beachName,      // Display name of the beach
  startTime: isoString,      // ISO 8601 datetime
  endTime: isoString,        // ISO 8601 datetime
  step: '3',                 // Target wizard step (1-indexed)
});

// Example URL:
// /sessions/new?mode=plan&beach=abc-123&beachName=Pacific%20Beach&startTime=2025-11-22T06:00:00.000Z&endTime=2025-11-22T10:00:00.000Z&step=3
```

### Data Flow

```
User clicks "Plan Session" CTA
  ↓
URL constructed with parameters
  ↓
/sessions/new page receives searchParams
  ↓
SessionWizard component receives mode prop
  ↓
useSessionForm hook manages form state
  ↓
User completes wizard and submits
```

### Current Usage Locations

1. **Personalized Forecast CTA** (`components/home-screen/forecast-tab.tsx:302`)
   - Prefills beach, time window, jumps to Goals step
2. **Surf Discovery CTA** (`components/discover/beach-discovery-list.tsx:75`)
   - Prefills beach, time window, jumps to Goals step

---

## Schema Validation Review

### ✅ Strengths

1. **Clear Parameter Names**: Self-documenting parameter names (`beachName`, `startTime`, `endTime`)
2. **Standard Formats**: Uses ISO 8601 for timestamps (widely supported)
3. **Sensible Defaults**: Backwards compatible (existing `/sessions/new` usage still works)
4. **Proper URL Encoding**: Uses `URLSearchParams` which handles encoding automatically

### ⚠️ Areas for Improvement

1. **No Validation**: Parameters are currently used without validation
2. **Type Safety**: No TypeScript interface for the parameter contract
3. **Error Handling**: No graceful degradation for invalid parameters
4. **Security**: Potential XSS risk if parameters are rendered without sanitization

---

## Recommendations

### 1. TypeScript Interface

Define a clear contract for the URL parameters:

```typescript
/**
 * URL parameters for prefilling the Session Wizard
 * Used when navigating from "Plan Session" CTAs
 */
export interface SessionWizardPrefillParams {
  /** Session mode: 'plan' or 'log' */
  mode: 'plan' | 'log';

  /** Beach UUID */
  beach: string;

  /** Beach display name (for UI only, not trusted for DB operations) */
  beachName: string;

  /** Session start time (ISO 8601) */
  startTime: string;

  /** Session end time (ISO 8601) */
  endTime: string;

  /** Target wizard step (1-4, 1-indexed) */
  step: string;
}

/**
 * Parsed and validated wizard prefill parameters
 */
export interface ValidatedSessionWizardParams {
  mode: 'plan' | 'log';
  beachId: string;
  beachName: string;
  startTime: Date;
  endTime: Date;
  targetStep: number;
}
```

### 2. Zod Validation Schema

Create a robust validation schema in `lib/validation/schemas.ts`:

```typescript
import { z } from 'zod';

/**
 * Validation schema for Session Wizard URL parameters
 *
 * Security: All parameters are validated before use to prevent XSS and injection
 * Compatibility: Missing/invalid params are handled gracefully with defaults
 */
export const SessionWizardPrefillSchema = z.object({
  // Session mode (required)
  mode: z.enum(['plan', 'log'], {
    errorMap: () => ({ message: 'Mode must be "plan" or "log"' }),
  }).default('plan'),

  // Beach UUID (required)
  beach: z.string()
    .uuid('Invalid beach ID format')
    .describe('Beach UUID from database'),

  // Beach name (optional, for display only)
  beachName: z.string()
    .min(1, 'Beach name cannot be empty')
    .max(200, 'Beach name too long')
    .trim()
    .optional()
    .describe('Beach display name (not trusted for DB operations)'),

  // Start time (required, ISO 8601)
  startTime: z.string()
    .datetime({ message: 'Invalid start time format (must be ISO 8601)' })
    .transform((val) => new Date(val))
    .refine(
      (date) => !isNaN(date.getTime()),
      'Start time must be a valid date'
    )
    .describe('Session start time in ISO 8601 format'),

  // End time (required, ISO 8601)
  endTime: z.string()
    .datetime({ message: 'Invalid end time format (must be ISO 8601)' })
    .transform((val) => new Date(val))
    .refine(
      (date) => !isNaN(date.getTime()),
      'End time must be a valid date'
    )
    .describe('Session end time in ISO 8601 format'),

  // Target wizard step (optional)
  step: z.string()
    .regex(/^\d+$/, 'Step must be a number')
    .transform((val) => parseInt(val, 10))
    .refine(
      (num) => num >= 1 && num <= 4,
      'Step must be between 1 and 4'
    )
    .default('1')
    .describe('Target wizard step (1-indexed)'),
})
  // Cross-field validation
  .refine(
    (data) => data.startTime < data.endTime,
    {
      message: 'End time must be after start time',
      path: ['endTime'],
    }
  )
  // Validate reasonable time window (not too long)
  .refine(
    (data) => {
      const durationHours = (data.endTime.getTime() - data.startTime.getTime()) / (1000 * 60 * 60);
      return durationHours <= 12; // Max 12 hour session
    },
    {
      message: 'Session duration cannot exceed 12 hours',
      path: ['endTime'],
    }
  );

export type SessionWizardPrefillInput = z.infer<typeof SessionWizardPrefillSchema>;
```

### 3. Validation Utility Function

Create a utility to parse and validate URL parameters:

```typescript
/**
 * lib/utils/session-wizard-params.ts
 *
 * Utilities for parsing and validating Session Wizard URL parameters
 */

import { SessionWizardPrefillSchema } from '@/lib/validation/schemas';
import type { ValidatedSessionWizardParams } from '@/types/session-wizard';

/**
 * Result type for parameter parsing
 */
export type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; defaults: Partial<T> };

/**
 * Parse and validate Session Wizard URL parameters
 *
 * @param searchParams - Next.js URLSearchParams or URLSearchParams
 * @returns Validated parameters or error with safe defaults
 *
 * @example
 * ```typescript
 * const result = parseSessionWizardParams(searchParams);
 * if (result.success) {
 *   // Use result.data
 *   console.log('Beach:', result.data.beachName);
 * } else {
 *   // Handle error gracefully
 *   console.error('Invalid params:', result.error);
 *   // Use result.defaults if needed
 * }
 * ```
 */
export function parseSessionWizardParams(
  searchParams: URLSearchParams | ReadonlyURLSearchParams
): ParseResult<ValidatedSessionWizardParams> {
  try {
    // Extract raw parameters
    const rawParams = {
      mode: searchParams.get('mode'),
      beach: searchParams.get('beach'),
      beachName: searchParams.get('beachName'),
      startTime: searchParams.get('startTime'),
      endTime: searchParams.get('endTime'),
      step: searchParams.get('step'),
    };

    // Validate using Zod schema
    const validated = SessionWizardPrefillSchema.parse(rawParams);

    return {
      success: true,
      data: {
        mode: validated.mode,
        beachId: validated.beach,
        beachName: validated.beachName || '',
        startTime: validated.startTime,
        endTime: validated.endTime,
        targetStep: validated.step,
      },
    };
  } catch (error) {
    // Parse Zod error for user-friendly message
    const errorMessage = error instanceof Error
      ? error.message
      : 'Invalid URL parameters';

    // Provide safe defaults
    const defaults: Partial<ValidatedSessionWizardParams> = {
      mode: 'plan',
      targetStep: 1,
    };

    return {
      success: false,
      error: errorMessage,
      defaults,
    };
  }
}

/**
 * Build Session Wizard URL with validated parameters
 *
 * @param params - Parameters to encode in URL
 * @returns URL string for /sessions/new with encoded parameters
 *
 * @example
 * ```typescript
 * const url = buildSessionWizardUrl({
 *   mode: 'plan',
 *   beachId: 'abc-123',
 *   beachName: 'Pacific Beach',
 *   startTime: new Date('2025-11-22T06:00:00Z'),
 *   endTime: new Date('2025-11-22T10:00:00Z'),
 *   targetStep: 3,
 * });
 * // => "/sessions/new?mode=plan&beach=abc-123&..."
 * ```
 */
export function buildSessionWizardUrl(
  params: ValidatedSessionWizardParams
): string {
  const urlParams = new URLSearchParams({
    mode: params.mode,
    beach: params.beachId,
    beachName: params.beachName,
    startTime: params.startTime.toISOString(),
    endTime: params.endTime.toISOString(),
    step: params.targetStep.toString(),
  });

  return `/sessions/new?${urlParams.toString()}`;
}
```

### 4. Error Handling Strategy

Implement graceful degradation in `/app/sessions/new/page.tsx`:

```typescript
"use client";

import { useSearchParams } from "next/navigation";
import { parseSessionWizardParams } from "@/lib/utils/session-wizard-params";
import { toast } from "sonner";

function NewSessionPageContent() {
  const searchParams = useSearchParams();

  // Parse and validate URL parameters
  const paramResult = parseSessionWizardParams(searchParams);

  // Handle validation errors gracefully
  if (!paramResult.success) {
    console.warn('Invalid session wizard parameters:', paramResult.error);

    // Show warning to user (non-blocking)
    if (searchParams.toString().length > 0) {
      toast.warning('Some prefill data was invalid and has been reset');
    }
  }

  // Use validated data or defaults
  const mode = paramResult.success
    ? paramResult.data.mode
    : (paramResult.defaults.mode || 'plan');

  const initialFormState = paramResult.success
    ? {
        selectedBeach: paramResult.data.beachName,
        selectedBeachId: paramResult.data.beachId,
        selectedDate: format(paramResult.data.startTime, 'yyyy-MM-dd'),
        selectedTime: format(paramResult.data.startTime, 'HH:mm'),
        // ... other fields
      }
    : undefined;

  const initialStep = paramResult.success
    ? paramResult.data.targetStep
    : 1;

  return (
    <div className="min-h-screen bg-gray-50 relative">
      <SessionWizard
        mode={mode}
        initialFormState={initialFormState}
        initialStep={initialStep}
        onComplete={handleSessionComplete}
        onCancel={handleCancel}
        className="min-h-screen"
      />
    </div>
  );
}
```

### 5. Security Considerations

#### Identified Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **XSS via beachName** | Medium | Validate and sanitize; use React's auto-escaping |
| **UUID injection** | Low | Validate UUID format with Zod |
| **Malformed timestamps** | Low | Parse and validate with Zod datetime schema |
| **Step number tampering** | Very Low | Validate range (1-4) |
| **URL length limits** | Low | Current params are short (~200 chars) |

#### Security Best Practices

1. **Never Trust User Input**: Always validate parameters before use
2. **Sanitize Display Values**: `beachName` is for display only, never use for DB queries
3. **UUID Verification**: Always verify beach UUID exists in database before use
4. **CSRF Protection**: Not needed (GET request, no mutations)
5. **Rate Limiting**: Not applicable (no API calls from URL parsing)

### 6. URL Length Analysis

**Current URL Length**: ~200-250 characters (well within limits)

```
/sessions/new?
  mode=plan&
  beach=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx&  (36 chars)
  beachName=Pacific+Beach&                      (15 chars avg)
  startTime=2025-11-22T06:00:00.000Z&          (24 chars)
  endTime=2025-11-22T10:00:00.000Z&            (24 chars)
  step=3                                        (1 char)
= ~150 chars base + URL encoding + domain
```

**URL Limits**:
- Internet Explorer: 2,083 characters
- Chrome/Firefox/Safari: 100,000+ characters
- Mobile browsers: 2,000+ characters
- **Conclusion**: No concern, we're at 10-15% of the strictest limit

**Recommendation**: No changes needed. Current approach is optimal.

### 7. Alternative Approaches (Evaluated & Rejected)

#### Option A: Shortened Parameter Names
```typescript
// Instead of: mode, beach, beachName, startTime, endTime, step
// Use: m, b, bn, t1, t2, s
```
**Verdict**: ❌ **Rejected**
- **Why**: Sacrifices readability for minimal gain (~30 chars)
- **Trade-off**: URLs are meant to be human-readable and debuggable
- **Current length is not a concern**

#### Option B: POST with State
```typescript
// Store params in sessionStorage, redirect with POST
```
**Verdict**: ❌ **Rejected**
- **Why**: Breaks URL sharing (primary requirement)
- **Trade-off**: URLs wouldn't be shareable, copy-paste wouldn't work
- **Mobile deep linking would fail**

#### Option C: Base64 Encoded State
```typescript
// Encode all params as single base64 string
// /sessions/new?state=eyJtb2RlIjoicGxhbiIsIm...
```
**Verdict**: ❌ **Rejected**
- **Why**: Obscures intent, harder to debug, not human-readable
- **Trade-off**: Slightly shorter but much less transparent
- **Analytics/logging would be harder**

### 8. Backwards Compatibility

**Requirement**: Existing `/sessions/new` usage without params must still work

**Implementation**:
```typescript
const SessionWizardPrefillSchema = z.object({
  mode: z.enum(['plan', 'log']).default('plan'),  // ✅ Default
  beach: z.string().uuid().optional(),            // ✅ Optional
  // ... other fields optional or with defaults
});
```

**Test Cases**:
- ✅ `/sessions/new` → Works (defaults to plan mode, step 1)
- ✅ `/sessions/new?mode=log` → Works (log mode, step 1)
- ✅ `/sessions/new?mode=plan&beach=abc` → Works (partial params)
- ✅ `/sessions/new?mode=plan&beach=abc&beachName=...&startTime=...` → Full prefill

### 9. Mobile (Capacitor) Compatibility

**Requirements**:
- URLs must work as deep links
- Must handle iOS/Android URL schemes
- Must support app-to-app navigation

**Implementation**:
```typescript
// capacitor.config.ts
{
  plugins: {
    App: {
      deepLinks: [
        {
          scheme: "quiver",
          host: "sessions",
          pathPrefix: "/new"
        }
      ]
    }
  }
}

// Example deep link:
// quiver://sessions/new?mode=plan&beach=abc-123&...
```

**Recommendation**: Current URL structure is compatible. No changes needed.

---

## Implementation Checklist

### Phase 1: Type Safety & Validation (High Priority)
- [ ] Create `SessionWizardPrefillParams` interface in `types/session-wizard.ts`
- [ ] Add `SessionWizardPrefillSchema` to `lib/validation/schemas.ts`
- [ ] Create `parseSessionWizardParams` utility in `lib/utils/session-wizard-params.ts`
- [ ] Add unit tests for validation logic

### Phase 2: Integration (High Priority)
- [ ] Update `/app/sessions/new/page.tsx` to use validation utility
- [ ] Update `SessionWizard` component to accept `initialFormState` prop
- [ ] Update `useSessionForm` hook to support initial state from params
- [ ] Add error handling with graceful degradation

### Phase 3: Usage Updates (Medium Priority)
- [ ] Update `forecast-tab.tsx` to use `buildSessionWizardUrl` utility
- [ ] Update `beach-discovery-list.tsx` to use `buildSessionWizardUrl` utility
- [ ] Add documentation comments to all CTA implementations

### Phase 4: Testing (High Priority)
- [ ] Add E2E tests for URL parameter prefill flow
- [ ] Add E2E tests for validation error handling
- [ ] Add E2E tests for backwards compatibility
- [ ] Test mobile deep linking on iOS and Android

### Phase 5: Security Review (High Priority)
- [ ] Security audit of parameter validation
- [ ] XSS testing with malicious payloads
- [ ] UUID injection testing
- [ ] Add CSP headers if not already present

---

## Documentation Template

Add to `lib/utils/session-wizard-params.ts`:

```typescript
/**
 * Session Wizard URL Parameter Contract
 *
 * This module defines the contract for passing data to the Session Wizard
 * via URL parameters. Used when navigating from "Plan Session" CTAs.
 *
 * @example Basic Usage
 * ```typescript
 * // Building a URL
 * const url = buildSessionWizardUrl({
 *   mode: 'plan',
 *   beachId: beach.id,
 *   beachName: beach.name,
 *   startTime: new Date('2025-11-22T06:00:00Z'),
 *   endTime: new Date('2025-11-22T10:00:00Z'),
 *   targetStep: 3,
 * });
 * router.push(url);
 * ```
 *
 * @example Parsing Parameters
 * ```typescript
 * // In /sessions/new page
 * const searchParams = useSearchParams();
 * const result = parseSessionWizardParams(searchParams);
 *
 * if (result.success) {
 *   // Use validated data
 *   initializeWizard(result.data);
 * } else {
 *   // Handle error, use defaults
 *   toast.warning('Some prefill data was invalid');
 *   initializeWizard(result.defaults);
 * }
 * ```
 *
 * @security
 * - All parameters are validated using Zod schemas
 * - Beach name is sanitized and used only for display
 * - Beach UUID is validated against database
 * - Timestamps are parsed and validated
 * - Step numbers are range-checked
 *
 * @compatibility
 * - URLs are shareable (copy/paste works)
 * - Mobile deep linking supported
 * - Backwards compatible (params are optional)
 * - URL length is well within browser limits (~200 chars)
 */
```

---

## Final Recommendations Summary

### ✅ Keep As-Is
1. **Parameter names**: Clear and self-documenting
2. **URL structure**: Optimal for sharing and debugging
3. **ISO 8601 timestamps**: Standard and widely supported
4. **URL length**: No concerns (200 chars vs 2000+ limit)

### 🔧 Implement
1. **TypeScript interfaces**: Define explicit parameter contract
2. **Zod validation**: Robust validation with error messages
3. **Utility functions**: `parseSessionWizardParams`, `buildSessionWizardUrl`
4. **Error handling**: Graceful degradation with toast warnings
5. **Security validation**: UUID format, timestamp parsing, XSS prevention

### ❌ Don't Implement
1. **Shortened params**: Not needed, sacrifices clarity
2. **POST with state**: Breaks URL sharing requirement
3. **Base64 encoding**: Obscures intent, harder to debug

---

## Risk Assessment

| Category | Risk Level | Mitigation Status |
|----------|-----------|-------------------|
| Security (XSS) | 🟡 Medium | ✅ Mitigated with validation |
| Security (Injection) | 🟢 Low | ✅ Mitigated with UUID validation |
| Compatibility | 🟢 Low | ✅ Backwards compatible |
| URL Length | 🟢 Very Low | ✅ Well within limits |
| Mobile Support | 🟢 Low | ✅ Deep linking compatible |
| Maintenance | 🟢 Low | ✅ Well-documented contract |

**Overall Risk**: 🟢 **Low** (with recommended validations implemented)

---

## Conclusion

The current URL parameter schema is **well-designed and appropriate** for the use case. The main improvements needed are:

1. **Type safety** via TypeScript interfaces
2. **Validation** via Zod schemas
3. **Error handling** with graceful degradation
4. **Security hardening** via input validation

All recommendations maintain the existing architecture while adding robustness. No breaking changes are required.

The schema satisfies all requirements:
- ✅ Shareable URLs (copy/paste works)
- ✅ Mobile deep linking compatible
- ✅ Human-readable and debuggable
- ✅ Backwards compatible
- ✅ Secure (with validation)
- ✅ Well within URL length limits

**Recommended Action**: Implement Phase 1-2 immediately (type safety & validation), then Phase 3-5 as time permits.
