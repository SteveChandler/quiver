import { NextResponse } from "next/server";

const teamId = process.env.APPLE_TEAM_ID?.trim();
const bundleId = process.env.APPLE_APP_BUNDLE_ID?.trim();
const explicitAppId = process.env.APPLE_APP_ID?.trim();
const appleAppId = explicitAppId || (teamId && bundleId ? `${teamId}.${bundleId}` : "");

const pathEnv = process.env.APPLE_APP_SITE_ASSOCIATION_PATHS ?? 
  "/auth/*,/sessions/*,/beach/*,/profile/*,/map*";
const applinkPaths = pathEnv
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const webCredentialApps = (process.env.APPLE_WEB_CREDENTIALS_APP_IDS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

export const revalidate = 3600;

export function GET() {
  const applinkDetails = appleAppId
    ? [
        {
          appID: appleAppId,
          paths: applinkPaths.length > 0 ? applinkPaths : ["*"],
        },
      ]
    : [];

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
