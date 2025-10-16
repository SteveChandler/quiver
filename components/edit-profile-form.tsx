"use client";

import type React from "react";

import { useState, useRef, useEffect, startTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, X, Camera } from "lucide-react";
import { updateProfile } from "@/actions/profile-actions";
import { useAuth } from "@/context/auth-context";
import { toastUtils } from "@/lib/utils/toast-utils";
import { uploadImage, deleteImage } from "@/lib/image-upload";
import { toast } from "@/components/ui/use-toast";
import { BeachSelector } from "@/components/BeachSelector";
import { useProfile } from "@/lib/hooks/useProfile";
import { track, slugify } from "@/lib/analytics";
import { NotificationsSection } from "@/components/profile/notifications-section";

const profileFormSchema = z.object({
  full_name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be less than 50 characters"),
  bio: z.string().max(300, "Bio must be less than 300 characters").optional(),
  location: z
    .string()
    .max(100, "Location must be less than 100 characters")
    .optional(),
  experience_level: z
    .string()
    .max(50, "Experience level must be less than 50 characters")
    .optional(),
  instagram: z
    .string()
    .max(30, "Instagram username must be less than 30 characters")
    .optional(),
  home_beach_id: z.string().uuid().nullable().optional(),
  // Notification preferences - master toggles
  notif_push_enabled: z.boolean().optional(),
  notif_email_enabled: z.boolean().optional(),
  notif_inapp_enabled: z.boolean().optional(),
  // Notification preferences - feature toggles
  notif_session_invites: z.boolean().optional(),
  notif_likes: z.boolean().optional(),
  notif_follows: z.boolean().optional(),
  notif_reminders: z.boolean().optional(),
  notif_xp_updates: z.boolean().optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

interface EditProfileFormProps {
  initialData?: {
    full_name?: string;
    bio?: string;
    location?: string;
    experience_level?: string;
    instagram?: string;
    avatar_url?: string;
    home_beach_id?: string;
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(initialData?.avatar_url || "");
  const [isUploading, setIsUploading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [homeBeachText, setHomeBeachText] = useState("");
  // Remove immediate update for home beach; save on form submit
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      full_name: initialData?.full_name || "",
      bio: initialData?.bio || "",
      location: initialData?.location || "",
      experience_level: initialData?.experience_level || "",
      instagram: initialData?.instagram || "",
      home_beach_id: initialData?.home_beach_id ?? null,
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

  // Handle success callback in useEffect to avoid state updates during render
  useEffect(() => {
    if (submitSuccess && onSuccess) {
      // Reset success state and call callback
      setSubmitSuccess(false);
      onSuccess();
    }
  }, [submitSuccess, onSuccess]);

  // RHF controls the field directly; no shadow state

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
      const includeAvatar =
        !!avatarUrl &&
        avatarUrl.trim() !== "" &&
        !avatarUrl.includes("placeholder.svg");

      const result = await updateProfile({
        ...data,
        ...(homeBeachText && !data.home_beach_id
          ? { home_beach_text: homeBeachText }
          : {}),
        ...(includeAvatar ? { avatar_url: avatarUrl.trim() } : {}),
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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    // Check file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    let uploadSuccess = false;

    try {
      // First, upload the new image
      const result = await uploadImage(file, "avatars", "profiles");

      if (!result.success) {
        throw new Error(result.error || "Failed to upload image");
      }
      uploadSuccess = true;

      // Persist the avatar change immediately so profile views see it
      const persisted = await updateProfile({ avatar_url: result.url });
      if (!persisted.success) {
        throw new Error(persisted.error || "Failed to save profile picture");
      }

      // Only delete old image after successful upload + DB update
      if (avatarUrl && !avatarUrl.includes("placeholder.svg")) {
        try {
          await deleteImage(avatarUrl, "avatars");
        } catch (deleteError) {
          console.warn(
            "Failed to delete old image, but new image uploaded successfully:",
            deleteError
          );
        }
      }

      // Update the local avatar URL for immediate UI feedback
      setAvatarUrl(result.url);

      toast({
        title: "Profile picture updated",
        description: "Your profile picture has been updated successfully.",
      });
    } catch (error) {
      console.error("Error uploading avatar:", error);

      // Only show error if upload actually failed
      if (!uploadSuccess) {
        toast({
          title: "Upload failed",
          description:
            error instanceof Error
              ? error.message
              : "Failed to upload image. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsUploading(false);
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveAvatar = async () => {
    if (!avatarUrl || avatarUrl.includes("placeholder.svg")) return;

    setIsUploading(true);
    try {
      // Delete the image
      await deleteImage(avatarUrl, "avatars");

      // Persist removal in DB
      const persisted = await updateProfile({ avatar_url: "" });
      if (!persisted.success) {
        throw new Error(persisted.error || "Failed to remove profile picture");
      }

      // Set to placeholder locally
      setAvatarUrl("/placeholder.svg?height=200&width=200");
      toast({
        title: "Image removed",
        description: "Your profile picture has been removed.",
      });
    } catch (error) {
      console.error("Error removing avatar:", error);
      toast({
        title: "Error",
        description: "Failed to remove image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Get initials for avatar fallback
  const getInitials = () => {
    const name = form.getValues("full_name");
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

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
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <Avatar className="h-24 w-24">
                  <AvatarImage
                    src={avatarUrl || "/placeholder.svg?height=96&width=96"}
                    alt="Profile"
                  />
                  <AvatarFallback>{getInitials()}</AvatarFallback>
                </Avatar>
                {isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full">
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                  </div>
                )}
                {avatarUrl && !avatarUrl.includes("placeholder.svg") && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                    onClick={handleRemoveAvatar}
                    disabled={isUploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Change Photo
                </Button>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  disabled={isUploading}
                />
              </div>
            </div>

            {/* Basic Info */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bio</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Tell us about yourself and your surfing journey"
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input placeholder="Where are you based?" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Surf Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Surf Information</h3>

              <div className="space-y-2">
                <label className="text-sm font-medium">Home Beach</label>
                <BeachSelector
                  initialValue={homeBeachText}
                  onBeachSelected={(beach) => {
                    // If a real beach was selected, set the id; else keep text fallback
                    if (beach?.id) {
                      form.setValue("home_beach_id", beach.id);
                      setHomeBeachText(beach.name);
                    } else {
                      form.setValue("home_beach_id", null);
                      setHomeBeachText(beach?.name || "");
                    }
                  }}
                />
                <p className="text-sm text-muted-foreground">
                  This beach will be shown on your home screen and pre-selected
                  when logging sessions
                </p>
              </div>

              <FormField
                control={form.control}
                name="experience_level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Experience Level</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Beginner, Intermediate, Advanced, etc."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Notifications */}
            <NotificationsSection control={form.control} />

            {/* Social Media */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Social Media</h3>

              <FormField
                control={form.control}
                name="instagram"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instagram</FormLabel>
                    <FormControl>
                      <Input placeholder="@yourusername" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
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
