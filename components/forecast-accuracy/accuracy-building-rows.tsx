import { Clock, Database, ShieldCheck } from "lucide-react";

import { QuiverSticker } from "@/components/zine/quiver-sticker";
import type { ForecastAccuracyBuildingRow } from "@/actions/ml/forecast-accuracy-actions";

interface AccuracyBuildingRowsProps {
  rows: ForecastAccuracyBuildingRow[];
}

const ICONS = [Database, Clock, ShieldCheck] as const;

export function AccuracyBuildingRows({ rows }: AccuracyBuildingRowsProps) {
  if (rows.length === 0) return null;

  return (
    <section aria-label="Forecast accuracy metrics building">
      <div className="relative overflow-hidden rounded-[8px] border-2 border-[#11100D] bg-[#F4EBD8] p-5 text-[#11100D] shadow-[4px_4px_0_#11100D] md:p-6">
        <QuiverSticker
          sticker="surfWax"
          className="absolute -right-6 -top-5 h-24 w-24 rotate-12 object-contain opacity-20"
          sizes="96px"
        />
        <div className="relative mb-5 max-w-2xl">
          <p className="mb-2 inline-flex rounded-[8px] border-2 border-[#11100D] bg-[#FDB84B] px-3 py-1 font-mono text-xs font-black uppercase tracking-[0.16em] text-[#11100D] shadow-[2px_2px_0_#11100D]">
            Building report
          </p>
          <h2 className="font-heading text-2xl font-black">
            Accuracy rows are being verified.
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#5F5646]">
            The page stays useful while Quiver waits for enough buoy-matched
            pairs to make a backed accuracy claim.
          </p>
        </div>

        <div className="relative grid gap-3 md:grid-cols-3">
          {rows.map((row, index) => {
            const Icon = ICONS[index % ICONS.length];

            return (
              <article
                key={row.id}
                className="rounded-[8px] border-2 border-[#11100D] bg-[#EFE5CF] p-4 shadow-[3px_3px_0_#11100D]"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <Icon className="h-5 w-5 text-[#0B3A75]" aria-hidden="true" />
                  <span className="rounded-full border border-[#11100D]/20 bg-[#F4EBD8] px-2 py-1 font-mono text-[10px] font-black uppercase text-[#5F5646]">
                    {row.confidenceLabel}
                  </span>
                </div>
                <h3 className="font-heading text-lg font-black">{row.label}</h3>
                <p className="mt-1 font-mono text-sm font-black uppercase text-[#C0521B]">
                  {row.status}
                </p>
                <p className="mt-2 text-sm font-semibold leading-6 text-[#5F5646]">
                  {row.detail}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
