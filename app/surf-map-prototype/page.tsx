import type { Metadata } from "next";
import { SurfMapPrototype } from "@/components/map/surf-map-prototype";

export const metadata: Metadata = {
  title: "Surf Map Prototype | Quiver",
  description:
    "Prototype surf map with animated swell and wind layers for Quiver.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SurfMapPrototypePage() {
  return (
    <div className="h-[calc(100dvh-64px)] overflow-hidden bg-[#252D6B]">
      <h1 className="sr-only">Quiver Surf Map Prototype</h1>
      <SurfMapPrototype />
    </div>
  );
}
