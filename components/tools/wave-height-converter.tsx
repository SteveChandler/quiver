"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ToolShareButton } from "@/components/tools/tool-share-button";

type Unit = "face_ft" | "face_m" | "hawaiian" | "back_ft";

const UNIT_LABELS: Record<Unit, string> = {
  face_ft: "Face height (ft)",
  face_m: "Face height (m)",
  hawaiian: "Hawaiian scale",
  back_ft: "Back / trough (ft)",
};

const UNIT_SHORT: Record<Unit, string> = {
  face_ft: "ft",
  face_m: "m",
  hawaiian: "Hawaiian",
  back_ft: "ft",
};

// All conversions go through face_ft as the base unit
function toFaceFt(value: number, unit: Unit): number {
  switch (unit) {
    case "face_ft":
      return value;
    case "face_m":
      return value / 0.3048;
    case "hawaiian":
      return value * 2;
    case "back_ft":
      return value / 0.7;
  }
}

function fromFaceFt(faceFt: number, unit: Unit): number {
  switch (unit) {
    case "face_ft":
      return faceFt;
    case "face_m":
      return faceFt * 0.3048;
    case "hawaiian":
      return faceFt / 2;
    case "back_ft":
      return faceFt * 0.7;
  }
}

function formatValue(value: number, unit: Unit): string {
  if (unit === "face_m") return value.toFixed(1);
  return value.toFixed(1);
}

function getWaveDescription(faceFt: number): string {
  if (faceFt <= 0) return "";
  if (faceFt < 2) return "Tiny — ankle to knee high";
  if (faceFt < 3) return "Small — knee high";
  if (faceFt < 4) return "Waist high";
  if (faceFt < 5) return "Chest high";
  if (faceFt < 7) return "Head high";
  if (faceFt < 9) return "Overhead";
  if (faceFt < 13) return "Double overhead";
  if (faceFt < 20) return "Triple overhead — big wave territory";
  return "Massive — big wave surfing";
}

function getWaveBarHeight(faceFt: number): number {
  return Math.min((faceFt / 20) * 100, 100);
}

const REFERENCE_TABLE = [
  { label: "Knee high", faceFt: 2, faceM: 0.6, hawaiian: 1, backFt: 1.4 },
  { label: "Waist high", faceFt: 3, faceM: 0.9, hawaiian: 1.5, backFt: 2.1 },
  { label: "Chest high", faceFt: 4, faceM: 1.2, hawaiian: 2, backFt: 2.8 },
  {
    label: "Head high",
    faceFt: "5–6",
    faceM: "1.5–1.8",
    hawaiian: "2.5–3",
    backFt: "3.5–4.2",
  },
  {
    label: "Overhead",
    faceFt: "7–8",
    faceM: "2.1–2.4",
    hawaiian: "3.5–4",
    backFt: "4.9–5.6",
  },
  {
    label: "Double overhead",
    faceFt: "10–12",
    faceM: "3–3.7",
    hawaiian: "5–6",
    backFt: "7–8.4",
  },
];

const CARD_STYLE = {
  background: "rgba(30, 37, 88, 0.7)",
  borderColor: "rgba(64, 76, 146, 0.4)",
};

const CARD_ACTIVE_STYLE = {
  background: "rgba(247, 142, 66, 0.12)",
  borderColor: "rgba(247, 142, 66, 0.5)",
};

export function WaveHeightConverter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [inputValue, setInputValue] = useState(() => {
    const v = searchParams.get("value");
    return v ? v : "6";
  });
  const [selectedUnit, setSelectedUnit] = useState<Unit>(() => {
    const u = searchParams.get("unit");
    return (u as Unit) || "face_ft";
  });

  const numericValue = parseFloat(inputValue) || 0;
  const clampedValue = Math.max(0, Math.min(100, numericValue));
  const faceFt = toFaceFt(clampedValue, selectedUnit);

  const updateUrl = useCallback(
    (value: string, unit: Unit) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("value", value);
      params.set("unit", unit);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  useEffect(() => {
    if (inputValue && parseFloat(inputValue) > 0) {
      updateUrl(inputValue, selectedUnit);
    }
  }, [inputValue, selectedUnit, updateUrl]);

  const barHeight = getWaveBarHeight(faceFt);
  const description = getWaveDescription(faceFt);

  const outputUnits: Unit[] = ["face_ft", "face_m", "hawaiian", "back_ft"];

  return (
    <div className="space-y-8">
      {/* Input section */}
      <div
        className="rounded-2xl border p-6"
        style={CARD_STYLE}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label
              htmlFor="wave-height-input"
              className="block text-xs font-mono font-medium text-[#7A8CC0] mb-2 uppercase tracking-wide"
            >
              Enter wave height
            </label>
            <input
              id="wave-height-input"
              type="number"
              inputMode="decimal"
              min="0"
              max="100"
              step="0.5"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-full rounded-lg border px-4 py-3 text-2xl font-bold text-white focus:outline-none focus:ring-2 h-14"
              style={{
                background: "rgba(15, 21, 53, 0.8)",
                borderColor: "rgba(64, 76, 146, 0.6)",
              }}
              placeholder="0"
              aria-label="Wave height value"
            />
          </div>
          <div className="sm:w-48">
            <label
              htmlFor="unit-select"
              className="block text-xs font-mono font-medium text-[#7A8CC0] mb-2 uppercase tracking-wide"
            >
              Unit
            </label>
            <select
              id="unit-select"
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value as Unit)}
              className="w-full rounded-lg border px-4 py-3 text-base text-white focus:outline-none focus:ring-2 h-14 cursor-pointer"
              style={{
                background: "rgba(15, 21, 53, 0.8)",
                borderColor: "rgba(64, 76, 146, 0.6)",
              }}
              aria-label="Select unit"
            >
              {(Object.keys(UNIT_LABELS) as Unit[]).map((unit) => (
                <option key={unit} value={unit}>
                  {UNIT_LABELS[unit]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {description && (
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-sm font-mono font-semibold" style={{ color: "#F78E42" }}>
              {description}
            </p>
            <ToolShareButton
              toolName="Wave Height Converter"
              shareText={
                clampedValue > 0
                  ? `${clampedValue} ${UNIT_SHORT[selectedUnit]} waves = ${description.toLowerCase()}`
                  : undefined
              }
            />
          </div>
        )}
        {!description && (
          <div className="mt-3 flex justify-end">
            <ToolShareButton toolName="Wave Height Converter" />
          </div>
        )}
      </div>

      {/* Results */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {outputUnits.map((unit) => {
          const converted = fromFaceFt(faceFt, unit);
          const isActive = unit === selectedUnit;
          return (
            <button
              key={unit}
              type="button"
              onClick={() => {
                setInputValue(formatValue(converted, unit));
                setSelectedUnit(unit);
              }}
              className="rounded-xl border p-4 text-left transition-colors focus:outline-none focus:ring-2"
              style={isActive ? CARD_ACTIVE_STYLE : CARD_STYLE}
              aria-pressed={isActive}
              aria-label={`Select ${UNIT_LABELS[unit]}`}
            >
              <div className="text-xs font-mono uppercase tracking-wide text-[#7A8CC0] mb-1">
                {UNIT_LABELS[unit]}
              </div>
              <div className="text-3xl font-bold text-white tabular-nums">
                {clampedValue > 0 ? formatValue(converted, unit) : "—"}
              </div>
              <div className="text-sm text-[#7A8CC0] mt-1 font-mono">
                {UNIT_SHORT[unit]}
              </div>
            </button>
          );
        })}
      </div>

      {/* Wave visual bar */}
      {clampedValue > 0 && (
        <div
          className="rounded-xl border p-6"
          style={CARD_STYLE}
        >
          <div className="flex items-end gap-4 h-32">
            <div className="flex flex-col items-center gap-2">
              <div className="text-2xl" aria-hidden>
                🏄
              </div>
              <div
                className="w-3 rounded-t-sm"
                style={{ height: "64px", background: "rgba(122, 140, 192, 0.4)" }}
                title="Average surfer height (~6ft)"
              />
              <div className="text-xs font-mono text-[#7A8CC0]">6ft surfer</div>
            </div>
            <div className="flex flex-col items-center gap-2 flex-1">
              <div
                className="w-full rounded-t-lg transition-[height] duration-500 ease-out"
                style={{
                  height: `${Math.max(4, barHeight * 1.28)}px`,
                  background: "linear-gradient(to top, #252D6B, #F78E42)",
                  maxHeight: "128px",
                }}
                role="img"
                aria-label={`Wave height visual: ${description}`}
              />
              <div className="text-xs font-mono text-[#7A8CC0]">
                {description || "Enter a wave height above"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reference table */}
      <section aria-labelledby="reference-table-heading">
        <h2
          id="reference-table-heading"
          className="font-heading text-lg font-semibold text-white mb-3"
        >
          Common wave sizes
        </h2>
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "rgba(64, 76, 146, 0.4)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr
                className="border-b"
                style={{
                  background: "rgba(30, 37, 88, 0.9)",
                  borderColor: "rgba(64, 76, 146, 0.4)",
                }}
              >
                <th className="px-4 py-3 text-left font-mono font-medium text-[#7A8CC0] whitespace-nowrap">
                  Description
                </th>
                <th className="px-4 py-3 text-right font-mono font-medium text-[#7A8CC0] whitespace-nowrap">
                  Face (ft)
                </th>
                <th className="px-4 py-3 text-right font-mono font-medium text-[#7A8CC0] whitespace-nowrap">
                  Face (m)
                </th>
                <th className="px-4 py-3 text-right font-mono font-medium text-[#7A8CC0] whitespace-nowrap">
                  Hawaiian
                </th>
                <th className="px-4 py-3 text-right font-mono font-medium text-[#7A8CC0] whitespace-nowrap">
                  Back (ft)
                </th>
              </tr>
            </thead>
            <tbody>
              {REFERENCE_TABLE.map((row, i) => (
                <tr
                  key={row.label}
                  className="border-b"
                  style={{
                    background: i % 2 === 0 ? "rgba(30, 37, 88, 0.5)" : "rgba(15, 21, 53, 0.4)",
                    borderColor: i < REFERENCE_TABLE.length - 1 ? "rgba(64, 76, 146, 0.3)" : "transparent",
                  }}
                >
                  <td className="px-4 py-3 font-medium text-white whitespace-nowrap">
                    {row.label}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-mono text-[#B8C7E0]">
                    {row.faceFt}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-mono text-[#B8C7E0]">
                    {row.faceM}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-mono text-[#B8C7E0]">
                    {row.hawaiian}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-mono text-[#B8C7E0]">
                    {row.backFt}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Educational sidebar */}
      <section
        aria-labelledby="how-waves-measured-heading"
        className="rounded-xl border p-6 space-y-4"
        style={CARD_STYLE}
      >
        <h2
          id="how-waves-measured-heading"
          className="font-heading text-lg font-semibold text-white"
        >
          How are waves measured?
        </h2>
        <div className="space-y-3 text-sm text-[#B8C7E0] leading-relaxed">
          <p>
            <strong className="text-white">Face height</strong> is the
            most common measurement in modern surf forecasting. It measures the
            height of the wave face — what you see as you paddle toward it.
            Most US surf forecasts (Surfline, Buoyweather, Quiver) use face
            height in feet.
          </p>
          <p>
            <strong className="text-white">Hawaiian scale</strong> has
            roots in traditional Hawaiian surfing culture. It reports waves at
            roughly half the face height. A “6-foot Hawaiian” wave has a face
            height of around 10–12 feet. The reasoning: Hawaiian surfers
            measured the back of the wave (the less intimidating side).
          </p>
          <p>
            <strong className="text-white">Back / trough height</strong>{" "}
            measures from the trough (base of the wave) to the crest as seen
            from behind the wave. It&apos;s roughly 70% of the face height.
          </p>
          <p>
            Note: all conversions are approximate. Wave shape, steepness, and
            swell period all affect how a wave feels regardless of its measured
            height.
          </p>
        </div>
        <Link
          href="/learn"
          className="inline-flex items-center gap-1 text-sm font-semibold hover:underline"
          style={{ color: "#F78E42" }}
        >
          Learn more about reading surf forecasts
          <span aria-hidden>→</span>
        </Link>
      </section>
    </div>
  );
}
