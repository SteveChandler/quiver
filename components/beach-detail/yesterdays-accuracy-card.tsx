"use client";

import { CheckCircle } from "lucide-react";
import type { YesterdayAccuracy } from "@/types/accuracy";
import { cn } from "@/lib/utils";

const M_TO_FT = 3.28084;

interface YesterdaysAccuracyCardProps {
  accuracy: YesterdayAccuracy;
  className?: string;
}

export function YesterdaysAccuracyCard({
  accuracy,
  className,
}: YesterdaysAccuracyCardProps) {
  const predictedFt = (accuracy.avg_predicted_m * M_TO_FT).toFixed(1);
  const actualFt = (accuracy.avg_observed_m * M_TO_FT).toFixed(1);
  const accuracyPct = Math.max(
    0,
    Math.min(100, Math.round(100 - accuracy.relative_error_pct))
  );

  const formattedDate = (() => {
    try {
      const [year, month, day] = accuracy.forecast_date.split("-");
      return new Date(
        Number(year),
        Number(month) - 1,
        Number(day)
      ).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
      return accuracy.forecast_date;
    }
  })();

  const barColor =
    accuracyPct >= 75
      ? "bg-emerald-500"
      : accuracyPct >= 50
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <section
      data-testid="yesterdays-accuracy-card"
      className={cn(
        "rounded-3xl border border-blue-100/60 bg-white/95 p-6 shadow-lg backdrop-blur",
        className
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-emerald-500" />
          <h3 className="text-base font-semibold text-dark-grey">
            Yesterday&rsquo;s Accuracy
          </h3>
        </div>
        <span className="text-sm text-muted-foreground">{formattedDate}</span>
      </div>

      {/* Metrics */}
      <div className="mb-4 grid grid-cols-3 gap-4">
        <div>
          <div className="mb-1 text-xs text-muted-foreground">Predicted</div>
          <div className="text-lg font-semibold text-dark-grey">
            {predictedFt} ft
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs text-muted-foreground">Actual</div>
          <div className="text-lg font-semibold text-dark-grey">
            {actualFt} ft
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs text-muted-foreground">Accuracy</div>
          <div className="text-lg font-semibold text-dark-grey">
            {accuracyPct}%
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-3 h-2 w-full rounded-full bg-gray-100">
        <div
          data-testid="accuracy-bar"
          className={cn("h-2 rounded-full transition-[width]", barColor)}
          style={{ width: `${accuracyPct}%` }}
        />
      </div>

      {/* Footer */}
      <p className="text-xs text-muted-foreground">
        Based on {accuracy.observation_count} buoy observation
        {accuracy.observation_count !== 1 ? "s" : ""}
      </p>
    </section>
  );
}
