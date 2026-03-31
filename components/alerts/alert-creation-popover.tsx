"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PresetCard } from "./preset-card";
import { ConditionBuilder } from "./condition-builder";
import { PRESETS, getPresetsForGroup } from "@/lib/alerts/presets";
import type { AlertConditions, BeachAlertMeta, PresetDefinition } from "@/lib/alerts/types";

interface AlertCreationPopoverProps {
  beachId: string;
  beachName: string;
  beach: BeachAlertMeta;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRuleCreated?: () => void;
}

type Stage =
  | { step: "presets" }
  | { step: "customize"; preset: PresetDefinition; conditions: AlertConditions }
  | { step: "custom"; conditions: AlertConditions };

export function AlertCreationPopover({
  beachId,
  beachName,
  beach,
  open,
  onOpenChange,
  onRuleCreated,
}: AlertCreationPopoverProps) {
  const [stage, setStage] = useState<Stage>({ step: "presets" });
  const [name, setName] = useState("");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyPush, setNotifyPush] = useState(false);
  const [saving, setSaving] = useState(false);

  const popularPresets = getPresetsForGroup("popular");
  const specificPresets = getPresetsForGroup("specific");

  function handleClose() {
    onOpenChange(false);
    // Reset state after close animation
    setTimeout(() => {
      setStage({ step: "presets" });
      setName("");
      setNotifyEmail(true);
      setNotifyPush(false);
    }, 200);
  }

  async function handlePresetSelect(preset: PresetDefinition) {
    // Quick-create: POST immediately with preset defaults
    const conditions = preset.buildConditions(beach);
    setSaving(true);
    try {
      const res = await fetch("/api/alerts/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beach_id: beachId,
          name: `${preset.name} — ${beachName}`,
          preset_type: preset.type,
          conditions,
          notify_email: notifyEmail,
          notify_push: notifyPush,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.message ?? json.error ?? "Failed to create alert");
        return;
      }
      toast.success(`Alert created: ${preset.name}`);
      onRuleCreated?.();
      handleClose();
    } catch {
      toast.error("Failed to create alert");
    } finally {
      setSaving(false);
    }
  }

  function handleCustomize(preset: PresetDefinition) {
    const conditions = preset.buildConditions(beach);
    setName(`${preset.name} — ${beachName}`);
    setStage({ step: "customize", preset, conditions });
  }

  async function handleSave() {
    const currentStage = stage;
    if (currentStage.step === "presets") return;

    const conditions = currentStage.conditions;
    const ruleName =
      name.trim() ||
      (currentStage.step === "customize"
        ? `${currentStage.preset.name} — ${beachName}`
        : `Custom Alert — ${beachName}`);

    setSaving(true);
    try {
      const res = await fetch("/api/alerts/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beach_id: beachId,
          name: ruleName,
          preset_type:
            currentStage.step === "customize"
              ? currentStage.preset.type
              : null,
          conditions,
          notify_email: notifyEmail,
          notify_push: notifyPush,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.message ?? json.error ?? "Failed to create alert");
        return;
      }
      toast.success("Alert created");
      onRuleCreated?.();
      handleClose();
    } catch {
      toast.error("Failed to create alert");
    } finally {
      setSaving(false);
    }
  }

  function handleConditionsChange(conditions: AlertConditions) {
    setStage((prev) => {
      if (prev.step === "customize") return { ...prev, conditions };
      if (prev.step === "custom") return { ...prev, conditions };
      return prev;
    });
  }

  const isEditing = stage.step === "customize" || stage.step === "custom";
  const currentConditions = isEditing ? stage.conditions : {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1E2660] border border-[#404C92] text-white max-w-md w-full p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-semibold font-[family-name:var(--font-space-grotesk)] text-white">
              {stage.step === "presets"
                ? `Alerts for ${beachName}`
                : stage.step === "customize"
                  ? `Customize: ${stage.preset.name}`
                  : "Custom Alert"}
            </DialogTitle>
            {isEditing && (
              <button
                onClick={() => setStage({ step: "presets" })}
                className="text-xs text-gray-400 hover:text-white transition-colors"
              >
                ← Back
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {stage.step === "presets"
              ? "Pick a preset or build your own conditions"
              : "Customize your alert conditions and channels"}
          </p>
        </DialogHeader>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {stage.step === "presets" && (
            <>
              <PresetGroup
                label="Popular"
                presets={popularPresets}
                onSelect={handlePresetSelect}
                onCustomize={handleCustomize}
                disabled={saving}
              />
              <PresetGroup
                label="Specific"
                presets={specificPresets}
                onSelect={handlePresetSelect}
                onCustomize={handleCustomize}
                disabled={saving}
              />
              <button
                onClick={() => {
                  setName(`Custom Alert — ${beachName}`);
                  setStage({ step: "custom", conditions: {} });
                }}
                className="w-full text-sm text-[#F78E42] hover:text-[#F78E42]/80 font-medium py-2 border border-dashed border-[#404C92] rounded-lg transition-colors"
              >
                + Build Custom Alert
              </button>
            </>
          )}

          {isEditing && (
            <>
              {/* Name input */}
              <div className="space-y-1">
                <label className="text-xs text-gray-400">Alert Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Name your alert..."
                  className="w-full bg-[#252D6B] text-white text-sm rounded px-3 py-2 border border-[#404C92] placeholder:text-gray-600"
                />
              </div>

              {/* Condition builder */}
              <div className="space-y-1">
                <label className="text-xs text-gray-400">Conditions</label>
                <ConditionBuilder
                  conditions={currentConditions}
                  onChange={handleConditionsChange}
                />
              </div>

              {/* Channel toggles */}
              <div className="space-y-2">
                <label className="text-xs text-gray-400">Notify via</label>
                <div className="flex gap-3">
                  <ToggleChip
                    label="Email"
                    active={notifyEmail}
                    onClick={() => setNotifyEmail(!notifyEmail)}
                  />
                  <ToggleChip
                    label="Push"
                    active={notifyPush}
                    onClick={() => setNotifyPush(!notifyPush)}
                  />
                </div>
              </div>

              {/* Save button */}
              <Button
                onClick={handleSave}
                disabled={saving || (!notifyEmail && !notifyPush)}
                className="w-full bg-[#F78E42] hover:bg-[#F78E42]/90 text-white font-semibold"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Save Alert
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PresetGroup({
  label,
  presets,
  onSelect,
  onCustomize,
  disabled,
}: {
  label: string;
  presets: PresetDefinition[];
  onSelect: (preset: PresetDefinition) => void;
  onCustomize: (preset: PresetDefinition) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 font-[family-name:var(--font-space-grotesk)]">
        {label}
      </div>
      <div className="space-y-1.5">
        {presets.map((preset) => (
          <div key={preset.type} className="relative group">
            <PresetCard preset={preset} onSelect={onSelect} disabled={disabled} />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCustomize(preset);
              }}
              disabled={disabled}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 hover:text-[#F78E42] opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
            >
              Customize
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ToggleChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
        active
          ? "bg-[#F78E42]/20 border-[#F78E42] text-[#F78E42]"
          : "bg-transparent border-[#404C92] text-gray-500 hover:border-gray-400"
      }`}
    >
      {label}
    </button>
  );
}
