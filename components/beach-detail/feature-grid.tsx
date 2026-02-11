"use client";

import { Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeatureGridProps {
  features?: string[];
  warnings?: string[];
  className?: string;
}

const FEATURE_ICONS: Record<string, string> = {
  "Beginner friendly": "🏄",
  "Longboard spot": "🏄‍♂️",
  "Fish friendly": "🐟",
  "Sandy bottom": "🏖️",
  "Reef break": "🪨",
  "Point break": "➡️",
  "Pier break": "🌉",
  Beachbreak: "🏖️",
  "Board rental nearby": "🏄",
  "Lifeguard on duty": "🛟",
  "Year-round surf": "📅",
  "Surf schools": "🎓",
  "Parking lot": "🅿️",
  Consistent: "🌊",
  "Powerful waves": "💪",
  "Gentle waves": "😌",
  "Handles size": "📏",
  "Multiple peaks": "⛰️",
  "Advanced only": "⚠️",
  "Strong etiquette": "🤝",
  Scenic: "📸",
  "World-class": "⭐",
  "High-performance": "🚀",
  "Family friendly": "👨‍👩‍👧‍👦",
  "Good for learning": "📚",
  "Relaxed vibe": "😎",
  "Strict etiquette": "📋",
  "Mixed craft": "🏄‍♀️",
  "Tourist area": "🏝️",
};

function getFeatureIcon(feature: string): string {
  return FEATURE_ICONS[feature] || "✓";
}

export function FeatureGrid({
  features = [],
  warnings = [],
  className,
}: FeatureGridProps) {
  if (!features.length && !warnings.length) return null;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Features - Positive */}
      {features.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {features.map((feature, idx) => {
            const icon = getFeatureIcon(feature);
            return (
              <div
                key={idx}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/10 border border-success/20 text-sm text-success"
              >
                <span className="text-base">{icon}</span>
                <span className="font-medium">{feature}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Warnings - Caution */}
      {warnings.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {warnings.map((warning, idx) => (
            <div
              key={idx}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warning/10 border border-warning/20 text-sm text-warning"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span className="font-medium">{warning}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
