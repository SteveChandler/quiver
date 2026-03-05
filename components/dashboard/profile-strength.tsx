"use client";

import { ArrowRight, Trophy } from "lucide-react";
import Link from "next/link";

interface ProfileStrengthData {
  percent: number;
  missing: string[];
}

interface ProfileStrengthProps {
  strength: ProfileStrengthData | null;
}

export function ProfileStrength({ strength }: ProfileStrengthProps) {
  // AUTO-HIDE LOGIC: Don't render if complete or no data
  if (!strength || strength.percent >= 100) return null;

  // Format the missing field name for display
  const formatMissing = (field: string) => {
    return field
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <div
      className="group relative overflow-hidden rounded-xl border border-amber-100 dark:border-[#1E2D4A] bg-gradient-to-br from-amber-50 to-white dark:from-[#111D35] dark:to-[#0F1A2E] p-5 shadow-sm hover:shadow-md transition-all"
      data-testid="profile-strength"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-1.5 text-amber-600 dark:text-amber-400">
            <Trophy size={16} />
          </div>
          <h3 className="font-bold text-slate-800 dark:text-gray-100 text-sm">Finish Setup</h3>
        </div>
        <span className="font-black text-amber-600 dark:text-amber-400 text-lg">{strength.percent}%</span>
      </div>

      {/* Progress Bar */}
      <div className="h-2 w-full rounded-full bg-amber-100/50 dark:bg-amber-900/30 overflow-hidden mb-4">
        <div
          className="h-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-500"
          style={{ width: `${strength.percent}%` }}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-600 dark:text-gray-400">
          {strength.missing.length > 0 ? (
            <>
              Missing: <span className="font-medium">{formatMissing(strength.missing[0])}</span>
              {strength.missing.length > 1 && (
                <span className="text-slate-400 dark:text-gray-400"> +{strength.missing.length - 1} more</span>
              )}
            </>
          ) : (
            <span>Almost there!</span>
          )}
        </p>
        <Link
          href="/profile/edit"
          className="flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 transition-colors"
        >
          Complete <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}
