"use client";

import { useState, useRef, useEffect, useId } from "react";
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
  "zine-alert-control bg-[#FBF6E8] text-[#11100D] text-xs rounded-sm px-2.5 py-1.5 border-2 border-[#11100D] focus:outline-none focus:ring-2 focus:ring-[#F78E42]/50 focus:border-[#F78E42] transition-colors font-mono";

const selectClasses =
  "zine-alert-control bg-[#FBF6E8] text-[#11100D] text-xs rounded-sm px-2.5 py-1.5 border-2 border-[#11100D] focus:outline-none focus:ring-2 focus:ring-[#F78E42]/50 focus:border-[#F78E42] transition-colors";

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
            className="py-1 font-[family-name:var(--font-space-grotesk)] text-sm font-black text-[#11100D] underline decoration-[#F78E42] decoration-2 underline-offset-4 hover:text-[#F78E42] focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42]/60"
          >
            + Add condition
          </button>
          {showPicker && (
            <div
              role="listbox"
              aria-label="Available conditions"
              className="absolute z-10 mt-1 w-52 rounded-sm border-2 border-[#11100D] bg-[#FBF6E8] p-1.5 shadow-[4px_4px_0_rgba(17,16,13,0.28)]"
            >
              {availableConditions.map((ct) => (
                <button
                  key={ct.key}
                  role="option"
                  aria-selected={false}
                  onClick={() => addCondition(ct.key)}
                  className="w-full rounded-sm px-3 py-2 text-left text-sm font-bold text-[#11100D] transition-colors hover:bg-[#F78E42]/20 focus-visible:bg-[#F78E42]/20 focus-visible:outline-none"
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
  const labelId = useId();
  const rangeErrorId = useId();

  const updateField = (field: string, value: unknown) => {
    onChange({ ...conditions, [field]: value });
  };

  // Range inversion is currently signalled by border colour alone. Surface it as
  // text too so it survives WCAG 1.4.1 (use of colour) and screen readers.
  const swellRangeInverted =
    conditions.swell_height_min != null &&
    conditions.swell_height_max != null &&
    conditions.swell_height_max < conditions.swell_height_min;
  const tideRangeInverted =
    conditions.tide_height_min_ft != null &&
    conditions.tide_height_max_ft != null &&
    conditions.tide_height_max_ft < conditions.tide_height_min_ft;
  // `conditions` is the shared object every row receives, so the message has to
  // be scoped to this row's own key — otherwise a bad swell range prints the
  // error on Wind Speed, which has no range at all.
  const rangeInverted =
    (conditionKey === "swell_height" && swellRangeInverted) ||
    (conditionKey === "tide_height" && tideRangeInverted);

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className="flex flex-col gap-2 rounded-sm border-2 border-[#11100D]/50 bg-[#FFF9EA] px-3 py-2 sm:flex-row sm:items-center"
    >
      <span
        id={labelId}
        className="min-w-[92px] font-[family-name:var(--font-space-grotesk)] text-xs font-black uppercase tracking-[0.03em] text-[#11100D]"
      >
        {ct.label}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {conditionKey === "swell_height" && (
          <>
            <input
              type="number"
              aria-label="Minimum swell size, feet"
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
            <span className="text-xs font-bold text-[#403A2E]">to</span>
            <input
              type="number"
              aria-label="Maximum swell size, feet"
              aria-invalid={swellRangeInverted}
              aria-describedby={swellRangeInverted ? rangeErrorId : undefined}
              value={conditions.swell_height_max ?? ""}
              onChange={(e) =>
                updateField(
                  "swell_height_max",
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
              placeholder="max ft"
              className={`w-16 ${inputClasses} ${
                swellRangeInverted ? "border-red-600" : ""
              }`}
              step="0.5"
              min="0"
            />
          </>
        )}
        {conditionKey === "swell_period" && (
          <input
            type="number"
            aria-label="Minimum swell period, seconds"
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
            aria-label="Wind direction"
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
            aria-label="Maximum wind speed, knots"
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
              aria-label="Minimum tide height, feet"
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
            <span className="text-xs font-bold text-[#403A2E]">to</span>
            <input
              type="number"
              aria-label="Maximum tide height, feet"
              aria-invalid={tideRangeInverted}
              aria-describedby={tideRangeInverted ? rangeErrorId : undefined}
              value={conditions.tide_height_max_ft ?? ""}
              onChange={(e) =>
                updateField(
                  "tide_height_max_ft",
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
              placeholder="max ft"
              className={`w-16 ${inputClasses} ${
                tideRangeInverted ? "border-red-600" : ""
              }`}
              step="0.5"
              min="0"
            />
          </>
        )}
        {conditionKey === "tide_direction" && (
          <select
            aria-label="Tide direction"
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
        {rangeInverted && (
          <p
            id={rangeErrorId}
            role="alert"
            className="w-full text-xs font-bold text-[#B42318]"
          >
            Max must be higher than min.
          </p>
        )}
      </div>
      <button
        onClick={onRemove}
        className="-mr-2 flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-sm text-[#403A2E] transition-[color,background-color,box-shadow,transform] hover:bg-red-100 hover:text-red-700 focus-visible:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60 active:scale-95"
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
    <div className="flex flex-wrap gap-1" role="group" aria-label="Compass direction">
      {COMPASS_DIRECTIONS.map((dir) => (
        <button
          key={dir.label}
          onClick={() => onChange(dir.label)}
          aria-label={`${dir.label} direction`}
          aria-pressed={value === dir.label}
          className={`h-9 w-9 touch-action-manipulation rounded-sm border-2 font-mono text-[11px] font-black transition-[color,background-color,border-color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42]/60 active:scale-95 ${
            value === dir.label
              ? "border-[#11100D] bg-[#F78E42] text-[#11100D]"
              : "border-[#11100D]/45 bg-[#FBF6E8] text-[#403A2E] hover:border-[#11100D]"
          }`}
        >
          {dir.label}
        </button>
      ))}
    </div>
  );
}
