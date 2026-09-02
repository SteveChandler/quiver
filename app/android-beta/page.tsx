import type { Metadata } from "next";
import { Suspense } from "react";
import { buildPageMetadata } from "@/lib/seo/meta";
import { AndroidBetaClient } from "./android-beta-client";

export const metadata: Metadata = buildPageMetadata({
  title: "Quiver Android Beta",
  description:
    "Join the Quiver Android closed beta through the tester group and get the latest install instructions.",
  path: "/android-beta",
});

export default function AndroidBetaPage() {
  const installAttributionIssuanceEnabled =
    process.env.INSTALL_ATTRIBUTION_ISSUANCE_ENABLED === "true";

  return (
    <Suspense>
      <AndroidBetaClient
        installAttributionIssuanceEnabled={
          installAttributionIssuanceEnabled
        }
      />
    </Suspense>
  );
}
