import { useMemo } from 'react';
import { z } from 'zod';
import { INTEL_CONFIG, INTEL_UI_TEXT } from '@/lib/constants/intel';
import type { WindDirection, ForecastAccuracy } from '@/components/intel/form';

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
  wind_direction: z
    .enum([
      'N',
      'NE',
      'E',
      'SE',
      'S',
      'SW',
      'W',
      'NW',
      'OFFSHORE',
      'ONSHORE',
      'CROSS',
    ])
    .nullable()
    .optional(),
  water_temp: z.number().min(32).max(100).nullable().optional(),
  crowd_level: z.number().min(1).max(5).nullable().optional(),
  wave_types: z.array(z.string()).optional(),
  forecast_accuracy: z
    .enum(['accurate', 'somewhat', 'inaccurate'])
    .nullable()
    .optional(),
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
   * Generate a summary description from conditions fields
   */
  const generateConditionsSummary = useMemo(() => {
    return (input: ConditionsSummaryInput): string => {
      const parts: string[] = [];

      const waveTypes = input.wave_types || [];
      if (waveTypes.length > 0) {
        parts.push(`Waves: ${waveTypes.join(', ')}`);
      }

      if (input.crowd_level) {
        parts.push(`Crowd: ${input.crowd_level}/5`);
      }

      if (input.wind_direction) {
        parts.push(`Wind: ${input.wind_direction}`);
      }

      if (input.wind_speed !== null && input.wind_speed !== undefined) {
        parts.push(`Wind Speed: ${input.wind_speed} mph`);
      }

      if (input.water_temp !== null && input.water_temp !== undefined) {
        parts.push(`Water: ${input.water_temp}F`);
      }

      return parts.length > 0 ? parts.join(' - ') : 'Real-time conditions update';
    };
  }, []);

  /**
   * Validate form data before submission
   */
  const validateBeforeSubmit = useMemo(() => {
    return (values: Partial<IntelPostFormData>): ValidationResult => {
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
    };
  }, [variant]);

  return {
    generateConditionsSummary,
    validateBeforeSubmit,
  };
}
