"use client";

import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, HelpCircle } from "lucide-react";

interface ForecastConfidenceBadgeProps {
  confidence: number;
  showPercentage?: boolean;
  className?: string;
}

type ConfidenceLevel = "high" | "medium" | "low";

interface ConfidenceConfig {
  label: string;
  icon: React.ReactNode;
  bgColor: string;
  textColor: string;
  borderColor: string;
}

const CONFIDENCE_CONFIGS: Record<ConfidenceLevel, ConfidenceConfig> = {
  high: {
    label: "High Confidence",
    icon: <CheckCircle className="w-3 h-3 mr-1" />,
    bgColor: "bg-green-100",
    textColor: "text-green-800",
    borderColor: "border-green-200",
  },
  medium: {
    label: "Medium Confidence",
    icon: <AlertCircle className="w-3 h-3 mr-1" />,
    bgColor: "bg-yellow-100",
    textColor: "text-yellow-800",
    borderColor: "border-yellow-200",
  },
  low: {
    label: "Low Confidence",
    icon: <HelpCircle className="w-3 h-3 mr-1" />,
    bgColor: "bg-gray-100",
    textColor: "text-gray-800",
    borderColor: "border-gray-200",
  },
};

/**
 * ForecastConfidenceBadge - Visual indicator of forecast confidence level
 *
 * Displays a color-coded badge based on confidence score:
 * - High (≥75%): Green badge with checkmark
 * - Medium (50-74%): Yellow badge with alert icon
 * - Low (<50%): Gray badge with question icon
 *
 * Part of the forecast transparency feature set.
 */
export function ForecastConfidenceBadge({
  confidence,
  showPercentage = true,
  className = "",
}: ForecastConfidenceBadgeProps) {
  // Determine confidence level
  const level: ConfidenceLevel =
    confidence >= 75 ? "high" : confidence >= 50 ? "medium" : "low";

  const config = CONFIDENCE_CONFIGS[level];

  const percentageText = showPercentage ? ` (${confidence}%)` : "";

  return (
    <Badge
      data-testid={`confidence-badge-${level}`}
      variant="outline"
      className={`${config.bgColor} ${config.textColor} ${config.borderColor} ${className}`}
    >
      {config.icon}
      {config.label}
      {percentageText}
    </Badge>
  );
}
