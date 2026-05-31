import React from "react";
import { render, screen } from "@testing-library/react";
import { createMockBeach } from "@/__tests__/setup/typed-mocks";
import { ZineHero } from "@/components/beach-detail/zine/zine-hero";

describe("ZineHero heading level", () => {
  it("uses h1 by default for canonical beach pages", () => {
    const beach = createMockBeach({ name: "Seaside Reef" });

    render(<ZineHero beach={beach} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Seaside Reef" }),
    ).toBeInTheDocument();
  });

  it("can demote the beach title when a subpage supplies the canonical h1", () => {
    const beach = createMockBeach({ name: "Seaside Reef" });

    render(<ZineHero beach={beach} headingLevel="h2" />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Seaside Reef" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 1, name: "Seaside Reef" }),
    ).not.toBeInTheDocument();
  });
});
