/**
 * Shared validation utilities
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validate that a string is a well-formed UUID (v4 format) */
export function isValidUUID(str: string): boolean {
  return UUID_REGEX.test(str);
}
