import "server-only";

import { createHash, randomBytes } from "node:crypto";

const OPAQUE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const PLAY_STORE_LISTING_URL = "https://play.google.com/store/apps/details";
const ANDROID_PACKAGE_NAME = "app.quiversurf.surf";

export function createOpaqueInstallToken(): string {
  return randomBytes(32).toString("base64url");
}

export function parseOpaqueInstallToken(value: unknown): string | null {
  return typeof value === "string" && OPAQUE_TOKEN_PATTERN.test(value)
    ? value
    : null;
}

export function hashOpaqueInstallToken(token: string): string {
  return createHash("sha256").update(token, "ascii").digest("hex");
}

export function buildPlayStoreInstallUrl(token: string): string {
  const url = new URL(PLAY_STORE_LISTING_URL);
  url.searchParams.set("id", ANDROID_PACKAGE_NAME);
  url.searchParams.set("referrer", token);
  return url.toString();
}
