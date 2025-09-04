"use client";

import { Badge } from "@/components/ui/badge";
import { CheckCircle } from "lucide-react";

interface HighConfidenceIndicatorProps {
  confidence: number;
  threshold?: number;
  className?: string;
}

/**
 * HighConfidenceIndicator - Shows a badge when forecast confidence is high
 * 
 * Displays a prominent badge with checkmark when the confidence score
 * exceeds the threshold (default 85%).
 */
export function HighConfidenceIndicator({ 
  confidence, 
  threshold = 85,
  className = ""
}: HighConfidenceIndicatorProps) {
  const isHighConfidence = confidence >= threshold;

  if (!isHighConfidence) return null;

  return (
    <Badge 
      data-testid="high-confidence-forecast"
      variant="default" 
      className={`bg-green-100 text-green-800 border-green-200 ${className}`}
    >
      <CheckCircle className="w-3 h-3 mr-1" />
      High Confidence ({confidence}%)
    </Badge>
  );
}