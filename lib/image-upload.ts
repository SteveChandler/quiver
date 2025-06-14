import { createClient } from "@/lib/supabase/client";

export async function uploadImage(
  file: File,
  bucket: string,
  folder: string,
  userId?: string
) {
  try {
    const supabase = createClient();

    // Get current user if userId not provided
    let currentUserId = userId;
    if (!currentUserId) {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("Authentication required");
      }
      currentUserId = user.id;
    }

    // Add file validation
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    const maxSizeInBytes = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.type)) {
      throw new Error("Invalid file type");
    }
    if (file.size > maxSizeInBytes) {
      throw new Error("File too large");
    }

    // Create a unique file name using user ID for avatars
    const fileExt = file.name.split(".").pop();
    const fileName =
      folder === "profiles"
        ? `${currentUserId}.${fileExt}`
        : `${currentUserId}/${Date.now()}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    // Upload the file
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true, // Important: allows overwriting existing files
      });

    if (error) {
      throw error;
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    console.log("Image uploaded successfully:", {
      bucket,
      filePath,
      publicUrl: urlData.publicUrl,
      urlDomain: new URL(urlData.publicUrl).hostname,
    });

    return { success: true, url: urlData.publicUrl };
  } catch (error) {
    console.error("Error uploading image:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function deleteImage(url: string, bucket: string) {
  try {
    const supabase = createClient();

    // Extract the file path from the URL
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/");
    const filePath = pathParts.slice(pathParts.indexOf(bucket) + 1).join("/");

    // Delete the file
    const { error } = await supabase.storage.from(bucket).remove([filePath]);

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (error) {
    console.error("Error deleting image:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
