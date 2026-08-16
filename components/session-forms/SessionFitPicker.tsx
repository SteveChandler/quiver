"use client";

import { CheckCircle2, Gauge, Users, Waves } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  normalizeSessionDecomposition,
  type SessionBoardFitSignal,
  type SessionDecomposition,
  type SessionMomentTag,
  type SessionSkillFit,
} from "@/lib/session-fit";

export type SessionFitSelection =
  | { kind: "decomposition"; tag: SessionMomentTag }
  | { kind: "decomposition"; tag: "skill_fit"; value: SessionSkillFit }
  | { kind: "board_fit"; value: SessionBoardFitSignal };

interface SessionFitPickerProps {
  rating: string | number | null | undefined;
  value: SessionDecomposition | null;
  onChange: (next: SessionDecomposition | null) => void;
  onSelection?: (selection: SessionFitSelection) => void;
}

const MOMENT_OPTIONS: Array<{
  key: SessionMomentTag;
  label: string;
  icon: typeof Waves;
}> = [
  { key: "waves", label: "Waves", icon: Waves },
  { key: "crew", label: "Crew", icon: Users },
  { key: "vibe", label: "Vibe", icon: CheckCircle2 },
];

const SKILL_FIT_OPTIONS: Array<{ value: SessionSkillFit; label: string }> = [
  { value: "under", label: "Under" },
  { value: "dialed", label: "Dialed" },
  { value: "over_my_head", label: "Over my head" },
];

const BOARD_FIT_OPTIONS: Array<{ value: SessionBoardFitSignal; label: string }> = [
  { value: "too_small", label: "Too small" },
  { value: "right", label: "Right board" },
  { value: "too_much_board", label: "Too much board" },
  { value: "wrong_type", label: "Wrong type" },
  { value: "na", label: "N/A" },
];

function hasRating(rating: SessionFitPickerProps["rating"]): boolean {
  if (rating === null || rating === undefined) return false;
  return String(rating).trim().length > 0;
}

export function SessionFitPicker({
  rating,
  value,
  onChange,
  onSelection,
}: SessionFitPickerProps) {
  if (!hasRating(rating)) return null;

  const toggleMoment = (key: SessionMomentTag): void => {
    const selected = value?.[key] === true;
    const next = normalizeSessionDecomposition({
      ...(value ?? {}),
      [key]: !selected,
    });
    onChange(next);
    if (!selected) {
      onSelection?.({ kind: "decomposition", tag: key });
    }
  };

  const selectSkillFit = (skillFit: SessionSkillFit): void => {
    const nextValue = value?.skill_fit === skillFit ? undefined : skillFit;
    const next = normalizeSessionDecomposition({
      ...(value ?? {}),
      skill_fit: nextValue,
    });
    onChange(next);
    if (nextValue) {
      onSelection?.({
        kind: "decomposition",
        tag: "skill_fit",
        value: nextValue,
      });
    }
  };

  const selectBoardFit = (boardFit: SessionBoardFitSignal): void => {
    const nextValue = value?.board_fit === boardFit ? undefined : boardFit;
    const next = normalizeSessionDecomposition({
      ...(value ?? {}),
      board_fit: nextValue,
    });
    onChange(next);
    if (nextValue) {
      onSelection?.({ kind: "board_fit", value: nextValue });
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-[#404C92] bg-[#354090]/40 p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-bold uppercase text-[#F0F0F0]">
          Session fit
        </h3>
        <p className="text-sm text-[#9AABC6]">
          How did the wave match your skill and board?
        </p>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-bold uppercase text-[#9AABC6]">
          What shaped it?
        </span>
        <div className="flex flex-wrap gap-2">
          {MOMENT_OPTIONS.map(({ key, label, icon: Icon }) => {
            const selected = value?.[key] === true;
            return (
              <button
                key={key}
                type="button"
                role="checkbox"
                aria-checked={selected}
                aria-label={label}
                onClick={() => toggleMoment(key)}
                className={cn(
                  "flex min-h-10 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition-colors",
                  selected
                    ? "border-[#00D4AA] bg-[#00D4AA]/15 text-[#00D4AA]"
                    : "border-[#404C92] bg-[#252D6B]/60 text-[#9AABC6] hover:text-[#F0F0F0]"
                ) + " focus-ring"}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <span className="flex items-center gap-2 text-xs font-bold uppercase text-[#9AABC6]">
          <Gauge className="h-4 w-4" />
          Skill fit
        </span>
        <div className="grid grid-cols-3 gap-2">
          {SKILL_FIT_OPTIONS.map((option) => {
            const selected = value?.skill_fit === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={option.label}
                onClick={() => selectSkillFit(option.value)}
                className={cn(
                  "min-h-10 rounded-lg border px-2 text-sm font-semibold transition-colors",
                  selected
                    ? "border-[#F78E42] bg-[#F78E42]/15 text-[#F78E42]"
                    : "border-[#404C92] bg-[#252D6B]/60 text-[#F0F0F0] hover:bg-[#404C92]"
                ) + " focus-ring"}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-bold uppercase text-[#9AABC6]">
          Board fit
        </span>
        <div className="flex flex-wrap gap-2">
          {BOARD_FIT_OPTIONS.map((option) => {
            const selected = value?.board_fit === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={option.label}
                onClick={() => selectBoardFit(option.value)}
                className={cn(
                  "min-h-10 rounded-lg border px-3 text-sm font-semibold transition-colors",
                  selected
                    ? "border-[#F78E42] bg-[#F78E42]/15 text-[#F78E42]"
                    : "border-[#404C92] bg-[#252D6B]/60 text-[#F0F0F0] hover:bg-[#404C92]"
                ) + " focus-ring"}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
