'use client';

import { cn } from '@/lib/utils';

interface StepperProps {
  currentStep: number;
  totalSteps: number;
}

export function Stepper({ currentStep, totalSteps }: StepperProps) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 flex-1 rounded-full transition-all duration-300',
            i <= currentStep ? 'bg-ocean-blue' : 'bg-gray-200'
          )}
        />
      ))}
    </div>
  );
}
