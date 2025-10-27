"use client";

/**
 * Beach Form Dialog Component
 *
 * Modal form for creating and editing beaches in the admin portal.
 * Uses react-hook-form with Zod validation and shadcn/ui components.
 */

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import { beachFormSchema, type BeachFormData } from "@/lib/validation/admin/beach-schema";
import type { Beach } from "@/types/database";

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
    resolver: zodResolver(beachFormSchema),
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
          location: beach.location || "",
          region: beach.region || "",
          country: beach.country || "",
          latitude: beach.lat,
          longitude: beach.lon,
          break_type: beach.break_type,
          skill_level: beach.skill_level,
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
          <DialogTitle>{isEditing ? "Edit Beach" : "Create New Beach"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update beach information. Changes will be logged in the audit trail."
              : "Add a new beach to the system. All fields except name and region are optional."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">Basic Information</h3>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Beach Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Malibu Surfrider Beach" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location (City/Area)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Malibu" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="region"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Region *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Southern California" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., USA" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Location Coordinates */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">Coordinates</h3>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="latitude"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Latitude</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="any"
                          placeholder="e.g., 34.0259"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="longitude"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Longitude</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="any"
                          placeholder="e.g., -118.7798"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Beach Characteristics */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">Characteristics</h3>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="break_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Break Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select break type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="beach">Beach Break</SelectItem>
                          <SelectItem value="point">Point Break</SelectItem>
                          <SelectItem value="reef">Reef Break</SelectItem>
                          <SelectItem value="river">River Mouth</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="skill_level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Skill Level</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select skill level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="beginner">Beginner</SelectItem>
                          <SelectItem value="intermediate">Intermediate</SelectItem>
                          <SelectItem value="advanced">Advanced</SelectItem>
                          <SelectItem value="expert">Expert</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="is_private"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Private Beach</FormLabel>
                      <FormDescription>
                        Mark this beach as private or requiring special access
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
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
