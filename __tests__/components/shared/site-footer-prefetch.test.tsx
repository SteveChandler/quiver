import React from "react";
import { render, screen, within } from "@testing-library/react";
import { SiteFooter } from "@/components/shared/site-footer";
import { FOOTER_LINKS } from "@/lib/constants/footer-links";

// Expose Link's prefetch prop so the footer prefetch policy is assertable
jest.mock("next/link", () => {
  const React = require("react");
  return React.forwardRef(function MockLink(
    { href, prefetch, children, ...rest }: any,
    ref: any,
  ) {
    return React.createElement(
      "a",
      { ...rest, ref, href, "data-prefetch": String(prefetch) },
      children,
    );
  });
});

describe("SiteFooter prefetch", () => {
  it("does not prefetch any footer link", () => {
    render(<SiteFooter />);
    const footer = within(screen.getByRole("contentinfo"));
    const hrefs = Object.values(FOOTER_LINKS).flat().map((link) => link.href);

    for (const href of hrefs) {
      const link = footer
        .getAllByRole("link")
        .find((element) => element.getAttribute("href") === href);
      expect(link).toHaveAttribute("data-prefetch", "false");
    }
  });
});
