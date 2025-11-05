"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { updateProfile } from "@/actions/profile-actions";
import { BeachSelector } from "@/components/BeachSelector";
import { cn } from "@/lib/utils";
import type { Beach, Profile } from "@/types/database";

// Surf preference options (matching onboarding)
const EXPERIENCE_LEVELS = [
  { value: 'beginner', label: 'Beginner', emoji: '🏄‍♂️', description: 'Just getting started' },
  { value: 'intermediate', label: 'Intermediate', emoji: '🌊', description: 'Catching waves regularly' },
  { value: 'advanced', label: 'Advanced', emoji: '🏆', description: 'Experienced surfer' },
  { value: 'expert', label: 'Expert', emoji: '🔥', description: 'Highly skilled' },
] as const;

const SURF_STYLES = [
  { value: 'longboard', label: 'Longboard', emoji: '🏄' },
  { value: 'shortboard', label: 'Shortboard', emoji: '🏄‍♀️' },
  { value: 'funboard', label: 'Funboard', emoji: '🏄‍♂️' },
  { value: 'bodyboard', label: 'Bodyboard', emoji: '🏊' },
  { value: 'sup', label: 'SUP', emoji: '🚣' },
  { value: 'foil', label: 'Foil', emoji: '✨' },
] as const;

const WAVE_SIZES = [
  { value: 'small', label: 'Small', emoji: '🌊', description: '1-3 feet' },
  { value: 'medium', label: 'Medium', emoji: '🌊🌊', description: '3-6 feet' },
  { value: 'large', label: 'Large', emoji: '🌊🌊🌊', description: '6+ feet' },
  { value: 'any', label: 'Any Size', emoji: '🤙', description: "I'll surf anything" },
] as const;

const BREAK_TYPES = [
  { value: 'beach', label: 'Beach Break', emoji: '🏖️', description: 'Sandy bottom' },
  { value: 'point', label: 'Point Break', emoji: '🪨', description: 'Rocky point' },
  { value: 'reef', label: 'Reef Break', emoji: '🪸', description: 'Coral or rock reef' },
  { value: 'any', label: 'Any Type', emoji: '✨', description: "I'll surf anywhere" },
] as const;

const CROWD_PREFERENCES = [
  { value: 'social', label: 'Love the crew', emoji: '👥', description: 'Enjoy surfing with others' },
  { value: 'moderate', label: 'A few people is fine', emoji: '🧘', description: 'Small crowds are okay' },
  { value: 'solitude', label: 'Prefer solitude', emoji: '🏝️', description: 'Like uncrowded spots' },
] as const;

const preferencesFormSchema = z.object({
  home_beach_id: z.string().uuid().nullable().optional(),
  // Surf preferences
  experience_level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).nullable().optional(),
  surf_styles: z.array(z.string()).nullable().optional(),
  preferred_wave_size: z.enum(['small', 'medium', 'large', 'any']).nullable().optional(),
  preferred_break_type: z.enum(['beach', 'point', 'reef', 'any']).nullable().optional(),
  crowd_preference: z.enum(['social', 'moderate', 'solitude']).nullable().optional(),
  // Notification preferences
  notif_reminders: z.boolean().default(false),
  digest_session_invites: z.boolean().default(false),
  inapp_session_invites: z.boolean().default(true),
  email_session_invites: z.boolean().default(true),
});

type PreferencesFormValues = z.infer<typeof preferencesFormSchema>;

interface ProfilePreferencesProps {
  userId: string;
  profile: Profile | null;
  beaches: Beach[];
}

export function ProfilePreferences({
  userId,
  profile,
  beaches,
}: ProfilePreferencesProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PreferencesFormValues>({
    resolver: zodResolver(preferencesFormSchema),
    defaultValues: {
      home_beach_id: profile?.home_beach_id ?? null,
      // Surf preferences - cast to proper enum types
      experience_level: (profile?.experience_level as 'beginner' | 'intermediate' | 'advanced' | 'expert' | null) ?? null,
      surf_styles: profile?.surf_styles ?? [],
      preferred_wave_size: (profile?.preferred_wave_size as 'small' | 'medium' | 'large' | 'any' | null) ?? null,
      preferred_break_type: (profile?.preferred_break_type as 'beach' | 'point' | 'reef' | 'any' | null) ?? null,
      crowd_preference: (profile?.crowd_preference as 'social' | 'moderate' | 'solitude' | null) ?? null,
      // Notification preferences
      notif_reminders: profile?.notif_reminders || false,
      digest_session_invites: profile?.digest_session_invites || false,
      inapp_session_invites: profile?.inapp_session_invites ?? true,
      email_session_invites: profile?.email_session_invites ?? true,
    },
  });

  async function onSubmit(data: PreferencesFormValues) {
    if (!userId) return;

    setIsSubmitting(true);
    try {
      const result = await updateProfile({
        home_beach_id: data.home_beach_id ?? null,
        // Surf preferences
        experience_level: data.experience_level ?? null,
        surf_styles: data.surf_styles ?? [],
        preferred_wave_size: data.preferred_wave_size ?? null,
        preferred_break_type: data.preferred_break_type ?? null,
        crowd_preference: data.crowd_preference ?? null,
        // Notification preferences
        notif_reminders: data.notif_reminders,
        digest_session_invites: data.digest_session_invites,
        inapp_session_invites: data.inapp_session_invites,
        email_session_invites: data.email_session_invites,
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to update preferences");
      }

      toast({
        title: "Preferences updated",
        description: "Your profile preferences have been updated.",
      });

      // Navigate to profile page with fresh data
      router.push("/profile");
      router.refresh();
    } catch (error) {
      console.error("Error updating preferences:", error);
      toast({
        title: "Error",
        description: "Failed to update preferences. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Preferences</CardTitle>
        <CardDescription>
          Customize your surfing experience and notification settings
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            {/* Home Beach */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Home Beach Settings</h3>
              <FormField<PreferencesFormValues>
                control={form.control}
                name="home_beach_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Home Beach</FormLabel>
                    <BeachSelector
                      initialValue={""}
                      onBeachSelected={(beach) => {
                        field.onChange(beach?.id || null);
                      }}
                    />
                    <FormDescription>
                      This beach will be shown on your home screen and
                      pre-selected when logging new sessions
                    </FormDescription>
                  </FormItem>
                )}
              />
            </div>

            {/* Surf Preferences */}
            <div className="space-y-6">
              <h3 className="text-sm font-medium">Surf Preferences</h3>

              {/* Experience Level */}
              <Controller
                control={form.control}
                name="experience_level"
                render={({ field }) => (
                  <div className="space-y-2">
                    <Label>Experience Level</Label>
                    <select
                      value={field.value || ""}
                      onChange={(e) => field.onChange(e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isSubmitting}
                    >
                      <option value="">Select your experience level</option>
                      {EXPERIENCE_LEVELS.map((level) => (
                        <option key={level.value} value={level.value}>
                          {level.emoji} {level.label} - {level.description}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      How experienced are you with surfing?
                    </p>
                  </div>
                )}
              />

              {/* Surf Styles */}
              <Controller
                control={form.control}
                name="surf_styles"
                render={({ field }) => (
                  <div className="space-y-2">
                    <Label>Surf Styles (select all that apply)</Label>
                    <div className="grid grid-cols-3 gap-3">
                      {SURF_STYLES.map((style) => {
                        const isSelected = field.value?.includes(style.value) ?? false;
                        return (
                          <button
                            key={style.value}
                            type="button"
                            onClick={() => {
                              const current = field.value || [];
                              const updated = isSelected
                                ? current.filter((v) => v !== style.value)
                                : [...current, style.value];
                              field.onChange(updated);
                            }}
                            className={cn(
                              "flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all",
                              isSelected
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/50"
                            )}
                          >
                            <span className="text-2xl">{style.emoji}</span>
                            <div className="font-medium text-xs">{style.label}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              />

              {/* Wave Size */}
              <Controller
                control={form.control}
                name="preferred_wave_size"
                render={({ field }) => (
                  <div className="space-y-2">
                    <Label>Preferred Wave Size</Label>
                    <select
                      value={field.value || ""}
                      onChange={(e) => field.onChange(e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isSubmitting}
                    >
                      <option value="">Select preferred wave size</option>
                      {WAVE_SIZES.map((size) => (
                        <option key={size.value} value={size.value}>
                          {size.emoji} {size.label} - {size.description}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      What wave size do you prefer surfing?
                    </p>
                  </div>
                )}
              />

              {/* Break Type */}
              <Controller
                control={form.control}
                name="preferred_break_type"
                render={({ field }) => (
                  <div className="space-y-2">
                    <Label>Preferred Break Type</Label>
                    <select
                      value={field.value || ""}
                      onChange={(e) => field.onChange(e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isSubmitting}
                    >
                      <option value="">Select preferred break type</option>
                      {BREAK_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.emoji} {type.label} - {type.description}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      What type of break do you prefer?
                    </p>
                  </div>
                )}
              />

              {/* Crowd Preference */}
              <Controller
                control={form.control}
                name="crowd_preference"
                render={({ field }) => (
                  <div className="space-y-2">
                    <Label>Crowd Preference</Label>
                    <select
                      value={field.value || ""}
                      onChange={(e) => field.onChange(e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isSubmitting}
                    >
                      <option value="">Select crowd preference</option>
                      {CROWD_PREFERENCES.map((pref) => (
                        <option key={pref.value} value={pref.value}>
                          {pref.emoji} {pref.label} - {pref.description}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      How do you feel about crowds at the beach?
                    </p>
                  </div>
                )}
              />
            </div>

            {/* Notification Toggles */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Notification Settings</h3>

              <FormField<PreferencesFormValues>
                control={form.control}
                name="notif_reminders"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Session Reminders
                      </FormLabel>
                      <FormDescription>
                        Receive reminders to log your surf sessions
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value as boolean}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField<PreferencesFormValues>
                control={form.control}
                name="digest_session_invites"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Session Invite Digests
                      </FormLabel>
                      <FormDescription>
                        Get periodic digest of session invitations
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value as boolean}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField<PreferencesFormValues>
                control={form.control}
                name="inapp_session_invites"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        In‑app Session Invites
                      </FormLabel>
                      <FormDescription>
                        Show session invitations in your activity feed
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value as boolean}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField<PreferencesFormValues>
                control={form.control}
                name="email_session_invites"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Email Session Invites
                      </FormLabel>
                      <FormDescription>
                        Receive email when someone invites you to a surf session
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value as boolean}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isSubmitting} className="ml-auto">
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Preferences
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
