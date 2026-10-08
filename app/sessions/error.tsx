"use client";

import { createRouteError } from "@/components/error-boundaries/create-route-error";

export default createRouteError({
  tier: "tier_2",
  boundaryType: "route",
  route: "sessions",
  title: "Sessions Error",
  description: "We couldn't load your surf sessions. Please try again.",
});
