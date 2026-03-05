import type { Metadata } from "next";
import { WelcomeScreen } from "@/components/welcome/welcome-screen";

/**
 * /welcome — Mobile app first-run onboarding screen.
 *
 * This route is primarily served inside the Capacitor shell as the
 * initial page for unauthenticated users. It is also accessible on
 * web for direct-link scenarios. It should never be indexed by search
 * engines or surfaced in public navigation.
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
