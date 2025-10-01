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
  DialogDescription,
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
  Waves,
  Wind,
  Thermometer,
  Users,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { INTEL_CONFIG, INTEL_UI_TEXT, INTEL_TAGS } from "@/lib/constants/intel";
import { createIntelPost } from "@/actions/intel-actions";
import { uploadImage } from "@/lib/image-upload";
import type { IntelPostTag, IntelPostWithUser } from "@/types/database";
import { toast } from "sonner";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { WaveTypeSelector } from "@/components/ui/wave-type-selector";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";

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
  // Surf condition fields
  wave_height: z.number().min(0).max(50).nullable().optional(),
  wind_speed: z.number().min(0).max(150).nullable().optional(),
  wind_direction: z
    .enum([
      "N",
      "NE",
      "E",
      "SE",
      "S",
      "SW",
      "W",
      "NW",
      "OFFSHORE",
      "ONSHORE",
      "CROSS",
    ])
    .nullable()
    .optional(),
  water_temp: z.number().min(32).max(100).nullable().optional(),
  crowd_level: z.number().min(1).max(5).nullable().optional(),
  wave_types: z.array(z.string()).optional(),
  forecast_accuracy: z
    .enum(["accurate", "somewhat", "inaccurate"])
    .nullable()
    .optional(),
});

type IntelPostFormData = z.infer<typeof intelPostSchema>;

interface IntelPostFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (post: IntelPostWithUser | null) => void;
  initialLocation?: { latitude: number; longitude: number };
  beachId?: string;
  beachName?: string;
  variant?: "intel" | "check-in";
  beforeSubmit?: (context: IntelPostFormBeforeSubmitContext) => Promise<void>;
  successToastOverride?: { title: string; description?: string };
  submitButtonLabel?: string;
}

export type IntelPostFormBeforeSubmitContext = {
  values: IntelPostFormData;
  location: { latitude: number; longitude: number };
  beachId?: string;
};

const windDirections = [
  { value: "N", label: "North" },
  { value: "NE", label: "Northeast" },
  { value: "E", label: "East" },
  { value: "SE", label: "Southeast" },
  { value: "S", label: "South" },
  { value: "SW", label: "Southwest" },
  { value: "W", label: "West" },
  { value: "NW", label: "Northwest" },
  { value: "OFFSHORE", label: "Offshore" },
  { value: "ONSHORE", label: "Onshore" },
  { value: "CROSS", label: "Cross-shore" },
];

const accuracyOptions = [
  {
    value: "accurate",
    label: "Yes",
    icon: CheckCircle2,
    color: "text-green-600",
    bgColor: "bg-green-50 hover:bg-green-100",
    description: "Forecast was spot on",
  },
  {
    value: "somewhat",
    label: "Kinda",
    icon: AlertCircle,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50 hover:bg-yellow-100",
    description: "Close but not perfect",
  },
  {
    value: "inaccurate",
    label: "No",
    icon: XCircle,
    color: "text-red-600",
    bgColor: "bg-red-50 hover:bg-red-100",
    description: "Way off the mark",
  },
];

export function IntelPostForm({
  isOpen,
  onClose,
  onSuccess,
  initialLocation,
  beachId,
  beachName,
  variant = "intel",
  beforeSubmit,
  successToastOverride,
  submitButtonLabel,
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

  const lockedTag = variant === "check-in" ? "conditions" : undefined;
  const form = useForm<IntelPostFormData>({
    resolver: zodResolver(intelPostSchema),
    defaultValues: {
      tag: lockedTag ?? "other",
      title: "",
      description: "",
      wave_height: null,
      wind_speed: null,
      wind_direction: null,
      water_temp: null,
      crowd_level: 3,
      wave_types: [],
      forecast_accuracy: variant === "check-in" ? "accurate" : null,
    },
  });

  useEffect(() => {
    if (lockedTag) {
      form.setValue("tag", lockedTag);
    }
  }, [form, lockedTag]);

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

  // Handle form submission (business logic)
  const submitIntel = async (data: IntelPostFormData) => {
    if (!location) {
      toast.error(INTEL_UI_TEXT.VALIDATION.LOCATION_REQUIRED);
      return;
    }

    setUploading(true);

    try {
      if (beforeSubmit) {
        await beforeSubmit({
          values: data,
          location,
          beachId,
        });
      }

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
        ...(beachId ? { beach_id: beachId } : {}),
        tag: data.tag,
        title: data.title,
        description: data.description,
        photo_url: photoUrl,
        photo_storage_path: photoStoragePath,
        // Surf condition fields
        wave_height: data.wave_height ?? null,
        wind_speed: data.wind_speed ?? null,
        wind_direction: data.wind_direction ?? null,
        water_temp: data.water_temp ?? null,
        crowd_level: data.crowd_level ?? 3,
        wave_types: data.wave_types ?? [],
        forecast_accuracy: data.forecast_accuracy ?? null,
      });

      if (result.success) {
        const newPost = result.data as IntelPostWithUser | undefined;
        if (successToastOverride) {
          toast.success(successToastOverride.title, {
            description: successToastOverride.description,
          });
        } else {
          toast.success(INTEL_UI_TEXT.SUCCESS.POST_CREATED);
        }
        form.reset({
          tag: lockedTag ?? "other",
          title: "",
          description: "",
          wave_height: null,
          wind_speed: null,
          wind_direction: null,
          water_temp: null,
          crowd_level: 3,
          wave_types: [],
          forecast_accuracy: variant === "check-in" ? "accurate" : null,
        });
        setLocation(initialLocation || null);
        setSelectedPhoto(null);
        setPhotoPreview(null);
        onSuccess?.(newPost ?? null);
        onClose();
      } else {
        toast.error(result.error || INTEL_UI_TEXT.ERROR.POST_FAILED);
      }
    } catch (error) {
      console.error("Error creating intel post:", error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : INTEL_UI_TEXT.ERROR.POST_FAILED;
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  // Bridge submit handler to avoid unhandled sync Zod errors in tests
  const handleSubmitForm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      let values = form.getValues();

      // For check-in variant or quick "conditions" posts, auto-generate content if fields are blank
      if (values.tag === "conditions") {
        const needsTitle = !values.title || !values.title.trim();
        const needsDesc = !values.description || !values.description.trim();

        if (needsTitle || needsDesc) {
          const waveTypes = (values.wave_types || []).join(", ");
          const parts: string[] = [];
          if (waveTypes) parts.push(`Waves: ${waveTypes}`);
          if (values.crowd_level) parts.push(`Crowd: ${values.crowd_level}/5`);
          if (values.wind_direction || values.wind_speed !== null)
            parts.push(
              `Wind: ${values.wind_direction || ""}$${""}`.replace("$", "")
            );
          if (values.wind_speed !== null && values.wind_speed !== undefined)
            parts.push(`Wind Speed: ${values.wind_speed} mph`);
          if (values.water_temp !== null && values.water_temp !== undefined)
            parts.push(`Water: ${values.water_temp}°F`);

          const summary = parts.join(" • ") || "Real-time conditions update";
          if (needsTitle) form.setValue("title", "Conditions update");
          if (needsDesc) form.setValue("description", summary);
          values = form.getValues();
        }
      }

      // Validate required fields; provide helpful feedback and focus
      const missing: string[] = [];
      let blocked = false;
      if (!values.title || !values.title.trim()) {
        form.setError("title", {
          type: "manual",
          message: INTEL_UI_TEXT.VALIDATION.TITLE_REQUIRED,
        });
        blocked = true;
        missing.push("title");
      }
      if (!values.description || !values.description.trim()) {
        form.setError("description", {
          type: "manual",
          message: INTEL_UI_TEXT.VALIDATION.DESCRIPTION_REQUIRED,
        });
        blocked = true;
        missing.push("description");
      }
      if (blocked) {
        // Focus the first missing field and show a toast
        if (missing.includes("title")) form.setFocus("title");
        else if (missing.includes("description")) form.setFocus("description");
        toast.error(
          `Please complete the required ${missing.join(" and ")} field$${
            missing.length > 1 ? "s" : ""
          } before sharing.`.replace("$", "")
        );
        return;
      }

      if (variant === "check-in" && !values.forecast_accuracy) {
        toast.error("Please rate the forecast accuracy before sharing.");
        return;
      }

      const isValid = await form.trigger(["title", "description", "tag"]);
      if (!isValid) return;
      await submitIntel(form.getValues());
    } catch (_err) {
      // Suppress resolver ZodError bubbling; errors are reflected in formState
    }
  };

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      form.reset({
        tag: "other",
        title: "",
        description: "",
        wave_height: null,
        wind_speed: null,
        wind_direction: null,
        water_temp: null,
        crowd_level: 3,
        wave_types: [],
        forecast_accuracy: null,
      });
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
          <DialogDescription>
            {INTEL_UI_TEXT.FORM.DESCRIPTION}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmitForm} className="space-y-4">
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
                      {beachName && (
                        <div className="text-xs font-medium text-gray-700">
                          {beachName}
                        </div>
                      )}
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
              disabled={!!lockedTag}
            >
              <SelectTrigger disabled={!!lockedTag}>
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

          {/* Surf Conditions Section - Only show for conditions tag */}
          {form.watch("tag") === "conditions" && (
            <div className="space-y-6 border-t pt-6">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Current Surf Conditions
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Wave Height */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Waves className="h-4 w-4" />
                    Wave Height (ft)
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="50"
                    placeholder="3.5"
                    value={form.watch("wave_height") ?? ""}
                    onChange={(e) =>
                      form.setValue(
                        "wave_height",
                        e.target.value ? parseFloat(e.target.value) : null
                      )
                    }
                  />
                </div>

                {/* Water Temperature */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Thermometer className="h-4 w-4" />
                    Water Temp (°F)
                  </Label>
                  <Input
                    type="number"
                    min="32"
                    max="100"
                    placeholder="68"
                    value={form.watch("water_temp") ?? ""}
                    onChange={(e) =>
                      form.setValue(
                        "water_temp",
                        e.target.value ? parseFloat(e.target.value) : null
                      )
                    }
                  />
                </div>

                {/* Wind Speed */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Wind className="h-4 w-4" />
                    Wind Speed (mph)
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="150"
                    placeholder="10"
                    value={form.watch("wind_speed") ?? ""}
                    onChange={(e) =>
                      form.setValue(
                        "wind_speed",
                        e.target.value ? parseFloat(e.target.value) : null
                      )
                    }
                  />
                </div>

                {/* Wind Direction */}
                <div className="space-y-2">
                  <Label>Wind Direction</Label>
                  <Select
                    value={form.watch("wind_direction") || ""}
                    onValueChange={(value) =>
                      form.setValue("wind_direction", value as any)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select direction" />
                    </SelectTrigger>
                    <SelectContent>
                      {windDirections.map((direction) => (
                        <SelectItem
                          key={direction.value}
                          value={direction.value}
                        >
                          {direction.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Crowd Level */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Crowd Level
                </Label>
                <div className="space-y-3">
                  <Slider
                    min={1}
                    max={5}
                    step={1}
                    value={[form.watch("crowd_level") || 3]}
                    onValueChange={(value) =>
                      form.setValue("crowd_level", value[0])
                    }
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Empty</span>
                    <Badge variant="outline" className="text-xs">
                      {(() => {
                        const level = form.watch("crowd_level") || 3;
                        const labels = [
                          "",
                          "Empty",
                          "Light",
                          "Moderate",
                          "Busy",
                          "Packed",
                        ];
                        return labels[level] || "Moderate";
                      })()}
                    </Badge>
                    <span>Packed</span>
                  </div>
                </div>
              </div>

              {/* Wave Types */}
              <div className="space-y-3">
                <WaveTypeSelector
                  selectedTypes={form.watch("wave_types") || []}
                  onChange={(types) => form.setValue("wave_types", types)}
                />
              </div>

              {/* Forecast Accuracy */}
              <div className="space-y-3">
                <Label>Was today&apos;s forecast accurate?</Label>
                <div className="grid grid-cols-3 gap-3">
                  {accuracyOptions.map((option) => {
                    const IconComponent = option.icon;
                    const isSelected =
                      form.watch("forecast_accuracy") === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          form.setValue(
                            "forecast_accuracy",
                            option.value as any
                          )
                        }
                        className={`p-4 rounded-lg border-2 transition-all ${
                          isSelected
                            ? "border-blue-500 bg-blue-50"
                            : `border-gray-200 ${option.bgColor}`
                        }`}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <IconComponent
                            className={`h-6 w-6 ${
                              isSelected ? "text-blue-600" : option.color
                            }`}
                          />
                          <span
                            className={`font-medium ${
                              isSelected ? "text-blue-700" : "text-gray-700"
                            }`}
                          >
                            {option.label}
                          </span>
                          <span className="text-xs text-gray-500 text-center">
                            {option.description}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Photo Upload */}
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
                submitButtonLabel || INTEL_UI_TEXT.FORM.SUBMIT_BUTTON
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
