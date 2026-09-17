import { render, screen } from "@testing-library/react";
import type { EditorialSource } from "@/lib/seo/indexability";
import { BeachProseSummary } from "@/components/beach-detail/beach-prose-summary";
import { createMockBeach } from "@/__tests__/setup/typed-mocks";

const source = (publisher: string): EditorialSource => ({
  url: "https://example.com/source",
  publisher,
  retrievedAt: "2026-01-01T00:00:00.000Z",
});

describe("BeachProseSummary", () => {
  it("normalizes missing punctuation without doubling existing punctuation", () => {
    render(
      <BeachProseSummary
        beach={createMockBeach({
          description: null,
          wave_tips: null,
          crowd_tips: "Crowded when working",
          best_conditions_prose: "Watch the tide!",
        })}
        surfCallReport={null}
      />,
    );

    const summary = screen.getByText(/Crowded when working\./);
    expect(summary).toHaveTextContent("Crowded when working. Watch the tide!");
    expect(summary).not.toHaveTextContent("working..");
    expect(summary).not.toHaveTextContent("tide!!");
  });

  it("hides the source line when all publishers are blank", () => {
    render(
      <BeachProseSummary
        beach={createMockBeach()}
        surfCallReport={null}
        editorialSources={[source("  "), source("")]}
      />,
    );

    expect(screen.queryByText(/Local guidance reviewed against/)).not.toBeInTheDocument();
  });

  it("shows unique trimmed publishers when at least one is present", () => {
    render(
      <BeachProseSummary
        beach={createMockBeach()}
        surfCallReport={null}
        editorialSources={[source(" NOAA "), source("NOAA"), source("Local Surf Club")]}
      />,
    );

    expect(
      screen.getByText("Local guidance reviewed against NOAA, Local Surf Club."),
    ).toBeInTheDocument();
  });
});
