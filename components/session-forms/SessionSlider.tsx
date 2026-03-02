"use client";

import React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

interface SessionSliderProps {
  /** Display label above the slider */
  label: string;
  /** Labels for each stop (length determines number of stops) */
  labels: string[];
  /** Color ramp array — interpolated across the range. Minimum 2 colors. */
  colors: string[];
  /** Current value as string ("1"-"5") or undefined if unset */
  value?: string;
  /** Called with string value ("1"-"5") */
  onChange: (value: string) => void;
  /** Whether this is the hero/prominent slider */
  hero?: boolean;
  /** Optional icon to show next to the label */
  icon?: React.ReactNode;
  className?: string;
}

/**
 * Interpolate between colors in the ramp based on a 0-1 progress value.
 */
function interpolateColor(colors: string[], progress: number): string {
  if (colors.length === 1) return colors[0];
  const segment = progress * (colors.length - 1);
  const index = Math.floor(segment);
  if (index >= colors.length - 1) return colors[colors.length - 1];
  return colors[index]; // Simplified: use nearest color stop
}

export function SessionSlider({
  label,
  labels,
  colors,
  value,
  onChange,
  hero = false,
  icon,
  className,
}: SessionSliderProps) {
  const numericValue = value ? parseInt(value, 10) : undefined;
  const isSet = numericValue !== undefined && !isNaN(numericValue);
  const max = labels.length;
  const progress = isSet ? (numericValue - 1) / (max - 1) : 0;
  const activeColor = isSet ? interpolateColor(colors, progress) : "#D1D5DB";
  const currentLabel = isSet ? labels[numericValue - 1] : undefined;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Label row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span
            className={cn(
              "font-bold text-[#1A1A1A]",
              hero ? "text-base" : "text-sm"
            )}
          >
            {label}
          </span>
        </div>
        {isSet ? (
          <span
            className="text-sm font-semibold px-2 py-0.5 rounded-full"
            style={{
              color: activeColor,
              backgroundColor: `${activeColor}15`,
            }}
          >
            {currentLabel}
          </span>
        ) : (
          <span className="text-sm text-[#6B7280]">Tap to rate</span>
        )}
      </div>

      {/* Slider */}
      <SliderPrimitive.Root
        className="relative flex w-full touch-none select-none items-center"
        min={1}
        max={max}
        step={1}
        value={isSet ? [numericValue] : [1]}
        onValueChange={([val]) => onChange(String(val))}
        aria-label={label}
      >
        <SliderPrimitive.Track
          className={cn(
            "relative w-full grow overflow-hidden rounded-full bg-gray-200",
            hero ? "h-3" : "h-2"
          )}
        >
          <SliderPrimitive.Range
            className="absolute h-full rounded-full transition-colors"
            style={{ backgroundColor: isSet ? activeColor : "#D1D5DB" }}
          />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className={cn(
            "block rounded-full border-2 border-white shadow-md transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-110",
            hero ? "h-7 w-7" : "h-6 w-6",
            !isSet && "opacity-0"
          )}
          style={{ backgroundColor: isSet ? activeColor : "#D1D5DB" }}
        />
      </SliderPrimitive.Root>

      {/* Endpoint labels */}
      <div className="flex justify-between text-xs text-[#6B7280] font-medium">
        <span>{labels[0]}</span>
        <span>{labels[labels.length - 1]}</span>
      </div>
    </div>
  );
}
