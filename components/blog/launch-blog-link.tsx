"use client";

import type { ComponentProps, MouseEventHandler } from "react";
import Link from "next/link";

import { useTrackEvent } from "@/hooks/use-track-event";
import { buildLaunchBlogLinkMetadata } from "@/lib/analytics/launch-campaign";

type LaunchBlogLinkProps = Omit<ComponentProps<typeof Link>, "href" | "onClick"> & {
  href: string;
  trackingLabel: string;
  sourceSlug: string;
  sourceSurface?: string;
  placement?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

export function LaunchBlogLink({
  href,
  trackingLabel,
  sourceSlug,
  sourceSurface = "blog-post",
  placement = "related-links",
  onClick,
  children,
  ...props
}: LaunchBlogLinkProps) {
  const { track } = useTrackEvent();

  const handleClick: MouseEventHandler<HTMLAnchorElement> = (event) => {
    onClick?.(event);
    if (event.defaultPrevented) return;

    track("cta_click", {
      metadata: buildLaunchBlogLinkMetadata({
        href,
        label: trackingLabel,
        sourceSlug,
        sourceSurface,
        placement,
      }),
      debounceMs: 0,
    });
  };

  return (
    <Link href={href} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
}
