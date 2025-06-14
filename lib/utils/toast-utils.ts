import { toast } from "@/components/ui/use-toast";

// Success toast utilities
export const showSuccessToast = (title: string, description?: string) => {
  toast({
    title,
    description,
  });
};

// Error toast utilities
export const showErrorToast = (title: string, description?: string) => {
  toast({
    title,
    description,
    variant: "destructive",
  });
};

// Common toast patterns for specific actions
export const toastUtils = {
  profile: {
    updated: () =>
      showSuccessToast(
        "Profile updated",
        "Your profile has been updated successfully."
      ),
    updateFailed: () =>
      showErrorToast("Error", "Failed to update profile. Please try again."),
  },

  image: {
    uploaded: () =>
      showSuccessToast(
        "Image uploaded",
        "Your image has been uploaded successfully."
      ),
    removed: () =>
      showSuccessToast("Image removed", "Your image has been removed."),
    uploadFailed: () =>
      showErrorToast("Error", "Failed to upload image. Please try again."),
    tooLarge: () =>
      showErrorToast(
        "File too large",
        "Please select an image smaller than 5MB."
      ),
    invalidType: () =>
      showErrorToast("Invalid file type", "Please select an image file."),
  },

  session: {
    liked: () => showSuccessToast("Session liked"),
    unliked: () => showSuccessToast("Session unliked"),
    likeFailed: () => showErrorToast("Error", "Failed to update like status."),
  },

  board: {
    added: () =>
      showSuccessToast(
        "Board added",
        "Your board has been added to your quiver."
      ),
    updated: () =>
      showSuccessToast(
        "Board updated",
        "Your board has been updated successfully."
      ),
    deleted: () =>
      showSuccessToast(
        "Board deleted",
        "Your board has been removed from your quiver."
      ),
    actionFailed: (action: string) =>
      showErrorToast("Error", `Failed to ${action} board. Please try again.`),
  },

  favorite: {
    added: (name: string) =>
      showSuccessToast(
        "Added to favorites",
        `${name} has been added to your favorites.`
      ),
    removed: (name: string) =>
      showSuccessToast(
        "Removed from favorites",
        `${name} has been removed from your favorites.`
      ),
    actionFailed: () =>
      showErrorToast("Error", "Failed to update favorites. Please try again."),
  },
};
