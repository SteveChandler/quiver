"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AlertRuleCard } from "./alert-rule-card";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface AlertRuleSummary {
  id: string;
  name: string;
  beach_id: string;
  preset_type: string | null;
  enabled: boolean;
  notify_email: boolean;
  notify_push: boolean;
  last_matched_at: string | null;
}

interface AlertManagementPanelProps {
  beachId: string;
  beachName: string;
  onAddRule?: () => void;
}

export function AlertManagementPanel({ beachId, beachName: _beachName, onAddRule }: AlertManagementPanelProps) {
  const [rules, setRules] = useState<AlertRuleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchRules = useCallback(async () => {
    // Abort any in-flight request to prevent race conditions
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setFetchError(false);
      const res = await fetch("/api/alerts/rules", { signal: controller.signal });
      if (!res.ok) throw new Error("fetch failed");
      const json = await res.json();
      if (json.data) {
        setRules(
          (json.data as AlertRuleSummary[]).filter((r) => r.beach_id === beachId)
        );
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [beachId]);

  useEffect(() => {
    fetchRules();
    return () => { abortRef.current?.abort(); };
  }, [fetchRules]);

  const handleToggle = async (ruleId: string, enabled: boolean) => {
    // Optimistic update
    setRules((prev) => prev.map((r) => r.id === ruleId ? { ...r, enabled } : r));
    try {
      const res = await fetch(`/api/alerts/rules/${ruleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error("toggle failed");
    } catch {
      // Revert optimistic update
      setRules((prev) => prev.map((r) => r.id === ruleId ? { ...r, enabled: !enabled } : r));
      toast.error("Couldn't update alert");
    }
  };

  const handleDelete = async (ruleId: string) => {
    // Optimistic removal — stash for revert
    const prev = rules;
    setRules((r) => r.filter((rule) => rule.id !== ruleId));
    try {
      const res = await fetch(`/api/alerts/rules/${ruleId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
    } catch {
      setRules(prev);
      toast.error("Couldn't delete alert");
    }
  };

  if (loading) {
    return <div className="text-xs text-gray-400 py-2 min-h-[40px]">Loading alerts...</div>;
  }

  if (fetchError) {
    return (
      <div className="text-xs text-gray-400 py-2 min-h-[40px] flex items-center gap-2">
        <span>Couldn&apos;t load alerts</span>
        <button
          onClick={fetchRules}
          className="text-[#F78E42] hover:text-[#F78E42]/80 font-medium focus-ring"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 pt-2">
      {rules.length === 0 ? (
        <div className="text-xs text-gray-400">No alerts set</div>
      ) : (
        rules.map((rule) => (
          <AlertRuleCard
            key={rule.id}
            rule={rule}
            onToggle={handleToggle}
            onDelete={handleDelete}
          />
        ))
      )}
      <button
        onClick={onAddRule}
        aria-label="Add a new alert"
        className="flex items-center gap-1 text-xs text-[#F78E42] hover:text-[#F78E42]/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42]/50 focus-visible:rounded active:scale-95 font-medium mt-2 transition-[color,box-shadow,transform] min-h-[44px]"
      >
        <Plus className="w-3.5 h-3.5" />
        Add alert
      </button>
    </div>
  );
}
