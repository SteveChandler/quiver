import { useState, useEffect } from "react";

/**
 * Configuration for profile form state management
 */
export interface ProfileFormStateConfig {
  /** Initial avatar URL */
  initialAvatarUrl?: string;
  /** Initial home beach text (for edit form) */
  initialHomeBeachText?: string;
}

/**
 * Return type for the useProfileFormState hook
 */
export interface ProfileFormState {
  /** Current avatar URL */
  avatarUrl: string;
  /** Update avatar URL */
  setAvatarUrl: (url: string) => void;
  /** Whether form is currently submitting */
  isSubmitting: boolean;
  /** Set form submitting state */
  setIsSubmitting: (submitting: boolean) => void;
  /** Success flag for triggering callbacks */
  submitSuccess: boolean;
  /** Set submit success state */
  setSubmitSuccess: (success: boolean) => void;
  /** Home beach text (for edit form) */
  homeBeachText: string;
  /** Update home beach text */
  setHomeBeachText: (text: string) => void;
}

/**
 * Custom hook for managing profile form state
 * Consolidates common state management patterns from edit-profile-form and basic-profile-form
 *
 * @param config - Configuration options
 * @returns Form state and setters
 *
 * @example
 * ```tsx
 * const {
 *   avatarUrl,
 *   setAvatarUrl,
 *   isSubmitting,
 *   setIsSubmitting
 * } = useProfileFormState({
 *   initialAvatarUrl: profile?.avatar_url
 * });
 * ```
 */
export function useProfileFormState(
  config: ProfileFormStateConfig = {}
): ProfileFormState {
  const { initialAvatarUrl = "", initialHomeBeachText = "" } = config;

  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [homeBeachText, setHomeBeachText] = useState(initialHomeBeachText);

  return {
    avatarUrl,
    setAvatarUrl,
    isSubmitting,
    setIsSubmitting,
    submitSuccess,
    setSubmitSuccess,
    homeBeachText,
    setHomeBeachText,
  };
}

/**
 * Custom hook for handling success callbacks in profile forms
 * Manages the pattern of calling onSuccess callback after successful submission
 *
 * @param submitSuccess - Flag indicating submission was successful
 * @param onSuccess - Optional callback to invoke on success
 *
 * @example
 * ```tsx
 * useProfileSuccessCallback(submitSuccess, onSuccess);
 * ```
 */
export function useProfileSuccessCallback(
  submitSuccess: boolean,
  onSuccess?: () => void
): void {
  useEffect(() => {
    if (submitSuccess && onSuccess) {
      onSuccess();
    }
  }, [submitSuccess, onSuccess]);
}
