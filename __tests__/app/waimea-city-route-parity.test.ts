const mockLocationPage = jest.fn(
  async (_props: unknown): Promise<null> => null,
);
const mockLocationMetadata = jest.fn(
  async (_props: unknown): Promise<{ title: string }> => ({ title: "Waimea" }),
);

jest.mock("@/app/beaches/[country]/[state]/[city]/page", () => ({
  __esModule: true,
  default: (props: unknown) => mockLocationPage(props),
  generateMetadata: (props: unknown) => mockLocationMetadata(props),
}));

import WaimeaBigIslandPage, {
  generateMetadata as generateWaimeaBigIslandMetadata,
} from "@/app/hi/waimea-big-island/page";
import WaimeaKauaiPage, {
  generateMetadata as generateWaimeaKauaiMetadata,
} from "@/app/hi/waimea-kauai/page";

type LocationPageProps = {
  params: Promise<{ country: string; state: string; city: string }>;
};

describe("canonical Waimea city route wrappers", () => {
  beforeEach(() => {
    mockLocationPage.mockClear();
    mockLocationMetadata.mockClear();
  });

  it.each([
    [
      "Big Island",
      WaimeaBigIslandPage,
      generateWaimeaBigIslandMetadata,
      "waimea-big-island",
    ],
    ["Kauai", WaimeaKauaiPage, generateWaimeaKauaiMetadata, "waimea-kauai"],
  ] as const)(
    "serves the %s canonical location page and metadata without redirecting",
    async (_island, renderPage, renderMetadata, city) => {
      await renderPage();
      await renderMetadata();

      const pageProps = mockLocationPage.mock.calls[0]?.[0] as LocationPageProps;
      const metadataProps = mockLocationMetadata.mock.calls[0]?.[0] as LocationPageProps;
      const expectedParams = { country: "usa", state: "hi", city };

      expect(await pageProps.params).toEqual(expectedParams);
      expect(await metadataProps.params).toEqual(expectedParams);
    },
  );
});
