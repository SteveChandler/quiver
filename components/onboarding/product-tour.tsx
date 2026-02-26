"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Onborda,
  OnbordaProvider,
  useOnborda,
  Step,
  CardComponentProps,
} from "onborda";

// Tour type is not exported from main index, define it locally
interface Tour {
  tour: string;
  steps: Step[];
}
import { useOnboardingStore } from "@/store/onboarding-store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { track } from "@/lib/analytics";
import { useAuth } from "@/context/auth-context";

const TOUR_STEPS: Step[] = [
  {
    icon: "🗺️",
    title: "Interactive Forecast Map",
    content:
      "Explore surf conditions at beaches near you. Tap any marker to see detailed forecasts.",
    selector: "#forecast-map",
    side: "bottom",
    showControls: true,
    pointerPadding: 10,
    pointerRadius: 8,
  },
  {
    icon: "🏠",
    title: "Your Home Beach",
    content:
      "Quick access to your home beach forecast. Update this anytime from your profile.",
    selector: "#home-beach-widget",
    side: "bottom",
    showControls: true,
  },
  {
    icon: "⭐",
    title: "XP & Achievements",
    content:
      "Track your surf sessions and unlock achievements. You just earned +100 XP for completing onboarding!",
    selector: "#gamification-widget",
    side: "left",
    showControls: true,
  },
  {
    icon: "📱",
    title: "Session Feed",
    content:
      "See what the community is surfing. Share your own sessions and photos.",
    selector: "#session-feed",
    side: "top",
    showControls: true,
  },
  {
    icon: "➕",
    title: "Log Your First Session",
    content:
      "Ready to track your surf? Tap here to log your first session and earn more XP!",
    selector: "#create-session-button",
    side: "left",
    showControls: true,
  },
];

const TOURS: Tour[] = [
  {
    tour: "main-product-tour",
    steps: TOUR_STEPS,
  },
];

function TourCard({
  step,
  currentStep,
  totalSteps,
  nextStep,
  prevStep,
  arrow,
}: CardComponentProps) {
  const onborda = useOnborda();

  const close = () => {
    onborda.closeOnborda();
  };

  useEffect(() => {
    track("product_tour_step_viewed", {
      step: currentStep + 1,
      step_title: step.title,
      total_steps: totalSteps,
    });
  }, [currentStep, step.title, totalSteps]);

  return (
    <Card className="max-w-sm shadow-xl">
      <CardContent className="p-6 space-y-4">
        {/* Header with icon and close button */}
        <div className="flex items-start justify-between">
          <span className="text-4xl" role="img" aria-label="step icon">
            {step.icon}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={close}
            className="h-8 w-8 p-0 -mt-2 -mr-2"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div>
          <h3 className="text-xl font-bold mb-2">{step.title}</h3>
          <p className="text-gray-600 text-sm">{step.content}</p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center gap-2">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= currentStep ? "bg-ocean-blue" : "bg-gray-200"
              }`}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="flex gap-3">
          {currentStep > 0 && (
            <Button variant="outline" onClick={prevStep} className="flex-1">
              Previous
            </Button>
          )}
          <Button
            onClick={currentStep === totalSteps - 1 ? close : nextStep}
            className="flex-1 bg-ocean-blue hover:bg-ocean-blue/90"
          >
            {currentStep === totalSteps - 1 ? "Finish Tour" : "Next"}
          </Button>
        </div>

        {/* Step counter */}
        <p className="text-xs text-center text-gray-500">
          Step {currentStep + 1} of {totalSteps}
        </p>
      </CardContent>

      {/* Arrow pointing to element */}
      {arrow}
    </Card>
  );
}

function ProductTourContent() {
  const onborda = useOnborda();
  const { isCompleted } = useOnboardingStore();
  const [tourStartTime, setTourStartTime] = useState<number>(0);
  const pathname = usePathname();
  const { user } = useAuth();

  useEffect(() => {
    // Listen for onboarding completion event
    const handleOnboardingComplete = () => {
      const tourCompleted = localStorage.getItem("product_tour_completed");

      if (!tourCompleted) {
        // Delay to let modal close
        setTimeout(() => {
          setTourStartTime(Date.now());
          track("product_tour_started", {
            tour_id: "main-product-tour",
            timestamp: Date.now(),
          });
          onborda.startOnborda("main-product-tour");
        }, 500);
      }
    };

    window.addEventListener("onboarding_completed", handleOnboardingComplete);

    return () => {
      window.removeEventListener(
        "onboarding_completed",
        handleOnboardingComplete
      );
    };
  }, [onborda, pathname, user?.id]);

  // Close tour when user logs out (prevents tour overlay on landing page)
  useEffect(() => {
    if (!user && onborda.isOnbordaVisible) {
      onborda.closeOnborda();
    }
  }, [user, onborda, pathname]);

  useEffect(() => {
    // Track tour completion when it closes
    if (!onborda.isOnbordaVisible && tourStartTime > 0) {
      const timeSpent = Math.round((Date.now() - tourStartTime) / 1000);

      if (onborda.currentStep === TOUR_STEPS.length - 1) {
        // Completed
        track("product_tour_completed", {
          timestamp: Date.now(),
          time_spent_seconds: timeSpent,
        });
        localStorage.setItem("product_tour_completed", "true");
      } else {
        // Skipped
        track("product_tour_skipped", {
          at_step: onborda.currentStep + 1,
          timestamp: Date.now(),
        });
        localStorage.setItem("product_tour_completed", "skipped");
      }

      setTourStartTime(0);
    }
  }, [onborda.isOnbordaVisible, onborda.currentStep, tourStartTime]);

  return null;
}

export function ProductTour() {
  return (
    <OnbordaProvider>
      <Onborda
        steps={TOURS}
        shadowRgb="0, 0, 0"
        shadowOpacity="0.6"
        cardComponent={TourCard}
      >
        <ProductTourContent />
      </Onborda>
    </OnbordaProvider>
  );
}
