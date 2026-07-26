import type { Metadata } from "next";
import { Suspense } from "react";
import { AndroidBetaClient } from "./android-beta-client";

export const metadata: Metadata = {
  title: "Quiver Android Beta",
  description:
    "Join the Quiver Android closed beta through the tester group and get the latest install instructions.",
  alternates: { canonical: "/android-beta" },
};

export default function AndroidBetaPage() {
  return (
    <Suspense>
      <AndroidBetaClient />
    </Suspense>
  );
}
