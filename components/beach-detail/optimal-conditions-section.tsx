import Image from "next/image";
import { Wind, Waves, Gauge, CalendarDays } from "lucide-react";
import type { Beach } from "@/types/database";
import { degreeWindowToCardinal } from "@/lib/utils/direction-utils";
import { formatMonthRange } from "@/lib/utils/date-time";
import { getOptimizedImageUrl } from "@/lib/image-proxy";
import { TextureOverlay } from "@/components/ui/texture-overlay";

interface BeachPhoto {
  image_url: string;
  thumb_url: string | null;
  source: string;
  creator_name: string | null;
  license_code: string | null;
  attribution_html: string | null;
}

interface OptimalConditionsSectionProps {
  beach: Beach;
  photo?: BeachPhoto | null;
}

/**
 * Server-rendered section displaying optimal surf conditions for a beach.
 *
 * Fully SSR — no "use client", no hooks, no state. Renders HTML that is
 * crawlable by search engines, targeting compound queries like
 * "best wind direction [beach name]".
 */
export function OptimalConditionsSection({
  beach,
  photo,
}: OptimalConditionsSectionProps) {
  const windCardinal = getWindCardinal(beach);
  const swellCardinal = getSwellCardinal(beach);
  const tidePref = getTidePreference(beach);
  const bestMonths =
    beach.best_months && beach.best_months.length > 0
      ? formatMonthRange(beach.best_months)
      : null;

  // Return null if there is no conditions data at all
  if (!windCardinal && !swellCardinal && !tidePref && !bestMonths) {
    return null;
  }

  const locationLabel = [beach.city, beach.state].filter(Boolean).join(", ");

  return (
    <section className="rounded-2xl border border-white/10 p-6 relative overflow-hidden bg-[length:200%_200%] animate-container-gradient-shift motion-reduce:animate-none" style={{ backgroundImage: 'linear-gradient(160deg, #1a1f4a 0%, #0F1A2E 40%, #1a1f4a 100%)' }}>
      <TextureOverlay variant="topo-static" />
      <h2 className="font-heading text-xl font-semibold text-white/90 mb-5 relative">
        Optimal Surf Conditions for {beach.name}
      </h2>

      {/* Hero photo */}
      {photo && (
        <figure className="mb-5 overflow-hidden rounded-xl">
          <Image
            src={getOptimizedImageUrl(photo.image_url)}
            alt={`Surf conditions at ${beach.name}${locationLabel ? `, ${locationLabel}` : ""}`}
            width={800}
            height={450}
            className="w-full h-auto object-cover rounded-xl"
            sizes="(max-width: 768px) 100vw, 800px"
          />
          {photo.license_code && photo.creator_name && (
            <figcaption className="mt-2 text-xs text-white/40">
              Photo by {photo.creator_name}
              {photo.license_code ? ` (${photo.license_code})` : ""}
            </figcaption>
          )}
        </figure>
      )}

      {/* Conditions grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {windCardinal && (
          <div className="bg-white/5 rounded-xl p-4 border border-white/5 transition-colors hover:bg-white/[0.07] relative">
            <Wind className="h-5 w-5 text-white/50 mb-2" />
            <span className="text-xs text-white/60 uppercase tracking-wider block">
              Best Wind
            </span>
            <h3 className="text-lg font-semibold text-white">{windCardinal}</h3>
          </div>
        )}

        {swellCardinal && (
          <div className="bg-white/5 rounded-xl p-4 border border-white/5 transition-colors hover:bg-white/[0.07] relative">
            <Waves className="h-5 w-5 text-white/50 mb-2" />
            <span className="text-xs text-white/60 uppercase tracking-wider block">
              Best Swell
            </span>
            <h3 className="text-lg font-semibold text-white">{swellCardinal}</h3>
          </div>
        )}

        {tidePref && (
          <div className="bg-white/5 rounded-xl p-4 border border-white/5 transition-colors hover:bg-white/[0.07] relative">
            <Gauge className="h-5 w-5 text-white/50 mb-2" />
            <span className="text-xs text-white/60 uppercase tracking-wider block">
              Preferred Tide
            </span>
            <h3 className="text-lg font-semibold text-white">{tidePref}</h3>
          </div>
        )}

        {bestMonths && (
          <div className="bg-white/5 rounded-xl p-4 border border-white/5 transition-colors hover:bg-white/[0.07] relative">
            <CalendarDays className="h-5 w-5 text-white/50 mb-2" />
            <span className="text-xs text-white/60 uppercase tracking-wider block">
              Best Months
            </span>
            <h3 className="text-lg font-semibold text-white">{bestMonths}</h3>
          </div>
        )}
      </div>

      {/* Prose & tips */}
      {beach.best_conditions_prose && (
        <p className="mt-5 text-sm text-white/70 leading-relaxed relative">
          {beach.best_conditions_prose}
        </p>
      )}

      {(beach.wave_tips || beach.crowd_tips) && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {beach.wave_tips && (
            <div className="bg-white/5 rounded-xl p-4 border border-white/10 relative">
              <span className="text-xs text-white/60 uppercase tracking-wider block mb-1">
                Wave Tips
              </span>
              <p className="text-sm text-white/80 leading-relaxed">
                {beach.wave_tips}
              </p>
            </div>
          )}
          {beach.crowd_tips && (
            <div className="bg-white/5 rounded-xl p-4 border border-white/10 relative">
              <span className="text-xs text-white/60 uppercase tracking-wider block mb-1">
                Crowd Tips
              </span>
              <p className="text-sm text-white/80 leading-relaxed">
                {beach.crowd_tips}
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Helpers — mirror the conversion logic in BeachStatsGrid
// ---------------------------------------------------------------------------

function getWindCardinal(beach: Beach): string | null {
  if (beach.wind_offshore_deg == null || beach.wind_offshore_tol_deg == null) {
    return null;
  }
  return degreeWindowToCardinal(
    beach.wind_offshore_deg - beach.wind_offshore_tol_deg,
    beach.wind_offshore_deg + beach.wind_offshore_tol_deg,
  );
}

function getSwellCardinal(beach: Beach): string | null {
  return degreeWindowToCardinal(
    beach.swell_window_min_deg ?? null,
    beach.swell_window_max_deg ?? null,
  );
}

function getTidePreference(beach: Beach): string | null {
  const min = beach.preferred_tide_ft_min;
  const max = beach.preferred_tide_ft_max;
  const direction = beach.preferred_tide_direction;

  if (min == null && max == null && !direction) return null;

  const parts: string[] = [];

  if (min != null && max != null) {
    parts.push(`${min}\u2013${max} ft`);
  } else if (min != null) {
    parts.push(`${min}+ ft`);
  } else if (max != null) {
    parts.push(`${max} ft or lower`);
  }

  if (direction) {
    parts.push(direction);
  }

  return parts.join(", ");
}
