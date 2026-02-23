"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  IntelPostForm,
  IntelPostFormBeforeSubmitContext,
} from "@/components/intel/intel-post-form";
import { submitCheckIn } from "@/actions/check-in-actions";

interface CheckInDialogProps {
  isOpen: boolean;
  beachId: string;
  beachName: string;
  onClose: () => void;
  onSuccess?: () => void;
}

async function handleCheckInSubmit(
  beachId: string,
  context: IntelPostFormBeforeSubmitContext,
) {
  const { values } = context;

  const response = await submitCheckIn(beachId, {
    wave_height: values.wave_height ?? null,
    wind_speed: values.wind_speed ?? null,
    wind_direction: values.wind_direction ?? null,
    water_temp: values.water_temp ?? null,
    crowd_level: values.crowd_level ?? null,
    vibe: values.description?.trim() ? values.description : null,
    forecast_accuracy_rating: values.forecast_accuracy ?? "accurate",
  });

  if (!response.success) {
    throw new Error(response.error || "Failed to submit check-in");
  }
}

export function CheckInDialog({
  isOpen,
  beachId,
  beachName,
  onClose,
  onSuccess,
}: CheckInDialogProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => (!open ? onClose() : undefined)}
    >
      <DialogContent
        aria-describedby={undefined}
        className="max-w-md w-full max-h-[90vh] overflow-y-auto p-0"
      >
        <DialogTitle className="sr-only">Check In</DialogTitle>
        <IntelPostForm
          isOpen
          onClose={onClose}
          onSuccess={() => {
            onSuccess?.();
          }}
          beachId={beachId}
          beachName={beachName}
          variant="check-in"
          beforeSubmit={(context) => handleCheckInSubmit(beachId, context)}
          submitButtonLabel="Share Check-In"
          successToastOverride={{
            title: "Check-in submitted!",
            description:
              "Thanks for helping the surf community with real-time conditions.",
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
