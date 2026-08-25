import "server-only";

import { createHash, randomBytes } from "node:crypto";

import {
  isCanonicalHandoffId,
  parseHandoffContext,
} from "@/lib/beach-follow/handoff";
import { ANDROID_PLAY_STORE_LISTING_URL } from "@/lib/constants/app-store";
import type { HandoffContext } from "@/types/exact-handoff";

export interface InstallHandoffAttribution {
  handoffId: string;
  handoffContext: HandoffContext;
}

export function parseInstallHandoffAttribution(
  handoffId: unknown,
  handoffContext: unknown,
): InstallHandoffAttribution | null {
  const parsed = parseHandoffContext(handoffContext);
  return isCanonicalHandoffId(handoffId) && parsed.ok
    ? { handoffId, handoffContext: parsed.context }
    : null;
}

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
