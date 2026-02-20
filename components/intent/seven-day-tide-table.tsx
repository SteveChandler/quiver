"use client";

import { ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTideHeight } from "@/lib/formatters/surf-data";
import type { TideDayExtrema, TideExtremaEvent } from "@/actions/forecast/intent-forecast-actions";

interface SevenDayTideTableProps {
  days: TideDayExtrema[];
}

function TideEventCell({ event }: { event: TideExtremaEvent | undefined }) {
  if (!event) {
    return <span className="text-gray-300">--</span>;
  }

  const Icon = event.type === "high" ? ArrowUp : ArrowDown;
  const colorClass =
    event.type === "high" ? "text-blue-600" : "text-indigo-500";

  return (
    <span className="inline-flex items-center gap-1">
      <Icon className={cn("h-3.5 w-3.5", colorClass)} />
      <span className="font-medium">{event.timeFormatted}</span>
      <span className="text-gray-500 text-xs">({formatTideHeight(event.height)})</span>
    </span>
  );
}

/**
 * SevenDayTideTable - 7-day high/low tide schedule
 *
 * Desktop: horizontal table with Day | High 1 | Low 1 | High 2 | Low 2
 * Mobile: stacked card-per-day layout
 * Today's row highlighted
 */
export function SevenDayTideTable({ days }: SevenDayTideTableProps) {
  if (days.length === 0) {
    return null;
  }

  return (
    <section>
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">
        7-Day Tide Schedule
      </h2>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
        <table className="w-full text-sm">
          <caption className="sr-only">7-day tide schedule showing high and low tides</caption>
          <thead>
            <tr className="bg-gray-50 text-gray-600">
              <th className="text-left py-3 px-4 font-medium">Day</th>
              <th className="text-left py-3 px-4 font-medium">High 1</th>
              <th className="text-left py-3 px-4 font-medium">Low 1</th>
              <th className="text-left py-3 px-4 font-medium">High 2</th>
              <th className="text-left py-3 px-4 font-medium">Low 2</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {days.map((day) => {
              const highs = day.events.filter((e) => e.type === "high");
              const lows = day.events.filter((e) => e.type === "low");

              return (
                <tr
                  key={day.date}
                  className={cn(
                    "transition-colors",
                    day.isToday
                      ? "bg-blue-50 border-l-2 border-l-blue-500"
                      : "hover:bg-gray-50/50"
                  )}
                >
                  <td className="py-3 px-4 font-medium text-gray-800">
                    {day.label}
                  </td>
                  <td className="py-3 px-4">
                    <TideEventCell event={highs[0]} />
                  </td>
                  <td className="py-3 px-4">
                    <TideEventCell event={lows[0]} />
                  </td>
                  <td className="py-3 px-4">
                    <TideEventCell event={highs[1]} />
                  </td>
                  <td className="py-3 px-4">
                    <TideEventCell event={lows[1]} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Stacked Cards */}
      <div className="md:hidden space-y-3">
        {days.map((day) => {
          const highs = day.events.filter((e) => e.type === "high");
          const lows = day.events.filter((e) => e.type === "low");

          return (
            <div
              key={day.date}
              className={cn(
                "rounded-xl border p-4 shadow-sm",
                day.isToday
                  ? "bg-blue-50 border-blue-200"
                  : "bg-white border-gray-200"
              )}
            >
              <p className="font-semibold text-gray-800 mb-2">{day.label}</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {highs.map((h) => (
                  <div key={`h-${h.time}`} className="flex items-center gap-1.5">
                    <ArrowUp className="h-3.5 w-3.5 text-blue-600" />
                    <span>
                      {h.timeFormatted}{" "}
                      <span className="text-gray-500">
                        ({formatTideHeight(h.height)})
                      </span>
                    </span>
                  </div>
                ))}
                {lows.map((l) => (
                  <div key={`l-${l.time}`} className="flex items-center gap-1.5">
                    <ArrowDown className="h-3.5 w-3.5 text-indigo-500" />
                    <span>
                      {l.timeFormatted}{" "}
                      <span className="text-gray-500">
                        ({formatTideHeight(l.height)})
                      </span>
                    </span>
                  </div>
                ))}
                {day.events.length === 0 && (
                  <p className="col-span-2 text-gray-400 text-xs">
                    No data available
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
