"use client";

import dynamic from "next/dynamic";
import { MapFirstPaintShell } from "./map-first-paint-shell";

const MapView = dynamic(
  () => import("@/components/map-view").then((m) => m.MapView),
  {
    ssr: false,
    loading: () => <MapFirstPaintShell />,
  },
);

export function MapPageClient() {
  return <MapView />;
}
