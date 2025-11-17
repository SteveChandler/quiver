/**
 * Integration test for dropdown state synchronization fix
 *
 * This test verifies that the autocomplete dropdown opens immediately
 * when the user types a valid query (2+ characters), fixing the race
 * condition between immediate query state and debounced query state.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useBeachAutocomplete } from '@/hooks/use-beach-autocomplete';

// Mock fetch
global.fetch = jest.fn();

describe('useBeachAutocomplete - Dropdown State Fix', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
  });

  it('opens dropdown immediately when typing valid query (2+ chars)', () => {
    const { result } = renderHook(() => useBeachAutocomplete({ minQueryLength: 2 }));

    // Initial state - dropdown should be closed
    expect(result.current.isOpen).toBe(false);
    expect(result.current.query).toBe('');

    // Type 2 characters - dropdown should open IMMEDIATELY
    act(() => {
      result.current.setQuery('sw');
    });

    // CRITICAL FIX: isOpen should be true immediately, not after 300ms debounce
    expect(result.current.isOpen).toBe(true);
    expect(result.current.query).toBe('sw');
  });

  it('closes dropdown immediately when deleting below minQueryLength', () => {
    const { result } = renderHook(() => useBeachAutocomplete({ minQueryLength: 2 }));

    // Type valid query
    act(() => {
      result.current.setQuery('swami');
    });

    expect(result.current.isOpen).toBe(true);

    // Delete to 1 character - dropdown should close IMMEDIATELY
    act(() => {
      result.current.setQuery('s');
    });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.query).toBe('s');
  });

  it('keeps dropdown open while typing valid query', () => {
    const { result } = renderHook(() => useBeachAutocomplete({ minQueryLength: 2 }));

    // Type initial valid query
    act(() => {
      result.current.setQuery('sw');
    });

    expect(result.current.isOpen).toBe(true);

    // Continue typing - dropdown should stay open
    act(() => {
      result.current.setQuery('swa');
    });

    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.setQuery('swami');
    });

    expect(result.current.isOpen).toBe(true);
  });

  it('API calls are still debounced (not affected by immediate dropdown open)', async () => {
    jest.useFakeTimers();

    const { result } = renderHook(() => useBeachAutocomplete({
      minQueryLength: 2,
      debounceMs: 300
    }));

    // Type "sw" - dropdown opens immediately
    act(() => {
      result.current.setQuery('sw');
    });

    expect(result.current.isOpen).toBe(true);

    // API should NOT be called yet (debounce delay)
    expect(global.fetch).not.toHaveBeenCalled();

    // Fast-forward time by 300ms
    act(() => {
      jest.advanceTimersByTime(300);
    });

    // Now API should be called
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/beaches/search?query=sw')
      );
    });

    jest.useRealTimers();
  });

  it('rapid typing only triggers one API call after debounce', async () => {
    jest.useFakeTimers();

    const { result } = renderHook(() => useBeachAutocomplete({
      minQueryLength: 2,
      debounceMs: 300
    }));

    // Rapid typing: "s" -> "sw" -> "swa" -> "swami"
    act(() => {
      result.current.setQuery('s');
    });

    act(() => {
      jest.advanceTimersByTime(50);
    });

    act(() => {
      result.current.setQuery('sw');
    });

    act(() => {
      jest.advanceTimersByTime(50);
    });

    act(() => {
      result.current.setQuery('swa');
    });

    act(() => {
      jest.advanceTimersByTime(50);
    });

    act(() => {
      result.current.setQuery('swami');
    });

    // Dropdown should be open
    expect(result.current.isOpen).toBe(true);

    // API should NOT be called yet
    expect(global.fetch).not.toHaveBeenCalled();

    // Fast-forward past debounce delay
    act(() => {
      jest.advanceTimersByTime(300);
    });

    // API should be called only ONCE with final query
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/beaches/search?query=swami')
      );
    });

    jest.useRealTimers();
  });
});
