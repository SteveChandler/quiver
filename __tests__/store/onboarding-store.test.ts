import { renderHook, act } from '@testing-library/react';
import { useOnboardingStore } from '@/store/onboarding-store';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('useOnboardingStore', () => {
  beforeEach(() => {
    localStorageMock.clear();
    // Reset the store to initial state
    const { result } = renderHook(() => useOnboardingStore());
    act(() => {
      result.current.reset();
    });
  });

  describe('Initial State', () => {
    it('initializes with correct default values', () => {
      const { result } = renderHook(() => useOnboardingStore());

      expect(result.current.currentStep).toBe(0);
      expect(result.current.isOpen).toBe(false);
      expect(result.current.data).toEqual({});
      expect(result.current.isCompleted).toBe(false);
      expect(result.current.userId).toBe(null);
    });
  });

  describe('User ID Scoping', () => {
    it('checkUserId sets userId when none exists', () => {
      const { result } = renderHook(() => useOnboardingStore());

      act(() => {
        result.current.checkUserId('user-123');
      });

      expect(result.current.userId).toBe('user-123');
    });

    it('checkUserId does nothing when same user', () => {
      const { result } = renderHook(() => useOnboardingStore());

      act(() => {
        result.current.checkUserId('user-123');
        result.current.updateData({ fullName: 'John Doe' });
        result.current.setCurrentStep(3);
      });

      // Call checkUserId again with same user
      act(() => {
        result.current.checkUserId('user-123');
      });

      // Data should be preserved
      expect(result.current.userId).toBe('user-123');
      expect(result.current.data.fullName).toBe('John Doe');
      expect(result.current.currentStep).toBe(3);
    });

    it('checkUserId resets store when different user', () => {
      const { result } = renderHook(() => useOnboardingStore());

      act(() => {
        result.current.checkUserId('user-123');
        result.current.updateData({ fullName: 'John Doe' });
        result.current.setCurrentStep(3);
        result.current.openDialog();
      });

      // Verify state is set
      expect(result.current.userId).toBe('user-123');
      expect(result.current.data.fullName).toBe('John Doe');
      expect(result.current.currentStep).toBe(3);

      // Call checkUserId with different user
      act(() => {
        result.current.checkUserId('user-456');
      });

      // Store should be reset with new userId
      expect(result.current.userId).toBe('user-456');
      expect(result.current.data).toEqual({});
      expect(result.current.currentStep).toBe(0);
      expect(result.current.isOpen).toBe(false);
      expect(result.current.isCompleted).toBe(false);
    });

    it('reset clears userId', () => {
      const { result } = renderHook(() => useOnboardingStore());

      act(() => {
        result.current.checkUserId('user-123');
      });

      expect(result.current.userId).toBe('user-123');

      act(() => {
        result.current.reset();
      });

      expect(result.current.userId).toBe(null);
    });
  });

  describe('Step Navigation', () => {
    it('setCurrentStep updates the current step', () => {
      const { result } = renderHook(() => useOnboardingStore());

      act(() => {
        result.current.setCurrentStep(3);
      });

      expect(result.current.currentStep).toBe(3);
    });

    it('nextStep increments step by 1', () => {
      const { result } = renderHook(() => useOnboardingStore());

      act(() => {
        result.current.nextStep();
      });

      expect(result.current.currentStep).toBe(1);

      act(() => {
        result.current.nextStep();
      });

      expect(result.current.currentStep).toBe(2);
    });

    it('nextStep does not exceed maximum step (6)', () => {
      const { result } = renderHook(() => useOnboardingStore());

      act(() => {
        result.current.setCurrentStep(6);
        result.current.nextStep();
      });

      expect(result.current.currentStep).toBe(6);
    });

    it('prevStep decrements step by 1', () => {
      const { result } = renderHook(() => useOnboardingStore());

      act(() => {
        result.current.setCurrentStep(3);
        result.current.prevStep();
      });

      expect(result.current.currentStep).toBe(2);
    });

    it('prevStep does not go below 0', () => {
      const { result } = renderHook(() => useOnboardingStore());

      act(() => {
        result.current.setCurrentStep(0);
        result.current.prevStep();
      });

      expect(result.current.currentStep).toBe(0);
    });
  });

  describe('Data Management', () => {
    it('updateData merges partial data correctly', () => {
      const { result } = renderHook(() => useOnboardingStore());

      act(() => {
        result.current.updateData({ fullName: 'John Doe' });
      });

      expect(result.current.data.fullName).toBe('John Doe');

      act(() => {
        result.current.updateData({ displayName: 'JohnD' });
      });

      expect(result.current.data).toEqual({
        fullName: 'John Doe',
        displayName: 'JohnD',
      });
    });

    it('updateData overwrites existing values', () => {
      const { result } = renderHook(() => useOnboardingStore());

      act(() => {
        result.current.updateData({ fullName: 'John Doe' });
      });

      expect(result.current.data.fullName).toBe('John Doe');

      act(() => {
        result.current.updateData({ fullName: 'Jane Smith' });
      });

      expect(result.current.data.fullName).toBe('Jane Smith');
    });

    it('updateData handles complex nested data', () => {
      const { result } = renderHook(() => useOnboardingStore());

      act(() => {
        result.current.updateData({
          experienceLevel: 'intermediate',
          surfStyles: ['longboard', 'shortboard'],
        });
      });

      expect(result.current.data.experienceLevel).toBe('intermediate');
      expect(result.current.data.surfStyles).toEqual(['longboard', 'shortboard']);
    });
  });

  describe('Dialog State', () => {
    it('openDialog sets isOpen to true', () => {
      const { result } = renderHook(() => useOnboardingStore());

      act(() => {
        result.current.openDialog();
      });

      expect(result.current.isOpen).toBe(true);
    });

    it('closeDialog sets isOpen to false', () => {
      const { result } = renderHook(() => useOnboardingStore());

      act(() => {
        result.current.openDialog();
        result.current.closeDialog();
      });

      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('Completion Flow', () => {
    it('completeOnboarding sets isCompleted to true and closes dialog', () => {
      const { result } = renderHook(() => useOnboardingStore());

      act(() => {
        result.current.openDialog();
        result.current.completeOnboarding();
      });

      expect(result.current.isCompleted).toBe(true);
      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('Reset Functionality', () => {
    it('reset clears all state to initial values', () => {
      const { result } = renderHook(() => useOnboardingStore());

      // Set some state
      act(() => {
        result.current.setCurrentStep(5);
        result.current.openDialog();
        result.current.updateData({
          fullName: 'John Doe',
          displayName: 'JohnD',
          homeBeachId: 'beach-123',
        });
        result.current.completeOnboarding();
      });

      // Verify state is set
      expect(result.current.currentStep).toBe(5);
      expect(result.current.data.fullName).toBe('John Doe');
      expect(result.current.isCompleted).toBe(true);

      // Reset
      act(() => {
        result.current.reset();
      });

      // Verify all state is cleared
      expect(result.current.currentStep).toBe(0);
      expect(result.current.isOpen).toBe(false);
      expect(result.current.data).toEqual({});
      expect(result.current.isCompleted).toBe(false);
    });
  });

  // Persistence tests moved to E2E tests (e2e/onboarding-persistence.spec.ts)
  // Zustand's persist middleware doesn't work well with mocked localStorage in unit tests
  // Real browser localStorage is tested in E2E environment where it works correctly

  describe('Edge Cases', () => {
    it('handles empty updateData calls gracefully', () => {
      const { result } = renderHook(() => useOnboardingStore());

      act(() => {
        result.current.updateData({});
      });

      expect(result.current.data).toEqual({});
    });

    it('handles rapid successive state updates', () => {
      const { result } = renderHook(() => useOnboardingStore());

      act(() => {
        result.current.nextStep();
        result.current.nextStep();
        result.current.prevStep();
        result.current.updateData({ fullName: 'Test' });
        result.current.updateData({ displayName: 'Tester' });
      });

      expect(result.current.currentStep).toBe(1);
      expect(result.current.data.fullName).toBe('Test');
      expect(result.current.data.displayName).toBe('Tester');
    });

    it('maintains data integrity across multiple step navigations', () => {
      const { result } = renderHook(() => useOnboardingStore());

      act(() => {
        result.current.updateData({ fullName: 'John' });
        result.current.nextStep();
        result.current.updateData({ homeBeachId: 'beach-1' });
        result.current.nextStep();
        result.current.prevStep();
      });

      // Data should be preserved
      expect(result.current.data.fullName).toBe('John');
      expect(result.current.data.homeBeachId).toBe('beach-1');
      expect(result.current.currentStep).toBe(1);
    });
  });

  describe('Type Safety', () => {
    it('accepts valid experienceLevel values', () => {
      const { result } = renderHook(() => useOnboardingStore());

      act(() => {
        result.current.updateData({ experienceLevel: 'beginner' });
      });
      expect(result.current.data.experienceLevel).toBe('beginner');

      act(() => {
        result.current.updateData({ experienceLevel: 'intermediate' });
      });
      expect(result.current.data.experienceLevel).toBe('intermediate');

      act(() => {
        result.current.updateData({ experienceLevel: 'advanced' });
      });
      expect(result.current.data.experienceLevel).toBe('advanced');

      act(() => {
        result.current.updateData({ experienceLevel: 'expert' });
      });
      expect(result.current.data.experienceLevel).toBe('expert');
    });

    it('accepts boolean values for notification preferences', () => {
      const { result } = renderHook(() => useOnboardingStore());

      act(() => {
        result.current.updateData({
          pushEnabled: true,
          emailEnabled: false,
        });
      });

      expect(result.current.data.pushEnabled).toBe(true);
      expect(result.current.data.emailEnabled).toBe(false);
    });
  });
});
