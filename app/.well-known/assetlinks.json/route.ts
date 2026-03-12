import { NextResponse } from "next/server";

const fingerprintEnv = process.env.ANDROID_SHA256_FINGERPRINTS ?? "";
const sha256Fingerprints = fingerprintEnv
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

// Support multiple Android packages (comma-separated), falling back to singular var
const packagesEnv = process.env.ANDROID_APP_PACKAGES ?? process.env.ANDROID_APP_PACKAGE ?? "app.quiversurf.mobile";
const packages = packagesEnv.split(',').map(p => p.trim()).filter(Boolean);

export const revalidate = 3600;

export function GET() {
  const body = packages.map(pkg => ({
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
