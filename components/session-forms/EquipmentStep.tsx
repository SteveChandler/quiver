"use client";

import { Surfboard } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SessionFormState } from "@/hooks/use-session-form";
import { Board } from "@/types/database";

interface EquipmentStepProps {
  formState: SessionFormState;
  boards: Board[];
  updateField: <K extends keyof SessionFormState>(
    field: K,
    value: SessionFormState[K]
  ) => void;
}

export function EquipmentStep({
  formState,
  boards,
  updateField,
}: EquipmentStepProps) {
  return (
    <Card className="mb-4">
      <CardContent className="pt-6">
        <div className="flex items-center mb-4">
          <Surfboard className="w-5 h-5 mr-2 text-primary" />
          <h2 className="text-lg font-medium">What board are you using?</h2>
        </div>

        <div className="space-y-4">
          <Select
            value={formState.selectedBoard}
            onValueChange={(value) => updateField("selectedBoard", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a board" />
            </SelectTrigger>
            <SelectContent>
              {boards.map((board) => (
                <SelectItem key={board.id} value={board.id}>
                  {board.name} - {board.type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
