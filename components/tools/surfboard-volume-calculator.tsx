"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ToolShareButton } from "@/components/tools/tool-share-button";

type SkillLevel = "beginner" | "intermediate" | "advanced" | "expert";
type FitnessLevel = "normal" | "athletic" | "veryFit";
type WaveSize = "small" | "medium" | "large";
type WeightUnit = "lbs" | "kg";

const SKILL_MULTIPLIERS: Record<SkillLevel, number> = {
  beginner: 0.55,
  intermediate: 0.45,
  advanced: 0.38,
  expert: 0.34,
};

const FITNESS_ADJUSTMENTS: Record<FitnessLevel, number> = {
  normal: 1.0,
  athletic: 0.95,
  veryFit: 0.9,
};

const WAVE_ADJUSTMENTS: Record<WaveSize, number> = {
  small: 1.05,
  medium: 1.0,
  large: 0.95,
};

const SKILL_LABELS: Record<SkillLevel, { label: string; description: string }> =
  {
    beginner: {
      label: "Beginner",
      description: "Still learning to pop up and catch unbroken waves",
    },
    intermediate: {
      label: "Intermediate",
      description: "Catching green waves, starting to turn",
    },
    advanced: {
      label: "Advanced",
      description: "Comfortable in overhead surf, carving turns",
    },
    expert: {
      label: "Expert",
      description: "Riding critical sections, airs, barrels",
    },
  };

const FITNESS_LABELS: Record<FitnessLevel, string> = {
  normal: "Normal",
  athletic: "Athletic",
  veryFit: "Very fit",
};

const WAVE_LABELS: Record<WaveSize, string> = {
  small: "Small (1–3ft)",
  medium: "Medium (3–6ft)",
  large: "Large (6ft+)",
};

interface BoardSuggestion {
  type: string;
  length: string;
  description: string;
}

function getBoardSuggestions(
  skill: SkillLevel,
  waveSize: WaveSize,
  _volume: number
): BoardSuggestion[] {
  if (skill === "beginner") {
    return [
      {
        type: "Foamie / Soft-top",
        length: '8\'0"–9\'0"',
        description: "Most forgiving, great for learning. High stability.",
      },
      {
        type: "Longboard",
        length: '9\'0"–11\'0"',
        description:
          "Easy paddling and wave-catching. Great for small to medium days.",
      },
    ];
  }
  if (skill === "intermediate") {
    if (waveSize === "small") {
      return [
        {
          type: "Fish",
          length: '6\'0"–6\'6"',
          description: "Wide, fast, great in mushy smaller waves.",
        },
        {
          type: "Funboard / Malibu",
          length: '7\'0"–8\'0"',
          description:
            "Mid-length versatility. Easy to paddle, still maneuverable.",
        },
      ];
    }
    return [
      {
        type: "Funboard / Malibu",
        length: '7\'0"–8\'0"',
        description: "Best all-around for intermediate surfers.",
      },
      {
        type: "Hybrid / Egg",
        length: '6\'4"–7\'2"',
        description: "More performance than a longboard, more volume than a shortboard.",
      },
    ];
  }
  if (skill === "advanced") {
    if (waveSize === "large") {
      return [
        {
          type: "Step-up",
          length: '6\'4"–7\'0"',
          description: "More volume and length for bigger, more powerful surf.",
        },
        {
          type: "Gun",
          length: '7\'0"–9\'0"',
          description: "For serious overhead-plus conditions.",
        },
      ];
    }
    return [
      {
        type: "Shortboard",
        length: '5\'10"–6\'4"',
        description: "High performance, responsive in quality surf.",
      },
      {
        type: "Fish",
        length: '5\'8"–6\'2"',
        description: "Fun alternative for smaller, weaker waves.",
      },
    ];
  }
  // expert
  if (waveSize === "large") {
    return [
      {
        type: "Gun",
        length: '7\'0"–9\'0"',
        description: "Purpose-built for big, fast waves.",
      },
      {
        type: "Step-up",
        length: '6\'4"–7\'0"',
        description: "Added paddle power and stability for overhead-plus surf.",
      },
    ];
  }
  return [
    {
      type: "Shortboard",
      length: '5\'6"–6\'2"',
      description: "Performance board for quality surf.",
    },
    {
      type: "High-performance fish",
      length: '5\'4"–5\'10"',
      description: "Speed and loose feel in weaker days.",
    },
  ];
}

function calculateVolume(
  weightKg: number,
  skill: SkillLevel,
  fitness: FitnessLevel,
  waveSize: WaveSize
): number {
  const base = weightKg * SKILL_MULTIPLIERS[skill];
  const adjusted =
    base * FITNESS_ADJUSTMENTS[fitness] * WAVE_ADJUSTMENTS[waveSize];
  return Math.round(adjusted * 10) / 10;
}

function lbsToKg(lbs: number): number {
  return lbs / 2.205;
}

const CARD_STYLE = {
  background: "rgba(30, 37, 88, 0.7)",
  borderColor: "rgba(64, 76, 146, 0.4)",
};

export function SurfboardVolumeCalculator() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [weightUnit, setWeightUnit] = useState<WeightUnit>(() => {
    return (searchParams.get("weightUnit") as WeightUnit) || "lbs";
  });
  const [weightValue, setWeightValue] = useState(() => {
    return searchParams.get("weight") || "160";
  });
  const [skill, setSkill] = useState<SkillLevel>(() => {
    return (searchParams.get("skill") as SkillLevel) || "intermediate";
  });
  const [fitness, setFitness] = useState<FitnessLevel>("normal");
  const [waveSize, setWaveSize] = useState<WaveSize>("medium");

  const weightNum = parseFloat(weightValue) || 0;
  const weightKg = weightUnit === "lbs" ? lbsToKg(weightNum) : weightNum;

  const hasInput = weightKg > 0;
  const volume = hasInput ? calculateVolume(weightKg, skill, fitness, waveSize) : null;
  const volumeMin = volume ? Math.round(volume * 0.93 * 10) / 10 : null;
  const volumeMax = volume ? Math.round(volume * 1.08 * 10) / 10 : null;
  const boardSuggestions = volume ? getBoardSuggestions(skill, waveSize, volume) : [];

  const updateUrl = useCallback(
    (weight: string, skillVal: SkillLevel, wUnit: WeightUnit) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("weight", weight);
      params.set("skill", skillVal);
      params.set("weightUnit", wUnit);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  useEffect(() => {
    if (weightValue) {
      updateUrl(weightValue, skill, weightUnit);
    }
  }, [weightValue, skill, weightUnit, updateUrl]);

  return (
    <div className="space-y-8">
      {/* Inputs */}
      <div className="rounded-2xl border p-6 space-y-6" style={CARD_STYLE}>
        {/* Weight */}
        <fieldset>
          <legend className="text-xs font-mono font-medium text-[#7A8CC0] mb-3 uppercase tracking-wide">
            Your weight
          </legend>
          <div className="flex gap-3">
            <input
              type="number"
              inputMode="decimal"
              min="40"
              max="300"
              step="1"
              value={weightValue}
              onChange={(e) => setWeightValue(e.target.value)}
              className="flex-1 rounded-lg border px-4 py-3 text-2xl font-bold text-white focus:outline-none focus:ring-2 h-14"
              style={{
                background: "rgba(15, 21, 53, 0.8)",
                borderColor: "rgba(64, 76, 146, 0.6)",
              }}
              placeholder="160"
              aria-label={`Weight in ${weightUnit}`}
            />
            <div
              className="flex rounded-lg border overflow-hidden h-14"
              style={{ borderColor: "rgba(64, 76, 146, 0.6)" }}
            >
              {(["lbs", "kg"] as WeightUnit[]).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setWeightUnit(u)}
                  className="w-14 text-sm font-mono font-semibold transition-colors focus-ring"
                  style={
                    weightUnit === u
                      ? { background: "#F78E42", color: "#fff" }
                      : { background: "rgba(15, 21, 53, 0.8)", color: "#7A8CC0" }
                  }
                  aria-pressed={weightUnit === u}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
          <input
            type="range"
            min={weightUnit === "lbs" ? 80 : 36}
            max={weightUnit === "lbs" ? 300 : 136}
            step={weightUnit === "lbs" ? 5 : 2}
            value={weightNum || (weightUnit === "lbs" ? 160 : 73)}
            onChange={(e) => setWeightValue(e.target.value)}
            className="mt-3 w-full h-2 accent-[#F78E42] cursor-pointer"
            aria-label={`Weight slider in ${weightUnit}`}
          />
        </fieldset>

        {/* Skill level */}
        <fieldset>
          <legend className="text-xs font-mono font-medium text-[#7A8CC0] mb-3 uppercase tracking-wide">
            Skill level
          </legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(Object.keys(SKILL_LABELS) as SkillLevel[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSkill(s)}
                className="rounded-lg border p-3 text-left transition-colors focus:outline-none focus:ring-2"
                style={
                  skill === s
                    ? { background: "rgba(247, 142, 66, 0.12)", borderColor: "rgba(247, 142, 66, 0.5)" }
                    : CARD_STYLE
                }
                aria-pressed={skill === s}
              >
                <div className="text-sm font-semibold text-white">
                  {SKILL_LABELS[s].label}
                </div>
                <div className="text-xs text-[#7A8CC0] mt-1 leading-snug">
                  {SKILL_LABELS[s].description}
                </div>
              </button>
            ))}
          </div>
        </fieldset>

        {/* Fitness */}
        <fieldset>
          <legend className="text-xs font-mono font-medium text-[#7A8CC0] mb-3 uppercase tracking-wide">
            Fitness level
          </legend>
          <div className="flex gap-2">
            {(Object.keys(FITNESS_LABELS) as FitnessLevel[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFitness(f)}
                className="flex-1 rounded-lg border py-3 px-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2"
                style={
                  fitness === f
                    ? { background: "rgba(247, 142, 66, 0.12)", borderColor: "rgba(247, 142, 66, 0.5)", color: "#fff" }
                    : { ...CARD_STYLE, color: "#7A8CC0" }
                }
                aria-pressed={fitness === f}
              >
                {FITNESS_LABELS[f]}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Wave size preference */}
        <fieldset>
          <legend className="text-xs font-mono font-medium text-[#7A8CC0] mb-3 uppercase tracking-wide">
            Waves you typically surf
          </legend>
          <div className="flex gap-2">
            {(Object.keys(WAVE_LABELS) as WaveSize[]).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWaveSize(w)}
                className="flex-1 rounded-lg border py-3 px-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2"
                style={
                  waveSize === w
                    ? { background: "rgba(247, 142, 66, 0.12)", borderColor: "rgba(247, 142, 66, 0.5)", color: "#fff" }
                    : { ...CARD_STYLE, color: "#7A8CC0" }
                }
                aria-pressed={waveSize === w}
              >
                {WAVE_LABELS[w]}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      {/* Empty state */}
      {!hasInput && (
        <p className="text-sm font-mono text-[#7A8CC0] text-center py-4">
          Enter your weight to get a recommendation
        </p>
      )}

      {hasInput && volume !== null && (
        <>
          {/* Volume result card */}
          <div
            className="rounded-2xl border p-6"
            style={{
              background: "rgba(247, 142, 66, 0.08)",
              borderColor: "rgba(247, 142, 66, 0.4)",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-mono font-medium text-[#7A8CC0] mb-1 uppercase tracking-wide">
                  Recommended board volume
                </div>
                <div className="text-5xl font-bold text-white tabular-nums">
                  {volume}
                  <span className="text-2xl font-medium text-[#B8C7E0] ml-2">
                    liters
                  </span>
                </div>
                <div className="mt-2 text-sm text-[#B8C7E0] font-mono">
                  Acceptable range:{" "}
                  <span className="font-semibold text-white">
                    {volumeMin}–{volumeMax}L
                  </span>
                </div>
              </div>
              <ToolShareButton
                toolName="Surfboard Volume Calculator"
                shareText={`My ideal surfboard volume is ${volume}L (${volumeMin}–${volumeMax}L range) — calculated on Quiver`}
              />
            </div>
          </div>

          {/* Board type suggestions */}
          <section aria-labelledby="board-suggestions-heading">
            <h2
              id="board-suggestions-heading"
              className="font-heading text-lg font-semibold text-white mb-3"
            >
              Suggested board types
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {boardSuggestions.map((board) => (
                <div
                  key={board.type}
                  className="rounded-xl border p-4"
                  style={CARD_STYLE}
                >
                  <div className="font-semibold text-white">{board.type}</div>
                  <div className="text-sm font-mono font-semibold mt-0.5" style={{ color: "#F78E42" }}>
                    {board.length}
                  </div>
                  <div className="text-sm text-[#B8C7E0] mt-1">
                    {board.description}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* Reference table */}
      <section aria-labelledby="volume-reference-heading">
        <h2
          id="volume-reference-heading"
          className="font-heading text-lg font-semibold text-white mb-3"
        >
          Volume by weight and skill level
        </h2>
        <div
          className="overflow-x-auto rounded-xl border"
          style={{ borderColor: "rgba(64, 76, 146, 0.4)" }}
        >
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
                  Weight
                </th>
                <th className="px-4 py-3 text-right font-mono font-medium text-[#7A8CC0] whitespace-nowrap">
                  Beginner
                </th>
                <th className="px-4 py-3 text-right font-mono font-medium text-[#7A8CC0] whitespace-nowrap">
                  Intermediate
                </th>
                <th className="px-4 py-3 text-right font-mono font-medium text-[#7A8CC0] whitespace-nowrap">
                  Advanced
                </th>
                <th className="px-4 py-3 text-right font-mono font-medium text-[#7A8CC0] whitespace-nowrap">
                  Expert
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                { lbs: 120, kg: 54.4 },
                { lbs: 140, kg: 63.5 },
                { lbs: 160, kg: 72.6 },
                { lbs: 180, kg: 81.6 },
                { lbs: 200, kg: 90.7 },
                { lbs: 220, kg: 99.8 },
              ].map((row, i) => (
                <tr
                  key={row.lbs}
                  className="border-b"
                  style={{
                    background: i % 2 === 0 ? "rgba(30, 37, 88, 0.5)" : "rgba(15, 21, 53, 0.4)",
                    borderColor: i < 5 ? "rgba(64, 76, 146, 0.3)" : "transparent",
                  }}
                >
                  <td className="px-4 py-3 font-medium text-white whitespace-nowrap">
                    {row.lbs} lbs
                    <span className="text-[#7A8CC0] font-mono font-normal ml-1 text-xs">
                      ({row.kg}kg)
                    </span>
                  </td>
                  {(["beginner", "intermediate", "advanced", "expert"] as SkillLevel[]).map(
                    (s) => (
                      <td
                        key={s}
                        className="px-4 py-3 text-right tabular-nums font-mono text-[#B8C7E0]"
                      >
                        {Math.round(row.kg * SKILL_MULTIPLIERS[s])}L
                      </td>
                    )
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Educational section */}
      <section
        aria-labelledby="volume-explainer-heading"
        className="rounded-xl border p-6 space-y-4"
        style={CARD_STYLE}
      >
        <h2
          id="volume-explainer-heading"
          className="font-heading text-lg font-semibold text-white"
        >
          What is board volume?
        </h2>
        <div className="space-y-3 text-sm text-[#B8C7E0] leading-relaxed">
          <p>
            <strong className="text-white">Volume</strong> (measured in
            liters) describes how much foam or material is in your board. More
            volume = more buoyancy = easier paddling and wave-catching.
          </p>
          <p>
            <strong className="text-white">How volume affects your surfing:</strong>{" "}
            Higher volume boards paddle faster, catch waves earlier, and are
            more stable — great for beginners and smaller surf. Lower volume
            boards sink slightly, require more precise paddling, but respond
            faster to turns and fit under hollow, powerful waves.
          </p>
          <p>
            <strong className="text-white">When to size up or down:</strong>{" "}
            Size up if you&apos;re surfing weak, mushy waves or coming back after a
            long break. Size down as your fitness improves, when surfing more
            powerful waves, or when you want more performance at the cost of
            easy paddle power.
          </p>
          <p>
            Note: volume is a starting point, not a rule. Board shape,
            rocker, and concaves all affect how a board performs. Try before
            you buy when possible.
          </p>
        </div>
        <Link
          href="/learn"
          className="inline-flex items-center gap-1 text-sm font-semibold hover:underline"
          style={{ color: "#F78E42" }}
        >
          Learn more about choosing a surfboard
          <span aria-hidden>→</span>
        </Link>
      </section>
    </div>
  );
}
