export const LAUNCH_CAMPAIGN_ID = "go_live_2026_05";
export const LAUNCH_CONTENT_GROUP = "launch_blog";

export type LaunchDestinationType =
  | "app_store"
  | "beach"
  | "blog_post"
  | "forecast"
  | "learn"
  | "pricing"
  | "roadmap"
  | "session_log"
  | "site"
  | "external";

export interface LaunchPageMetadata {
  launch_campaign: string;
  launch_surface: string;
  launch_content_group?: string;
  blog_slug?: string;
  monetization_status?: "waitlist_until_checkout_verified";
  purchase_path_status?: "waitlist";
}

export interface LaunchBlogLinkMetadata {
  cta: "other";
  location: string;
  cta_family: "launch_blog_cross_link";
  launch_campaign: string;
  launch_content_group: string;
  source: "launch_blog";
  surface: string;
  placement: string;
  blog_slug: string;
  cta_text: string;
  destination_url: string;
  destination_path: string;
  destination_type: LaunchDestinationType;
}

function stripQueryAndHash(href: string): string {
  return href.split(/[?#]/)[0] || href;
}

function normalizeBlogSlug(pathname: string): string | null {
  const match = pathname.match(/^\/blog\/([^/?#]+)/);
  if (!match?.[1]) return null;
  return decodeURIComponent(match[1]);
}

export function getLaunchPageMetadata(
  pathname: string
): LaunchPageMetadata | null {
  if (pathname === "/") {
    return {
      launch_campaign: LAUNCH_CAMPAIGN_ID,
      launch_surface: "landing",
    };
  }

  if (pathname === "/pricing") {
    return {
      launch_campaign: LAUNCH_CAMPAIGN_ID,
      launch_surface: "pricing",
      monetization_status: "waitlist_until_checkout_verified",
      purchase_path_status: "waitlist",
    };
  }

  if (pathname === "/blog") {
    return {
      launch_campaign: LAUNCH_CAMPAIGN_ID,
      launch_surface: "blog_index",
      launch_content_group: LAUNCH_CONTENT_GROUP,
    };
  }

  const blogSlug = normalizeBlogSlug(pathname);
  if (blogSlug) {
    return {
      launch_campaign: LAUNCH_CAMPAIGN_ID,
      launch_surface: "blog_post",
      launch_content_group: LAUNCH_CONTENT_GROUP,
      blog_slug: blogSlug,
    };
  }

  return null;
}

export function getLaunchDestinationType(href: string): LaunchDestinationType {
  const path = stripQueryAndHash(href);

  if (/apps\.apple\.com|testflight\.apple\.com/.test(href)) return "app_store";
  if (path === "/pricing") return "pricing";
  if (path.startsWith("/blog/")) return "blog_post";
  if (path.startsWith("/forecast") || path === "/forecast-accuracy") {
    return "forecast";
  }
  if (path.startsWith("/sessions")) return "session_log";
  if (path.startsWith("/learn")) return "learn";
  if (path === "/roadmap") return "roadmap";
  if (/^\/[a-z]{2}\/[^/]+\/[^/]+$/.test(path)) return "beach";
  if (path.startsWith("/")) return "site";

  return "external";
}

export function buildLaunchBlogLinkMetadata({
  href,
  label,
  sourceSlug,
  sourceSurface = "blog-post",
  placement = "related-links",
}: {
  href: string;
  label: string;
  sourceSlug: string;
  sourceSurface?: string;
  placement?: string;
}): LaunchBlogLinkMetadata {
  const destinationPath = stripQueryAndHash(href);

  return {
    cta: "other",
    location: placement,
    cta_family: "launch_blog_cross_link",
    launch_campaign: LAUNCH_CAMPAIGN_ID,
    launch_content_group: LAUNCH_CONTENT_GROUP,
    source: "launch_blog",
    surface: sourceSurface,
    placement,
    blog_slug: sourceSlug,
    cta_text: label,
    destination_url: href,
    destination_path: destinationPath,
    destination_type: getLaunchDestinationType(href),
  };
}
