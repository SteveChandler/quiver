/**
 * @jest-environment node
 */

jest.mock("@/actions/beach/cam-actions", () => ({
  getBeachesWithCameras: jest.fn(),
}));
jest.mock("@/app/cams/[region]/page", () => ({ CamsRegionDirectoryPage: () => null }));
jest.mock("@/components/seo/funnel/SeoLocationPage", () => ({ SeoLocationPage: () => null }));

import { getBeachesWithCameras } from "@/actions/beach/cam-actions";
import { generateMetadata } from "@/app/surf-cams/[region]/page";
import { CAM_REGIONS } from "@/lib/data/cam-regions";
import { getSeoFunnelPageByTypeAndSlug } from "@/lib/seo/funnel-pages";

const region = CAM_REGIONS.find((r) => !getSeoFunnelPageByTypeAndSlug("surf-cams", r.slug));

function cam(playback: "inline" | "none") {
  return {
    id: `${region?.slug}-${playback}`,
    name: "Spot",
    slug: "spot",
    city: "City",
    state: "CA",
    camera_url: "https://example.com/cam",
    thumbnail_url: null,
    photo_url: null,
    regionSlug: region?.slug ?? "",
    playback: { kind: playback },
  };
}

describe("/surf-cams/[region] metadata", () => {
  it("has a directory-only region to test", () => {
    expect(region?.slug).toEqual(expect.any(String));
  });

  it("counts only live cams in the title", async () => {
    (getBeachesWithCameras as jest.Mock).mockResolvedValue([cam("inline"), cam("none")]);
    const metadata = await generateMetadata({ params: Promise.resolve({ region: region!.slug }) });
    expect(String(metadata.title)).toContain(`${region!.name} — 1 Cameras`);
  });

  it("keeps a 0 count out of the title and description when every cam is offline", async () => {
    (getBeachesWithCameras as jest.Mock).mockResolvedValue([cam("none")]);
    const metadata = await generateMetadata({ params: Promise.resolve({ region: region!.slug }) });
    expect(String(metadata.title)).toContain(`${region!.name} Surf Cams`);
    expect(String(metadata.title)).not.toMatch(/\b0\b/);
    expect(String(metadata.description)).not.toMatch(/\b0\b/);
  });
});
