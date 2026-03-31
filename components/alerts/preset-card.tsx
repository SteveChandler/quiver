"use client";

import type { PresetDefinition } from "@/lib/alerts/types";

interface PresetCardProps {
  preset: PresetDefinition;
  onSelect: (preset: PresetDefinition) => void;
  disabled?: boolean;
}

export function PresetCard({ preset, onSelect, disabled }: PresetCardProps) {
  return (
    <button
      onClick={() => onSelect(preset)}
      disabled={disabled}
      className="w-full text-left p-3 rounded-lg bg-[#354090]/50 hover:bg-[#354090] border border-[#404C92] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className="font-semibold text-white text-sm font-[family-name:var(--font-space-grotesk)]">
        {preset.name}
      </div>
      <div className="text-gray-400 text-xs mt-0.5">{preset.description}</div>
      <div className="text-gray-500 text-[11px] mt-1 font-mono">
        {preset.conditionsSummary}
      </div>
    </button>
  );
}
