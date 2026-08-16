import { render, screen } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

import { getBeaches } from "@/actions/beach/beach-query-actions";
import ForBusinessesPage from "@/app/for-businesses/page";
import ForSurfSchoolsPage from "@/app/for-surf-schools/page";
import {
  DEFAULT_PREVIEW_SLUG,
  resolvePreviewSlug,
  validateInitialBeachSlug,
} from "@/components/embed-promo/beach-selection";
import type { Beach } from "@/types/database";

jest.mock("@/actions/beach/beach-query-actions", () => ({
  getBeaches: jest.fn(),
}));

// The landing pages read beaches through an `unstable_cache` wrapper, which
// needs Next's incremental cache context that jest does not provide. Use the
// repo's pass-through mock (see __tests__/setup/mock-next-cache.ts).
jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
  unstable_cache: (fn: unknown) => fn,
}));

jest.mock("server-only", () => ({}));

jest.mock("@/components/ui/scroll-reveal", () => ({
  ScrollReveal: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

jest.mock("@/components/zine", () => ({
  QuiverSticker: () => null,
  ZineSurface: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const BEACHES = [
  {
    name: "12th Street Jetty",
    slug: "12th-street-jetty-sea-isle-city-nj",
    city: "Sea Isle City",
    state: "NJ",
  },
  {
    name: "Huntington Beach Pier",
    slug: DEFAULT_PREVIEW_SLUG,
    city: "Huntington Beach",
    state: "CA",
  },
  {
    name: "La Jolla Shores",
    slug: "la-jolla-shores",
    city: "San Diego",
    state: "CA",
  },
];

const BEACH_ROWS = BEACHES as unknown as Beach[];
const mockGetBeaches = getBeaches as jest.MockedFunction<typeof getBeaches>;

type PromoPage = (props: {
  searchParams: Promise<{ beach?: string | string[] }>;
}) => Promise<ReactElement>;

async function renderPage(
  Page: PromoPage,
  beach?: string | string[]
): Promise<ReturnType<typeof render>> {
  return render(
    await Page({
      searchParams: Promise.resolve(beach === undefined ? {} : { beach }),
    })
  );
}

function expectSelectedBeach(
  container: HTMLElement,
  expectedSlug: string
): void {
  expect(screen.getByRole("combobox", { name: "Select a beach" })).toHaveValue(
    expectedSlug
  );

  const previews = screen.getAllByTitle("Widget preview");
  previews.forEach((preview) => {
    expect(preview).toHaveAttribute(
      "src",
      expect.stringContaining(`/embed/conditions/${expectedSlug}`)
    );
  });

  expect(container.querySelector("pre")).toHaveTextContent(
    `/embed/conditions/${expectedSlug}`
  );
}

describe("embed promo beach preselection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBeaches.mockResolvedValue({ success: true, data: BEACH_ROWS });
  });

  it.each([
    ["businesses", ForBusinessesPage],
    ["surf schools", ForSurfSchoolsPage],
  ])("preselects a valid slug on the %s page", async (_label, Page) => {
    const { container } = await renderPage(Page, "la-jolla-shores");

    expectSelectedBeach(container, "la-jolla-shores");
    expect(screen.getByRole("combobox")).toHaveValue("la-jolla-shores");
  });

  it("falls back silently for an unknown slug", async () => {
    const { container } = await renderPage(
      ForBusinessesPage,
      "unknown-beach"
    );

    expectSelectedBeach(container, DEFAULT_PREVIEW_SLUG);
    expect(container).not.toHaveTextContent("unknown-beach");
  });

  it("falls back silently for a malformed repeated beach parameter", async () => {
    const { container } = await renderPage(ForSurfSchoolsPage, [
      "la-jolla-shores",
      "unknown-beach",
    ]);

    expectSelectedBeach(container, DEFAULT_PREVIEW_SLUG);
    expect(screen.getByRole("combobox")).not.toHaveValue(BEACHES[0]?.slug);
  });

  it("uses the named default when the beach parameter is missing", async () => {
    const { container } = await renderPage(ForSurfSchoolsPage);

    expectSelectedBeach(container, DEFAULT_PREVIEW_SLUG);
    expect(screen.getByRole("combobox")).toHaveValue(DEFAULT_PREVIEW_SLUG);
  });

  it("uses the named default instead of the first beach", () => {
    expect(BEACHES[0]?.slug).not.toBe(DEFAULT_PREVIEW_SLUG);
    expect(resolvePreviewSlug(BEACHES)).toBe(DEFAULT_PREVIEW_SLUG);
  });

  it("uses the first beach when the named default is unavailable", () => {
    expect(resolvePreviewSlug([BEACHES[0], BEACHES[2]])).toBe(
      BEACHES[0]?.slug
    );
  });

  it("rejects slugs that are not in the fetched beach list", () => {
    expect(validateInitialBeachSlug(BEACHES, "unknown-beach")).toBeUndefined();
    expect(
      validateInitialBeachSlug(BEACHES, ["la-jolla-shores"])
    ).toBeUndefined();
  });

});
