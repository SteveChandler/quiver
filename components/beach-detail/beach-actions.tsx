"use client";

import { useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Navigation, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HomeBeachBanner } from "@/components/home/HomeBeachBanner";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { ConditionsReportCard } from "@/components/beach-detail/conditions-report-card";
import { BeachAlertCta } from "@/components/beach-detail/beach-alert-cta";
import type { Beach } from "@/types/database";
import { track } from "@/lib/analytics";

interface BeachActionsProps {
  beach: Beach;
  className?: string;
  onGetDirections?: () => void;
  canGetDirections?: boolean;
  publicMode?: boolean;
  onAuthRequired?: () => void;
  /** Called after a successful conditions report so parent can refresh RecentReports */
  onConditionsReportSuccess?: () => void;
  /** Called when user clicks the alert bell to open the alert creation/management flow */
  onOpenAlerts?: () => void;
}

export function BeachActions({
  beach,
  className,
  onGetDirections,
  canGetDirections,
  publicMode,
  onAuthRequired,
  onConditionsReportSuccess,
  onOpenAlerts,
}: BeachActionsProps) {
  const hasCoordinates = Boolean(beach.lat && beach.lon);
  const directionsEnabled = canGetDirections ?? hasCoordinates;

  const pathname = usePathname();

  // Internal modal state for per-button source tracking in public mode
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Report Conditions inline card visibility
  const [reportCardOpen, setReportCardOpen] = useState(false);

  const handleReportConditions = useCallback(() => {
    track("report_conditions_opened", { beach_id: beach.id });
    if (publicMode) {
      setAuthModalOpen(true);
      onAuthRequired?.();
      return;
    }
    setReportCardOpen(true);
  }, [beach.id, publicMode, onAuthRequired]);

  const handleReportSuccess = useCallback(() => {
    setReportCardOpen(false);
    onConditionsReportSuccess?.();
  }, [onConditionsReportSuccess]);

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
      {/* Primary Action Buttons — 3-button layout */}
      {/* Flex row: equal-width buttons, 12px gap, 20px vertical margin */}
      <div className="flex gap-3 my-5">
        {/* Report Conditions — primary community CTA */}
        {/* Spec: 48px height, #0077B6 bg, white text, 8px radius, 16px font, 600 weight, 0 24px padding, #006699 hover */}
        <div className="flex flex-col gap-1 flex-1">
          <Button
            data-testid="report-conditions-btn"
            variant="default"
            onClick={handleReportConditions}
            className="h-12 w-full px-6 text-base font-semibold rounded-md bg-ocean-blue hover:bg-ocean-blue/90 hover:shadow-[0_0_16px_rgba(247,142,66,0.3)] active:scale-[0.98] transition-all"
          >
            <Radio className="h-5 w-5 mr-2" />
            Report Conditions
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Share what the waves are like right now
          </p>
        </div>

        {/* Get Directions — the action after deciding to go surf */}
        <div className="flex flex-col gap-1 flex-1">
          <Button
            data-testid="get-directions-btn"
            variant="outline"
            onClick={handleDirectionsClick}
            disabled={!directionsEnabled}
            className="h-12 w-full px-6 text-base font-semibold rounded-md hover:bg-gray-50 active:scale-[0.98] transition-all"
          >
            <Navigation className="h-5 w-5 mr-2" />
            Get Directions
          </Button>
        </div>

        {/* Alert CTA — Charming Orange bell, shows rule count badge when active */}
        <BeachAlertCta
          beachId={beach.id}
          beachName={beach.name}
          onOpenAlerts={onOpenAlerts}
        />
      </div>

      {/* Inline Report Conditions card — expands in place when button is clicked */}
      {reportCardOpen && (
        <ConditionsReportCard
          beachId={beach.id}
          beachName={beach.name}
          publicMode={publicMode}
          onAuthRequired={onAuthRequired}
          onSubmitSuccess={handleReportSuccess}
          onDismiss={() => setReportCardOpen(false)}
        />
      )}

      {/* Auth modal for public mode — gates Report Conditions for anonymous users */}
      {publicMode && authModalOpen && (
        <UnifiedAuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          mode="signup"
          source="conditions-report-cta"
          returnTo={pathname}
          contextMessage={{
            title: "Report Conditions",
            description: `Help the ${beach.name} surf community by sharing what it's like out there`,
          }}
        />
      )}

      {/* Home Beach Banner */}
      <HomeBeachBanner
        selectedBeachId={beach.id}
        selectedBeachName={beach.name}
        publicMode={publicMode}
        onAuthRequired={onAuthRequired}
      />
    </div>
  );
}
