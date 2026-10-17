/** @jest-environment node */

import { redirect } from "next/navigation";
import ForecastPage from "@/app/app/forecast/page";
import BeachPage from "@/app/beach/page";
import InvitePage from "@/app/invite/page";
import nextConfig from "@/next.config.mjs";

jest.mock("@ducanh2912/next-pwa", () => ({ __esModule: true, default: () => (config: unknown) => config }));
jest.mock("next/navigation", () => ({
  redirect: jest.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  }),
}));

describe("app-link web fallbacks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    [{ spot: "scripps", window: "X" }, "/app/spot/scripps?window=X"],
    [{ spot: "scripps" }, "/app/spot/scripps"],
    [
      {
        spot: "scripps",
        window: "X",
        sid: "share-id",
        invite: "token",
        tag: ["a", "b"],
        empty: "",
        absent: undefined,
      },
      "/app/spot/scripps?window=X&sid=share-id&invite=token&tag=a&tag=b&empty=",
    ],
    [{ spot: ["scripps", "blacks"], window: "X" }, "/app/spot/scripps?window=X"],
    [{ spot: "scripps/extra?x=1" }, "/app/spot/scripps%2Fextra%3Fx%3D1"],
    [{}, "/app"],
    [{ source: "share", sid: "share-id" }, "/app?source=share&sid=share-id"],
    [{ spot: "", source: "share" }, "/app?source=share"],
  ])("redirects forecast query %j to %s", async (searchParams, target) => {
    await expect(
      ForecastPage({ searchParams: Promise.resolve(searchParams) }),
    ).rejects.toThrow(`NEXT_REDIRECT:${target}`);
    expect(redirect).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith(target);
  });

  it.each([
    ["/beach", BeachPage, "/map"],
    ["/invite", InvitePage, "/download"],
  ])("redirects %s to its web fallback", (_path, Page, target) => {
    expect(() => Page()).toThrow(`NEXT_REDIRECT:${target}`);
    expect(redirect).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith(target);
  });

  it("redirects /auth to sign-in from next.config, ahead of any other matching rule", async () => {
    const redirects = await nextConfig.redirects!();
    const index = redirects.findIndex((rule: { source: string }) => rule.source === "/auth");
    expect(redirects[index]).toEqual({ source: "/auth", destination: "/auth/sign-in", permanent: false });
    expect(redirects.slice(0, index).some((rule: { source: string }) => new RegExp(`^${rule.source}$`).test("/auth"))).toBe(false);
  });
});
