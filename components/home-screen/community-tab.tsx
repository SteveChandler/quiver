"use client";

import { IntelDashboard } from "@/components/intel/intel-dashboard";

interface CommunityTabProps {
  // Legacy props that are no longer needed but kept for compatibility
  sessions?: any[];
  loading?: boolean;
}

export function CommunityTab({ sessions, loading }: CommunityTabProps) {
  // The Local Intel Club has replaced the community feed
  // All the functionality is now handled by the IntelDashboard component
  return (
    <div className="h-[calc(100vh-200px)] max-w-full mx-auto">
      <IntelDashboard />
    </div>
  );
}
