"use client";

/**
 * Best Time to Surf — Hub Enhancements
 *
 * Tabbed interface for:
 * - "Compare destinations" — side-by-side heatmap comparison
 * - "Best month for me" — personalized recommendation by skill + crowd
 */

import { useState } from "react";
import { GitCompare, User } from "lucide-react";
import type { StateSurfProfile } from "@/lib/data/monthly-surf-data";
import { DestinationComparison } from "@/components/best-time-to-surf/destination-comparison";
import { SurfPersonalization } from "@/components/best-time-to-surf/surf-personalization";

type Tab = "compare" | "personalize";

interface BestTimeEnhancementsProps {
  stateProfiles: StateSurfProfile[];
}

export function BestTimeEnhancements({ stateProfiles }: BestTimeEnhancementsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("personalize");

  return (
    <div className="rounded-2xl bg-[#252D6B] overflow-hidden">
      {/* Tab Bar */}
      <div className="flex border-b border-white/10">
        <button
          type="button"
          onClick={() => setActiveTab("personalize")}
          className={`
            flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-colors
            ${activeTab === "personalize"
              ? "bg-[#F78E42]/10 text-[#F78E42] border-b-2 border-[#F78E42]"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }
          ` + " focus-ring"}
        >
          <User className="h-4 w-4" />
          Best Month for Me
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("compare")}
          className={`
            flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-colors
            ${activeTab === "compare"
              ? "bg-[#F78E42]/10 text-[#F78E42] border-b-2 border-[#F78E42]"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }
          ` + " focus-ring"}
        >
          <GitCompare className="h-4 w-4" />
          Compare Destinations
        </button>
      </div>

      {/* Tab Content */}
      <div className="p-5">
        {activeTab === "personalize" ? (
          <SurfPersonalization stateProfiles={stateProfiles} />
        ) : (
          <DestinationComparison availableStates={stateProfiles} />
        )}
      </div>
    </div>
  );
}
