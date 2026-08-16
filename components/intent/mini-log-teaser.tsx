"use client";

import { useState } from "react";
import { Timer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { buildQuickLogUrl } from "@/components/home-screen/first-session-cta";
import { track } from "@/lib/analytics";
import { trackSignupCtaClick } from "@/lib/analytics/signup-conversion-tracking";

const BOARD_OPTIONS = [
  "Shortboard",
  "Longboard",
  "Fish",
  "Mid-length",
  "Foamie",
  "SUP",
] as const;

function getDefaultBoard(intent: string): string {
  switch (intent) {
    case "longboard":
      return "Longboard";
    case "dawn-patrol":
      return "Shortboard";
    case "sunset":
      return "Fish";
    case "water-temp":
      return "Shortboard";
    case "least-crowded":
      return "Shortboard";
    default:
      return "Shortboard";
  }
}

export interface MiniLogTeaserProps {
  /** Intent slug for default board selection */
  intentSlug: string;
  /** City name for display */
  cityName: string;
  /** First beach for quick log prefill */
  firstBeach?: { id: string; name: string };
}

/**
 * MiniLogTeaser - Interactive mini session log preview that hooks into signup.
 *
 * For unauthenticated users, the sliders are interactive but purely visual.
 * Clicking "Save" opens the UnifiedAuthModal with signup mode.
 *
 * For authenticated users, the button navigates directly to the quick log flow
 * pre-filled with the first beach.
 */
export function MiniLogTeaser({
  intentSlug,
  cityName,
  firstBeach,
}: MiniLogTeaserProps) {
  const { user } = useAuth();
  const router = useRouter();

  const [waveQuality, setWaveQuality] = useState(7);
  const [crowd, setCrowd] = useState(4);
  const [overall, setOverall] = useState(8);
  const [board, setBoard] = useState(getDefaultBoard(intentSlug));
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const handleSaveClick = () => {
    // GA4-only: not a Supabase funnel event.
    track("mini_log_teaser_click", {
      intent: intentSlug,
      authenticated: !!user,
    });

    if (!user) {
      trackSignupCtaClick({
        source: "mini-log-teaser",
        surface: "intent-page",
        intent: intentSlug,
      });
      setAuthModalOpen(true);
      return;
    }

    router.push(buildQuickLogUrl(firstBeach));
  };

  return (
    <>
      <div className="rounded-2xl bg-gradient-to-br from-blue-50/40 to-indigo-50/40 border border-blue-200/50 shadow-sm p-5">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <Timer className="h-4 w-4 text-gray-500 shrink-0" />
          <span className="text-sm font-semibold text-gray-700">
            Log in 15 seconds
          </span>
          <span className="text-sm text-gray-500">(optional)</span>
        </div>

        {/* Wave Quality Slider */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700 w-28 shrink-0">
              Wave Quality
            </span>
            <input
              type="range"
              min={1}
              max={10}
              value={waveQuality}
              onChange={(e) => setWaveQuality(parseInt(e.target.value))}
              className="flex-1 h-2 rounded-lg appearance-none cursor-pointer accent-ocean-blue bg-gray-200"
              aria-label="Wave quality rating"
            />
            <span className="text-sm font-semibold text-gray-700 w-8 text-right shrink-0">
              {waveQuality}/10
            </span>
          </div>

          {/* Crowd Slider */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700 w-28 shrink-0">
              Crowd
            </span>
            <input
              type="range"
              min={1}
              max={10}
              value={crowd}
              onChange={(e) => setCrowd(parseInt(e.target.value))}
              className="flex-1 h-2 rounded-lg appearance-none cursor-pointer accent-ocean-blue bg-gray-200"
              aria-label="Crowd level rating"
            />
            <span className="text-sm font-semibold text-gray-700 w-8 text-right shrink-0">
              {crowd}/10
            </span>
          </div>

          {/* Overall Slider */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700 w-28 shrink-0">
              Overall
            </span>
            <input
              type="range"
              min={1}
              max={10}
              value={overall}
              onChange={(e) => setOverall(parseInt(e.target.value))}
              className="flex-1 h-2 rounded-lg appearance-none cursor-pointer accent-ocean-blue bg-gray-200"
              aria-label="Overall session rating"
            />
            <span className="text-sm font-semibold text-gray-700 w-8 text-right shrink-0">
              {overall}/10
            </span>
          </div>
        </div>

        {/* Board Dropdown */}
        <div className="mt-4">
          <label
            htmlFor="mini-log-board"
            className="text-sm font-medium text-gray-700"
          >
            Board
          </label>
          <select
            id="mini-log-board"
            value={board}
            onChange={(e) => setBoard(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-ocean-blue focus:ring-1 focus:ring-ocean-blue"
          >
            {BOARD_OPTIONS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        {/* Save Button */}
        <button
          type="button"
          onClick={handleSaveClick}
          className="mt-4 w-full rounded-full bg-ocean-blue text-white py-2.5 text-sm font-semibold shadow-sm hover:shadow-md transition-shadow focus-ring"
        >
          Save + Improve my forecast
        </button>

        {/* Footer */}
        <p className="mt-3 text-xs text-gray-500 text-center">
          Logging once helps tune {cityName} picks.
        </p>
      </div>

      <UnifiedAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        mode="signup"
        source={`mini-log-teaser-${intentSlug}`}
        contextMessage={{
          title: "Personalize Your Forecast",
          description:
            "Log sessions to get smarter spot picks",
        }}
      />
    </>
  );
}
