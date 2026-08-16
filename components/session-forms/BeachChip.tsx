"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import type { BeachSource } from "@/hooks/use-nearest-beach";

interface BeachChipProps {
  beachName: string;
  source: BeachSource;
  confidence: "high" | "low" | null;
  /** Called when user confirms the GPS-detected beach */
  onConfirm: () => void;
  /** Called when user wants to change / search manually */
  onChange: () => void;
  className?: string;
}

/**
 * Compact chip showing auto-detected beach with confirm/change actions.
 * High confidence (URL/home/lastUsed): shows checkmark + "Change" link.
 * Low confidence (GPS): shows "Surfed at X?" with Yes/Change buttons.
 */
export function BeachChip({
  beachName,
  source,
  confidence,
  onConfirm,
  onChange,
  className,
}: BeachChipProps) {
  const reducedMotion = useReducedMotion();
  const [confirmed, setConfirmed] = useState(false);

  const handleConfirm = () => {
    setConfirmed(true);
    onConfirm();
  };

  const entryVariants = reducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8, scale: 0.97 },
        animate: { opacity: 1, y: 0, scale: 1 },
        transition: { duration: 0.35, ease: [0.25, 1, 0.5, 1] as const },
      };

  if (confidence === "low" && !confirmed) {
    // GPS-detected: ask for confirmation
    return (
      <motion.div
        {...entryVariants}
        className={cn(
          "rounded-xl border-2 border-dashed border-[#F78E42]/40 bg-[#354090]/50 p-4",
          className
        )}
      >
        <div className="flex items-center gap-3">
          <motion.div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F78E42]/15"
            animate={reducedMotion ? {} : { rotate: [0, -3, 3, 0] }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <MapPin className="h-5 w-5 text-[#F78E42]" />
          </motion.div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-[#9AABC6]">Surfed at</p>
            <p className="text-base font-bold text-[#F0F0F0] truncate">
              {beachName}?
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 rounded-lg bg-[#F78E42] py-2.5 text-sm font-semibold text-[#11100D] active:scale-[0.96] transition-[background-color,transform] duration-150 hover:bg-[#E07D35] shadow-sm shadow-[#F78E42]/20 focus-ring"
          >
            Yeah
          </button>
          <button
            type="button"
            onClick={onChange}
            className="flex-1 rounded-lg border border-[#404C92] py-2.5 text-sm font-semibold text-[#9AABC6] hover:text-[#F0F0F0] hover:border-[#9AABC6]/40 active:scale-[0.96] transition-[color,border-color,transform] duration-150 focus-ring"
          >
            Nah, different spot
          </button>
        </div>
      </motion.div>
    );
  }

  // High confidence or just confirmed: show confirmed chip
  return (
    <motion.button
      type="button"
      onClick={onChange}
      {...(confirmed && !reducedMotion
        ? {
            initial: { scale: 0.95 },
            animate: { scale: 1 },
            transition: { type: "spring", stiffness: 400, damping: 20 },
          }
        : entryVariants)}
      className={cn(
        "w-full flex items-center gap-3 rounded-xl bg-[#354090]/60 border border-[#404C92] p-4",
        "hover:bg-[#354090]/80 active:scale-[0.98] transition-[background-color,transform] duration-150 group",
        className
      )}
    >
      <motion.div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15"
        {...(confirmed && !reducedMotion
          ? {
              initial: { scale: 0, rotate: -45 },
              animate: { scale: 1, rotate: 0 },
              transition: { type: "spring", stiffness: 500, damping: 15, delay: 0.1 },
            }
          : {})}
      >
        <Check className="h-5 w-5 text-emerald-400" />
      </motion.div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-base font-bold text-[#F0F0F0] truncate">
          {beachName}
        </p>
        <p className="text-xs text-[#9AABC6]">Tap to change</p>
      </div>
      <ChevronDown className="h-4 w-4 text-[#9AABC6] group-hover:text-[#F0F0F0] transition-colors" />
    </motion.button>
  );
}
