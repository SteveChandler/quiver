/**
 * @jest-environment node
 *
 * Tests for the Phase 2 "Best days this week" section appended to the weekly
 * digest email (WeeklyRecapEmail). The section lists the user's top upcoming
 * similarity-match forecast slots across their subscribed beaches for the
 * next 7 days (scored via compute_user_match_score, threshold >= 6).
 *
 * Rendered test output asserts:
 *   - section header text is present
 *   - each BestDaySlot row renders beach, score, label, weekday, time
 *   - rows are ordered by score desc
 *   - section is omitted entirely when bestDays is empty/undefined (no
 *     empty block rendered)
 */

import { renderToStaticMarkup } from "react-dom/server";

import {
  WeeklyRecapEmail,
  type BestDaySlot,
} from "@/lib/mailer/templates/WeeklyRecapEmail";

function render(props: Parameters<typeof WeeklyRecapEmail>[0]): string {
  return renderToStaticMarkup(WeeklyRecapEmail(props) as any);
}

const baseProps = {
  userName: "Steven",
  startDate: "Apr 14",
  endDate: "Apr 21",
  stats: { totalSessions: 3, totalHours: "4.5", topSpot: "Blacks" },
  ctaUrl: "https://quiversurf.app/profile/analytics",
  unsubscribeUrl: "https://quiversurf.app/settings",
};

describe("WeeklyRecapEmail: Best days this week section", () => {
  it("omits the section when bestDays is empty", () => {
    const html = render({ ...baseProps, bestDays: [] });
    expect(html).not.toContain("Best days this week");
  });

  it("omits the section when bestDays is undefined", () => {
    const html = render({ ...baseProps });
    expect(html).not.toContain("Best days this week");
  });

  it("renders the section header and rows sorted by score desc", () => {
    const slots: BestDaySlot[] = [
      {
        beach_name: "Torrey Pines",
        score: 8.4,
        label: "EPIC",
        weekday: "Thursday",
        time: "6am",
      },
      {
        beach_name: "Blacks",
        score: 7.9,
        label: "GOOD",
        weekday: "Saturday",
        time: "8am",
      },
    ];
    const html = render({ ...baseProps, bestDays: slots });

    expect(html).toContain("Best days this week");
    expect(html).toContain("Torrey Pines");
    expect(html).toContain("8.4");
    expect(html).toContain("EPIC");
    expect(html).toContain("Thursday");
    expect(html).toContain("6am");
    expect(html).toContain("Blacks");
    expect(html).toContain("7.9");
    expect(html).toContain("GOOD");
    expect(html).toContain("Saturday");
    expect(html).toContain("8am");

    // Ordering: inside the Best-days section, Torrey Pines (8.4) must
    // appear before Blacks (7.9). We slice the HTML from the section
    // header onward so the topSpot Stats block doesn't confuse the match.
    const sectionStart = html.indexOf("Best days this week");
    const section = html.slice(sectionStart);
    const torreyIdx = section.indexOf("Torrey Pines");
    const blacksIdx = section.indexOf("Blacks");
    expect(torreyIdx).toBeGreaterThan(-1);
    expect(blacksIdx).toBeGreaterThan(torreyIdx);
  });
});
