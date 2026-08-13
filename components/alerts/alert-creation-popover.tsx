"use client";

import { useState, useEffect, useId, useRef } from "react";
import { Loader2, Mail, Radio } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PresetCard } from "./preset-card";
import { ConditionBuilder } from "./condition-builder";
import { getPresetsForGroup, getPreset } from "@/lib/alerts/presets";
import { useTrackEvent } from "@/hooks/use-track-event";
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
  freeGrowthPhaseEnabled?: boolean;
}

type Stage =
  | { step: "presets" }
  | { step: "customize"; preset: PresetDefinition; conditions: AlertConditions }
  | { step: "custom"; conditions: AlertConditions };

function buildPresetAlertName(presetName: string, beachName: string): string {
  return `${presetName} at ${beachName}`;
}

function buildCustomAlertName(beachName: string): string {
  return `Custom alert at ${beachName}`;
}

export function AlertCreationPopover({
  beachId,
  beachName,
  beach,
  open,
  onOpenChange,
  onRuleCreated,
  initialPreset,
  freeGrowthPhaseEnabled = false,
}: AlertCreationPopoverProps) {
  const [stage, setStage] = useState<Stage>({ step: "presets" });
  const initialPresetApplied = useRef(false);
  const nameFieldId = useId();
  const conditionsLabelId = useId();
  const notifyLabelId = useId();
  const [name, setName] = useState("");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyPush, setNotifyPush] = useState(true);
  const [saving, setSaving] = useState(false);
  const { track } = useTrackEvent();

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

  function trackAlertCreated(
    creationFlow: "preset" | "customize" | "custom",
    presetType: string | null,
  ) {
    void track("alert_rule_created", {
      beachId,
      metadata: {
        surface: "alert_creation_popover",
        creation_flow: creationFlow,
        preset_type: presetType,
      },
    });
    void track("watch_spot_tapped", {
      beachId,
      metadata: {
        surface: "alert_creation_popover",
        outcome: "created",
        creation_flow: creationFlow,
        preset_type: presetType,
      },
    });
  }

  function trackLockedCreateFailure(status: number) {
    if (status !== 403) return;

    void track("watch_spot_tapped", {
      beachId,
      metadata: {
        surface: "alert_creation_popover",
        outcome: "upsell",
        error_status: status,
      },
    });
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
          name: buildPresetAlertName(preset.name, beachName),
          preset_type: preset.type,
          conditions,
          notify_email: notifyEmail,
          notify_push: notifyPush,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        trackLockedCreateFailure(res.status);
        toast.error(json.message ?? json.error ?? "Couldn't create alert");
        return;
      }
      trackAlertCreated("preset", preset.type);
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
    setName(buildPresetAlertName(preset.name, beachName));
    setStage({ step: "customize", preset, conditions });
  }

  async function handleSave() {
    const currentStage = stage;
    if (currentStage.step === "presets") return;

    const conditions = currentStage.conditions;
    const ruleName =
      name.trim() ||
      (currentStage.step === "customize"
        ? buildPresetAlertName(currentStage.preset.name, beachName)
        : buildCustomAlertName(beachName));

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
        trackLockedCreateFailure(res.status);
        toast.error(json.message ?? json.error ?? "Couldn't create alert");
        return;
      }
      trackAlertCreated(
        currentStage.step === "customize" ? "customize" : "custom",
        currentStage.step === "customize" ? currentStage.preset.type : null,
      );
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
  const headerTitle =
    stage.step === "presets"
      ? beachName
      : stage.step === "customize"
        ? buildPresetAlertName(stage.preset.name, beachName)
        : buildCustomAlertName(beachName);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden rounded-md border-2 border-[#11100D] bg-[#1E2660] p-0 text-white shadow-[8px_8px_0_rgba(17,16,13,0.75)] sm:rounded-md [&>button]:right-5 [&>button]:top-5 [&>button]:text-[#11100D] [&>button]:opacity-100 [&>button]:ring-offset-[#F4EBD8] [&>button]:hover:bg-[#F78E42]/20">
        <DialogHeader className="border-b-2 border-[#11100D] bg-[#F4EBD8] px-5 py-4 pr-12 text-left text-[#11100D] shadow-[0_3px_0_rgba(17,16,13,0.55)]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-sm border-2 border-[#11100D] bg-[#F78E42] px-2 py-1 font-mono text-[10px] font-black uppercase tracking-[0.16em] text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.35)]">
              Condition watch
            </span>
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#403A2E]">
              Quiver field guide
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            {isEditing && (
              <button
                onClick={() => setStage({ step: "presets" })}
                aria-label="Back to presets"
                className="shrink-0 rounded-sm border border-[#11100D] bg-[#11100D] px-2 py-1 font-mono text-[10px] font-black uppercase tracking-[0.08em] text-[#F4EBD8] transition-colors hover:bg-[#F78E42] hover:text-[#11100D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42]/70"
              >
                Back
              </button>
            )}
            <DialogTitle className="truncate font-[family-name:var(--font-space-grotesk)] text-2xl font-black uppercase leading-none tracking-[0.02em] text-[#11100D]">
              {headerTitle}
            </DialogTitle>
          </div>
          <DialogDescription className="sr-only">
            Create a surf condition alert by choosing a preset or custom wave,
            wind, tide, and notification settings.
          </DialogDescription>
          {freeGrowthPhaseEnabled ? (
            <p className="mt-2 text-sm font-semibold leading-5 text-[#403A2E]">
              Watch this spot, free. Track up to 3 breaks and we&apos;ll call the window.
            </p>
          ) : null}
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
                <label
                  htmlFor={nameFieldId}
                  className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 font-[family-name:var(--font-space-grotesk)]"
                >
                  Alert name
                </label>
                <input
                  id={nameFieldId}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="optional, auto generated if blank"
                  maxLength={100}
                  className="w-full bg-[#252D6B] text-white text-sm rounded-lg px-3 py-2 border border-[#404C92] placeholder:text-[#9AABC6] focus:outline-none focus:ring-2 focus:ring-[#F78E42]/50 focus:border-[#F78E42] transition-colors"
                />
              </div>

              {/* Condition builder */}
              <div className="space-y-1.5" role="group" aria-labelledby={conditionsLabelId}>
                <span
                  id={conditionsLabelId}
                  className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 font-[family-name:var(--font-space-grotesk)]"
                >
                  Conditions
                </span>
                <ConditionBuilder
                  conditions={currentConditions}
                  onChange={handleConditionsChange}
                />
              </div>

              {/* Channel toggles */}
              <div className="space-y-2" role="group" aria-labelledby={notifyLabelId}>
                <span
                  id={notifyLabelId}
                  className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 font-[family-name:var(--font-space-grotesk)]"
                >
                  Notify via
                </span>
                <div className="flex gap-3">
                  <ToggleChip
                    label="Email"
                    icon={<Mail className="w-3 h-3" />}
                    active={notifyEmail}
                    onClick={() => setNotifyEmail(!notifyEmail)}
                  />
                  <ToggleChip
                    label="Push"
                    icon={<Radio className="w-3 h-3" />}
                    active={notifyPush}
                    onClick={() => setNotifyPush(!notifyPush)}
                  />
                </div>
              </div>

              {/* Save button */}
              <Button
                onClick={handleSave}
                disabled={saving || !hasConditions || (!notifyEmail && !notifyPush)}
                className="w-full bg-[#F78E42] hover:bg-[#F78E42]/90 active:scale-[0.98] text-[#11100D] font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-[background-color,transform,opacity]"
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
              className="absolute right-2 top-1/2 flex min-h-[32px] min-w-[76px] -translate-y-1/2 items-center justify-center rounded-sm border border-[#11100D] bg-[#11100D] px-2 py-1 font-mono text-[10px] font-black uppercase tracking-[0.08em] text-[#F4EBD8] shadow-[2px_2px_0_rgba(247,142,66,0.45)] transition-colors hover:bg-[#F78E42] hover:text-[#11100D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42]/70 disabled:cursor-not-allowed disabled:opacity-40"
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
      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-[color,background-color,border-color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42]/50 active:scale-95 ${
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
