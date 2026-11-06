import type { OutlookDay, OutlookTrend } from "@/lib/utils/ecmwf-outlook-days";

const TREND_LABEL: Record<OutlookTrend, string> = {
  building: "↗ Building",
  dropping: "↘ Dropping",
  steady: "→ Steady",
};

interface EcmwfOutlookStripProps {
  days: OutlookDay[];
}

/**
 * Days past the forecast that only the long-range model reaches: a size range
 * and a trend, never a score or swell breakdown. Dashed cards so it never
 * reads as the forecast beside it.
 */
export function EcmwfOutlookStrip({ days }: EcmwfOutlookStripProps) {
  if (days.length === 0) return null;
  return (
    <section data-testid="ecmwf-outlook-strip" className="space-y-2" aria-label="Long-range outlook">
      <div className="flex items-center gap-2 px-4 sm:px-6">
        <h2 className="shrink-0 rounded-full border border-dashed border-[#11100D] px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-[#11100D]">
          Outlook
        </h2>
        <span className="text-xs text-muted-foreground">Rough size. It can still shift.</span>
      </div>
      <ul className="flex gap-2 overflow-x-auto px-4 pb-1 sm:px-6">
        {days.map((day) => (
          <li
            key={day.localDate}
            data-outlook-day={day.localDate}
            className="flex w-[88px] flex-shrink-0 flex-col items-center gap-0.5 rounded-[10px] border-2 border-dashed border-[#11100D]/60 bg-[#F4EBD8] px-2 py-2 text-[#11100D]"
          >
            <span className="text-xs font-semibold uppercase tracking-wide">{day.dayName}</span>
            <span className="text-base font-bold leading-tight">
              {day.lowFt}–{day.highFt} ft
            </span>
            <span className="text-[11px] leading-tight text-[#5F5646]">{TREND_LABEL[day.trend]}</span>
            <span className="text-[11px] opacity-80">{day.date}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
