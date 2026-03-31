"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertRuleCard } from "./alert-rule-card";
import { Plus } from "lucide-react";

interface AlertManagementPanelProps {
  beachId: string;
  beachName: string;
  onAddRule?: () => void;
}

export function AlertManagementPanel({ beachId, beachName, onAddRule }: AlertManagementPanelProps) {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch("/api/alerts/rules");
      const json = await res.json();
      if (json.data) {
        setRules(json.data.filter((r: any) => r.beach_id === beachId));
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [beachId]);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const handleToggle = async (ruleId: string, enabled: boolean) => {
    await fetch(`/api/alerts/rules/${ruleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    setRules((prev) => prev.map((r) => r.id === ruleId ? { ...r, enabled } : r));
  };

  const handleDelete = async (ruleId: string) => {
    await fetch(`/api/alerts/rules/${ruleId}`, { method: "DELETE" });
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
  };

  if (loading) return <div className="text-xs text-gray-500 py-2">Loading alerts...</div>;

  return (
    <div className="space-y-2 pt-2">
      {rules.length === 0 ? (
        <div className="text-xs text-gray-500">No alert rules set</div>
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
        className="flex items-center gap-1 text-xs text-[#F78E42] hover:text-[#F78E42]/80 font-medium mt-2"
      >
        <Plus className="w-3.5 h-3.5" />
        Add Rule
      </button>
    </div>
  );
}
