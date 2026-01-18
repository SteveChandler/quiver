'use client';

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { INTEL_UI_TEXT } from "@/lib/constants/intel";

export interface IntelFormActionsProps {
  onCancel: () => void;
  canSubmit: boolean;
  isUploading: boolean;
  submitButtonLabel?: string;
}

export function IntelFormActions({
  onCancel,
  canSubmit,
  isUploading,
  submitButtonLabel,
}: IntelFormActionsProps) {
  return (
    <div className="flex gap-2 pt-4">
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={isUploading}
        className="flex-1"
      >
        {INTEL_UI_TEXT.FORM.CANCEL_BUTTON}
      </Button>
      <Button type="submit" disabled={!canSubmit} className="flex-1">
        {isUploading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Sharing...</span>
          </div>
        ) : (
          submitButtonLabel || INTEL_UI_TEXT.FORM.SUBMIT_BUTTON
        )}
      </Button>
    </div>
  );
}
