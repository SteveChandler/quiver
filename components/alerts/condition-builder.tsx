"use client";

import { useState } from "react";
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

interface ConditionBuilderProps {
  conditions: AlertConditions;
  onChange: (conditions: AlertConditions) => void;
}

export function ConditionBuilder({ conditions, onChange }: ConditionBuilderProps) {
  const [showPicker, setShowPicker] = useState(false);

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

  return (
    <div className="space-y-3">
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
        <div className="relative">
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="text-sm text-[#F78E42] hover:text-[#F78E42]/80 font-medium"
          >
            + Add Condition
          </button>
          {showPicker && (
            <div className="absolute z-10 mt-1 w-48 bg-[#2D357D] border border-[#404C92] rounded-lg shadow-lg p-1">
              {CONDITION_TYPES.filter(
                (ct) => !(activeKeys as readonly string[]).includes(ct.key)
              ).map((ct) => (
                <button
                  key={ct.key}
                  onClick={() => addCondition(ct.key)}
                  className="w-full text-left px-3 py-2 text-sm text-white hover:bg-[#354090] rounded"
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
    <div className="flex items-center gap-2 bg-[#354090]/30 rounded-lg p-2">
      <span className="text-xs text-gray-400 min-w-[80px]">{ct.label}</span>
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
              placeholder="Min ft"
              className="w-16 bg-[#252D6B] text-white text-xs rounded px-2 py-1 border border-[#404C92]"
              step="0.5"
            />
            <span className="text-gray-500 text-xs">to</span>
            <input
              type="number"
              value={conditions.swell_height_max ?? ""}
              onChange={(e) =>
                updateField(
                  "swell_height_max",
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
              placeholder="Max ft"
              className="w-16 bg-[#252D6B] text-white text-xs rounded px-2 py-1 border border-[#404C92]"
              step="0.5"
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
            placeholder="Min seconds"
            className="w-20 bg-[#252D6B] text-white text-xs rounded px-2 py-1 border border-[#404C92]"
          />
        )}
        {conditionKey === "swell_direction" && (
          <>
            <input
              type="number"
              value={conditions.swell_direction_min_deg ?? ""}
              onChange={(e) =>
                updateField(
                  "swell_direction_min_deg",
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
              placeholder="From °"
              className="w-16 bg-[#252D6B] text-white text-xs rounded px-2 py-1 border border-[#404C92]"
              min="0"
              max="360"
            />
            <span className="text-gray-500 text-xs">to</span>
            <input
              type="number"
              value={conditions.swell_direction_max_deg ?? ""}
              onChange={(e) =>
                updateField(
                  "swell_direction_max_deg",
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
              placeholder="To °"
              className="w-16 bg-[#252D6B] text-white text-xs rounded px-2 py-1 border border-[#404C92]"
              min="0"
              max="360"
            />
          </>
        )}
        {conditionKey === "wind_direction" && (
          <select
            value={conditions.wind_direction ?? ""}
            onChange={(e) =>
              updateField("wind_direction", e.target.value || undefined)
            }
            className="bg-[#252D6B] text-white text-xs rounded px-2 py-1 border border-[#404C92]"
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
            placeholder="Max knots"
            className="w-20 bg-[#252D6B] text-white text-xs rounded px-2 py-1 border border-[#404C92]"
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
              placeholder="Min ft"
              className="w-16 bg-[#252D6B] text-white text-xs rounded px-2 py-1 border border-[#404C92]"
              step="0.5"
            />
            <span className="text-gray-500 text-xs">to</span>
            <input
              type="number"
              value={conditions.tide_height_max_ft ?? ""}
              onChange={(e) =>
                updateField(
                  "tide_height_max_ft",
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
              placeholder="Max ft"
              className="w-16 bg-[#252D6B] text-white text-xs rounded px-2 py-1 border border-[#404C92]"
              step="0.5"
            />
          </>
        )}
        {conditionKey === "tide_direction" && (
          <select
            value={conditions.tide_direction ?? ""}
            onChange={(e) =>
              updateField("tide_direction", e.target.value || undefined)
            }
            className="bg-[#252D6B] text-white text-xs rounded px-2 py-1 border border-[#404C92]"
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
        className="text-gray-500 hover:text-red-400 text-xs"
        aria-label={`Remove ${ct.label} condition`}
      >
        ×
      </button>
    </div>
  );
}
