import { BestSurfWindows } from "@/components/session-intelligence";
import type { SurfWindowRecommendation } from "@/types/session-intelligence";

export interface RegionalBestSurfWindowsProps {
  regionName: string;
  recommendations?: SurfWindowRecommendation[];
  variant?: "default" | "zine";
}

export function RegionalBestSurfWindows({
  regionName,
  recommendations = [],
  variant = "default",
}: RegionalBestSurfWindowsProps) {
  const visibleRecommendations = recommendations.slice(0, 5);
  const isZine = variant === "zine";

  if (visibleRecommendations.length === 0) {
    return (
      <section
        id="best-windows-this-week"
        data-testid="regional-best-surf-windows"
        aria-labelledby="best-windows-this-week-heading"
        className={
          isZine
            ? "torn torn-tb mb-10 border-2 border-[#11100D] bg-[#FBF6E8] px-5 py-6"
            : "mb-10 rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-6"
        }
      >
        <h2
          id="best-windows-this-week-heading"
          className={
            isZine
              ? "font-display text-3xl font-black uppercase leading-tight text-[#11100D]"
              : "font-[var(--font-heading)] text-2xl font-bold text-white"
          }
        >
          Best windows this week
        </h2>
        <p
          className={
            isZine
              ? "mt-2 text-sm text-[#11100D]/64"
              : "mt-2 text-sm text-white/64"
          }
          role="status"
        >
          Best windows are still building for {regionName}.
        </p>
      </section>
    );
  }

  return (
    <section
      id="best-windows-this-week"
      data-testid="regional-best-surf-windows"
      aria-labelledby="best-windows-this-week-heading"
      className={
        isZine
          ? "torn torn-tb mb-10 border-2 border-[#11100D] bg-[#FBF6E8] px-5 py-6 sm:px-6"
          : "mb-10"
      }
    >
      <BestSurfWindows
        recommendations={visibleRecommendations}
        maxItems={5}
        title="Best windows this week"
        subtitle={`The strongest upcoming surf calls across ${regionName}.`}
        surface="regional_forecast"
        variant={variant}
      />
    </section>
  );
}
