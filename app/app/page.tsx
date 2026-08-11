import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getFirstTouchPlatform } from "@/lib/analytics/web-context";
import { logAppHandoffLinkOpenedServer } from "@/lib/analytics/app-handoff-server";
import {
  APP_FIRST_CAMPAIGN,
  iosAppStoreUrlWithCampaign,
} from "@/lib/constants/app-handoff";
import {
  type IosAppStoreCampaign,
  IOS_APP_STORE_WEB_REDIRECT_PATH,
  resolveIosAppStoreCampaign,
} from "@/lib/constants/app-store";
import { buildAndroidBetaHandoffPath } from "@/lib/install-attribution";
import { DesktopHandoff } from "./desktop-handoff";
import { isValidUUID } from "@/lib/utils/validation";

export const metadata: Metadata = { robots: { index: false, follow: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function readFirstParam(
  searchParams: Awaited<SearchParams>,
  key: string,
): string | undefined {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

function readSource(searchParams: Awaited<SearchParams>): string {
  const value = readFirstParam(searchParams, "source");
  return value ?? "app_handoff_route";
}

function resolveHandoffId(searchParams: Awaited<SearchParams>): string {
  const handoffId = readFirstParam(searchParams, "handoff_id");
  return handoffId && isValidUUID(handoffId) ? handoffId : crypto.randomUUID();
}

function buildHandoffMetadata(
  searchParams: Awaited<SearchParams>,
  handoffId: string,
  platform: "ios" | "android" | "desktop",
  destination: {
    type: string;
    url: string;
  },
): Record<string, unknown> {
  const source = readSource(searchParams);
  const metadata: Record<string, unknown> = {
    source,
    handoff_id: handoffId,
    platform,
    destination_type: destination.type,
    destination_url: destination.url,
    handoff_channel:
      readFirstParam(searchParams, "utm_source") === "qr" ? "qr" : "link",
  };

  for (const key of [
    "surface",
    "placement",
    "qr_id",
    "target",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
  ]) {
    const value = readFirstParam(searchParams, key);
    if (value) metadata[key] = value;
  }

  return metadata;
}

function campaignFromParams(searchParams: Awaited<SearchParams>): string {
  return readFirstParam(searchParams, "utm_campaign") ?? APP_FIRST_CAMPAIGN;
}

function appStoreCampaignFromParams(
  searchParams: Awaited<SearchParams>,
): IosAppStoreCampaign {
  return resolveIosAppStoreCampaign({
    campaign: readFirstParam(searchParams, "utm_campaign"),
    medium: readFirstParam(searchParams, "utm_medium"),
    placement: readFirstParam(searchParams, "placement"),
    source: readFirstParam(searchParams, "utm_source"),
    surface: readFirstParam(searchParams, "surface"),
  });
}

function androidDestination(searchParams: Awaited<SearchParams>): {
  type: string;
  url: string;
} {
  return {
    type: "android_beta",
    url: buildAndroidBetaHandoffPath({
      source: readSource(searchParams),
      surface: readFirstParam(searchParams, "surface"),
      placement: readFirstParam(searchParams, "placement"),
      campaign: campaignFromParams(searchParams),
    }),
  };
}

export default async function AppHandoffPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const userAgent = (await headers()).get("user-agent") ?? "";
  const platform = getFirstTouchPlatform(userAgent);
  const handoffId = resolveHandoffId(sp);

  if (platform === "ios") {
    const destinationUrl = iosAppStoreUrlWithCampaign(
      appStoreCampaignFromParams(sp),
      process.env.IOS_APP_STORE_PROVIDER_TOKEN,
    );
    await logAppHandoffLinkOpenedServer({
      sessionId: handoffId,
      metadata: buildHandoffMetadata(sp, handoffId, "ios", {
        type: "app_store",
        url: destinationUrl,
      }),
    });
    redirect(destinationUrl);
  }

  if (platform === "android") {
    const destination = androidDestination(sp);
    await logAppHandoffLinkOpenedServer({
      sessionId: handoffId,
      metadata: buildHandoffMetadata(sp, handoffId, "android", destination),
    });
    redirect(destination.url);
  }

  return (
    <>
      <DesktopHandoff
        source={readSource(sp)}
        placement={readFirstParam(sp, "placement") ?? "handoff_page"}
        surface={readFirstParam(sp, "surface") ?? "app_handoff"}
        qrId={readFirstParam(sp, "qr_id")}
        target={readFirstParam(sp, "target")}
        handoffId={handoffId}
      />
      <noscript>
        <p>
          <a href={IOS_APP_STORE_WEB_REDIRECT_PATH}>
            Download Quiver on the App Store
          </a>
          {" · "}
          <a href={buildAndroidBetaHandoffPath({})}>Get the Android beta</a>
        </p>
      </noscript>
    </>
  );
}
