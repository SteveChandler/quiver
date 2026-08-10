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

    expect(parsed.totalRows).toBe(4);
    expect(parsed.statusCounts).toEqual({ queued: 3, sent: 1 });
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

  it("builds queued draft candidates for the current rotation category, skipping rows without a direct email", () => {
    const digest = buildOutreachDigest("2026-07-06T12:00:00Z", {
      reportDate: "2026-07-06",
      markdown: TRACKER,
    });

    expect(digest.rotationWeek).toBe(1);
    expect(digest.rotationCategory).toBe("surf-schools");
    expect(digest.candidates).toHaveLength(1);
    expect(digest.candidates[0]?.target).toBe("Surf Diva");
    expect(digest.candidates[0]?.nearestBeach).toBe("La Jolla");
    expect(digest.candidates[0]?.subject).toContain("La Jolla");
    expect(digest.candidates[0]?.body).toContain("Hi Surf Diva team,");
    expect(digest.candidates[0]?.body).toContain(
      "https://www.quiversurf.app/for-surf-schools",
    );
    expect(digest.candidates.some((candidate) => candidate.target === "North Shore Surf Girls")).toBe(false);
    expect(digest.missing).toEqual(expect.arrayContaining([
      expect.stringContaining("North Shore Surf Girls"),
    ]));
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
});
