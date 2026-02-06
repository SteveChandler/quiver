"use client";

import * as React from "react";
import type { TidePoint } from "../tide-chart-recharts";
import { toDate } from "./tide-chart-helpers";

export const TideTooltip: React.FC<{
  active?: boolean;
  payload?: any;
  label?: any;
  unit: string;
}> = ({ active, payload, unit }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload as TidePoint & { t: any };
  const d = toDate(p.t);
  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const day = d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur px-3 py-2 shadow-md">
      <div className="text-[11px] text-slate-500">
        {day} • {time}
      </div>
      <div className="text-sm font-semibold text-slate-900">
        {p.h.toFixed(1)} {unit}
      </div>
      {p.isHigh && (
        <div className="text-[11px] text-emerald-600">High tide</div>
      )}
      {p.isLow && <div className="text-[11px] text-rose-600">Low tide</div>}
    </div>
  );
};
