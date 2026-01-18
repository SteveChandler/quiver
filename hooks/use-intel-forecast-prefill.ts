import { useState, useEffect, useCallback, useRef } from 'react';
import { getEnhancedBeachForecasts } from '@/actions/forecast-actions';
import { getCurrentForecast } from '@/lib/utils/current-forecast-utils';
import type { WindDirection } from '@/components/intel/form';

/**
 * State tracking for individual prefillable fields
 */
export type FieldPrefillState = 'empty' | 'prefilled' | 'user-edited';

/**
 * Tracks the prefill state of each condition field
 */
export type ConditionFieldStates = {
  wave_height: FieldPrefillState;
  wind_speed: FieldPrefillState;
  wind_direction: FieldPrefillState;
  water_temp: FieldPrefillState;
};

export type ConditionFieldKey = keyof ConditionFieldStates;

/**
 * Initial field states constant - used for initialization and reset
 */
const INITIAL_FIELD_STATES: ConditionFieldStates = {
  wave_height: 'empty',
  wind_speed: 'empty',
  wind_direction: 'empty',
  water_temp: 'empty',
};

/**
 * Parse numeric values from various formats (e.g., "3.5 ft" -> 3.5)
 */
export function parseNumericValue(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value !== 'string') return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Wind direction mapping from various forecast formats to our enum values
 */
const WIND_DIRECTION_MAP: Record<string, WindDirection> = {
  N: 'N', NE: 'NE', E: 'E', SE: 'SE',
  S: 'S', SW: 'SW', W: 'W', NW: 'NW',
  North: 'N', Northeast: 'NE', East: 'E', Southeast: 'SE',
  South: 'S', Southwest: 'SW', West: 'W', Northwest: 'NW',
  Offshore: 'OFFSHORE', Onshore: 'ONSHORE', Cross: 'CROSS',
  'Cross-shore': 'CROSS',
};

/**
 * Valid wind direction values
 */
const VALID_WIND_DIRECTIONS = new Set<string>([
  'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW',
  'OFFSHORE', 'ONSHORE', 'CROSS',
]);

/**
 * Map a raw wind direction string to our WindDirection enum
 */
export function mapWindDirection(direction: string | undefined | null): WindDirection | undefined {
  if (!direction) return undefined;
  const mapped = WIND_DIRECTION_MAP[direction] || direction.toUpperCase();
  return VALID_WIND_DIRECTIONS.has(mapped) ? (mapped as WindDirection) : undefined;
}

/**
 * Fields that can be prefilled from forecast data
 */
export type PrefillableField = 'wave_height' | 'wind_speed' | 'wind_direction' | 'water_temp';

/**
 * Type for prefillable field values
 */
export type PrefillValue = number | WindDirection | null;

export interface UseIntelForecastPrefillOptions {
  /** Whether the form modal is open */
  isOpen: boolean;
  /** Beach ID to fetch forecast for */
  beachId: string | undefined;
  /** Current tag value - prefill only happens for 'conditions' tag */
  tag: string;
  /** Form setValue function for prefilling fields */
  setValue: (field: PrefillableField, value: PrefillValue) => void;
}

export interface UseIntelForecastPrefillResult {
  /** Whether forecast is currently loading */
  isLoading: boolean;
  /** Call when user edits a field to prevent overwriting */
  handleFieldEdited: (field: ConditionFieldKey) => void;
  /** Reset all field states (call when form resets) */
  resetFieldStates: () => void;
}

/**
 * Hook for auto-prefilling form fields from forecast data.
 *
 * Features:
 * - Fetches forecast when modal opens with conditions tag
 * - Prefills fields only if they haven't been user-edited
 * - Tracks field state to prevent overwriting user changes
 * - Deduplicates fetches for same beach
 */
export function useIntelForecastPrefill({
  isOpen,
  beachId,
  tag,
  setValue,
}: UseIntelForecastPrefillOptions): UseIntelForecastPrefillResult {
  const [isLoading, setIsLoading] = useState(false);

  // Track field states to know which have been user-edited
  const fieldStatesRef = useRef<ConditionFieldStates>({ ...INITIAL_FIELD_STATES });

  // Dedupe key to avoid refetching for same modal open
  const lastPrefillKeyRef = useRef<string | null>(null);

  /**
   * Mark a field as user-edited so prefill won't overwrite it
   */
  const handleFieldEdited = useCallback((field: ConditionFieldKey) => {
    fieldStatesRef.current[field] = 'user-edited';
  }, []);

  /**
   * Reset all field states to 'empty'
   */
  const resetFieldStates = useCallback(() => {
    fieldStatesRef.current = { ...INITIAL_FIELD_STATES };
    lastPrefillKeyRef.current = null;
  }, []);

  // Reset loading state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsLoading(false);
    }
  }, [isOpen]);

  // Fetch forecast and prefill when conditions are met
  useEffect(() => {
    const shouldFetch = isOpen && tag === 'conditions' && beachId;

    if (!shouldFetch) {
      return;
    }

    // Dedupe check - don't refetch for same modal open
    const prefillKey = `${beachId}-${isOpen}`;
    if (prefillKey === lastPrefillKeyRef.current) {
      return;
    }
    lastPrefillKeyRef.current = prefillKey;

    // Only reset fields that are not user-edited (preserve user edits across modal reopens)
    const currentStates = fieldStatesRef.current;
    fieldStatesRef.current = {
      wave_height: currentStates.wave_height === 'user-edited' ? 'user-edited' : 'empty',
      wind_speed: currentStates.wind_speed === 'user-edited' ? 'user-edited' : 'empty',
      wind_direction: currentStates.wind_direction === 'user-edited' ? 'user-edited' : 'empty',
      water_temp: currentStates.water_temp === 'user-edited' ? 'user-edited' : 'empty',
    };

    // Track if effect is cancelled (unmount or deps change)
    let cancelled = false;

    const fetchAndPrefill = async () => {
      setIsLoading(true);
      try {
        const result = await getEnhancedBeachForecasts(beachId, 2);

        // Check if cancelled before processing results
        if (cancelled) return;

        if (!result.success || !result.data || result.data.length === 0) {
          return;
        }

        // Select the best forecast using forward-looking time logic
        const bestForecast = getCurrentForecast(result.data);
        if (!bestForecast) {
          return;
        }

        // Parse forecast values
        const parsedWaveHeight = parseNumericValue(bestForecast.wave_height);
        const parsedWindSpeed = parseNumericValue(bestForecast.wind_speed);
        const parsedWaterTemp = parseNumericValue(bestForecast.water_temp);
        const mappedWindDirection = mapWindDirection(bestForecast.wind_direction);

        // Prefill wave height if field is empty
        if (
          fieldStatesRef.current.wave_height === 'empty' &&
          parsedWaveHeight !== undefined
        ) {
          setValue('wave_height', parsedWaveHeight);
          fieldStatesRef.current.wave_height = 'prefilled';
        }

        // Prefill wind speed if field is empty
        if (
          fieldStatesRef.current.wind_speed === 'empty' &&
          parsedWindSpeed !== undefined
        ) {
          setValue('wind_speed', parsedWindSpeed);
          fieldStatesRef.current.wind_speed = 'prefilled';
        }

        // Prefill wind direction if field is empty
        if (
          fieldStatesRef.current.wind_direction === 'empty' &&
          mappedWindDirection !== undefined
        ) {
          setValue('wind_direction', mappedWindDirection);
          fieldStatesRef.current.wind_direction = 'prefilled';
        }

        // Prefill water temp if field is empty
        if (
          fieldStatesRef.current.water_temp === 'empty' &&
          parsedWaterTemp !== undefined
        ) {
          setValue('water_temp', parsedWaterTemp);
          fieldStatesRef.current.water_temp = 'prefilled';
        }

        if (process.env.NODE_ENV === 'development') {
          console.debug('[useIntelForecastPrefill] Prefilled conditions from forecast', {
            wave_height: parsedWaveHeight,
            wind_speed: parsedWindSpeed,
            wind_direction: mappedWindDirection,
            water_temp: parsedWaterTemp,
          });
        }
      } catch (error) {
        console.error('[useIntelForecastPrefill] Failed to fetch forecast for prefill:', error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchAndPrefill();

    // Cleanup: mark as cancelled to prevent state updates after unmount
    return () => {
      cancelled = true;
    };
  }, [isOpen, beachId, tag, setValue]);

  return {
    isLoading,
    handleFieldEdited,
    resetFieldStates,
  };
}
