import type { Beach } from "@/types/database";
import { degreeWindowToCardinal } from "@/lib/utils/direction-utils";
import { DoodleWave, DoodleCompass, DoodleWind } from "./atoms";

interface ZineSpotSummaryProps {
  beach: Beach;
}

export function ZineSpotSummary({ beach }: ZineSpotSummaryProps) {
  const breakType = (beach.break_type || "Beach").toUpperCase();
  const swellCardinal =
    degreeWindowToCardinal(beach.swell_window_min_deg ?? null, beach.swell_window_max_deg ?? null) ?? "—";
  const windCardinal =
    beach.wind_offshore_deg != null && beach.wind_offshore_tol_deg != null
      ? degreeWindowToCardinal(
          beach.wind_offshore_deg - beach.wind_offshore_tol_deg,
          beach.wind_offshore_deg + beach.wind_offshore_tol_deg,
        ) ?? "—"
      : "—";
  const tideRange =
    beach.preferred_tide_ft_min != null && beach.preferred_tide_ft_max != null
      ? `${beach.preferred_tide_ft_min}–${beach.preferred_tide_ft_max} ft`
      : beach.preferred_tide_direction ?? "—";

  return (
    <section className="summary-strip mt-7" aria-label="Spot summary">
      <span className="tape tl" aria-hidden />
      <span className="tape br" aria-hidden />
      <SummaryItem icon={<DoodleWave size={32} />} label="BREAK TYPE:" value={breakType} />
      <Sep />
      <SummaryItem icon={<DoodleCompass size={40} />} label="BEST SWELL:" value={swellCardinal} />
      <Sep />
      <SummaryItem icon={<DoodleWind size={40} />} label="BEST WIND / TIDE:" value={`${windCardinal} / ${tideRange}`} />
    </section>
  );
}

function Sep() {
  return <div className="hidden md:block" style={{ width: 2, height: 50, background: "rgba(17,16,13,0.35)" }} aria-hidden />;
}

function SummaryItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div style={{ flexShrink: 0 }}>{icon}</div>
      <div className="flex flex-col">
        <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700, color: "#11100D" }}>
          {label}
        </span>
        <span
          className="text-[22px] md:text-[26px]"
          style={{ fontFamily: "var(--font-zine-display), 'Bowlby One', sans-serif", fontWeight: 900, color: "#11100D", letterSpacing: "0.02em", lineHeight: 1.05 }}
        >
          {value}
        </span>
      </div>
    </div>
  );
}
