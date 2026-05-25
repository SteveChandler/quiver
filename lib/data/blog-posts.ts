import type { QuiverStickerKey } from "@/lib/ui/quiver-sticker-assets";

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
  sticker: QuiverStickerKey;
  tags: string[];
  keywords: string[];
  sections: BlogSection[];
  relatedLinks: BlogRelatedLink[];
  wordCount: number;
}

export const blogPosts: BlogPost[] = [
  {
    slug: "why-quiver-is-built-around-one-surf-call",
    title: "How Quiver is built for surfers",
    seoTitle: "How Quiver is built for surfers",
    description:
      "Quiver is building a better forecast by comparing surf calls with real surfer feedback at local beaches.",
    seoDescription:
      "Why Quiver uses surfer feedback, session logs, and local beach observations to make surf forecasts more useful over time.",
    excerpt:
      "The goal is not to be the oracle. It is to compare the forecast with what surfers actually find at local beaches, then learn from that pattern.",
    author: "Steven Chandler",
    readingTimeMin: 5,
    datePublished: "2026-05-24",
    dateModified: "2026-05-24",
    heroImage: "/images/learn/learn-surfer-watching.jpg",
    sticker: "blogClearerCall",
    tags: ["Founder notes", "Clearer calls", "Product loop"],
    keywords: [
      "surf call app",
      "surf forecast feedback loop",
      "surf session log",
      "Quiver surf forecast",
      "surf forecast app",
      "surf forecast accuracy",
    ],
    wordCount: 1080,
    sections: [
      {
        id: "why-a-clearer-call",
        heading: "Why A Clearer Call",
        paragraphs: [
          "I am not trying to make Quiver the final word on whether anyone should paddle out. Surf is too local and too weird for that. The goal is smaller and more useful: make the call clearer before you leave the house.",
          "Most forecast products still leave surfers bouncing between charts, cams, tides, wind, and text reports until they are making the decision themselves anyway. Quiver should do more of that synthesis up front, then learn from what surfers actually find at the beach.",
          "That feedback loop is the product: forecast the local beach, let surfers check the lineup, log what happened, and use the pattern to make the next call more useful.",
        ],
        callout:
          "The product opinion is simple: local forecasts get better when real sessions become useful feedback.",
      },
      {
        id: "the-loop",
        heading: "The Loop",
        paragraphs: [
          "The part I care about most is what happens after the forecast. Quiver makes a call. A surfer checks the beach. The surfer logs the session. Then we compare what happened with the forecast, buoy data, and other observations.",
          "That loop is slower than a marketing claim and more useful than a slogan. It gives us a way to separate a lucky guess from a forecast pattern that keeps showing up at the same beach.",
          "If a spot keeps breaking softer than the model expects on a certain tide, that should eventually matter. If a surfer consistently reports conditions close to buoy truth, that should eventually matter too.",
        ],
      },
      {
        id: "session-logs",
        heading: "Why Session Logs Matter",
        paragraphs: [
          "A session log is not ground truth. People round. People remember the best set. People describe waves in human terms because that is how surfers talk.",
          "That does not make the log useless. It makes it a signal that needs context. A wave-height report is more interesting when it sits next to the forecast, the buoy, the tide, and other surfers' notes from the same window.",
          "The long-term value is not that one person says the forecast was wrong. The value is that repeated session logs can show where the forecast keeps missing what surfers actually saw.",
        ],
      },
      {
        id: "what-quiver-does-not-claim",
        heading: "What Quiver Does Not Claim",
        paragraphs: [
          "Quiver does not claim that a session log instantly changes the forecast. It does not treat every surfer report as a buoy. It does not pretend the model is finished.",
          "The current product is honest about the stage it is in. Forecasts are useful now, and the feedback loop is how they can get more useful over time.",
          "That is the difference between a surf diary stapled onto a forecast app and a surf app that can learn from the way people actually paddle out.",
        ],
      },
      {
        id: "what-to-do-next",
        heading: "What To Do Next",
        paragraphs: [
          "Use Quiver the way you already surf. Check the call, look at the beach if you can, paddle out when it makes sense, and log what happened after.",
          "The more real sessions the product can compare against forecasts and observations, the less generic the surf call can become.",
          "That is the whole point: fewer tabs before dawn, better memory after the session, and a forecast loop that keeps getting tested by the water.",
        ],
      },
    ],
    relatedLinks: [
      {
        label: "Founding Access Waitlist",
        href: "/pricing",
        description:
          "Join early and help shape the clearer-call loop while plans remain gated.",
      },
      {
        label: "Forecast Accuracy",
        href: "/forecast-accuracy",
        description:
          "See how Quiver compares forecasts with observed buoy data.",
      },
      {
        label: "Log A Session",
        href: "/sessions/new",
        description:
          "Save what happened after a surf and turn the session into useful signal.",
      },
    ],
  },
  {
    slug: "how-to-pick-a-surf-spot-before-dawn",
    title: "How To Pick A Surf Spot Before Dawn",
    seoTitle: "How To Pick A Surf Spot Before Dawn",
    description:
      "A practical dawn-patrol checklist for choosing a surf spot with swell, wind, tide, water temp, and local context before the first session of the day.",
    seoDescription:
      "Use this dawn-patrol surf checklist to choose a beach before sunrise with swell direction, wind, tide, water temperature, and Quiver spot pages.",
    excerpt:
      "Before sunrise, you do not need every chart open. You need to know which beach has the best shot and what could ruin it.",
    author: "Steven Chandler",
    readingTimeMin: 6,
    datePublished: "2026-05-23",
    dateModified: "2026-05-23",
    heroImage: "/images/learn/learn-dawn-patrol.jpg",
    sticker: "blogDawnPatrol",
    tags: ["Dawn patrol", "Surf planning", "Forecast guide"],
    keywords: [
      "dawn patrol surf",
      "how to pick a surf spot",
      "surf forecast checklist",
      "best time to surf",
      "tide surf forecast",
      "water temp surfing",
      "San Diego surf forecast",
    ],
    wordCount: 1180,
    sections: [
      {
        id: "start-with-the-window",
        heading: "Start With The Window",
        paragraphs: [
          "The first question before dawn is not which spot is famous. It is when the window opens. A beach that looks average at first light can be the right call if the tide, wind, and swell line up for the next two hours.",
          "Start with the surf window, then pick the beach. If you do it the other way around, you end up trying to force one spot into conditions it does not want.",
          "Quiver's forecast pages are built for that decision: look for the best part of the morning, then check which nearby beaches match it.",
        ],
      },
      {
        id: "check-swell-direction",
        heading: "Check Swell Direction",
        paragraphs: [
          "Swell height gets attention, but direction decides whether a beach actually receives it. A west swell can light up one stretch of coast while a more sheltered beach barely moves.",
          "Before driving, ask whether the spot faces the swell. Open beaches usually pick up more energy. Protected coves may need a cleaner angle or more size to work.",
          "If the forecast looks good but the beach is shadowed from that direction, treat the call as fragile.",
        ],
      },
      {
        id: "watch-the-wind",
        heading: "Watch The Wind",
        paragraphs: [
          "Dawn patrol works because the wind often starts lighter. That does not mean it stays clean. A forecast that shows light offshore or calm wind at sunrise can fall apart once the local breeze turns onshore.",
          "The practical move is to decide how long you need. A short clean window is enough if you can paddle out quickly. If you need to drive, park, suit up, and meet friends, a one-hour window may already be gone.",
          "Good dawn-patrol planning is mostly about respecting the clock.",
        ],
      },
      {
        id: "match-the-tide",
        heading: "Match The Tide To The Beach",
        paragraphs: [
          "Tide changes the shape of a wave even when the swell stays the same. Some beach breaks need water over the sandbar. Some reefs need less water to stand up. Some spots get backwash or shut down at the wrong tide.",
          "Use tide as a beach filter. If one spot likes mid tide and another needs more water, the right choice may change halfway through the morning.",
          "This is where checking a city tide page and the individual beach page together helps. You are not just checking the tide. You are checking whether that tide works for that spot.",
        ],
      },
      {
        id: "do-a-local-reality-check",
        heading: "Do A Local Reality Check",
        paragraphs: [
          "Before you commit, look for the reality checks: cam if available, recent local notes, water temperature, and whether the spot matches your level that day.",
          "A waist-high clean morning at the right beach is better than a chest-high mess at the wrong one. Beginners should bias toward forgiving waves and easier exits. Experienced surfers can chase the more sensitive setup.",
          "The best pre-dawn call is not the most optimistic one. It is the one with the fewest hidden ways to waste the session.",
        ],
        bullets: [
          "Pick the time window first.",
          "Check whether the beach faces the swell.",
          "Confirm the wind stays clean long enough.",
          "Match tide to the actual break.",
          "Use water temperature and local context before driving.",
        ],
      },
      {
        id: "use-quiver",
        heading: "Use Quiver To Narrow The Call",
        paragraphs: [
          "If you are checking San Diego before sunrise, start with the dawn-patrol page, then compare the beach pages that fit your skill level and drive time.",
          "The goal is not to read every number. The goal is to get to a defensible call: this beach, this window, this reason.",
          "After the session, log what happened. That is how the next dawn-patrol call gets more useful than the last one.",
        ],
      },
    ],
    relatedLinks: [
      {
        label: "San Diego Dawn Patrol",
        href: "/dawn-patrol/san-diego",
        description:
          "Find early morning surf windows across San Diego beaches.",
      },
      {
        label: "San Diego Tide Surf",
        href: "/tide/san-diego",
        description:
          "Check tide-sensitive surf windows before choosing a spot.",
      },
      {
        label: "Ocean Beach Surf Forecast",
        href: "/ca/san-diego/ocean-beach",
        description:
          "See a real beach forecast with local conditions and surf-call context.",
      },
    ],
  },
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
    sticker: "blogSessionLog",
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

function parseBlogDate(date: string): number {
  return new Date(`${date}T12:00:00Z`).getTime();
}

function getPostModifiedDate(post: BlogPost): string {
  return post.dateModified ?? post.datePublished;
}

export function sortBlogPosts(posts: readonly BlogPost[]): BlogPost[] {
  return [...posts].sort((a, b) => {
    const dateDiff =
      parseBlogDate(b.datePublished) - parseBlogDate(a.datePublished);
    if (dateDiff !== 0) return dateDiff;
    return a.title.localeCompare(b.title);
  });
}

export function getAllBlogPosts(): BlogPost[] {
  return sortBlogPosts(blogPosts);
}

export function getFeaturedBlogPost(): BlogPost | null {
  return getAllBlogPosts()[0] ?? null;
}

export function getLatestBlogModifiedDate(): string {
  const latest = blogPosts.reduce<BlogPost | null>((currentLatest, post) => {
    if (!currentLatest) return post;

    const currentLatestTime = parseBlogDate(
      getPostModifiedDate(currentLatest),
    );
    const postTime = parseBlogDate(getPostModifiedDate(post));
    return postTime > currentLatestTime ? post : currentLatest;
  }, null);

  return latest ? getPostModifiedDate(latest) : "2026-05-21";
}

export function getBlogPost(slug: string): BlogPost | null {
  return blogPosts.find((post) => post.slug === slug) ?? null;
}

export function getNextBlogPost(slug: string): BlogPost | null {
  const posts = getAllBlogPosts();
  const index = posts.findIndex((post) => post.slug === slug);
  if (index === -1 || posts.length < 2) return null;
  return posts[(index + 1) % posts.length];
}
