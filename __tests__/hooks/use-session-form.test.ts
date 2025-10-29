/**
 * Tests for useSessionForm hook
 * Tests form state management, mode switching, and data loading
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useSessionForm } from '@/hooks/use-session-form';
import { getUserBoards } from '@/actions/board-actions';
import { getBeaches } from '@/actions/beach-actions';
import { useAuth } from '@/context/auth-context';
import { toast } from 'sonner';

// Mock dependencies
jest.mock('@/actions/board-actions');
jest.mock('@/actions/beach-actions');
jest.mock('@/context/auth-context');
jest.mock('sonner');

const mockGetUserBoards = getUserBoards as jest.MockedFunction<typeof getUserBoards>;
const mockGetBeaches = getBeaches as jest.MockedFunction<typeof getBeaches>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockToast = toast as jest.Mocked<typeof toast>;

describe('useSessionForm', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
  };

  const mockBoards = [
    { id: 'board-1', name: 'Shortboard', user_id: 'test-user-id' },
    { id: 'board-2', name: 'Longboard', user_id: 'test-user-id' },
  ];

  const mockBeaches = [
    { id: 'beach-1', name: 'Blacks Beach', latitude: 33.0, longitude: -117.0 },
    { id: 'beach-2', name: 'La Jolla Shores', latitude: 32.9, longitude: -117.1 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    mockUseAuth.mockReturnValue({ user: mockUser } as any);
    mockGetUserBoards.mockResolvedValue({
      success: true,
      data: mockBoards as any,
    });
    mockGetBeaches.mockResolvedValue({
      success: true,
      data: mockBeaches as any,
    });
  });

  describe('Initialization', () => {
    it('should initialize with default plan mode', () => {
      const { result } = renderHook(() => useSessionForm());

      expect(result.current.mode).toBe('plan');
      expect(result.current.step).toBe(1);
      expect(result.current.loading).toBe(false);
      expect(result.current.loadingData).toBe(true); // Initially loading
    });

    it('should initialize with log mode when specified', () => {
      const { result } = renderHook(() => useSessionForm('log'));

      expect(result.current.mode).toBe('log');
    });

    it('should initialize with default form state', () => {
      const { result } = renderHook(() => useSessionForm());

      expect(result.current.formState.selectedBeach).toBe('');
      expect(result.current.formState.selectedDate).toBe(
        new Date().toISOString().split('T')[0]
      );
      expect(result.current.formState.selectedTime).toBe('06:00');
      expect(result.current.formState.duration).toBe('60m');
      expect(result.current.formState.photos).toEqual([]);
      expect(result.current.formState.waveTypes).toEqual([]);
      expect(result.current.formState.invitees).toEqual([]);
    });
  });

  describe('Data Loading', () => {
    it('should load user boards on mount', async () => {
      const { result } = renderHook(() => useSessionForm());

      await waitFor(() => {
        expect(result.current.loadingData).toBe(false);
      });

      expect(mockGetUserBoards).toHaveBeenCalledWith('test-user-id');
      expect(result.current.boards).toEqual(mockBoards);
    });

    it('should load beaches on mount', async () => {
      const { result } = renderHook(() => useSessionForm());

      await waitFor(() => {
        expect(result.current.loadingData).toBe(false);
      });

      expect(mockGetBeaches).toHaveBeenCalled();
      expect(result.current.beaches).toEqual(mockBeaches);
    });

    it('should handle no user gracefully', async () => {
      mockUseAuth.mockReturnValue({ user: null } as any);

      const { result } = renderHook(() => useSessionForm());

      await waitFor(() => {
        expect(result.current.loadingData).toBe(false);
      });

      expect(mockGetUserBoards).not.toHaveBeenCalled();
      expect(result.current.boards).toEqual([]);
    });

    it('should show toast when user has no boards', async () => {
      mockGetUserBoards.mockResolvedValue({
        success: true,
        data: [],
      });

      const { result } = renderHook(() => useSessionForm());

      await waitFor(() => {
        expect(result.current.loadingData).toBe(false);
      });

      expect(mockToast.info).toHaveBeenCalledWith(
        "You don't have any boards yet. Add a board to get started!"
      );
    });

    it('should handle data loading errors', async () => {
      mockGetUserBoards.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useSessionForm());

      await waitFor(() => {
        expect(result.current.loadingData).toBe(false);
      });

      expect(mockToast.error).toHaveBeenCalledWith(
        'Failed to load data. Some features may be limited.'
      );
    });
  });

  describe('Mode Switching', () => {
    it('should switch from plan to log mode', () => {
      const { result } = renderHook(() => useSessionForm('plan'));

      act(() => {
        result.current.setMode('log');
      });

      expect(result.current.mode).toBe('log');
      expect(result.current.isPlanning).toBe(false);
    });

    it('should switch from log to plan mode', () => {
      const { result } = renderHook(() => useSessionForm('log'));

      act(() => {
        result.current.setMode('plan');
      });

      expect(result.current.mode).toBe('plan');
      expect(result.current.isPlanning).toBe(true);
    });

    it('should update isPlanning computed property', () => {
      const { result } = renderHook(() => useSessionForm());

      expect(result.current.isPlanning).toBe(true);

      act(() => {
        result.current.setMode('log');
      });

      expect(result.current.isPlanning).toBe(false);
    });
  });

  describe('Step Management', () => {
    it('should advance to next step', () => {
      const { result } = renderHook(() => useSessionForm());

      act(() => {
        result.current.nextStep();
      });

      expect(result.current.step).toBe(2);
    });

    it('should go back to previous step', () => {
      const { result } = renderHook(() => useSessionForm());

      act(() => {
        result.current.setStep(3);
      });

      expect(result.current.step).toBe(3);

      act(() => {
        result.current.prevStep();
      });

      expect(result.current.step).toBe(2);
    });

    it('should set step directly', () => {
      const { result } = renderHook(() => useSessionForm());

      act(() => {
        result.current.setStep(3);
      });

      expect(result.current.step).toBe(3);
    });
  });

  describe('Form Field Updates', () => {
    it('should update selectedBeach field', async () => {
      const { result } = renderHook(() => useSessionForm());

      await waitFor(() => {
        expect(result.current.loadingData).toBe(false);
      });

      act(() => {
        result.current.updateField('selectedBeach', 'blacks-beach');
      });

      expect(result.current.formState.selectedBeach).toBe('blacks-beach');
    });

    it('should update selectedDate field', async () => {
      const { result } = renderHook(() => useSessionForm());

      await waitFor(() => {
        expect(result.current.loadingData).toBe(false);
      });

      const newDate = '2024-12-25';

      act(() => {
        result.current.updateField('selectedDate', newDate);
      });

      expect(result.current.formState.selectedDate).toBe(newDate);
    });

    it('should update rating field', async () => {
      const { result } = renderHook(() => useSessionForm());

      await waitFor(() => {
        expect(result.current.loadingData).toBe(false);
      });

      act(() => {
        result.current.updateField('overallRating', '5');
      });

      expect(result.current.formState.overallRating).toBe('5');
    });

    it('should update photos array', async () => {
      const { result } = renderHook(() => useSessionForm());

      await waitFor(() => {
        expect(result.current.loadingData).toBe(false);
      });

      const photos = ['photo1.jpg', 'photo2.jpg'];

      act(() => {
        result.current.updateField('photos', photos);
      });

      expect(result.current.formState.photos).toEqual(photos);
    });

    it('should update waveTypes array', async () => {
      const { result } = renderHook(() => useSessionForm());

      await waitFor(() => {
        expect(result.current.loadingData).toBe(false);
      });

      const waveTypes = ['barrel', 'point-break'];

      act(() => {
        result.current.updateField('waveTypes', waveTypes);
      });

      expect(result.current.formState.waveTypes).toEqual(waveTypes);
    });

    it('should update notes field', async () => {
      const { result } = renderHook(() => useSessionForm());

      await waitFor(() => {
        expect(result.current.loadingData).toBe(false);
      });

      const notes = 'Great session today!';

      act(() => {
        result.current.updateField('notes', notes);
      });

      expect(result.current.formState.notes).toBe(notes);
    });

    it('should update invitees array', async () => {
      const { result } = renderHook(() => useSessionForm());

      await waitFor(() => {
        expect(result.current.loadingData).toBe(false);
      });

      const invitees = [
        { userId: 'user-1', name: 'John Doe' },
        { email: 'jane@example.com', name: 'Jane Smith' },
      ];

      act(() => {
        result.current.updateField('invitees', invitees);
      });

      expect(result.current.formState.invitees).toEqual(invitees);
    });

    it('should update optimal times', async () => {
      const { result } = renderHook(() => useSessionForm());

      await waitFor(() => {
        expect(result.current.loadingData).toBe(false);
      });

      const optimalTimes = [
        {
          time: '06:00',
          score: 85,
          rating: 'excellent' as const,
          conditions: {
            waveHeight: 4,
            waveQuality: 'clean',
            windSpeed: 5,
            windDirection: 'offshore',
            confidence: 90,
          },
          reasons: ['Offshore winds', 'Good swell'],
        },
      ];

      act(() => {
        result.current.updateField('optimalTimes', optimalTimes);
      });

      expect(result.current.formState.optimalTimes).toEqual(optimalTimes);
    });
  });

  describe('Board Selection', () => {
    it('should update boardId when board is selected', async () => {
      const { result } = renderHook(() => useSessionForm());

      await waitFor(() => {
        expect(result.current.loadingData).toBe(false);
      });

      act(() => {
        result.current.updateField('selectedBoard', 'board-1');
      });

      await waitFor(() => {
        expect(result.current.formState.boardId).toBe('board-1');
      });
    });

    it('should not set boardId if board not found', async () => {
      const { result } = renderHook(() => useSessionForm());

      await waitFor(() => {
        expect(result.current.loadingData).toBe(false);
      });

      act(() => {
        result.current.updateField('selectedBoard', 'nonexistent-board');
      });

      // BoardId should remain undefined
      expect(result.current.formState.boardId).toBeUndefined();
    });
  });

  describe('Form Reset', () => {
    it('should reset form to initial state', async () => {
      const { result } = renderHook(() => useSessionForm());

      await waitFor(() => {
        expect(result.current.loadingData).toBe(false);
      });

      // Set some values
      act(() => {
        result.current.updateField('selectedBeach', 'blacks');
        result.current.updateField('overallRating', '5');
        result.current.updateField('notes', 'Great session!');
        result.current.setStep(3);
      });

      expect(result.current.step).toBe(3);
      expect(result.current.formState.selectedBeach).toBe('blacks');

      // Reset
      act(() => {
        result.current.resetForm();
      });

      expect(result.current.step).toBe(1);
      expect(result.current.formState.selectedBeach).toBe('');
      expect(result.current.formState.selectedDate).toBe('');
      expect(result.current.formState.overallRating).toBe('');
      expect(result.current.formState.notes).toBe('');
      expect(result.current.formState.photos).toEqual([]);
    });
  });

  describe('Refresh Boards', () => {
    it('should refresh boards list', async () => {
      const { result } = renderHook(() => useSessionForm());

      await waitFor(() => {
        expect(result.current.loadingData).toBe(false);
      });

      // Update mock to return different boards
      const newBoards = [
        { id: 'board-3', name: 'Fish', user_id: 'test-user-id' },
      ];
      mockGetUserBoards.mockResolvedValue({
        success: true,
        data: newBoards as any,
      });

      await act(async () => {
        await result.current.refreshBoards();
      });

      expect(result.current.boards).toEqual(newBoards);
    });

    it('should handle refresh errors', async () => {
      const { result } = renderHook(() => useSessionForm());

      await waitFor(() => {
        expect(result.current.loadingData).toBe(false);
      });

      mockGetUserBoards.mockRejectedValue(new Error('Network error'));

      await act(async () => {
        await result.current.refreshBoards();
      });

      expect(mockToast.error).toHaveBeenCalledWith('Failed to refresh boards.');
    });

    it('should not refresh boards if no user', async () => {
      mockUseAuth.mockReturnValue({ user: null } as any);

      const { result } = renderHook(() => useSessionForm());

      await waitFor(() => {
        expect(result.current.loadingData).toBe(false);
      });

      await act(async () => {
        await result.current.refreshBoards();
      });

      // Should not call getUserBoards
      expect(mockGetUserBoards).toHaveBeenCalledTimes(0);
    });
  });

  describe('Loading States', () => {
    it('should set loading state', () => {
      const { result } = renderHook(() => useSessionForm());

      act(() => {
        result.current.setLoading(true);
      });

      expect(result.current.loading).toBe(true);

      act(() => {
        result.current.setLoading(false);
      });

      expect(result.current.loading).toBe(false);
    });
  });

  describe('Complex Workflows', () => {
    it('should handle complete session planning workflow', async () => {
      const { result } = renderHook(() => useSessionForm('plan'));

      await waitFor(() => {
        expect(result.current.loadingData).toBe(false);
      });

      // Step 1: Select beach
      act(() => {
        result.current.updateField('selectedBeach', 'blacks');
        result.current.updateField('selectedBeachId', 'beach-1');
        result.current.nextStep();
      });

      expect(result.current.step).toBe(2);

      // Step 2: Select date/time
      act(() => {
        result.current.updateField('selectedDate', '2024-12-25');
        result.current.updateField('selectedTime', '06:00');
        result.current.nextStep();
      });

      expect(result.current.step).toBe(3);

      // Step 3: Select board
      act(() => {
        result.current.updateField('selectedBoard', 'board-1');
      });

      // Verify final state
      expect(result.current.formState).toMatchObject({
        selectedBeach: 'blacks',
        selectedBeachId: 'beach-1',
        selectedDate: '2024-12-25',
        selectedTime: '06:00',
        selectedBoard: 'board-1',
      });
    });

    it('should handle complete session logging workflow', async () => {
      const { result } = renderHook(() => useSessionForm('log'));

      await waitFor(() => {
        expect(result.current.loadingData).toBe(false);
      });

      // Fill out session details
      act(() => {
        result.current.updateField('selectedBeach', 'blacks');
        result.current.updateField('selectedDate', '2024-12-20');
        result.current.updateField('selectedTime', '07:00');
        result.current.updateField('selectedBoard', 'board-1');
        result.current.updateField('duration', '120m');
        result.current.updateField('waveQuality', '4');
        result.current.updateField('waterTemp', '65');
        result.current.updateField('crowdLevel', '3');
        result.current.updateField('overallRating', '5');
        result.current.updateField('notes', 'Epic session!');
        result.current.updateField('photos', ['photo1.jpg', 'photo2.jpg']);
      });

      // Verify complete state
      expect(result.current.formState).toMatchObject({
        selectedBeach: 'blacks',
        selectedDate: '2024-12-20',
        selectedTime: '07:00',
        selectedBoard: 'board-1',
        duration: '120m',
        waveQuality: '4',
        waterTemp: '65',
        crowdLevel: '3',
        overallRating: '5',
        notes: 'Epic session!',
        photos: ['photo1.jpg', 'photo2.jpg'],
      });
    });
  });
});
