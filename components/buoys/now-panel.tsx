import {
  compassPoint,
  formatHeightFt,
  formatHeightM,
  formatPeriod,
  normalizeDegrees,
} from "@/lib/buoy-pages/format";
import type { StationStatus } from "@/lib/buoy-pages/status";
import type { WaveStationObservationRow } from "@/lib/services/wave-stations/types";
import { DirectionArrow } from "./direction-arrow";

interface NowPanelProps {
  observation: WaveStationObservationRow | null;
  status: StationStatus;
  hasSwellSplit: boolean;
  reading: string | null;
}

function Direction({ degrees }: { degrees: number | null }) {
  if (degrees === null) return <span className="text-[#11100D]/50">no direction</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <DirectionArrow fromDegrees={degrees} className="text-[#0077B6]" />
      <span>
        {`from ${compassPoint(degrees)} `}
        <span className="font-mono text-[#11100D]/60">{`${Math.round(normalizeDegrees(degrees))}°`}</span>
      </span>
    </span>
  );
}

function Component({
  label,
  heightM,
  periodS,
  directionDeg,
  testId,
}: {
  label: string;
  heightM: number | null;
  periodS: number | null;
  directionDeg: number | null;
  testId: string;
}) {
  return (
    <div className="border-2 border-[#11100D] bg-[#FFFDF7] p-4" data-testid={testId}>
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#11100D]/60">{label}</p>
      <p className="mt-1 font-display text-3xl font-black text-[#11100D]">
        {formatHeightFt(heightM) ?? "—"}
        <span className="ml-2 font-mono text-sm font-normal text-[#11100D]/55">{formatHeightM(heightM)}</span>
      </p>
      <p className="mt-1 text-sm text-[#11100D]">
        <span className="font-mono">{formatPeriod(periodS) ?? "no period"}</span>
        <span className="mx-2 text-[#11100D]/30" aria-hidden>|</span>
        <Direction degrees={directionDeg} />
      </p>
    </div>
  );
}

export function NowPanel({ observation, status, hasSwellSplit, reading }: NowPanelProps) {
  if (status === "offline" || !observation) {
    return (
      <section className="mb-10 border-2 border-dashed border-[#11100D]/40 p-5" data-testid="buoy-now-offline">
        <h2 className="font-display text-2xl font-black uppercase text-[#11100D]">No current reading</h2>
        <p className="mt-2 max-w-2xl text-[15px] leading-7 text-[#11100D]/80">
          This buoy has not reported waves in the last 30 days. It may be adrift, under repair or
          retired. Nearby buoys below are still reporting.
        </p>
      </section>
    );
  }

  const split = hasSwellSplit && observation.swell_height_m !== null && observation.wind_wave_height_m !== null;

  return (
    <section className="mb-10" aria-labelledby="buoy-now-heading" data-testid="buoy-now">
      <h2 id="buoy-now-heading" className="mb-4 font-display text-2xl font-black uppercase text-[#11100D]">
        {status === "stale" ? "Last reading" : "Now at the buoy"}
      </h2>
      {status === "stale" ? (
        <p className="mb-4 max-w-2xl border-l-4 border-[#8A5E00] bg-[#FBF0D4] px-3 py-2 text-sm text-[#6B4800]">
          This reading is more than 3 hours old. The buoy may have stopped sending waves for now.
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="border-2 border-[#11100D] bg-[#FBF6E8] p-5">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#11100D]/60">
            Significant wave height at the buoy
          </p>
          <p className="mt-1 font-display text-6xl font-black leading-none text-[#11100D]" data-testid="buoy-now-height">
            {formatHeightFt(observation.wave_height_m) ?? "—"}
          </p>
          <p className="mt-1 font-mono text-sm text-[#11100D]/60">{formatHeightM(observation.wave_height_m)}</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#11100D]/55">Dominant period</dt>
              <dd className="font-mono text-lg text-[#11100D]">{formatPeriod(observation.dominant_period_s) ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#11100D]/55">Direction</dt>
              <dd className="text-[#11100D]">
                <Direction degrees={observation.mean_wave_direction_deg} />
              </dd>
            </div>
          </dl>
        </div>
        {split ? (
          <div className="grid gap-3">
            <Component
              label="Swell"
              heightM={observation.swell_height_m}
              periodS={observation.swell_period_s}
              directionDeg={observation.swell_direction_deg}
              testId="buoy-now-swell"
            />
            <Component
              label="Wind waves"
              heightM={observation.wind_wave_height_m}
              periodS={observation.wind_wave_period_s}
              directionDeg={observation.wind_wave_direction_deg}
              testId="buoy-now-wind-waves"
            />
          </div>
        ) : (
          <p className="self-center text-sm leading-6 text-[#11100D]/70">
            {hasSwellSplit
              ? "This reading came without the swell and wind-wave split, so the numbers are for the whole sea."
              : "This station does not send a swell and wind-wave split, so the numbers are for the whole sea."}
          </p>
        )}
      </div>
      {reading ? (
        <p className="mt-4 max-w-3xl text-[17px] leading-7 text-[#11100D]" data-testid="buoy-reading">
          {reading}
        </p>
      ) : null}
      <p className="mt-3 max-w-3xl text-xs leading-5 text-[#655C4C]">
        Significant wave height is the average of the biggest third of waves at the buoy. It is not
        surf height at a beach.
      </p>
    </section>
  );
}
