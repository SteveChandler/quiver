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
    bg: "bg-emerald-100 border-emerald-300",
    text: "text-emerald-900",
    icon: CheckCircle2,
  },
  waiting: {
    bg: "bg-amber-100 border-amber-300",
    text: "text-amber-900",
    icon: Clock,
  },
  neutral: {
    bg: "bg-gray-100 border-gray-300",
    text: "text-gray-900",
    icon: Waves,
  },
};

export function TideAlertBadge({ alert, className }: TideAlertProps) {
  const style = alertStyles[alert.status];
  const Icon = style.icon;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-bold",
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
