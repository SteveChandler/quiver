// Simple helpers shared by auth forms

export function validateEmail(email: string): string | null {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return "Please enter a valid email address";
  }
  return null;
}

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
