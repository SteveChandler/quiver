import { Info } from "lucide-react";
import type { EnhancedForecastEntity } from "@/types/forecast";

interface FallbackForecastDisplayProps {
  forecast: Partial<EnhancedForecastEntity>;
}

export function FallbackForecastDisplay({ forecast }: FallbackForecastDisplayProps) {
  return (
    <div className="space-y-4">
      {/* Today's Date Header */}
      <div className="text-center pb-3 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800">
          Today’s Forecast
        </h3>
        <p className="text-sm text-gray-600">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Basic Wave Information */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600 mb-2">
            {forecast?.wave_height || "No data"}
          </div>
          <div className="text-sm text-gray-600">Wave Height</div>
        </div>
      </div>

      {/* Weather & Conditions */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="text-lg font-semibold text-gray-800">
            {forecast?.wind_speed || "No data"}
          </div>
          <div className="text-sm text-gray-600">Wind</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-gray-800">
            {forecast?.wind_direction || "N/A"}
          </div>
          <div className="text-sm text-gray-600">Direction</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-gray-800">
            {forecast?.water_temp || "No data"}
          </div>
          <div className="text-sm text-gray-600">Water Temp</div>
        </div>
      </div>

      {/* Basic forecast notice */}
      <div className="flex items-center justify-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <Info className="h-4 w-4 text-yellow-600" />
        <span className="text-sm text-yellow-800">
          Basic forecast data - Enhanced forecast loading...
        </span>
      </div>
    </div>
  );
}











