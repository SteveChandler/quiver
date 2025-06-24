"use client";

import { useAuth } from "@/context/auth-context";
import { HomeScreen } from "@/components/home-screen";
import LandingPage from "@/components/landing-page";
import { AuthLoadingStates } from "@/lib/utils/loading-utils";

export default function ClientApp() {
  const { user, isLoading } = useAuth();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return AuthLoadingStates.checking();
  }

  // Show HomeScreen for authenticated users, LandingPage for guests
  return user ? <HomeScreen /> : <LandingPage />;
}
