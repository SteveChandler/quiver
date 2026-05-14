import { NextResponse } from "next/server";

const DEFAULT_APPLE_TEAM_ID = "QBA8TA48NG";
const DEFAULT_APPLE_BUNDLE_IDS = "app.quiversurf.mobile";

const teamId = process.env.APPLE_TEAM_ID?.trim() || DEFAULT_APPLE_TEAM_ID;
const explicitAppId = process.env.APPLE_APP_ID?.trim();

const pathEnv = process.env.APPLE_APP_SITE_ASSOCIATION_PATHS ??
  "/auth/*,/sessions/*,/beach/*,/profile/*,/map*";
const requiredApplinkPaths = [
  "/auth/*",
  "/sessions/*",
  "/beach/*",
  "/profile/*",
  "/map*",
  "/invite/*",
  "/settings*",
];
const applinkPaths = Array.from(
  new Set([
    ...pathEnv
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    ...requiredApplinkPaths,
  ])
);

const webCredentialApps = (process.env.APPLE_WEB_CREDENTIALS_APP_IDS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

// Support multiple bundle IDs (comma-separated), falling back to singular var
const bundleIdsEnv = process.env.APPLE_APP_BUNDLE_IDS ??
  process.env.APPLE_APP_BUNDLE_ID ??
  DEFAULT_APPLE_BUNDLE_IDS;
const bundleIds = bundleIdsEnv.split(',').map(id => id.trim()).filter(Boolean);

export const revalidate = 3600;

export function GET() {
  const paths = applinkPaths.length > 0 ? applinkPaths : ["*"];

  // Build one applink entry per bundle ID
  const applinkDetails: { appID: string; paths: string[] }[] = bundleIds
    .map(bundleId => {
      const appId = teamId ? `${teamId}.${bundleId}` : '';
      return appId ? { appID: appId, paths } : null;
    })
    .filter((entry): entry is { appID: string; paths: string[] } => entry !== null);

  // Also include the explicit APPLE_APP_ID if set and not already covered
  if (explicitAppId && !applinkDetails.some(e => e.appID === explicitAppId)) {
    applinkDetails.push({ appID: explicitAppId, paths });
  }

  const body: Record<string, unknown> = {
    applinks: {
      apps: [] as string[],
      details: applinkDetails,
    },
  };

  if (webCredentialApps.length > 0) {
    body.webcredentials = {
      apps: webCredentialApps,
    };
  }

  return NextResponse.json(body, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
