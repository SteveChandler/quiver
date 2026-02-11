import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Total number of onboarding steps (0-indexed: steps 0-2)
export const TOTAL_ONBOARDING_STEPS = 3;

// Signal value indicating onboarding completion (used in step change callbacks)
export const ONBOARDING_COMPLETION_SIGNAL = -1;

// Step names for analytics tracking
export const ONBOARDING_STEP_NAMES: Record<number, string> = {
  0: 'home_beach',
  1: 'level_and_time',
  2: 'payoff',
};

interface OnboardingData {
  // Step 1: Home Beach
  homeBeachId?: string;
  homeBeachName?: string;
  homeBeachSlug?: string;
  homeBeachCity?: string;
  homeBeachState?: string;
  homeBeachCountry?: string;

  // Step 2: Level + Time
  experienceLevel?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  preferredTime?: 'dawn' | 'after_work' | 'weekends';

  // Step 3: Payoff (no data stored)

  // Legacy fields (kept for backwards compatibility with persisted localStorage)
  fullName?: string;
  displayName?: string;
  surfStyles?: string[];
  preferredWaveSize?: 'small' | 'medium' | 'large' | 'any';
  preferredBreakType?: 'beach' | 'point' | 'reef' | 'any';
  crowdPreference?: 'social' | 'moderate' | 'solitude';
}

/** Callback for tracking step transitions */
export type OnStepChangeCallback = (fromStep: number, toStep: number, stepName: string) => void;

interface OnboardingStore {
  // State
  currentStep: number;
  isOpen: boolean;
  data: OnboardingData;
  isCompleted: boolean;
  userId: string | null;

  // Actions
  setCurrentStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  updateData: (partial: Partial<OnboardingData>) => void;
  openDialog: () => void;
  closeDialog: () => void;
  completeOnboarding: () => void;
  reset: () => void;
  checkUserId: (currentUserId: string) => void;

  // Step change callback (set by useOnboardingTracking hook)
  onStepChange: OnStepChangeCallback | null;
  setOnStepChange: (callback: OnStepChangeCallback | null) => void;
}

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set, get) => ({
      // Initial state
      currentStep: 0,
      isOpen: false,
      data: {},
      isCompleted: false,
      userId: null,
      onStepChange: null,

      // Actions
      setCurrentStep: (step) => set({ currentStep: step }),

      nextStep: () => {
        const state = get();
        const fromStep = state.currentStep;
        const toStep = Math.min(fromStep + 1, TOTAL_ONBOARDING_STEPS - 1);

        // Notify callback before state change
        if (state.onStepChange && fromStep !== toStep) {
          const stepName = ONBOARDING_STEP_NAMES[fromStep] || `step_${fromStep}`;
          state.onStepChange(fromStep, toStep, stepName);
        }

        set({ currentStep: toStep });
      },

      prevStep: () => set((state) => ({
        currentStep: Math.max(state.currentStep - 1, 0)
      })),

      updateData: (partial) => set((state) => ({
        data: { ...state.data, ...partial }
      })),

      openDialog: () => set({ isOpen: true }),

      closeDialog: () => set({ isOpen: false }),

      completeOnboarding: () => {
        const state = get();
        // Track completion step
        if (state.onStepChange) {
          const stepName = ONBOARDING_STEP_NAMES[state.currentStep] || `step_${state.currentStep}`;
          state.onStepChange(state.currentStep, ONBOARDING_COMPLETION_SIGNAL, stepName);
        }
        set({
          isCompleted: true,
          isOpen: false
        });
      },

      reset: () => set({
        currentStep: 0,
        isOpen: false,
        data: {},
        isCompleted: false,
        userId: null,
        // Keep onStepChange callback
      }),

      checkUserId: (currentUserId) => {
        const state = get();
        if (state.userId !== currentUserId) {
          // Reset store if user has changed (keep callback)
          set({
            currentStep: 0,
            isOpen: false,
            data: {},
            isCompleted: false,
            userId: currentUserId
          });
        }
      },

      setOnStepChange: (callback) => set({ onStepChange: callback }),
    }),
    {
      name: 'quiver-onboarding',
      partialize: (state) => ({
        currentStep: state.currentStep,
        data: state.data,
        userId: state.userId,
      }),
    }
  )
);
