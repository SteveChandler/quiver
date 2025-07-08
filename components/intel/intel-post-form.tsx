"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  MapPin,
  Loader2,
  Camera,
  X,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { INTEL_CONFIG, INTEL_UI_TEXT, INTEL_TAGS } from "@/lib/constants/intel";
import { createIntelPost } from "@/actions/intel-actions";
import { uploadImage } from "@/lib/image-upload";
import type { IntelPostTag } from "@/types/database";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Form validation schema
const intelPostSchema = z.object({
  tag: z.enum([
    "parking",
    "hazard",
    "crowd",
    "conditions",
    "access",
    "other",
  ] as const),
  title: z
    .string()
    .min(1, INTEL_UI_TEXT.VALIDATION.TITLE_REQUIRED)
    .max(
      INTEL_CONFIG.MAX_TITLE_LENGTH,
      INTEL_UI_TEXT.VALIDATION.TITLE_TOO_LONG
    ),
  description: z
    .string()
    .min(1, INTEL_UI_TEXT.VALIDATION.DESCRIPTION_REQUIRED)
    .max(
      INTEL_CONFIG.MAX_DESCRIPTION_LENGTH,
      INTEL_UI_TEXT.VALIDATION.DESCRIPTION_TOO_LONG
    ),
});

type IntelPostFormData = z.infer<typeof intelPostSchema>;

interface IntelPostFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialLocation?: { latitude: number; longitude: number };
}

export function IntelPostForm({
  isOpen,
  onClose,
  onSuccess,
  initialLocation,
}: IntelPostFormProps) {
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(initialLocation || null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const form = useForm<IntelPostFormData>({
    resolver: zodResolver(intelPostSchema),
    defaultValues: {
      tag: "other",
      title: "",
      description: "",
    },
  });

  // Get user's current location
  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by this browser");
      return;
    }

    setGettingLocation(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setGettingLocation(false);
      },
      (error) => {
        let errorMessage = "Failed to get location";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage =
              "Location access denied. Please enable location services.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information is unavailable.";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out.";
            break;
        }
        setLocationError(errorMessage);
        setGettingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
      }
    );
  }, []);

  // Auto-get location when modal opens
  useEffect(() => {
    if (
      isOpen &&
      !location &&
      !initialLocation &&
      !gettingLocation &&
      !locationError
    ) {
      getCurrentLocation();
    }
  }, [
    isOpen,
    location,
    initialLocation,
    gettingLocation,
    locationError,
    getCurrentLocation,
  ]);

  // Handle photo selection
  const handlePhotoSelect = useCallback(
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

      setSelectedPhoto(file);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    },
    []
  );

  // Remove photo
  const handlePhotoRemove = useCallback(() => {
    setSelectedPhoto(null);
    setPhotoPreview(null);
  }, []);

  // Handle form submission
  const onSubmit = async (data: IntelPostFormData) => {
    if (!location) {
      toast.error(INTEL_UI_TEXT.VALIDATION.LOCATION_REQUIRED);
      return;
    }

    setUploading(true);

    try {
      let photoUrl: string | undefined;
      let photoStoragePath: string | undefined;

      // Upload photo if selected
      if (selectedPhoto) {
        const uploadResult = await uploadImage(
          selectedPhoto,
          INTEL_CONFIG.PHOTO_UPLOAD_BUCKET,
          "intel-posts"
        );

        if (uploadResult.success) {
          photoUrl = uploadResult.url;
          // Extract storage path from URL for deletion purposes
          photoStoragePath = uploadResult.url?.split("/").pop();
        } else {
          toast.error(
            uploadResult.error || INTEL_UI_TEXT.ERROR.PHOTO_UPLOAD_FAILED
          );
          return;
        }
      }

      // Create intel post
      const result = await createIntelPost({
        latitude: location.latitude,
        longitude: location.longitude,
        tag: data.tag,
        title: data.title,
        description: data.description,
        photo_url: photoUrl,
        photo_storage_path: photoStoragePath,
      });

      if (result.success) {
        toast.success(INTEL_UI_TEXT.SUCCESS.POST_CREATED);
        form.reset();
        setLocation(null);
        setSelectedPhoto(null);
        setPhotoPreview(null);
        onSuccess?.();
        onClose();
      } else {
        toast.error(result.error || INTEL_UI_TEXT.ERROR.POST_FAILED);
      }
    } catch (error) {
      console.error("Error creating intel post:", error);
      toast.error(INTEL_UI_TEXT.ERROR.POST_FAILED);
    } finally {
      setUploading(false);
    }
  };

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      form.reset();
      setLocation(initialLocation || null);
      setLocationError(null);
      setSelectedPhoto(null);
      setPhotoPreview(null);
    }
  }, [isOpen, form, initialLocation]);

  const isLocationReady = !!location;
  const canSubmit = isLocationReady && !uploading && !gettingLocation;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{INTEL_UI_TEXT.FORM.TITLE}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {INTEL_UI_TEXT.FORM.DESCRIPTION}
          </p>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Location Status */}
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <div className="flex-1">
                  {gettingLocation ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="text-sm">
                        {INTEL_UI_TEXT.FORM.LOCATION_PROMPT}
                      </span>
                    </div>
                  ) : locationError ? (
                    <div className="space-y-2">
                      <span className="text-sm text-red-500">
                        {locationError}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={getCurrentLocation}
                        className="h-7 text-xs"
                      >
                        Try Again
                      </Button>
                    </div>
                  ) : location ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        <span className="text-sm">Location captured</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {location.latitude.toFixed(4)},{" "}
                        {location.longitude.toFixed(4)}
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={getCurrentLocation}
                      className="h-7 text-xs"
                    >
                      Get Location
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Intel Type */}
          <div className="space-y-2">
            <Label htmlFor="tag">{INTEL_UI_TEXT.FORM.TAG_LABEL}</Label>
            <Select
              value={form.watch("tag")}
              onValueChange={(value: IntelPostTag) =>
                form.setValue("tag", value)
              }
            >
              <SelectTrigger>
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
            {form.formState.errors.tag && (
              <p className="text-sm text-red-500">
                {form.formState.errors.tag.message}
              </p>
            )}
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">{INTEL_UI_TEXT.FORM.TITLE_LABEL}</Label>
            <Input
              id="title"
              placeholder={INTEL_UI_TEXT.FORM.TITLE_PLACEHOLDER}
              {...form.register("title")}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {form.formState.errors.title && (
                  <span className="text-red-500">
                    {form.formState.errors.title.message}
                  </span>
                )}
              </span>
              <span>
                {form.watch("title")?.length || 0}/
                {INTEL_CONFIG.MAX_TITLE_LENGTH}
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
              {...form.register("description")}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {form.formState.errors.description && (
                  <span className="text-red-500">
                    {form.formState.errors.description.message}
                  </span>
                )}
              </span>
              <span>
                {form.watch("description")?.length || 0}/
                {INTEL_CONFIG.MAX_DESCRIPTION_LENGTH}
              </span>
            </div>
          </div>

          {/* Photo Upload */}
          <div className="space-y-2">
            <Label>{INTEL_UI_TEXT.FORM.PHOTO_LABEL}</Label>

            {photoPreview ? (
              <div className="relative">
                <img
                  src={photoPreview}
                  alt="Preview"
                  className="w-full h-32 object-cover rounded-lg"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handlePhotoRemove}
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
                  onChange={handlePhotoSelect}
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

          {/* Location requirement alert */}
          {!isLocationReady && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Location is required to share intel. Please enable location
                services.
              </AlertDescription>
            </Alert>
          )}

          {/* Form Actions */}
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={uploading}
              className="flex-1"
            >
              {INTEL_UI_TEXT.FORM.CANCEL_BUTTON}
            </Button>
            <Button type="submit" disabled={!canSubmit} className="flex-1">
              {uploading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Sharing...</span>
                </div>
              ) : (
                INTEL_UI_TEXT.FORM.SUBMIT_BUTTON
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
