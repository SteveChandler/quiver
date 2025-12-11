"use client";

import { useOnboardingStore } from "@/store/onboarding-store";
import { Button } from "@/components/ui/button";
import Image from "next/image";

export function WelcomeStep() {
  const { nextStep } = useOnboardingStore();

  return (
    <div className="text-center space-y-6 py-4" data-testid="welcome-step">
      {/* Quiver Logo */}
      <div className="flex justify-center" data-testid="welcome-logo">
        <Image
          src="/logoQuiver.png"
          alt="Quiver Logo"
          width={180}
          height={180}
          className="object-contain"
          priority
        />
      </div>

      {/* Welcome Text */}
      <div className="space-y-3">
        <h1 className="text-3xl font-bold text-foreground">
          Welcome to Quiver!
        </h1>
        <p className="text-lg text-muted-foreground">
          Your personal surf companion
        </p>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Let&apos;s set up your profile to get personalized forecasts and
          recommendations.
        </p>
      </div>

      {/* Get Started Button */}
      <div className="pt-4">
        <Button
          onClick={nextStep}
          size="lg"
          className="w-full max-w-xs mx-auto"
          data-testid="welcome-get-started"
        >
          Get Started
        </Button>
      </div>
    </div>
  );
}
