"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
import { toast } from "@/components/ui/use-toast";
import { updateProfile } from "@/actions/profile-actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Beach, Profile } from "@/types/database";

const preferencesFormSchema = z.object({
  home_beach_id: z.string().optional(),
  notification_session_reminders: z.boolean().default(false),
  notification_community_replies: z.boolean().default(false),
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
      home_beach_id: profile?.home_beach_id || "",
      notification_session_reminders:
        profile?.notification_session_reminders || false,
      notification_community_replies:
        profile?.notification_community_replies || false,
      inapp_session_invites: (profile as any)?.inapp_session_invites ?? true,
      email_session_invites: (profile as any)?.email_session_invites ?? true,
    },
  });

  async function onSubmit(data: PreferencesFormValues) {
    if (!userId) return;

    setIsSubmitting(true);
    try {
      const result = await updateProfile({
        home_beach_id: data.home_beach_id,
        notification_session_reminders: data.notification_session_reminders,
        notification_community_replies: data.notification_community_replies,
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
      window.location.href = "/profile";
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
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select your home beach" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {beaches.map((beach) => (
                          <SelectItem key={beach.id} value={beach.id}>
                            {beach.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      This beach will be shown on your home screen and pre-selected when logging new sessions
                    </FormDescription>
                  </FormItem>
                )}
              />
            </div>

            {/* Notification Toggles */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Notification Settings</h3>

              <FormField<PreferencesFormValues>
                control={form.control}
                name="notification_session_reminders"
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
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField<PreferencesFormValues>
                control={form.control}
                name="notification_community_replies"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Community Replies
                      </FormLabel>
                      <FormDescription>
                        Get notified when someone responds to your posts or
                        reviews
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
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
                        checked={field.value}
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
                        checked={field.value}
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
