"use client";

import * as React from "react";
import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TideVerifiedBadgeProps } from "@/types/tide-diagnostics";

/**
 * Get badge configuration based on verification status
 */
function getBadgeConfig(status: TideVerifiedBadgeProps["status"]) {
  switch (status) {
    case "verified":
      return {
        icon: CheckCircle2,
        label: "Verified",
        bgColor: "bg-emerald-50",
        textColor: "text-emerald-700",
        iconColor: "text-emerald-500",
        borderColor: "border-emerald-200",
      };
    case "partial":
      return {
        icon: AlertCircle,
        label: "Partial",
        bgColor: "bg-amber-50",
        textColor: "text-amber-700",
        iconColor: "text-amber-500",
        borderColor: "border-amber-200",
      };
    case "unverified":
    default:
      return {
        icon: XCircle,
        label: "Unverified",
        bgColor: "bg-red-50",
        textColor: "text-red-700",
        iconColor: "text-red-500",
        borderColor: "border-red-200",
      };
  }
}

/**
 * TideVerifiedBadge - Shows tide data verification status
 *
 * Visual indicator for data quality:
 * - verified (green): Primary station, fresh data, all points present
 * - partial (yellow): Fallback station OR stale data
 * - unverified (red): Significant data issues
 */
export function TideVerifiedBadge({
  status,
  tooltip,
  confidenceScore,
  className,
  showConfidence = false,
}: TideVerifiedBadgeProps) {
  const config = getBadgeConfig(status);
  const Icon = config.icon;

  const badgeContent = (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        config.bgColor,
        config.textColor,
        config.borderColor,
        className
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", config.iconColor)} />
      <span>{config.label}</span>
      {showConfidence && confidenceScore !== undefined && (
        <span className="opacity-70">{confidenceScore}%</span>
      )}
    </div>
  );

  if (tooltip) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>{badgeContent}</TooltipTrigger>
          <TooltipContent
            side="bottom"
            className="max-w-[250px] text-center text-xs"
          >
            <p>{tooltip}</p>
            {confidenceScore !== undefined && (
              <p className="mt-1 font-medium">
                Confidence: {confidenceScore}%
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badgeContent;
}

/**
 * Compact icon-only version for tight spaces
 */
export function TideVerifiedBadgeIcon({
  status,
  tooltip,
  className,
}: Pick<TideVerifiedBadgeProps, "status" | "tooltip" | "className">) {
  const config = getBadgeConfig(status);
  const Icon = config.icon;

  const iconContent = (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full p-1",
        config.bgColor,
        config.borderColor,
        "border",
        className
      )}
    >
      <Icon className={cn("h-4 w-4", config.iconColor)} />
    </div>
  );

  if (tooltip) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>{iconContent}</TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return iconContent;
}

/**
 * Large badge with confidence meter for detailed views
 */
export function TideVerifiedBadgeLarge({
  status,
  tooltip,
  confidenceScore = 0,
  className,
}: TideVerifiedBadgeProps) {
  const config = getBadgeConfig(status);
  const Icon = config.icon;

  // Determine confidence level color
  const confidenceColor =
    confidenceScore >= 80
      ? "bg-emerald-500"
      : confidenceScore >= 50
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "inline-flex flex-col items-center gap-1 rounded-lg border p-3",
              config.bgColor,
              config.borderColor,
              className
            )}
          >
            <div className="flex items-center gap-2">
              <Icon className={cn("h-5 w-5", config.iconColor)} />
              <span className={cn("text-sm font-semibold", config.textColor)}>
                {config.label}
              </span>
            </div>

            {/* Confidence meter */}
            <div className="w-full">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-500">Confidence</span>
                <span className={cn("font-medium", config.textColor)}>
                  {confidenceScore}%
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-200">
                <div
                  className={cn("h-full rounded-full transition-[width]", confidenceColor)}
                  style={{ width: `${Math.min(100, Math.max(0, confidenceScore))}%` }}
                />
              </div>
            </div>
          </div>
        </TooltipTrigger>
        {tooltip && (
          <TooltipContent side="bottom" className="max-w-[250px] text-xs">
            {tooltip}
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}

export default TideVerifiedBadge;
