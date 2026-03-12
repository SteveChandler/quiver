import Link from "next/link";

export interface TimeWindow {
  time: string;
  label: string;
  height: string;
  quality: number;
  isBest: boolean;
}

export interface TodaysWindowsProps {
  windows: TimeWindow[];
  preferredTime: string | null;
  forecastUrl?: string;
}

const PREFERRED_TIME_TO_HOUR: Record<string, string> = {
  dawn_patrol: "5am",
  morning: "8am",
  lunch: "11am",
  afternoon: "2pm",
  evening: "5pm",
};

export function TodaysWindows({ windows, preferredTime, forecastUrl }: TodaysWindowsProps) {
  const preferredHour = preferredTime ? PREFERRED_TIME_TO_HOUR[preferredTime] ?? null : null;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold text-white">{"Today's Windows"}</h2>
        {forecastUrl && (
          <Link
            href={forecastUrl}
            className="text-sm font-medium text-[#4A70D9] hover:text-[#4A70D9]/80"
          >
            Full forecast &gt;
          </Link>
        )}
      </div>

      <div className="noise-texture rounded-xl border border-[#404C92] bg-[#2D357D] p-5">
        <div className="flex flex-col gap-2">
          {windows.map((window) => {
            const isPreferred = preferredHour !== null && window.time === preferredHour;
            const barWidthPercent = Math.round(window.quality * 100);

            return (
              <div
                key={window.time}
                className={
                  isPreferred
                    ? "rounded-lg p-1 ring-1 ring-[#FDB84B]/20"
                    : "rounded-lg p-1"
                }
              >
                <div className="flex items-center gap-3">
                  {/* Time label — 48px fixed width */}
                  <span
                    className={
                      window.isBest
                        ? "w-12 shrink-0 font-heading text-sm font-bold text-[#FDB84B]"
                        : "w-12 shrink-0 font-heading text-sm text-medium"
                    }
                  >
                    {window.time}
                  </span>

                  {/* Quality bar */}
                  <div className="relative flex min-w-0 flex-1 items-center">
                    <div
                      className={
                        window.isBest
                          ? "flex h-7 items-center rounded-md bg-success/30 px-2 shadow-[0_0_12px_rgba(34,197,94,0.15)]"
                          : "flex h-7 items-center rounded-md bg-[#2D357D] px-2"
                      }
                      style={{ width: `${barWidthPercent}%` }}
                    >
                      <span
                        className={
                          window.isBest
                            ? "truncate text-xs font-semibold text-white"
                            : "truncate text-xs font-semibold text-medium"
                        }
                      >
                        {window.label}
                      </span>
                    </div>
                  </div>

                  {/* Wave height — 48px fixed width */}
                  <span className="w-12 shrink-0 text-right text-sm font-semibold text-high">
                    {window.height}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
