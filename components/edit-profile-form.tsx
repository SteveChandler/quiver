"use client";

import type React from "react";

import { useState, useRef } from "react";
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
  favorite_spot: z
    .string()
    .max(100, "Default spot must be less than 100 characters")
    .optional(),
  instagram: z
    .string()
    .max(100, "Instagram handle must be less than 100 characters")
    .optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

interface EditProfileFormProps {
  initialData?: {
    full_name?: string;
    bio?: string;
    location?: string;
    experience_level?: string;
    favorite_spot?: string;
    instagram?: string;
    avatar_url?: string;
  };
  onSuccess?: () => void;
}

export function EditProfileForm({
  initialData,
  onSuccess,
}: EditProfileFormProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(initialData?.avatar_url || "");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      full_name: initialData?.full_name || "",
      bio: initialData?.bio || "",
      location: initialData?.location || "",
      experience_level: initialData?.experience_level || "",
      favorite_spot: initialData?.favorite_spot || "",
      instagram: initialData?.instagram || "",
    },
  });

  async function onSubmit(data: ProfileFormValues) {
    if (!user) return;

    setIsSubmitting(true);
    try {
      const result = await updateProfile({
        ...data,
        avatar_url: avatarUrl,
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to update profile");
      }

      toastUtils.profile.updated();

      if (onSuccess) {
        onSuccess();
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

      // Only delete old image after successful upload
      if (avatarUrl && !avatarUrl.includes("placeholder.svg")) {
        try {
          await deleteImage(avatarUrl, "avatars");
        } catch (deleteError) {
          // Don't fail the whole operation if we can't delete the old image
          console.warn(
            "Failed to delete old image, but new image uploaded successfully:",
            deleteError
          );
        }
      }

      // Update the avatar URL
      setAvatarUrl(result.url);

      // Show success message
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

      // Set to placeholder
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

              <FormField
                control={form.control}
                name="favorite_spot"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Surf Spot</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Your default surf spot"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
