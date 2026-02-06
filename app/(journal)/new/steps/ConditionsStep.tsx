"use client";

import React, { useEffect, useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

type Question = {
  id: string;
  label: string;
  type: "radio" | "slider" | "textarea";
  name: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
};

interface ConditionsStepProps {
  questions?: Question[] | null;
  isReady?: boolean;
  debug?: boolean;
}

const fallbackQuestions: Question[] = [
  {
    id: "wave-quality",
    label: "Wave quality",
    type: "radio",
    name: "conditions.waveQuality",
    options: [
      { value: "Poor", label: "Poor" },
      { value: "Fair", label: "Fair" },
      { value: "Good", label: "Good" },
      { value: "Epic", label: "Epic" },
    ],
  },
  {
    id: "wave-height",
    label: "Wave height (ft)",
    type: "slider",
    name: "conditions.waveHeightFt",
    min: 0,
    max: 12,
    step: 0.5,
  },
  {
    id: "tide",
    label: "Tide",
    type: "radio",
    name: "conditions.tide",
    options: [
      { value: "Low", label: "Low" },
      { value: "Rising", label: "Rising" },
      { value: "High", label: "High" },
      { value: "Falling", label: "Falling" },
    ],
  },
  {
    id: "wind",
    label: "Wind",
    type: "radio",
    name: "conditions.wind",
    options: [
      { value: "Calm", label: "Calm" },
      { value: "Light", label: "Light" },
      { value: "Breezy", label: "Breezy" },
      { value: "Blown out", label: "Blown out" },
    ],
  },
  {
    id: "crowd",
    label: "Crowd",
    type: "slider",
    name: "conditions.crowd",
    min: 0,
    max: 10,
    step: 1,
  },
  {
    id: "parking",
    label: "Parking ease",
    type: "radio",
    name: "conditions.parking",
    options: [
      { value: "Easy", label: "Easy" },
      { value: "Okay", label: "Okay" },
      { value: "Hard", label: "Hard" },
    ],
  },
  {
    id: "notes",
    label: "Notes",
    type: "textarea",
    name: "conditions.notes",
  },
];

export default function ConditionsStep({ questions, isReady, debug = true }: ConditionsStepProps) {
  const { setValue, watch } = useFormContext();

  const renderQuestions: Question[] = useMemo(() => {
    return questions && questions.length > 0 ? questions : fallbackQuestions;
  }, [questions]);

  useEffect(() => {
    if (debug) {
      // One-time breadcrumb on mount
       
      console.debug("[ConditionsStep] isReady:", Boolean(isReady), "providedQuestions:", questions?.length ?? 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conditions</CardTitle>
        <CardDescription>
          {isReady ? "Tell us about the conditions for this session." : "Showing fallback questions until session and beach details are ready."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {renderQuestions.map((q) => {
          if (q.type === "radio" && q.options) {
            const value = watch(q.name) as string | undefined;
            return (
              <div key={q.id} className="space-y-2">
                <Label className="text-sm font-medium">{q.label}</Label>
                <RadioGroup
                  value={value}
                  onValueChange={(v) => setValue(q.name, v, { shouldValidate: true, shouldDirty: true })}
                  className="grid grid-cols-2 md:grid-cols-4 gap-3"
                >
                  {q.options.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2 rounded-md border p-3 hover:bg-accent cursor-pointer">
                      <RadioGroupItem value={opt.value} />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>
            );
          }

          if (q.type === "slider") {
            const numericValue = Number(watch(q.name) ?? 0);
            const min = q.min ?? 0;
            const max = q.max ?? 10;
            const step = q.step ?? 1;

            return (
              <div key={q.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">{q.label}</Label>
                  <span className="text-xs text-muted-foreground">{numericValue}</span>
                </div>
                <Slider
                  min={min}
                  max={max}
                  step={step}
                  value={[numericValue]}
                  onValueChange={(arr) => setValue(q.name, arr[0], { shouldValidate: true, shouldDirty: true })}
                />
              </div>
            );
          }

          if (q.type === "textarea") {
            const value = (watch(q.name) as string) ?? "";
            return (
              <div key={q.id} className="space-y-2">
                <Label className="text-sm font-medium">{q.label}</Label>
                <Textarea
                  value={value}
                  onChange={(e) => setValue(q.name, e.target.value, { shouldValidate: true, shouldDirty: true })}
                  placeholder="Add any notes about the session conditions..."
                />
              </div>
            );
          }

          return null;
        })}
      </CardContent>
    </Card>
  );
}


