"use client";

import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import type { AlertConditions } from "@/lib/alerts/types";

const CONDITION_TYPES = [
  {
    key: "swell_height",
    label: "Swell Size",
    fields: ["swell_height_min", "swell_height_max"],
  },
  {
    key: "swell_period",
    label: "Swell Period",
    fields: ["swell_period_min"],
  },
  {
    key: "swell_direction",
    label: "Swell Direction",
    fields: ["swell_direction_min_deg", "swell_direction_max_deg"],
  },
  {
    key: "wind_direction",
    label: "Wind Direction",
    fields: ["wind_direction"],
  },
  { key: "wind_speed", label: "Wind Speed", fields: ["wind_speed_max_kt"] },
  {
    key: "tide_height",
    label: "Tide Height",
    fields: ["tide_height_min_ft", "tide_height_max_ft"],
  },
  {
    key: "tide_direction",
    label: "Tide Direction",
    fields: ["tide_direction"],
  },
] as const;

type ConditionKey = (typeof CONDITION_TYPES)[number]["key"];

const COMPASS_DIRECTIONS = [
  { label: "N", min: 337.5, max: 22.5 },
  { label: "NE", min: 22.5, max: 67.5 },
  { label: "E", min: 67.5, max: 112.5 },
  { label: "SE", min: 112.5, max: 157.5 },
  { label: "S", min: 157.5, max: 202.5 },
  { label: "SW", min: 202.5, max: 247.5 },
  { label: "W", min: 247.5, max: 292.5 },
  { label: "NW", min: 292.5, max: 337.5 },
] as const;

function degreesToCompass(minDeg?: number, maxDeg?: number): string {
  if (minDeg == null || maxDeg == null) return "";
  // Find the closest matching compass direction
  const midpoint = minDeg <= maxDeg
    ? (minDeg + maxDeg) / 2
    : ((minDeg + maxDeg + 360) / 2) % 360;
  for (const dir of COMPASS_DIRECTIONS) {
    if (dir.label === "N") {
      if (midpoint >= 337.5 || midpoint < 22.5) return "N";
    } else if (midpoint >= dir.min && midpoint < dir.max) {
      return dir.label;
    }
  }
  return "";
}

const inputClasses =
  "bg-[#252D6B] text-white text-xs rounded-lg px-2.5 py-1.5 border border-[#404C92] focus:outline-none focus:ring-2 focus:ring-[#F78E42]/50 focus:border-[#F78E42] transition-colors font-mono";

const selectClasses =
  "bg-[#252D6B] text-white text-xs rounded-lg px-2.5 py-1.5 border border-[#404C92] focus:outline-none focus:ring-2 focus:ring-[#F78E42]/50 focus:border-[#F78E42] transition-colors";

interface ConditionBuilderProps {
  conditions: AlertConditions;
  onChange: (conditions: AlertConditions) => void;
}

export function ConditionBuilder({ conditions, onChange }: ConditionBuilderProps) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Click-outside and Escape to close the condition picker dropdown
  useEffect(() => {
    if (!showPicker) return;
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setShowPicker(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showPicker]);

  const activeKeys = CONDITION_TYPES.filter((ct) =>
    ct.fields.some((f) => (conditions as Record<string, unknown>)[f] != null)
  ).map((ct) => ct.key);

  const addCondition = (key: ConditionKey) => {
    const updates: Partial<AlertConditions> = {};
    switch (key) {
      case "swell_height":
        updates.swell_height_min = 2;
        break;
      case "swell_period":
        updates.swell_period_min = 10;
        break;
      case "swell_direction":
        updates.swell_direction_min_deg = 180;
        updates.swell_direction_max_deg = 270;
        break;
      case "wind_direction":
        updates.wind_direction = "offshore";
        break;
      case "wind_speed":
        updates.wind_speed_max_kt = 10;
        break;
      case "tide_height":
        updates.tide_height_min_ft = 2;
        updates.tide_height_max_ft = 5;
        break;
      case "tide_direction":
        updates.tide_direction = "rising";
        break;
    }
    onChange({ ...conditions, ...updates });
    setShowPicker(false);
  };

  const removeCondition = (key: ConditionKey) => {
    const ct = CONDITION_TYPES.find((c) => c.key === key);
    if (!ct) return;
    const updated = { ...conditions };
    for (const f of ct.fields) {
      delete (updated as Record<string, unknown>)[f];
    }
    onChange(updated);
  };

  const availableConditions = CONDITION_TYPES.filter(
    (ct) => !(activeKeys as readonly string[]).includes(ct.key)
  );

  return (
    <div className="space-y-2">
      {activeKeys.map((key) => (
        <ConditionRow
          key={key}
          conditionKey={key}
          conditions={conditions}
          onChange={onChange}
          onRemove={() => removeCondition(key)}
        />
      ))}

      {activeKeys.length < CONDITION_TYPES.length && (
        <div className="relative" ref={pickerRef}>
          <button
            onClick={() => setShowPicker(!showPicker)}
            aria-expanded={showPicker}
            aria-haspopup="listbox"
            className="text-sm text-[#F78E42] hover:text-[#F78E42]/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42]/50 focus-visible:rounded-md font-semibold font-[family-name:var(--font-space-grotesk)] py-1"
          >
            + Add condition
          </button>
          {showPicker && (
            <div
              role="listbox"
              aria-label="Available conditions"
              className="absolute z-10 mt-1 w-52 bg-[#2D357D] border border-[#404C92] rounded-lg shadow-xl p-1.5"
            >
              {availableConditions.map((ct) => (
                <button
                  key={ct.key}
                  role="option"
                  aria-selected={false}
                  onClick={() => addCondition(ct.key)}
                  className="w-full text-left px-3 py-2 text-sm text-white hover:bg-[#354090] focus-visible:bg-[#354090] focus-visible:outline-none rounded-md font-medium transition-colors"
                >
                  {ct.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ConditionRow({
  conditionKey,
  conditions,
  onChange,
  onRemove,
}: {
  conditionKey: ConditionKey;
  conditions: AlertConditions;
  onChange: (c: AlertConditions) => void;
  onRemove: () => void;
}) {
  const ct = CONDITION_TYPES.find((c) => c.key === conditionKey)!;

  const updateField = (field: string, value: unknown) => {
    onChange({ ...conditions, [field]: value });
  };

  return (
    <div className="flex items-center gap-2 bg-[#354090]/30 border border-[#404C92]/60 rounded-lg px-3 py-2">
      <span className="text-xs text-gray-300 font-semibold font-[family-name:var(--font-space-grotesk)] min-w-[80px]">
        {ct.label}
      </span>
      <div className="flex-1 flex items-center gap-2">
        {conditionKey === "swell_height" && (
          <>
            <input
              type="number"
              value={conditions.swell_height_min ?? ""}
              onChange={(e) =>
                updateField(
                  "swell_height_min",
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
              placeholder="min ft"
              className={`w-16 ${inputClasses}`}
              step="0.5"
              min="0"
            />
            <span className="text-gray-400 text-xs">to</span>
            <input
              type="number"
              value={conditions.swell_height_max ?? ""}
              onChange={(e) =>
                updateField(
                  "swell_height_max",
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
              placeholder="max ft"
              className={`w-16 ${inputClasses} ${
                conditions.swell_height_min != null &&
                conditions.swell_height_max != null &&
                conditions.swell_height_max < conditions.swell_height_min
                  ? "border-red-400/60"
                  : ""
              }`}
              step="0.5"
              min="0"
            />
          </>
        )}
        {conditionKey === "swell_period" && (
          <input
            type="number"
            value={conditions.swell_period_min ?? ""}
            onChange={(e) =>
              updateField(
                "swell_period_min",
                e.target.value ? Number(e.target.value) : undefined
              )
            }
            placeholder="min sec"
            className={`w-20 ${inputClasses}`}
            min="0"
          />
        )}
        {conditionKey === "swell_direction" && (
          <CompassSelector
            value={degreesToCompass(
              conditions.swell_direction_min_deg,
              conditions.swell_direction_max_deg
            )}
            onChange={(dir) => {
              const compass = COMPASS_DIRECTIONS.find((d) => d.label === dir);
              if (compass) {
                onChange({
                  ...conditions,
                  swell_direction_min_deg: compass.min,
                  swell_direction_max_deg: compass.max,
                });
              }
            }}
          />
        )}
        {conditionKey === "wind_direction" && (
          <select
            value={conditions.wind_direction ?? ""}
            onChange={(e) =>
              updateField("wind_direction", e.target.value || undefined)
            }
            className={selectClasses}
          >
            <option value="offshore">Offshore</option>
            <option value="onshore">Onshore</option>
            <option value="cross-shore">Cross-shore</option>
          </select>
        )}
        {conditionKey === "wind_speed" && (
          <input
            type="number"
            value={conditions.wind_speed_max_kt ?? ""}
            onChange={(e) =>
              updateField(
                "wind_speed_max_kt",
                e.target.value ? Number(e.target.value) : undefined
              )
            }
            placeholder="max kt"
            className={`w-20 ${inputClasses}`}
            min="0"
          />
        )}
        {conditionKey === "tide_height" && (
          <>
            <input
              type="number"
              value={conditions.tide_height_min_ft ?? ""}
              onChange={(e) =>
                updateField(
                  "tide_height_min_ft",
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
              placeholder="min ft"
              className={`w-16 ${inputClasses}`}
              step="0.5"
              min="0"
            />
            <span className="text-gray-400 text-xs">to</span>
            <input
              type="number"
              value={conditions.tide_height_max_ft ?? ""}
              onChange={(e) =>
                updateField(
                  "tide_height_max_ft",
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
              placeholder="max ft"
              className={`w-16 ${inputClasses} ${
                conditions.tide_height_min_ft != null &&
                conditions.tide_height_max_ft != null &&
                conditions.tide_height_max_ft < conditions.tide_height_min_ft
                  ? "border-red-400/60"
                  : ""
              }`}
              step="0.5"
              min="0"
            />
          </>
        )}
        {conditionKey === "tide_direction" && (
          <select
            value={conditions.tide_direction ?? ""}
            onChange={(e) =>
              updateField("tide_direction", e.target.value || undefined)
            }
            className={selectClasses}
          >
            <option value="rising">Rising</option>
            <option value="falling">Falling</option>
            <option value="high">High</option>
            <option value="low">Low</option>
          </select>
        )}
      </div>
      <button
        onClick={onRemove}
        className="text-gray-500 hover:text-red-400 focus-visible:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 focus-visible:rounded active:scale-95 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0 -mr-2"
        aria-label={`Remove ${ct.label} condition`}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function CompassSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (dir: string) => void;
}) {
  return (
    <div className="flex gap-1 flex-wrap" role="group" aria-label="Compass direction">
      {COMPASS_DIRECTIONS.map((dir) => (
        <button
          key={dir.label}
          onClick={() => onChange(dir.label)}
          aria-label={`${dir.label} direction`}
          aria-pressed={value === dir.label}
          className={`w-9 h-9 rounded-md text-[11px] font-mono font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42]/50 active:scale-95 touch-action-manipulation ${
            value === dir.label
              ? "bg-[#F78E42]/20 border border-[#F78E42] text-[#F78E42]"
              : "bg-[#252D6B] border border-[#404C92] text-gray-400 hover:border-gray-300 hover:text-white"
          }`}
        >
          {dir.label}
        </button>
      ))}
    </div>
  );
}
