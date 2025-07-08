"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, Droplet } from "lucide-react";

interface TideDirectionProps {
  status: string;
  currentHeight?: string;
  className?: string;
  variant?: "compact" | "detailed";
}

export function TideDirection({
  status,
  currentHeight,
  className,
  variant = "compact",
}: TideDirectionProps) {
  const getTideInfo = (status: string) => {
    const normalizedStatus = status.toLowerCase();

    if (normalizedStatus.includes("rising")) {
      return {
        icon: TrendingUp,
        color: "text-green-600",
        bgColor: "bg-green-50",
        borderColor: "border-green-200",
        text: "Rising",
        description: "Tide is coming in",
      };
    }

    if (normalizedStatus.includes("falling")) {
      return {
        icon: TrendingDown,
        color: "text-red-600",
        bgColor: "bg-red-50",
        borderColor: "border-red-200",
        text: "Falling",
        description: "Tide is going out",
      };
    }

    if (
      normalizedStatus.includes("high") &&
      normalizedStatus.includes("slack")
    ) {
      return {
        icon: Minus,
        color: "text-blue-600",
        bgColor: "bg-blue-50",
        borderColor: "border-blue-200",
        text: "High Slack",
        description: "Near high tide",
      };
    }

    if (
      normalizedStatus.includes("low") &&
      normalizedStatus.includes("slack")
    ) {
      return {
        icon: Minus,
        color: "text-gray-600",
        bgColor: "bg-gray-50",
        borderColor: "border-gray-200",
        text: "Low Slack",
        description: "Near low tide",
      };
    }

    return {
      icon: Droplet,
      color: "text-gray-500",
      bgColor: "bg-gray-50",
      borderColor: "border-gray-200",
      text: "Unknown",
      description: "Tide status unavailable",
    };
  };

  const tideInfo = getTideInfo(status);
  const Icon = tideInfo.icon;

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <Icon className={cn("h-4 w-4", tideInfo.color)} />
        <span className="text-sm font-medium">{tideInfo.text}</span>
        {currentHeight && (
          <span className="text-xs text-muted-foreground">
            ({currentHeight})
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border",
        tideInfo.bgColor,
        tideInfo.borderColor,
        className
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-full bg-white",
          tideInfo.borderColor,
          "border"
        )}
      >
        <Icon className={cn("h-5 w-5", tideInfo.color)} />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{tideInfo.text}</span>
          {currentHeight && (
            <span className="text-sm text-muted-foreground">
              {currentHeight}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{tideInfo.description}</p>
      </div>
    </div>
  );
}
