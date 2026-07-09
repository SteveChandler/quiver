/**
 * @jest-environment node
 */

import {
  extractCanonicalHref,
  isIndexableResponse,
  isOk,
  isSelfCanonical,
} from "../../scripts/verify-sitemap";

describe("verify-sitemap health checks", () => {
  it("extracts absolute canonical URLs from HTML", () => {
    expect(
      extractCanonicalHref(
        '<html><head><link rel="canonical" href="/ca/san-diego/ocean-beach" /></head></html>',
        "https://www.quiversurf.app/ca/san-diego/ocean-beach",
      ),
    ).toBe("https://www.quiversurf.app/ca/san-diego/ocean-beach");
  });

  it("treats meta robots noindex as not indexable", () => {
    expect(
      isIndexableResponse(
        '<html><head><meta name="robots" content="noindex,follow" /></head></html>',
      ),
    ).toBe(false);
  });

  it("treats X-Robots-Tag noindex as not indexable", () => {
    expect(isIndexableResponse("<html></html>", "noindex, nofollow")).toBe(
      false,
    );
  });

  it("requires self-canonical URLs", () => {
    expect(
      isSelfCanonical(
        "https://www.quiversurf.app/ca/san-diego/ocean-beach/",
        "https://www.quiversurf.app/ca/san-diego/ocean-beach",
      ),
    ).toBe(true);
    expect(
      isSelfCanonical(
        "https://www.quiversurf.app/beach/ocean-beach",
        "https://www.quiversurf.app/ca/san-diego/ocean-beach",
      ),
    ).toBe(false);
  });

  it("fails redirects, noindex pages, and non-self-canonical pages", () => {
    expect(
      isOk({
        url: "https://www.quiversurf.app/ca/san-diego/ocean-beach",
        status: 200,
        pattern: "/ca/[city]/[beach]",
        indexable: true,
        selfCanonical: true,
        durationMs: 20,
      }),
    ).toBe(true);
    expect(
      isOk({
        url: "https://www.quiversurf.app/ca/san-diego/ocean-beach",
        status: 308,
        pattern: "/ca/[city]/[beach]",
        finalStatus: 200,
        durationMs: 20,
      }),
    ).toBe(false);
    expect(
      isOk({
        url: "https://www.quiversurf.app/ca/san-diego/ocean-beach",
        status: 200,
        pattern: "/ca/[city]/[beach]",
        indexable: false,
        selfCanonical: true,
        durationMs: 20,
      }),
    ).toBe(false);
    expect(
      isOk({
        url: "https://www.quiversurf.app/ca/san-diego/ocean-beach",
        status: 200,
        pattern: "/ca/[city]/[beach]",
        indexable: true,
        selfCanonical: false,
        durationMs: 20,
      }),
    ).toBe(false);
  });
});
