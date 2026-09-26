import type { ClimatologyStation } from "@/lib/climatology/types";

export function describeStationSource(station: ClimatologyStation, scoreVersion: string): string {
  const years = `${station.yearsUsed[0]}–${station.yearsUsed[1]}`;
  const hours = station.validHours.toLocaleString("en-US");
  if (station.kind === "iem-asos") {
    return `Analysis by Quiver of ${station.name} (${station.id}) hourly weather observations from the Iowa Environmental Mesonet ASOS archive, ${years}, ${hours} hours. Method ${scoreVersion}.`;
  }
  const alias = station.alias ? ` (${station.alias})` : "";
  return `Analysis by Quiver of NOAA NDBC station ${station.id}${alias} hourly observations, ${years}, ${hours} hours. Method ${scoreVersion}.`;
}

interface SourceLineProps {
  station: ClimatologyStation;
  scoreVersion: string;
}

export function SourceLine({ station, scoreVersion }: SourceLineProps) {
  return (
    <p className="mt-2 text-xs leading-5 text-[#655C4C]">
      {describeStationSource(station, scoreVersion)}{" "}
      <a href={station.pageUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
        Station page
      </a>
    </p>
  );
}
