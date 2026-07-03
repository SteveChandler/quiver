import type { SurfDropTeaser } from "@/types/surf-drops";

export type GoPageAction =
  | { kind: "invalid-slug" }
  | { kind: "unavailable"; status: "notfound" | "expired" | "cancelled"; teaser: SurfDropTeaser }
  | { kind: "signin-required"; teaser: SurfDropTeaser }
  | { kind: "claim-required"; teaser: SurfDropTeaser }
  | { kind: "redirect-to-drop"; teaser: SurfDropTeaser; dropId: string };

const SLUG_ALPHABET_REGEX = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{10}$/;

export function isValidSurfDropSlug(slug: string): boolean {
  return SLUG_ALPHABET_REGEX.test(slug);
}

interface Viewer {
  isSignedIn: boolean;
}

/**
 * Pure state-branch selector for /go/[shareSlug]. Kept side-effect-free
 * so it can be unit tested without spinning up Next.
 */
export function resolveGoPageAction(
  slug: string,
  teaser: SurfDropTeaser | null,
  viewer: Viewer,
): GoPageAction {
  if (!isValidSurfDropSlug(slug)) return { kind: "invalid-slug" };
  if (!teaser) return { kind: "invalid-slug" };

  if (
    teaser.status === "notfound" ||
    teaser.status === "expired" ||
    teaser.status === "cancelled"
  ) {
    return { kind: "unavailable", status: teaser.status, teaser };
  }

  // status === "active"
  if (!viewer.isSignedIn || teaser.requires_signin) {
    return { kind: "signin-required", teaser };
  }
  if (teaser.requires_claim) {
    return { kind: "claim-required", teaser };
  }
  if (teaser.drop_id) {
    return { kind: "redirect-to-drop", teaser, dropId: teaser.drop_id };
  }
  // Authorized but no drop_id — treat as claim to be safe.
  return { kind: "claim-required", teaser };
}
