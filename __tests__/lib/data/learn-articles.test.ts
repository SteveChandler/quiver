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
    title: "Wind Swell vs Groundswell: Tell Them Apart by Period",
    description:
      "Under 10 seconds is wind swell: choppy, weak, quick to fade. Past 12 seconds is groundswell: long lines and real push. How to read which one is arriving.",
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
    title: "Best Time of Day to Surf: Why Morning Usually Wins",
    description:
      "Dawn usually wins on wind, but not always. What makes morning surf cleaner, when an afternoon glass-off beats it, and how to check today's window.",
  },
  {
    slug: "is-it-safe-to-surf-after-rain",
    title: "Is It Safe to Surf in the Rain or After It Rains?",
    description:
      "Light rain is fine; runoff after heavy rain is not. When the 72-hour rule applies, how to spot a dirty lineup, and where to surf instead.",
  },
  {
    slug: "how-to-read-surf-conditions",
    title: "How to Read a Surf Report: Forecast & Conditions Guide",
    description:
      "Learn how to read a surf report or surf forecast: period, direction, wind, tide, and wave height, plus what changes at your break.",
  },
  {
    slug: "how-are-waves-measured",
    title: "How Big Is 3 ft Surf? Face Height vs Hawaiian Scale",
    description:
      "A 3-5 ft forecast is significant wave height. Faces run 1.5-2x that, so 4.5-10 ft; Hawaiian scale calls the same wave half. Know which you're reading.",
  },
  {
    slug: "beginner-breaks-santa-cruz",
    title: "Beginner Surf Spots in Santa Cruz: Cowell's to Capitola",
    description:
      "Santa Cruz's gentlest waves: Cowell's, Capitola, and Jack's at Pleasure Point, plus what 48-58°F water means for your wetsuit and when each spot works.",
  },
  {
    slug: "how-long-to-learn-to-surf",
    title: "How Long Does It Take to Learn to Surf? By Milestone",
    description:
      "Standing in whitewater takes 1-3 sessions; riding green waves down the line takes months. The realistic timeline by milestone and what speeds it up.",
  },
  {
    slug: "how-are-ocean-waves-formed",
    title: "What Causes Ocean Waves? How Wind Builds Swell",
    description:
      "Wind speed, duration, and fetch decide wave size. How a storm's energy becomes a swell that crosses an ocean, and why every forecast starts with the wind.",
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

  it("answers surfing during rain so the rain title is not a promise the page breaks", () => {
    const article = learnArticles.find(({ slug }) => slug === "is-it-safe-to-surf-after-rain");
    const section = article?.sections.find(({ id }) => id === "surfing-while-raining");

    expect(section?.heading).toBe("Surfing While It Is Raining");
    expect(section?.content).toMatch(/lightning/i);
    expect(section?.content).toMatch(/72-hour/i);
  });

  it("does not claim a machine-learning forecast in learn metadata", () => {
    // Quiver ships no live ML forecast; metadata must not assert one.
    for (const article of learnArticles) {
      for (const keyword of article.keywords) {
        expect(keyword.toLowerCase()).not.toMatch(/machine learning/);
      }
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
