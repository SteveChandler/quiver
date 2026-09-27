import { SwellGlyph } from "@/components/beach-detail/visual/swell-glyph";
import type { BeachWeekDay } from "@/lib/utils/beach-week";
import { formatTimeCasual } from "@/lib/utils/date-time";
import { formatWaveRange, TIER_COLOR_HEX } from "@/lib/utils/horizon-strip-utils";
import type { PublicSurfCall } from "@/lib/utils/public-surf-call";

export function BeachWeek({ days, timezone, weekCall }: { days: BeachWeekDay[]; timezone: string; weekCall?: { localDate: string; call: PublicSurfCall } }) {
  if (days.length === 0) return null;
  return (
    <section aria-labelledby="beach-week-heading" className="mt-12">
      <h2 id="beach-week-heading" className="zine-display text-2xl uppercase tracking-wide text-[#F5EEDC]">
        The week
      </h2>
      <ol data-testid="beach-week" className="mt-4 grid grid-flow-col auto-cols-[minmax(128px,1fr)] gap-3 overflow-x-auto pb-2 lg:grid-flow-row lg:grid-cols-7">
        {days.map((day) => {
          const color = TIER_COLOR_HEX[day.tier];
          const call = weekCall?.localDate === day.fullDate ? weekCall.call : null;
          const badge = call?.kind === "call" ? call.label : call ? "No call" : day.tier.toUpperCase();
          const badgeColor = call?.kind === "call"
            ? TIER_COLOR_HEX[call.label.toLowerCase() as BeachWeekDay["tier"]]
            : call ? "#BFC0C6" : color;
          return (
            <li
              key={day.fullDate}
              className="overflow-hidden rounded-2xl border border-[#F5EEDC]/15 bg-[#F5EEDC]/5"
              style={{ opacity: day.early ? 0.62 : 1 }}
            >
              <div className="px-3 pt-3">
                <div className="flex items-center justify-between font-mono text-xs font-bold uppercase tracking-widest text-[#F5EEDC]">
                  <span>{day.isToday ? "Today" : day.dayName}</span>
                  {day.early ? <span className="rounded border border-dashed border-[#F5EEDC]/60 px-1 text-[10px]">Early</span> : null}
                </div>
                {day.swell ? <SwellGlyph swell={day.swell} color={color} /> : <div className="h-11" />}
                <span className="zine-display inline-block -rotate-3 rounded-md border-[2.5px] px-1.5 text-base" style={{ color: badgeColor, borderColor: badgeColor }}>
                  {badge}
                </span>
                <p className="zine-display mt-1 text-lg text-[#F5EEDC]">{formatWaveRange(day.minHeight, day.maxHeight)}</p>
                {day.bestAt ? (
                  <p className="text-xs text-[#F5EEDC]/65">best ~{formatTimeCasual(day.bestAt, timezone)}</p>
                ) : null}
              </div>
              {day.lowTide ? (
                <p className="mt-2 bg-[#F4EBD8] px-3 py-1.5 text-xs text-[#11100D]">
                  Low {formatTimeCasual(day.lowTide.at, timezone)}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
