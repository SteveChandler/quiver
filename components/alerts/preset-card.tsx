"use client";

import type { PresetDefinition, PresetType } from "@/lib/alerts/types";

const PRESET_CONFIG: Record<
  PresetType,
  { icon: string; accentClass: string }
> = {
  glass_off: { icon: "\u{1F90C}", accentClass: "border-l-sky-400" },
  mellow_session: { icon: "\u{1F3C4}", accentClass: "border-l-emerald-400" },
  dawn_patrol: { icon: "\u{1F305}", accentClass: "border-l-amber-400" },
  big_day: { icon: "\u{1F30A}", accentClass: "border-l-red-400" },
  clean_groundswell: { icon: "\u{1F4A0}", accentClass: "border-l-violet-400" },
  tide_window: { icon: "\u{23F1}\u{FE0F}", accentClass: "border-l-cyan-400" },
  epic_conditions: { icon: "\u{1F525}", accentClass: "border-l-[#F78E42]" },
};

interface PresetCardProps {
  preset: PresetDefinition;
  onSelect: (preset: PresetDefinition) => void;
  disabled?: boolean;
  prominent?: boolean;
}

export function PresetCard({ preset, onSelect, disabled, prominent }: PresetCardProps) {
  const config = PRESET_CONFIG[preset.type];

  return (
    <button
      onClick={() => onSelect(preset)}
      disabled={disabled}
      className={`w-full text-left rounded-lg border-l-[3px] border border-[#404C92] transition-all disabled:opacity-50 disabled:cursor-not-allowed motion-safe:hover:rotate-[0.8deg] motion-safe:hover:scale-[1.015] hover:bg-[#354090] ${config.accentClass} ${
        prominent
          ? "p-4 bg-[#354090]/60"
          : "p-3 bg-[#354090]/40"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={`shrink-0 select-none ${prominent ? "text-xl" : "text-base"}`}
          role="img"
          aria-hidden="true"
        >
          {config.icon}
        </span>
        <div className="min-w-0">
          <div
            className={`font-semibold text-white font-[family-name:var(--font-space-grotesk)] ${
              prominent ? "text-sm" : "text-[13px]"
            }`}
          >
            {preset.name}
          </div>
          <div className="text-gray-400 text-xs mt-0.5 leading-snug">
            {preset.description}
          </div>
          <div className="text-gray-500 text-[11px] mt-1.5 font-mono tracking-tight">
            {preset.conditionsSummary}
          </div>
        </div>
      </div>
    </button>
  );
}
