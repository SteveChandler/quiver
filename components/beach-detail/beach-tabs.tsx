"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReactNode } from "react";

export type BeachTabValue = "overview" | "forecast" | "reviews" | "intel" | "sessions";

interface BeachTabsProps {
  defaultTab?: BeachTabValue;
  children: ReactNode;
  className?: string;
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
 * - Transitions: 0.2s ease (transition-all duration-200)
 * - Margin bottom: -2px (-mb-0.5) to overlap container border
 */
export function BeachTabs({ defaultTab = "overview", children, className }: BeachTabsProps) {
  // Phase 5: Common tab trigger classes following AllTrails spec
  const tabTriggerClasses =
    "rounded-none border-b-2 border-transparent -mb-0.5 " + // Phase 5: Border and negative margin for overlap
    "px-2 py-2 sm:px-6 sm:py-3 " + // Phase 5: Responsive padding (mobile: 8px h / 8px v, desktop: 24px h / 12px v)
    "text-xs sm:text-base font-medium text-gray-600 " + // Phase 5: Responsive font size (mobile: 12px, desktop: 16px)
    "transition-all duration-200 " + // Phase 5: Spec transitions (0.2s ease)
    "hover:bg-gray-50 hover:text-gray-900 " + // Phase 5: Spec hover states
    "data-[state=active]:border-ocean-blue " + // Phase 5: Spec active border color (#0077B6)
    "data-[state=active]:text-ocean-blue " + // Phase 5: Spec active text color (#0077B6)
    "data-[state=active]:font-semibold " + // Phase 5: Spec active font weight (600)
    "data-[state=active]:bg-transparent data-[state=active]:shadow-none"; // Remove default active styles

  return (
    <Tabs defaultValue={defaultTab} className={className}>
      {/* Phase 5: Tab container with border-bottom and margin-bottom per spec */}
      <TabsList className="w-full justify-start border-b-2 border-gray-200 mb-6 rounded-none bg-transparent p-0 h-auto">
        <TabsTrigger value="overview" className={tabTriggerClasses}>
          Overview
        </TabsTrigger>
        <TabsTrigger value="forecast" className={tabTriggerClasses}>
          Forecast
        </TabsTrigger>
        <TabsTrigger value="reviews" className={tabTriggerClasses}>
          Reviews
        </TabsTrigger>
        <TabsTrigger value="intel" className={tabTriggerClasses}>
          Local Intel
        </TabsTrigger>
        <TabsTrigger value="sessions" className={tabTriggerClasses}>
          Sessions
        </TabsTrigger>
      </TabsList>
      {children}
    </Tabs>
  );
}

// Export TabsContent for use in parent components
export { TabsContent as BeachTabContent };
