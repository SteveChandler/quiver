"use client";

import { createRouteError } from "@/components/error-boundaries/create-route-error";

export default createRouteError({
  tier: "tier_2",
  boundaryType: "route",
  route: "map",
  title: "Map Error",
  description: "We couldn't load the map. Please check your connection and try again.",
});
