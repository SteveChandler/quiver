"use client";

import type React from "react";

import { startTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { updateProfile } from "@/actions/profile-actions";
import { useAuth } from "@/context/auth-context";
import { toastUtils } from "@/lib/utils/toast-utils";
import { useProfile } from "@/lib/hooks/useProfile";
import { track, slugify } from "@/lib/analytics";
import { NotificationsSection } from "@/components/profile/notifications-section";
import {
  profileFormSchema,
  type ProfileFormValues,
} from "@/lib/schemas/profile-schema";
import { AvatarUpload } from "@/components/profile/shared/avatar-upload";
import { BasicInfoFields } from "@/components/profile/shared/basic-info-fields";
import { SurfInfoFields } from "@/components/profile/shared/surf-info-fields";
import {
  useProfileFormState,
  useProfileSuccessCallback,
} from "@/lib/hooks/useProfileFormState";
import {
  getInitials,
  prepareAvatarPayload,
} from "@/lib/utils/profile-form-utils";

interface EditProfileFormProps {
  initialData?: {
    full_name?: string;
    bio?: string;
    location?: string;
    experience_level?: string;
    instagram?: string;
    avatar_url?: string;
    home_beach_id?: string;
    surf_styles?: string[];
    preferred_wave_size?: string;
    preferred_break_type?: string;
    crowd_preference?: string;
    notif_push_enabled?: boolean;
    notif_email_enabled?: boolean;
    notif_inapp_enabled?: boolean;
    notif_session_invites?: boolean;
    notif_likes?: boolean;
    notif_follows?: boolean;
    notif_reminders?: boolean;
    notif_xp_updates?: boolean;
  };
  onSuccess?: () => void;
}

export function EditProfileForm({
  initialData,
  onSuccess,
}: EditProfileFormProps) {
  const { user } = useAuth();
  const router = useRouter();
  const { profile, mutate } = useProfile();
  const {
    avatarUrl,
    setAvatarUrl,
    isSubmitting,
    setIsSubmitting,
    submitSuccess,
    setSubmitSuccess,
    homeBeachText,
    setHomeBeachText,
  } = useProfileFormState({
    initialAvatarUrl: initialData?.avatar_url || "",
    initialHomeBeachText: "",
  });

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      full_name: initialData?.full_name || "",
      bio: initialData?.bio || "",
      location: initialData?.location || "",
      experience_level: initialData?.experience_level || "",
      instagram: initialData?.instagram || "",
      home_beach_id: initialData?.home_beach_id ?? null,
      surf_styles: initialData?.surf_styles || [],
      preferred_wave_size: initialData?.preferred_wave_size || "",
      preferred_break_type: initialData?.preferred_break_type || "",
      crowd_preference: initialData?.crowd_preference || "",
      // Notification preferences - default to true if not set
      notif_push_enabled: initialData?.notif_push_enabled ?? true,
      notif_email_enabled: initialData?.notif_email_enabled ?? true,
      notif_inapp_enabled: initialData?.notif_inapp_enabled ?? true,
      notif_session_invites: initialData?.notif_session_invites ?? true,
      notif_likes: initialData?.notif_likes ?? true,
      notif_follows: initialData?.notif_follows ?? true,
      notif_reminders: initialData?.notif_reminders ?? true,
      notif_xp_updates: initialData?.notif_xp_updates ?? true,
    },
  });

  // Handle success callback using the custom hook
  useProfileSuccessCallback(submitSuccess, () => {
    setSubmitSuccess(false);
    onSuccess?.();
  });

  async function onSubmit(data: ProfileFormValues) {
    if (!user) {
      console.warn("EditProfileForm onSubmit: no user present in auth context");
      return;
    }

    console.debug("[HomeBeach/UI] submit payload", {
      home_beach_id: form.getValues("home_beach_id"),
    });
    setIsSubmitting(true);
    try {
      const result = await updateProfile({
        ...data,
        ...(homeBeachText && !data.home_beach_id
          ? { home_beach_text: homeBeachText }
          : {}),
        ...prepareAvatarPayload(avatarUrl),
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to update profile");
      }

      // Analytics: set_home_beach when a beach is selected
      try {
        if (data.home_beach_id || homeBeachText) {
          const slug = data.home_beach_id
            ? data.home_beach_id // can't resolve name here reliably
            : slugify(homeBeachText);
          track("set_home_beach", { beach_slug: slug });
        }
      } catch {}

      // Refresh profile data
      startTransition(() => mutate());

      toastUtils.profile.updated();

      if (onSuccess) {
        // Set success state to trigger useEffect callback
        setSubmitSuccess(true);
      } else {
        // Force a page refresh to clear all caches and ensure updated data is shown
        window.location.href = "/profile";
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      toastUtils.profile.updateFailed();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Profile</CardTitle>
        <CardDescription>
          Update your personal information and preferences
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            {/* Avatar Upload */}
            <AvatarUpload
              avatarUrl={avatarUrl}
              onAvatarChange={setAvatarUrl}
              initials={getInitials(form.getValues("full_name"))}
              persistImmediately={true}
            />

            {/* Basic Info */}
            <BasicInfoFields control={form.control} />

            {/* Surf Info */}
            <SurfInfoFields
              control={form.control}
              setValue={form.setValue}
              homeBeachText={homeBeachText}
              onHomeBeachTextChange={setHomeBeachText}
            />

            {/* Notifications */}
            <NotificationsSection control={form.control} />
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              variant="outline"
              type="button"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              data-testid="save-profile"
              disabled={isSubmitting}
            >
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
