'use client';

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { INTEL_UI_TEXT, INTEL_TAGS } from "@/lib/constants/intel";
import type { IntelPostTag } from "@/types/database";

export interface IntelTagSelectorProps {
  value: IntelPostTag;
  onChange: (value: IntelPostTag) => void;
  disabled?: boolean;
  error?: string;
}

export function IntelTagSelector({
  value,
  onChange,
  disabled = false,
  error,
}: IntelTagSelectorProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="tag">{INTEL_UI_TEXT.FORM.TAG_LABEL}</Label>
      <Select
        value={value}
        onValueChange={(val: IntelPostTag) => onChange(val)}
        disabled={disabled}
      >
        <SelectTrigger disabled={disabled}>
          <SelectValue placeholder={INTEL_UI_TEXT.FORM.TAG_PLACEHOLDER} />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(INTEL_TAGS).map(([key, config]) => (
            <SelectItem key={key} value={key}>
              <div className="flex items-center gap-2">
                <span>{config.emoji}</span>
                <span>{config.label}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
