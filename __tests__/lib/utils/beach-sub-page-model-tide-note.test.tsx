import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { getTideMetaData } from "@/lib/seo/tide-meta-data";
import { getBeachBySlugOrId } from "@/lib/utils/beach-lookup-utils";
import { renderBeachSubPage } from "@/lib/utils/beach-sub-page-utils";
import { FES2022_CITATION } from "@/lib/services/tides/model-tides";
import type { Beach } from "@/types/database";

jest.mock("@/lib/utils/beach-lookup-utils", () => ({ getBeachBySlugOrId: jest.fn() }));
jest.mock("@/lib/seo/tide-meta-data", () => ({ getTideMetaData: jest.fn() }));
jest.mock("@/lib/utils/timezone-utils.server", () => ({ getTimezoneFromCoords: jest.fn(() => "America/Los_Angeles") }));

const beach = {
  id: "beach-model",
  name: "Cabo Pulmo",
  slug: "cabo-pulmo",
  city: "Cabo Pulmo",
  state: "Baja California Sur",
  country: "Mexico",
  lat: 23.44,
  lon: -109.42,
} as Beach;

async function tideNote(source: string, nextHighTime: string | null): Promise<ReactElement | undefined> {
  (getTideMetaData as jest.Mock).mockResolvedValue({
    source,
    nextHighTime,
    nextHighHeight: nextHighTime ? 2 : null,
    nextLowTime: null,
    nextLowHeight: null,
    nextHighAt: null,
    nextLowAt: null,
  });
  const page = await renderBeachSubPage({
    beachSlug: "cabo-pulmo",
    pageType: "tides",
    beachPath: "/mexico/baja-california-sur/cabo-pulmo/tides",
  }) as ReactElement<{ children?: ReactNode }>;
  return (Children.toArray(page.props.children).filter(isValidElement) as ReactElement<{ children?: ReactNode }>[]).find(
    (child) => child.type === "p" && String(Children.toArray(child.props.children)[0]).startsWith("Modelled for this spot"),
  );
}

describe("model tide sub-page note", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getBeachBySlugOrId as jest.Mock).mockResolvedValue(beach);
  });

  it.each(["10:00 AM", null])("shows the model attribution with high time %s", async (nextHighTime) => {
    const note = await tideNote("fes2022", nextHighTime);
    expect(note).toEqual(expect.objectContaining({ type: "p" }));
    render(note);
    expect(screen.getByText(/Modelled for this spot from the FES2022 global tide model, not measured at a tide station\. Not for navigation\./)).toHaveTextContent(FES2022_CITATION);
  });

  it("omits the model note for NOAA tides", async () => {
    expect(await tideNote("noaa", "10:00 AM")).toBeUndefined();
  });
});
