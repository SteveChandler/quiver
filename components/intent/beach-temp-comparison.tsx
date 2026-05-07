import Link from "next/link";
import { Thermometer } from "lucide-react";
import { cityToSlug } from "@/lib/utils/beach-url-utils";
import type { BeachWaterTemp } from "@/actions/forecast/intent-forecast-actions";

interface BeachTempComparisonProps {
  beachTemps: BeachWaterTemp[];
  citySlug: string;
  stateSlug: string;
  /** Display city name; used to derive canonical (non-collision) slug for beach links */
  cityName: string;
}

/** Color-code temperature: cold blue to warm amber with paper-safe contrast. */
function getTempColor(tempF: number): string {
  if (tempF < 54) return "border-[#0B3A75]/25 text-[#0B3A75]";
  if (tempF < 62) return "border-[#08708A]/25 text-[#075E75]";
  if (tempF < 68) return "border-[#0F766E]/25 text-[#115E59]";
  if (tempF < 74) return "border-[#B65F1A]/25 text-[#8A4B12]";
  return "border-[#B91C1C]/25 text-[#8A1F1F]";
}

function getTempBgGradient(tempF: number): string {
  if (tempF < 54) return "from-[#E6EEF2]/90 to-[#FBF6E8]/85";
  if (tempF < 62) return "from-[#E2F1EF]/90 to-[#FBF6E8]/85";
  if (tempF < 68) return "from-[#E1F0E8]/90 to-[#FBF6E8]/85";
  if (tempF < 74) return "from-[#F7E8C7]/95 to-[#FBF6E8]/85";
  return "from-[#F2D9CB]/95 to-[#FBF6E8]/85";
}

export function BeachTempComparison({
  beachTemps,
  citySlug,
  stateSlug,
  cityName,
}: BeachTempComparisonProps) {
  if (beachTemps.length === 0) return null;
  const beachUrlCitySlug = cityToSlug(cityName) || citySlug;

  return (
    <section>
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">
        Beach Water Temperatures
      </h2>
      <p className="text-sm text-gray-600 mb-6">
        Current water temperatures at each surf spot. Temperatures can vary
        based on local conditions, currents, and depth.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {beachTemps.map((beach) => {
          const colorClass = getTempColor(beach.tempF);
          const bgGradient = getTempBgGradient(beach.tempF);
          const href = beach.beachSlug
            ? `/${stateSlug}/${beachUrlCitySlug}/${beach.beachSlug}/water-temp`
            : undefined;

          const content = (
            <div
              className={`rounded-xl border p-4 shadow-sm bg-gradient-to-br ${bgGradient} ${colorClass} transition-colors`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-[#11100D] text-sm truncate mr-2">
                  {beach.beachName}
                </h3>
                <div className="flex items-center gap-1 shrink-0">
                  <Thermometer className="h-4 w-4" />
                  <span className="text-lg font-bold">
                    {Math.round(beach.tempF)}°F
                  </span>
                </div>
              </div>
              <p className="text-xs mt-1 font-medium text-[#8A4B12]">
                {beach.wetsuitThickness}
              </p>
            </div>
          );

          return href ? (
            <Link
              key={beach.beachName}
              href={href}
              className="block hover:opacity-90 transition-opacity"
            >
              {content}
            </Link>
          ) : (
            <div key={beach.beachName}>{content}</div>
          );
        })}
      </div>
    </section>
  );
}
