"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ArrowLeft,
  MapPin,
  Users,
  Camera,
  TrendingUp,
  CheckCircle2,
  Sparkles,
  Waves,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ENHANCED_ANIMATIONS, QUIVER_MOTION } from "@/lib/constants/animations";
import {
  useReducedMotion,
  getMotionVariants,
} from "@/hooks/use-reduced-motion";
import { useRouter } from "next/navigation";

const ONBOARDING_STEPS = [
  {
    id: "welcome",
    title: "Welcome to your surf community! 🏄‍♂️",
    description:
      "Let's get you set up to find epic waves and amazing surf buddies",
    icon: Sparkles,
    color: "from-blue-500 to-cyan-500",
    action: "Get Started",
  },
  {
    id: "location",
    title: "Find surf spots near you 📍",
    description:
      "We'll show you the best local breaks and real-time conditions",
    icon: MapPin,
    color: "from-green-500 to-teal-500",
    action: "Set Location",
  },
  {
    id: "community",
    title: "Connect with local surfers 🤙",
    description: "Join sessions, share spots, and build your surf crew",
    icon: Users,
    color: "from-purple-500 to-pink-500",
    action: "Find Crew",
  },
  {
    id: "sessions",
    title: "Track your epic sessions 📸",
    description: "Log waves, share photos, and build your surf story",
    icon: Camera,
    color: "from-orange-500 to-red-500",
    action: "Log Session",
  },
  {
    id: "ready",
    title: "You're ready to surf! 🌊",
    description: "Everything is set up. Time to find some waves!",
    icon: Waves,
    color: "from-blue-600 to-purple-600",
    action: "Start Surfing",
  },
];

interface OnboardingFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function OnboardingFlow({
  isOpen,
  onClose,
  onComplete,
}: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isAnimating, setIsAnimating] = useState(false);
  const reducedMotion = useReducedMotion();
  const router = useRouter();

  const currentStepData = ONBOARDING_STEPS[currentStep];

  const handleNext = () => {
    if (isAnimating) return;

    setIsAnimating(true);
    setCompletedSteps((prev) => new Set(prev).add(currentStep));

    if (currentStep === ONBOARDING_STEPS.length - 1) {
      // Complete onboarding
      setTimeout(() => {
        onComplete();
        router.push("/sessions");
      }, 1000);
    } else {
      setTimeout(() => {
        setCurrentStep((prev) => prev + 1);
        setIsAnimating(false);
      }, 400);
    }
  };

  const handlePrevious = () => {
    if (isAnimating || currentStep === 0) return;
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep((prev) => prev - 1);
      setIsAnimating(false);
    }, 300);
  };

  const handleSkip = () => {
    onComplete();
    router.push("/sessions");
  };

  // Reset when opened
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      setCompletedSteps(new Set());
      setIsAnimating(false);
    }
  }, [isOpen]);

  // Get motion variants with reduced motion support
  const motionVariants = getMotionVariants(
    {
      initial: { scale: 0.9, opacity: 0 },
      animate: { scale: 1, opacity: 1 },
      exit: { scale: 0.9, opacity: 0 },
    },
    reducedMotion
      ? {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
        }
      : undefined
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="w-full max-w-lg p-0 overflow-hidden"
        aria-describedby={`onboarding-step-${currentStep}`}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>
            Onboarding Flow - Step {currentStep + 1} of{" "}
            {ONBOARDING_STEPS.length}
          </DialogTitle>
        </DialogHeader>
        <motion.div
          {...motionVariants}
          className="bg-white rounded-lg"
          data-testid="onboarding-modal"
        >
          {/* Progress Bar */}
          <div className="relative h-2 bg-gray-100">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-600"
              initial={{ width: 0 }}
              animate={{
                width: `${
                  ((currentStep + 1) / ONBOARDING_STEPS.length) * 100
                }%`,
              }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>

          {/* Step Content */}
          <div className="p-8">
            {/* Step Counter */}
            <div className="flex items-center justify-between mb-6">
              <span className="text-sm font-medium text-gray-500">
                Step {currentStep + 1} of {ONBOARDING_STEPS.length}
              </span>
              <button
                onClick={handleSkip}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Skip tour
              </button>
            </div>

            {/* Step Icon & Content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="text-center mb-8"
              >
                {/* Animated Icon */}
                <motion.div
                  className={`w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br ${currentStepData.color} flex items-center justify-center shadow-lg`}
                  initial={{ scale: 0.8 }}
                  animate={{
                    scale: [0.8, 1.1, 1],
                    rotate: [0, 5, -5, 0],
                  }}
                  transition={{
                    scale: { duration: 0.6, ease: "easeOut" },
                    rotate: { duration: 1, delay: 0.2 },
                  }}
                >
                  <currentStepData.icon className="h-10 w-10 text-white" />
                </motion.div>

                {/* Title */}
                <motion.h2
                  className="text-2xl font-bold text-gray-900 mb-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  {currentStepData.title}
                </motion.h2>

                {/* Description */}
                <motion.p
                  className="text-gray-600 text-lg leading-relaxed"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  {currentStepData.description}
                </motion.p>

                {/* Completion indicator for completed steps */}
                {completedSteps.has(currentStep) && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex items-center justify-center gap-2 mt-4 text-green-600"
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="text-sm font-medium">Complete!</span>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={handlePrevious}
                disabled={currentStep === 0 || isAnimating}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Previous
              </Button>

              <div className="flex items-center gap-2">
                {ONBOARDING_STEPS.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      index <= currentStep ? "bg-blue-500" : "bg-gray-200"
                    }`}
                  />
                ))}
              </div>

              <Button
                onClick={handleNext}
                disabled={isAnimating}
                className={`motion-optimized like-button-spring ripple-effect flex items-center gap-2 px-6 py-3 font-semibold rounded-full transition-all duration-300 ${
                  currentStep === ONBOARDING_STEPS.length - 1
                    ? "bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600"
                    : "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                }`}
                data-testid="onboarding-next"
              >
                {currentStepData.action}
                <ArrowRight
                  className={`h-4 w-4 transition-transform ${
                    isAnimating ? "translate-x-1" : ""
                  }`}
                />
              </Button>
            </div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

// Onboarding trigger hook
export function useOnboardingFlow() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  useEffect(() => {
    // Only run on client-side to avoid SSR issues
    if (typeof window === "undefined") return;

    // Check if user has completed onboarding
    const completed = localStorage.getItem("quiver-onboarding-completed");
    setHasCompletedOnboarding(!!completed);

    // Show onboarding for new users
    if (!completed) {
      const timer = setTimeout(() => {
        setShowOnboarding(true);
      }, 2000); // Show after 2 seconds
      return () => clearTimeout(timer);
    }
  }, []);

  const completeOnboarding = () => {
    // Only run on client-side to avoid SSR issues
    if (typeof window !== "undefined") {
      localStorage.setItem("quiver-onboarding-completed", "true");
    }
    setHasCompletedOnboarding(true);
    setShowOnboarding(false);
  };

  const startOnboarding = () => {
    setShowOnboarding(true);
  };

  return {
    showOnboarding,
    hasCompletedOnboarding,
    completeOnboarding,
    startOnboarding,
    closeOnboarding: () => setShowOnboarding(false),
  };
}
