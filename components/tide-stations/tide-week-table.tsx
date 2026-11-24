import { formatDateKey, formatFeet, formatStationTime } from "@/lib/tide-stations/format";
import type { TideDay } from "@/lib/tide-stations/series";

interface TideWeekTableProps {
  days: TideDay[];
  timeZone: string;
}

export function TideWeekTable({ days, timeZone }: TideWeekTableProps) {
  if (!days.length) return null;
  return (
    <div className="overflow-x-auto border-2 border-[#11100D] bg-[#FBF6E8]">
      <table className="w-full text-left text-sm" data-testid="tide-week-table">
        <caption className="sr-only">High and low tides for the next seven days</caption>
        <thead>
          <tr className="border-b-2 border-[#11100D] font-mono text-[11px] uppercase tracking-[0.12em] text-[#11100D]/70">
            <th scope="col" className="px-2 py-2 sm:px-3">Day</th>
            <th scope="col" className="px-2 py-2 sm:px-3">Tides (local time, height)</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.dateKey} className="border-b border-[#11100D]/15 align-top last:border-b-0">
              <th scope="row" className="whitespace-nowrap px-2 py-2 font-semibold sm:px-3 text-[#11100D]">
                {formatDateKey(day.dateKey)}
              </th>
              <td className="px-2 py-2 sm:px-3">
                <ul className="flex flex-wrap gap-x-5 gap-y-1">
                  {day.extremes.map((e) => (
                    <li key={e.ts} className="whitespace-nowrap font-mono text-[#11100D]">
                      <span className={e.type === "high" ? "font-bold" : "text-[#11100D]/75"}>
                        {e.type === "high" ? "H" : "L"}
                      </span>{" "}
                      {formatStationTime(e.ts, timeZone)} · {formatFeet(e.heightM)}
                    </li>
                  ))}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
