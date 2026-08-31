import {
  buildOutreachDigest,
  hasDirectEmail,
  parseOutreachTracker,
  resolveOutreachRotation,
} from "@/lib/seo/agent-workflow/outreach-digest";

const TRACKER = [
  "# SEO Outreach Tracker",
  "",
  "## Status Legend",
  "| Status | Meaning |",
  "| --- | --- |",
  "| `queued` | Identified |",
  "",
  "## Surf School Targets (Playbook Section 1.3)",
  "### California",
  "| Target | Website | Contact | Nearest Beach | Status | Date | Notes |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  "| Surf Diva | surfdiva.com | askadiva@surfdiva.com | La Jolla | queued | | women's school |",
  "| Pacific Surf School | pacificsurfschool.com | pacificsurf@pacificsurf.org | San Diego | sent | | |",
  "| North Shore Surf Girls | northshoresurfgirls.com | 808-637-2977 | Haleiwa | queued | | phone only |",
  "",
  "## Surf Bloggers & Micro-Influencers",
  "| Target | Website/Channel | Contact | Nearest Beach | Status | Date | Notes |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  "| Ben Gravy | YouTube 520K | ben@bengravy.com | East Coast | queued | | |",
  "",
  "### Rejected — do not draft (verified dead 2026-08-04)",
  "| Target | Website | Reason |",
  "| --- | --- | --- |",
  "| Zuma Jay Surfboards | zmjay.com | NXDOMAIN |",
  "",
  "## Publication Pitches",
  "| Publication | Contact | Angle | Status | Date |",
  "| --- | --- | --- | --- | --- |",
  "| Eos | eos@agu.org | Nearshore ground truth | queued | |",
  "| Adventure Journal | contact form only | Surf data story | rejected | |",
  "",
  "## Monthly Metrics",
  "| Month | Outreach Sent |",
  "| --- | --- |",
  "| April 2026 | |",
].join("\n");

describe("SEO workflow outreach digest", () => {
  it("maps week-of-month to the rotation category and cycles past week 4", () => {
    expect(resolveOutreachRotation("2026-07-06")).toEqual({
      week: 1,
      category: "surf-schools",
    });
    expect(resolveOutreachRotation("2026-07-08")).toEqual({
      week: 2,
      category: "surf-bloggers",
    });
    expect(resolveOutreachRotation("2026-07-15")).toEqual({
      week: 3,
      category: "coastal-businesses",
    });
    expect(resolveOutreachRotation("2026-07-22")).toEqual({
      week: 4,
      category: "publications",
    });
    expect(resolveOutreachRotation("2026-07-29")).toEqual({
      week: 1,
      category: "surf-schools",
    });
  });

  it("parses target rows by section and ignores legend and metrics tables", () => {
    const parsed = parseOutreachTracker(TRACKER);

    expect(parsed.totalRows).toBe(7);
    expect(parsed.statusCounts).toEqual({ queued: 4, sent: 1, rejected: 2 });
    expect(parsed.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        target: "Surf Diva",
        category: "surf-schools",
        nearestBeach: "La Jolla",
        status: "queued",
      }),
      expect.objectContaining({
        target: "Ben Gravy",
        category: "surf-bloggers",
        status: "queued",
      }),
    ]));
    expect(parsed.rows.some((row) => row.target === "April 2026")).toBe(false);
    expect(parsed.rows.some((row) => row.target === "queued")).toBe(false);
  });

  it("builds queued candidates for the current rotation category and flags contact research", () => {
    const digest = buildOutreachDigest("2026-07-06T12:00:00Z", {
      reportDate: "2026-07-06",
      markdown: TRACKER,
    });

    expect(digest.rotationWeek).toBe(1);
    expect(digest.rotationCategory).toBe("surf-schools");
    expect(digest.candidates).toHaveLength(2);
    expect(digest.candidates[0]?.target).toBe("Surf Diva");
    expect(digest.candidates[0]?.nearestBeach).toBe("La Jolla");
    expect(digest.candidates[0]?.subject).toContain("La Jolla");
    expect(digest.candidates[0]?.body).toContain("Hi Surf Diva team,");
    expect(digest.candidates[0]?.body).toContain(
      "https://www.quiversurf.app/for-surf-schools",
    );
    expect(digest.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        target: "North Shore Surf Girls",
        requiresContactResearch: true,
      }),
      expect.objectContaining({
        target: "Surf Diva",
        requiresContactResearch: false,
      }),
    ]));
  });

  it("marks rows under a rejection heading as rejected even without a status column", () => {
    const parsed = parseOutreachTracker(TRACKER);
    const zuma = parsed.rows.find((row) => row.target === "Zuma Jay Surfboards");

    expect(zuma?.status).toBe("rejected");
    expect(parsed.statusCounts.rejected).toBe(2);
  });

  it("never offers rejected rows as draft candidates", () => {
    const surfSchools = buildOutreachDigest("2026-08-31T00:00:00.000Z", {
      reportDate: "2026-08-31",
      markdown: TRACKER,
    });
    expect(surfSchools.rotationCategory).toBe("surf-schools");
    expect(surfSchools.candidates.map((c) => c.target)).not.toContain(
      "Zuma Jay Surfboards",
    );

    const publications = buildOutreachDigest("2026-08-24T00:00:00.000Z", {
      reportDate: "2026-08-24",
      markdown: TRACKER,
    });
    expect(publications.rotationCategory).toBe("publications");
    expect(publications.candidates.map((c) => c.target)).toEqual(["Eos"]);
  });

  it("ignores narrative tables that declare no status column", () => {
    const withNarrative = [
      TRACKER,
      "",
      "### Warm leads that went cold",
      "| Target | Replied | What they said |",
      "| --- | --- | --- |",
      "| Stab Magazine | 2026-07-29 | Working on a piece |",
    ].join("\n");

    const parsed = parseOutreachTracker(withNarrative);
    expect(parsed.rows.map((row) => row.target)).not.toContain("Stab Magazine");

    const digest = buildOutreachDigest("2026-08-24T00:00:00.000Z", {
      reportDate: "2026-08-24",
      markdown: withNarrative,
    });
    expect(digest.candidates.map((c) => c.target)).toEqual(["Eos"]);
  });

  it("hasDirectEmail requires an @ in the contact field", () => {
    expect(hasDirectEmail({ category: "surf-schools", target: "A", contact: "hi@example.com", status: "queued" })).toBe(true);
    expect(hasDirectEmail({ category: "surf-schools", target: "A2", contact: "  hi@example.com  ", status: "queued" })).toBe(true);
    expect(hasDirectEmail({ category: "surf-schools", target: "A3", contact: "mailto:hi@example.com", status: "queued" })).toBe(true);
    expect(hasDirectEmail({ category: "surf-schools", target: "A4", contact: "808-637-2977 / hi@example.com", status: "queued" })).toBe(true);
    expect(hasDirectEmail({ category: "surf-schools", target: "A5", contact: "first@example.com, second@example.com", status: "queued" })).toBe(true);
    expect(hasDirectEmail({ category: "surf-schools", target: "B", contact: "808-637-2977", status: "queued" })).toBe(false);
    expect(hasDirectEmail({ category: "surf-schools", target: "C", contact: "contact form only", status: "queued" })).toBe(false);
    expect(hasDirectEmail({ category: "surf-schools", target: "C2", contact: "   ", status: "queued" })).toBe(false);
    expect(hasDirectEmail({ category: "surf-schools", target: "D", status: "queued" })).toBe(false);
  });

  it("selects the rotation category from the report date", () => {
    const digest = buildOutreachDigest("2026-07-08T12:00:00Z", {
      reportDate: "2026-07-08",
      markdown: TRACKER,
    });

    expect(digest.rotationCategory).toBe("surf-bloggers");
    expect(digest.candidates.map((candidate) => candidate.target)).toEqual(["Ben Gravy"]);
  });

  it("records a missing note when the rotation category has no queued targets", () => {
    const digest = buildOutreachDigest("2026-07-15T12:00:00Z", {
      reportDate: "2026-07-15",
      markdown: TRACKER,
    });

    expect(digest.rotationCategory).toBe("coastal-businesses");
    expect(digest.candidates).toHaveLength(0);
    expect(digest.missing).toEqual(expect.arrayContaining([
      expect.stringContaining("coastal-businesses"),
    ]));
  });
  // The fixture above uses a "Nearest Beach" header, which is not what the live
  // tracker writes. Real tables are headed "Beach slug (verified 200)" and
  // "Nearest Beach (verified 200)", so the old exact-match lookup returned
  // undefined and every draft went out with the "your local breaks" placeholder —
  // producing the subject "Free ML surf forecasts for your your local breaks crew"
  // on the 2026-08-31 Hans Hedemann and Nor Cal drafts.
  it("reads the beach column from the live tracker's real header names", () => {
    const liveTracker = [
      "## Surf School Targets",
      "### Hawaii",
      "| Target | Website | Beach slug (verified 200) | Contact channel (verified) | Status | Date | Notes |",
      "| --- | --- | --- | --- | --- | --- | --- |",
      "| Hans Hedemann Surf School | hhsurf.com | `waikiki-beach` | info@hhsurf.com | queued | | |",
      "",
      "## Coastal Businesses (Hotels, Tourism, Shops)",
      "| Target | Website | Nearest Beach (verified 200) | Contact | Status | Date | Notes |",
      "| --- | --- | --- | --- | --- | --- | --- |",
      "| Glide Surf Co | glidesurfco.com | `asbury-park-asbury-park-nj` | info@glidesurfco.com | queued | | |",
    ].join("\n");

    const schools = buildOutreachDigest("2026-08-31T12:00:00Z", {
      reportDate: "2026-08-31",
      markdown: liveTracker,
    });
    expect(schools.candidates[0]?.nearestBeach).toBe("waikiki-beach");
    expect(schools.candidates[0]?.subject).toBe("Free surf forecasts for Waikiki Beach");
    expect(schools.candidates[0]?.subject).not.toMatch(/your your/);

    const shops = buildOutreachDigest("2026-08-17T12:00:00Z", {
      reportDate: "2026-08-17",
      markdown: liveTracker,
    });
    expect(shops.rotationCategory).toBe("coastal-businesses");
    // Trailing state code dropped so the slug reads as a place name.
    expect(shops.candidates[0]?.subject).toBe(
      "Free live surf conditions for Asbury Park Asbury Park visitors",
    );
  });

  // Quiver ships no live ML forecast: ML corrections have been off since
  // 2026-04-23. Outreach copy going out over Steven's name must never claim one.
  it("never claims ML or AI forecasting in any rotation category's copy", () => {
    for (const reportDate of ["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24"]) {
      const digest = buildOutreachDigest(`${reportDate}T12:00:00Z`, {
        reportDate,
        markdown: TRACKER,
      });

      for (const candidate of digest.candidates) {
        const copy = `${candidate.subject} ${candidate.body}`;
        expect(copy).not.toMatch(/\bML\b|machine.learning|\bAI\b|ML-powered|ML-tuned/i);
      }
    }
  });
});
