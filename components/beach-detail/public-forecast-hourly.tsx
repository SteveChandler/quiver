import type {
  PublicForecastDay,
  PublicForecastHour,
} from "@/actions/spot/spot-surf-report-actions";
import type { ForecastRecommendationContext } from "@/lib/services/forecast-recommendation-context";
import type { SurfCallResult } from "@/lib/utils/surf-call-logic";
import { formatTimeInTimezone } from "@/lib/utils/date-time";

interface PublicForecastHourlyProps {
  beachName: string;
  forecastHours: PublicForecastHour[];
  report: SurfCallResult | null;
  context: ForecastRecommendationContext | null;
  isTomorrow: boolean;
  forecastDay: PublicForecastDay;
}

function join(parts: (string | null | undefined)[], separator = " "): string {
  return parts.filter(Boolean).join(separator) || "—";
}

function swellLabel(hour: PublicForecastHour): string {
  const secondary = [
    hour.swell_2_height,
    hour.swell_2_period ? `@ ${hour.swell_2_period}` : null,
    hour.swell_2_direction,
  ].filter(Boolean);

  return join([
    hour.swell_1_height,
    hour.swell_1_period ? `@ ${hour.swell_1_period}` : null,
    hour.swell_1_direction,
    secondary.length > 0 ? `(${secondary.join(" ")})` : null,
  ]);
}

function isWithinCallWindow(
  forecastAt: string,
  report: SurfCallResult | null,
  context: ForecastRecommendationContext | null,
): boolean {
  const startMs = Date.parse(
    context?.displayWindowStart ?? report?.bestWindowStart ?? "",
  );
  const endMs = Date.parse(
    context?.displayWindowEnd ?? report?.bestWindowEnd ?? "",
  );
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return false;

  const forecastMs = Date.parse(forecastAt);
  return forecastMs >= startMs && forecastMs <= endMs;
}

export function PublicForecastHourly({
  beachName,
  forecastHours,
  report,
  context,
  isTomorrow,
  forecastDay,
}: PublicForecastHourlyProps) {
  if (forecastHours.length === 0) return null;

  const timezone = context?.timezone ?? "UTC";
  const dayLabel = forecastDay === "tomorrow" ? "Tomorrow" : "Today";

  return (
    <section
      aria-labelledby="public-forecast-hourly-heading"
      data-testid="public-forecast-hourly"
      className="mx-auto max-w-5xl px-4 pt-5 sm:px-6 lg:px-8"
    >
      <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {dayLabel} by time
        </p>
        <h2
          id="public-forecast-hourly-heading"
          className="mt-2 text-xl font-semibold text-foreground"
        >
          {beachName} Hourly Surf Forecast
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Forecast times are shown in {timezone}.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <caption className="sr-only">
              {beachName} {dayLabel.toLowerCase()} hourly surf forecast with
              surf height, Quiver recommendation, swell, wind, tide, and confidence.
            </caption>
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-3 py-2 font-medium">Time</th>
                <th scope="col" className="px-3 py-2 font-medium">Surf height</th>
                <th scope="col" className="px-3 py-2 font-medium">Quiver recommendation</th>
                <th scope="col" className="px-3 py-2 font-medium">Swell</th>
                <th scope="col" className="px-3 py-2 font-medium">Wind</th>
                <th scope="col" className="px-3 py-2 font-medium">Tide</th>
                <th scope="col" className="px-3 py-2 font-medium">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {forecastHours.map((hour) => {
                const inCallWindow =
                  forecastDay === (isTomorrow ? "tomorrow" : "today") &&
                  isWithinCallWindow(hour.forecast_at, report, context);

                return (
                  <tr
                    key={hour.forecast_at}
                    data-testid="public-forecast-hour"
                    className="border-b border-border/60 last:border-0"
                  >
                    <th scope="row" className="whitespace-nowrap px-3 py-3 font-medium text-foreground">
                      {formatTimeInTimezone(hour.forecast_at, timezone)}
                    </th>
                    <td className="px-3 py-3">{hour.wave_height || "—"}</td>
                    <td className="px-3 py-3">
                      {inCallWindow ? "Best window" : "—"}
                    </td>
                    <td className="px-3 py-3">{swellLabel(hour)}</td>
                    <td className="px-3 py-3">{join([hour.wind_speed, hour.wind_direction])}</td>
                    <td className="px-3 py-3">{join([hour.tide_height, hour.tide_status], " · ")}</td>
                    <td className="px-3 py-3">
                      {hour.confidence_score == null
                        ? "—"
                        : `${Math.round(hour.confidence_score)}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
