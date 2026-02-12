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
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
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
          <section key={region.slug} id={region.slug}>
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-roboto text-2xl font-bold text-gray-900">
                {region.name}
              </h2>
              <Link
                href={`/cams/${region.slug}`}
                className="text-sm font-medium text-ocean-blue hover:underline"
              >
                View all {regionBeaches.length} cams &rarr;
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
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
