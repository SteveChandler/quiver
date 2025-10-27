'use client';

import { useEffect } from 'react';
import { useOnboardingStore } from '@/store/onboarding-store';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Stepper } from './stepper';
import { WelcomeStep } from './steps/welcome-step';
import { ProfileStep } from './steps/profile-step';
import { HomeBeachStep } from './steps/home-beach-step';
import { PreferencesStep } from './steps/preferences-step';
import { ReferralStep } from './steps/referral-step';
import { NotificationsStep } from './steps/notifications-step';
import { CompletionStep } from './steps/completion-step';
import { useAuth } from '@/context/auth-context';

const STEPS = [
  WelcomeStep,
  ProfileStep,
  HomeBeachStep,
  PreferencesStep,
  ReferralStep,
  NotificationsStep,
  CompletionStep,
];

export function OnboardingDialog() {
  const { user } = useAuth();
  const { isOpen, currentStep, isCompleted, openDialog } = useOnboardingStore();

  useEffect(() => {
    // Auto-open for new users who haven't completed onboarding
    if (user && !isCompleted) {
      // Check if user has completed onboarding in database
      const checkOnboardingStatus = async () => {
        try {
          const res = await fetch('/api/user/onboarding-status');
          const data = await res.json();

          if (!data.completed && !localStorage.getItem('onboarding_dismissed')) {
            // Small delay to let page settle
            setTimeout(() => openDialog(), 500);
          }
        } catch (error) {
          console.error('Failed to check onboarding status:', error);
        }
      };

      checkOnboardingStatus();
    }
  }, [user, isCompleted, openDialog]);

  // Allow forcing the dialog with query param for testing
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('showOnboarding') === '1') {
        openDialog();
      }
    }
  }, [openDialog]);

  const CurrentStepComponent = STEPS[currentStep];

  return (
    <Dialog open={isOpen && !isCompleted}>
      <DialogContent
        className="max-w-lg max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="p-6">
          <Stepper currentStep={currentStep} totalSteps={STEPS.length} />
          <CurrentStepComponent />
        </div>
      </DialogContent>
    </Dialog>
  );
}
