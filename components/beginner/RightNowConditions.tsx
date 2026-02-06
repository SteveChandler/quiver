import { Waves, Wind, Thermometer, Clock, Users } from "lucide-react";
import type { RightNowConditions as RightNowConditionsType } from "@/types/beginner";

const METRIC_STATUS_COLORS = {
  good: "text-green-600",
  caution: "text-amber-600",
  warning: "text-red-600",
} as const;

interface RightNowConditionsProps {
  conditions: RightNowConditionsType;
}

export function RightNowConditions({ conditions }: RightNowConditionsProps) {
  const { metrics } = conditions;

  return (
    <section data-testid="right-now-conditions">
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">
        Right Now at {conditions.spotName}
      </h2>
      <div className="overflow-hidden rounded-2xl backdrop-blur-sm bg-gradient-to-br from-white/80 to-blue-50/60 border border-blue-200/50 shadow-lg p-5">
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          <div className="flex items-start gap-3">
            <Waves className="h-5 w-5 text-sky-600 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-gray-800">
                {metrics.waveHeight.value}
              </p>
              <p
                className={`text-xs ${METRIC_STATUS_COLORS[metrics.waveHeight.status]}`}
              >
                {metrics.waveHeight.label}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Wind className="h-5 w-5 text-sky-600 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-gray-800">
                {metrics.wind.value}
              </p>
              <p
                className={`text-xs ${METRIC_STATUS_COLORS[metrics.wind.status]}`}
              >
                {metrics.wind.label}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Thermometer className="h-5 w-5 text-sky-600 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-gray-800">
                {metrics.waterTemp.value}
              </p>
              <p className="text-xs text-gray-600">
                {metrics.waterTemp.label}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-sky-600 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-gray-800">
                {metrics.tide.value}
              </p>
              <p className="text-xs text-gray-600">{metrics.tide.label}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-sky-600 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-gray-800">
                {metrics.crowd.value}
              </p>
              <p
                className={`text-xs ${METRIC_STATUS_COLORS[metrics.crowd.status]}`}
              >
                {metrics.crowd.label}
              </p>
            </div>
          </div>
        </div>
        <p className="mt-4 text-sm font-medium text-gray-700 border-t border-blue-100/50 pt-3">
          {conditions.summary}
        </p>
      </div>
    </section>
  );
}
