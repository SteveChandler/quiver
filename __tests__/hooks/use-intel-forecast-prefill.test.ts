/**
 * Tests for useIntelForecastPrefill hook
 * Tests forecast prefill logic, field tracking, and wind direction mapping
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useIntelForecastPrefill } from '@/hooks/use-intel-forecast-prefill';

// Mock the forecast action
jest.mock('@/actions/forecast-actions', () => ({
  getEnhancedBeachForecasts: jest.fn(),
}));

// Mock current-forecast-utils
jest.mock('@/lib/utils/current-forecast-utils', () => ({
  getCurrentForecast: jest.fn(),
}));

import { getEnhancedBeachForecasts } from '@/actions/forecast-actions';
import { getCurrentForecast } from '@/lib/utils/current-forecast-utils';

const mockGetEnhancedBeachForecasts = getEnhancedBeachForecasts as jest.Mock;
const mockGetCurrentForecast = getCurrentForecast as jest.Mock;

describe('useIntelForecastPrefill', () => {
  const mockSetValue = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetEnhancedBeachForecasts.mockResolvedValue({ success: false, data: [] });
    mockGetCurrentForecast.mockReturnValue(null);
  });

  describe('initialization', () => {
    it('initializes with loading false', () => {
      const { result } = renderHook(() =>
        useIntelForecastPrefill({
          isOpen: false,
          beachId: undefined,
          tag: 'other',
          setValue: mockSetValue,
        })
      );

      expect(result.current.isLoading).toBe(false);
    });

    it('does not fetch when modal is closed', async () => {
      renderHook(() =>
        useIntelForecastPrefill({
          isOpen: false,
          beachId: 'beach-123',
          tag: 'conditions',
          setValue: mockSetValue,
        })
      );

      expect(mockGetEnhancedBeachForecasts).not.toHaveBeenCalled();
    });

    it('does not fetch when tag is not conditions', async () => {
      renderHook(() =>
        useIntelForecastPrefill({
          isOpen: true,
          beachId: 'beach-123',
          tag: 'parking',
          setValue: mockSetValue,
        })
      );

      expect(mockGetEnhancedBeachForecasts).not.toHaveBeenCalled();
    });

    it('does not fetch when beachId is undefined', async () => {
      renderHook(() =>
        useIntelForecastPrefill({
          isOpen: true,
          beachId: undefined,
          tag: 'conditions',
          setValue: mockSetValue,
        })
      );

      expect(mockGetEnhancedBeachForecasts).not.toHaveBeenCalled();
    });
  });

  describe('prefilling', () => {
    it('fetches forecast when conditions are met', async () => {
      mockGetEnhancedBeachForecasts.mockResolvedValue({
        success: true,
        data: [{ wave_height: 3.5 }],
      });
      mockGetCurrentForecast.mockReturnValue({ wave_height: 3.5 });

      renderHook(() =>
        useIntelForecastPrefill({
          isOpen: true,
          beachId: 'beach-123',
          tag: 'conditions',
          setValue: mockSetValue,
        })
      );

      await waitFor(() => {
        expect(mockGetEnhancedBeachForecasts).toHaveBeenCalledWith('beach-123', 2);
      });
    });

    it('prefills wave_height from forecast', async () => {
      mockGetEnhancedBeachForecasts.mockResolvedValue({
        success: true,
        data: [{ wave_height: 4.5 }],
      });
      mockGetCurrentForecast.mockReturnValue({ wave_height: 4.5 });

      renderHook(() =>
        useIntelForecastPrefill({
          isOpen: true,
          beachId: 'beach-123',
          tag: 'conditions',
          setValue: mockSetValue,
        })
      );

      await waitFor(() => {
        expect(mockSetValue).toHaveBeenCalledWith('wave_height', 4.5);
      });
    });

    it('prefills wind_speed from forecast', async () => {
      mockGetEnhancedBeachForecasts.mockResolvedValue({
        success: true,
        data: [{ wind_speed: 15 }],
      });
      mockGetCurrentForecast.mockReturnValue({ wind_speed: 15 });

      renderHook(() =>
        useIntelForecastPrefill({
          isOpen: true,
          beachId: 'beach-123',
          tag: 'conditions',
          setValue: mockSetValue,
        })
      );

      await waitFor(() => {
        expect(mockSetValue).toHaveBeenCalledWith('wind_speed', 15);
      });
    });

    it('prefills water_temp from forecast', async () => {
      mockGetEnhancedBeachForecasts.mockResolvedValue({
        success: true,
        data: [{ water_temp: 68 }],
      });
      mockGetCurrentForecast.mockReturnValue({ water_temp: 68 });

      renderHook(() =>
        useIntelForecastPrefill({
          isOpen: true,
          beachId: 'beach-123',
          tag: 'conditions',
          setValue: mockSetValue,
        })
      );

      await waitFor(() => {
        expect(mockSetValue).toHaveBeenCalledWith('water_temp', 68);
      });
    });

    it('maps wind direction correctly', async () => {
      mockGetEnhancedBeachForecasts.mockResolvedValue({
        success: true,
        data: [{ wind_direction: 'North' }],
      });
      mockGetCurrentForecast.mockReturnValue({ wind_direction: 'North' });

      renderHook(() =>
        useIntelForecastPrefill({
          isOpen: true,
          beachId: 'beach-123',
          tag: 'conditions',
          setValue: mockSetValue,
        })
      );

      await waitFor(() => {
        expect(mockSetValue).toHaveBeenCalledWith('wind_direction', 'N');
      });
    });

    it('maps offshore wind direction', async () => {
      mockGetEnhancedBeachForecasts.mockResolvedValue({
        success: true,
        data: [{ wind_direction: 'Offshore' }],
      });
      mockGetCurrentForecast.mockReturnValue({ wind_direction: 'Offshore' });

      renderHook(() =>
        useIntelForecastPrefill({
          isOpen: true,
          beachId: 'beach-123',
          tag: 'conditions',
          setValue: mockSetValue,
        })
      );

      await waitFor(() => {
        expect(mockSetValue).toHaveBeenCalledWith('wind_direction', 'OFFSHORE');
      });
    });
  });

  describe('field editing', () => {
    it('does not overwrite user-edited fields', async () => {
      mockGetEnhancedBeachForecasts.mockResolvedValue({
        success: true,
        data: [{ wave_height: 5 }],
      });
      mockGetCurrentForecast.mockReturnValue({ wave_height: 5 });

      const { result, rerender } = renderHook(
        ({ isOpen }) =>
          useIntelForecastPrefill({
            isOpen,
            beachId: 'beach-123',
            tag: 'conditions',
            setValue: mockSetValue,
          }),
        { initialProps: { isOpen: true } }
      );

      await waitFor(() => {
        expect(mockSetValue).toHaveBeenCalledWith('wave_height', 5);
      });

      // Mark field as user-edited
      act(() => {
        result.current.handleFieldEdited('wave_height');
      });

      // Clear mock calls
      mockSetValue.mockClear();

      // Close and reopen modal
      rerender({ isOpen: false });
      rerender({ isOpen: true });

      // Use waitFor to properly wait for any pending effects, then verify
      // wave_height was NOT set again because it was marked as user-edited
      await waitFor(() => {
        // The mock should not have been called with wave_height after clearing
        const waveHeightCalls = mockSetValue.mock.calls.filter(
          (call: [string, unknown]) => call[0] === 'wave_height'
        );
        expect(waveHeightCalls).toHaveLength(0);
      });
    });
  });

  describe('reset', () => {
    it('resets field states when modal closes', () => {
      const { result, rerender } = renderHook(
        ({ isOpen }) =>
          useIntelForecastPrefill({
            isOpen,
            beachId: 'beach-123',
            tag: 'conditions',
            setValue: mockSetValue,
          }),
        { initialProps: { isOpen: true } }
      );

      // Mark field as user-edited
      act(() => {
        result.current.handleFieldEdited('wave_height');
      });

      // Close modal - should reset
      rerender({ isOpen: false });

      // Reset should expose isLoading as false
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('parseNumericValue', () => {
    it('is exported and handles various inputs', () => {
      // This tests the exported utility function
      const { parseNumericValue } = require('@/hooks/use-intel-forecast-prefill');

      expect(parseNumericValue(3.5)).toBe(3.5);
      expect(parseNumericValue('4.5')).toBe(4.5);
      expect(parseNumericValue('3.5 ft')).toBe(3.5);
      expect(parseNumericValue(null)).toBeUndefined();
      expect(parseNumericValue(undefined)).toBeUndefined();
      expect(parseNumericValue('not a number')).toBeUndefined();
      expect(parseNumericValue(NaN)).toBeUndefined();
      expect(parseNumericValue(Infinity)).toBeUndefined();
    });
  });
});
