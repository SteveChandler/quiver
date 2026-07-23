"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FigureFrame } from "./figure-frame";
import { FigurePoster } from "./figure-poster";
import { classifyWaveHeight } from "./wave-height-classification";

function formatFeet(value: number): string {
  return `${value.toFixed(1)} ft`;
}

function formatFeetRange(min: number, max: number): string {
  return `${min.toFixed(1)}–${max.toFixed(1)} ft`;
}

export default function WaveHeightReference() {
  const [significantHeightFt, setSignificantHeightFt] = useState(3);
  const [reduced, setReduced] = useState(true);
  const scale = classifyWaveHeight(significantHeightFt);

  useEffect(() => {
    setReduced(
      !window.matchMedia ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  }, []);

  if (reduced) {
    return (
      <FigureFrame
        kicker="Three scales, one wave"
        title="One Swell, Three Rulers"
        summary="Static comparison of a three-foot significant wave-height forecast, its likely four-and-a-half to six-foot breaking face, and the smaller Hawaiian scale call."
        caption="Hs is standardized. The face you surf depends on how your break transforms that energy."
        downloadTitle="One Swell, Three Wave-Height Rulers"
      >
        <FigurePoster kind="wave-height-reference" />
      </FigureFrame>
    );
  }

  const incomingScale = 0.58 + scale.t * 0.5;
  const breakingScale = 0.52 + scale.t * 0.76;

  return (
    <FigureFrame
      kicker="Drag the forecast height ↓"
      title={
        <>
          One Swell, <span className="text-[#F78E42]">Three Rulers</span>
        </>
      }
      summary="Interactive wave-height converter: adjust significant wave height to compare the buoy or model number with the larger breaking face and the smaller Hawaiian scale call."
      caption="Hs is standardized. The face you surf depends on how your break transforms that energy."
      downloadTitle="One Swell, Three Wave-Height Rulers"
    >
      <div className="overflow-hidden rounded-lg border-[1.5px] border-[#11100D] bg-[#e2e9e8]">
        <svg
          viewBox="0 0 680 270"
          className="block h-auto min-h-[230px] w-full"
          aria-hidden="true"
        >
          <rect width="680" height="270" fill="#e2e9e8" />
          <path
            d="M0 221 C75 210 128 225 205 216 C264 209 304 218 344 216"
            fill="none"
            stroke="#7FA7B8"
            strokeWidth="3"
          />
          <g
            className="transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]"
            style={{
              transform: `scaleY(${incomingScale})`,
              transformBox: "fill-box",
              transformOrigin: "center bottom",
            }}
          >
            <path
              d="M44 214 C82 174 126 174 164 214"
              fill="none"
              stroke="#0B3A75"
              strokeWidth="5"
              strokeLinecap="round"
            />
          </g>

          <rect x="566" width="114" height="270" fill="#D9C49C" />
          <path
            d="M314 224 C366 217 389 183 417 129 C443 78 497 69 538 103 C508 96 482 110 469 139 C500 145 526 169 540 211 C484 224 400 229 314 224Z"
            fill="#0B3A75"
            opacity="0.93"
            className="transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]"
            style={{
              transform: `scaleY(${breakingScale})`,
              transformBox: "fill-box",
              transformOrigin: "center bottom",
            }}
          />
          <path
            d="M415 129 C450 88 497 83 538 103 C498 101 474 118 469 139 C446 134 429 133 415 129Z"
            fill="#F4EBD8"
            opacity="0.88"
          />

          <line
            x1="105"
            y1="165"
            x2="105"
            y2="215"
            stroke="#F78E42"
            strokeWidth="3"
          />
          <line
            x1="96"
            y1="165"
            x2="114"
            y2="165"
            stroke="#F78E42"
            strokeWidth="3"
          />
          <line
            x1="96"
            y1="215"
            x2="114"
            y2="215"
            stroke="#F78E42"
            strokeWidth="3"
          />
          <text
            x="125"
            y="187"
            fill="#11100D"
            fontSize="15"
            fontWeight="900"
          >
            Hs
          </text>
          <text x="125" y="205" fill="#6b6455" fontSize="13">
            buoy / model
          </text>

          <line
            x1="548"
            y1="76"
            x2="548"
            y2="216"
            stroke="#F78E42"
            strokeWidth="3"
          />
          <line
            x1="539"
            y1="76"
            x2="557"
            y2="76"
            stroke="#F78E42"
            strokeWidth="3"
          />
          <line
            x1="539"
            y1="216"
            x2="557"
            y2="216"
            stroke="#F78E42"
            strokeWidth="3"
          />
          <text
            x="406"
            y="50"
            fill="#11100D"
            fontSize="16"
            fontWeight="900"
          >
            BREAKING FACE
          </text>

          <rect x="22" y="20" width="204" height="34" rx="3" fill="#11100D" />
          <text
            x="35"
            y="43"
            fill="#F4EBD8"
            fontSize="15"
            fontWeight="900"
            letterSpacing="1.3"
          >
            WHICH “3 FEET”?
          </text>
        </svg>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="font-mono text-[11px] uppercase tracking-widest text-[#6b6455]">
          Forecast Hs
        </span>
        <input
          type="range"
          min={0.5}
          max={8}
          step={0.5}
          value={significantHeightFt}
          onChange={(event) =>
            setSignificantHeightFt(Number(event.target.value))
          }
          aria-label="Significant wave height in feet"
          className="h-1.5 flex-1 cursor-pointer accent-[#F78E42]"
        />
        <span className="min-w-[72px] text-right font-display text-2xl font-black text-[#11100D]">
          {formatFeet(scale.significantHeightFt)}
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {[
          {
            label: "Forecast / buoy",
            value: formatFeet(scale.significantHeightFt),
            note: "Significant height (Hs)",
          },
          {
            label: "Breaking face",
            value: formatFeetRange(
              scale.faceHeightMinFt,
              scale.faceHeightMaxFt,
            ),
            note: "What you see at shore",
          },
          {
            label: "Hawaiian call",
            value: formatFeetRange(
              scale.hawaiianHeightMinFt,
              scale.hawaiianHeightMaxFt,
            ),
            note: "Roughly half the face",
          },
        ].map((item) => (
          <div
            key={item.label}
            className="border-[1.5px] border-[#11100D] bg-[#FBF6E8] px-3 py-2.5"
          >
            <div className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-[#6b6455]">
              {item.label}
            </div>
            <div className="mt-1 font-display text-xl font-black text-[#11100D]">
              {item.value}
            </div>
            <div className="mt-0.5 text-xs text-[#6b6455]">{item.note}</div>
          </div>
        ))}
      </div>

      <Link
        href="/forecast?source=learn_wave_height_figure"
        className="mt-4 block rotate-[0.35deg] bg-[#11100D] px-3 py-2.5 text-[13px] leading-snug text-[#F4EBD8]"
      >
        Start with Hs, then learn how your beach magnifies it.{" "}
        <span className="whitespace-nowrap font-bold text-[#F78E42]">
          Check your beach →
        </span>
      </Link>
    </FigureFrame>
  );
}
