"use client";

import React from "react";
import { cn } from "@/lib/utils";

type KpiTileProps = {
  value: React.ReactNode;
  unit?: string;
  label: React.ReactNode;
  className?: string;
};

export function KpiTile({ value, unit, label, className }: KpiTileProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center w-full p-3 rounded-xl bg-card",
        className
      )}
    >
      <div className="flex items-baseline justify-center gap-1 font-semibold tabular-nums whitespace-nowrap">
        <span className="text-2xl md:text-3xl leading-none">{value}</span>
        {unit ? <span className="text-sm leading-none">{unit}</span> : null}
      </div>
      <div className="mt-1 text-xs text-muted-foreground text-center w-full">
        {label}
      </div>
    </div>
  );
}
