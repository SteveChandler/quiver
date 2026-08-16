"use client";

import { useState, useRef, useEffect } from "react";
import { Pause, Play, Trash2 } from "lucide-react";
import type { PresetType } from "@/lib/alerts/types";

const PRESET_ICONS: Record<PresetType, string> = {
  glass_off: "\u{1F90C}",
  mellow_session: "\u{1F3C4}",
  dawn_patrol: "\u{1F305}",
  big_day: "\u{1F30A}",
  clean_groundswell: "\u{1F4A0}",
  tide_window: "\u{23F1}\u{FE0F}",
  epic_conditions: "\u{1F525}",
  daily_check_in: "\u{2705}",
  weekend_warrior: "\u{1F4C5}",
  after_work: "\u{1F306}",
};

interface AlertRuleCardProps {
  rule: {
    id: string;
    name: string;
    preset_type: string | null;
    enabled: boolean;
    notify_email: boolean;
    notify_push: boolean;
    last_matched_at: string | null;
  };
  onToggle: (ruleId: string, enabled: boolean) => void;
  onDelete: (ruleId: string) => void;
}

export function AlertRuleCard({ rule, onToggle, onDelete }: AlertRuleCardProps) {
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, []);

  const staleDays = rule.last_matched_at
    ? Math.floor((Date.now() - new Date(rule.last_matched_at).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const isStale = staleDays === null || staleDays > 14;

  const presetIcon = rule.preset_type
    ? PRESET_ICONS[rule.preset_type as PresetType] ?? null
    : null;

  const handleToggle = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onToggle(rule.id, !rule.enabled);
    } finally {
      setLoading(false);
    }
  };

  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (deleting) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      confirmTimer.current = setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setDeleting(true);
    await onDelete(rule.id);
  };

  // Escape key cancels delete confirmation
  useEffect(() => {
    if (!confirmDelete) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setConfirmDelete(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [confirmDelete]);

  return (
    <div
      className={`flex items-center justify-between p-2.5 rounded-lg border-l-[3px] transition-[background-color,border-color,opacity] ${
        rule.enabled
          ? "bg-[#354090]/30 border-l-[#F78E42] border border-l-[3px] border-[#404C92]/40"
          : "bg-[#252D6B]/30 border-l-[#404C92] border border-l-[3px] border-[#404C92]/20 opacity-60"
      }`}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {presetIcon && (
          <span className="text-sm shrink-0" role="img" aria-hidden="true">
            {presetIcon}
          </span>
        )}
        <div className="min-w-0">
          <div className="text-sm text-white font-medium truncate">{rule.name}</div>
          <div className="flex items-center gap-2 mt-0.5">
            {rule.notify_email && (
              <span className="text-[11px] text-gray-400 font-mono">Email</span>
            )}
            {rule.notify_push && (
              <span className="text-[11px] text-gray-400 font-mono">Push</span>
            )}
            {isStale && (
              <span className="text-[11px] text-yellow-500/70">
                {staleDays === null ? "Never matched" : `${staleDays}d since match`}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={handleToggle}
          disabled={loading}
          aria-label={rule.enabled ? "Disable alert" : "Enable alert"}
          className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded transition-[color,background-color,box-shadow,transform,opacity] text-xs hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42]/50 active:scale-95 disabled:opacity-50 ${
            rule.enabled ? "text-[#F78E42]" : "text-gray-500"
          }`}
        >
          {rule.enabled ? (
            <Pause className="w-3.5 h-3.5" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded transition-[color,background-color,box-shadow,transform,opacity] text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 active:scale-95 disabled:opacity-50 ${
            confirmDelete
              ? "text-red-400 bg-red-400/10"
              : "text-gray-500 hover:text-red-400"
          }`}
          aria-label={confirmDelete ? "Click again to confirm delete" : "Delete alert"}
        >
          {confirmDelete ? (
            <span className="text-[11px] font-semibold">Delete?</span>
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
