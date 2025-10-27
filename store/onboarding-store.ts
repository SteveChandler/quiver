import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface OnboardingData {
  // Step 2: Profile
  fullName?: string;
  displayName?: string;

  // Step 3: Home Beach
  homeBeachId?: string;
  homeBeachName?: string;

  // Step 4: Preferences
  experienceLevel?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  surfStyles?: string[];

  // Step 5: Referral
  referralCode?: string;

  // Step 6: Notifications
  pushEnabled?: boolean;
  emailEnabled?: boolean;
}

interface OnboardingStore {
  // State
  currentStep: number;
  isOpen: boolean;
  data: OnboardingData;
  isCompleted: boolean;

  // Actions
  setCurrentStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  updateData: (partial: Partial<OnboardingData>) => void;
  openDialog: () => void;
  closeDialog: () => void;
  completeOnboarding: () => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set, get) => ({
      // Initial state
      currentStep: 0,
      isOpen: false,
      data: {},
      isCompleted: false,

      // Actions
      setCurrentStep: (step) => set({ currentStep: step }),

      nextStep: () => set((state) => ({
        currentStep: Math.min(state.currentStep + 1, 6)
      })),

      prevStep: () => set((state) => ({
        currentStep: Math.max(state.currentStep - 1, 0)
      })),

      updateData: (partial) => set((state) => ({
        data: { ...state.data, ...partial }
      })),

      openDialog: () => set({ isOpen: true }),

      closeDialog: () => set({ isOpen: false }),

      completeOnboarding: () => set({
        isCompleted: true,
        isOpen: false
      }),

      reset: () => set({
        currentStep: 0,
        isOpen: false,
        data: {},
        isCompleted: false
      }),
    }),
    {
      name: 'quiver-onboarding',
      partialize: (state) => ({
        currentStep: state.currentStep,
        data: state.data,
        isCompleted: state.isCompleted,
      }),
    }
  )
);
