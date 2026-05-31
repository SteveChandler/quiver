import {
  buildSurfersViewApplyBatches,
  extractSurfersViewCamUrlsFromSitemapXml,
  finalizeSurfersViewImportRows,
  matchSurfersViewCamToBeach,
  parseSurfersViewCamPage,
} from "@/lib/importers/surfers-view-cams";

const samplePlayerConfig = {
  vcdnurl:
    "https://belmar.cdn.coastalcameranetwork.com/New_Jersey/easternlinesbelmar.stream/index.m3u8",
  failimg:
    "https://splash.thesurfersview.com/New_Jersey/easternlinesbelmar.stream/latest.jpg",
  friendly_location:
    'Live beach cam powered by <a href="https://coastalcameranetwork.com">Coastal Camera Network</a>',
};

describe("Surfers View cam import helpers", () => {
  it("extracts only crawlable concrete live-cam URLs from sitemap XML", () => {
    const xml = `
      <urlset>
        <url><loc>https://thesurfersview.com/</loc></url>
        <url><loc>https://thesurfersview.com/live-cams/</loc></url>
        <url><loc>https://thesurfersview.com/live-cams/new-jersey/</loc></url>
        <url><loc>https://thesurfersview.com/live-cams/new-jersey/belmar-beach-cam-and-surf-report/</loc></url>
        <url><loc>https://thesurfersview.com/cams/belmar/</loc></url>
        <url><loc>https://thesurfersview.com/cams_http/belmar/</loc></url>
        <url><loc>https://example.com/live-cams/new-jersey/other/</loc></url>
      </urlset>
    `;

    expect(extractSurfersViewCamUrlsFromSitemapXml(xml)).toEqual([
      "https://thesurfersview.com/live-cams/new-jersey/belmar-beach-cam-and-surf-report/",
    ]);
  });

  it("parses static page metadata and keeps direct streams audit-only", () => {
    const html = `
      <title>Belmar Beach Cam &amp; Surf Report - The Surfers View</title>
      <script type="application/ld+json">
        {"@type":"VideoObject","thumbnailUrl":"https://ccn-media.coastalcameranetwork.com/New_Jersey/easternlinesbelmar.stream/latest.jpg"}
      </script>
      <div
        data-player-config="${JSON.stringify(samplePlayerConfig).replace(/"/g, "&quot;")}"
      ></div>
    `;

    expect(
      parseSurfersViewCamPage({
        sourcePageUrl:
          "https://thesurfersview.com/live-cams/new-jersey/belmar-beach-cam-and-surf-report/",
        html,
      })
    ).toEqual(
      expect.objectContaining({
        source_page_url:
          "https://thesurfersview.com/live-cams/new-jersey/belmar-beach-cam-and-surf-report/",
        title: "Belmar Beach Cam & Surf Report - The Surfers View",
        spot_name: "Belmar Beach",
        region_slug: "new-jersey",
        provider: "Coastal Camera Network",
        thumbnail_url:
          "https://ccn-media.coastalcameranetwork.com/New_Jersey/easternlinesbelmar.stream/latest.jpg",
        audit_stream_url:
          "https://belmar.cdn.coastalcameranetwork.com/New_Jersey/easternlinesbelmar.stream/index.m3u8",
        fetch_status: "parsed",
        import_camera_url:
          "https://thesurfersview.com/live-cams/new-jersey/belmar-beach-cam-and-surf-report/",
        stream_import_allowed: false,
      })
    );
  });

  it("imports authorized Ocean Beach Surfers View rows through the OB Hotel video resolver", () => {
    const html = `
      <title>Ocean Beach Webcam &amp; Surf Report - The Surfers View</title>
      <div
        data-player-config="${JSON.stringify(samplePlayerConfig).replace(/"/g, "&quot;")}"
      ></div>
    `;

    expect(
      parseSurfersViewCamPage({
        sourcePageUrl:
          "https://thesurfersview.com/live-cams/california/ocean-beach-san-diego-webcam-and-surf-report/",
        html,
      })
    ).toEqual(
      expect.objectContaining({
        source_page_url:
          "https://thesurfersview.com/live-cams/california/ocean-beach-san-diego-webcam-and-surf-report/",
        title: "Ocean Beach Webcam & Surf Report - The Surfers View",
        spot_name: "Ocean Beach",
        provider: "Ocean Beach Hotel / HDRelay",
        import_camera_url: "https://www.obhotel.com/Webcam-Oceanbeach.php",
        source_rights_status: "licensed_resolve",
        licensed_override_note: expect.stringContaining("OB Hotel"),
        stream_import_allowed: false,
      })
    );
  });

  it("matches existing Quiver beaches by normalized name and region", () => {
    const cam = parseSurfersViewCamPage({
      sourcePageUrl:
        "https://thesurfersview.com/live-cams/new-jersey/belmar-beach-cam-and-surf-report/",
      html: `
        <title>Belmar Beach Cam &amp; Surf Report - The Surfers View</title>
        <div data-player-config="${JSON.stringify(samplePlayerConfig).replace(/"/g, "&quot;")}"></div>
      `,
    });

    const match = matchSurfersViewCamToBeach(cam, [
      {
        id: "wrong-state",
        name: "Belmar",
        slug: "belmar-new-york-ny",
        city: "New York",
        state: "NY",
        country: "USA",
      },
      {
        id: "belmar",
        name: "Belmar",
        slug: "belmar-belmar-nj",
        city: "Belmar",
        state: "NJ",
        country: "USA",
      },
    ]);

    expect(match).toEqual(
      expect.objectContaining({
        match_status: "matched",
        quiver_beach_id: "belmar",
        quiver_beach_slug: "belmar-belmar-nj",
      })
    );
    expect(match.match_score).toBeGreaterThanOrEqual(0.9);
  });

  it("marks unmatched pages as candidate new beach rows", () => {
    const cam = parseSurfersViewCamPage({
      sourcePageUrl: "https://thesurfersview.com/live-cams/hawaii/maliko-bay-surf-cam/",
      html: `
        <title>Maliko Bay Surf Cam - The Surfers View</title>
        <div data-player-config="${JSON.stringify(samplePlayerConfig).replace(/"/g, "&quot;")}"></div>
      `,
    });

    expect(matchSurfersViewCamToBeach(cam, [])).toEqual(
      expect.objectContaining({
        match_status: "candidate_new",
        quiver_beach_id: null,
        quiver_beach_slug: null,
      })
    );
  });

  it("marks lower-confidence slug-only matches as needs review", () => {
    const cam = parseSurfersViewCamPage({
      sourcePageUrl:
        "https://thesurfersview.com/live-cams/california/los-angeles-beach-cam-and-surf-report/",
      html: `
        <title>Los Angeles Beach Cam &amp; Surf Report - The Surfers View</title>
        <div data-player-config="${JSON.stringify(samplePlayerConfig).replace(/"/g, "&quot;")}"></div>
      `,
    });

    expect(
      matchSurfersViewCamToBeach(cam, [
        {
          id: "venice",
          name: "Venice Breakwater",
          slug: "venice-breakwater-los-angeles-ca",
          city: "Los Angeles",
          state: "CA",
          country: "USA",
        },
      ])
    ).toEqual(
      expect.objectContaining({
        match_status: "needs_review",
        quiver_beach_id: "venice",
        quiver_beach_slug: "venice-breakwater-los-angeles-ca",
        match_score: 0.86,
      })
    );
  });

  it("does not match non-US cams to same-name beaches without country compatibility", () => {
    const cam = parseSurfersViewCamPage({
      sourcePageUrl:
        "https://thesurfersview.com/live-cams/australia/moana-surf-cam-beach-report/",
      html: `
        <title>Moana Surf Cam &amp; Beach Report - The Surfers View</title>
        <div data-player-config="${JSON.stringify(samplePlayerConfig).replace(/"/g, "&quot;")}"></div>
      `,
    });

    expect(
      matchSurfersViewCamToBeach(cam, [
        {
          id: "ala-moana",
          name: "Ala Moana Bowls",
          slug: "ala-moana-bowls",
          city: "Honolulu",
          state: "HI",
          country: null,
        },
      ])
    ).toEqual(
      expect.objectContaining({
        match_status: "candidate_new",
        quiver_beach_id: null,
        quiver_beach_slug: null,
      })
    );
  });

  it("does not match substring lookalikes across distinct beach names", () => {
    const cam = parseSurfersViewCamPage({
      sourcePageUrl:
        "https://thesurfersview.com/live-cams/california/pacifica-surf-cam-beach-report/",
      html: `
        <title>Pacifica Surf Cam Beach Report - The Surfers View</title>
        <div data-player-config="${JSON.stringify(samplePlayerConfig).replace(/"/g, "&quot;")}"></div>
      `,
    });

    expect(
      matchSurfersViewCamToBeach(cam, [
        {
          id: "pacific-beach",
          name: "Pacific Beach",
          slug: "pacific-beach",
          city: "San Diego",
          state: "CA",
          country: "USA",
        },
      ])
    ).toEqual(
      expect.objectContaining({
        match_status: "candidate_new",
        quiver_beach_id: null,
      })
    );
  });

  it("downgrades duplicate matched beach targets to manual review", () => {
    const belmarCam = parseSurfersViewCamPage({
      sourcePageUrl:
        "https://thesurfersview.com/live-cams/new-jersey/belmar-beach-cam-and-surf-report/",
      html: `
        <title>Belmar Beach Cam &amp; Surf Report - The Surfers View</title>
        <div data-player-config="${JSON.stringify(samplePlayerConfig).replace(/"/g, "&quot;")}"></div>
      `,
    });
    const playaBowlsCam = parseSurfersViewCamPage({
      sourcePageUrl:
        "https://thesurfersview.com/live-cams/new-jersey/playa-bowls-belmar-surf-cam/",
      html: `
        <title>Playa Bowls Belmar Surf Cam - The Surfers View</title>
        <div data-player-config="${JSON.stringify(samplePlayerConfig).replace(/"/g, "&quot;")}"></div>
      `,
    });
    const beaches = [
      {
        id: "belmar",
        name: "Belmar",
        slug: "belmar-belmar-nj",
        city: "Belmar",
        state: "NJ",
        country: "USA",
      },
    ];

    expect(
      finalizeSurfersViewImportRows([
        matchSurfersViewCamToBeach(belmarCam, beaches),
        matchSurfersViewCamToBeach(playaBowlsCam, beaches),
      ]).map((row) => row.match_status)
    ).toEqual(["needs_review", "needs_review"]);
  });

  it("downgrades fetch-failed matches to manual review", () => {
    const fallbackCam = {
      ...parseSurfersViewCamPage({
        sourcePageUrl:
          "https://thesurfersview.com/live-cams/new-jersey/belmar-beach-cam-and-surf-report/",
        html: `
          <title>Belmar Beach Cam &amp; Surf Report - The Surfers View</title>
          <div data-player-config="${JSON.stringify(samplePlayerConfig).replace(/"/g, "&quot;")}"></div>
        `,
      }),
      fetch_status: "fetch_failed" as const,
      thumbnail_url: null,
      audit_stream_url: null,
    };

    const [row] = finalizeSurfersViewImportRows([
      matchSurfersViewCamToBeach(fallbackCam, [
        {
          id: "belmar",
          name: "Belmar",
          slug: "belmar-belmar-nj",
          city: "Belmar",
          state: "NJ",
          country: "USA",
        },
      ]),
    ]);

    expect(row).toEqual(
      expect.objectContaining({
        fetch_status: "fetch_failed",
        match_status: "needs_review",
        quiver_beach_id: "belmar",
      })
    );
  });

  it("builds apply batches without clearing missing thumbnails", () => {
    const cam = parseSurfersViewCamPage({
      sourcePageUrl:
        "https://thesurfersview.com/live-cams/new-jersey/belmar-beach-cam-and-surf-report/",
      html: `
        <title>Belmar Beach Cam &amp; Surf Report - The Surfers View</title>
        <div data-player-config="${JSON.stringify(samplePlayerConfig).replace(/"/g, "&quot;")}"></div>
      `,
    });
    const row = {
      ...matchSurfersViewCamToBeach(cam, [
        {
          id: "belmar",
          name: "Belmar",
          slug: "belmar-belmar-nj",
          city: "Belmar",
          state: "NJ",
          country: "USA",
        },
      ]),
      thumbnail_url: null,
    };

    expect(buildSurfersViewApplyBatches([row])).toEqual({
      cameraRows: [
        {
          beach_id: "belmar",
          camera_url:
            "https://thesurfersview.com/live-cams/new-jersey/belmar-beach-cam-and-surf-report/",
        },
      ],
      thumbnailRows: [],
    });
  });

  it("refuses duplicate matched beach IDs in apply batches", () => {
    const cam = parseSurfersViewCamPage({
      sourcePageUrl:
        "https://thesurfersview.com/live-cams/new-jersey/belmar-beach-cam-and-surf-report/",
      html: `
        <title>Belmar Beach Cam &amp; Surf Report - The Surfers View</title>
        <div data-player-config="${JSON.stringify(samplePlayerConfig).replace(/"/g, "&quot;")}"></div>
      `,
    });
    const row = matchSurfersViewCamToBeach(cam, [
      {
        id: "belmar",
        name: "Belmar",
        slug: "belmar-belmar-nj",
        city: "Belmar",
        state: "NJ",
        country: "USA",
      },
    ]);

    expect(() => buildSurfersViewApplyBatches([row, row])).toThrow(
      "Refusing to apply duplicate matched beach IDs: belmar"
    );
  });
});
