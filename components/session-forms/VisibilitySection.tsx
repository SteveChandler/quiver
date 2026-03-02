"use client";

import React from "react";
import { Eye, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";

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
  return (
    <div className="space-y-4">
      {/* Segmented control */}
      <div className="flex rounded-xl bg-gray-100 p-1">
        <button
          type="button"
          aria-label="Public"
          data-active={isPublic ? "true" : "false"}
          onClick={() => onPublicChange(true)}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all",
            isPublic
              ? "bg-white text-[#1A1A1A] shadow-sm"
              : "text-[#6B7280] hover:text-[#1A1A1A]"
          )}
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
            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all",
            !isPublic
              ? "bg-white text-[#1A1A1A] shadow-sm"
              : "text-[#6B7280] hover:text-[#1A1A1A]"
          )}
        >
          <Lock className="h-4 w-4" />
          Just me
        </button>
      </div>

      {/* Mute checkbox (only when public) */}
      <AnimatePresence>
        {isPublic && (
          <motion.label
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex items-start gap-3 cursor-pointer overflow-hidden"
          >
            <input
              type="checkbox"
              checked={isMuted}
              onChange={(e) => onMutedChange(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
            />
            <div>
              <span className="text-sm font-medium text-[#1A1A1A]">
                Keep it off the feed
              </span>
              <p className="text-xs text-[#6B7280]">
                Public on your profile, but won't show up in others' feeds
              </p>
            </div>
          </motion.label>
        )}
      </AnimatePresence>

      {/* Privacy note */}
      <AnimatePresence>
        {!isPublic && (
          <motion.p
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="text-xs text-[#6B7280] overflow-hidden"
          >
            Private sessions still help improve forecast accuracy
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
