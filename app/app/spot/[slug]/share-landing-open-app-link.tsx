"use client";

import type { ReactElement, ReactNode } from "react";

import { trackShareLandingOpenAppClick } from "@/lib/analytics/share-landing-tracking";

interface ShareLandingOpenAppLinkProps {
  href: string;
  shareId: string | null;
  className?: string;
  children: ReactNode;
}

export function ShareLandingOpenAppLink({
  href,
  shareId,
  className,
  children,
}: ShareLandingOpenAppLinkProps): ReactElement {
  return (
    <a
      href={href}
      className={className}
      onClick={() => {
        trackShareLandingOpenAppClick({ shareId, destinationUrl: href });
      }}
    >
      {children}
    </a>
  );
}
