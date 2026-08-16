"use client";

import React, { useId } from "react";
import { getRatingDescription } from "@/lib/constants/session-form-constants";

/**
 * RatingInput - 5-star rating component
 * Shared by SessionDetailsSection and ConditionsSection
 *
 * Features:
 * - Interactive 5-star rating with hover effects
 * - Displays rating description text
 * - Accessible with proper ARIA labels
 * - Supports different icon types and colors
 */

export interface RatingInputProps {
  label: string;
  icon: React.ComponentType<any>;
  value: string;
  onChange: (value: string) => void;
  colorClass: string;
  ratingType: "waveQuality" | "crowdLevel" | "parkingEase";
  emptyText: string;
}

export function RatingInput({
  label,
  icon: Icon,
  value,
  onChange,
  colorClass,
  ratingType,
  emptyText,
}: RatingInputProps) {
  const labelId = useId();

  return (
    <div className="text-center">
      {/* A <label> can only name a single control; this names a group of five
          buttons, so it's a labelled group instead. */}
      <span id={labelId} className="block text-sm font-medium mb-3">
        {label}
      </span>
      <div className="space-y-3">
        <div
          role="group"
          aria-labelledby={labelId}
          className="flex justify-center gap-1"
        >
          {[1, 2, 3, 4, 5].map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => onChange(rating.toString())}
              className={`p-2 rounded-lg transition-colors duration-200 ${
                parseInt(value) >= rating
                  ? `${colorClass} bg-opacity-10`
                  : "text-gray-300 hover:text-gray-400 hover:bg-gray-50"
              }` + " focus-ring"}
              title={getRatingDescription(ratingType, rating)}
              aria-label={`Rate ${label} as ${rating} out of 5 - ${getRatingDescription(
                ratingType,
                rating
              )}`}
            >
              <Icon
                className="w-5 h-5"
                fill={parseInt(value) >= rating ? "currentColor" : "none"}
              />
            </button>
          ))}
        </div>

        <div className="space-y-1">
          <span className="text-sm font-medium" aria-live="polite">
            {value
              ? `${value}/5 - ${getRatingDescription(
                  ratingType,
                  parseInt(value)
                )}`
              : emptyText}
          </span>
        </div>
      </div>
    </div>
  );
}
