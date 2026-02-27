import { cn } from "@/lib/utils";
import type { CitySunTimesData } from "@/actions/forecast/intent-forecast-actions";

interface SevenDaySunTimesTableProps {
  days: CitySunTimesData["sevenDayTimes"];
}

/**
 * SevenDaySunTimesTable - 7-day sunrise/sunset schedule
 *
 * Desktop: horizontal table with Day | Sunrise | Sunset | Day Length
 * Mobile: stacked card-per-day layout
 * Today's row highlighted
 */
export function SevenDaySunTimesTable({ days }: SevenDaySunTimesTableProps) {
  if (days.length === 0) {
    return null;
  }

  return (
    <section>
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">
        7-Day Sun Schedule
      </h2>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
        <table className="w-full text-sm">
          <caption className="sr-only">
            7-day sun schedule showing sunrise, sunset, and day length
          </caption>
          <thead>
            <tr className="bg-gray-50 text-gray-600">
              <th className="text-left py-3 px-4 font-medium">Day</th>
              <th className="text-left py-3 px-4 font-medium">Sunrise</th>
              <th className="text-left py-3 px-4 font-medium">Sunset</th>
              <th className="text-left py-3 px-4 font-medium">Day Length</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {days.map((day) => (
              <tr
                key={day.date}
                className={cn(
                  "transition-colors",
                  day.isToday
                    ? "bg-sky-50 border-l-2 border-l-sky-500"
                    : "hover:bg-gray-50/50"
                )}
              >
                <td className="py-3 px-4 font-medium text-gray-800">
                  {day.label}
                  {day.isToday && (
                    <span className="ml-2 text-xs text-sky-600 font-normal">
                      (Today)
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-gray-700">{day.sunrise}</td>
                <td className="py-3 px-4 text-gray-700">{day.sunset}</td>
                <td className="py-3 px-4 text-gray-700">{day.dayLength}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Stacked Cards */}
      <div className="md:hidden space-y-3">
        {days.map((day) => (
          <div
            key={day.date}
            className={cn(
              "rounded-xl border p-4 shadow-sm",
              day.isToday
                ? "bg-sky-50 border-sky-200"
                : "bg-white border-gray-200"
            )}
          >
            <p className="font-semibold text-gray-800 mb-2">
              {day.label}
              {day.isToday && (
                <span className="ml-2 text-xs text-sky-600 font-normal">
                  (Today)
                </span>
              )}
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-0.5">
                  Sunrise
                </p>
                <p className="text-gray-700">{day.sunrise}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-0.5">
                  Sunset
                </p>
                <p className="text-gray-700">{day.sunset}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs font-medium text-gray-500 uppercase mb-0.5">
                  Day Length
                </p>
                <p className="text-gray-700">{day.dayLength}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
