import { NextResponse } from "next/server";

const SHA256_FINGERPRINT_PATTERN = /^(?:[A-Fa-f0-9]{2}:){31}[A-Fa-f0-9]{2}$/;

const fingerprintEnv = process.env.ANDROID_SHA256_FINGERPRINTS ?? "";

function isPlaceholderFingerprint(value: string): boolean {
  const normalized = value.trim().toUpperCase();
  if (!normalized) return true;

  return (
    normalized.includes("YOUR") ||
    normalized.includes("REPLACE") ||
    normalized.includes("PLACEHOLDER") ||
    normalized.includes("TODO") ||
    normalized === "AA:BB:CC" ||
    normalized === "11:22:33"
  );
}

function normalizeSha256Fingerprint(value: string): string | null {
  const trimmed = value.trim();
  if (isPlaceholderFingerprint(trimmed)) return null;
  if (!SHA256_FINGERPRINT_PATTERN.test(trimmed)) return null;

  return trimmed.toUpperCase();
}

const sha256Fingerprints = fingerprintEnv
  .split(",")
  .map(normalizeSha256Fingerprint)
  .filter((value): value is string => value !== null);

// Support multiple Android packages (comma-separated), falling back to singular var
const packagesEnv =
  process.env.ANDROID_APP_PACKAGES ??
  process.env.ANDROID_APP_PACKAGE ??
  "app.quiversurf.surf";
const packages = packagesEnv
  .split(",")
  .map((pkg) => pkg.trim())
  .filter(Boolean);

export const revalidate = 3600;

export function GET() {
  const body = packages.map((pkg) => ({
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app" as const,
      package_name: pkg,
      sha256_cert_fingerprints: sha256Fingerprints,
    },
  }));

  return NextResponse.json(body, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
