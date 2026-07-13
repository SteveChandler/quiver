"use client";

import { Sun, Clock, Calendar } from "lucide-react";
import type { SessionTimingModule } from "@/types/editorial-content";

interface SessionTimingModulesProps {
  modules: SessionTimingModule[];
}

/**
 * Get icon component based on icon name
 */
function getModuleIcon(iconName: string) {
  switch (iconName.toLowerCase()) {
    case "sun":
      return Sun;
    case "clock":
      return Clock;
    case "calendar":
      return Calendar;
    default:
      return Sun;
  }
}

/**
 * Session Timing Modules Component
 *
 * Displays tactical surf advice in a 3-card grid format:
 * - Today: Marine layer, tide timing
 * - Now: Current wind and conditions
 * - Weekend: Planning advice for the week ahead
 */
export function SessionTimingModules({ modules }: SessionTimingModulesProps) {
  if (!modules || modules.length === 0) return null;

  return (
    <section className="mt-12">
      <h2 className="text-xl font-semibold text-slate-900 mb-4">
        Session Timing
      </h2>
      <div className="grid gap-4 md:grid-cols-3">
        {modules.map((module) => {
          const Icon = getModuleIcon(module.icon);
          return (
            <div
              key={module.title}
              className="rounded-xl border border-slate-200 bg-slate-50 p-5"
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className="h-5 w-5 text-sky-600" />
                <h3 className="text-lg font-semibold text-slate-900">
                  {module.title}
                </h3>
              </div>
              <p className="text-sm text-slate-700">{module.summary}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
