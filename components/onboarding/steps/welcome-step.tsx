"use client";

import { useOnboardingStore } from "@/store/onboarding-store";
import Image from "next/image";

export function WelcomeStep() {
  const { nextStep } = useOnboardingStore();

  return (
    <div className="text-center space-y-6" data-testid="welcome-step">
      <div
        className="flex justify-center py-4"
        data-testid="welcome-wave-illustration"
      >
        <button
          onClick={nextStep}
          className="transition-transform hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 rounded-lg"
          data-testid="welcome-get-started"
          aria-label="Get Started"
        >
          <Image
            src="/examples/Gemini_Generated_Image_gls67qgls67qgls6.png"
            alt="Welcome to Quiver"
            width={300}
            height={300}
            className="rounded-lg object-cover"
            priority
          />
        </button>
      </div>
    </div>
  );
}
