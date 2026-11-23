import "server-only";

export function isPublicReadSharingEnabled(): boolean {
  return process.env.PUBLIC_READ_SHARING !== "false";
}
