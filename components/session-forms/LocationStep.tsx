"use client";

import { MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SessionFormState } from "@/hooks/use-session-form";
import { Beach } from "@/types/database";

interface LocationStepProps {
  formState: SessionFormState;
  beaches: Beach[];
  updateField: <K extends keyof SessionFormState>(
    field: K,
    value: SessionFormState[K]
  ) => void;
}

export function LocationStep({
  formState,
  beaches,
  updateField,
}: LocationStepProps) {
  return (
    <Card className="mb-4">
      <CardContent className="pt-6">
        <div className="flex items-center mb-4">
          <MapPin className="w-5 h-5 mr-2 text-primary" />
          <h2 className="text-lg font-medium">Where are you surfing?</h2>
        </div>

        <div className="space-y-4">
          <Select
            value={formState.selectedBeach}
            onValueChange={(value) => updateField("selectedBeach", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a beach" />
            </SelectTrigger>
            <SelectContent>
              {beaches.map((beach) => (
                <SelectItem key={beach.id} value={beach.name}>
                  {beach.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
