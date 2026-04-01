/**
 * WaterTempSummaryHero — server-rendered above-the-fold summary for water-temp sub-pages.
 *
 * Renders immediately on the server so Google (and users) see the answer to
 * "what is the water temperature at [beach]?" without waiting for the client bundle.
 * Intentionally minimal — just the current temp and wetsuit call, scannable on mobile.
 */

import type { WaterTempMetaData } from "@/lib/seo/water-temp-meta-data";
import { Thermometer, ArrowDown } from "lucide-react";

export interface WaterTempSummaryHeroProps {
  beachName: string;
  waterTempData: WaterTempMetaData;
}

/** Convert Fahrenheit to Celsius, rounded to one decimal place. */
function toCelsius(f: number): number {
  return Math.round(((f - 32) * 5) / 9);
}

/**
 * Map a temperature range to a descriptive label and color hint.
 * These correspond to the retro dark design system colors.
 */
function getTempProfile(tempF: number): {
  label: string;
  colorStyle: React.CSSProperties;
  borderStyle: React.CSSProperties;
} {
  if (tempF >= 75) {
    return {
      label: "Warm",
      colorStyle: { color: "#F78E42" },
      borderStyle: { borderColor: "rgba(247, 142, 66, 0.4)" },
    };
  }
  if (tempF >= 65) {
    return {
      label: "Mild",
      colorStyle: { color: "#FDB84B" },
      borderStyle: { borderColor: "rgba(253, 184, 75, 0.35)" },
    };
  }
  if (tempF >= 55) {
    return {
      label: "Cool",
      colorStyle: { color: "#B8C7E0" },
      borderStyle: { borderColor: "rgba(184, 199, 224, 0.3)" },
    };
  }
  return {
    label: "Cold",
    colorStyle: { color: "#93B4D8" },
    borderStyle: { borderColor: "rgba(147, 180, 216, 0.3)" },
  };
}

export function WaterTempSummaryHero({
  beachName,
  waterTempData,
}: WaterTempSummaryHeroProps) {
  const { tempF, wetsuitRec } = waterTempData;

  // Don't render the hero if we have no temperature data.
  if (tempF === null) return null;

  const tempC = toCelsius(tempF);
  const profile = getTempProfile(tempF);

  return (
    <section
      aria-label={`Current water temperature at ${beachName}`}
      className="noise-texture w-full"
      style={{
        background:
          "linear-gradient(180deg, #1E2558 0%, #252D6B 60%, rgba(37,45,107,0) 100%)",
        borderBottom: "1px solid rgba(64, 76, 146, 0.4)",
      }}
    >
      <div className="container mx-auto px-4 py-6 sm:py-8">
        {/* Heading row */}
        <div className="mb-5">
          <h1 className="font-heading text-2xl font-bold leading-tight text-high sm:text-3xl">
            {beachName} Water Temp & Wetsuit Guide
          </h1>
        </div>

        {/* Primary data: temperature display */}
        <div className="flex flex-wrap items-end gap-5 sm:gap-8">
          {/* Large temperature badge — sticker aesthetic with slight rotation */}
          <div
            className="noise-texture flex flex-col items-center justify-center rounded-2xl border px-6 py-5"
            style={{
              background:
                "linear-gradient(135deg, rgba(47, 57, 120, 0.9) 0%, rgba(37, 45, 107, 0.95) 100%)",
              ...profile.borderStyle,
              transform: "rotate(-1.5deg)",
              minWidth: "140px",
            }}
          >
            <span className="flex items-center gap-1.5 text-xs font-mono font-semibold uppercase tracking-widest text-medium">
              <Thermometer className="h-3.5 w-3.5" aria-hidden="true" style={profile.colorStyle} />
              Water Temp
            </span>
            <span
              className="font-heading text-5xl font-bold leading-none mt-1.5"
              style={profile.colorStyle}
              aria-label={`${tempF} degrees Fahrenheit, ${tempC} degrees Celsius`}
            >
              {tempF}°
            </span>
            <div className="mt-1 flex items-center gap-2 font-mono text-sm font-medium text-medium">
              <span>{tempF}°F</span>
              <span aria-hidden="true" className="opacity-40">/</span>
              <span>{tempC}°C</span>
            </div>
            {/* Temperature descriptor badge */}
            <span
              className="mt-2 rounded-full px-2.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wider"
              style={{
                background: "rgba(255,255,255,0.07)",
                ...profile.colorStyle,
              }}
            >
              {profile.label}
            </span>
          </div>

          {/* Wetsuit recommendation */}
          {wetsuitRec && (
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-xs font-semibold uppercase tracking-widest text-medium">
                Recommended Wetsuit
              </span>
              <div
                className="noise-texture inline-flex items-center gap-2 rounded-xl border px-4 py-3"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(37, 45, 107, 0.9) 0%, rgba(30, 37, 88, 0.95) 100%)",
                  borderColor: "rgba(184, 199, 224, 0.2)",
                  transform: "rotate(0.75deg)",
                }}
              >
                {/* Wetsuit icon — simple visual shorthand */}
                <span
                  className="text-2xl"
                  role="img"
                  aria-hidden="true"
                >
                  🤿
                </span>
                <span className="font-heading text-lg font-bold text-high">
                  {wetsuitRec}
                </span>
              </div>
              <p className="text-xs text-medium leading-relaxed max-w-[220px]">
                Based on current water temperature
              </p>
            </div>
          )}
        </div>

        {/* Anchor link to seasonal trends below */}
        <div className="mt-5">
          <a
            href="#seasonal-trends"
            className="inline-flex items-center gap-1.5 text-sm text-medium transition-colors hover:text-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42] focus-visible:ring-offset-2 focus-visible:ring-offset-[#252D6B]"
            aria-label="Scroll to seasonal temperature trends"
          >
            <Thermometer className="h-4 w-4" aria-hidden="true" />
            See seasonal trends below
            <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}
