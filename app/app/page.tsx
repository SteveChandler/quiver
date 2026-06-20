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
  ANDROID_BETA_GROUP_URL,
  ANDROID_BETA_LANDING_PATH,
  IOS_APP_STORE_URL,
} from "@/lib/constants/app-store";
import { DesktopHandoff } from "./desktop-handoff";

export const metadata: Metadata = { robots: { index: false, follow: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function readSource(searchParams: Awaited<SearchParams>): string {
  const value = searchParams.source;
  return (Array.isArray(value) ? value[0] : value) ?? "app_handoff_route";
}

export default async function AppHandoffPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const userAgent = (await headers()).get("user-agent") ?? "";
  const platform = getFirstTouchPlatform(userAgent);
  const source = readSource(sp);

  if (platform === "ios") {
    await logAppHandoffLinkOpenedServer({
      sessionId: `app-route-${source}`,
      metadata: {
        source,
        platform: "ios",
        destination_type: "app_store",
        handoff_channel: "qr",
      },
    });
    redirect(iosAppStoreUrlWithCampaign(APP_FIRST_CAMPAIGN));
  }

  if (platform === "android") {
    await logAppHandoffLinkOpenedServer({
      sessionId: `app-route-${source}`,
      metadata: {
        source,
        platform: "android",
        destination_type: "android_waitlist",
        handoff_channel: "qr",
      },
    });
    redirect(ANDROID_BETA_LANDING_PATH);
  }

  return (
    <>
      <DesktopHandoff />
      <noscript>
        <p>
          <a href={IOS_APP_STORE_URL}>Download Quiver on the App Store</a>
          {" · "}
          <a href={ANDROID_BETA_GROUP_URL}>Join the Android waitlist</a>
        </p>
      </noscript>
    </>
  );
}
