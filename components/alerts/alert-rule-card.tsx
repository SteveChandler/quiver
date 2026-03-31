"use client";

import { useState } from "react";
import { Bell, Trash2 } from "lucide-react";

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

  const staleDays = rule.last_matched_at
    ? Math.floor((Date.now() - new Date(rule.last_matched_at).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const isStale = staleDays === null || staleDays > 14;

  const handleToggle = async () => {
    setLoading(true);
    await onToggle(rule.id, !rule.enabled);
    setLoading(false);
  };

  return (
    <div className={`flex items-center justify-between p-2 rounded-lg ${rule.enabled ? 'bg-[#354090]/30' : 'bg-[#252D6B]/30 opacity-60'}`}>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white font-medium truncate">{rule.name}</div>
        <div className="flex items-center gap-2 mt-0.5">
          {rule.notify_email && <span className="text-[10px] text-gray-500">Email</span>}
          {rule.notify_push && <span className="text-[10px] text-gray-500">Push</span>}
          {isStale && (
            <span className="text-[10px] text-yellow-500/70">
              {staleDays === null ? "Never matched" : `${staleDays}d since match`}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={handleToggle}
          disabled={loading}
          className={`p-1.5 rounded text-xs ${rule.enabled ? 'text-[#F78E42]' : 'text-gray-500'}`}
        >
          <Bell className="w-3.5 h-3.5" fill={rule.enabled ? "currentColor" : "none"} />
        </button>
        <button
          onClick={() => onDelete(rule.id)}
          className="p-1.5 rounded text-gray-500 hover:text-red-400"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
