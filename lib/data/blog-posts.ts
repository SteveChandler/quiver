export interface BlogMetric {
  label: string;
  value: string;
}

export interface BlogSection {
  id: string;
  heading: string;
  paragraphs: string[];
  bullets?: string[];
  metrics?: BlogMetric[];
  callout?: string;
}

export interface BlogRelatedLink {
  label: string;
  href: string;
  description: string;
}

export interface BlogPost {
  slug: string;
  title: string;
  seoTitle: string;
  description: string;
  seoDescription: string;
  excerpt: string;
  author: string;
  readingTimeMin: number;
  datePublished: string;
  dateModified?: string;
  heroImage: string;
  tags: string[];
  keywords: string[];
  sections: BlogSection[];
  relatedLinks: BlogRelatedLink[];
  wordCount: number;
}

export const blogPosts: BlogPost[] = [
  {
    slug: "fun-observation-session-logs",
    title: "A Fun Observation About Session Logs",
    seoTitle: "Surf Session Logs as a Forecast Signal",
    description:
      "Early Quiver session reports are not buoy truth. They are a signal we can compare against other surfers' observations and buoy observations, then learn from over time.",
    seoDescription:
      "What Quiver learned comparing surfer session wave reports with forecast output, other surfer observations, and buoy truth before training on the signal.",
    excerpt:
      "I compared early session wave reports against buoy truth. The answer was not magic. It was still useful.",
    author: "Steven Chandler",
    readingTimeMin: 4,
    datePublished: "2026-05-21",
    dateModified: "2026-05-21",
    heroImage: "/images/learn/learn-surfer-watching.jpg",
    tags: ["Founder notes", "Session logs", "Forecast transparency"],
    keywords: [
      "surf session logs",
      "surf forecast signal",
      "wave height reports",
      "surfer observations",
      "buoy observations",
      "forecast accuracy",
      "Quiver surf app",
    ],
    wordCount: 920,
    sections: [
      {
        id: "setup",
        heading: "The Setup",
        paragraphs: [
          "I wanted to know something pretty simple: when a surfer logs a session and says it was 2-3 ft, can that help the forecast?",
          "Not in the hand-wavy way. Not \"users make the model smarter\" because that sounds nice in a pitch deck. I mean the boring version: can a normal surfer, who is not a trained observer and probably just wants to save their session before driving home, give us a signal that is useful enough to measure?",
          "The answer so far is yes, but carefully. Very carefully.",
        ],
        callout:
          "User reports sit next to the forecast and the buoy. They do not replace either one.",
      },
      {
        id: "why-not-ground-truth",
        heading: "People Are Not Buoys",
        paragraphs: [
          "Quiver already lets surfers log sessions: beach, time, board, rating, notes, photos, wave height. The obvious temptation is to take that reported wave height and shove it straight into the forecast pipeline as truth.",
          "That would be a bad idea.",
          "People round. People remember the set wave, not the average. People call something 4 ft because one wave stood up, or 2 ft because they were annoyed, or chest-high because that is more natural than thinking in meters.",
          "So we did not promote session logs into ground truth. A completed session with a valid wave height now becomes a candidate observation. It gets matched to the nearest forecast row for the same beach within plus or minus 6 hours. We snapshot the forecast values at that moment. We keep the actual buoy observation separate.",
        ],
      },
      {
        id: "first-read",
        heading: "The First Read",
        paragraphs: [
          "After backfilling existing real sessions, the first sample was tiny. Still useful.",
          "The user reports were off from buoy truth by about 0.294m MAE. For context, the forecast display height was at 0.249m MAE, raw Open-Meteo was 0.254m MAE, and the v5 shadow forecast was 0.259m MAE on the same overlap.",
          "So no, users are not beating the forecast out of the gate. But they are not nonsense either. That is the interesting part.",
        ],
        metrics: [
          { label: "Real completed sessions", value: "23" },
          { label: "Valid height reports", value: "21" },
          { label: "Matched to forecast within +/-6h", value: "20" },
          { label: "Matched with buoy truth", value: "20" },
          { label: "User vs buoy MAE", value: "0.294m" },
          { label: "Signed bias", value: "-0.053m" },
        ],
      },
      {
        id: "encouraging-part",
        heading: "The Weirdly Encouraging Part",
        paragraphs: [
          "The user reports beat the displayed forecast on 7 of 20 buoy-overlap cases. They beat the v5 shadow forecast on 6 of 14 comparable cases.",
          "That is not enough to train on blindly. It is enough to say there is signal here.",
          "The average signed bias was -0.053m, which means the reports were slightly low on average. Not wildly low. Not obviously unusable. Just a little under.",
          "That tracks with how surfers talk. A lot of people report the surf in ranges. \"2-3 ft.\" \"Chest high.\" \"Kinda waist.\" That is not a lab instrument. It is a human compression format.",
        ],
      },
      {
        id: "what-changes",
        heading: "What This Changes",
        paragraphs: [
          "For now, nothing changes in the ML pipeline. That is the point.",
          "The session reports are stored as candidate observations with an informational weight. They do not update ml_predictions_log.observed_m. They do not affect training. They do not affect promotion gates. They do not move forecast accuracy reports.",
          "Buoys remain truth. Session reports become analytics.",
        ],
        bullets: [
          "Which users are consistently close to buoy truth?",
          "Which beaches have reliable session reports?",
          "Do some people over-report or under-report wave height?",
          "Are reports closer when the forecast match is within 30 minutes instead of 3 hours?",
          "Do session logs help us find cases where the model missed local surf?",
        ],
      },
      {
        id: "quiver-thesis",
        heading: "Why This Is Actually The Quiver Thesis",
        paragraphs: [
          "The whole point of Quiver is that your session log should matter.",
          "Not as a diary stapled onto a forecast app. As an input.",
          "The wrong way is to say, \"The user said it was 3 ft, so the model was wrong.\"",
          "The right way is to say: this surfer reported 3 ft at this beach at this time. The forecast said 2.4 ft. The buoy said 2.6 ft. Other surfers saw something similar. Over time, maybe we should start listening to that pattern.",
          "That is not as flashy. It is a lot more useful.",
        ],
        callout:
          "Show the forecast. Let surfers make the call. Let them log what happened. Compare it against other surfers' observations and buoy observations. Learn over time.",
      },
    ],
    relatedLinks: [
      {
        label: "See the Roadmap",
        href: "/roadmap",
        description:
          "Follow what Quiver is building next and vote on the surf-planning features that matter.",
      },
      {
        label: "Learn How Surf Forecasts Work",
        href: "/learn/how-surf-forecasts-work",
        description:
          "Read how models, buoys, and local context turn into the forecast you see.",
      },
      {
        label: "Forecast Accuracy",
        href: "/forecast-accuracy",
        description:
          "See how Quiver compares forecast outputs against observed buoy truth.",
      },
    ],
  },
];

export function getBlogPost(slug: string): BlogPost | null {
  return blogPosts.find((post) => post.slug === slug) ?? null;
}

export function getNextBlogPost(slug: string): BlogPost | null {
  const index = blogPosts.findIndex((post) => post.slug === slug);
  if (index === -1 || blogPosts.length < 2) return null;
  return blogPosts[(index + 1) % blogPosts.length];
}
