import { Activity, CalendarDays, Database, Waves } from "lucide-react";

interface AccuracyHeroProps {
  avgImprovementPct: number;
  beachCount: number;
  totalPredictions: number;
  latestValidatedDate?: string | null;
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "Awaiting latest buoy match";
  const date = new Date(`${dateStr}T12:00:00`);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatImprovement(value: number): string {
  return `${Math.round(value)}%`;
}

export function AccuracyHero({
  avgImprovementPct,
  beachCount,
  totalPredictions,
  latestValidatedDate,
}: AccuracyHeroProps) {
  const improvementDisplay = formatImprovement(avgImprovementPct);
  const hasImprovement = avgImprovementPct > 0;

  return (
    <header className="relative mb-8 overflow-hidden rounded-[8px] border-2 border-[#11100D] bg-[#F4EBD8] p-4 text-[#11100D] shadow-[4px_4px_0_#11100D] md:p-6">
      <div className="pointer-events-none absolute -right-12 -top-10 h-40 w-40 rotate-12 border-[18px] border-[#F78E42]/30" />
      <div className="pointer-events-none absolute bottom-4 left-5 hidden font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-[#5F5646] md:block">
        rolling buoy audit
      </div>

      <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-stretch">
        <div className="rounded-[8px] border-2 border-[#11100D] bg-[#0B3A75] p-5 text-[#F4EBD8] shadow-[3px_3px_0_#11100D] md:p-7">
          <div className="mb-4 inline-flex rotate-[-1.5deg] items-center gap-2 rounded-[8px] border-2 border-[#11100D] bg-[#EFE5CF] px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-[#11100D] shadow-[3px_3px_0_#11100D]">
            <Waves className="h-3.5 w-3.5" aria-hidden />
            Buoy checked
          </div>
          <h1 className="max-w-3xl font-heading text-5xl font-black leading-[0.9] text-[#F4EBD8] md:text-7xl">
            Forecast accuracy receipts.
          </h1>
          <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-[#D8E8F7] md:text-lg">
            One quick read on how Quiver&apos;s model is doing against the NOAA
            baseline, checked against real buoy observations.
          </p>
        </div>

        <div className="flex rotate-1 flex-col justify-between rounded-[8px] border-2 border-[#11100D] bg-[#EFE5CF] p-5 shadow-[3px_3px_0_#11100D]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#5F5646]">
                Latest buoy match
              </p>
              <p className="mt-1 font-[family-name:var(--font-zine-marker)] text-4xl text-[#11100D]">
                {formatDate(latestValidatedDate)}
              </p>
            </div>
            <div className="rounded-full border-2 border-[#11100D] bg-[#0B3A75] p-2 text-[#F4EBD8]">
              <CalendarDays className="h-5 w-5" aria-hidden />
            </div>
          </div>

          <div className="mt-6 rounded-[8px] border-2 border-[#11100D] bg-[#8AB4F8] px-4 py-4 text-[#11100D] shadow-[3px_3px_0_#11100D]">
            <p className="text-xs font-black uppercase tracking-[0.18em] opacity-70">
              Quiver vs NOAA
            </p>
            <p className="mt-1 font-mono text-5xl font-black leading-none">
              {hasImprovement ? improvementDisplay : "Even"}
            </p>
            <p className="mt-2 text-sm font-black">
              {hasImprovement
                ? "better in the latest buoy check"
                : "in the latest buoy check"}
            </p>
            <p className="mt-3 text-xs font-bold opacity-70">
              Lower forecast error than the NOAA baseline.
            </p>
          </div>

          <div className="mt-5 -rotate-1 rounded-[8px] border-2 border-[#11100D] bg-[#0B3A75] px-4 py-3 text-[#F4EBD8]">
            <p className="text-sm font-bold">
              {hasImprovement ? (
                <>
                  <span className="font-mono text-lg font-black text-[#6EE7B7]">
                    {improvementDisplay}
                  </span>{" "}
                  less miss, checked against buoy readings.
                </>
              ) : (
                "Latest sample is not showing a measurable lift yet."
              )}
            </p>
          </div>
        </div>
      </div>

      <dl className="relative mt-5 grid gap-3 sm:grid-cols-3">
        <div className="-rotate-1 flex items-center gap-3 rounded-[8px] border-2 border-[#11100D] bg-[#EFE5CF] px-4 py-3 shadow-[3px_3px_0_#11100D]">
          <Database className="h-5 w-5 text-[#008A7A]" aria-hidden />
          <div>
            <dt className="text-xs font-bold uppercase text-[#5F5646]">
              Beaches tracked
            </dt>
            <dd className="font-mono text-xl font-black text-[#11100D]">
              {formatNumber(beachCount)}
            </dd>
          </div>
        </div>
        <div className="rotate-1 flex items-center gap-3 rounded-[8px] border-2 border-[#11100D] bg-[#EFE5CF] px-4 py-3 shadow-[3px_3px_0_#11100D]">
          <Activity className="h-5 w-5 text-[#C0521B]" aria-hidden />
          <div>
            <dt className="text-xs font-bold uppercase text-[#5F5646]">
              Matched forecasts
            </dt>
            <dd className="font-mono text-xl font-black text-[#11100D]">
              {formatNumber(totalPredictions)}
            </dd>
          </div>
        </div>
        <div className="-rotate-1 flex items-center gap-3 rounded-[8px] border-2 border-[#11100D] bg-[#EFE5CF] px-4 py-3 shadow-[3px_3px_0_#11100D]">
          <CalendarDays className="h-5 w-5 text-[#0B3A75]" aria-hidden />
          <div>
            <dt className="text-xs font-bold uppercase text-[#5F5646]">
              Refresh cadence
            </dt>
            <dd className="font-mono text-xl font-black text-[#11100D]">
              Daily
            </dd>
          </div>
        </div>
      </dl>
    </header>
  );
}
