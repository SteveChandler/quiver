import { generateMetadata } from "@/app/learn/[slug]/page";

describe("learn OG metadata", () => {
  it("uses the dedicated /api/og/learn card for the groundswell explainer", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "groundswell-vs-wind-swell" }) } as never);
    const images = meta.openGraph?.images;
    const url = Array.isArray(images) ? (images[0] as { url: string }).url : (images as { url: string } | undefined)?.url;
    expect(String(url)).toContain("/api/og/learn");
  });

  it("keeps the generic guide card for other learn articles", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "swell-period-explained" }) } as never);
    const images = meta.openGraph?.images;
    const url = Array.isArray(images) ? (images[0] as { url: string }).url : (images as { url: string } | undefined)?.url;
    expect(String(url)).toContain("/api/og/guide");
  });
});
