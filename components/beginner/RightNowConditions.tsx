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
      <h2 className="text-2xl font-semibold text-slate-900 mb-4">
        Right Now at {conditions.spotName}
      </h2>
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          <div className="flex items-start gap-3">
            <Waves className="h-5 w-5 text-sky-600 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-slate-900">
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
              <p className="text-sm font-medium text-slate-900">
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
              <p className="text-sm font-medium text-slate-900">
                {metrics.waterTemp.value}
              </p>
              <p className="text-xs text-slate-500">
                {metrics.waterTemp.label}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-sky-600 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-slate-900">
                {metrics.tide.value}
              </p>
              <p className="text-xs text-slate-500">{metrics.tide.label}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-sky-600 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-slate-900">
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
        <p className="mt-4 text-sm font-medium text-slate-700 border-t border-slate-100 pt-3">
          {conditions.summary}
        </p>
      </div>
    </section>
  );
}
