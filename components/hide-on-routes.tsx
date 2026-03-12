"use client";

import { usePathname } from "next/navigation";

/**
 * Client-side gate that hides children on specified routes.
 *
 * Root layouts in Next.js App Router are NOT re-rendered on client-side
 * navigation, so server-side pathname checks become stale. This component
 * uses the client-side pathname to hide content that shouldn't be visible
 * after a client-side route change (e.g. hiding the footer on /map).
 */
export function HideOnRoutes({
  children,
  exact,
  prefixes,
}: {
  children: React.ReactNode;
  exact?: string[];
  prefixes?: string[];
}) {
  const pathname = usePathname();
  if (exact?.includes(pathname)) return null;
  if (prefixes?.some((p) => pathname.startsWith(p))) return null;
  return <>{children}</>;
}
