/**
 * @jest-environment node
 */

describe("robots.txt", () => {
  const original = process.env.DISALLOW_ROBOTS;

  afterAll(() => {
    process.env.DISALLOW_ROBOTS = original;
  });

  it("disallows crawling Next.js build assets (/_next/*) when indexing is enabled", () => {
    delete process.env.DISALLOW_ROBOTS;
    (process.env as any).NODE_ENV = "production";

    jest.resetModules();
     
    const robots = require("@/app/robots").default as () => any;
    const r = robots();

    // When indexing is enabled, rules is an array with the first rule having allow: "/"
    const rules = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rules.userAgent).toBe("*");
    expect(rules.allow).toBe("/");
    expect(rules.disallow).toEqual(expect.arrayContaining(["/_next/"]));
  });

  it("disallows everything when DISALLOW_ROBOTS=true", () => {
    process.env.DISALLOW_ROBOTS = "true";

    jest.resetModules();
     
    const robots = require("@/app/robots").default as () => any;
    const r = robots();

    const rules = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rules.userAgent).toBe("*");
    expect(rules.disallow).toBe("/");
  });
});


