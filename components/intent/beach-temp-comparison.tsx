import Image from "next/image";
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
  if (tempF < 54) return "border-[#11100D]/25 text-[#8A5E00]";
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {beachTemps.map((beach) => {
          const colorClass = getTempColor(beach.tempF);
          const bgGradient = getTempBgGradient(beach.tempF);
          const href = beach.beachSlug
            ? `/${stateSlug}/${beachUrlCitySlug}/${beach.beachSlug}/water-temp`
            : undefined;

          const content = (
            <div
              className={`overflow-hidden rounded-xl border-2 border-[#11100D]/80 bg-[#FBF6E8] shadow-[3px_3px_0_rgba(17,16,13,0.75)] ${colorClass}`}
            >
              <div className="relative aspect-[4/3] w-full">
                {beach.photoUrl ? (
                  <>
                    <Image
                      src={beach.photoUrl}
                      alt={`${beach.beachName} surf break`}
                      fill
                      className="object-cover saturate-[0.85]"
                      sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#11100D]/75 via-[#11100D]/10 to-transparent" />
                  </>
                ) : (
                  <div className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br ${bgGradient}`}>
                    <Thermometer className="h-12 w-12 opacity-40" aria-hidden="true" />
                  </div>
                )}
                <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border-2 border-[#11100D] bg-[#FBF6E8] px-2.5 py-0.5 text-base font-black text-[#11100D]">
                  <Thermometer className="h-4 w-4" aria-hidden="true" />
                  {Math.round(beach.tempF)}°F
                </span>
                {beach.photoUrl ? (
                  <h3 className="absolute inset-x-3 bottom-2 truncate font-display text-lg font-black uppercase text-white">
                    {beach.beachName}
                  </h3>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                {beach.photoUrl ? null : (
                  <h3 className="truncate font-display text-base font-black uppercase text-[#11100D]">
                    {beach.beachName}
                  </h3>
                )}
                <p className="text-xs font-semibold text-[#8A4B12]">
                  {beach.wetsuitThickness}
                </p>
              </div>
            </div>
          );

          return href ? (
            <Link
              key={beach.beachName}
              href={href}
              className="block transition-transform hover:-translate-y-0.5"
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
