"use client";

import { IntelTabSimple } from "@/components/intel/intel-tab-simple";

interface CommunityTabProps {
  // Legacy props that are no longer needed but kept for compatibility
  sessions?: any[];
  loading?: boolean;
}

export function CommunityTab({ sessions, loading }: CommunityTabProps) {
  // The Local Intel tab shows community intel posts
  // Using simplified implementation for better reliability
  return (
    <div className="max-w-full mx-auto">
      <IntelTabSimple />
    </div>
  );
}
