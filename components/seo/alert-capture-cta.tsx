"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { useAuth } from "@/context/auth-context";
import { usePendingAction } from "@/hooks/use-pending-action";
import { useTrackEvent } from "@/hooks/use-track-event";
import {
  trackSignupCtaClick,
  trackSignupCtaView,
} from "@/lib/analytics/signup-conversion-tracking";
import {
  getContextualPresetConfig,
  type AlertPageContext,
} from "@/lib/alerts/preset-context-map";
import { cn } from "@/lib/utils";

/**
 * Mini preset badge config — label for compact display.
 * Uses string keys (not PresetType) to avoid circular dep with alerts/types.
 */
const PRESET_BADGE_CONFIG: Record<string, { label: string }> = {
  glass_off: { label: "Glassy" },
  mellow_session: { label: "Mellow Session" },
  dawn_patrol: { label: "Dawn Patrol" },
  big_day: { label: "Big Day" },
  clean_groundswell: { label: "Clean Groundswell" },
  tide_window: { label: "Tide Window" },
  epic_conditions: { label: "Epic Conditions" },
};

interface AlertCaptureCtaProps {
  pageContext: AlertPageContext;
  beachId: string;
  beachName: string;
  /** Analytics source tracking identifier */
  source: string;
  className?: string;
}

/**
 * AlertCaptureCta — contextual alert CTA for SEO pages.
 *
 * Replaces InlineSignupCta with alert-specific messaging and preset badges.
 * For anonymous users: tracks views/clicks, stores PendingAction, opens auth modal.
 * For authenticated users: hidden (CTA defense-in-depth per CLAUDE.md).
 */
export function AlertCaptureCta({
  pageContext,
  beachId,
  beachName,
  source,
  className,
}: AlertCaptureCtaProps) {
  const { user, isLoading } = useAuth();
  const { setPendingAction } = usePendingAction();
  const { track } = useTrackEvent();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const hasTrackedView = useRef(false);

  const config = getContextualPresetConfig(pageContext);

  // Session-deduped view tracking (matches InlineSignupCta pattern)
  useEffect(() => {
    if (!user && !isLoading && !hasTrackedView.current) {
      trackSignupCtaView({
        source,
        cta_type: "alert_capture",
        page_context: pageContext,
      });
      hasTrackedView.current = true;
    }
  }, [user, isLoading, source, pageContext]);

  const handleCtaClick = useCallback(() => {
    void track("save_alert_clicked", {
      beachId,
      metadata: {
        surface: "seo_alert_capture_cta",
        page_context: pageContext,
        beach_id: beachId,
        beach_name: beachName,
        source,
        preset_types: config.presets,
      },
      debounceMs: 0,
    });

    trackSignupCtaClick({
      source,
      cta_type: "alert_capture",
      cta_text: config.buttonText,
      page_context: pageContext,
      preset_types: config.presets,
    });

    // Store pending action so post-signup can auto-create the alert
    setPendingAction({
      type: "alert",
      beachId,
      beachName,
      presetType: config.presets[0],
    });

    setAuthModalOpen(true);
  }, [track, beachId, pageContext, beachName, source, config, setPendingAction]);

  // Don't render for authenticated users or while loading
  if (user || isLoading) {
    return null;
  }

  return (
    <>
      <div
        className={cn(
          "rounded-2xl",
          "bg-[#252D6B]",
          "border border-white/10 shadow-sm",
          "p-6",
          className,
        )}
        role="region"
        aria-label={`Alert signup prompt: ${config.headline(beachName)}`}
        data-testid="alert-capture-cta"
      >
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-[#F78E42]/15 p-2 shrink-0">
              <Waves className="h-5 w-5 text-[#F78E42]" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg md:text-xl font-semibold text-white mb-1">
                {config.headline(beachName)}
              </h3>
              <p className="text-sm md:text-base text-white/70">
                {config.description(beachName)}
              </p>
            </div>
          </div>

          {/* Mini preset badges */}
          <div className="flex flex-wrap gap-2" aria-label="Available alert types">
            {config.presets.map((presetKey) => {
              const badge = PRESET_BADGE_CONFIG[presetKey];
              if (!badge) return null;

              return (
                <span
                  key={presetKey}
                  className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/70"
                >
                  {badge.label}
                </span>
              );
            })}
          </div>

          {/* CTA button */}
          <div className="flex-shrink-0">
            <Button
              onClick={handleCtaClick}
              className="rounded-full bg-[#F78E42] hover:bg-[#F78E42]/90 text-[#11100D] px-6 shadow-sm hover:shadow-md font-semibold"
              data-testid="alert-capture-primary-cta"
            >
              {config.buttonText}
            </Button>
          </div>

          <p className="text-xs text-white/40">
            No spam. Just surf.
          </p>
        </div>
      </div>

      <UnifiedAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        mode="signup"
        source={`alert-cta-${source}`}
        contextMessage={{
          title: "Set Up Condition Alerts",
          description:
            "Create an account to get notified when conditions match your preferences.",
        }}
      />
    </>
  );
}
