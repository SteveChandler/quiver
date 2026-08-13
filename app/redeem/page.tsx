import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactElement } from "react";

import { getFirstTouchPlatform } from "@/lib/analytics/web-context";
import {
  resolveRedeemPageState,
  type RedeemPageState,
} from "@/lib/redeem/redeem-url";
import { RedeemView } from "./redeem-view";

export const metadata: Metadata = {
  title: "Redeem Quiver Pro",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function readFirstParam(
  searchParams: Awaited<SearchParams>,
  key: string,
): string | undefined {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function RedeemPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<ReactElement> {
  const params = await searchParams;
  const redeemState: RedeemPageState = resolveRedeemPageState(
    readFirstParam(params, "redeem_url"),
  );
  const platform = getFirstTouchPlatform(
    (await headers()).get("user-agent") ?? "",
  );

  return <RedeemView platform={platform} state={redeemState} />;
}
