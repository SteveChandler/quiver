import type { ReadonlyURLSearchParams } from "next/navigation";

/**
 * Session Wizard URL Parameter Utilities
 *
 * This module provides utilities for building and parsing Session Wizard URLs
 * with type-safe validation and error handling.
 *
 * @module lib/utils/session-wizard-params
 *
 * @example Building a URL
 * ```typescript
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
 * @example Parsing URL parameters
 * ```typescript
 * const searchParams = useSearchParams();
 * const result = parseSessionWizardParams(searchParams);
 *
 * if (result.success) {
 *   // Use validated data
 *   const { beachId, beachName, startTime, endTime } = result.data;
 *   initializeWizard(result.data);
 * } else {
 *   // Handle error gracefully
 *   console.error('Invalid params:', result.error);
 *   toast.warning('Some prefill data was invalid');
 *   // Use defaults
 *   initializeWizard(result.defaults);
 * }
 * ```
 */

import { SessionWizardPrefillSchema } from '@/lib/validation/schemas';
import type { ValidatedSessionWizardParams } from '@/types/session-wizard';

/**
 * Result type for parameter parsing
 * Either success with validated data, or error with safe defaults
 */
export type ParseResult<T> =
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: string; defaults: Partial<T> };

/**
 * Parse and validate Session Wizard URL parameters
 *
 * This function safely parses URL parameters and validates them using Zod.
 * If validation fails, it returns safe defaults instead of throwing.
 *
 * @param searchParams - Next.js URLSearchParams or standard URLSearchParams
 * @returns Validated parameters or error with safe defaults
 *
 * @security
 * - All parameters are validated using Zod schemas
 * - Beach name is sanitized and used only for display
 * - UUIDs are validated before use
 * - Timestamps are parsed and validated
 * - Step numbers are range-checked (1-4)
 *
 * @example
 * ```typescript
 * const result = parseSessionWizardParams(searchParams);
 * if (result.success) {
 *   console.log('Beach:', result.data.beachName);
 *   console.log('Time:', result.data.startTime);
 * } else {
 *   console.error('Error:', result.error);
 *   // result.defaults contains safe fallback values
 * }
 * ```
 */
export function parseSessionWizardParams(
  searchParams: URLSearchParams | ReadonlyURLSearchParams
): ParseResult<ValidatedSessionWizardParams> {
  try {
    // Extract raw parameters from URL
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

    // Only return success if we have all required data for a proper prefill
    // If beach/startTime/endTime are missing, treat as "no prefill" (not an error)
    const hasMinimalPrefillData = validated.beach && validated.startTime && validated.endTime;

    if (!hasMinimalPrefillData) {
      // Not an error - just means user is accessing /sessions/new directly
      // Return defaults without logging as error
      const defaults: Partial<ValidatedSessionWizardParams> = {
        mode: validated.mode,
        targetStep: validated.step,
        beachId: '',
        beachName: '',
      };

      return {
        success: false,
        data: null,
        error: 'No prefill parameters provided',
        defaults,
      };
    }

    // Transform to validated output format
    // Note: hasMinimalPrefillData check above guarantees these fields exist
    const data: ValidatedSessionWizardParams = {
      mode: validated.mode,
      beachId: validated.beach!,
      beachName: validated.beachName || '',
      startTime: new Date(validated.startTime!),
      endTime: new Date(validated.endTime!),
      targetStep: validated.step,
    };

    return {
      success: true,
      data,
      error: null,
    };
  } catch (error) {
    // Parse Zod error for user-friendly message
    let errorMessage = 'Invalid URL parameters';

    if (error instanceof Error) {
      errorMessage = error.message;
    }

    // Log error for debugging (development only)
    if (process.env.NODE_ENV === 'development') {
      console.warn('Session wizard parameter validation failed:', error);
    }

    // Provide safe defaults for graceful degradation
    const defaults: Partial<ValidatedSessionWizardParams> = {
      mode: 'plan',
      targetStep: 1,
      beachId: '',
      beachName: '',
    };

    return {
      success: false,
      data: null,
      error: errorMessage,
      defaults,
    };
  }
}

/**
 * Build a Session Wizard URL with validated parameters
 *
 * Creates a properly formatted URL for the Session Wizard with all parameters
 * encoded correctly. This is the recommended way to create wizard URLs.
 *
 * @param params - Validated parameters to encode in URL
 * @returns URL string for /sessions/new with encoded parameters
 *
 * @example
 * ```typescript
 * // From Personalized Forecast
 * const url = buildSessionWizardUrl({
 *   mode: 'plan',
 *   beachId: recommendation.beach.id,
 *   beachName: recommendation.beach.name,
 *   startTime: recommendation.window.start,
 *   endTime: recommendation.window.end,
 *   targetStep: 3, // Jump to Goals step
 * });
 * router.push(url);
 * ```
 *
 * @example
 * ```typescript
 * // From Surf Discovery
 * const url = buildSessionWizardUrl({
 *   mode: 'plan',
 *   beachId: discovery.beach.id,
 *   beachName: discovery.beach.name,
 *   startTime: discovery.window.start,
 *   endTime: discovery.window.end,
 *   targetStep: 3,
 * });
 * router.push(url);
 * ```
 */
export function buildSessionWizardUrl(
  params: ValidatedSessionWizardParams
): string {
  // Build URL parameters (URLSearchParams handles encoding)
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

/**
 * Type guard to check if URL parameters are present
 *
 * @param searchParams - URLSearchParams to check
 * @returns true if wizard prefill parameters are present
 *
 * @example
 * ```typescript
 * if (hasWizardParams(searchParams)) {
 *   // Parse and use the parameters
 *   const result = parseSessionWizardParams(searchParams);
 * } else {
 *   // Initialize wizard with defaults
 *   initializeWizardDefaults();
 * }
 * ```
 */
export function hasWizardParams(
  searchParams: URLSearchParams | ReadonlyURLSearchParams
): boolean {
  // Check for at least one required parameter (beach or mode)
  return (
    searchParams.has('beach') ||
    searchParams.has('mode') ||
    searchParams.has('startTime')
  );
}

/**
 * Extract prefill data from validated parameters
 *
 * Converts validated URL parameters to form state format for useSessionForm
 *
 * @param params - Validated wizard parameters
 * @returns Form state object for useSessionForm
 *
 * @example
 * ```typescript
 * const result = parseSessionWizardParams(searchParams);
 * if (result.success) {
 *   const formState = extractFormState(result.data);
 *   // Pass to useSessionForm or SessionWizard
 * }
 * ```
 */
export function extractFormState(params: ValidatedSessionWizardParams) {
  return {
    selectedBeach: params.beachName,
    selectedBeachId: params.beachId,
    selectedDate: params.startTime.toISOString().split('T')[0], // YYYY-MM-DD
    selectedTime: params.startTime.toTimeString().slice(0, 5), // HH:MM
  };
}
