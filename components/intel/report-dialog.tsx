"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import type { IntelReportReason } from "@/lib/validation/schemas";

const REPORT_REASON_LABELS: Record<IntelReportReason, string> = {
  spam: "Spam or advertising",
  harassment: "Harassment or bullying",
  dangerous: "Dangerous advice",
  false_info: "Clearly false information",
  other: "Other",
};

interface ReportDialogProps {
  postId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ReportDialog({ postId, isOpen, onClose }: ReportDialogProps) {
  const [reason, setReason] = useState<IntelReportReason | "">("");
  const [details, setDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason) {
      toast.error("Please select a reason");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/intel/${postId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, details: details.trim() || undefined }),
      });

      if (response.ok) {
        toast.success("Report submitted. Thank you!");
        onClose();
        setReason("");
        setDetails("");
      } else {
        const data = await response.json();
        toast.error(data.message || data.error || "Failed to submit report");
      }
    } catch (err) {
      console.error("Report submission failed:", err);
      toast.error("Failed to submit report");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent aria-describedby={undefined} className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Report Intel Post</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <RadioGroup
            value={reason}
            onValueChange={(v) => setReason(v as IntelReportReason)}
          >
            {(
              Object.entries(REPORT_REASON_LABELS) as [
                IntelReportReason,
                string,
              ][]
            ).map(([key, label]) => (
              <div key={key} className="flex items-center space-x-2">
                <RadioGroupItem value={key} id={`report-${key}`} />
                <Label htmlFor={`report-${key}`} className="text-sm">
                  {label}
                </Label>
              </div>
            ))}
          </RadioGroup>

          <div>
            <Label
              htmlFor="report-details"
              className="text-sm text-muted-foreground"
            >
              Additional details (optional)
            </Label>
            <Textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Provide more context..."
              maxLength={500}
              className="mt-1 h-20"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!reason || isSubmitting}
            variant="destructive"
          >
            {isSubmitting ? "Submitting..." : "Submit Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
