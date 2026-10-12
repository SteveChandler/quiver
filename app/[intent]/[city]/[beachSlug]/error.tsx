"use client";

import { createRouteError } from "@/components/error-boundaries/create-route-error";

export default createRouteError({
  tier: "tier_2",
  boundaryType: "route",
  route: "beach-detail-intent",
  title: "Beach Details Error",
  description: "We couldn't load the beach details. Please try again or return to the home page.",
});
