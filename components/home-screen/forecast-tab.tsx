"use client";

import { BeachSearch } from "@/components/beach-search";
import type { Profile } from "@/types/database";

interface ForecastTabProps {
  profile?: Profile | null;
}

export function ForecastTab({ profile }: ForecastTabProps) {
  return (
    <div className="space-y-4">
      {/* Quick Search Interface */}
      <div className="max-w-2xl mx-auto">
        <BeachSearch profile={profile} />
      </div>
    </div>
  );
}
