import "server-only";

export function isPublicReadSharingEnabled(): boolean {
  return process.env.PUBLIC_READ_SHARING !== "false";
}

export function isPublicBeachRowCacheEnabled(): boolean {
  return process.env.PUBLIC_BEACH_ROW_CACHE !== "false";
}
