"use client";

import { createRouteError } from "@/components/error-boundaries/create-route-error";

export default createRouteError({
  tier: "tier_2",
  boundaryType: "route",
  route: "profile",
  title: "Profile Error",
  description: "We couldn't load your profile. Please try again.",
});
