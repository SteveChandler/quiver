import { NextResponse } from "next/server";

const packageName = process.env.ANDROID_APP_PACKAGE ?? "app.quiversurf.mobile";
const fingerprintEnv = process.env.ANDROID_SHA256_FINGERPRINTS ?? "";
const sha256Fingerprints = fingerprintEnv
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

export const revalidate = 3600;

export function GET() {
  const body = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app" as const,
        package_name: packageName,
        sha256_cert_fingerprints: sha256Fingerprints,
      },
    },
  ];

  return NextResponse.json(body, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
