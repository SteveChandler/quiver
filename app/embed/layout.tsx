import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Nested layout for embeddable widgets.
 *
 * Injects the light-theme CSS variable overrides that were previously applied
 * by the root layout's embed branch. The root layout no longer branches on
 * pathname (enabling ISR), so these styles live here instead. Body styles
 * (overflow:hidden, transparent background) are applied client-side via
 * EmbedBodyOverride in components/providers.tsx.
 */
export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            :root {
              --background: 0 0% 100%;
              --foreground: 222.2 84% 4.9%;
              --card: 0 0% 100%;
              --card-foreground: 222.2 84% 4.9%;
              --primary: 201 100% 36%;
              --border: 214.3 31.8% 91.4%;
              --muted: 210 40% 96.1%;
              --muted-foreground: 215.4 16.3% 46.9%;
            }
          `,
        }}
      />
      {children}
    </>
  );
}
