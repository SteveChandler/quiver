/**
 * @jest-environment node
 */

import { resolveConfirmNext } from "@/lib/auth/confirm-utils";

describe("/auth/confirm resolveConfirmNext()", () => {
  it("defaults signup confirmations to '/' when next is missing", () => {
    expect(resolveConfirmNext("signup", null)).toBe("/");
    expect(resolveConfirmNext("signup", "")).toBe("/");
  });

  it("defaults recovery confirmations to '/auth/reset' when next is missing", () => {
    expect(resolveConfirmNext("recovery", null)).toBe("/auth/reset");
  });

  it("allows relative next paths starting with '/'", () => {
    expect(resolveConfirmNext("signup", "/")).toBe("/");
    expect(resolveConfirmNext("signup", "/profile?edit=true")).toBe(
      "/profile?edit=true"
    );
    expect(resolveConfirmNext("recovery", "/auth/reset")).toBe("/auth/reset");
  });

  it("blocks open redirects (non-relative next)", () => {
    expect(resolveConfirmNext("signup", "https://evil.com")).toBe("/");
    expect(resolveConfirmNext("signup", "http://evil.com")).toBe("/");
    expect(resolveConfirmNext("signup", "//evil.com")).toBe("/");
  });

  it("resolves cookie fallback value through resolveConfirmNext safely", () => {
    // Simulates the decoded cookie value being passed as the next param
    expect(resolveConfirmNext("signup", "/ca/san-diego/blacks")).toBe(
      "/ca/san-diego/blacks"
    );
    // Cookie with encoded value that was decoded before passing
    expect(
      resolveConfirmNext("signup", decodeURIComponent("%2Fca%2Fsan-diego%2Fblacks"))
    ).toBe("/ca/san-diego/blacks");
    // Malicious cookie value is still blocked
    expect(resolveConfirmNext("signup", "https://evil.com")).toBe("/");
    expect(resolveConfirmNext("signup", "//evil.com")).toBe("/");
  });
});









