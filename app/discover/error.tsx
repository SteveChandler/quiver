"use client";

import { createRouteError } from "@/components/error-boundaries/create-route-error";

export default createRouteError({
  tier: "tier_2",
  boundaryType: "route",
  route: "discover",
  title: "Discover Error",
  description: "We couldn't load the discover page. Please try again.",
});
