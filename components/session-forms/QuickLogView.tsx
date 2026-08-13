"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { SessionSlider } from "./SessionSlider";
import { LocationStep } from "./LocationStep";
import { BeachChip } from "./BeachChip";
import { DetailsExpander } from "./DetailsExpander";
import {
  FORECAST_ACCURACY_OPTIONS,
  RECOMMENDATION_CALL_ACCURACY_OPTIONS,
} from "./shared/constants";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";
import type { SessionFormState } from "@/hooks/use-session-form";
import type { BeachSource } from "@/hooks/use-nearest-beach";
import type { Beach } from "@/types/database";
import type { ReactNode } from "react";

/** Rating → short reaction. Chill surf tone, not corporate. */
const RATING_REACTIONS: Record<string, string> = {
  "1": "Tough one out there.",
  "2": "Eh, you still paddled out.",
  "3": "Solid session.",
  "4": "That's what it's about.",
  "5": "You scored.",
};

/** Time-of-day presets for quick selection */
const TIME_PRESETS = [
  { label: "Dawn", value: "06:00", icon: "🌅" },
  { label: "Morning", value: "08:00", icon: "☀️" },
  { label: "Midday", value: "12:00", icon: "🌞" },
  { label: "Afternoon", value: "15:00", icon: "🌤" },
  { label: "Evening", value: "17:00", icon: "🌇" },
] as const;

/** Get the closest time preset to the current hour */
function getDefaultPreset(): string {
  const hour = new Date().getHours();
  if (hour < 7) return "06:00";
  if (hour < 10) return "08:00";
  if (hour < 14) return "12:00";
  if (hour < 16) return "15:00";
  return "17:00";
}

interface QuickLogViewProps {
  formState: SessionFormState;
  updateField: <K extends keyof SessionFormState>(
    field: K,
    value: SessionFormState[K]
  ) => void;
  beaches: Beach[];
  detectedBeach: { id: string; name: string } | null;
  detectedSource: BeachSource;
  detectedConfidence: "high" | "low" | null;
  sessionLogFlowId?: string;
  sessionFitPicker?: ReactNode;
  /** Expanded detail sections rendered by parent */
  detailSections: ReactNode;
}

/**
 * Quick-log: Beach → When → Rating → Forecast check → expandable details.
 * Captures the 4 signals the ML pipeline needs in minimal taps.
 */
export function QuickLogView({
  formState,
  updateField,
  beaches,
  detectedBeach,
  detectedSource,
  detectedConfidence,
  sessionLogFlowId,
  sessionFitPicker,
  detailSections,
}: QuickLogViewProps) {
  const [showManualSearch, setShowManualSearch] = useState(false);
  const reducedMotion = useReducedMotion();

  const reaction = formState.overallRating
    ? RATING_REACTIONS[formState.overallRating] ?? null
    : null;

  const sectionVariants = useMemo(
    () =>
      reducedMotion
        ? { hidden: {}, visible: {} }
        : { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } },
    [reducedMotion]
  );

  const stagger = reducedMotion
    ? {}
    : { transition: { staggerChildren: 0.1 } };

  const renderBeachSection = () => {
    if (showManualSearch || !detectedBeach) {
      return (
        <LocationStep
          formState={formState}
          beaches={beaches}
          mode="log"
          sessionLogFlowId={sessionLogFlowId}
          updateField={updateField}
        />
      );
    }
    return (
      <BeachChip
        beachName={detectedBeach.name}
        source={detectedSource}
        confidence={detectedConfidence}
        onConfirm={() => {
          updateField("selectedBeach", detectedBeach.name);
          updateField("selectedBeachId", detectedBeach.id);
        }}
        onChange={() => setShowManualSearch(true)}
      />
    );
  };

  return (
    <motion.div
      className="space-y-5"
      initial="hidden"
      animate="visible"
      {...stagger}
    >
      {/* 1. Beach */}
      <motion.section className="space-y-2" variants={sectionVariants}>
        <h2 className="text-xs font-bold text-[#9AABC6] uppercase tracking-wider">
          Where
        </h2>
        {renderBeachSection()}
      </motion.section>

      <hr className="border-[#404C92]/60" />

      {/* 2. When — compact time chips */}
      <motion.section className="space-y-2" variants={sectionVariants}>
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold text-[#9AABC6] uppercase tracking-wider">
            When
          </h2>
          <span className="text-xs text-[#9AABC6]/60">
            {formState.selectedDate === new Date().toISOString().split("T")[0]
              ? "Today"
              : formState.selectedDate}
          </span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {TIME_PRESETS.map((preset) => {
            const isSelected = formState.selectedTime === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => updateField("selectedTime", preset.value)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,transform] duration-150",
                  "active:scale-[0.96]",
                  isSelected
                    ? "bg-[#F78E42]/15 text-[#F78E42] border border-[#F78E42]/30"
                    : "bg-[#354090]/40 text-[#9AABC6] border border-[#404C92]/50 hover:text-[#F0F0F0]"
                ) + " focus-ring"}
              >
                <span className="text-xs">{preset.icon}</span>
                {preset.label}
              </button>
            );
          })}
        </div>
      </motion.section>

      <hr className="border-[#404C92]/60" />

      {/* 3. Rating */}
      <motion.section className="space-y-2" variants={sectionVariants}>
        <h2 className="text-xs font-bold text-[#9AABC6] uppercase tracking-wider">
          How was it
        </h2>
        <SessionSlider
          label="Overall"
          labels={["Rough", "Meh", "Fun", "Great", "Epic"]}
          colors={["#9CA3AF", "#F59E0B", "#EA580C"]}
          value={formState.overallRating}
          onChange={(v) => updateField("overallRating", v)}
          hero
        />
        {reaction && (
          <motion.p
            key={formState.overallRating}
            initial={reducedMotion ? {} : { opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="text-sm text-[#9AABC6] italic pl-1"
          >
            {reaction}
          </motion.p>
        )}
        {sessionFitPicker}
      </motion.section>

      <hr className="border-[#404C92]/60" />

      {/* 4. Forecast/call check — core ML signal */}
      <motion.section className="space-y-2" variants={sectionVariants}>
        <h2 className="text-xs font-bold text-[#9AABC6] uppercase tracking-wider">
          {formState.recommendationId ? "Was this call right?" : "Was our forecast right?"}
        </h2>
        <div
          className={cn(
            "grid gap-2",
            formState.recommendationId ? "grid-cols-2" : "grid-cols-3"
          )}
        >
          {(formState.recommendationId
            ? RECOMMENDATION_CALL_ACCURACY_OPTIONS
            : FORECAST_ACCURACY_OPTIONS
          ).map((option) => {
            const isSelected = formState.recommendationId
              ? formState.recommendationCallAccuracy === option.value
              : formState.forecastAccuracy === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  if (formState.recommendationId) {
                    updateField(
                      "recommendationCallAccuracy",
                      option.value as "right" | "partly" | "wrong" | "not_sure"
                    );
                    return;
                  }

                  updateField(
                    "forecastAccuracy",
                    option.value as "accurate" | "somewhat" | "inaccurate"
                  );
                }}
                className={cn(
                  "py-3 rounded-lg border text-center transition-[color,background-color,border-color,transform] duration-150",
                  "active:scale-[0.96]",
                  isSelected
                    ? "border-[#F78E42] bg-[#F78E42]/10"
                    : "border-[#404C92]/60 bg-[#354090]/30 hover:bg-[#354090]/50"
                ) + " focus-ring"}
              >
                <span
                  className={cn(
                    "text-sm font-semibold",
                    isSelected ? "text-[#F78E42]" : "text-[#F0F0F0]"
                  )}
                >
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      </motion.section>

      <hr className="border-[#404C92]/60" />

      {/* 5. Expandable details */}
      <motion.div variants={sectionVariants}>
        <DetailsExpander summary="Photos, board, notes, conditions...">
          {detailSections}
        </DetailsExpander>
      </motion.div>
    </motion.div>
  );
}
