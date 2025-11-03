"use client";

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
import type { Profile } from "@/types/database";
import { data as gateway } from "@/lib/data/client";
import {
  profileFormSchema,
  type ProfileFormValues,
} from "@/lib/schemas/profile-schema";
import { AvatarUpload } from "@/components/profile/shared/avatar-upload";
import { BasicInfoFields } from "@/components/profile/shared/basic-info-fields";
import { SurfInfoFields } from "@/components/profile/shared/surf-info-fields";
import { useProfileFormState } from "@/lib/hooks/useProfileFormState";
import { toastUtils } from "@/lib/utils/toast-utils";
import {
  getInitials,
  prepareAvatarPayload,
} from "@/lib/utils/profile-form-utils";

interface BasicProfileFormProps {
  userId: string;
  email: string;
  profile: Profile | null;
}

export function BasicProfileForm({
  userId,
  email,
  profile,
}: BasicProfileFormProps) {
  const router = useRouter();
  const { avatarUrl, setAvatarUrl, isSubmitting, setIsSubmitting } =
    useProfileFormState({
      initialAvatarUrl: profile?.avatar_url || "",
    });

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      full_name: profile?.full_name || "",
      email: email,
      phone_number: profile?.phone_number || "",
      bio: profile?.bio || "",
      location: profile?.location || "",
      experience_level: profile?.experience_level || "",
      instagram: profile?.instagram || "",
    },
  });

  async function onSubmit(data: ProfileFormValues) {
    if (!userId) return;

    setIsSubmitting(true);
    const emailChanged = email !== data.email;

    try {
      // First update the email in Supabase Auth if it has changed
      if (emailChanged) {
        const emailResult = await gateway.auth.updateEmail(data.email!);
        if (!emailResult?.success) {
          throw new Error(emailResult?.error || "Failed to update email");
        }
      }

      // Update the profile in the database
      const result = await updateProfile({
        full_name: data.full_name,
        phone_number: data.phone_number,
        bio: data.bio,
        location: data.location,
        experience_level: data.experience_level,
        instagram: data.instagram,
        ...prepareAvatarPayload(avatarUrl),
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to update profile");
      }

      // Show appropriate success toast
      if (emailChanged) {
        toastUtils.profile.updatedWithEmail();
      } else {
        toastUtils.profile.updated();
      }

      // Navigate to profile page with fresh data
      window.location.href = "/profile";
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
        <CardTitle>Basic Information</CardTitle>
        <CardDescription>
          Update your personal information and profile details
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
            <BasicInfoFields
              control={form.control}
              showEmail={true}
              showPhone={true}
            />

            {/* Surf Info */}
            <SurfInfoFields
              control={form.control}
              showHomeBeach={false}
              showInstagram={true}
            />
          </CardContent>
          <CardFooter className="flex justify-end space-x-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => router.push("/profile")}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
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
