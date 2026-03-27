import type { Metadata } from "next";
import { WelcomeScreen } from "@/components/welcome/welcome-screen";

/**
 * /welcome — First-run onboarding screen for unauthenticated users.
 *
 * Accessible via direct link but not indexed by search engines or
 * surfaced in public navigation.
 */
export const metadata: Metadata = {
  title: "Welcome to Quiver",
  description: "Get started with Quiver — the surf forecasting app that gets better every session.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function WelcomePage() {
  return <WelcomeScreen />;
}
