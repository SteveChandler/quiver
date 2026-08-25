import type { Metadata } from "next";

import { MyCoastClient } from "./my-coast-client";

export const metadata: Metadata = {
  title: "My Coast | Quiver",
  description: "Current updates for the beaches and coastal topics you follow.",
};

export default function MyCoastPage() {
  return <MyCoastClient />;
}
