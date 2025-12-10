"use client";

/**
 * Intel Edit Dialog Component
 *
 * Dialog for editing intel post content (title, description, tag).
 * Uses react-hook-form with Zod validation.
 */

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import {
  FormInput,
  FormTextarea,
  FormSelect,
} from "@/components/ui/form-fields";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, User, Calendar } from "lucide-react";
import { updateIntelContentSchema } from "@/lib/validation/admin/intel-schema";
import type { IntelPostWithDetails } from "@/actions/admin/intel";
import type { IntelPostTag } from "@/types/database";
import { formatDistanceToNow } from "date-fns";

interface IntelEditDialogProps {
  intel: IntelPostWithDetails | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    intelPostId: string;
    title: string;
    description: string;
    tag: IntelPostTag;
  }) => Promise<void>;
  submitting?: boolean;
}

const INTEL_TAG_OPTIONS: {
  value: IntelPostTag;
  label: string;
  description: string;
}[] = [
  {
    value: "parking",
    label: "Parking",
    description: "Parking availability and restrictions",
  },
  {
    value: "hazard",
    label: "Hazard",
    description: "Safety warnings and hazards",
  },
  {
    value: "crowd",
    label: "Crowd",
    description: "Crowd levels and busy times",
  },
  {
    value: "conditions",
    label: "Conditions",
    description: "Current surf and weather conditions",
  },
  {
    value: "access",
    label: "Access",
    description: "Access routes and entry points",
  },
  {
    value: "other",
    label: "Other",
    description: "Other relevant information",
  },
];

export function IntelEditDialog({
  intel,
  open,
  onClose,
  onSubmit,
  submitting = false,
}: IntelEditDialogProps) {
  const form = useForm<z.infer<typeof updateIntelContentSchema>>({
    resolver: zodResolver(updateIntelContentSchema),
    defaultValues: {
      intelPostId: "",
      title: "",
      description: "",
      tag: "other" as IntelPostTag,
    },
  });

  // Reset form when intel post changes
  useEffect(() => {
    if (intel) {
      form.reset({
        intelPostId: intel.id,
        title: intel.title,
        description: intel.description,
        tag: intel.tag,
      });
    }
  }, [intel, form]);

  const handleSubmit = async (
    data: z.infer<typeof updateIntelContentSchema>
  ) => {
    await onSubmit(data);
    onClose();
  };

  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return "Unknown";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Intel Post</DialogTitle>
          <DialogDescription>
            Update the title, description, or tag for this intel post.
          </DialogDescription>
        </DialogHeader>

        {intel && (
          <>
            {/* Intel Post Metadata */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg text-sm">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {intel.beach?.name || "Unknown Beach"}
                    </p>
                    {intel.beach?.region && (
                      <p className="text-xs text-muted-foreground">
                        {intel.beach.region}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span>{intel.user?.full_name || "Anonymous"}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>Created {formatDate(intel.created_at)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant={intel.is_active ? "default" : "secondary"}>
                    {intel.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Edit Form */}
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="space-y-4"
              >
                {/* Tag */}
                <FormSelect
                  control={form.control}
                  name="tag"
                  label="Tag *"
                  placeholder="Select a tag"
                  options={INTEL_TAG_OPTIONS}
                  renderOption={(option) => (
                    <div>
                      <p className="font-medium">{option.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {option.description as string}
                      </p>
                    </div>
                  )}
                />

                {/* Title */}
                <FormInput
                  control={form.control}
                  name="title"
                  label="Title *"
                  placeholder="Brief summary of the intel"
                  maxLength={100}
                />

                {/* Description */}
                <FormTextarea
                  control={form.control}
                  name="description"
                  label="Description *"
                  placeholder="Detailed information about this intel report"
                  rows={6}
                  maxLength={500}
                />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    Save Changes
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
