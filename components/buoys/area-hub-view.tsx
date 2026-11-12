import Link from "next/link";

import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { ItemListSchema } from "@/components/seo/item-list-schema";
import { QuiverSticker, ZineSurface } from "@/components/zine";
import { stationPath } from "@/lib/buoy-pages/geo-names";
import { mapPins, type AreaHub } from "@/lib/buoy-pages/hub-data";
import { absoluteUrl } from "@/lib/seo/buoy-meta";
import { HubFootnote, HubGroups, HubMap } from "./hub-sections";

interface AreaHubViewProps {
  hub: AreaHub;
  title: string;
  breadcrumbs: Array<{ name: string; path: string }>;
  regionHref?: (code: string) => string;
}

/** Shared body of the country and region hubs. */
export function AreaHubView({ hub, title, breadcrumbs, regionHref }: AreaHubViewProps) {
  const stations = hub.groups.flatMap((group) => group.stations);
  return (
    <>
      <BreadcrumbStructuredData items={breadcrumbs.map((crumb) => ({ name: crumb.name, url: absoluteUrl(crumb.path) }))} />
      <ItemListSchema
        name={`${title} wave buoys`}
        items={stations
          .filter((item) => item.indexable)
          .map((item, index) => ({ name: item.station.name, url: absoluteUrl(stationPath(item.station.slug)), position: index + 1 }))}
      />
      <ZineSurface sectionLabel="Buoys" data-testid="buoy-area-hub-page">
        <main>
          <nav aria-label="Breadcrumb" className="mb-6 font-mono text-xs uppercase tracking-[0.12em] text-[#11100D]/62">
            <ol className="flex flex-wrap items-center gap-1.5">
              {breadcrumbs.slice(0, -1).map((crumb) => (
                <li key={crumb.path} className="flex items-center gap-1.5">
                  <Link href={crumb.path} className="hover:text-[#B56A2B] hover:underline">
                    {crumb.name}
                  </Link>
                  <span aria-hidden>/</span>
                </li>
              ))}
            </ol>
          </nav>
          <header className="relative mb-8">
            <QuiverSticker sticker="orangeMap" className="absolute -right-4 -top-6 hidden w-28 -rotate-6 opacity-80 lg:block" />
            <h1 className="zine-h1 font-black uppercase leading-[0.9] text-[#11100D] [overflow-wrap:anywhere] [hyphens:auto]">{`${title} wave buoys`}</h1>
            <p className="mt-4 font-mono text-sm uppercase tracking-[0.12em] text-[#11100D]/65" data-testid="buoy-hub-counts">
              {`${hub.stationCount} ${hub.stationCount === 1 ? "buoy" : "buoys"} · ${hub.liveCount} live now`}
            </p>
          </header>
          <HubMap pins={mapPins(stations.map((item) => item.station))} label={`Map of wave buoys in ${title}`} />
          <HubGroups groups={hub.groups} regionHref={regionHref} />
          <HubFootnote />
        </main>
      </ZineSurface>
    </>
  );
}
