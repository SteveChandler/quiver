"use client";
import { createRouteError } from "@/components/error-boundaries/create-route-error";
export default createRouteError({ tier: 'tier_2', boundaryType: 'route', route: 'auth', title: 'Authentication Error', description: 'We encountered a problem with authentication. Please try signing in again.' });
