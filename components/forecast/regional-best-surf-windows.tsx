import { BestSurfWindows } from "@/components/session-intelligence";
import type { SurfWindowRecommendation } from "@/types/session-intelligence";

export interface RegionalBestSurfWindowsProps {
  regionName: string;
  recommendations?: SurfWindowRecommendation[];
}

export function RegionalBestSurfWindows({
  regionName,
  recommendations = [],
}: RegionalBestSurfWindowsProps) {
  const visibleRecommendations = recommendations.slice(0, 3);

  if (visibleRecommendations.length === 0) {
    return (
      <section
        id="best-windows-this-week"
        data-testid="regional-best-surf-windows"
        aria-labelledby="best-windows-this-week-heading"
        className="mb-10 rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-6"
      >
        <h2
          id="best-windows-this-week-heading"
          className="font-[var(--font-heading)] text-2xl font-bold text-white"
        >
          Best windows this week
        </h2>
        <p className="mt-2 text-sm text-white/64" role="status">
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
      className="mb-10"
    >
      <BestSurfWindows
        recommendations={visibleRecommendations}
        title="Best windows this week"
        subtitle={`The strongest upcoming surf calls across ${regionName}.`}
        surface="regional_forecast"
      />
    </section>
  );
}
