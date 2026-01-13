"use client";

import { useState, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Camera, MapPin, Loader2, X } from "lucide-react";
import { EmojiPicker } from "./emoji-picker";
import { toast } from "sonner";
import { uploadImage } from "@/lib/image-upload";
import { useGeolocation } from "@/hooks/use-geolocation";
import type { IntelEmojiRating } from "@/types/database";
import Image from "next/image";

interface QuickCheckinSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nearestBeachName?: string;
  onSuccess?: () => void;
}

/**
 * QuickCheckinSheet - Bottom sheet for quick intel check-ins
 *
 * @example
 * ```tsx
 * <QuickCheckinSheet
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   nearestBeachName="La Jolla Shores"
 * />
 * ```
 */
export function QuickCheckinSheet({
  open,
  onOpenChange,
  nearestBeachName,
  onSuccess,
}: QuickCheckinSheetProps) {
  const [rating, setRating] = useState<IntelEmojiRating | null>(null);
  const [note, setNote] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { coords } = useGeolocation({ autoRequest: false });

  const handlePhotoSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo must be less than 5MB");
      return;
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }, []);

  const clearPhoto = useCallback(() => {
    setPhotoFile(null);
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
      setPhotoPreview(null);
    }
  }, [photoPreview]);

  const handleSubmit = useCallback(async () => {
    if (!rating) {
      toast.error("Please select a condition rating");
      return;
    }

    if (!coords) {
      toast.error("Location required. Please enable location services.");
      return;
    }

    setSubmitting(true);

    try {
      // Upload photo if present
      let photoUrl: string | undefined;

      if (photoFile) {
        const uploadResult = await uploadImage(photoFile, "intel-photos", "checkins");
        if (!uploadResult.success) {
          throw new Error(uploadResult.error || "Failed to upload photo");
        }
        photoUrl = uploadResult.url;
      }

      // Create intel post
      const response = await fetch("/api/intel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: coords.lat,
          longitude: coords.lon,
          tag: "conditions",
          title: `Quick check-in: ${rating}`,
          description: note || `Conditions rated ${rating}`,
          emoji_rating: rating,
          photo_url: photoUrl,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to post check-in");
      }

      toast.success("Check-in posted!");

      // Reset form
      setRating(null);
      setNote("");
      clearPhoto();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Check-in error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to post check-in");
    } finally {
      setSubmitting(false);
    }
  }, [rating, note, photoFile, coords, clearPhoto, onOpenChange, onSuccess]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-[#1e1e1e] border-t border-white/10 rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle className="text-white">Quick Check-in</SheetTitle>
          <SheetDescription className="text-gray-400">
            Share current conditions with the community
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-4">
          {/* Emoji Rating (required) */}
          <div>
            <label className="text-sm font-medium text-gray-300 mb-3 block">
              How&apos;s it looking?
            </label>
            <EmojiPicker value={rating} onChange={setRating} />
          </div>

          {/* Optional Note */}
          <div>
            <Textarea
              placeholder="Add a note (optional)..."
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 140))}
              maxLength={140}
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 resize-none"
              rows={2}
            />
            <p className="text-xs text-gray-500 mt-1 text-right">{note.length}/140</p>
          </div>

          {/* Photo & Location Row */}
          <div className="flex items-center justify-between">
            {/* Photo Upload */}
            <div className="flex items-center gap-2">
              {photoPreview ? (
                <div className="relative">
                  <Image
                    src={photoPreview}
                    alt="Preview"
                    width={48}
                    height={48}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    onClick={clearPhoto}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors">
                  <Camera className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-400">Add photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoSelect}
                  />
                </label>
              )}
            </div>

            {/* Location Indicator */}
            <div className="flex items-center gap-1.5 text-sm text-gray-400">
              <MapPin className="w-4 h-4" />
              <span className="truncate max-w-[120px]">
                {nearestBeachName || (coords ? "Location detected" : "No location")}
              </span>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={!rating || submitting}
            className="w-full bg-[#f97316] hover:bg-[#ea580c] text-white font-semibold"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Posting...
              </>
            ) : (
              "Post Check-in"
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default QuickCheckinSheet;
