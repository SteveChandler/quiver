"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { WaterQuality } from "@/components/beach-detail/water-quality-badge";
import { useSunTimes } from "@/hooks/use-sun-times";
import { formatBeachDateTime } from "@/lib/utils/date-time";
import type { TideMetaData } from "@/lib/seo/tide-meta-data";
import type { WaterTempMetaData } from "@/lib/seo/water-temp-meta-data";

export interface BeachDayColumnProps {
  beachId: string;
  timezone: string;
  localDate: string;
  waterTemp: WaterTempMetaData | null;
  tide: TideMetaData | null;
  waterQuality: WaterQuality | null;
  links: { waterTemp: string | null; tides: string | null };
}

function Tile({ label, value, detail, link }: { label: string; value: string; detail?: string | null; link?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-[#F4EBD8] px-4 py-3.5 text-[#11100D]">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#6b5a3a]">{label}</p>
      <p className="zine-display mt-1 text-2xl">{value}</p>
      {detail ? <p className="text-sm text-[#3d3326]">{detail}</p> : null}
      {link}
    </div>
  );
}

function TileLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="mt-2 inline-block border-b-2 border-[#F78E42] text-xs font-bold">
      {children}
    </Link>
  );
}

/** Beachgoers' answer. Water quality appears only as an advisory; "no notice" is not "clean". */
export function BeachDayColumn({ beachId, timezone, localDate, waterTemp, tide, waterQuality, links }: BeachDayColumnProps) {
  const { sunrise, sunset } = useSunTimes(beachId, localDate);
  const advisory = waterQuality?.status === "advisory" || waterQuality?.status === "closure" ? waterQuality.status : null;

  return (
    <section aria-labelledby="beach-day-heading" data-testid="beach-day-column">
      <h2 id="beach-day-heading" className="zine-display text-xl uppercase text-[#F5EEDC]">
        Beach day
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {waterTemp?.tempF != null ? (
          <Tile
            label="Water"
            value={`${waterTemp.tempF}°F`}
            detail={waterTemp.wetsuitRec}
            link={links.waterTemp ? <TileLink href={links.waterTemp}>Water temp →</TileLink> : null}
          />
        ) : null}
        {tide?.nextLowTime ? (
          <Tile
            label="Next low tide"
            value={tide.nextLowTime}
            detail={tide.nextHighTime ? `High ${tide.nextHighTime}` : null}
            link={links.tides ? <TileLink href={links.tides}>Tide chart →</TileLink> : null}
          />
        ) : null}
        {sunrise && sunset ? (
          <Tile
            label="Daylight"
            value={`${formatBeachDateTime(sunrise, timezone, "h:mm a")}–${formatBeachDateTime(sunset, timezone, "h:mm a")}`}
          />
        ) : null}
        {advisory ? (
          <Tile label="Water quality" value={advisory === "closure" ? "Closed" : "Advisory"} detail="Check county notices before going in." />
        ) : null}
      </div>
    </section>
  );
}
