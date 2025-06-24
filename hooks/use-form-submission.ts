import { useState, useCallback } from "react";
import { UseFormReturn } from "react-hook-form";
import { toast } from "@/components/ui/use-toast";
import { ActionResult } from "@/lib/action-utils";

/**
 * Form submission options that extend the existing form-utils patterns
 */
export interface UseFormSubmissionOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
  successMessage?: string;
  errorMessage?: string;
  resetOnSuccess?: boolean;
  showToast?: boolean;
}

/**
 * Form submission hook that provides loading/error state management
 * Builds on existing form-utils.ts patterns while adding React state management
 *
 * Usage:
 * const { isLoading, error, handleSubmit, setError, clearError } = useFormSubmission({
 *   onSuccess: (data) => router.push('/success'),
 *   successMessage: "Profile updated successfully"
 * });
 *
 * // In your form:
 * <form onSubmit={handleSubmit(submitFunction)}>
 */
export function useFormSubmission(options: UseFormSubmissionOptions = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    onSuccess,
    onError,
    successMessage = "Operation completed successfully",
    errorMessage = "Operation failed. Please try again.",
    resetOnSuccess = false,
    showToast = true,
  } = options;

  /**
   * Main submission handler that works with React Hook Form or regular functions
   */
  const handleSubmit = useCallback(
    <T>(
      submitFunction: () => Promise<ActionResult<T>>,
      form?: UseFormReturn<any>
    ) => {
      return async (e?: React.FormEvent) => {
        if (e) {
          e.preventDefault();
        }

        setError(null);
        setIsLoading(true);

        try {
          const result = await submitFunction();

          if (result.success) {
            if (showToast) {
              toast({
                title: "Success",
                description: successMessage,
              });
            }

            if (resetOnSuccess && form) {
              form.reset();
            }

            onSuccess?.(result.data);
          } else {
            const errorMsg = result.error || errorMessage;
            setError(errorMsg);

            if (showToast) {
              toast({
                title: "Error",
                description: errorMsg,
                variant: "destructive",
              });
            }

            onError?.(errorMsg);
          }
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : errorMessage;
          setError(errorMsg);

          if (showToast) {
            toast({
              title: "Error",
              description: errorMsg,
              variant: "destructive",
            });
          }

          onError?.(errorMsg);
        } finally {
          setIsLoading(false);
        }
      };
    },
    [
      successMessage,
      errorMessage,
      resetOnSuccess,
      showToast,
      onSuccess,
      onError,
    ]
  );

  /**
   * Alternative handler that works directly with React Hook Form
   */
  const handleFormSubmit = useCallback(
    <T>(
      form: UseFormReturn<any>,
      submitFunction: (data: any) => Promise<ActionResult<T>>
    ) => {
      return form.handleSubmit(async (data: any) => {
        setError(null);
        setIsLoading(true);

        try {
          const result = await submitFunction(data);

          if (result.success) {
            if (showToast) {
              toast({
                title: "Success",
                description: successMessage,
              });
            }

            if (resetOnSuccess) {
              form.reset();
            }

            onSuccess?.(result.data);
          } else {
            const errorMsg = result.error || errorMessage;
            setError(errorMsg);

            if (showToast) {
              toast({
                title: "Error",
                description: errorMsg,
                variant: "destructive",
              });
            }

            onError?.(errorMsg);
          }
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : errorMessage;
          setError(errorMsg);

          if (showToast) {
            toast({
              title: "Error",
              description: errorMsg,
              variant: "destructive",
            });
          }

          onError?.(errorMsg);
        } finally {
          setIsLoading(false);
        }
      });
    },
    [
      successMessage,
      errorMessage,
      resetOnSuccess,
      showToast,
      onSuccess,
      onError,
    ]
  );

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Manually set loading state (useful for external loading indicators)
   */
  const setLoadingState = useCallback((loading: boolean) => {
    setIsLoading(loading);
  }, []);

  return {
    isLoading,
    error,
    handleSubmit,
    handleFormSubmit,
    setError,
    clearError,
    setLoadingState,
  };
}

/**
 * Simplified hook for common form submission patterns
 * Uses your existing toast-utils.ts patterns
 */
export function useSimpleFormSubmission(successMessage?: string) {
  return useFormSubmission({
    successMessage,
    showToast: true,
    resetOnSuccess: false,
  });
}

/**
 * Hook specifically for profile/settings forms
 * Integrates with your existing toastUtils.profile patterns
 */
export function useProfileFormSubmission() {
  return useFormSubmission({
    successMessage: "Profile updated successfully",
    errorMessage: "Failed to update profile. Please try again.",
    showToast: true,
    resetOnSuccess: false,
  });
}

/**
 * Hook specifically for board management forms
 * Integrates with your existing toastUtils.board patterns
 */
export function useBoardFormSubmission() {
  return useFormSubmission({
    successMessage: "Board updated successfully",
    errorMessage: "Failed to update board. Please try again.",
    showToast: true,
    resetOnSuccess: false,
  });
}
