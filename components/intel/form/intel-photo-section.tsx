'use client';

import { useCallback } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Camera, X } from "lucide-react";
import { INTEL_CONFIG, INTEL_UI_TEXT } from "@/lib/constants/intel";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface IntelPhotoSectionProps {
  photoPreview: string | null;
  onPhotoSelect: (file: File) => void;
  onPhotoRemove: () => void;
}

export function IntelPhotoSection({
  photoPreview,
  onPhotoSelect,
  onPhotoRemove,
}: IntelPhotoSectionProps) {
  const handlePhotoChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!INTEL_CONFIG.ALLOWED_PHOTO_TYPES.includes(file.type)) {
        toast.error(INTEL_UI_TEXT.VALIDATION.PHOTO_INVALID_TYPE);
        return;
      }

      // Validate file size
      if (file.size > INTEL_CONFIG.MAX_PHOTO_SIZE) {
        toast.error(INTEL_UI_TEXT.VALIDATION.PHOTO_TOO_LARGE);
        return;
      }

      onPhotoSelect(file);
    },
    [onPhotoSelect]
  );

  return (
    <div className="space-y-2">
      <Label>{INTEL_UI_TEXT.FORM.PHOTO_LABEL}</Label>

      {photoPreview ? (
        <div className="relative h-32">
          <Image
            src={photoPreview}
            alt="Preview"
            fill
            sizes="100vw"
            className="object-cover rounded-lg"
          />
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onPhotoRemove}
            className="absolute top-2 right-2 h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div>
          <input
            type="file"
            accept={INTEL_CONFIG.ALLOWED_PHOTO_TYPES.join(",")}
            onChange={handlePhotoChange}
            className="hidden"
            id="photo-upload"
          />
          <Label
            htmlFor="photo-upload"
            className={cn(
              "flex items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors",
              "border-muted-foreground/25"
            )}
          >
            <div className="text-center">
              <Camera className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                {INTEL_UI_TEXT.FORM.PHOTO_PLACEHOLDER}
              </p>
            </div>
          </Label>
        </div>
      )}
    </div>
  );
}
