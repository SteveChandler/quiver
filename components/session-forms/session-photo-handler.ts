/**
 * Handles photo upload workflow for session creation.
 * Extracted from SessionForm.tsx to reduce component complexity.
 */

import { toast } from "sonner";
import { uploadSessionPhotosAction } from "@/actions/session-media-actions";

type SessionContext = "logged" | "completed";

/**
 * Upload photos for a session, showing appropriate toast messages.
 *
 * @param sessionId - The session to attach photos to
 * @param photos    - Array of File objects to upload
 * @param context   - "logged" for new sessions, "completed" for conversions
 */
export async function uploadSessionPhotos(
  sessionId: string,
  photos: File[],
  context: SessionContext
): Promise<void> {
  const successBase =
    context === "completed"
      ? "Session completed"
      : "Session logged";

  if (photos.length === 0) {
    toast.success(`${successBase} successfully!`);
    return;
  }

  try {
    const formData = new FormData();
    formData.append("fileCount", photos.length.toString());

    photos.forEach((file, index) => {
      formData.append(`file_${index}`, file);
    });

    const uploadResult = await uploadSessionPhotosAction(sessionId, formData);

    if (uploadResult.success && uploadResult.data) {
      toast.success(
        `${successBase} with ${uploadResult.data.uploaded} photo(s)!`
      );
    } else {
      toast.success(`${successBase} successfully!`);
      toast.warning("Some photos failed to upload");
    }
  } catch (photoError) {
    console.error("Photo upload error:", photoError);
    toast.success(`${successBase} successfully!`);
    toast.warning("Photos could not be uploaded");
  }
}
