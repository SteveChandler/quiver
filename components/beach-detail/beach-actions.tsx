"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Navigation, Plus, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HomeBeachBanner } from "@/components/home/HomeBeachBanner";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import type { Beach } from "@/types/database";

interface BeachActionsProps {
  beach: Beach;
  onPlanSession?: () => void;
  onLogSession?: () => void;
  className?: string;
  onGetDirections?: () => void;
  canGetDirections?: boolean;
  publicMode?: boolean;
  onAuthRequired?: () => void;
}

export function BeachActions({
  beach,
  onPlanSession,
  onLogSession,
  className,
  onGetDirections,
  canGetDirections,
  publicMode,
  onAuthRequired,
}: BeachActionsProps) {
  const hasCoordinates = Boolean(beach.lat && beach.lon);
  const directionsEnabled = canGetDirections ?? hasCoordinates;

  const pathname = usePathname();

  // Internal modal state for per-button source tracking in public mode
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authSource, setAuthSource] = useState<"session-log-cta" | "session-plan-cta">("session-log-cta");

  const handleLogSession = () => {
    if (publicMode) {
      setAuthSource("session-log-cta");
      setAuthModalOpen(true);
      // Also notify parent if they want to know auth was required
      onAuthRequired?.();
      return;
    }
    onLogSession?.();
  };

  const handlePlanSession = () => {
    if (publicMode) {
      setAuthSource("session-plan-cta");
      setAuthModalOpen(true);
      onAuthRequired?.();
      return;
    }
    onPlanSession?.();
  };

  const handleDirectionsClick = () => {
    if (onGetDirections) {
      onGetDirections();
      return;
    }
    if (!hasCoordinates) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${beach.lat},${beach.lon}`;
    window.open(url, "_blank", "noopener");
  };

  return (
    <div data-testid="beach-actions" className={`space-y-4 ${className || ""}`}>
      {/* Primary Action Buttons - Phase 3 Spec Compliance */}
      {/* Grid: 2 cols mobile and up | Gap: 12px | Margin: 20px 0 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-5">
        {/* Log Session / Track Your Sessions - Primary Action */}
        {/* Spec: 48px height, #0077B6 bg, white text, 8px radius, 16px font, 600 weight, 0 24px padding, #006699 hover */}
        <div className="flex flex-col gap-1">
          <Button
            data-testid="log-session-btn"
            variant="default"
            onClick={handleLogSession}
            className="h-12 px-6 text-base font-semibold rounded-md bg-ocean-blue hover:bg-ocean-blue/90 hover:shadow-[0_0_16px_rgba(247,142,66,0.3)] active:scale-[0.98] transition-all"
          >
            <Plus className="h-5 w-5 mr-2" />
            {publicMode ? "Track Your Sessions" : "Log Session"}
          </Button>
          {publicMode && (
            <p className="text-xs text-muted-foreground text-center">
              Build your surf log and unlock personalized recommendations
            </p>
          )}
        </div>

        {/* Plan Session / Plan a Session - Primary Action */}
        {/* Spec: 48px height, #0077B6 bg, white text, 8px radius, 16px font, 600 weight, 0 24px padding, #006699 hover */}
        <div className="flex flex-col gap-1">
          <Button
            data-testid="plan-session-btn"
            variant="default"
            onClick={handlePlanSession}
            className="h-12 px-6 text-base font-semibold rounded-md bg-ocean-blue hover:bg-ocean-blue/90 hover:shadow-[0_0_16px_rgba(247,142,66,0.3)] active:scale-[0.98] transition-all"
          >
            <BookOpen className="h-5 w-5 mr-2" />
            {publicMode ? "Plan a Session" : "Plan Session"}
          </Button>
          {publicMode && (
            <p className="text-xs text-muted-foreground text-center">
              Coordinate with friends and pick the best time
            </p>
          )}
        </div>
      </div>

      {/* Auth modal for public mode — per-button source tracking */}
      {publicMode && authModalOpen && (
        <UnifiedAuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          mode="signup"
          source={authSource}
          returnTo={pathname}
          contextMessage={
            authSource === "session-log-cta"
              ? {
                  title: "Track Your Sessions",
                  description: `Build your surf log at ${beach.name} and unlock personalized recommendations`,
                }
              : {
                  title: "Plan a Session",
                  description: `Coordinate with friends and pick the best time to surf ${beach.name}`,
                }
          }
        />
      )}

      {/* Mobile-only Directions & Home Beach Row */}
      <div className="flex flex-wrap items-center gap-3 md:hidden">
        <Button
          data-testid="get-directions-btn-mobile"
          variant="outline"
          onClick={handleDirectionsClick}
          disabled={!directionsEnabled}
          className="h-10 px-4 text-sm font-medium rounded-md hover:bg-gray-50 active:scale-[0.98] transition-all"
        >
          <Navigation className="mr-2 h-4 w-4" />
          Get directions
        </Button>
        <HomeBeachBanner
          selectedBeachId={beach.id}
          selectedBeachName={beach.name}
          publicMode={publicMode}
          onAuthRequired={onAuthRequired}
        />
      </div>

      {/* Desktop Home Beach Banner */}
      <div className="hidden md:block">
        <HomeBeachBanner
          selectedBeachId={beach.id}
          selectedBeachName={beach.name}
          publicMode={publicMode}
          onAuthRequired={onAuthRequired}
        />
      </div>
    </div>
  );
}
