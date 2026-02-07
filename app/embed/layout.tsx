import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Minimal nested layout for embeddable widgets.
 *
 * The root layout detects /embed routes and renders a lightweight shell
 * (no Providers, nav, footer). This nested layout only adds metadata.
 */
export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
