'use client';

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { INTEL_CONFIG, INTEL_UI_TEXT } from "@/lib/constants/intel";
import type { UseFormRegister, FieldErrors } from "react-hook-form";

export interface IntelTitleDescriptionProps {
  register: UseFormRegister<any>;
  errors: FieldErrors;
  titleValue: string;
  descriptionValue: string;
}

export function IntelTitleDescription({
  register,
  errors,
  titleValue,
  descriptionValue,
}: IntelTitleDescriptionProps) {
  return (
    <>
      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">{INTEL_UI_TEXT.FORM.TITLE_LABEL}</Label>
        <Input
          id="title"
          placeholder={INTEL_UI_TEXT.FORM.TITLE_PLACEHOLDER}
          {...register("title")}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {errors.title && (
              <span className="text-red-500">
                {errors.title.message as string}
              </span>
            )}
          </span>
          <span>
            {titleValue?.length || 0}/{INTEL_CONFIG.MAX_TITLE_LENGTH}
          </span>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">
          {INTEL_UI_TEXT.FORM.DESCRIPTION_LABEL}
        </Label>
        <Textarea
          id="description"
          placeholder={INTEL_UI_TEXT.FORM.DESCRIPTION_PLACEHOLDER}
          rows={3}
          {...register("description")}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {errors.description && (
              <span className="text-red-500">
                {errors.description.message as string}
              </span>
            )}
          </span>
          <span>
            {descriptionValue?.length || 0}/{INTEL_CONFIG.MAX_DESCRIPTION_LENGTH}
          </span>
        </div>
      </div>
    </>
  );
}
