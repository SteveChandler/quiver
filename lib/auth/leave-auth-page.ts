type BackRouter = { back: () => void; replace: (href: string) => void };

type NavigationLike = {
  currentEntry?: { index: number } | null;
  entries?: () => Array<{ url?: string | null }>;
};

const AUTH_PAGE = /^\/auth\/sign-(in|up)\/?$/;

/**
 * Leave a dedicated auth page after the visitor dismisses it.
 *
 * Pushing "/" left the auth page in history, so Back from the home page
 * reopened it (a Back trap seen in the 2026-11-27 signup intel). Go back when
 * the previous entry is a non-auth page on this site; otherwise replace the
 * auth page with home so it never stays behind the visitor.
 */
export function leaveAuthPage(router: BackRouter): void {
  if (previousEntryIsSitePage()) {
    router.back();
    return;
  }
  router.replace("/");
}

function previousEntryIsSitePage(): boolean {
  if (typeof window === "undefined") return false;
  // The Navigation API lists same-origin entries only. Browsers without it
  // fall through to the replace, which still removes the trap.
  const navigation = (window as unknown as { navigation?: NavigationLike }).navigation;
  const index = navigation?.currentEntry?.index;
  if (typeof index !== "number" || index < 1) return false;
  const previousUrl = navigation?.entries?.()[index - 1]?.url;
  if (!previousUrl) return false;
  try {
    return !AUTH_PAGE.test(new URL(previousUrl).pathname);
  } catch {
    return false;
  }
}
