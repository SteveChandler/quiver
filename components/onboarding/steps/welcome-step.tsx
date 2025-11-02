'use client';

import { useOnboardingStore } from '@/store/onboarding-store';
import { Button } from '@/components/ui/button';
import { Waves } from 'lucide-react';

export function WelcomeStep() {
  const { nextStep } = useOnboardingStore();

  return (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className="w-20 h-20 bg-gradient-to-br from-ocean-blue to-cyan-500 rounded-full flex items-center justify-center">
          <Waves className="h-10 w-10 text-white" />
        </div>
      </div>

      <div>
        <h1 className="text-3xl font-bold mb-3">Welcome to Quiver!</h1>
        <p className="text-gray-600 text-lg">
          Your personalized surf forecasting and session tracking companion
        </p>
      </div>

      <div className="bg-blue-50 rounded-lg p-6 space-y-3 text-left">
        <h3 className="font-semibold text-lg mb-3">What you&apos;ll get:</h3>
        <div className="space-y-2">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-ocean-blue flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-white text-sm">✓</span>
            </div>
            <div>
              <p className="font-medium">Personalized Forecasts</p>
              <p className="text-sm text-gray-600">Real-time surf conditions for your favorite spots</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-ocean-blue flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-white text-sm">✓</span>
            </div>
            <div>
              <p className="font-medium">Session Tracking</p>
              <p className="text-sm text-gray-600">Log sessions and earn XP as you progress</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-ocean-blue flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-white text-sm">✓</span>
            </div>
            <div>
              <p className="font-medium">Community</p>
              <p className="text-sm text-gray-600">Connect with surfers and share your stoke</p>
            </div>
          </div>
        </div>
      </div>

      <Button onClick={nextStep} size="lg" className="w-full">
        Get Started
      </Button>

      <p className="text-sm text-gray-500">Takes less than 2 minutes</p>
    </div>
  );
}
