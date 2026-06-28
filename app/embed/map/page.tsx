import type { Metadata } from "next";
import { Suspense } from "react";
import { EmbedMapClient } from "./embed-map-client";

export const metadata: Metadata = {
  title: "Quiver Map Embed",
  robots: { index: false, follow: false },
};

export default function EmbedMapPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full w-full items-center justify-center bg-[#111833] text-xs font-semibold tracking-normal text-white/70">
          Loading map
        </div>
      }
    >
      <EmbedMapClient />
    </Suspense>
  );
}
