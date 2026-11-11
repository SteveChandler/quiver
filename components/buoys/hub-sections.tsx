import Image from "next/image";
import Link from "next/link";

import { formatHeightFt, formatPeriod, compassPoint } from "@/lib/buoy-pages/format";
import { stationPath } from "@/lib/buoy-pages/geo-names";
import type { HubGroup, HubStation } from "@/lib/buoy-pages/hub-data";
import { STATUS_LABELS, type StationStatus } from "@/lib/buoy-pages/status";
import { getStaticMapImageUrlWithPins } from "@/lib/map-utils";
import { cn } from "@/lib/utils";

const STATUS_TEXT: Record<StationStatus, string> = {
  fresh: "text-[#0B5A3F]",
  stale: "text-[#6B4800]",
  offline: "text-[#11100D]/50",
};

export function HubMap({ pins, label }: { pins: Array<{ latitude: number; longitude: number }>; label: string }) {
  const src = getStaticMapImageUrlWithPins(
    pins.map((pin) => ({ ...pin, color: "0077B6" })),
    { width: 720, height: 360, padding: 40 },
  );
  if (!src) return null;
  return (
    <figure className="mb-10">
      <Image
        src={src}
        alt={label}
        width={720}
        height={360}
        unoptimized
        className="h-auto w-full border-2 border-[#11100D]"
      />
      <figcaption className="mt-1 text-xs text-[#655C4C]">Map © Mapbox © OpenStreetMap</figcaption>
    </figure>
  );
}

function StationRow({ item }: { item: HubStation }) {
  const { station, latest, status } = item;
  const height = latest ? formatHeightFt(latest.wave_height_m) : null;
  const period = latest ? formatPeriod(latest.dominant_period_s) : null;
  const direction = latest ? compassPoint(latest.mean_wave_direction_deg) : null;
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5" data-testid="buoy-hub-station">
      <Link href={stationPath(station.slug)} className="font-semibold text-[#11100D] underline-offset-2 hover:underline">
        {station.name}
        <span className="ml-2 font-mono text-xs font-normal text-[#11100D]/50">{station.source_station_id.toUpperCase()}</span>
      </Link>
      <span className="flex items-baseline gap-3 font-mono text-sm text-[#11100D]">
        {height ? <span>{[height, period, direction].filter(Boolean).join(" · ")}</span> : null}
        <span className={cn("text-xs font-bold uppercase tracking-[0.1em]", STATUS_TEXT[status])}>{STATUS_LABELS[status]}</span>
      </span>
    </li>
  );
}

export function HubStationList({ items }: { items: HubStation[] }) {
  return (
    <ul className="divide-y divide-[#11100D]/15 border-y-2 border-[#11100D]">
      {items.map((item) => (
        <StationRow key={item.station.id} item={item} />
      ))}
    </ul>
  );
}

export function HubGroups({ groups, regionHref }: { groups: HubGroup[]; regionHref?: (code: string) => string }) {
  return (
    <>
      {groups.map((group) => (
        <section key={group.code ?? "other"} className="mb-10" aria-labelledby={`group-${group.code ?? "other"}`}>
          <h2 id={`group-${group.code ?? "other"}`} className="mb-3 font-display text-2xl font-black uppercase text-[#11100D]">
            {group.code && regionHref ? (
              <Link href={regionHref(group.code)} className="underline-offset-4 hover:underline">
                {group.name}
              </Link>
            ) : (
              group.name
            )}
            <span className="ml-3 font-mono text-sm font-normal normal-case text-[#11100D]/55">
              {`${group.stations.length} ${group.stations.length === 1 ? "buoy" : "buoys"}`}
            </span>
          </h2>
          <HubStationList items={group.stations} />
        </section>
      ))}
    </>
  );
}

export function HubFootnote() {
  return (
    <p className="mt-8 max-w-3xl text-xs leading-5 text-[#655C4C]">
      Heights are significant wave height at each buoy, not surf height at a beach. Live: a wave reading in the
      last 3 hours. Stale: older than 3 hours. Offline: no wave reading in 30 days. Each buoy page names its
      data source and licence. Not for navigation.
    </p>
  );
}
