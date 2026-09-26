import Image from "next/image";

import { stationDistanceKm } from "@/lib/climatology/season-view";
import type { ClimatologyPlace, ClimatologyStation } from "@/lib/climatology/types";
import { getStaticMapImageUrlWithPins } from "@/lib/map-utils";

const PLACE_COLOR = "B04E1B";
const STATION_COLOR = "1F5F7A";

const placeLetter = (index: number): string => String.fromCharCode(97 + index);
const stationCode = (station: ClimatologyStation): string =>
  station.kind === "ndbc" ? `NDBC ${station.id}` : station.id;

interface StationMapProps {
  places: ClimatologyPlace[];
  stations: ClimatologyStation[];
}

export function StationMap({ places, stations }: StationMapProps) {
  const src = getStaticMapImageUrlWithPins(
    [
      ...places.map((place, index) => ({
        latitude: place.lat,
        longitude: place.lon,
        label: placeLetter(index),
        color: PLACE_COLOR,
      })),
      ...stations.map((station, index) => ({
        latitude: station.lat,
        longitude: station.lon,
        label: String(index + 1),
        color: STATION_COLOR,
      })),
    ],
    { width: 720, height: 360, padding: 48 },
  );

  return (
    <figure>
      {src && (
        <Image
          src={src}
          alt={`Map of ${places.map((place) => place.label).join(", ")} and the ${
            stations.length === 1 ? "station" : "stations"
          } used on this page`}
          width={720}
          height={360}
          unoptimized
          className="h-auto w-full rounded-lg border border-[#11100D]/15"
        />
      )}
      <figcaption className="mt-3 space-y-2 text-sm text-[#11100D]">
        <ul className="space-y-1">
          {places.map((place, index) => (
            <li key={place.label}>
              <span className="font-mono text-[#B04E1B]">{placeLetter(index)}</span>
              {` · ${place.label}`}
            </li>
          ))}
          {stations.map((station, index) => (
            <li key={station.id}>
              <span className="font-mono text-[#1F5F7A]">{index + 1}</span>
              {" · "}
              <span>
                {`${station.name} (${stationCode(station)}): ${places
                  .map((place) => `${stationDistanceKm(station, place)} km from ${place.label}`)
                  .join(", ")}`}
              </span>
            </li>
          ))}
        </ul>
        {src && <p className="text-xs text-[#655C4C]">Map © Mapbox © OpenStreetMap</p>}
      </figcaption>
    </figure>
  );
}
