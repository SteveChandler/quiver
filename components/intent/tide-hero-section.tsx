import { Waves, ArrowUp, ArrowDown, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CityTideDataExpanded } from "@/actions/forecast/intent-forecast-actions";

interface TideHeroSectionProps {
  data: CityTideDataExpanded;
}

/**
 * TideHeroSection - Prominent current tide conditions display
 *
 * Shows large current tide height, status badge, next high/low times,
 * and NOAA station attribution.
 */
export function TideHeroSection({ data }: TideHeroSectionProps) {
  const {
    currentStatus,
    currentHeight,
    nextTideType,
    nextTideTime,
    nextTideHeight,
    beachName,
    tideStation,
  } = data;

  // Parse numeric height from string like "3.2 ft"
  const heightNum = currentHeight
    ? parseFloat(currentHeight.replace(/[^\d.]/g, ""))
    : null;

  const isRising = currentStatus?.toLowerCase().includes("rising");
  const StatusIcon = isRising ? ArrowUp : ArrowDown;
  const isNextHigh = nextTideType?.toLowerCase() === "high";
  const NextIcon = isNextHigh ? ArrowUp : ArrowDown;

  return (
    <section aria-label="Current tide conditions" className="rounded-2xl backdrop-blur-sm bg-gradient-to-br from-white/80 to-blue-50/60 border border-blue-200/50 shadow-lg p-6 md:p-8">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
        {/* Current Tide */}
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-blue-100/60 p-3">
            <Waves className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">
              Current Tide
            </p>
            <div className="flex items-baseline gap-2">
              {heightNum != null ? (
                <>
                  <span className="text-5xl font-bold text-blue-800">
                    {heightNum.toFixed(1)}
                  </span>
                  <span className="text-2xl font-semibold text-blue-600">
                    ft
                  </span>
                </>
              ) : currentHeight ? (
                <span className="text-4xl font-bold text-blue-800">
                  {currentHeight}
                </span>
              ) : (
                <span className="text-2xl text-gray-400">--</span>
              )}
            </div>
            {currentStatus && (
              <Badge
                variant="secondary"
                className="mt-2 text-sm bg-blue-100/80 text-blue-800"
              >
                <StatusIcon className="h-3.5 w-3.5 mr-1" />
                {currentStatus}
              </Badge>
            )}
          </div>
        </div>

        {/* Next Tide Info */}
        {nextTideType && nextTideTime && (
          <div className="flex items-start gap-3 md:text-right">
            <div className="rounded-xl bg-indigo-100/60 p-3 md:order-2">
              <Clock className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">
                Next {nextTideType}
              </p>
              <p className="text-2xl font-semibold text-gray-800 flex items-center gap-1.5">
                <NextIcon className="h-5 w-5 text-blue-600" />
                {nextTideTime}
              </p>
              {nextTideHeight && (
                <p className="text-sm text-gray-600 mt-0.5">
                  {nextTideHeight}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Attribution */}
      <p className="text-xs text-gray-500 mt-4 pt-3 border-t border-blue-100/50">
        NOAA tide data via {tideStation || beachName}
      </p>
    </section>
  );
}
