/**
 * Utility functions for profile forms
 * Extracted from edit-profile-form and basic-profile-form to reduce duplication
 */

/**
 * Generates initials from a full name for avatar fallback
 * @param fullName - The user's full name
 * @returns Uppercase initials (max 2 characters) or "U" if no name provided
 *
 * @example
 * getInitials("John Doe") // Returns "JD"
 * getInitials("Alice") // Returns "A"
 * getInitials("") // Returns "U"
 */
export function getInitials(fullName: string | undefined | null): string {
  if (!fullName || fullName.trim() === "") {
    return "U";
  }

  const nameParts = fullName.trim().split(" ");

  if (nameParts.length === 1) {
    return nameParts[0][0].toUpperCase();
  }

  return nameParts
    .slice(0, 2) // Only take first two parts of name
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

/**
 * Checks if an avatar URL should be included in profile updates
 * Validates that the URL is not empty and not a placeholder
 *
 * @param avatarUrl - The avatar URL to validate
 * @returns true if the avatar URL should be persisted, false otherwise
 */
function shouldIncludeAvatar(avatarUrl: string | undefined | null): boolean {
  if (!avatarUrl) {
    return false;
  }

  const trimmedUrl = avatarUrl.trim();

  if (trimmedUrl === "") {
    return false;
  }

  if (trimmedUrl.includes("placeholder.svg")) {
    return false;
  }

  return true;
}

/**
 * Prepares avatar URL for profile update payload
 * Returns the URL if valid, empty object if invalid
 *
 * @param avatarUrl - The avatar URL to prepare
 * @returns Object with avatar_url property or empty object
 */
export function prepareAvatarPayload(
  avatarUrl: string | undefined | null
): { avatar_url: string } | Record<string, never> {
  if (shouldIncludeAvatar(avatarUrl)) {
    return { avatar_url: avatarUrl!.trim() };
  }
  return {};
}

/**
 * Determines the redirect URL after profile save based on context
 *
 * @param hasCallback - Whether an onSuccess callback is provided
 * @param defaultPath - Default path to redirect to (default: "/profile")
 * @returns The URL to redirect to, or null if callback will handle navigation
 */
function getRedirectUrl(
  hasCallback: boolean,
  defaultPath: string = "/profile"
): string | null {
  return hasCallback ? null : defaultPath;
}
