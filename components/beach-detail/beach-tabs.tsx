"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReactNode } from "react";

export type BeachTabValue = "overview" | "forecast" | "reviews" | "intel" | "sessions";

interface BeachTabsProps {
  defaultTab?: BeachTabValue;
  children: ReactNode;
  className?: string;
}

export function BeachTabs({ defaultTab = "overview", children, className }: BeachTabsProps) {
  return (
    <Tabs defaultValue={defaultTab} className={className}>
      <TabsList className="w-full justify-start border-b rounded-none bg-transparent p-0 h-auto">
        <TabsTrigger
          value="overview"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-ocean-blue data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-sm font-medium"
        >
          Overview
        </TabsTrigger>
        <TabsTrigger
          value="forecast"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-ocean-blue data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-sm font-medium"
        >
          Forecast
        </TabsTrigger>
        <TabsTrigger
          value="reviews"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-ocean-blue data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-sm font-medium"
        >
          Reviews
        </TabsTrigger>
        <TabsTrigger
          value="intel"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-ocean-blue data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-sm font-medium"
        >
          Local Intel
        </TabsTrigger>
        <TabsTrigger
          value="sessions"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-ocean-blue data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-sm font-medium"
        >
          Sessions
        </TabsTrigger>
      </TabsList>
      {children}
    </Tabs>
  );
}

// Export TabsContent for use in parent components
export { TabsContent as BeachTabContent };
