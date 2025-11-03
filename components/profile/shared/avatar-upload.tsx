"use client";

import { useState, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Loader2, X, Camera } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { uploadImage, deleteImage } from "@/lib/image-upload";
import { updateProfile } from "@/actions/profile-actions";

interface AvatarUploadProps {
  /** Current avatar URL */
  avatarUrl: string;
  /** Callback when avatar URL changes */
  onAvatarChange: (url: string) => void;
  /** Fallback initials to display */
  initials?: string;
  /** Whether to immediately persist changes to the database */
  persistImmediately?: boolean;
  /** Size of the avatar (default: 24 = 96px) */
  size?: number;
}

/**
 * Reusable avatar upload component with image validation, upload, and deletion
 * Extracted from edit-profile-form and basic-profile-form to reduce duplication
 */
export function AvatarUpload({
  avatarUrl,
  onAvatarChange,
  initials = "U",
  persistImmediately = true,
  size = 24,
}: AvatarUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      // Persist the avatar change immediately if requested
      if (persistImmediately) {
        const persisted = await updateProfile({ avatar_url: result.url });
        if (!persisted.success) {
          throw new Error(persisted.error || "Failed to save profile picture");
        }
      }

      // Only delete old image after successful upload (and DB update if persisting)
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

      // Update the avatar URL via callback
      onAvatarChange(result.url);

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

      // Persist removal in DB if requested
      if (persistImmediately) {
        const persisted = await updateProfile({ avatar_url: "" });
        if (!persisted.success) {
          throw new Error(
            persisted.error || "Failed to remove profile picture"
          );
        }
      }

      // Set to placeholder via callback
      const placeholderUrl = "/placeholder.svg?height=200&width=200";
      onAvatarChange(placeholderUrl);

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

  const avatarSizeClass = `h-${size} w-${size}`;

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative">
        <Avatar className={avatarSizeClass}>
          <AvatarImage
            src={avatarUrl || "/placeholder.svg?height=96&width=96"}
            alt="Profile"
          />
          <AvatarFallback>{initials}</AvatarFallback>
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
  );
}
