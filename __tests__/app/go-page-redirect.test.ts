import {
  isValidSurfDropSlug,
  resolveGoPageAction,
} from "@/lib/surf-drops/go-page-action";
import type { SurfDropTeaser } from "@/types/surf-drops";

const VALID_SLUG = "A2K7N9PQRS";
const INVALID_SLUG = "abc!lower1";

function makeTeaser(overrides: Partial<SurfDropTeaser> = {}): SurfDropTeaser {
  return {
    slug: VALID_SLUG,
    status: "active",
    creator: { display_name: "Ryan", avatar_url: null },
    general_area: "PB",
    starts_at: "2026-07-05T13:00:00Z",
    ends_at: "2026-07-05T14:00:00Z",
    participants_count: 2,
    requires_signin: false,
    requires_claim: false,
    is_known_spot: true,
    ...overrides,
  };
}

describe("isValidSurfDropSlug", () => {
  it("accepts valid alphabet slugs", () => {
    expect(isValidSurfDropSlug(VALID_SLUG)).toBe(true);
  });

  it.each([
    "",
    "TOO SHORT1",
    "TOOLONGSLUG1",
    "abcdefghij",
    INVALID_SLUG,
    "AAAAAAAAA1", // digit 1 excluded from alphabet
    "AAAAAAAAAO", // O excluded from alphabet
  ])("rejects %p", (slug) => {
    expect(isValidSurfDropSlug(slug)).toBe(false);
  });
});

describe("resolveGoPageAction", () => {
  it("returns invalid-slug for bad slug shapes", () => {
    expect(resolveGoPageAction(INVALID_SLUG, null, { isSignedIn: false }))
      .toEqual({ kind: "invalid-slug" });
  });

  it("returns invalid-slug when the teaser is missing", () => {
    expect(resolveGoPageAction(VALID_SLUG, null, { isSignedIn: false }))
      .toEqual({ kind: "invalid-slug" });
  });

  it.each(["notfound", "expired", "cancelled"] as const)(
    "returns unavailable when the drop is %s",
    (status) => {
      const teaser = makeTeaser({ status });
      const action = resolveGoPageAction(VALID_SLUG, teaser, {
        isSignedIn: true,
      });
      expect(action).toEqual({ kind: "unavailable", status, teaser });
    },
  );

  it("returns signin-required for anonymous viewers even if requires_signin is stale", () => {
    const teaser = makeTeaser({ requires_signin: false });
    expect(
      resolveGoPageAction(VALID_SLUG, teaser, { isSignedIn: false }),
    ).toEqual({ kind: "signin-required", teaser });
  });

  it("returns signin-required when the API asks for signin", () => {
    const teaser = makeTeaser({ requires_signin: true });
    expect(
      resolveGoPageAction(VALID_SLUG, teaser, { isSignedIn: true }),
    ).toEqual({ kind: "signin-required", teaser });
  });

  it("returns claim-required when authed but not yet authorized", () => {
    const teaser = makeTeaser({ requires_claim: true });
    expect(
      resolveGoPageAction(VALID_SLUG, teaser, { isSignedIn: true }),
    ).toEqual({ kind: "claim-required", teaser });
  });

  it("returns redirect-to-drop when authorized and drop_id is present", () => {
    const teaser = makeTeaser({
      requires_claim: false,
      drop_id: "11111111-2222-3333-4444-555555555555",
    });
    expect(
      resolveGoPageAction(VALID_SLUG, teaser, { isSignedIn: true }),
    ).toEqual({
      kind: "redirect-to-drop",
      teaser,
      dropId: "11111111-2222-3333-4444-555555555555",
    });
  });

  it("falls back to claim-required when authorized but drop_id is missing", () => {
    const teaser = makeTeaser({ requires_claim: false, drop_id: undefined });
    expect(
      resolveGoPageAction(VALID_SLUG, teaser, { isSignedIn: true }),
    ).toEqual({ kind: "claim-required", teaser });
  });
});
