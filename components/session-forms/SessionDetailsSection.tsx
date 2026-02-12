"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Activity,
  Star,
  Users,
  Car,
  Wind,
  Thermometer,
  CheckCircle2,
  AlertCircle,
  Camera,
  Upload,
  X,
  Loader2,
} from "lucide-react";
import { useSessionForecast } from "@/hooks/use-session-forecast";
import { formatWaveHeightRangeString } from "@/lib/utils/wave-height-formatter";
import { SET_WAVE_VARIANCE } from "@/lib/utils/wave-height-transformer";
import { SimpleCardLayout } from "@/components/ui/form-layout";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WaveTypeSelector } from "@/components/ui/wave-type-selector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SessionFormMode } from "@/lib/constants/session-form-constants";
import { SessionFormState } from "@/hooks/use-session-form";
import { cn } from "@/lib/utils";
import {
  RatingInput,
  WIND_DIRECTIONS,
  FORECAST_ACCURACY_OPTIONS,
} from "./shared";

/**
 * SessionDetailsSection - Consolidated component for log mode
 *
 * Combines what was previously three separate steps:
 * - ConditionsSection (wave conditions, ratings, forecast accuracy)
 * - PhotoSelectionSection (photo upload)
 * - NotesSection (session notes)
 *
 * All data flows through formState.updateField() - NO local state for form fields.
 * Photos are managed via the onPhotosChange callback prop.
 *
 * Design: See docs/design/SESSION_WIZARD_CONSOLIDATION_DESIGN.md
 */

interface SessionDetailsSectionProps {
  mode: SessionFormMode;
  formState: SessionFormState;
  updateField: <K extends keyof SessionFormState>(
    field: K,
    value: SessionFormState[K]
  ) => void;
  selectedPhotos: File[];
  onPhotosChange: (files: File[]) => void;
}

// Photo upload constraints
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB before compression
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_PHOTOS = 5;

// File preview type for photo management
interface FilePreview {
  file: File;
  url: string;
  id: string;
  originalSize: number;
}

// Field state tracking for auto-prefill
type FieldState = "empty" | "prefilled" | "user-edited";
type FieldStateTracking = {
  waveHeight: FieldState;
  windSpeed: FieldState;
  windDirection: FieldState;
  waterTemp: FieldState;
};

/**
 * Main SessionDetailsSection Component
 *
 * This component only renders in log mode and provides:
 * 1. Duration input
 * 2. Forecast comparison (if available)
 * 3. Wave conditions (height, water temp, wind speed/direction)
 * 4. Experience ratings (wave quality, parking, crowd)
 * 5. Wave type selector
 * 6. Forecast accuracy
 * 7. Photo upload
 * 8. Session notes
 */
export function SessionDetailsSection({
  mode,
  formState,
  updateField,
  selectedPhotos,
  onPhotosChange,
}: SessionDetailsSectionProps) {
  // Local state for photo preview management ONLY (not form data)
  const [filePreviews, setFilePreviews] = useState<FilePreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track field states for auto-prefill logic
  const fieldStatesRef = useRef<FieldStateTracking>({
    waveHeight: "empty",
    windSpeed: "empty",
    windDirection: "empty",
    waterTemp: "empty",
  });

  // Track the last beach/date/time combination to detect changes
  const lastPrefillKeyRef = useRef<string>("");

  // Helper to check if a field is empty (for prefill logic)
  const isFieldEmpty = useCallback(
    (field: keyof FieldStateTracking): boolean => {
      switch (field) {
        case "waveHeight":
          return formState.waveHeight === undefined || formState.waveHeight === null;
        case "windSpeed":
          return formState.windSpeed === undefined || formState.windSpeed === null;
        case "windDirection":
          return !formState.windDirection;
        case "waterTemp":
          return !formState.waterTemp;
        default:
          return true;
      }
    },
    [formState.waveHeight, formState.windSpeed, formState.windDirection, formState.waterTemp]
  );

  // Wrapper for updateField that tracks user edits
  const handleFieldUpdate = useCallback(
    <K extends keyof SessionFormState>(field: K, value: SessionFormState[K]) => {
      const trackedField = field as keyof FieldStateTracking;
      if (trackedField in fieldStatesRef.current) {
        fieldStatesRef.current[trackedField] = "user-edited";
      }
      updateField(field, value);
    },
    [updateField]
  );

  // Fetch forecast data for comparison
  const {
    forecastData,
    loading: forecastLoading,
    error: forecastError,
  } = useSessionForecast(
    formState.selectedBeachId ?? null,
    formState.selectedDate ?? null,
    formState.selectedTime ?? null
  );

  // Auto-prefill effect: Only for "log" mode, only when fields are empty
  useEffect(() => {
    if (mode !== "log") return;
    if (!forecastData || forecastLoading) return;

    // Create a key for this beach/date/time combination
    const currentPrefillKey = `${formState.selectedBeachId}-${formState.selectedDate}-${formState.selectedTime}`;

    // If beach/date/time changed, reset tracking to allow new prefill
    if (currentPrefillKey !== lastPrefillKeyRef.current) {
      lastPrefillKeyRef.current = currentPrefillKey;
      Object.keys(fieldStatesRef.current).forEach((key) => {
        const field = key as keyof FieldStateTracking;
        if (isFieldEmpty(field)) {
          fieldStatesRef.current[field] = "empty";
        }
      });
    }

    // Wave Height
    if (
      fieldStatesRef.current.waveHeight === "empty" &&
      forecastData.wave_height !== undefined
    ) {
      updateField("waveHeight", forecastData.wave_height);
      fieldStatesRef.current.waveHeight = "prefilled";
    }

    // Wind Speed
    if (
      fieldStatesRef.current.windSpeed === "empty" &&
      forecastData.wind_speed !== undefined
    ) {
      updateField("windSpeed", forecastData.wind_speed);
      fieldStatesRef.current.windSpeed = "prefilled";
    }

    // Wind Direction
    if (
      fieldStatesRef.current.windDirection === "empty" &&
      forecastData.wind_direction
    ) {
      updateField("windDirection", forecastData.wind_direction);
      fieldStatesRef.current.windDirection = "prefilled";
    }

    // Water Temp
    if (
      fieldStatesRef.current.waterTemp === "empty" &&
      forecastData.water_temp !== undefined
    ) {
      updateField("waterTemp", String(forecastData.water_temp));
      fieldStatesRef.current.waterTemp = "prefilled";
    }
    // updateField is stable (useCallback with no deps in use-session-form.ts);
    // isFieldEmpty intentionally excluded to prevent re-trigger loops on unrelated field changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forecastData, forecastLoading, mode, formState.selectedBeachId, formState.selectedDate, formState.selectedTime]);

  // Photo upload helpers
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return "Only JPEG, PNG, and WebP images are allowed";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "File size must be less than 10MB";
    }
    return null;
  };

  const processFiles = useCallback(
    async (fileList: FileList) => {
      setIsProcessing(true);
      const newFiles: File[] = [];
      const newPreviews: FilePreview[] = [];
      const errors: string[] = [];

      // Check total file count
      if (selectedPhotos.length + fileList.length > MAX_PHOTOS) {
        setPhotoError(`Maximum ${MAX_PHOTOS} photos allowed per session`);
        setIsProcessing(false);
        return;
      }

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const validationError = validateFile(file);

        if (validationError) {
          errors.push(`${file.name}: ${validationError}`);
          continue;
        }

        const preview: FilePreview = {
          file,
          url: URL.createObjectURL(file),
          id: `${Date.now()}-${i}`,
          originalSize: file.size,
        };

        newFiles.push(file);
        newPreviews.push(preview);
      }

      if (errors.length > 0) {
        setPhotoError(errors.join(", "));
      } else {
        setPhotoError(null);
      }

      if (newFiles.length > 0) {
        const updatedFiles = [...selectedPhotos, ...newFiles];
        const updatedPreviews = [...filePreviews, ...newPreviews];

        onPhotosChange(updatedFiles);
        setFilePreviews(updatedPreviews);
      }

      setIsProcessing(false);
    },
    [selectedPhotos, filePreviews, onPhotosChange]
  );

  const removeFile = (fileId: string) => {
    const previewIndex = filePreviews.findIndex((p) => p.id === fileId);
    if (previewIndex === -1) return;

    // Clean up object URL
    URL.revokeObjectURL(filePreviews[previewIndex].url);

    // Remove from both arrays
    const updatedPreviews = filePreviews.filter((p) => p.id !== fileId);
    const updatedFiles = selectedPhotos.filter(
      (_, index) => index !== previewIndex
    );

    setFilePreviews(updatedPreviews);
    onPhotosChange(updatedFiles);
  };

  const clearAllPhotos = () => {
    filePreviews.forEach((p) => URL.revokeObjectURL(p.url));
    setFilePreviews([]);
    onPhotosChange([]);
    setPhotoError(null);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (isProcessing) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        processFiles(files);
      }
    },
    [isProcessing, processFiles]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || isProcessing) return;
    processFiles(e.target.files);
  };

  // Only render in log mode
  if (mode !== "log") {
    return null;
  }

  return (
    <SimpleCardLayout
      title={
        <div className="flex items-center">
          <Activity className="w-5 h-5 mr-2 text-primary" />
          Session Details
        </div>
      }
      description="Rate conditions, add photos, and share your experience"
    >
      <div className="space-y-8">
        {/* SECTION 1: Duration Input */}
        <div>
          <label
            className="mb-2 block text-sm font-medium"
            htmlFor="duration-input"
          >
            Session Duration
          </label>
          <Input
            id="duration-input"
            type="text"
            placeholder="e.g., 60m, 1h 30m, 2h"
            value={formState.duration}
            onChange={(e) => updateField("duration", e.target.value)}
            aria-describedby="duration-help"
          />
          <p id="duration-help" className="text-xs text-muted-foreground mt-1">
            Enter duration like &quot;60m&quot;, &quot;1h 30m&quot;, or
            &quot;2h&quot;
          </p>
        </div>

        {/* SECTION 2: Forecast Comparison */}
        {forecastLoading ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-300 rounded w-1/3 mb-2"></div>
              <div className="grid grid-cols-3 gap-3">
                <div className="h-3 bg-gray-300 rounded"></div>
                <div className="h-3 bg-gray-300 rounded"></div>
                <div className="h-3 bg-gray-300 rounded"></div>
              </div>
            </div>
          </div>
        ) : forecastData &&
          formState.selectedBeachId &&
          formState.selectedDate ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">
              Forecast from Your Session
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              {Number.isFinite(forecastData.wave_height) && (
                <div className="flex items-center gap-2">
                  <span role="img" aria-label="Wave height" className="text-base leading-none">🌊</span>
                  <span>{forecastData.wave_height_range || `${forecastData.wave_height}ft`} waves</span>
                </div>
              )}
              {Number.isFinite(forecastData.wind_speed) && (
                <div className="flex items-center gap-2">
                  <Wind className="h-4 w-4 text-blue-600" />
                  <span>
                    {forecastData.wind_speed}{" "}
                    {forecastData.wind_direction || ""}
                  </span>
                </div>
              )}
              {Number.isFinite(forecastData.water_temp) && (
                <div className="flex items-center gap-2">
                  <Thermometer className="h-4 w-4 text-blue-600" />
                  <span>{forecastData.water_temp} water</span>
                </div>
              )}
            </div>
          </div>
        ) : formState.selectedDate && formState.selectedBeachId ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 className="font-medium text-amber-900 mb-2">
              Forecast from Your Session
            </h4>
            <p className="text-sm text-amber-700">
              {forecastError?.includes("historical")
                ? "Historical forecast data not available - but your report will help the community!"
                : "No forecast data available for this date/time. You can still report conditions to help the community!"}
            </p>
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-700 mb-2">
              Forecast from Your Session
            </h4>
            <p className="text-sm text-gray-600">
              Select a beach and date to see forecast data. You can still fill
              in the fields below.
            </p>
          </div>
        )}

        {/* SECTION 3: Wave Conditions */}
        <div className="space-y-6">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Wave Conditions
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Wave Height */}
            <div>
              <label
                className="mb-2 flex items-center gap-2 text-sm font-medium"
                htmlFor="wave-height-input"
              >
                <span role="img" aria-label="Wave height" className="text-base leading-none">🌊</span>
                Wave Height (ft)
              </label>
              <Input
                id="wave-height-input"
                type="number"
                step="0.1"
                min="0"
                max="50"
                placeholder="3.5"
                value={formState.waveHeight || ""}
                onChange={(e) =>
                  handleFieldUpdate(
                    "waveHeight",
                    e.target.value ? parseFloat(e.target.value) : undefined
                  )
                }
                aria-describedby={
                  formState.waveHeight != null && formState.waveHeight > 0
                    ? "wave-height-range-hint"
                    : undefined
                }
              />
              {formState.waveHeight != null && formState.waveHeight > 0 && (
                <p id="wave-height-range-hint" className="text-xs text-muted-foreground mt-1">
                  Estimated range:{" "}
                  {formatWaveHeightRangeString(
                    formState.waveHeight,
                    formState.waveHeight * SET_WAVE_VARIANCE
                  )}
                </p>
              )}
            </div>

            {/* Water Temperature */}
            <div>
              <label
                className="mb-2 flex items-center gap-2 text-sm font-medium"
                htmlFor="water-temp-input"
              >
                <Thermometer className="h-4 w-4" />
                Water Temp (°F)
              </label>
              <Input
                id="water-temp-input"
                type="number"
                min="32"
                max="100"
                placeholder="68"
                value={formState.waterTemp}
                onChange={(e) => handleFieldUpdate("waterTemp", e.target.value)}
              />
            </div>

            {/* Wind Speed */}
            <div>
              <label
                className="mb-2 flex items-center gap-2 text-sm font-medium"
                htmlFor="wind-speed-input"
              >
                <Wind className="h-4 w-4" />
                Wind Speed (mph)
              </label>
              <Input
                id="wind-speed-input"
                type="number"
                step="0.1"
                min="0"
                max="150"
                placeholder="10"
                value={formState.windSpeed || ""}
                onChange={(e) =>
                  handleFieldUpdate(
                    "windSpeed",
                    e.target.value ? parseFloat(e.target.value) : undefined
                  )
                }
              />
            </div>

            {/* Wind Direction */}
            <div>
              <span
                id="wind-direction-label"
                className="mb-2 block text-sm font-medium"
              >
                Wind Direction
              </span>
              <Select
                value={formState.windDirection || ""}
                onValueChange={(value) => handleFieldUpdate("windDirection", value)}
              >
                <SelectTrigger aria-labelledby="wind-direction-label">
                  <SelectValue placeholder="Select direction" />
                </SelectTrigger>
                <SelectContent>
                  {WIND_DIRECTIONS.map((direction) => (
                    <SelectItem key={direction.value} value={direction.value}>
                      {direction.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Wave Types */}
          <div>
            <WaveTypeSelector
              selectedTypes={formState.waveTypes}
              onChange={(types) => updateField("waveTypes", types)}
            />
          </div>
        </div>

        {/* SECTION 4: Experience Ratings */}
        <div className="space-y-6">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Session Experience
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Wave Quality */}
            <RatingInput
              label="Wave Quality"
              icon={Star}
              value={formState.waveQuality}
              onChange={(value) => updateField("waveQuality", value)}
              colorClass="text-yellow-500"
              ratingType="waveQuality"
              emptyText="Rate the waves"
            />

            {/* Parking Ease */}
            <RatingInput
              label="Parking Ease"
              icon={Car}
              value={formState.parkingEase}
              onChange={(value) => updateField("parkingEase", value)}
              colorClass="text-green-500"
              ratingType="parkingEase"
              emptyText="How easy to park?"
            />

            {/* Crowd Level */}
            <RatingInput
              label="Crowd Level"
              icon={Users}
              value={formState.crowdLevel}
              onChange={(value) => updateField("crowdLevel", value)}
              colorClass="text-orange-500"
              ratingType="crowdLevel"
              emptyText="How crowded?"
            />
          </div>
        </div>

        {/* SECTION 5: Forecast Accuracy */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Was the forecast accurate?
          </h3>

          <div className="grid grid-cols-3 gap-3">
            {FORECAST_ACCURACY_OPTIONS.map((option) => {
              const IconComponent = option.icon;
              const isSelected = formState.forecastAccuracy === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    updateField(
                      "forecastAccuracy",
                      option.value as "accurate" | "somewhat" | "inaccurate"
                    )
                  }
                  className={`p-4 rounded-lg border-2 transition-all ${
                    isSelected
                      ? "border-blue-500 bg-blue-50"
                      : `border-gray-200 ${option.bgColor}`
                  }`}
                  aria-label={`${option.label}: ${option.description}`}
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

        {/* SECTION 6: Photo Upload */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Session Photos (Optional)
          </h3>

          {/* Upload Area */}
          <Card
            className={cn(
              "border-2 border-dashed transition-colors cursor-pointer",
              isDragging && "border-primary bg-primary/5",
              isProcessing && "opacity-50 cursor-not-allowed"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isProcessing && fileInputRef.current?.click()}
          >
            <CardContent className="flex flex-col items-center justify-center py-8 px-4">
              <div className="p-3 rounded-full bg-primary/10 mb-4">
                {isProcessing ? (
                  <Loader2 className="h-6 w-6 text-primary animate-spin" />
                ) : filePreviews.length > 0 ? (
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                ) : (
                  <Camera className="h-6 w-6 text-primary" />
                )}
              </div>

              <div className="text-center space-y-1">
                <p className="text-sm font-medium">
                  {isProcessing
                    ? "Processing photos..."
                    : filePreviews.length > 0
                    ? `${filePreviews.length} photo(s) selected`
                    : "Add session photos"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Drag and drop or click to browse • Max {MAX_PHOTOS} photos •
                  JPEG, PNG, WebP
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                disabled={isProcessing}
              >
                <Upload className="h-4 w-4 mr-2" />
                Choose Files
              </Button>
            </CardContent>
          </Card>

          {/* File Input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ALLOWED_TYPES.join(",")}
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Error Display */}
          {photoError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{photoError}</AlertDescription>
            </Alert>
          )}

          {/* File Previews */}
          {filePreviews.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Selected Photos</h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearAllPhotos}
                >
                  Clear All
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filePreviews.map((filePreview) => (
                  <div key={filePreview.id} className="relative group">
                    <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={filePreview.url}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeFile(filePreview.id)}
                      aria-label={`Remove ${filePreview.file.name}`}
                    >
                      <X className="h-3 w-3" />
                    </Button>

                    <div className="mt-1 text-xs text-muted-foreground">
                      <div className="truncate">{filePreview.file.name}</div>
                      <div>{formatFileSize(filePreview.originalSize)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* SECTION 7: Session Notes */}
        <div>
          <label className="mb-2 block text-sm font-medium" htmlFor="notes">
            Session Notes
          </label>
          <Textarea
            id="notes"
            placeholder="Share your experience, memorable moments, conditions, etc..."
            className="min-h-[100px]"
            value={formState.notes}
            onChange={(e) => updateField("notes", e.target.value)}
            maxLength={2000}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Include wave details, new skills learned, or local knowledge to help
            other surfers
          </p>
        </div>

        {/* Community Contribution Message */}
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-xs text-blue-700 text-center">
            💡 Your condition reports help improve forecasts and assist other
            surfers
          </p>
        </div>
      </div>
    </SimpleCardLayout>
  );
}
