"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  MapPin,
  Loader2,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { INTEL_CONFIG, INTEL_UI_TEXT } from "@/lib/constants/intel";
import { createIntelPost } from "@/actions/intel-actions";
import { getEnhancedBeachForecasts } from "@/actions/forecast-actions";
import { getCurrentForecast } from "@/lib/utils/current-forecast-utils";
import { uploadImage } from "@/lib/image-upload";
import type { IntelPostTag, IntelPostWithUser } from "@/types/database";
import { toast } from "sonner";
import {
  IntelTagSelector,
  IntelTitleDescription,
  IntelConditionsFields,
  IntelPhotoSection,
  IntelFormActions,
  type WindDirection,
  type ForecastAccuracy,
} from "./form";
import {
  useIntelFormValidation,
  intelPostSchema,
  type IntelPostFormData,
} from "@/hooks/use-intel-form-validation";

// Field state tracking for auto-prefill (conditions tag only)
type FieldPrefillState = "empty" | "prefilled" | "user-edited";
type ConditionFieldStates = {
  wave_height: FieldPrefillState;
  wind_speed: FieldPrefillState;
  wind_direction: FieldPrefillState;
  water_temp: FieldPrefillState;
};

// Parse numeric values from forecast strings (e.g., "3.5 ft" -> 3.5)
function parseNumericValue(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value !== "string") return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

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

  // Forecast prefill state (conditions tag only)
  const [forecastLoading, setForecastLoading] = useState(false);
  const fieldStatesRef = useRef<ConditionFieldStates>({
    wave_height: "empty",
    wind_speed: "empty",
    wind_direction: "empty",
    water_temp: "empty",
  });
  const lastPrefillKeyRef = useRef<string | null>(null);

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

  // Use validation hook
  const { generateConditionsSummary, validateBeforeSubmit } = useIntelFormValidation({ variant });

  useEffect(() => {
    if (lockedTag) {
      form.setValue("tag", lockedTag);
    }
  }, [form, lockedTag]);

  // Watch tag for prefill logic
  const watchedTag = form.watch("tag");

  // Fetch forecast and auto-prefill conditions fields when:
  // 1. Modal is open
  // 2. Tag is "conditions"
  // 3. We have a beachId
  useEffect(() => {
    const shouldFetch = isOpen && watchedTag === "conditions" && beachId;

    if (!shouldFetch) {
      return;
    }

    // Create a key for this beach to avoid duplicate fetches
    const prefillKey = `${beachId}-${isOpen}`;
    if (prefillKey === lastPrefillKeyRef.current) {
      return;
    }
    lastPrefillKeyRef.current = prefillKey;

    // Reset field states when modal opens fresh
    fieldStatesRef.current = {
      wave_height: "empty",
      wind_speed: "empty",
      wind_direction: "empty",
      water_temp: "empty",
    };

    const fetchAndPrefill = async () => {
      setForecastLoading(true);
      try {
        const result = await getEnhancedBeachForecasts(beachId, 2);

        if (!result.success || !result.data || result.data.length === 0) {
          return;
        }

        // Select the best forecast using forward-looking time logic
        const bestForecast = getCurrentForecast(result.data);
        if (!bestForecast) {
          return;
        }

        // Prefill fields only if they are still empty (not user-edited)
        const parsedWaveHeight = parseNumericValue(bestForecast.wave_height);
        const parsedWindSpeed = parseNumericValue(bestForecast.wind_speed);
        const parsedWaterTemp = parseNumericValue(bestForecast.water_temp);
        const windDirection = bestForecast.wind_direction || undefined;

        // Wave Height
        if (
          fieldStatesRef.current.wave_height === "empty" &&
          parsedWaveHeight !== undefined
        ) {
          form.setValue("wave_height", parsedWaveHeight);
          fieldStatesRef.current.wave_height = "prefilled";
        }

        // Wind Speed
        if (
          fieldStatesRef.current.wind_speed === "empty" &&
          parsedWindSpeed !== undefined
        ) {
          form.setValue("wind_speed", parsedWindSpeed);
          fieldStatesRef.current.wind_speed = "prefilled";
        }

        // Wind Direction
        if (
          fieldStatesRef.current.wind_direction === "empty" &&
          windDirection
        ) {
          // Map forecast wind direction to our enum values
          const directionMap: Record<string, string> = {
            N: "N", NE: "NE", E: "E", SE: "SE",
            S: "S", SW: "SW", W: "W", NW: "NW",
            North: "N", Northeast: "NE", East: "E", Southeast: "SE",
            South: "S", Southwest: "SW", West: "W", Northwest: "NW",
            Offshore: "OFFSHORE", Onshore: "ONSHORE", Cross: "CROSS",
            "Cross-shore": "CROSS",
          };
          const mapped = directionMap[windDirection] || windDirection.toUpperCase();
          if (["N", "NE", "E", "SE", "S", "SW", "W", "NW", "OFFSHORE", "ONSHORE", "CROSS"].includes(mapped)) {
            form.setValue("wind_direction", mapped as WindDirection);
            fieldStatesRef.current.wind_direction = "prefilled";
          }
        }

        // Water Temp
        if (
          fieldStatesRef.current.water_temp === "empty" &&
          parsedWaterTemp !== undefined
        ) {
          form.setValue("water_temp", parsedWaterTemp);
          fieldStatesRef.current.water_temp = "prefilled";
        }

        console.debug("[IntelPostForm] Prefilled conditions from forecast", {
          wave_height: parsedWaveHeight,
          wind_speed: parsedWindSpeed,
          wind_direction: windDirection,
          water_temp: parsedWaterTemp,
        });
      } catch (error) {
        console.error("[IntelPostForm] Failed to fetch forecast for prefill:", error);
      } finally {
        setForecastLoading(false);
      }
    };

    fetchAndPrefill();
  }, [isOpen, beachId, watchedTag, form]);

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
  const handlePhotoSelect = useCallback((file: File) => {
    setSelectedPhoto(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPhotoPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  // Remove photo
  const handlePhotoRemove = useCallback(() => {
    setSelectedPhoto(null);
    setPhotoPreview(null);
  }, []);

  // Handle field edit tracking for prefill
  const handleFieldEdited = useCallback((field: keyof ConditionFieldStates) => {
    fieldStatesRef.current[field] = "user-edited";
  }, []);

  // Handle form submission (business logic)
  const submitIntel = async (data: IntelPostFormData) => {
    if (!location) {
      toast.error(INTEL_UI_TEXT.VALIDATION.LOCATION_REQUIRED);
      return;
    }

    setUploading(true);

    try {
      // If beforeSubmit is provided (e.g., for check-ins), handle it separately
      if (beforeSubmit) {
        await beforeSubmit({
          values: data,
          location,
          beachId,
        });

        // Show success message
        if (successToastOverride) {
          toast.success(successToastOverride.title, {
            description: successToastOverride.description,
          });
        } else {
          toast.success(INTEL_UI_TEXT.SUCCESS.POST_CREATED);
        }

        // Reset form
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

        // Call success callback to refresh feeds
        onSuccess?.(null);
        onClose();
        return; // Early return - beforeSubmit handled the submission
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
        lat: location.latitude,
        lon: location.longitude,
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
          const summary = generateConditionsSummary({
            wave_types: values.wave_types,
            crowd_level: values.crowd_level,
            wind_direction: values.wind_direction,
            wind_speed: values.wind_speed,
            water_temp: values.water_temp,
          });
          if (needsTitle) form.setValue("title", "Conditions update");
          if (needsDesc) form.setValue("description", summary);
          values = form.getValues();
        }
      }

      // Validate required fields using hook
      const validation = validateBeforeSubmit(values);
      if (!validation.isValid) {
        // Set errors for missing fields
        validation.missingFields.forEach((field) => {
          if (field === "title") {
            form.setError("title", {
              type: "manual",
              message: INTEL_UI_TEXT.VALIDATION.TITLE_REQUIRED,
            });
          } else if (field === "description") {
            form.setError("description", {
              type: "manual",
              message: INTEL_UI_TEXT.VALIDATION.DESCRIPTION_REQUIRED,
            });
          } else if (field === "forecast_accuracy") {
            toast.error("Please rate the forecast accuracy before sharing.");
            return;
          }
        });

        // Focus the first missing field and show a toast
        if (validation.missingFields.includes("title")) {
          form.setFocus("title");
        } else if (validation.missingFields.includes("description")) {
          form.setFocus("description");
        }

        toast.error(
          `Please complete the required ${validation.missingFields.join(" and ")} field${
            validation.missingFields.length > 1 ? "s" : ""
          } before sharing.`
        );
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
      // Reset prefill tracking
      fieldStatesRef.current = {
        wave_height: "empty",
        wind_speed: "empty",
        wind_direction: "empty",
        water_temp: "empty",
      };
      lastPrefillKeyRef.current = null;
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
                        {location.latitude?.toFixed(4) ?? "N/A"},{" "}
                        {location.longitude?.toFixed(4) ?? "N/A"}
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
          <IntelTagSelector
            value={form.watch("tag")}
            onChange={(value: IntelPostTag) => form.setValue("tag", value)}
            disabled={!!lockedTag}
            error={form.formState.errors.tag?.message}
          />

          {/* Title and Description */}
          <IntelTitleDescription
            register={form.register}
            errors={form.formState.errors}
            titleValue={form.watch("title") || ""}
            descriptionValue={form.watch("description") || ""}
          />

          {/* Surf Conditions Section - Only show for conditions tag */}
          {form.watch("tag") === "conditions" && (
            <IntelConditionsFields
              waveHeight={form.watch("wave_height") ?? null}
              onWaveHeightChange={(value) => form.setValue("wave_height", value)}
              waterTemp={form.watch("water_temp") ?? null}
              onWaterTempChange={(value) => form.setValue("water_temp", value)}
              windSpeed={form.watch("wind_speed") ?? null}
              onWindSpeedChange={(value) => form.setValue("wind_speed", value)}
              windDirection={form.watch("wind_direction") as WindDirection | null}
              onWindDirectionChange={(value) => form.setValue("wind_direction", value)}
              crowdLevel={form.watch("crowd_level") ?? null}
              onCrowdLevelChange={(value) => form.setValue("crowd_level", value)}
              waveTypes={form.watch("wave_types") || []}
              onWaveTypesChange={(types) => form.setValue("wave_types", types)}
              forecastAccuracy={form.watch("forecast_accuracy") as ForecastAccuracy | null}
              onForecastAccuracyChange={(value) => form.setValue("forecast_accuracy", value)}
              onFieldEdited={handleFieldEdited}
            />
          )}

          {/* Photo Upload */}
          <IntelPhotoSection
            photoPreview={photoPreview}
            onPhotoSelect={handlePhotoSelect}
            onPhotoRemove={handlePhotoRemove}
          />

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
          <IntelFormActions
            onCancel={onClose}
            canSubmit={canSubmit}
            isUploading={uploading}
            submitButtonLabel={submitButtonLabel}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
