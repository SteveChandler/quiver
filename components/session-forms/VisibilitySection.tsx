"use client";

import React from "react";
import { Eye, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

interface VisibilitySectionProps {
  isPublic: boolean;
  isMuted: boolean;
  onPublicChange: (isPublic: boolean) => void;
  onMutedChange: (isMuted: boolean) => void;
}

export function VisibilitySection({
  isPublic,
  isMuted,
  onPublicChange,
  onMutedChange,
}: VisibilitySectionProps) {
  const prefersReducedMotion = useReducedMotion() ?? false;

  return (
    <div className="space-y-4">
      {/* Segmented control */}
      <div className="flex rounded-xl bg-[#354090] p-1">
        <button
          type="button"
          aria-label="Public"
          data-active={isPublic ? "true" : "false"}
          onClick={() => onPublicChange(true)}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-[color,background-color,box-shadow]",
            isPublic
              ? "bg-[#404C92] text-[#F0F0F0] shadow-sm"
              : "text-[#8B9EC2] hover:text-[#F0F0F0]"
          ) + " focus-ring"}
        >
          <Eye className="h-4 w-4" />
          Public
        </button>
        <button
          type="button"
          aria-label="Just me"
          data-active={!isPublic ? "true" : "false"}
          onClick={() => {
            onPublicChange(false);
            onMutedChange(false); // Reset muted when going private
          }}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-[color,background-color,box-shadow]",
            !isPublic
              ? "bg-[#404C92] text-[#F0F0F0] shadow-sm"
              : "text-[#8B9EC2] hover:text-[#F0F0F0]"
          ) + " focus-ring"}
        >
          <Lock className="h-4 w-4" />
          Just me
        </button>
      </div>

      {/* Mute checkbox (only when public) */}
      <AnimatePresence>
        {isPublic && (
          <motion.div
            initial={
              prefersReducedMotion
                ? false
                : { gridTemplateRows: "0fr", opacity: 0 }
            }
            animate={
              prefersReducedMotion
                ? undefined
                : { gridTemplateRows: "1fr", opacity: 1 }
            }
            exit={
              prefersReducedMotion
                ? undefined
                : { gridTemplateRows: "0fr", opacity: 0 }
            }
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2 }}
            className="grid"
          >
            <div className="overflow-hidden">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isMuted}
                  onChange={(e) => onMutedChange(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-[#404C92] text-[#F78E42] focus:ring-[#F78E42]"
                />
                <div>
                  <span className="text-sm font-medium text-[#F0F0F0]">
                    Keep it off the feed
                  </span>
                  <p className="text-xs text-[#9AABC6]">
                    Public on your profile, but won&apos;t show up in others&apos; feeds
                  </p>
                </div>
              </label>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Privacy note */}
      <AnimatePresence>
        {!isPublic && (
          <motion.div
            initial={
              prefersReducedMotion
                ? false
                : { gridTemplateRows: "0fr", opacity: 0 }
            }
            animate={
              prefersReducedMotion
                ? undefined
                : { gridTemplateRows: "1fr", opacity: 1 }
            }
            exit={
              prefersReducedMotion
                ? undefined
                : { gridTemplateRows: "0fr", opacity: 0 }
            }
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2 }}
            className="grid"
          >
            <div className="overflow-hidden">
              <p className="text-xs text-[#9AABC6]">
                Private sessions still help improve forecast accuracy
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
