"use client";

import { usePathname } from "next/navigation";

/**
 * usePathname() for route gates that change server-rendered structure.
 *
 * Next's ISR render of the root page reports "/index" while the browser reports
 * "/". A gate that branches on "/" then renders different markup on the server
 * than on hydration, and React leaves the server-only nodes in <body> unowned
 * (e.g. a site footer that later sits above the header on /map).
 */
export function useRoutePathname(): string {
  const pathname = usePathname();
  return pathname === "/index" ? "/" : pathname;
}
