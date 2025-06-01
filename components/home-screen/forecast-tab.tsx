"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BeachSearch } from "@/components/beach-search";
import { ForecastPrompt } from "@/components/forecast-prompt";

export function ForecastTab() {
  const [showForecastPrompt, setShowForecastPrompt] = useState(false);

  return (
    <div className="space-y-4">
      {/* Search methods selection */}
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-center space-x-2 mb-4">
          <Button
            variant={!showForecastPrompt ? "default" : "outline"}
            size="sm"
            onClick={() => setShowForecastPrompt(false)}
          >
            Quick Search
          </Button>
          <Button
            variant={showForecastPrompt ? "default" : "outline"}
            size="sm"
            onClick={() => setShowForecastPrompt(true)}
          >
            Advanced Search
          </Button>
        </div>
      </div>

      {/* Show search interfaces */}
      {!showForecastPrompt ? (
        <div className="max-w-2xl mx-auto">
          <BeachSearch />
        </div>
      ) : (
        <div className="max-w-2xl mx-auto">
          <ForecastPrompt />
        </div>
      )}
    </div>
  );
}
