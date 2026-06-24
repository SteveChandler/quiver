import { buildVercelExport, toVercelReferrers, toVercelSeoPages } from "@/lib/seo/agent-workflow/vercel-export";

describe("SEO workflow Vercel export", () => {
  it("normalizes overview, grouped timeseries, and bot subtraction", () => {
    const exportInput = buildVercelExport(
      {
        overview: { data: { total: 100, devices: 40, bounceRate: 50 } },
        pages: { data: { groups: { "/": [{ total: 20 }], "/learn": [{ total: 30 }, { total: 5 }] } } },
        referrers: { data: { groups: { "google.com": [{ total: 12 }], "": [{ total: 3 }] } } },
        countries: { data: { groups: { US: [{ total: 40 }] } } },
        devices: { data: { groups: { mobile: [{ total: 30 }] } } },
        botOverviews: [{ data: { total: 8 } }, { data: { total: 2 } }],
      },
      "2026-05-20T12:00:00Z",
      { from: "2026-05-13", to: "2026-05-20" },
    );

    expect(exportInput.adjustedPageViews).toBe(90);
    expect(toVercelSeoPages(exportInput)[0]).toEqual({ path: "/learn", visits: 35 });
    expect(toVercelReferrers(exportInput)).toContainEqual({ referrer: "google.com", visits: 12 });
  });

  it("normalizes v2 stats array breakdowns", () => {
    const exportInput = buildVercelExport(
      {
        overview: { total: 1603, devices: 1174, bounceRate: 79 },
        pages: { data: [{ key: "/map", total: 236 }, { key: "/", total: 50 }] },
        referrers: { data: [{ key: "google.com", total: 87 }, { key: "", total: 10 }] },
        countries: { data: [{ key: "US", total: 1220 }] },
        devices: { data: [{ key: "mobile", total: 900 }] },
        botOverviews: [{ total: 12 }],
      },
      "2026-06-11T12:00:00Z",
      { from: "2026-06-04", to: "2026-06-11" },
    );

    expect(exportInput.rawPageViews).toBe(1603);
    expect(exportInput.adjustedPageViews).toBe(1591);
    expect(exportInput.uniqueVisitors).toBe(1174);
    expect(toVercelSeoPages(exportInput)[0]).toEqual({ path: "/map", visits: 236 });
    expect(toVercelReferrers(exportInput)).toContainEqual({ referrer: "(direct)", visits: 10 });
  });
});
