/**
 * BeachTideNow — the tide answer at the top of a beach tide page, on the cream
 * field-guide card. With the NOAA station table it is the same "Right now" and
 * "Today" block as `/tide/<city>` and the station page. Without one (model tides,
 * no registry row, NOAA down) it shows the next high and low from the stored rows.
 */

import Link from "next/link";

import { TideStationNow } from "@/components/tide-stations/tide-station-now";
import type { TideMetaData } from "@/lib/seo/tide-meta-data";
import { FES2022_CITATION, MODEL_TIDE_SOURCE } from "@/lib/services/tides/model-tides";
import type { CityTideView } from "@/lib/tides/city-tide-view";

interface BeachTideNowProps {
  beachName: string;
  display: TideMetaData | null;
  view: CityTideView | null;
}

const KICKER = "font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[#8A5E00]";
const LINK = "font-semibold text-[#AA4918] underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#11100D]";

interface NextTide {
  type: "high" | "low";
  time: string;
  heightFt: number | null;
  atMs: number;
}

/** The stored-row next high and low, soonest first. Each keeps its own time, height and timestamp. */
function storedNextTides(display: TideMetaData): NextTide[] {
  const out: NextTide[] = [];
  if (display.nextHighTime) {
    out.push({ type: "high", time: display.nextHighTime, heightFt: display.nextHighHeight, atMs: Date.parse(display.nextHighAt ?? "") });
  }
  if (display.nextLowTime) {
    out.push({ type: "low", time: display.nextLowTime, heightFt: display.nextLowHeight, atMs: Date.parse(display.nextLowAt ?? "") });
  }
  return out.sort((a, b) => (Number.isNaN(a.atMs) || Number.isNaN(b.atMs) ? 0 : a.atMs - b.atMs));
}

function ModelNote() {
  return (
    <p className="mt-2 text-[11px] leading-snug text-[#11100D]/70">
      Modelled for this spot from the FES2022 global tide model, not measured at a tide station. Times are to the hour.
      Not for navigation. {FES2022_CITATION}
    </p>
  );
}

export function BeachTideNow({ beachName, display, view }: BeachTideNowProps) {
  const isModel = display?.source === MODEL_TIDE_SOURCE;

  if (view?.station) {
    return (
      <section aria-label={`Tide now at ${beachName}`} className="grid gap-3">
        <TideStationNow extremes={view.extremes} timeZone={view.timeZone} renderedAtMs={view.renderedAtMs} showDayShape />
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs text-[#11100D]/75">
          <span>
            NOAA {view.station.sourceStationId} · {view.station.name}
          </span>
          <span className="flex gap-4">
            <a href="#tide-chart" className={LINK}>
              7-day chart ↓
            </a>
            <Link href={`/tides/station/${view.station.slug}`} className={LINK}>
              Station →
            </Link>
          </span>
        </div>
      </section>
    );
  }

  const next = display ? storedNextTides(display) : [];
  if (next.length === 0) {
    return (
      <section aria-label={`Tide now at ${beachName}`} className="border-2 border-[#11100D] bg-[#FBF6E8] p-4">
        <p className={KICKER}>Right now</p>
        <p className="mt-2 text-sm text-[#11100D]/75">No upcoming tide in this table. Check back after the next update.</p>
        {isModel && <ModelNote />}
      </section>
    );
  }

  // Both turns known and in order: the first one tells the direction.
  const direction = next.length === 2 && !Number.isNaN(next[0].atMs) && !Number.isNaN(next[1].atMs) && next[0].atMs !== next[1].atMs
    ? next[0].type === "high" ? "Rising" : "Falling"
    : null;

  return (
    <section aria-label={`Tide now at ${beachName}`} className="grid gap-3">
      <div className="border-2 border-[#11100D] bg-[#FBF6E8] p-4 shadow-[4px_4px_0_rgba(17,16,13,0.75)]">
        <p className={KICKER}>{direction ? "Right now" : "Next tide"}</p>
        {direction && <p className="mt-2 font-heading text-3xl font-bold text-[#11100D]">{direction}</p>}
        <ul className="mt-2 divide-y divide-[#11100D]/15">
          {next.map((tide) => (
            <li key={tide.type} className="flex items-baseline justify-between gap-3 py-2 text-sm">
              <span className="font-semibold uppercase text-[#11100D]">{tide.type === "high" ? "High" : "Low"}</span>
              <span className="font-mono text-[#11100D]">{tide.time}</span>
              <span className="font-mono text-[#11100D]">{tide.heightFt !== null ? `${tide.heightFt.toFixed(1)} ft` : ""}</span>
            </li>
          ))}
        </ul>
        {isModel && <ModelNote />}
      </div>
      <a href="#tide-chart" className={`${LINK} text-xs`}>
        7-day chart ↓
      </a>
    </section>
  );
}
