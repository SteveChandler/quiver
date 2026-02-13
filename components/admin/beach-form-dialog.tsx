"use client";

/**
 * Beach Form Dialog Component
 *
 * Modal form for creating and editing beaches in the admin portal.
 * Uses react-hook-form with Zod validation and shadcn/ui components.
 */

import { useEffect, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import mapboxgl from "mapbox-gl";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import {
  FormInput,
  FormNumberInput,
  FormSelect,
  FormCheckbox,
} from "@/components/ui/form-fields";

import {
  beachFormSchema,
  type BeachFormData,
} from "@/lib/validation/admin/beach-schema";
import type { Beach } from "@/types/database";
import { getBeachLocation } from "@/lib/utils/beach-card-utils";

// ---------------------------------------------------------------------------
// PinEditor - draggable map marker for precise coordinate placement
// ---------------------------------------------------------------------------

function PinEditor({
  latitude,
  longitude,
  onPositionChange,
}: {
  latitude: number | null;
  longitude: number | null;
  onPositionChange: (lat: number, lon: number) => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  const hasCoords =
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    !Number.isNaN(latitude) &&
    !Number.isNaN(longitude);

  // Stable callback ref so the marker dragend handler never goes stale
  const onPositionChangeRef = useRef(onPositionChange);
  useEffect(() => {
    onPositionChangeRef.current = onPositionChange;
  }, [onPositionChange]);

  // Create / destroy the map
  useEffect(() => {
    if (!hasCoords || !mapContainerRef.current) return;

    mapboxgl.accessToken =
      process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [longitude!, latitude!],
      zoom: 15,
      attributionControl: false,
    });

    const marker = new mapboxgl.Marker({
      draggable: true,
      color: "#3b82f6", // blue-500
    })
      .setLngLat([longitude!, latitude!])
      .addTo(map);

    marker.on("dragend", () => {
      const lngLat = marker.getLngLat();
      onPositionChangeRef.current(
        parseFloat(lngLat.lat.toFixed(6)),
        parseFloat(lngLat.lng.toFixed(6))
      );
    });

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      marker.remove();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // We intentionally only run on mount / when coordinates become available.
    // The marker position is synced via the separate effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCoords]);

  // Keep marker + map center in sync when the form inputs change externally
  const syncMarker = useCallback(() => {
    if (
      !mapRef.current ||
      !markerRef.current ||
      typeof latitude !== "number" ||
      typeof longitude !== "number"
    )
      return;

    const current = markerRef.current.getLngLat();
    if (
      Math.abs(current.lat - latitude) > 0.000001 ||
      Math.abs(current.lng - longitude) > 0.000001
    ) {
      markerRef.current.setLngLat([longitude, latitude]);
      mapRef.current.flyTo({ center: [longitude, latitude], duration: 400 });
    }
  }, [latitude, longitude]);

  useEffect(() => {
    syncMarker();
  }, [syncMarker]);

  if (!hasCoords) {
    return (
      <div className="flex h-[250px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        Set coordinates above to enable pin editor
      </div>
    );
  }

  return (
    <div
      ref={mapContainerRef}
      className="h-[250px] w-full rounded-md border"
    />
  );
}

// ---------------------------------------------------------------------------

interface BeachFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  beach?: Beach | null;
  onSubmit: (data: BeachFormData) => Promise<void>;
  loading?: boolean;
}

export function BeachFormDialog({
  open,
  onOpenChange,
  beach,
  onSubmit,
  loading = false,
}: BeachFormDialogProps) {
  const isEditing = !!beach;

  const form = useForm<BeachFormData>({
    resolver: zodResolver(beachFormSchema) as any,
    defaultValues: {
      name: "",
      location: "",
      region: "",
      country: "",
      latitude: null,
      longitude: null,
      break_type: null,
      skill_level: null,
      is_private: false,
      hazards: [],
    },
  });

  // Reset form when beach changes or dialog opens
  useEffect(() => {
    if (open) {
      if (beach) {
        form.reset({
          name: beach.name || "",
          location: getBeachLocation(beach),
          region: beach.region || "",
          country: beach.country || "",
          latitude: beach.lat,
          longitude: beach.lon,
          break_type: beach.break_type as any,
          skill_level: beach.skill_level as any,
          is_private: beach.is_private || false,
          hazards: beach.hazards || [],
        });
      } else {
        form.reset({
          name: "",
          location: "",
          region: "",
          country: "",
          latitude: null,
          longitude: null,
          break_type: null,
          skill_level: null,
          is_private: false,
          hazards: [],
        });
      }
    }
  }, [open, beach, form]);

  const handleSubmit = async (data: BeachFormData) => {
    await onSubmit(data);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Beach" : "Create New Beach"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update beach information. Changes will be logged in the audit trail."
              : "Add a new beach to the system. All fields except name and region are optional."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit as any)}
            className="space-y-6"
          >
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Basic Information
              </h3>

              <FormInput<BeachFormData>
                control={form.control as any}
                name="name"
                label="Beach Name *"
                placeholder="e.g., Malibu Surfrider Beach"
              />

              <div className="grid grid-cols-2 gap-4">
                <FormInput<BeachFormData>
                  control={form.control as any}
                  name="location"
                  label="Location (City/Area)"
                  placeholder="e.g., Malibu"
                />

                <FormInput<BeachFormData>
                  control={form.control as any}
                  name="region"
                  label="Region *"
                  placeholder="e.g., Southern California"
                />
              </div>

              <FormInput<BeachFormData>
                control={form.control as any}
                name="country"
                label="Country"
                placeholder="e.g., USA"
              />
            </div>

            {/* Location Coordinates */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Coordinates
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <FormNumberInput<BeachFormData>
                  control={form.control as any}
                  name="latitude"
                  label="Latitude"
                  placeholder="e.g., 34.0259"
                />

                <FormNumberInput<BeachFormData>
                  control={form.control as any}
                  name="longitude"
                  label="Longitude"
                  placeholder="e.g., -118.7798"
                />
              </div>

              <PinEditor
                latitude={form.watch("latitude") ?? null}
                longitude={form.watch("longitude") ?? null}
                onPositionChange={(lat, lon) => {
                  form.setValue("latitude", lat, { shouldDirty: true });
                  form.setValue("longitude", lon, { shouldDirty: true });
                }}
              />
            </div>

            {/* Beach Characteristics */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Characteristics
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <FormSelect<BeachFormData>
                  control={form.control as any}
                  name="break_type"
                  label="Break Type"
                  placeholder="Select break type"
                  options={[
                    { value: "beach", label: "Beach Break" },
                    { value: "point", label: "Point Break" },
                    { value: "reef", label: "Reef Break" },
                    { value: "river", label: "River Mouth" },
                    { value: "other", label: "Other" },
                  ]}
                />

                <FormSelect<BeachFormData>
                  control={form.control as any}
                  name="skill_level"
                  label="Skill Level"
                  placeholder="Select skill level"
                  options={[
                    { value: "beginner", label: "Beginner" },
                    { value: "intermediate", label: "Intermediate" },
                    { value: "advanced", label: "Advanced" },
                    { value: "expert", label: "Expert" },
                  ]}
                />
              </div>

              <FormCheckbox<BeachFormData>
                control={form.control as any}
                name="is_private"
                label="Private Beach"
                description="Mark this beach as private or requiring special access"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Update Beach" : "Create Beach"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
