"use client";

import { useState, useCallback, useEffect } from "react";
import { X, Sparkles, ArrowRight, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import type { PersonalizationStatus } from "@/actions/personalization-actions";
import type { PersonalizationStage } from "@/lib/utils/personalization-messaging";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DISMISS_KEY = "personalization_progress_dismissed";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SESSIONS_FOR_PERSONALIZED = 5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDismissedAt(): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return null;
  const ts = Number(raw);
  return Number.isFinite(ts) ? ts : null;
}

function isDismissed(): boolean {
  const dismissedAt = getDismissedAt();
  if (dismissedAt === null) return false;
  return Date.now() - dismissedAt < DISMISS_DURATION_MS;
}

function deriveStage(status: PersonalizationStatus): PersonalizationStage {
  if (status.sessionCount === 0) return "getting_started";
  if (status.sessionCount < SESSIONS_FOR_PERSONALIZED || !status.hasLearnedPrefs)
    return "learning";
  return "personalized";
}

function shouldAutoHide(status: PersonalizationStatus): boolean {
  return status.activeLayers >= 3 && status.learnedConfidence > 0.8;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PersonalizationProgressProps {
  status: PersonalizationStatus | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * PersonalizationProgress is a gradient card that shows the user how far
 * along they are in the personalization journey. It renders between
 * TopSpotsCarousel and ForecastOutlookCard on the home screen.
 *
 * Three visual states:
 * - Getting Started (0 sessions)
 * - Learning (1-4 sessions)
 * - Personalized (5+ sessions with learned prefs)
 *
 * Auto-hides when activeLayers >= 3 and learnedConfidence > 0.8.
 * Dismissible via X button (7-day localStorage cooldown).
 */
export function PersonalizationProgress({
  status,
}: PersonalizationProgressProps) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [dismissed, setDismissed] = useState(true); // default hidden to prevent flash

  // Hydrate dismissed state from localStorage
  useEffect(() => {
    setDismissed(isDismissed());
  }, []);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  }, []);

  // Guard: no data, dismissed, or auto-hide
  if (!status) return null;
  if (dismissed) return null;
  if (shouldAutoHide(status)) return null;

  const stage = deriveStage(status);

  // Determine headline, body, and CTA per state
  let headline: string;
  let body: string;
  let ctaLabel: string;
  let ctaHref: string;
  let showIntelPrompt = false;

  switch (stage) {
    case "getting_started":
      headline = "Your forecasts are getting smarter";
      body =
        "Onboarding prefs are active. Log a session or post intel to start training the algorithm.";
      ctaLabel = "Log a Session";
      ctaHref = "/sessions/new?mode=log";
      showIntelPrompt = status.intelPostCount === 0;
      break;
    case "learning": {
      const remaining = SESSIONS_FOR_PERSONALIZED - status.sessionCount;
      headline = "Learning your patterns";
      body = `${status.sessionCount} session${status.sessionCount !== 1 ? "s" : ""} analyzed. ${remaining} more unlock${remaining !== 1 ? "" : "s"} wave & wind preferences from your history.`;
      ctaLabel = "Log a Session";
      ctaHref = "/sessions/new?mode=log";
      showIntelPrompt =
        status.sessionCount < 3 && status.intelPostCount === 0;
      break;
    }
    case "personalized": {
      const rangeText = status.learnedWaveRange
        ? `${status.learnedWaveRange.min}-${status.learnedWaveRange.max}ft`
        : "your preferred range";
      headline = "Forecasts tuned to you";
      body = `Your wave range (${rangeText}) and conditions are factored into every recommendation.`;
      ctaLabel = "View Preferences";
      ctaHref = "/profile?tab=preferences";
      break;
    }
  }

  // Progress percentage (simple: sessionCount capped at SESSIONS_FOR_PERSONALIZED)
  const progressPercent = Math.min(
    (status.sessionCount / SESSIONS_FOR_PERSONALIZED) * 100,
    100
  );

  // Stage icon
  const StageIcon =
    stage === "personalized" ? TrendingUp : Sparkles;

  return (
    <AnimatePresence>
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.3 }}
        className="relative overflow-hidden rounded-2xl border border-blue-200/30 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-5 shadow-sm"
        data-testid="personalization-progress"
      >
        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-white/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          aria-label="Dismiss personalization progress"
          data-testid="personalization-progress-dismiss"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 mb-2 pr-8">
          <StageIcon className="h-5 w-5 text-blue-600 shrink-0" />
          <h3 className="text-sm font-semibold text-slate-900">{headline}</h3>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-slate-200/60 rounded-full mb-3 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={
              reducedMotion
                ? { duration: 0 }
                : { duration: 0.6, ease: "easeOut" }
            }
          />
        </div>

        {/* Body */}
        <p className="text-sm text-slate-600 leading-relaxed mb-4">{body}</p>

        {/* Intel prompt (conditional) */}
        {showIntelPrompt && (
          <p className="text-xs text-slate-500 mb-3">
            Or{" "}
            <Link
              href="/map"
              className="text-blue-600 hover:text-blue-700 underline underline-offset-2"
            >
              post live conditions
            </Link>{" "}
            to help your local lineup.
          </p>
        )}

        {/* CTA */}
        <button
          onClick={() => router.push(ctaHref)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
          data-testid="personalization-progress-cta"
        >
          {ctaLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
