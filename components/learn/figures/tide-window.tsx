"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FigureFrame } from "./figure-frame";
import { FigurePoster } from "./figure-poster";
import {
  classifyTideWindow,
  getTideRangeFeet,
  TIDE_CYCLE_HOURS,
  type TideRangeKind,
} from "./tide-window-classification";

const RANGE_OPTIONS: Array<{
  kind: TideRangeKind;
  label: string;
  note: string;
}> = [
  { kind: "neap", label: "Neap tide", note: "Smaller swing" },
  { kind: "average", label: "Average", note: "Typical swing" },
  { kind: "spring", label: "Spring tide", note: "Bigger swing" },
];

function buildTidePath(rangeKind: TideRangeKind): string {
  const rangeFeet = getTideRangeFeet(rangeKind);
  const visualRange = 78 + rangeFeet * 10;
  const points: string[] = [];

  for (let index = 0; index <= 48; index += 1) {
    const progress = index / 48;
    const normalizedHeight = (1 - Math.cos(Math.PI * 2 * progress)) / 2;
    const x = 40 + progress * 600;
    const y = 218 - normalizedHeight * visualRange;
    points.push(`${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`);
  }

  return points.join(" ");
}

export default function TideWindow() {
  const [hoursSinceLow, setHoursSinceLow] = useState(3.1);
  const [rangeKind, setRangeKind] = useState<TideRangeKind>("average");
  const [reduced, setReduced] = useState(true);
  const tide = classifyTideWindow(hoursSinceLow, rangeKind);

  useEffect(() => {
    setReduced(
      !window.matchMedia ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  }, []);

  if (reduced) {
    return (
      <FigureFrame
        kicker="A 12 hour 25 minute cycle"
        title="Ride the Tide Curve"
        summary="Static tide-window chart showing low tide rising to high tide and falling back to low, with spring tides drawing a larger range than neap tides."
        caption="Illustrative range presets; use your local tide station for exact heights. The curve shifts about 50 minutes later each day."
        downloadTitle="How to Read a Tide Window"
      >
        <FigurePoster kind="tide-window" />
      </FigureFrame>
    );
  }

  const dotX = 40 + (tide.hoursSinceLow / TIDE_CYCLE_HOURS) * 600;
  const visualRange = 78 + tide.rangeFeet * 10;
  const dotY = 218 - tide.normalizedHeight * visualRange;

  return (
    <FigureFrame
      kicker="Move through one tide cycle ↓"
      title={
        <>
          Ride the <span className="text-[#F78E42]">Tide Curve</span>
        </>
      }
      summary="Interactive tide-window chart: move through a semidiurnal low-to-high-to-low cycle and compare neap, average, and spring tidal ranges."
      caption="Illustrative range presets; use your local tide station for exact heights. The curve shifts about 50 minutes later each day."
      downloadTitle="How to Read a Tide Window"
    >
      <div className="overflow-hidden rounded-lg border-[1.5px] border-[#11100D] bg-[#e2e9e8]">
        <svg
          viewBox="0 0 680 270"
          className="block h-auto min-h-[230px] w-full"
          aria-hidden="true"
        >
          <rect width="680" height="270" fill="#e2e9e8" />
          <rect x="40" y="64" width="600" height="154" fill="#D8E3E2" />
          <rect
            x="40"
            y="64"
            width="600"
            height="50"
            fill="#0B3A75"
            opacity="0.07"
          />
          <rect
            x="40"
            y="166"
            width="600"
            height="52"
            fill="#D9C49C"
            opacity="0.5"
          />
          {[64, 115, 166, 218].map((y) => (
            <line
              key={y}
              x1="40"
              y1={y}
              x2="640"
              y2={y}
              stroke="#11100D"
              strokeWidth="1"
              strokeDasharray="5 7"
              opacity="0.24"
            />
          ))}

          <path
            d={`${buildTidePath(rangeKind)} L 640 218 L 40 218 Z`}
            fill="#7FA7B8"
            opacity="0.34"
          />
          <path
            d={buildTidePath(rangeKind)}
            fill="none"
            stroke="#0B3A75"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line
            x1={dotX}
            y1="54"
            x2={dotX}
            y2="226"
            stroke="#F78E42"
            strokeWidth="2"
            strokeDasharray="4 5"
          />
          <circle
            cx={dotX}
            cy={dotY}
            r="9"
            fill="#F78E42"
            stroke="#11100D"
            strokeWidth="3"
          />

          <text
            x="40"
            y="246"
            fill="#11100D"
            fontSize="13"
            fontWeight="800"
          >
            LOW
          </text>
          <text
            x="320"
            y="54"
            fill="#11100D"
            fontSize="13"
            fontWeight="800"
          >
            HIGH
          </text>
          <text
            x="604"
            y="246"
            fill="#11100D"
            fontSize="13"
            fontWeight="800"
          >
            LOW
          </text>
          <text x="51" y="94" fill="#0B3A75" fontSize="12" fontWeight="800">
            MORE WATER
          </text>
          <text x="51" y="202" fill="#7a5a2e" fontSize="12" fontWeight="800">
            MORE BOTTOM
          </text>

          <rect x="22" y="20" width="218" height="34" rx="3" fill="#11100D" />
          <text
            x="35"
            y="43"
            fill="#F4EBD8"
            fontSize="15"
            fontWeight="900"
            letterSpacing="1.3"
          >
            50 MIN LATER / DAY
          </text>
        </svg>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {RANGE_OPTIONS.map((option) => {
          const selected = option.kind === rangeKind;
          return (
            <button
              key={option.kind}
              type="button"
              onClick={() => setRangeKind(option.kind)}
              aria-pressed={selected}
              aria-label={`${option.label}: ${getTideRangeFeet(option.kind).toFixed(1)} foot range`}
              className={`border-[1.5px] border-[#11100D] px-2 py-2 text-left transition-transform duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] hover:-translate-y-0.5 ${
                selected
                  ? "bg-[#F78E42] text-[#11100D]"
                  : "bg-[#FBF6E8] text-[#11100D]"
              }` + " focus-ring"}
            >
              <span className="block font-display text-sm font-black uppercase leading-none">
                {option.label}
              </span>
              <span className="mt-1 block text-[10px] leading-tight opacity-70">
                {option.note}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="font-mono text-[11px] uppercase tracking-widest text-[#6b6455]">
          Since low
        </span>
        <input
          type="range"
          min={0}
          max={TIDE_CYCLE_HOURS}
          step={0.1}
          value={hoursSinceLow}
          onChange={(event) => setHoursSinceLow(Number(event.target.value))}
          aria-label="Hours since low tide"
          className="h-1.5 flex-1 cursor-pointer accent-[#F78E42]"
        />
        <span className="min-w-[60px] text-right font-display text-xl font-black text-[#11100D]">
          +{tide.hoursSinceLow.toFixed(1)}h
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-3 border-[1.5px] border-[#11100D] bg-[#FBF6E8] p-3 sm:flex-row sm:items-center">
        <div className="shrink-0 sm:w-36">
          <div className="font-display text-xl font-black uppercase text-[#11100D]">
            {tide.stageLabel}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-[#F78E42]">
            {tide.rangeFeet.toFixed(1)} ft range
          </div>
        </div>
        <p className="m-0 text-sm leading-relaxed text-[#11100D]/72">
          {tide.surfCue}
        </p>
      </div>

      <Link
        href="/tools/tide-clock?source=learn_tide_figure"
        className="mt-4 block rotate-[-0.35deg] bg-[#11100D] px-3 py-2.5 text-[13px] leading-snug text-[#F4EBD8]"
      >
        Tide is timing, not a universal quality score.{" "}
        <span className="whitespace-nowrap font-bold text-[#F78E42]">
          Open the Tide Clock →
        </span>
      </Link>
    </FigureFrame>
  );
}
