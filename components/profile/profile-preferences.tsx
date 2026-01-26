"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { FormSwitch } from "@/components/ui/form-fields";
import { toast } from "@/components/ui/use-toast";
import { updateProfile } from "@/actions/profile-actions";
import { BeachSelector } from "@/components/BeachSelector";
import {
  ExperienceLevelField,
  SurfStylesField,
  PreferredWaveSizeField,
  PreferredBreakTypeField,
  CrowdPreferenceField,
} from "@/components/profile/shared/preference-fields";
import { createClient } from "@/lib/supabase/client";
import type { Beach, Profile } from "@/types/database";

const preferencesFormSchema = z.object({
  home_beach_id: z.string().uuid().nullable().optional(),
  // Surf preferences
  experience_level: z
    .enum(["beginner", "intermediate", "advanced", "expert"])
    .nullable()
    .optional(),
  surf_styles: z.array(z.string()).nullable().optional(),
  preferred_wave_size: z
    .enum(["small", "medium", "large", "any"])
    .nullable()
    .optional(),
  preferred_break_type: z
    .enum(["beach", "point", "reef", "any"])
    .nullable()
    .optional(),
  crowd_preference: z
    .enum(["social", "moderate", "solitude"])
    .nullable()
    .optional(),
  // Notification preferences
  notif_reminders: z.boolean().default(false),
  notif_forecast_alerts: z.boolean().default(true),
  digest_session_invites: z.boolean().default(false),
  inapp_session_invites: z.boolean().default(true),
  email_session_invites: z.boolean().default(true),
  // Privacy preferences
  allow_implicit_tracking: z.boolean().default(true),
});

type PreferencesFormValues = z.infer<typeof preferencesFormSchema>;

interface ProfilePreferencesProps {
  userId: string;
  profile: Profile | null;
  beaches: Beach[];
  onSaveComplete?: () => void;
}

export function ProfilePreferences({
  userId,
  profile,
  beaches,
  onSaveComplete,
}: ProfilePreferencesProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const form = useForm<PreferencesFormValues>({
    resolver: zodResolver(preferencesFormSchema) as any,
    defaultValues: {
      home_beach_id: profile?.home_beach_id ?? null,
      // Surf preferences - cast to proper enum types
      experience_level:
        (profile?.experience_level as
          | "beginner"
          | "intermediate"
          | "advanced"
          | "expert"
          | null) ?? null,
      surf_styles: profile?.surf_styles ?? [],
      preferred_wave_size:
        (profile?.preferred_wave_size as
          | "small"
          | "medium"
          | "large"
          | "any"
          | null) ?? null,
      preferred_break_type:
        (profile?.preferred_break_type as
          | "beach"
          | "point"
          | "reef"
          | "any"
          | null) ?? null,
      crowd_preference:
        (profile?.crowd_preference as
          | "social"
          | "moderate"
          | "solitude"
          | null) ?? null,
      // Notification preferences
      notif_reminders: profile?.notif_reminders || false,
      notif_forecast_alerts: profile?.notif_forecast_alerts ?? true,
      digest_session_invites: profile?.digest_session_invites || false,
      inapp_session_invites: profile?.inapp_session_invites ?? true,
      email_session_invites: profile?.email_session_invites ?? true,
      // Privacy preferences
      allow_implicit_tracking: (profile as any)?.allow_implicit_tracking ?? true,
    },
  });

  // Watch the allow_implicit_tracking value for conditional rendering
  const allowImplicitTracking = useWatch({
    control: form.control,
    name: "allow_implicit_tracking",
    defaultValue: true,
  });

  async function handleClearBrowsingData() {
    setIsClearing(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc('purge_implicit_history', {
        target_user_id: userId,
      });
      if (error) throw error;
      toast({
        title: 'Browsing data cleared',
        description: 'Your activity history has been deleted.',
      });
    } catch (err) {
      console.error('Error clearing browsing data:', err);
      toast({
        title: 'Failed to clear data',
        description: 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsClearing(false);
    }
  }

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
        notif_forecast_alerts: data.notif_forecast_alerts,
        digest_session_invites: data.digest_session_invites,
        inapp_session_invites: data.inapp_session_invites,
        email_session_invites: data.email_session_invites,
        // Privacy preferences (new column from implicit-preference-learning migration)
        allow_implicit_tracking: data.allow_implicit_tracking,
      } as any);

      if (!result.success) {
        throw new Error(result.error || "Failed to update preferences");
      }

      toast({
        title: "Preferences updated",
        description: "Your profile preferences have been updated.",
      });

      // Call onSaveComplete callback if provided, otherwise navigate
      if (onSaveComplete) {
        onSaveComplete();
      } else {
        // Navigate to profile page with fresh data
        router.push("/profile");
        router.refresh();
      }
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
      <Form {...(form as any)}>
        <form onSubmit={(form.handleSubmit as any)(onSubmit)}>
          <CardContent className="space-y-6">
            {/* Home Beach */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Home Beach Settings</h3>
              <FormField
                control={form.control as any}
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

              <ExperienceLevelField
                control={form.control as any}
                name="experience_level"
                disabled={isSubmitting}
              />

              <SurfStylesField
                control={form.control as any}
                name="surf_styles"
                disabled={isSubmitting}
              />

              <PreferredWaveSizeField
                control={form.control as any}
                name="preferred_wave_size"
                disabled={isSubmitting}
              />

              <PreferredBreakTypeField
                control={form.control as any}
                name="preferred_break_type"
                disabled={isSubmitting}
              />

              <CrowdPreferenceField
                control={form.control as any}
                name="crowd_preference"
                disabled={isSubmitting}
              />
            </div>

            {/* Notification Toggles */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Notification Settings</h3>

              <FormSwitch
                control={form.control as any}
                name="notif_reminders"
                label="Session Reminders"
                description="Receive reminders to log your surf sessions"
                disabled={isSubmitting}
              />

              <FormSwitch
                control={form.control as any}
                name="notif_forecast_alerts"
                label="Forecast Alerts"
                description="Get a push when your home beach forecast matches your preferences"
                disabled={isSubmitting}
              />

              <FormSwitch
                control={form.control as any}
                name="digest_session_invites"
                label="Session Invite Digests"
                description="Get periodic digest of session invitations"
                disabled={isSubmitting}
              />

              <FormSwitch
                control={form.control as any}
                name="inapp_session_invites"
                label="In‑app Session Invites"
                description="Show session invitations in your activity feed"
                disabled={isSubmitting}
              />

              <FormSwitch
                control={form.control as any}
                name="email_session_invites"
                label="Email Session Invites"
                description="Receive email when someone invites you to a surf session"
                disabled={isSubmitting}
              />
            </div>

            {/* Privacy Settings */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">Privacy</h3>
              </div>

              <FormSwitch
                control={form.control as any}
                name="allow_implicit_tracking"
                label="Improve recommendations with my activity"
                description="Uses your browsing behavior to personalize surf spot recommendations"
                disabled={isSubmitting}
              />

              {!allowImplicitTracking && (
                <div className="pl-4 border-l-2 border-muted">
                  <p className="text-sm text-muted-foreground mb-3">
                    Tracking is disabled. You can also clear your existing browsing history.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleClearBrowsingData}
                    disabled={isClearing || isSubmitting}
                  >
                    {isClearing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Clearing...
                      </>
                    ) : (
                      'Clear browsing data'
                    )}
                  </Button>
                </div>
              )}
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
