import { buildVercelExport, toVercelReferrers, toVercelSeoPages } from "@/lib/seo/agent-workflow/vercel-export";

describe("SEO workflow Vercel export", () => {
  it("normalizes overview, grouped timeseries, and bot subtraction", () => {
    const exportInput = buildVercelExport(
      {
        overview: { data: { total: 100, devices: 40, bounceRate: 50 } },
        pages: { data: { groups: { "/": [{ total: 20 }], "/learn": [{ total: 30 }, { total: 5 }] } } },
        referrers: { data: { groups: { "google.com": [{ total: 12 }], "": [{ total: 3 }] } } },
        countries: { data: { groups: { US: [{ total: 40 }], SG: [{ total: 9 }] } } },
        devices: { data: { groups: { mobile: [{ total: 30 }], desktop: [{ total: 20 }] } } },
        botOverviews: [{ data: { total: 8 } }, { data: { total: 2 } }],
      },
      "2026-05-20T12:00:00Z",
      { from: "2026-05-13", to: "2026-05-20" },
    );

    expect(exportInput.adjustedPageViews).toBe(90);
    expect(toVercelSeoPages(exportInput)[0]).toEqual({ path: "/learn", visits: 35 });
    expect(toVercelReferrers(exportInput)).toContainEqual({ referrer: "google.com", visits: 12 });
    expect(exportInput.lowConfidenceSegments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ segment: "referrer:(direct)", visits: 3 }),
        expect.objectContaining({ segment: "country:SG", visits: 9 }),
        expect.objectContaining({ segment: "device:desktop", visits: 20 }),
      ]),
    );
  });
});
