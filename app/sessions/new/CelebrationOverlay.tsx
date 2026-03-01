"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";
import { ShareSheet } from "@/components/share";
import { buildSessionShareUrl } from "@/lib/share/build-share-card-url";
import { SessionFormMode } from "@/hooks/use-session-form";
import { REVIEW_TIMEOUTS } from "@/lib/constants/review-tracking";
import { formatShareDate } from "./utils";

interface CelebrationOverlayProps {
  mode: SessionFormMode;
  savedSessionData: any | null;
  createdSessionId: string | null;
  shareSheetOpen: boolean;
  onShareSheetOpenChange: (open: boolean) => void;
  onShareSession: () => void;
  onContinue: () => void;
}

export function CelebrationOverlay({
  mode,
  savedSessionData,
  createdSessionId,
  shareSheetOpen,
  onShareSheetOpenChange,
  onShareSession,
  onContinue,
}: CelebrationOverlayProps) {
  return (
    <>
      {/* Celebration overlay with enhanced visibility */}
      <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/10">
        <div className="text-center animate-in fade-in zoom-in duration-500 bg-white/95 backdrop-blur-sm rounded-2xl p-8 border-4 border-green-500 shadow-2xl pointer-events-auto">
          <h2 className="text-6xl font-bold text-green-600 mb-4">
            🎉 Success!
          </h2>
          <p className="text-2xl text-gray-700 font-semibold mb-2">
            {mode === "plan" ? "Session Planned!" : "Session Logged!"}
          </p>
          {mode !== "plan" && (
            <p className="text-base text-gray-500 mb-4">
              {savedSessionData?.selectedBeach
                ? `You just contributed to forecast accuracy at ${savedSessionData.selectedBeach}.`
                : "You just contributed to forecast accuracy at your local break."}
            </p>
          )}

          {/* Share and Continue buttons */}
          <div className="flex flex-col gap-3 mt-6">
            <Button
              onClick={onShareSession}
              size="lg"
              className="w-full"
            >
              <Share2 className="h-5 w-5 mr-2" />
              Share Session
            </Button>
            <Button
              onClick={onContinue}
              variant="outline"
              size="lg"
              className="w-full"
            >
              Continue
            </Button>
          </div>

          <p className="text-xs text-gray-500 mt-4">
            Auto-redirect in {REVIEW_TIMEOUTS.CELEBRATION_DURATION / 1000} seconds
          </p>
        </div>
      </div>

      {/* Share Sheet for session sharing */}
      {savedSessionData && (
        <ShareSheet
          open={shareSheetOpen}
          onOpenChange={onShareSheetOpenChange}
          type="session"
          imageUrl={buildSessionShareUrl({
            beach: savedSessionData.selectedBeach || "Unknown Beach",
            rating: savedSessionData.overallRating
              ? (parseInt(savedSessionData.overallRating) >= 4 ? "Epic" : parseInt(savedSessionData.overallRating) >= 3 ? "Good" : "Fair")
              : "Good",
            stars: savedSessionData.overallRating ? parseInt(savedSessionData.overallRating) : 4,
            size: savedSessionData.waveQuality
              ? (parseInt(savedSessionData.waveQuality) >= 4 ? "Overhead" : parseInt(savedSessionData.waveQuality) >= 3 ? "Chest-Head" : "Waist-Chest")
              : "Waist-Chest",
            board: savedSessionData.boardName || "Surfboard",
            date: formatShareDate(savedSessionData.selectedDate),
            tagline:
              typeof savedSessionData.notes === "string"
                ? savedSessionData.notes
                : undefined,
            footer: `Similar to your best ${savedSessionData.selectedBeach || "this beach"} sessions`,
          })}
          filename="quiver-session"
          title="Check out my surf session!"
          text={`Just ${mode === "plan" ? "planned" : "logged"} a session at ${savedSessionData.selectedBeach || "the beach"}!`}
        />
      )}
    </>
  );
}
