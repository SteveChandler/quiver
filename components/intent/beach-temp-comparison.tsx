import Link from "next/link";
import { Thermometer } from "lucide-react";
import type { BeachWaterTemp } from "@/actions/forecast/intent-forecast-actions";

interface BeachTempComparisonProps {
  beachTemps: BeachWaterTemp[];
  citySlug: string;
  stateSlug: string;
}

/** Color-code temperature: cold blue → warm amber */
function getTempColor(tempF: number): string {
  if (tempF < 54) return "border-blue-300 bg-blue-50 text-blue-800";
  if (tempF < 62) return "border-cyan-300 bg-cyan-50 text-cyan-800";
  if (tempF < 68) return "border-teal-300 bg-teal-50 text-teal-800";
  if (tempF < 74) return "border-amber-300 bg-amber-50 text-amber-800";
  return "border-red-300 bg-red-50 text-red-800";
}

function getTempBgGradient(tempF: number): string {
  if (tempF < 54) return "from-blue-50/80 to-white/80";
  if (tempF < 62) return "from-cyan-50/80 to-white/80";
  if (tempF < 68) return "from-teal-50/80 to-white/80";
  if (tempF < 74) return "from-amber-50/80 to-white/80";
  return "from-red-50/80 to-white/80";
}

export function BeachTempComparison({
  beachTemps,
  citySlug,
  stateSlug,
}: BeachTempComparisonProps) {
  if (beachTemps.length === 0) return null;

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
            ? `/beaches/usa/${stateSlug}/${citySlug}/${beach.beachSlug}`
            : undefined;

          const content = (
            <div
              className={`rounded-xl border p-4 shadow-sm bg-gradient-to-br ${bgGradient} ${colorClass} transition-colors`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900 text-sm truncate mr-2">
                  {beach.beachName}
                </h3>
                <div className="flex items-center gap-1 shrink-0">
                  <Thermometer className="h-4 w-4" />
                  <span className="text-lg font-bold">
                    {Math.round(beach.tempF)}°F
                  </span>
                </div>
              </div>
              <p className="text-xs mt-1 opacity-80">{beach.wetsuitThickness}</p>
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
