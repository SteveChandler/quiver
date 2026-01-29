/**
 * @jest-environment node
 */

import { generateMetadata } from "@/app/discover/page";

describe("/discover metadata", () => {
  const originalEnv = process.env.DISALLOW_ROBOTS;

  beforeEach(() => {
    // Ensure indexing is enabled for these tests unless explicitly overridden.
    delete process.env.DISALLOW_ROBOTS;
  });

  afterAll(() => {
    process.env.DISALLOW_ROBOTS = originalEnv;
  });

  it("keeps /discover indexable", async () => {
    const meta = await generateMetadata({ searchParams: Promise.resolve({}) });

    expect(typeof meta.alternates?.canonical).toBe("string");
    expect(String(meta.alternates?.canonical)).toContain("/discover");

    expect(meta.robots && typeof meta.robots === "object").toBe(true);
    expect((meta.robots as any).index).toBe(true);
    expect((meta.robots as any).follow).toBe(true);
  });

  it("noindexes /discover query variants but canonicalizes to /discover", async () => {
    const meta = await generateMetadata({ searchParams: Promise.resolve({ level: "beginner" }) });

    expect(typeof meta.alternates?.canonical).toBe("string");
    expect(String(meta.alternates?.canonical)).toContain("/discover");

    expect(meta.robots && typeof meta.robots === "object").toBe(true);
    expect((meta.robots as any).index).toBe(false);
    expect((meta.robots as any).follow).toBe(true);

    expect((meta.robots as any).googleBot?.index).toBe(false);
    expect((meta.robots as any).googleBot?.follow).toBe(true);
  });
});


