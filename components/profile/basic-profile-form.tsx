"use client";

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
import { toast } from "@/components/ui/use-toast";
import { uploadImage, deleteImage } from "@/lib/image-upload";
import type { Profile } from "@/types/database";
import { createClient } from "@/lib/supabase/client";

const profileFormSchema = z.object({
  full_name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be less than 50 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone_number: z.string().optional(),
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
    .max(100, "Home Break must be less than 100 characters")
    .optional(),
  instagram: z
    .string()
    .max(30, "Instagram username must be less than 30 characters")
    .optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || "");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      full_name: profile?.full_name || "",
      email: email,
      phone_number: profile?.phone_number || "",
      bio: profile?.bio || "",
      location: profile?.location || "",
      experience_level: profile?.experience_level || "",
      favorite_spot: profile?.favorite_spot || "",
      instagram: (profile as any)?.instagram || "",
    },
  });

  async function onSubmit(data: ProfileFormValues) {
    if (!userId) return;

    setIsSubmitting(true);
    try {
      // First update the email in Supabase Auth if it has changed
      if (email !== data.email) {
        const supabase = createClient();
        const { error: emailUpdateError } = await supabase.auth.updateUser({
          email: data.email,
        });

        if (emailUpdateError) {
          throw new Error(emailUpdateError.message || "Failed to update email");
        }
      }

      // Update the profile in the database
      const result = await updateProfile({
        full_name: data.full_name,
        phone_number: data.phone_number,
        bio: data.bio,
        location: data.location,
        experience_level: data.experience_level,
        favorite_spot: data.favorite_spot,
        instagram: (data as any).instagram,
        ...(avatarUrl && avatarUrl !== "" ? { avatar_url: avatarUrl } : {}),
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to update profile");
      }

      toast({
        title: "Profile updated",
        description:
          email !== data.email
            ? "Your profile has been updated. Please check your email to confirm your new email address."
            : "Your profile has been updated successfully.",
      });

      // Navigate to profile page with fresh data
      window.location.href = "/profile";
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update profile. Please try again.",
        variant: "destructive",
      });
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
    try {
      // Delete old image if it exists and is not a placeholder
      if (avatarUrl && !avatarUrl.includes("placeholder.svg")) {
        await deleteImage(avatarUrl, "avatars");
      }

      // Upload new image
      const result = await uploadImage(file, "avatars", "profiles");
      if (!result.success) {
        throw new Error(result.error || "Failed to upload image");
      }

      setAvatarUrl(result.url);

      // Immediately update the profile with the new avatar URL
      const updateResult = await updateProfile({ avatar_url: result.url });
      if (!updateResult.success) {
        // If the profile update fails, try to delete the just-uploaded image
        await deleteImage(result.url, "avatars");
        setAvatarUrl(avatarUrl); // Revert to the old URL
        throw new Error(
          updateResult.error || "Failed to update profile picture."
        );
      }

      toast({
        title: "Image uploaded",
        description: "Your profile picture has been updated.",
      });
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast({
        title: "Error",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
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

      const placeholderUrl = "/placeholder.svg?height=200&width=200";
      setAvatarUrl(placeholderUrl);

      // Immediately update the profile
      const updateResult = await updateProfile({ avatar_url: placeholderUrl });
      if (!updateResult.success) {
        setAvatarUrl(avatarUrl); // Revert UI on failure
        throw new Error(
          updateResult.error || "Failed to remove profile picture."
        );
      }

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
        <CardTitle>Basic Information</CardTitle>
        <CardDescription>
          Update your personal information and profile details
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
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="Your email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Your phone number" {...field} />
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
                    <FormLabel>Home Break</FormLabel>
                    <FormControl>
                      <Input placeholder="Your home break" {...field} />
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
