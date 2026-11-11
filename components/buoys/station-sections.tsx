import Link from "next/link";

import {
  compassPoint,
  formatCoordinate,
  formatDistanceKm,
  formatHeightFt,
  formatPeriod,
  formatPressure,
  formatStationTime,
  formatTempC,
  formatTempF,
  formatWindKnots,
} from "@/lib/buoy-pages/format";
import { stationPath } from "@/lib/buoy-pages/geo-names";
import type { NearbyBuoy, StationBeachView } from "@/lib/buoy-pages/station-page-data";
import { STATUS_LABELS } from "@/lib/buoy-pages/status";
import type { WaveStationObservationRow, WaveStationRow } from "@/lib/services/wave-stations/types";
import { licenseLabel, licenseUrl } from "@/lib/seo/buoy-meta";

export const SECTION = "mb-12";
export const HEADING = "mb-4 font-display text-2xl font-black uppercase text-[#11100D]";
const NOTE = "mt-3 max-w-3xl text-xs leading-5 text-[#655C4C]";

export function StationBeaches({
  relation,
  items,
  moreCount,
  forecastsLoaded,
}: {
  relation: "fed_by" | "nearby";
  items: StationBeachView[];
  moreCount: number;
  forecastsLoaded: boolean;
}) {
  if (items.length === 0) return null;
  const fedBy = relation === "fed_by";
  return (
    <section className={SECTION} aria-labelledby="buoy-beaches-heading" data-testid="buoy-beaches" data-relation={relation}>
      <h2 id="buoy-beaches-heading" className={HEADING}>
        {fedBy ? "Beaches whose Quiver forecast uses this buoy" : "Nearby beaches"}
      </h2>
      {!fedBy ? (
        <p className="-mt-2 mb-4 max-w-3xl text-sm text-[#11100D]/70">
          Listed by distance only. Their Quiver forecasts are not linked to this buoy.
        </p>
      ) : null}
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((beach) => {
          const label = beach.summary?.forecastLabel;
          const name = beach.summary?.href ? (
            <Link href={beach.summary.href} className="font-semibold text-[#11100D] underline-offset-2 hover:underline">
              {beach.name}
            </Link>
          ) : (
            <span className="font-semibold text-[#11100D]">{beach.name}</span>
          );
          return (
            <li key={beach.id} className="border-2 border-[#11100D] bg-[#FFFDF7] p-3">
              <div className="flex items-baseline justify-between gap-3">
                {name}
                <span className="shrink-0 font-mono text-xs text-[#11100D]/60">{formatDistanceKm(beach.distanceKm)}</span>
              </div>
              <p className="mt-1 text-sm text-[#11100D]/75">
                {label ? (
                  <>
                    Quiver forecast now: <span className="font-mono font-bold text-[#11100D]">{label}</span>
                  </>
                ) : forecastsLoaded ? (
                  "No current Quiver forecast"
                ) : (
                  "Quiver forecast unavailable right now"
                )}
              </p>
            </li>
          );
        })}
      </ul>
      {moreCount > 0 ? (
        <p className="mt-3 text-sm text-[#11100D]/75">
          {`+${moreCount} more ${moreCount === 1 ? "beach" : "beaches"} ${fedBy ? "use this buoy" : "nearby"}, further away.`}
        </p>
      ) : null}
      <p className={NOTE}>
        Beach numbers are each beach&apos;s own Quiver forecast, not a conversion of this buoy reading.
      </p>
    </section>
  );
}

export function NearbyBuoys({ items }: { items: NearbyBuoy[] }) {
  if (items.length === 0) return null;
  return (
    <section className={SECTION} aria-labelledby="buoy-nearby-heading" data-testid="buoy-nearby">
      <h2 id="buoy-nearby-heading" className={HEADING}>Nearby buoys</h2>
      <ul className="divide-y divide-[#11100D]/15 border-y-2 border-[#11100D]">
        {items.map(({ station, distanceKm, latest, status }) => (
          <li key={station.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
            <Link href={stationPath(station.slug)} className="font-semibold text-[#11100D] underline-offset-2 hover:underline">
              {station.name}
            </Link>
            <span className="flex items-baseline gap-3 font-mono text-sm text-[#11100D]">
              {status !== "offline" && latest ? (
                <span>
                  {formatHeightFt(latest.wave_height_m)}
                  {formatPeriod(latest.dominant_period_s) ? ` · ${formatPeriod(latest.dominant_period_s)}` : ""}
                </span>
              ) : null}
              <span className="text-xs uppercase tracking-[0.1em] text-[#11100D]/55">
                {STATUS_LABELS[status]} · {formatDistanceKm(distanceKm)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Optional slot for the nearest tide station. Tide station pages are built on
 * another branch (/tides/station/[slug]); until they ship this renders nothing.
 */
export function TideStationSlot({ tideStation }: { tideStation?: { slug: string; name: string } | null }) {
  if (!tideStation) return null;
  return (
    <p className="mb-12 text-sm">
      Nearest tide station:{" "}
      <Link href={`/tides/station/${tideStation.slug}`} className="underline underline-offset-2">
        {tideStation.name}
      </Link>
    </p>
  );
}

export function OtherReadings({
  observation,
  timeZone,
}: {
  observation: WaveStationObservationRow | null;
  timeZone: string;
}) {
  if (!observation) return null;
  const windDirection = compassPoint(observation.wind_direction_deg);
  const wind = formatWindKnots(observation.wind_speed_ms);
  const rows = [
    { label: "Water temperature", value: observation.water_temp_c === null ? null : `${formatTempF(observation.water_temp_c)} (${formatTempC(observation.water_temp_c)})` },
    { label: "Wind", value: wind ? `${wind}${windDirection ? ` from the ${windDirection}` : ""}${observation.wind_gust_ms !== null ? `, gusts ${formatWindKnots(observation.wind_gust_ms)}` : ""}` : null },
    { label: "Air temperature", value: observation.air_temp_c === null ? null : `${formatTempF(observation.air_temp_c)} (${formatTempC(observation.air_temp_c)})` },
    { label: "Pressure", value: formatPressure(observation.pressure_hpa) },
  ].filter((row): row is { label: string; value: string } => Boolean(row.value));
  if (rows.length === 0) return null;
  return (
    <section className={SECTION} aria-labelledby="buoy-other-heading" data-testid="buoy-other-readings">
      <h2 id="buoy-other-heading" className={HEADING}>Other readings</h2>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="border-b border-[#11100D]/15 pb-2">
            <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#11100D]/55">{row.label}</dt>
            <dd className="text-[15px] text-[#11100D]">{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className={NOTE}>{`Reported ${formatStationTime(observation.observed_at, timeZone)}.`}</p>
    </section>
  );
}

/** Open-ocean zones are named "Etc/GMT+8" (sign inverted); show them as "GMT-8 (open ocean)". */
function timeZoneLabel(timeZone: string): string {
  if (!timeZone.startsWith("Etc/")) return timeZone;
  const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
    .formatToParts(new Date(0))
    .find((part) => part.type === "timeZoneName")?.value;
  return `${name ?? timeZone} (open ocean)`;
}

function sourceStationUrl(station: WaveStationRow): string | null {
  if (station.source !== "ndbc") return null;
  return `https://www.ndbc.noaa.gov/station_page.php?station=${encodeURIComponent(station.source_station_id.toLowerCase())}`;
}

const STATION_TYPE_LABELS: Record<string, string> = {
  buoy: "Moored buoy",
  fixed: "Fixed station",
  oilrig: "Offshore platform",
  dart: "Tsunami buoy",
  tao: "Tropical array buoy",
};

export function StationFacts({
  station,
  timeZone,
  explainer,
}: {
  station: WaveStationRow;
  timeZone: string;
  explainer: string[];
}) {
  const sourceUrl = sourceStationUrl(station);
  const license = licenseUrl(station.license);
  const facts = [
    { label: "Station id", value: station.source_station_id.toUpperCase() },
    station.cdip_station_id ? { label: "CDIP id", value: station.cdip_station_id } : null,
    station.owner ? { label: "Operator", value: station.owner } : null,
    station.program ? { label: "Program", value: station.program } : null,
    { label: "Position", value: `${formatCoordinate(station.lat, "lat")}, ${formatCoordinate(station.lon, "lon")}` },
    station.station_type ? { label: "Type", value: STATION_TYPE_LABELS[station.station_type] ?? station.station_type } : null,
    { label: "Local time zone", value: timeZoneLabel(timeZone) },
    { label: "Swell split", value: station.has_swell_split ? "Yes, swell and wind waves reported" : "No, whole-sea numbers only" },
  ].filter((fact): fact is { label: string; value: string } => fact !== null);

  return (
    <section className={SECTION} aria-labelledby="buoy-facts-heading" data-testid="buoy-facts">
      <h2 id="buoy-facts-heading" className={HEADING}>How to read this buoy</h2>
      {explainer.length > 0 ? (
        <div className="mb-6 max-w-3xl space-y-3 text-[15px] leading-7 text-[#11100D]">
          {explainer.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      ) : null}
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {facts.map((fact) => (
          <div key={fact.label} className="flex justify-between gap-3 border-b border-[#11100D]/15 py-1.5">
            <dt className="text-[#11100D]/60">{fact.label}</dt>
            <dd className="text-right font-mono text-[#11100D]">{fact.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-sm text-[#11100D]" data-testid="buoy-attribution">
        Source: {station.attribution}.{" "}
        Licence:{" "}
        {license ? (
          <a href={license} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            {licenseLabel(station.license)}
          </a>
        ) : (
          licenseLabel(station.license)
        )}
        .
        {sourceUrl ? (
          <>
            {" "}
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              Station page at the source
            </a>
            .
          </>
        ) : null}
      </p>
      <p className="mt-2 text-sm font-semibold text-[#11100D]" data-testid="buoy-not-for-navigation">
        Not for navigation. Readings can be late, missing or wrong; check official marine forecasts before going to sea.
      </p>
    </section>
  );
}

export function BuoyGlossary() {
  const terms = [
    ["Significant height", "The average of the biggest third of waves the buoy measured. Sets in the surf zone can be bigger or smaller."],
    ["Dominant period", "Seconds between the waves carrying the most energy. Longer period means more power and more bend around points."],
    ["Swell vs wind waves", "Swell was made by distant wind; wind waves were made nearby. The buoy splits its spectrum at a cutoff period to report each."],
    ["Direction", "Where waves come from, in degrees true. 270° is from the west."],
  ];
  return (
    <section className={SECTION} aria-labelledby="buoy-glossary-heading">
      <h2 id="buoy-glossary-heading" className={HEADING}>Buoy terms</h2>
      <dl className="grid gap-4 sm:grid-cols-2">
        {terms.map(([term, definition]) => (
          <div key={term}>
            <dt className="font-semibold text-[#11100D]">{term}</dt>
            <dd className="mt-1 text-sm leading-6 text-[#11100D]/80">{definition}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
