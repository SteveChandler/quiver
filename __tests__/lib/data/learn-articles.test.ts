import { learnArticles } from "@/lib/data/learn-articles";

const expectedLearnMetadata = [
  {
    slug: "surf-paddling-for-beginners",
    title: "Surf Paddling for Beginners: Technique & Paddle-Out Guide",
    description:
      "Learn beginner surf paddling technique, how to judge the paddle-out, conserve energy, and choose a manageable beginner window before you go.",
  },
  {
    slug: "best-surf-conditions-for-beginners",
    title: "Best Surf Conditions for Beginners: Size, Wind & Tide",
    description:
      "Learn the best beginner surf conditions: 1-3 ft waves, 12+ sec period, light offshore wind, mid tide, and lower-crowd windows before you paddle out.",
  },
  {
    slug: "how-accurate-are-surf-forecasts",
    title: "How Accurate Are Surf Forecasts? 3-Day vs 10-Day Guide",
    description:
      "How accurate are surf forecasts? Learn how lead time changes uncertainty, what buoys measure, and what a fair forecast comparison requires.",
  },
  {
    slug: "swell-period-explained",
    title: "Swell Period Explained: What Seconds Mean for Surf",
    description:
      "Swell period explained for surfers: what 6, 10, 12, and 16 seconds mean, when long period helps, and how to read period in a forecast.",
  },
  {
    slug: "groundswell-vs-wind-swell",
    title: "Groundswell vs Wind Swell: What Makes Better Surf?",
    description:
      "Groundswell comes from distant storms with 12+ second period and organized waves. Wind swell comes from local wind with 5-9 second period and choppy surf.",
  },
  {
    slug: "how-do-tides-work",
    title: "How Tides Work for Surfing: Tide Timing Guide",
    description:
      "Learn how tides work for surfing: why high and low tide shift, what spring and neap tides mean, and how tide timing changes wave shape.",
  },
  {
    slug: "offshore-vs-onshore-wind-surfing",
    title: "Offshore vs Onshore Wind: Best Wind for Surfing",
    description:
      "Offshore vs onshore wind explained: which wind cleans up surf, how much is too much, and how to use wind direction before choosing a break.",
  },
  {
    slug: "best-time-of-day-to-surf",
    title: "Best Time of Day to Surf: Dawn Patrol vs Glass-Off",
    description:
      "Find the best time of day to surf: dawn patrol, midday wind risk, and glass-off windows, plus how to check today's local forecast.",
  },
  {
    slug: "is-it-safe-to-surf-after-rain",
    title: "Is It Safe to Surf After Rain? The 72-Hour Rule",
    description:
      "Is it safe to surf after rain? Use the 72-hour rule, runoff risk signs, water-quality checks, and safer open-coast choices.",
  },
  {
    slug: "how-to-read-surf-conditions",
    title: "How to Read a Surf Report: Forecast & Conditions Guide",
    description:
      "Learn how to read a surf report or surf forecast: period, direction, wind, tide, and wave height, plus what changes at your break.",
  },
];

describe("learn article SEO metadata", () => {
  it("uses click-oriented titles and descriptions for ranking zero-click pages", () => {
    for (const expected of expectedLearnMetadata) {
      const article = learnArticles.find(({ slug }) => slug === expected.slug);

      expect(article?.slug).toBe(expected.slug);
      expect(article?.title).toBe(expected.title);
      expect(article?.description).toBe(expected.description);
      expect(article!.description.length).toBeLessThanOrEqual(155);
    }
  });

  it("connects the paddling guide to live beginner decisions without claiming safety", () => {
    const article = learnArticles.find(
      ({ slug }) => slug === "surf-paddling-for-beginners",
    );
    const difficultySection = article?.sections.find(
      ({ id }) => id === "difficulty-near-you",
    );

    expect(difficultySection?.heading).toBe(
      "Paddling Difficulty Near You Today",
    );
    expect(difficultySection?.content).toContain(
      'href="/beginner/huntington-beach"',
    );
    expect(difficultySection?.content).toContain(
      'href="/beginner/san-diego"',
    );
    expect(difficultySection?.content).toMatch(/planning insert/i);
    expect(article?.relatedLinks.some(({ href }) =>
      href.startsWith("/beginner/"),
    )).toBe(true);
  });
});
