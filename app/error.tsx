"use client";

import { createRouteError } from "@/components/error-boundaries/create-route-error";

export default createRouteError({
  tier: "tier_1",
  boundaryType: "global",
  route: "root",
  title: "Application Error",
  description: "An unexpected error occurred in the application. Please try refreshing the page.",
});
