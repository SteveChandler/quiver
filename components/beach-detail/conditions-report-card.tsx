"use client";

import { useState, useCallback } from "react";
import { Check } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { submitConditionsReport } from "@/actions/conditions-report-actions";
import {
  WAVE_SIZE_OPTIONS,
  VIBE_OPTIONS,
  type WaveSizeRange,
  type Vibe,
} from "@/types/conditions-report";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { useAuth } from "@/context/auth-context";

interface ConditionsReportCardProps {
  beachId: string;
  beachName: string;
  /** When true the user is not authenticated — show auth modal instead of the form */
  publicMode?: boolean;
  onAuthRequired?: () => void;
  /** Called after a successful submission so the parent can refresh recent reports */
  onSubmitSuccess?: () => void;
  /** Called when the user dismisses/collapses the card */
  onDismiss?: () => void;
  /** Marks a completed report as a response to a visible system prompt. */
  promptSeen?: boolean;
}

type FormState = "idle" | "submitting" | "success" | "already_reported" | "error";

export function ConditionsReportCard({
  beachId,
  beachName,
  publicMode,
  onAuthRequired,
  onSubmitSuccess,
  onDismiss,
  promptSeen = false,
}: ConditionsReportCardProps) {
  const [waveSizeRange, setWaveSizeRange] = useState<WaveSizeRange | null>(null);
  const [vibe, setVibe] = useState<Vibe | null>(null);
  const [note, setNote] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // CTA defense-in-depth: never trust the parent's publicMode alone
  const { user } = useAuth();
  const prefersReducedMotion = useReducedMotion() ?? false;
  const effectivePublicMode = publicMode || !user;

  const handleSubmit = useCallback(async () => {
    if (effectivePublicMode) {
      onAuthRequired?.();
      return;
    }

    if (!waveSizeRange || !vibe) return;

    setFormState("submitting");
    setErrorMessage(null);

    try {
      const result = await submitConditionsReport({
        beachId,
        waveSizeRange,
        vibe,
        note: note.trim() || undefined,
      });

      // makeAuthenticatedAction wraps the result in { success, data }
      // where data is the inner ActionResult
      const inner =
        result &&
        typeof result === "object" &&
        "data" in result &&
        result.data &&
        typeof result.data === "object" &&
        "success" in result.data
          ? (result.data as { success: boolean; error?: string })
          : (result as { success: boolean; error?: string });

      if (!inner.success) {
        if (inner.error === "ALREADY_REPORTED_TODAY") {
          setFormState("already_reported");
        } else {
          setFormState("error");
          setErrorMessage(inner.error ?? "Something went wrong. Please try again.");
        }
        return;
      }

      setFormState("success");
      track("intel_post_created", {
        beach_id: beachId,
        wave_size_range: waveSizeRange,
        vibe,
        source: promptSeen ? "system_card_prompt" : "local_intel",
      });
      onSubmitSuccess?.();
    } catch {
      setFormState("error");
      setErrorMessage("Something went wrong. Please try again.");
    }
  }, [effectivePublicMode, onAuthRequired, beachId, waveSizeRange, vibe, note, onSubmitSuccess, promptSeen]);

  const canSubmit = Boolean(waveSizeRange && vibe);

  // --- Success state ---
  if (formState === "success") {
    return (
      <div
        className="relative overflow-hidden rounded-xl border-2 border-[var(--ink)] bg-[var(--paper)] p-5 text-center text-[var(--ink)] shadow-[4px_4px_0_var(--ink)]"
        data-testid="conditions-report-success"
        aria-live="polite"
      >
        {!prefersReducedMotion && (
          <div className="pointer-events-none absolute inset-0" aria-hidden="true" data-testid="conditions-report-confetti">
            {[
              { x: -42, y: -30, rotate: -20, color: "var(--q-orange)" },
              { x: 38, y: -34, rotate: 18, color: "var(--stamp-blue)" },
              { x: -50, y: 18, rotate: 28, color: "var(--hi-yellow)" },
              { x: 48, y: 20, rotate: -24, color: "var(--q-orange)" },
              { x: -20, y: 42, rotate: 12, color: "var(--stamp-blue)" },
              { x: 20, y: 42, rotate: -12, color: "var(--hi-yellow)" },
            ].map((particle, index) => (
              <motion.span
                key={index}
                className="absolute left-1/2 top-1/2 h-2 w-1 rounded-sm"
                style={{ backgroundColor: particle.color }}
                initial={{ opacity: 0, scale: 0, x: 0, y: 0, rotate: 0 }}
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0, 1, 0.8],
                  x: particle.x,
                  y: particle.y,
                  rotate: particle.rotate,
                }}
                transition={{
                  duration: 0.8,
                  delay: index * 0.04,
                  ease: "easeOut",
                }}
              />
            ))}
          </div>
        )}
        <motion.div
          className="relative mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border-2 border-[var(--ink)] bg-[var(--q-orange)]"
          initial={prefersReducedMotion ? false : { scale: 0.5, rotate: -8 }}
          animate={prefersReducedMotion ? undefined : { scale: 1, rotate: 0 }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 420, damping: 18 }
          }
          aria-hidden="true"
        >
          <Check className="h-6 w-6 stroke-[3] text-[var(--ink)]" />
        </motion.div>
        <p className="relative font-heading text-base font-semibold">
          Report shared! Thanks for helping the {beachName} crew.
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="relative text-[var(--ink)] hover:bg-[var(--paper-shadow)]"
        >
          Close
        </Button>
      </div>
    );
  }

  // --- Already reported state ---
  if (formState === "already_reported") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center space-y-2">
        <p className="text-amber-800 font-semibold text-base">
          You already reported conditions at {beachName} today.
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="text-amber-700 hover:text-amber-800"
        >
          Close
        </Button>
      </div>
    );
  }

  return (
    <div
      data-testid="conditions-report-card"
      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-5"
    >
      <h3 className="font-heading text-lg font-bold text-dark-grey">
        How is it out there?
      </h3>

      {/* Wave size selector */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-600">Waves</p>
        <div className="flex flex-wrap gap-2">
          {WAVE_SIZE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setWaveSizeRange(opt.value)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                waveSizeRange === opt.value
                  ? "border-ocean-blue bg-ocean-blue text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:border-ocean-blue hover:text-ocean-blue"
              ) + " focus-ring"}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Vibe selector */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-600">Vibe</p>
        <div className="flex flex-wrap gap-2">
          {VIBE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setVibe(opt.value)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                vibe === opt.value
                  ? "border-ocean-blue bg-ocean-blue text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:border-ocean-blue hover:text-ocean-blue"
              ) + " focus-ring"}
            >
              {opt.emoji} {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Optional note */}
      <div className="space-y-1">
        <p className="text-sm font-medium text-gray-600">
          Note{" "}
          <span className="font-normal text-gray-400">(optional)</span>
        </p>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={280}
          placeholder="Anything else surfers should know?"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-ocean-blue focus:outline-none focus:ring-1 focus:ring-ocean-blue"
        />
      </div>

      {/* Error message */}
      {formState === "error" && errorMessage && (
        <p className="text-sm text-red-600">{errorMessage}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit || formState === "submitting"}
          className="flex-1 h-11 bg-ocean-blue hover:bg-ocean-blue/90 font-semibold"
        >
          {formState === "submitting" ? "Sharing..." : "Share Report"}
        </Button>
        <Button
          variant="ghost"
          onClick={onDismiss}
          className="text-gray-500 hover:text-gray-700"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
