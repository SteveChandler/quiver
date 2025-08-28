import { z } from "zod";
import { UseFormReturn, FieldValues } from "react-hook-form";
import { toast } from "@/components/ui/use-toast";

// Common form field validation schemas
export const commonValidation = {
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be less than 50 characters"),
  phone: z.string().optional(),
  bio: z.string().max(300, "Bio must be less than 300 characters").optional(),
  location: z
    .string()
    .max(100, "Location must be less than 100 characters")
    .optional(),
  url: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
};

// Form submission utilities
export interface FormSubmissionOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
  successMessage?: string;
  errorMessage?: string;
  resetOnSuccess?: boolean;
}

export async function handleFormSubmission<T extends FieldValues>(
  form: UseFormReturn<T>,
  submitFn: (
    data: T
  ) => Promise<{ success: boolean; data?: any; error?: string }>,
  options: FormSubmissionOptions = {}
) {
  const {
    onSuccess,
    onError,
    successMessage = "Operation completed successfully",
    errorMessage = "Operation failed. Please try again.",
    resetOnSuccess = false,
  } = options;

  try {
    const result = await submitFn(form.getValues());

    if (result.success) {
      toast({
        title: "Success",
        description: successMessage,
      });

      if (resetOnSuccess) {
        form.reset();
      }

      if (onSuccess) {
        onSuccess(result.data);
      }
    } else {
      throw new Error(result.error || errorMessage);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : errorMessage;

    toast({
      title: "Error",
      description: message,
      variant: "destructive",
    });

    if (onError) {
      onError(message);
    }
  }
}

// Common form field components factory
export const createFormField = {
  text: (name: string, label: string, placeholder?: string) => ({
    name,
    label,
    placeholder,
    type: "text" as const,
  }),

  email: (name: string = "email", label: string = "Email") => ({
    name,
    label,
    placeholder: "your.email@example.com",
    type: "email" as const,
  }),

  password: (name: string = "password", label: string = "Password") => ({
    name,
    label,
    type: "password" as const,
  }),

  textarea: (name: string, label: string, placeholder?: string) => ({
    name,
    label,
    placeholder,
    type: "textarea" as const,
  }),
};

// Form validation helpers
export function validatePasswords(
  password: string,
  confirmPassword: string
): string | null {
  if (password !== confirmPassword) {
    return "Passwords do not match";
  }
  if (password.length < 6) {
    return "Password must be at least 6 characters";
  }
  return null;
}

export function validateEmail(email: string): string | null {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return "Please enter a valid email address";
  }
  return null;
}

// Common form error messages
export const formErrors = {
  required: (field: string) => `${field} is required`,
  minLength: (field: string, min: number) =>
    `${field} must be at least ${min} characters`,
  maxLength: (field: string, max: number) =>
    `${field} must be less than ${max} characters`,
  invalidEmail: "Please enter a valid email address",
  passwordMismatch: "Passwords do not match",
  weakPassword: "Password must be at least 6 characters",
  invalidUrl: "Please enter a valid URL",
  invalidPhone: "Please enter a valid phone number",
};

// Common form success messages
export const formSuccess = {
  profile: {
    updated: "Profile updated successfully",
    created: "Profile created successfully",
  },
  auth: {
    signIn: "Signed in successfully",
    signUp: "Account created successfully",
    signOut: "Signed out successfully",
  },
  session: {
    planned: "Session planned successfully",
    logged: "Session logged successfully",
    updated: "Session updated successfully",
  },
  board: {
    added: "Board added successfully",
    updated: "Board updated successfully",
    deleted: "Board deleted successfully",
  },
};
