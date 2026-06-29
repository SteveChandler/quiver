/**
 * @jest-environment node
 *
 * Snapshot-style coverage for the Phase 2 "Best days this week" section on
 * WeeklyRecapEmail. Complements weekly-digest-similarity-section.test.ts:
 *   - empty bestDays → section omitted (no "Best days this week" header)
 *   - populated bestDays → section present with exactly 3 rows in the
 *     order provided (expected to be score-desc per cron contract)
 *   - labels are design-system values (EPIC / GOOD / FAIR), not
 *     Perfect/Great/Good
 */

import { renderToStaticMarkup } from "react-dom/server";

import {
  WeeklyRecapEmail,
  type BestDaySlot,
} from "@/lib/mailer/templates/WeeklyRecapEmail";

function render(props: Parameters<typeof WeeklyRecapEmail>[0]): string {
  return renderToStaticMarkup(WeeklyRecapEmail(props) as any);
}

function labelHtml(html: string, label: string): string {
  const labelIndex = html.indexOf(`>${label}</span>`);
  expect(labelIndex).toBeGreaterThan(-1);
  return html.slice(Math.max(0, labelIndex - 220), labelIndex + label.length + 20);
}

const baseProps = {
  userName: "Steven",
  startDate: "Apr 14",
  endDate: "Apr 21",
  stats: { totalSessions: 3, totalHours: "4.5", topSpot: "Blacks" },
  ctaUrl: "https://quiversurf.app/profile/analytics",
  unsubscribeUrl: "https://quiversurf.app/ettings",
};

const sortedSlots: BestDaySlot[] = [
  {
    beach_name: "Torrey Pines",
    score: 8.4,
    label: "EPIC",
    weekday: "Friday",
    time: "7am",
  },
  {
    beach_name: "Blacks",
    score: 7.9,
    label: "GOOD",
    weekday: "Saturday",
    time: "8am",
  },
  {
    beach_name: "Swamis",
    score: 6.8,
    label: "FAIR",
    weekday: "Sunday",
    time: "7am",
  },
];

describe("WeeklyRecapEmail: best-days-this-week render coverage", () => {
  it("omits the section when bestDays is empty", () => {
    const html = render({ ...baseProps, bestDays: [] });
    expect(html).not.toContain("Best days this week");
    // Sanity: the rest of the email still renders.
    expect(html).toContain("Weekly Recap");
    expect(html).toContain("Nice work, Steven.");
  });

  it("omits the section when bestDays is undefined", () => {
    const html = render({ ...baseProps });
    expect(html).not.toContain("Best days this week");
    expect(html).toContain("Weekly Recap");
  });

  it("renders exactly 3 rows in score-desc order when 3 slots provided", () => {
    const html = render({ ...baseProps, bestDays: sortedSlots });

    expect(html).toContain("Best days this week");

    // Scope to the best-days block so topSpot/tats don't confuse index matching.
    const sectionStart = html.indexOf("Best days this week");
    expect(sectionStart).toBeGreaterThan(-1);
    const section = html.slice(sectionStart);

    // Each beach name appears in the section.
    const torreyIdx = section.indexOf("Torrey Pines");
    const blacksIdx = section.indexOf("Blacks");
    const swamisIdx = section.indexOf("Swamis");
    expect(torreyIdx).toBeGreaterThan(-1);
    expect(blacksIdx).toBeGreaterThan(-1);
    expect(swamisIdx).toBeGreaterThan(-1);

    // Score-desc ordering: 8.4 → 7.9 → 6.8
    expect(blacksIdx).toBeGreaterThan(torreyIdx);
    expect(swamisIdx).toBeGreaterThan(blacksIdx);

    // Each row carries weekday, time, score (one decimal), and label.
    expect(section).toContain("Friday 7am");
    expect(section).toContain("Saturday 8am");
    expect(section).toContain("Sunday 7am");
    expect(section).toContain("8.4");
    expect(section).toContain("7.9");
    expect(section).toContain("6.8");
  });

  it("uses design-system labels (EPIC / GOOD / FAIR), not Perfect/Great", () => {
    const html = render({ ...baseProps, bestDays: sortedSlots });
    expect(html).toContain("EPIC");
    expect(html).toContain("GOOD");
    expect(html).toContain("FAIR");
    expect(html).not.toContain("Perfect");
    expect(html).not.toContain("Great");
  });

  // Phase 2 design-system amendment: Paradise Gold is reserved for EPIC.
  // Lower bands (GOOD / FAIR) use Pacific Teal, RIDEABLE uses muted slate.
  // Thresholds mirror the native MatchScoreBadge.colorForScore helper.
  describe("score-band label colors", () => {
    it("renders EPIC (>= 8.5) with Paradise Gold", () => {
      const html = render({
        ...baseProps,
        bestDays: [
          {
            beach_name: "Torrey Pines",
            score: 9.0,
            label: "EPIC",
            weekday: "Friday",
            time: "7am",
          },
        ],
      });
      expect(labelHtml(html, "EPIC")).toContain("color:#FDB84B");
    });

    it("renders GOOD (>= 7.0) with Pacific Teal", () => {
      const html = render({
        ...baseProps,
        bestDays: [
          {
            beach_name: "Blacks",
            score: 7.9,
            label: "GOOD",
            weekday: "Saturday",
            time: "8am",
          },
        ],
      });
      const label = labelHtml(html, "GOOD");
      expect(label).toContain("color:#00D4AA");
      expect(label).not.toContain("color:#FDB84B");
    });

    it("renders FAIR (>= 6.0) with Pacific Teal", () => {
      const html = render({
        ...baseProps,
        bestDays: [
          {
            beach_name: "Swamis",
            score: 6.8,
            label: "FAIR",
            weekday: "Sunday",
            time: "7am",
          },
        ],
      });
      const label = labelHtml(html, "FAIR");
      expect(label).toContain("color:#00D4AA");
      expect(label).not.toContain("color:#FDB84B");
    });

    it("renders RIDEABLE (< 6.0) with a muted color, not Paradise Gold", () => {
      const html = render({
        ...baseProps,
        bestDays: [
          {
            beach_name: "Pacific Beach",
            score: 4.5,
            label: "RIDEABLE",
            weekday: "Monday",
            time: "7am",
          },
        ],
      });
      const label = labelHtml(html, "RIDEABLE");
      expect(label).toContain("color:#6B7280");
      expect(label).not.toContain("color:#FDB84B");
    });

    it("renders distinct colors per band when multiple rows span bands", () => {
      const html = render({
        ...baseProps,
        bestDays: [
          { beach_name: "A", score: 9.0, label: "EPIC", weekday: "Fri", time: "7am" },
          { beach_name: "B", score: 7.9, label: "GOOD", weekday: "Sat", time: "8am" },
          { beach_name: "C", score: 6.8, label: "FAIR", weekday: "Sun", time: "7am" },
          { beach_name: "D", score: 4.5, label: "RIDEABLE", weekday: "Mon", time: "7am" },
        ],
      });
      // All three band colors appear — not all Paradise Gold like the bug.
      expect(html).toContain("#FDB84B");
      expect(html).toContain("#00D4AA");
      expect(html).toContain("#6B7280");
    });
  });
});
