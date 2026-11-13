import Link from "next/link";
import { cityToSlug } from "@/lib/utils/beach-url-utils";
import type { BeachTidePreference } from "@/actions/forecast/intent-forecast-actions";

interface BeachTideCardsProps {
  beaches: BeachTidePreference[];
  citySlug: string;
  stateSlug: string;
  /** Display city name; used to derive canonical (non-collision) slug for beach links */
  cityName: string;
}

function formatRangeFt(value: number): string {
  return value.toFixed(1);
}

/** "1.0–3.0 ft · rising", "Rising tide", or null when the spot has no tide notes. */
export function describeTidePreference(beach: BeachTidePreference): string | null {
  const hasRange = beach.preferredTideMin != null && beach.preferredTideMax != null;
  const direction = beach.preferredDirection?.toLowerCase();
  const directionWord = direction === "rising" || direction === "falling" ? direction : null;
  if (hasRange) {
    const range = `${formatRangeFt(beach.preferredTideMin!)}–${formatRangeFt(beach.preferredTideMax!)} ft`;
    return directionWord ? `${range} · ${directionWord}` : range;
  }
  if (directionWord) return `${directionWord === "rising" ? "Rising" : "Falling"} tide`;
  return null;
}

/**
 * Per-spot tide notes on paper. Describes the water each spot likes; it does not
 * rate the surfer, so no skill badges here.
 */
export function BeachTideCards({ beaches, citySlug, stateSlug, cityName }: BeachTideCardsProps) {
  const beachUrlCitySlug = cityToSlug(cityName) || citySlug;
  const rows = beaches
    .map((beach) => ({ beach, note: describeTidePreference(beach) }))
    .filter((row): row is { beach: BeachTidePreference; note: string } => row.note != null);

  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="tide-by-spot-heading" data-testid="tide-by-spot">
      <h2 id="tide-by-spot-heading" className="mb-1 font-heading text-2xl font-bold text-[#11100D]">
        Tide by spot
      </h2>
      <p className="mb-3 text-sm text-[#11100D]/70">The tide height and direction each break likes.</p>
      <ul className="border-t border-dashed border-[#11100D]/30">
        {rows.map(({ beach, note }) => {
          const href = beach.beachSlug ? `/${stateSlug}/${beachUrlCitySlug}/${beach.beachSlug}/tides` : null;
          return (
            <li
              key={beach.beachSlug || beach.beachName}
              className="flex items-baseline justify-between gap-3 border-b border-dashed border-[#11100D]/30 py-2"
            >
              {href ? (
                <Link href={href} className="font-semibold text-[#11100D] hover:text-[#AA4918]">
                  {beach.beachName}
                </Link>
              ) : (
                <span className="font-semibold text-[#11100D]">{beach.beachName}</span>
              )}
              <span className="text-right font-mono text-sm text-[#11100D]/75">{note}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
