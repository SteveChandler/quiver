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

  // Rendered as a second sheet of the same zine: the scoped .zine-tab styles
  // (stage backdrop, cream paper, typewriter) only apply under that class, and
  // this section sits outside ZinePageShell.
  return (
    <div className="zine-tab">
      <div className="zine-stage">
        <section
          aria-labelledby="public-forecast-hourly-heading"
          data-testid="public-forecast-hourly"
          className="zine-paper"
        >
          <p className="typewriter font-bold text-[#0B3A75]">
            {dayLabel} by time
          </p>
          <h2
            id="public-forecast-hourly-heading"
            className="mt-1.5 font-[var(--font-zine-display)] text-2xl uppercase leading-[1.05] text-[#11100D] sm:text-3xl"
          >
            {beachName} Hourly Surf Forecast
          </h2>
          <p className="mt-2 font-mono text-xs text-[#11100D]/70">
            Times shown in {timezone}.
          </p>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left font-mono text-sm text-[#11100D]">
              <caption className="sr-only">
                {beachName} {dayLabel.toLowerCase()} hourly surf forecast with
                surf height, Quiver recommendation, swell, wind, tide, and confidence.
              </caption>
              <thead>
                <tr className="border-b-2 border-[#11100D]">
                  {["Time", "Surf height", "Quiver recommendation", "Swell", "Wind", "Tide", "Confidence"].map((label) => (
                    <th
                      key={label}
                      scope="col"
                      className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#0B3A75]"
                    >
                      {label}
                    </th>
                  ))}
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
                      className={
                        inCallWindow
                          ? "border-b border-dashed border-[#0B3A75]/25 bg-[#F7E7BE] last:border-0"
                          : "border-b border-dashed border-[#0B3A75]/25 last:border-0"
                      }
                    >
                      <th scope="row" className="whitespace-nowrap px-3 py-3 text-left font-bold">
                        {formatTimeInTimezone(hour.forecast_at, timezone)}
                      </th>
                      <td className="px-3 py-3 font-[var(--font-zine-display)] text-base leading-none">
                        {hour.wave_height || "—"}
                      </td>
                      <td className="px-3 py-3">
                        {inCallWindow ? (
                          <span className="inline-block -rotate-1 border-2 border-[#11100D] bg-[#F78E42] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#11100D]">
                            Best window
                          </span>
                        ) : (
                          <span className="text-[#11100D]/35">—</span>
                        )}
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
        </section>
      </div>
    </div>
  );
}
