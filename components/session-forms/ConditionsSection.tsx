"use client";

import { Activity, Star, Users, Car } from "lucide-react";
import { SimpleCardLayout } from "@/components/ui/form-layout";
import {
  getRatingDescription,
  SessionFormMode,
} from "@/lib/constants/session-form-constants";
import { SessionFormState } from "@/hooks/use-session-form";

interface ConditionsSectionProps {
  mode: SessionFormMode;
  formState: SessionFormState;
  updateField: <K extends keyof SessionFormState>(
    field: K,
    value: SessionFormState[K]
  ) => void;
}

interface RatingInputProps {
  label: string;
  icon: React.ComponentType<any>;
  value: string;
  onChange: (value: string) => void;
  colorClass: string;
  ratingType: "waveQuality" | "crowdLevel" | "parkingEase";
  emptyText: string;
}

function RatingInput({
  label,
  icon: Icon,
  value,
  onChange,
  colorClass,
  ratingType,
  emptyText,
}: RatingInputProps) {
  return (
    <div className="text-center">
      <label className="block text-sm font-medium mb-3">{label}</label>
      <div className="space-y-3">
        <div className="flex justify-center gap-1">
          {[1, 2, 3, 4, 5].map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => onChange(rating.toString())}
              className={`p-2 rounded-lg transition-all duration-200 ${
                parseInt(value) >= rating
                  ? `${colorClass} bg-opacity-10`
                  : "text-gray-300 hover:text-gray-400 hover:bg-gray-50"
              }`}
              title={getRatingDescription(ratingType, rating)}
            >
              <Icon
                className="w-5 h-5"
                fill={parseInt(value) >= rating ? "currentColor" : "none"}
              />
            </button>
          ))}
        </div>

        <div className="space-y-1">
          <span className="text-sm font-medium">
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

export function ConditionsSection({
  mode,
  formState,
  updateField,
}: ConditionsSectionProps) {
  // Only show for logged sessions
  if (mode === "plan") {
    return null;
  }

  return (
    <SimpleCardLayout
      title={
        <div className="flex items-center">
          <Activity className="w-5 h-5 mr-2 text-primary" />
          Session Conditions
        </div>
      }
      description="Rate the conditions during your session"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Wave Quality */}
        <RatingInput
          label="Wave Quality"
          icon={Star}
          value={formState.waveQuality}
          onChange={(value) => updateField("waveQuality", value)}
          colorClass="text-yellow-500"
          ratingType="waveQuality"
          emptyText="Rate the waves"
        />

        {/* Crowd Density */}
        <RatingInput
          label="Crowd Density"
          icon={Users}
          value={formState.crowdLevel}
          onChange={(value) => updateField("crowdLevel", value)}
          colorClass="text-orange-500"
          ratingType="crowdLevel"
          emptyText="How crowded?"
        />

        {/* Parking Ease */}
        <RatingInput
          label="Parking Ease"
          icon={Car}
          value={formState.parkingEase}
          onChange={(value) => updateField("parkingEase", value)}
          colorClass="text-green-500"
          ratingType="parkingEase"
          emptyText="How easy to park?"
        />
      </div>

      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-xs text-muted-foreground text-center">
          💡 Tip: These ratings help other surfers know what to expect at this
          spot
        </p>
      </div>
    </SimpleCardLayout>
  );
}
