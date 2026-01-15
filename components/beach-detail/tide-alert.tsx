"use client";

import { CheckCircle2, Clock, Waves } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TideAlert as TideAlertType } from "@/lib/surf/tide-direction";

interface TideAlertProps {
  alert: TideAlertType;
  className?: string;
}

const alertStyles = {
  optimal: {
    bg: "bg-emerald-50 border-emerald-200",
    text: "text-emerald-700",
    icon: CheckCircle2,
  },
  waiting: {
    bg: "bg-amber-50 border-amber-200",
    text: "text-amber-700",
    icon: Clock,
  },
  neutral: {
    bg: "bg-gray-50 border-gray-200",
    text: "text-gray-600",
    icon: Waves,
  },
};

export function TideAlertBadge({ alert, className }: TideAlertProps) {
  const style = alertStyles[alert.status];
  const Icon = style.icon;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium",
        style.bg,
        style.text,
        className
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{alert.message}</span>
    </div>
  );
}
