export function validateRequired<T>(
  data: T,
  requiredFields: (keyof T)[]
): string | null {
  for (const field of requiredFields) {
    if (!data[field]) {
      return `${String(field)} is required`;
    }
  }
  return null;
}
