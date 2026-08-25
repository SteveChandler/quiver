"use client";

import type { PresetDefinition, PresetType } from "@/lib/alerts/types";

const PRESET_CONFIG: Record<
  PresetType,
  { label: string; accentClass: string }
> = {
  glass_off: { label: "Glass", accentClass: "bg-[#DDEEFF] text-[#173355]" },
  mellow_session: { label: "Cruise", accentClass: "bg-[#DDF2E7] text-[#183D2B]" },
  dawn_patrol: { label: "Dawn", accentClass: "bg-[#FFE7BE] text-[#4A2E08]" },
  big_day: { label: "Size", accentClass: "bg-[#FFD9D0] text-[#5B1D12]" },
  clean_groundswell: { label: "Period", accentClass: "bg-[#E7DFFF] text-[#2D205F]" },
  tide_window: { label: "Tide", accentClass: "bg-[#DDF6F3] text-[#16423E]" },
  epic_conditions: { label: "Epic", accentClass: "bg-[#F78E42] text-[#11100D]" },
  daily_check_in: { label: "Daily", accentClass: "bg-[#E6E0D1] text-[#2D2A24]" },
  weekend_warrior: { label: "Weekend", accentClass: "bg-[#FFF3C4] text-[#4A3B08]" },
  after_work: { label: "Evening", accentClass: "bg-[#FFE0F0] text-[#4A1030]" },
  watched_call: { label: "Watch", accentClass: "bg-[#DDEEFF] text-[#173355]" },
};

interface PresetCardProps {
  preset: PresetDefinition;
  onSelect: (preset: PresetDefinition) => void;
  disabled?: boolean;
  prominent?: boolean;
}

export function PresetCard({ preset, onSelect, disabled, prominent }: PresetCardProps) {
  const config = PRESET_CONFIG[preset.type];
  const summaryChips = preset.conditionsSummary
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <button
      onClick={() => onSelect(preset)}
      disabled={disabled}
      aria-label={`${preset.name}: ${preset.description}`}
      className={`w-full text-left rounded-md border-2 border-[#11100D] bg-[#F4EBD8] text-[#11100D] shadow-[3px_3px_0_rgba(17,16,13,0.68)] transition-[background-color,box-shadow,transform,opacity] disabled:opacity-50 disabled:cursor-not-allowed motion-safe:hover:-translate-y-0.5 hover:bg-[#FFF5DF] hover:shadow-[4px_4px_0_rgba(17,16,13,0.78)] active:translate-y-0 active:shadow-[2px_2px_0_rgba(17,16,13,0.68)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42]/70 ${
        prominent
          ? "px-3.5 py-3"
          : "px-3 py-2.5"
      }`}
    >
      <div className="flex items-start gap-3 pr-20">
        <span
          className={`mt-0.5 inline-flex min-w-[64px] shrink-0 items-center justify-center rounded-sm border-2 border-[#11100D] px-2 py-1 font-mono text-[10px] font-black uppercase tracking-[0.12em] shadow-[2px_2px_0_rgba(17,16,13,0.35)] ${config.accentClass}`}
          aria-hidden="true"
        >
          {config.label}
        </span>
        <div className="min-w-0">
          <div
            className={`font-[family-name:var(--font-space-grotesk)] font-black uppercase leading-tight tracking-[0.03em] text-[#11100D] ${
              prominent ? "text-[13px]" : "text-xs"
            }`}
          >
            {preset.name}
          </div>
          <div className="mt-1 text-xs leading-5 text-[#403A2E]">
            {preset.description}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {summaryChips.map((chip) => (
              <span
                key={chip}
                className="rounded-sm border border-[#11100D]/35 bg-[#FFF9EA] px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.04em] text-[#252D6B]"
              >
                {chip}
              </span>
            ))}
          </div>
        </div>
      </div>
    </button>
  );
}
