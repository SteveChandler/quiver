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
});






