import { useCallback } from 'react';
import { z } from 'zod';
import { INTEL_CONFIG, INTEL_UI_TEXT } from '@/lib/constants/intel';
import type { WindDirection, ForecastAccuracy } from '@/components/intel/form';

/**
 * Wind direction values for Zod schema.
 * IMPORTANT: Must stay in sync with WindDirection type in @/components/intel/form
 */
const WIND_DIRECTION_VALUES = [
  'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW',
  'OFFSHORE', 'ONSHORE', 'CROSS',
] as const;

/**
 * Forecast accuracy values for Zod schema.
 * IMPORTANT: Must stay in sync with ForecastAccuracy type in @/components/intel/form
 */
const FORECAST_ACCURACY_VALUES = ['accurate', 'somewhat', 'inaccurate'] as const;

/**
 * Zod schema for intel post form validation
 */
export const intelPostSchema = z.object({
  tag: z.enum([
    'parking',
    'hazard',
    'crowd',
    'conditions',
    'access',
    'other',
  ] as const),
  title: z
    .string()
    .min(1, INTEL_UI_TEXT.VALIDATION.TITLE_REQUIRED)
    .max(
      INTEL_CONFIG.MAX_TITLE_LENGTH,
      INTEL_UI_TEXT.VALIDATION.TITLE_TOO_LONG
    ),
  description: z
    .string()
    .min(1, INTEL_UI_TEXT.VALIDATION.DESCRIPTION_REQUIRED)
    .max(
      INTEL_CONFIG.MAX_DESCRIPTION_LENGTH,
      INTEL_UI_TEXT.VALIDATION.DESCRIPTION_TOO_LONG
    ),
  // Surf condition fields
  wave_height: z.number().min(0).max(50).nullable().optional(),
  wind_speed: z.number().min(0).max(150).nullable().optional(),
  wind_direction: z.enum(WIND_DIRECTION_VALUES).nullable().optional(),
  water_temp: z.number().min(32).max(100).nullable().optional(),
  crowd_level: z.number().min(1).max(5).nullable().optional(),
  wave_types: z.array(z.string()).optional(),
  forecast_accuracy: z.enum(FORECAST_ACCURACY_VALUES).nullable().optional(),
});

export type IntelPostFormData = z.infer<typeof intelPostSchema>;

export interface ConditionsSummaryInput {
  wave_types?: string[];
  crowd_level?: number | null;
  wind_direction?: WindDirection | string | null;
  wind_speed?: number | null;
  water_temp?: number | null;
}

export interface ValidationResult {
  isValid: boolean;
  missingFields: string[];
}

export interface UseIntelFormValidationOptions {
  variant?: 'intel' | 'check-in';
}

/**
 * Hook for intel form validation logic
 *
 * Provides:
 * - generateConditionsSummary: Auto-generates description from conditions fields
 * - validateBeforeSubmit: Manual validation with missing field tracking
 */
export function useIntelFormValidation(options: UseIntelFormValidationOptions = {}) {
  const { variant = 'intel' } = options;

  /**
   * Generate a summary description from conditions fields.
   * Uses explicit null checks for numeric fields to allow 0 as valid value.
   */
  const generateConditionsSummary = useCallback((input: ConditionsSummaryInput): string => {
    const parts: string[] = [];

    const waveTypes = input.wave_types || [];
    if (waveTypes.length > 0) {
      parts.push(`Waves: ${waveTypes.join(', ')}`);
    }

    // crowd_level uses truthy check since 0 is not a valid level (1-5 range)
    if (input.crowd_level) {
      parts.push(`Crowd: ${input.crowd_level}/5`);
    }

    if (input.wind_direction) {
      parts.push(`Wind: ${input.wind_direction}`);
    }

    // wind_speed uses explicit null check since 0 mph is valid
    if (input.wind_speed !== null && input.wind_speed !== undefined) {
      parts.push(`Wind Speed: ${input.wind_speed} mph`);
    }

    // water_temp uses explicit null check since low temps are valid
    if (input.water_temp !== null && input.water_temp !== undefined) {
      parts.push(`Water: ${input.water_temp}F`);
    }

    return parts.length > 0 ? parts.join(' - ') : 'Real-time conditions update';
  }, []);

  /**
   * Validate form data before submission.
   * Returns list of missing required fields.
   */
  const validateBeforeSubmit = useCallback((values: Partial<IntelPostFormData>): ValidationResult => {
    const missingFields: string[] = [];

    // Title validation
    if (!values.title || !values.title.trim()) {
      missingFields.push('title');
    }

    // Description validation
    if (!values.description || !values.description.trim()) {
      missingFields.push('description');
    }

    // Forecast accuracy is required for check-in variant
    if (variant === 'check-in' && !values.forecast_accuracy) {
      missingFields.push('forecast_accuracy');
    }

    return {
      isValid: missingFields.length === 0,
      missingFields,
    };
  }, [variant]);

  return {
    generateConditionsSummary,
    validateBeforeSubmit,
  };
}
