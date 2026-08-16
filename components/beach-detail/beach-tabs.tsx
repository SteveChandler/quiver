"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReactNode, useState, useCallback, useRef } from "react";
import { useTrackEvent } from "@/hooks/use-track-event";

export type BeachTabValue =
  | "overview"
  | "forecast"
  | "reviews"
  | "intel"
  | "sessions";

// Prefetch functions for each tab component
const prefetchTabModules: Record<BeachTabValue, () => Promise<any>> = {
  overview: () => import("@/components/beach-detail/tabs/overview-tab"),
  forecast: () => import("@/components/beach-detail/tabs/forecast-tab"),
  reviews: () => import("@/components/beach-detail/tabs/reviews-tab"),
  intel: () => import("@/components/beach-detail/tabs/intel-tab"),
  sessions: () => import("@/components/beach-detail/tabs/sessions-tab"),
};

interface BeachTabsProps {
  defaultTab?: BeachTabValue;
  activeTab?: BeachTabValue;
  onTabChange?: (value: BeachTabValue) => void;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
  publicMode?: boolean;
  beachId?: string;
}

/**
 * Beach Tabs Component
 *
 * Phase 5 Specifications (AllTrails-style tabs):
 * - Tab padding: 12px vertical × 24px horizontal (py-3 px-6)
 * - Font size: 16px (text-base)
 * - Inactive: gray-600 text, font-weight 500
 * - Active: ocean-blue text and border, font-weight 600
 * - Hover: gray-50 background, gray-900 text
 * - Transitions: 0.2s ease (transition-colors duration-200)
 * - Margin bottom: -2px (-mb-0.5) to overlap container border
 *
 * Supports both controlled and uncontrolled modes:
 * - Uncontrolled: Use defaultTab prop
 * - Controlled: Use activeTab and onTabChange props
 */
export function BeachTabs({
  defaultTab = "forecast",
  activeTab,
  onTabChange,
  children,
  className,
  actions,
  publicMode = false,
  beachId,
}: BeachTabsProps) {
  // Determine if component is controlled or uncontrolled
  const isControlled = activeTab !== undefined && onTabChange !== undefined;

  // Only use internal state if uncontrolled
  const [internalTab, setInternalTab] = useState<BeachTabValue>(defaultTab);

  // Use activeTab if controlled, otherwise use internal state
  const value = isControlled ? activeTab : internalTab;

  const { track } = useTrackEvent();
  const tabEnterTime = useRef<number>(Date.now());
  const previousTab = useRef<BeachTabValue>(isControlled ? activeTab : defaultTab);

  const handleTabChange = (newValue: string) => {
    const tabValue = newValue as BeachTabValue;

    // Track tab switch
    const now = Date.now();
    track('tab_view', {
      beachId,
      metadata: {
        tab: tabValue,
        previous_tab: previousTab.current,
        time_on_previous_ms: now - tabEnterTime.current,
      },
      debounceMs: 300,
    });
    tabEnterTime.current = now;
    previousTab.current = tabValue;

    if (isControlled) {
      // In controlled mode, just notify parent
      onTabChange(tabValue);
    } else {
      // In uncontrolled mode, update internal state
      setInternalTab(tabValue);
      // Also notify parent if callback exists
      onTabChange?.(tabValue);
    }
  };

  // Prefetch tab module on hover for instant loading
  const handleTabHover = useCallback((tabValue: BeachTabValue) => {
    const prefetchFn = prefetchTabModules[tabValue];
    if (prefetchFn) {
      prefetchFn().catch(() => {
        // Silently fail if prefetch doesn't work
      });
    }
  }, []);

  // Phase 5: Common tab trigger classes following AllTrails spec
  const tabTriggerClasses =
    "min-w-0 flex-1 overflow-hidden rounded-none border-b-2 border-transparent -mb-0.5 " + // Phase 5: Border and negative margin for overlap
    "px-2 py-2 sm:px-3 sm:py-3 min-[1100px]:px-6 " + // Phase 5: Responsive padding, tightened near sticker actions
    "text-xs sm:text-sm min-[1100px]:text-base font-medium text-gray-600 " + // Phase 5: Responsive font size
    "whitespace-nowrap " +
    "transition-colors duration-300 ease-out " + // Smooth transitions
    "hover:bg-gray-50 dark:hover:bg-[#354090]/50 hover:text-gray-900 " + // Tier-aware hover
    "data-[state=active]:border-ocean-blue " + // Active border color
    "data-[state=active]:text-ocean-blue " + // Active text color
    "data-[state=active]:font-semibold " + // Active font weight
    "data-[state=active]:bg-transparent data-[state=active]:shadow-[0_2px_12px_rgba(247,142,66,0.15)]"; // Active glow

  const stickyTop = "calc(var(--app-safe-area-top, 0px) + 4rem)";

  return (
    <Tabs value={value} onValueChange={handleTabChange} className={className}>
      {/* Sticky container mimicking AllTrails-style anchor nav */}
      <div
        data-tier="nav"
        className="sticky z-40 mb-6 border-b-2 border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80"
        style={{ top: stickyTop }}
      >
        <div className="flex w-full items-center gap-2 px-0 py-2 sm:py-0">
          <TabsList className="flex min-w-max flex-1 items-center justify-start gap-1 overflow-hidden bg-transparent p-0 h-auto text-muted-foreground md:min-w-0">
            <TabsTrigger
              value="overview"
              className={tabTriggerClasses}
              onMouseEnter={() => handleTabHover("overview")}
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="forecast"
              className={tabTriggerClasses}
              onMouseEnter={() => handleTabHover("forecast")}
            >
              Forecast
            </TabsTrigger>
            <TabsTrigger
              value="reviews"
              className={tabTriggerClasses}
              onMouseEnter={() => handleTabHover("reviews")}
            >
              Reviews
            </TabsTrigger>
            <TabsTrigger
              value="intel"
              className={tabTriggerClasses}
              onMouseEnter={() => handleTabHover("intel")}
            >
              Local Intel
            </TabsTrigger>
            <TabsTrigger
              value="sessions"
              className={tabTriggerClasses}
              onMouseEnter={() => handleTabHover("sessions")}
            >
              Sessions
            </TabsTrigger>
          </TabsList>
          {actions ? (
            <div data-tier="nav-actions" className="hidden shrink-0 items-center gap-2 lg:flex">
              {actions}
            </div>
          ) : null}
        </div>
      </div>
      {children}
    </Tabs>
  );
}

// Export TabsContent for use in parent components
export { TabsContent as BeachTabContent };
