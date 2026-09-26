import { formatShare, type SeasonMonthView } from "@/lib/climatology/season-view";
import type { ClimatologyStation } from "@/lib/climatology/types";

const DASH = "—";
const HEADERS = [
  "Month",
  "Buoy score",
  "Buoy median (typical)",
  "Days 6 ft+",
  "Days under 2 ft",
  "Swell 10 s+",
  "Water",
  "Wetsuit",
] as const;

interface BuoyMonthTableProps {
  months: SeasonMonthView[];
  station: ClimatologyStation;
}

export function BuoyMonthTable({ months, station }: BuoyMonthTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#11100D]/15 bg-white">
      <table className="w-full min-w-[720px] text-left text-sm text-[#11100D]">
        <caption className="px-4 py-3 text-left text-xs text-[#655C4C]">
          {`Monthly record at ${station.name}, ${station.yearsUsed[0]}–${station.yearsUsed[1]}. Heights are buoy readings, not surf at the beach.`}
        </caption>
        <thead className="bg-[#FBF6E8] text-xs uppercase tracking-wide text-[#655C4C]">
          <tr>
            {HEADERS.map((header) => (
              <th key={header} scope="col" className="px-4 py-2 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {months.map((month) => (
            <tr key={month.month} className="border-t border-[#11100D]/10">
              <th scope="row" className="px-4 py-2 font-semibold">
                {month.name}
                {month.isPeak && (
                  <span className="ml-2 text-xs font-medium uppercase tracking-wide text-[#B04E1B]">Peak</span>
                )}
              </th>
              <td className="px-4 py-2 tabular-nums">{month.score ?? DASH}</td>
              <td className="px-4 py-2 tabular-nums">
                {month.waves
                  ? `${month.waves.hsFt.median} ft (${month.waves.hsFt.p25}–${month.waves.hsFt.p75})`
                  : DASH}
              </td>
              <td className="px-4 py-2 tabular-nums">{month.waves ? formatShare(month.waves.bigDayShare) : DASH}</td>
              <td className="px-4 py-2 tabular-nums">{month.waves ? formatShare(month.waves.smallDayShare) : DASH}</td>
              <td className="px-4 py-2 tabular-nums">
                {month.waves ? formatShare(month.waves.periodMix.atLeast10) : DASH}
              </td>
              <td className="px-4 py-2 tabular-nums">{month.waterMedianF !== null ? `${month.waterMedianF}°F` : DASH}</td>
              <td className="px-4 py-2">{month.wetsuit ?? DASH}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
