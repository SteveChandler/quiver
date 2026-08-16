"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { WAVE_CHARACTERISTICS } from "@/components/session-forms/shared/constants";

export interface WaveType {
  id: string;
  label: string;
  emoji: string;
  description: string;
  color: string;
}

const WAVE_TYPE_DETAILS: Record<
  (typeof WAVE_CHARACTERISTICS)[number]["value"],
  Omit<WaveType, "id" | "label">
> = {
  clean: {
    emoji: "📏",
    description: "Well-organized, smooth waves",
    color: "bg-green-100 text-green-800 hover:bg-green-200",
  },
  glassy: {
    emoji: "🪞",
    description: "Smooth, mirror-like surface",
    color: "bg-teal-100 text-teal-800 hover:bg-teal-200",
  },
  choppy: {
    emoji: "🌬️",
    description: "Bumpy, wind-ruffled surface",
    color: "bg-slate-100 text-slate-800 hover:bg-slate-200",
  },
  blown_out: {
    emoji: "💨",
    description: "Windy, disorganized surf",
    color: "bg-zinc-100 text-zinc-800 hover:bg-zinc-200",
  },
  fat: {
    emoji: "🌊",
    description: "Wide, mellow waves",
    color: "bg-blue-100 text-blue-800 hover:bg-blue-200",
  },
  mushy: {
    emoji: "🫧",
    description: "Soft, slow-breaking waves",
    color: "bg-gray-100 text-gray-800 hover:bg-gray-200",
  },
  peaky: {
    emoji: "⛰️",
    description: "Sharp, defined peaks",
    color: "bg-purple-100 text-purple-800 hover:bg-purple-200",
  },
  powerful: {
    emoji: "💪",
    description: "Strong, heavy waves",
    color: "bg-red-100 text-red-800 hover:bg-red-200",
  },
  closeouts: {
    emoji: "🚪",
    description: "Waves breaking all at once",
    color: "bg-orange-100 text-orange-800 hover:bg-orange-200",
  },
  barreling: {
    emoji: "🌀",
    description: "Hollow, tube-forming waves",
    color: "bg-cyan-100 text-cyan-800 hover:bg-cyan-200",
  },
  reform: {
    emoji: "🔄",
    description: "Waves that break, then reform",
    color: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200",
  },
  walled: {
    emoji: "🧱",
    description: "Long sections with little shoulder",
    color: "bg-stone-100 text-stone-800 hover:bg-stone-200",
  },
  rights: {
    emoji: "➡️",
    description: "Waves peeling to the right",
    color: "bg-emerald-100 text-emerald-800 hover:bg-emerald-200",
  },
  lefts: {
    emoji: "⬅️",
    description: "Waves peeling to the left",
    color: "bg-indigo-100 text-indigo-800 hover:bg-indigo-200",
  },
  steep: {
    emoji: "📐",
    description: "Steep, fast-dropping faces",
    color: "bg-rose-100 text-rose-800 hover:bg-rose-200",
  },
};

export const WAVE_TYPES: WaveType[] = WAVE_CHARACTERISTICS.map(
  ({ value, label }) => ({
    id: value,
    label,
    ...WAVE_TYPE_DETAILS[value],
  })
);

export function getWaveTypeLabel(typeId: string): string {
  return WAVE_TYPES.find((waveType) => waveType.id === typeId)?.label ?? typeId;
}

interface WaveTypeSelectorProps {
  selectedTypes: string[];
  onChange: (types: string[]) => void;
  className?: string;
}

export function WaveTypeSelector({
  selectedTypes = [],
  onChange,
  className = "",
}: WaveTypeSelectorProps) {
  const toggleWaveType = (typeId: string) => {
    const isSelected = selectedTypes.includes(typeId);
    if (isSelected) {
      onChange(selectedTypes.filter((id) => id !== typeId));
    } else {
      onChange([...selectedTypes, typeId]);
    }
  };

  const removeWaveType = (typeId: string) => {
    onChange(selectedTypes.filter((id) => id !== typeId));
  };

  const clearAll = () => {
    onChange([]);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Selected Tags */}
      {selectedTypes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[#A8B8D0]">Selected:</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="h-6 px-2 text-xs text-[#8B9EC2] hover:text-[#A8B8D0]"
            >
              Clear all
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedTypes.map((typeId) => {
              const waveType = WAVE_TYPES.find((t) => t.id === typeId);
              if (!waveType) return null;

              return (
                <Badge
                  key={typeId}
                  variant="secondary"
                  className={`${waveType.color} cursor-pointer`}
                  onClick={() => removeWaveType(typeId)}
                >
                  <span className="mr-1">{waveType.emoji}</span>
                  {waveType.label}
                  <X className="ml-1 h-3 w-3" />
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      {/* Available Options */}
      <div className="space-y-2">
        <span className="text-sm font-medium text-[#A8B8D0]">
          Wave characteristics:
        </span>
        <div className="grid grid-cols-2 gap-2">
          {WAVE_TYPES.map((waveType) => {
            const isSelected = selectedTypes.includes(waveType.id);

            return (
              <button
                key={waveType.id}
                type="button"
                onClick={() => toggleWaveType(waveType.id)}
                className={`p-2 rounded-lg border-2 transition-colors text-left ${
                  isSelected
                    ? "border-[#F78E42] bg-[#F78E42]/10"
                    : "border-[#404C92] hover:border-[#2A3F66] bg-[#354090] hover:bg-[#404C92]"
                }` + " focus-ring"}
                title={waveType.description}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{waveType.emoji}</span>
                  <span
                    className={`text-sm font-medium ${
                      isSelected ? "text-[#F78E42]" : "text-[#F0F0F0]"
                    }`}
                  >
                    {waveType.label}
                  </span>
                </div>
                <p className="text-xs text-[#9AABC6] leading-tight break-words">
                  {waveType.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {selectedTypes.length === 0 && (
        <p className="text-xs text-[#8B9EC2] text-center italic">
          Select wave characteristics that best describe the conditions
        </p>
      )}
    </div>
  );
}
