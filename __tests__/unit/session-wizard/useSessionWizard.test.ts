import { renderHook, act } from '@testing-library/react';
import { useSessionWizard, WIZARD_STEPS } from '@/hooks/useSessionWizard';

// Mock the auth context
jest.mock('@/context/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id' }
  })
}));

// Mock the session form hook
jest.mock('@/hooks/use-session-form', () => ({
  useSessionForm: jest.fn(() => ({
    mode: 'plan',
    setMode: jest.fn(),
    loading: false,
    setLoading: jest.fn(),
    boards: [],
    beaches: [],
    loadingData: false,
    formState: {
      selectedBeach: '',
      selectedBeachId: '',
      selectedDate: '2024-01-01',
      selectedTime: '06:00',
      selectedBoard: '',
      boardId: '',
      duration: '1h',
      waveQuality: '',
      waterTemp: '',
      crowdLevel: '',
      parkingEase: '',
      overallRating: '',
      notes: '',
      photos: [],
      waveTypes: [],
    },
    updateField: jest.fn(),
    resetForm: jest.fn(),
    refreshBoards: jest.fn(),
    isPlanning: true,
  }))
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock console methods
const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

describe('useSessionWizard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    consoleSpy.mockRestore();
  });

  describe('initialization', () => {
    it('should initialize with plan mode by default', () => {
      const { result } = renderHook(() => useSessionWizard());
      
      expect(result.current.mode).toBe('plan');
      expect(result.current.currentStep).toBe(0);
      expect(result.current.totalSteps).toBe(WIZARD_STEPS.plan.length);
      expect(result.current.isFirstStep).toBe(true);
      expect(result.current.isLastStep).toBe(false);
    });

    it('should initialize with log mode when specified', () => {
      const { result } = renderHook(() => useSessionWizard('log'));
      
      expect(result.current.mode).toBe('log');
      expect(result.current.totalSteps).toBe(WIZARD_STEPS.log.length);
    });

    it('should have correct initial progress values', () => {
      const { result } = renderHook(() => useSessionWizard());
      
      expect(result.current.progress).toBe(100 / WIZARD_STEPS.plan.length);
      expect(result.current.completedSteps).toBe(0);
      expect(result.current.canGoPrev).toBe(false);
      expect(result.current.canGoNext).toBe(false); // No beach selected initially
    });
  });

  describe('step navigation', () => {
    it('should navigate to next step when canGoNext is true', () => {
      const { result } = renderHook(() => useSessionWizard());
      
      // Mock form state to be valid for current step
      act(() => {
        result.current.updateField('selectedBeach', 'Test Beach');
      });
      
      act(() => {
        result.current.nextStep();
      });
      
      expect(result.current.currentStep).toBe(1);
      expect(result.current.canGoPrev).toBe(true);
    });

    it('should navigate to previous step when canGoPrev is true', () => {
      const { result } = renderHook(() => useSessionWizard());
      
      // Go to step 1 first
      act(() => {
        result.current.updateField('selectedBeach', 'Test Beach');
        result.current.nextStep();
      });
      
      act(() => {
        result.current.prevStep();
      });
      
      expect(result.current.currentStep).toBe(0);
      expect(result.current.canGoPrev).toBe(false);
    });

    it('should navigate to specific step with goToStep', () => {
      const { result } = renderHook(() => useSessionWizard());
      
      act(() => {
        result.current.goToStep(2);
      });
      
      expect(result.current.currentStep).toBe(2);
    });

    it('should not navigate beyond step bounds', () => {
      const { result } = renderHook(() => useSessionWizard());
      
      act(() => {
        result.current.goToStep(-1);
      });
      expect(result.current.currentStep).toBe(0);
      
      act(() => {
        result.current.goToStep(999);
      });
      expect(result.current.currentStep).toBe(0); // Should not change
    });
  });

  describe('step validation', () => {
    it('should validate location step correctly', () => {
      const { result } = renderHook(() => useSessionWizard());
      
      // Initially invalid (no beach selected)
      expect(result.current.isStepValid(0)).toBe(false);
      
      act(() => {
        result.current.updateField('selectedBeach', 'Test Beach');
      });
      
      expect(result.current.isStepValid(0)).toBe(true);
    });

    it('should validate datetime step correctly for plan mode', () => {
      const { result } = renderHook(() => useSessionWizard('plan'));
      
      // Initially invalid (needs both date and time for planning)
      expect(result.current.isStepValid(1)).toBe(false);
      
      act(() => {
        result.current.updateField('selectedDate', '2024-01-01');
      });
      expect(result.current.isStepValid(1)).toBe(false); // Still needs time
      
      act(() => {
        result.current.updateField('selectedTime', '06:00');
      });
      expect(result.current.isStepValid(1)).toBe(true);
    });

    it('should validate datetime step correctly for log mode', () => {
      const { result } = renderHook(() => useSessionWizard('log'));
      
      // For log mode, only date is required
      act(() => {
        result.current.updateField('selectedDate', '2024-01-01');
      });
      
      expect(result.current.isStepValid(1)).toBe(true);
    });

    it('should check form completion correctly', () => {
      const { result } = renderHook(() => useSessionWizard());
      
      expect(result.current.isFormComplete).toBe(false);
      
      // Complete required fields
      act(() => {
        result.current.updateField('selectedBeach', 'Test Beach');
        result.current.updateField('selectedDate', '2024-01-01');
        result.current.updateField('selectedTime', '06:00');
      });
      
      expect(result.current.isFormComplete).toBe(true);
    });
  });

  describe('autosave functionality', () => {
    it('should initialize with correct autosave config', () => {
      const { result } = renderHook(() => useSessionWizard('plan', {
        enabled: true,
        debounceMs: 1000,
        storageKey: 'test-key'
      }));
      
      expect(result.current.autosaveStatus).toBe('idle');
      expect(result.current.isAutosaving).toBe(false);
      expect(result.current.lastSavedAt).toBeNull();
    });

    it('should save to localStorage when enabled', async () => {
      const { result } = renderHook(() => useSessionWizard('plan', {
        enabled: true,
        debounceMs: 100 // Short delay for testing
      }));
      
      act(() => {
        result.current.updateField('selectedBeach', 'Test Beach');
      });
      
      // Wait for debounce
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });
      
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('should restore from localStorage on mount', () => {
      const savedData = JSON.stringify({
        formState: {
          selectedBeach: 'Saved Beach',
          selectedDate: '2024-01-01'
        },
        currentStep: 1,
        timestamp: Date.now()
      });
      
      localStorageMock.getItem.mockReturnValue(savedData);
      
      const { result } = renderHook(() => useSessionWizard());
      
      expect(result.current.formState.selectedBeach).toBe('Saved Beach');
    });
  });

  describe('current step info', () => {
    it('should provide correct current wizard step info', () => {
      const { result } = renderHook(() => useSessionWizard('plan'));
      
      expect(result.current.currentWizardStep).toEqual(WIZARD_STEPS.plan[0]);
      expect(result.current.currentWizardStep.id).toBe('location');
    });

    it('should update step info when navigating', () => {
      const { result } = renderHook(() => useSessionWizard('plan'));
      
      act(() => {
        result.current.updateField('selectedBeach', 'Test Beach');
        result.current.nextStep();
      });
      
      expect(result.current.currentWizardStep).toEqual(WIZARD_STEPS.plan[1]);
      expect(result.current.currentWizardStep.id).toBe('datetime');
    });
  });

  describe('motion and animation properties', () => {
    it('should provide motion configurations', () => {
      const { result } = renderHook(() => useSessionWizard());
      
      expect(result.current.stepMotion).toBeDefined();
      expect(result.current.progressMotion).toBeDefined();
      expect(result.current.stepMotion.initial).toEqual({ x: 40, opacity: 0 });
      expect(result.current.stepMotion.animate).toEqual({ x: 0, opacity: 1 });
    });
  });

  describe('analytics tracking', () => {
    it('should call analytics functions', () => {
      const { result } = renderHook(() => useSessionWizard());
      
      act(() => {
        result.current.trackStepView('location');
      });
      
      expect(consoleSpy).toHaveBeenCalledWith('Step viewed: location');
      
      act(() => {
        result.current.trackStepComplete('location');
      });
      
      expect(consoleSpy).toHaveBeenCalledWith('Step completed: location');
    });
  });
});