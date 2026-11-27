import { leaveAuthPage } from "@/lib/auth/leave-auth-page";

type Entry = { url: string };

function setNavigation(entries: Entry[] | null, index = entries ? entries.length - 1 : 0): void {
  Object.defineProperty(window, "navigation", {
    configurable: true,
    value: entries ? { currentEntry: { index }, entries: () => entries } : undefined,
  });
}

describe("leaveAuthPage", () => {
  const router = { back: jest.fn(), replace: jest.fn() };

  beforeEach(() => jest.clearAllMocks());
  afterEach(() => setNavigation(null));

  it("goes back when the previous entry is a page on the site", () => {
    setNavigation([
      { url: "https://quiversurf.app/surf-cams/san-diego" },
      { url: "https://quiversurf.app/auth/sign-up" },
    ]);
    leaveAuthPage(router);
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it.each([
    ["the auth page is the first entry", [{ url: "https://quiversurf.app/auth/sign-up" }]],
    [
      "the previous entry is the other auth page",
      [{ url: "https://quiversurf.app/auth/sign-in?redirectTo=/alerts" }, { url: "https://quiversurf.app/auth/sign-up" }],
    ],
    ["the browser has no Navigation API", null],
  ])("replaces the auth page with home when %s", (_label, entries) => {
    setNavigation(entries as Entry[] | null);
    leaveAuthPage(router);
    expect(router.replace).toHaveBeenCalledWith("/");
    expect(router.back).not.toHaveBeenCalled();
  });
});
