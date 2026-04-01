"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Mail, Bell as BellIcon } from "lucide-react";
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
import { getPresetsForGroup, getPreset } from "@/lib/alerts/presets";
import type { AlertConditions, BeachAlertMeta, PresetDefinition } from "@/lib/alerts/types";

interface AlertCreationPopoverProps {
  beachId: string;
  beachName: string;
  beach: BeachAlertMeta;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRuleCreated?: () => void;
  /** When provided, auto-select this preset instead of showing the presets grid */
  initialPreset?: string;
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
  initialPreset,
}: AlertCreationPopoverProps) {
  const [stage, setStage] = useState<Stage>({ step: "presets" });
  const initialPresetApplied = useRef(false);
  const [name, setName] = useState("");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyPush, setNotifyPush] = useState(true);
  const [saving, setSaving] = useState(false);

  // Auto-select initialPreset when popover opens
  useEffect(() => {
    if (!open || !initialPreset || initialPresetApplied.current) return;

    const preset = getPreset(initialPreset as Parameters<typeof getPreset>[0]);
    if (preset) {
      initialPresetApplied.current = true;
      handlePresetSelect(preset);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPreset]);

  const popularPresets = getPresetsForGroup("popular");
  const specificPresets = getPresetsForGroup("specific");

  function handleClose() {
    onOpenChange(false);
    // Reset state after close animation
    setTimeout(() => {
      setStage({ step: "presets" });
      setName("");
      setNotifyEmail(true);
      setNotifyPush(true);
      initialPresetApplied.current = false;
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
        toast.error(json.message ?? json.error ?? "Couldn't create alert");
        return;
      }
      toast.success(`Alert created: ${preset.name}`);
      onRuleCreated?.();
      handleClose();
    } catch {
      toast.error("Couldn't create alert");
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
        : `Custom alert — ${beachName}`);

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
        toast.error(json.message ?? json.error ?? "Couldn't create alert");
        return;
      }
      toast.success("Alert created");
      onRuleCreated?.();
      handleClose();
    } catch {
      toast.error("Couldn't create alert");
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
  const hasConditions = isEditing && Object.keys(currentConditions).length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1E2660] border border-[#404C92] text-white max-w-md w-full p-0 overflow-hidden bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48ZmlsdGVyIGlkPSJuIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iMC44IiBudW1PY3RhdmVzPSI0IiBzdGl0Y2hUaWxlcz0ic3RpdGNoIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbHRlcj0idXJsKCNuKSIgb3BhY2l0eT0iMC4wMyIvPjwvc3ZnPg==')]">
        <DialogHeader className="px-5 pt-5 pb-0 pr-12">
          <div className="flex items-center gap-2">
            {isEditing && (
              <button
                onClick={() => setStage({ step: "presets" })}
                aria-label="Back to presets"
                className="text-xs text-gray-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42]/50 focus-visible:rounded transition-colors shrink-0"
              >
                &larr; Back
              </button>
            )}
            <DialogTitle className="text-base font-bold font-[family-name:var(--font-space-grotesk)] text-white tracking-tight truncate">
              {stage.step === "presets"
                ? `Alerts for ${beachName}`
                : stage.step === "customize"
                  ? `Customize: ${stage.preset.name}`
                  : "Custom alert"}
            </DialogTitle>
          </div>
          <p className="text-xs text-gray-300 mt-1">
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
                prominent
              />
              <PresetGroup
                label="Specific"
                presets={specificPresets}
                onSelect={handlePresetSelect}
                onCustomize={handleCustomize}
                disabled={saving}
              />
            </>
          )}

          {isEditing && (
            <>
              {/* Name input */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 font-[family-name:var(--font-space-grotesk)]">
                  Alert name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="optional — auto-generated if blank"
                  maxLength={100}
                  className="w-full bg-[#252D6B] text-white text-sm rounded-lg px-3 py-2 border border-[#404C92] placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#F78E42]/50 focus:border-[#F78E42] transition-colors"
                />
              </div>

              {/* Condition builder */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 font-[family-name:var(--font-space-grotesk)]">
                  Conditions
                </label>
                <ConditionBuilder
                  conditions={currentConditions}
                  onChange={handleConditionsChange}
                />
              </div>

              {/* Channel toggles */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 font-[family-name:var(--font-space-grotesk)]">
                  Notify via
                </label>
                <div className="flex gap-3">
                  <ToggleChip
                    label="Email"
                    icon={<Mail className="w-3 h-3" />}
                    active={notifyEmail}
                    onClick={() => setNotifyEmail(!notifyEmail)}
                  />
                  <ToggleChip
                    label="Push"
                    icon={<BellIcon className="w-3 h-3" />}
                    active={notifyPush}
                    onClick={() => setNotifyPush(!notifyPush)}
                  />
                </div>
              </div>

              {/* Save button */}
              <Button
                onClick={handleSave}
                disabled={saving || !hasConditions || (!notifyEmail && !notifyPush)}
                className="w-full bg-[#F78E42] hover:bg-[#F78E42]/90 active:scale-[0.98] text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Save alert
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
  prominent,
}: {
  label: string;
  presets: PresetDefinition[];
  onSelect: (preset: PresetDefinition) => void;
  onCustomize: (preset: PresetDefinition) => void;
  disabled: boolean;
  prominent?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-bold uppercase tracking-widest text-gray-400 font-[family-name:var(--font-space-grotesk)]">
        {label}
      </div>
      <div className="space-y-1.5">
        {presets.map((preset, index) => (
          <div
            key={preset.type}
            className="relative group motion-safe:animate-[fadeSlideIn_0.2s_ease-out_both]"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <PresetCard
              preset={preset}
              onSelect={onSelect}
              disabled={disabled}
              prominent={prominent}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCustomize(preset);
              }}
              disabled={disabled}
              aria-label={`Customize ${preset.name}`}
              className="absolute right-1 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 hover:text-[#F78E42] focus-visible:text-[#F78E42] focus-visible:opacity-100 focus-visible:outline-none opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
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
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${label} notifications ${active ? "enabled" : "disabled"}`}
      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42]/50 active:scale-95 ${
        active
          ? "bg-[#F78E42]/20 border-[#F78E42] text-[#F78E42]"
          : "bg-transparent border-[#404C92] text-gray-400 hover:border-gray-300"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
