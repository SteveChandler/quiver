"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  Waves,
  Wind,
  Thermometer,
  Users,
} from "lucide-react";
import { submitCheckIn } from "@/actions/check-in-actions";
import { useToast } from "@/hooks/use-toast";

const checkInSchema = z.object({
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
  vibe: z.string().max(500).nullable().optional(),
  forecast_accuracy_rating: z.enum(["accurate", "somewhat", "inaccurate"]),
});

type CheckInFormData = z.infer<typeof checkInSchema>;

interface CheckInFormProps {
  beachId: string;
  beachName: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
}

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

export function CheckInForm({
  beachId,
  beachName,
  onSuccess,
  onCancel,
  className,
}: CheckInFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<CheckInFormData>({
    resolver: zodResolver(checkInSchema),
    defaultValues: {
      wave_height: null,
      wind_speed: null,
      wind_direction: null,
      water_temp: null,
      crowd_level: 3,
      vibe: "",
      forecast_accuracy_rating: "accurate",
    },
  });

  const handleSubmit = async (data: CheckInFormData) => {
    try {
      setIsSubmitting(true);

      await submitCheckIn(beachId, {
        wave_height: data.wave_height,
        wind_speed: data.wind_speed,
        wind_direction: data.wind_direction,
        water_temp: data.water_temp,
        crowd_level: data.crowd_level,
        vibe: data.vibe || null,
        forecast_accuracy_rating: data.forecast_accuracy_rating,
      });

      toast({
        title: "Check-in submitted!",
        description:
          "Thanks for helping the surf community with real-time conditions.",
      });

      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error("Error submitting check-in:", error);
      toast({
        title: "Failed to submit check-in",
        description:
          "Please try again. Make sure you're connected to the internet.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const crowdLevel = form.watch("crowd_level");
  const getCrowdLabel = (level: number | null) => {
    if (!level) return "Not specified";
    const labels = ["", "Empty", "Light", "Moderate", "Busy", "Packed"];
    return labels[level] || "Unknown";
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Waves className="h-5 w-5 text-blue-600" />
          Submit Conditions
        </CardTitle>
        <CardDescription>
          Report current surf conditions at {beachName} to help the community
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6"
          >
            {/* Surf Conditions Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Surf Conditions
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Wave Height */}
                <FormField
                  control={form.control}
                  name="wave_height"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Waves className="h-4 w-4" />
                        Wave Height (ft)
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="50"
                          placeholder="3.5"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value ? parseFloat(e.target.value) : null
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Water Temperature */}
                <FormField
                  control={form.control}
                  name="water_temp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Thermometer className="h-4 w-4" />
                        Water Temp (°F)
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="32"
                          max="100"
                          placeholder="68"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value ? parseFloat(e.target.value) : null
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Wind Speed */}
                <FormField
                  control={form.control}
                  name="wind_speed"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Wind className="h-4 w-4" />
                        Wind Speed (mph)
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="150"
                          placeholder="10"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value ? parseFloat(e.target.value) : null
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Wind Direction */}
                <FormField
                  control={form.control}
                  name="wind_direction"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Wind Direction</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select direction" />
                          </SelectTrigger>
                        </FormControl>
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
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Community Data Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Community Info
              </h3>

              {/* Crowd Level */}
              <FormField
                control={form.control}
                name="crowd_level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Crowd Level
                    </FormLabel>
                    <FormControl>
                      <div className="space-y-3">
                        <Slider
                          min={1}
                          max={5}
                          step={1}
                          value={[field.value || 3]}
                          onValueChange={(value) => field.onChange(value[0])}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Empty</span>
                          <Badge variant="outline" className="text-xs">
                            {getCrowdLabel(crowdLevel)}
                          </Badge>
                          <span>Packed</span>
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Vibe / Notes */}
              <FormField
                control={form.control}
                name="vibe"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vibe / Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="super fun, nice and glassy..."
                        className="min-h-[80px]"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Forecast Accuracy */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Was today&apos;s forecast accurate?
              </h3>

              <FormField
                control={form.control}
                name="forecast_accuracy_rating"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="grid grid-cols-3 gap-3">
                        {accuracyOptions.map((option) => {
                          const IconComponent = option.icon;
                          const isSelected = field.value === option.value;

                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => field.onChange(option.value)}
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
                                    isSelected
                                      ? "text-blue-700"
                                      : "text-gray-700"
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
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting ? "Submitting..." : "Submit Check-In"}
              </Button>
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
