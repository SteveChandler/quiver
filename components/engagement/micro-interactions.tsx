"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import {
  Eye,
  MousePointer2,
  Sparkles,
  TrendingUp,
  Users,
  MapPin,
  Clock,
  Star,
} from "lucide-react";

// Engagement tracking for analytics
interface EngagementTracker {
  interactions: number;
  timeOnPage: number;
  elementsViewed: Set<string>;
  lastInteraction: number;
}

// Floating interaction hint
export function FloatingInteractionHint({
  target,
  hint,
  delay = 3000,
}: {
  target: string;
  hint: string;
  delay?: number;
}) {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissed) return;

    const timer = setTimeout(() => {
      setShow(true);
    }, delay);

    const dismissTimer = setTimeout(() => {
      setShow(false);
    }, delay + 5000);

    return () => {
      clearTimeout(timer);
      clearTimeout(dismissTimer);
    };
  }, [delay, dismissed]);

  const handleDismiss = () => {
    setDismissed(true);
    setShow(false);
  };

  if (!show || dismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: -10 }}
      className="fixed z-40 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg pointer-events-auto"
      style={{
        bottom: "100px",
        right: "20px",
        maxWidth: "250px",
      }}
    >
      <div className="flex items-start gap-2">
        <MousePointer2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium">{hint}</p>
          <button
            onClick={handleDismiss}
            className="text-xs text-blue-200 hover:text-white mt-1"
          >
            Got it!
          </button>
        </div>
      </div>
      {/* Pointer */}
      <div className="absolute -bottom-2 right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-blue-600" />
    </motion.div>
  );
}

// Interactive element that encourages exploration
export function InteractiveExplorePrompt({
  children,
  promptText = "Click to explore",
  onInteraction,
}: {
  children: React.ReactNode;
  promptText?: string;
  onInteraction?: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  const handleClick = () => {
    if (!hasInteracted) {
      setHasInteracted(true);
      onInteraction?.();
    }
  };

  return (
    <motion.div
      ref={ref}
      className="relative cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {children}

      {/* Interactive prompt */}
      <AnimatePresence>
        {inView && !hasInteracted && isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-3 py-1 rounded-md text-sm font-medium whitespace-nowrap z-10"
          >
            {promptText}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sparkle animation for uninteracted elements */}
      <AnimatePresence>
        {inView && !hasInteracted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatDelay: 3,
            }}
            className="absolute top-2 right-2 pointer-events-none"
          >
            <Sparkles className="h-4 w-4 text-yellow-400" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Engagement stats that animate when in view
export function AnimatedEngagementStat({
  icon: Icon,
  value,
  label,
  delay = 0,
}: {
  icon: React.ElementType;
  value: number;
  label: string;
  delay?: number;
}) {
  const [animatedValue, setAnimatedValue] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (inView) {
      const timer = setTimeout(() => {
        const duration = 1000;
        const steps = 30;
        const increment = value / steps;
        let current = 0;

        const interval = setInterval(() => {
          current += increment;
          if (current >= value) {
            setAnimatedValue(value);
            clearInterval(interval);
          } else {
            setAnimatedValue(Math.floor(current));
          }
        }, duration / steps);

        return () => clearInterval(interval);
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [inView, value, delay]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: delay / 1000 }}
      className="text-center"
    >
      <motion.div
        animate={inView ? { rotate: [0, 10, -10, 0] } : {}}
        transition={{ delay: delay / 1000 + 0.5, duration: 0.6 }}
        className="inline-block mb-2"
      >
        <Icon className="h-8 w-8 text-blue-600 mx-auto" />
      </motion.div>
      <motion.div
        className="text-3xl font-bold text-gray-900 mb-1"
        key={animatedValue}
        initial={{ scale: 1 }}
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 0.2 }}
      >
        {animatedValue.toLocaleString()}
      </motion.div>
      <p className="text-sm text-gray-600">{label}</p>
    </motion.div>
  );
}

// Progress indicator that encourages completion
export function EngagementProgressTracker() {
  const [progress, setProgress] = useState(0);
  const [milestones] = useState([
    { value: 25, label: "Getting started", icon: Eye },
    { value: 50, label: "Exploring features", icon: MousePointer2 },
    { value: 75, label: "Almost there", icon: TrendingUp },
    { value: 100, label: "Surf expert!", icon: Star },
  ]);

  useEffect(() => {
    // Only run on client-side to avoid SSR issues
    if (typeof window === "undefined") return;

    // Simulate progress based on interactions and time
    const updateProgress = () => {
      const timeBonus = Math.min(((Date.now() - startTime) / 60000) * 20, 40); // 40% max for time
      const interactionBonus = Math.min(interactions * 15, 60); // 60% max for interactions
      setProgress(Math.min(timeBonus + interactionBonus, 100));
    };

    const startTime = Date.now();
    let interactions = 0;

    const handleInteraction = () => {
      interactions++;
      updateProgress();
    };

    // Listen for various interaction events
    document.addEventListener("click", handleInteraction);
    document.addEventListener("keydown", handleInteraction);
    document.addEventListener("scroll", handleInteraction);

    const interval = setInterval(updateProgress, 2000);

    return () => {
      document.removeEventListener("click", handleInteraction);
      document.removeEventListener("keydown", handleInteraction);
      document.removeEventListener("scroll", handleInteraction);
      clearInterval(interval);
    };
  }, []);

  const currentMilestone =
    milestones.find((m) => progress < m.value) ||
    milestones[milestones.length - 1];

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: progress > 5 ? 1 : 0, x: progress > 5 ? 0 : 100 }}
      className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 border border-gray-200 z-30 max-w-xs"
      data-testid="engagement-tracker"
    >
      <div className="flex items-center gap-3 mb-3">
        <currentMilestone.icon className="h-5 w-5 text-blue-600" />
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900">
            {currentMilestone.label}
          </p>
          <p className="text-xs text-gray-600">
            {Math.round(progress)}% complete
          </p>
        </div>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2">
        <motion.div
          className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-full h-2"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>

      {progress === 100 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="mt-2 text-center"
        >
          <p className="text-sm font-medium text-green-600">🎉 You're a pro!</p>
        </motion.div>
      )}
    </motion.div>
  );
}

// Engagement metrics hook for analytics
export function useEngagementTracking() {
  const [engagement, setEngagement] = useState<EngagementTracker>({
    interactions: 0,
    timeOnPage: 0,
    elementsViewed: new Set(),
    lastInteraction: Date.now(),
  });

  useEffect(() => {
    // Only run on client-side to avoid SSR issues
    if (typeof window === "undefined") return;

    const startTime = Date.now();

    const updateEngagement = () => {
      setEngagement((prev) => ({
        ...prev,
        timeOnPage: Date.now() - startTime,
      }));
    };

    const handleInteraction = () => {
      setEngagement((prev) => ({
        ...prev,
        interactions: prev.interactions + 1,
        lastInteraction: Date.now(),
      }));
    };

    // Track various engagement events
    document.addEventListener("click", handleInteraction);
    document.addEventListener("keydown", handleInteraction);
    document.addEventListener("scroll", handleInteraction);

    const interval = setInterval(updateEngagement, 1000);

    return () => {
      document.removeEventListener("click", handleInteraction);
      document.removeEventListener("keydown", handleInteraction);
      document.removeEventListener("scroll", handleInteraction);
      clearInterval(interval);
    };
  }, []);

  return engagement;
}
