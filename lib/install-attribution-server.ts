import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { ANDROID_PLAY_STORE_LISTING_URL } from "@/lib/constants/app-store";

const OPAQUE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function isInstallAttributionIssuanceEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.INSTALL_ATTRIBUTION_ISSUANCE_ENABLED === "true";
}

export function isInstallAttributionRedemptionEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.INSTALL_ATTRIBUTION_REDEMPTION_ENABLED === "true";
}

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
  const url = new URL(ANDROID_PLAY_STORE_LISTING_URL);
  url.searchParams.set("referrer", token);
  return url.toString();
}
