import { createClient } from "@/lib/supabase/client";
import { v4 as uuidv4 } from "uuid";

export async function uploadImage(file: File, bucket: string, folder: string) {
  try {
    const supabase = createClient();

    // Create a unique file name
    const fileExt = file.name.split(".").pop();
    const fileName = `${uuidv4()}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    // Upload the file
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      throw error;
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

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
