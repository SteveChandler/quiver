import type { CamBeachWithRegion } from "@/actions/beach/cam-actions";
import { CAM_REGIONS } from "@/lib/data/cam-regions";
import { CamCard } from "./cam-card";
import Link from "next/link";

interface CamGridProps {
  beaches: CamBeachWithRegion[];
  /** When true, groups cameras by region with section headers */
  groupByRegion?: boolean;
}

/**
 * Grid of camera cards, optionally grouped by region.
 * Used on both the /cams hub (grouped) and /cams/[region] pages (flat).
 */
export function CamGrid({ beaches, groupByRegion = false }: CamGridProps) {
  if (!groupByRegion) {
    return (
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {beaches.map((beach) => (
          <CamCard key={beach.id} beach={beach} />
        ))}
      </div>
    );
  }

  // Group beaches by region, maintaining CAM_REGIONS display order
  const grouped = new Map<string, CamBeachWithRegion[]>();
  for (const beach of beaches) {
    const existing = grouped.get(beach.regionSlug) ?? [];
    existing.push(beach);
    grouped.set(beach.regionSlug, existing);
  }

  return (
    <div className="space-y-12">
      {CAM_REGIONS.map((region) => {
        const regionBeaches = grouped.get(region.slug);
        if (!regionBeaches || regionBeaches.length === 0) return null;

        return (
          <section key={region.slug} id={region.slug} className="scroll-mt-24">
            <div className="mb-5 flex items-end justify-between gap-4 border-b-2 border-[#11100D] pb-3">
              <h2 className="font-[var(--font-zine-display)] text-3xl uppercase leading-none tracking-normal text-[#11100D] sm:text-4xl">
                {region.name}
              </h2>
              <Link
                href={`/cams/${region.slug}`}
                className="font-mono text-xs font-black uppercase tracking-[0.12em] text-[#0B3A75] underline decoration-[#F78E42] decoration-2 underline-offset-4 transition hover:text-[#11100D]"
              >
                {/* One string expression: SWC eats the leading space of a
                    multi-line JSX text child that contains an HTML entity. */}
                {`View all ${regionBeaches.length} ${
                  regionBeaches.length === 1 ? "cam" : "cams"
                } →`}
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {regionBeaches.map((beach) => (
                <CamCard key={beach.id} beach={beach} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
