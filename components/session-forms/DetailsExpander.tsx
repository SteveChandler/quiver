"use client";

import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface DetailsExpanderProps {
  children: ReactNode;
  /** Summary text shown when collapsed */
  summary?: string;
  className?: string;
  /** Called when expanded for the first time */
  onExpand?: () => void;
}

/**
 * Collapsible section that reveals additional form fields.
 * Tracks `quick_log_expanded` on first open.
 */
export function DetailsExpander({
  children,
  summary = "Board, photos, conditions...",
  className,
  onExpand,
}: DetailsExpanderProps) {
  const [expanded, setExpanded] = useState(false);
  const [hasExpanded, setHasExpanded] = useState(false);
  const reducedMotion = useReducedMotion();

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);

    if (next && !hasExpanded) {
      setHasExpanded(true);
      try {
        track("quick_log_expanded", {});
      } catch {}
      onExpand?.();
    }
  };

  return (
    <div className={cn("space-y-0", className)}>
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          "w-full flex items-center justify-between py-3 px-3 -mx-3 rounded-lg text-left group",
          "hover:bg-[#354090]/30 active:bg-[#354090]/50 transition-colors duration-150"
        ) + " focus-ring"}
      >
        <div className="flex items-center gap-2">
          {!expanded && (
            <Sparkles className="h-3.5 w-3.5 text-[#F78E42]/60" />
          )}
          <div>
            <span className="text-sm font-semibold text-[#F78E42]">
              {expanded ? "Less details" : "Add more details"}
            </span>
            {!expanded && (
              <span className="block text-xs text-[#9AABC6] mt-0.5">
                {summary}
              </span>
            )}
          </div>
        </div>
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={
            reducedMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 300, damping: 20 }
          }
        >
          <ChevronDown className="h-4 w-4 text-[#F78E42]" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="details"
            initial={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reducedMotion ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={
              reducedMotion
                ? { duration: 0.15 }
                : {
                    height: { type: "spring", stiffness: 200, damping: 24 },
                    opacity: { duration: 0.25, delay: 0.05 },
                  }
            }
            className="overflow-hidden"
          >
            <div className="space-y-6 pt-3 border-t border-[#404C92]/50 mt-1">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
