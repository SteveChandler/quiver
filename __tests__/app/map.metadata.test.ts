/**
 * @jest-environment node
 */

import { generateMetadata } from "@/app/map/page";

describe("/map metadata", () => {
  const originalEnv = process.env.DISALLOW_ROBOTS;

  beforeEach(() => {
    // Ensure indexing is enabled for these tests unless explicitly overridden.
    delete process.env.DISALLOW_ROBOTS;
  });

  afterAll(() => {
    process.env.DISALLOW_ROBOTS = originalEnv;
  });

  it("keeps /map indexable", async () => {
    const meta = await generateMetadata({ searchParams: Promise.resolve({}) });

    expect(typeof meta.alternates?.canonical).toBe("string");
    expect(String(meta.alternates?.canonical)).toContain("/map");

    // Default should be indexable when DISALLOW_ROBOTS !== "true"
    expect(meta.robots && typeof meta.robots === "object").toBe(true);
    expect((meta.robots as any).index).toBe(true);
    expect((meta.robots as any).follow).toBe(true);
  });

  it("noindexes /map?search=* variants but canonicalizes to /map", async () => {
    const meta = await generateMetadata({ searchParams: Promise.resolve({ search: "Capitola" }) });

    expect(typeof meta.alternates?.canonical).toBe("string");
    expect(String(meta.alternates?.canonical)).toContain("/map");

    expect(meta.robots && typeof meta.robots === "object").toBe(true);
    expect((meta.robots as any).index).toBe(false);
    expect((meta.robots as any).follow).toBe(true);

    // Googlebot rules should also be set explicitly
    expect((meta.robots as any).googleBot?.index).toBe(false);
    expect((meta.robots as any).googleBot?.follow).toBe(true);
  });

  it("noindexes /map?city=* variants but canonicalizes to /map", async () => {
    const meta = await generateMetadata({ searchParams: Promise.resolve({ city: "san-diego" }) });

    expect(typeof meta.alternates?.canonical).toBe("string");
    expect(String(meta.alternates?.canonical)).toContain("/map");

    expect(meta.robots && typeof meta.robots === "object").toBe(true);
    expect((meta.robots as any).index).toBe(false);
    expect((meta.robots as any).follow).toBe(true);

    expect((meta.robots as any).googleBot?.index).toBe(false);
    expect((meta.robots as any).googleBot?.follow).toBe(true);
  });
});


