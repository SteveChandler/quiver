export interface ReleaseHowTo {
  title: string;
  steps: string[];
}

export interface ReleasePreview {
  /** Portrait app screenshot under /public, rendered in a phone frame. */
  src: string;
  alt: string;
  /** Screen name shown under the frame, e.g. "Home". */
  label: string;
  /** Optional short screen recording under /public; `src` becomes its poster. */
  video?: string;
}

export interface ReleaseSection {
  id: string;
  /** Short label for the jump nav, e.g. "Custom spots". */
  label: string;
  heading: string;
  paragraphs: string[];
  bullets?: string[];
  howTo?: ReleaseHowTo;
  /** Where it is live today. Keep it literal; this is a claim. */
  availability?: string;
  /** Native app preview. Omit for web-only sections. */
  preview?: ReleasePreview;
}

export interface Release {
  slug: string;
  /** YYYY-MM-DD. Releases are sorted by this, newest first. */
  date: string;
  title: string;
  /** One line for the previous-releases list. */
  summary: string;
  /** "Update from the team": what we were focused on and why. */
  intro: string[];
  sections: ReleaseSection[];
}

/**
 * Finite, hand-written release notes for /whats-new. Every entry is a product
 * claim, so only describe things that are live for users today. No forecast
 * model claims: Quiver ships buoy, wind, tide, and beach context, not a
 * learned forecast. Don't write "the call" in user copy.
 */
const releases: Release[] = [
  {
    slug: "2026-09-looking-ahead",
    date: "2026-09-02",
    title: "Plan the whole week, not just the morning",
    summary:
      "Best windows out to 72 hours, beach pages rebuilt around the decision, custom spots for everyone, and a lot more coast.",
    intro: [
      "Most surf apps answer one question well: what is it doing right now? We spent the summer on the next one. When is the window, how sure are we, and what would change our mind?",
      "That meant reworking Home around what is coming instead of what already happened, rebuilding beach pages so the decision sits at the top, and opening custom spots to everyone so the forecast follows you to the breaks we do not list.",
      "Everything below is live in the iPhone app and on quiversurf.app. Some of it is rough on purpose. If a window looks wrong or a page reads badly, tell us at quiversurf.app/support and we will fix it in the open.",
    ],
    sections: [
      {
        id: "looking-ahead",
        label: "Looking ahead",
        heading: "Best windows now reach 72 hours out",
        paragraphs: [
          "Home used to stop at today. Now it looks three days ahead and shows you the best windows across your beaches, with a plain-English line on what is driving each one: a swell filling in, wind switching, or a tide lining up.",
          "Windows also hold still between checks. If nothing meaningful changed in the data since you last looked, the window does not move, so you can plan a dawn patrol the night before and trust it is still the same plan in the morning.",
        ],
        bullets: [
          "A Looking Ahead card on Home with the next windows across your beaches",
          "Every row of How Today Changes names the signal behind it",
          "Windows stay put until the underlying data actually moves",
        ],
        howTo: {
          title: "Where to find it",
          steps: [
            "Open Home and scroll past today's conditions",
            "Tap a window in Looking Ahead to open it in the forecast timeline",
            "Save the beach to keep it in your windows",
          ],
        },
        preview: {
          src: "/images/whats-new/home-poster.jpg",
          alt: "Quiver Home scrolling from today's conditions to the Looking Ahead card with the next 7 days of best windows.",
          label: "Home",
          video: "/videos/whats-new/home.mp4",
        },
        availability: "Live now in the iPhone app.",
      },
      {
        id: "beach-pages",
        label: "Beach pages",
        heading: "Beach pages rebuilt around the decision",
        paragraphs: [
          "The beach screen used to be a stack of charts you scrolled through to reach a conclusion. We flipped it. The read on the day is at the top, the live cam gets real room and a full-screen mode, and the week view now lives inside the forecast timeline instead of a separate tab.",
          "Every number in the timeline now shows where it came from: which buoy, which wind source, when it was last refreshed. If we are borrowing data from a nearby beach, the page says so.",
        ],
        bullets: [
          "Live cam with a full-screen mode",
          "Week view folded into the timeline, with data provenance on each reading",
          "Open any beach or custom spot in your phone's maps app",
          "Add a beach photo straight from the beach screen",
        ],
        preview: {
          src: "/images/whats-new/beach-poster.jpg",
          alt: "Quiver beach detail for La Jolla Shores: safety today, live conditions, and the forecast timeline expanding to the 18-hour trend.",
          label: "Beach detail",
          video: "/videos/whats-new/beach.mp4",
        },
        availability: "Live now in the iPhone app and on quiversurf.app beach pages.",
      },
      {
        id: "custom-spots",
        label: "Custom spots",
        heading: "Custom spots are free for everyone",
        paragraphs: [
          "Custom spots used to count against the free favorites quota. They do not anymore. Save the reef, the wedge, or the stretch of beach nobody has named, and it gets a forecast timeline borrowed from the nearest beach we track.",
          "When a custom spot is uncalibrated we say so on the screen, rather than dressing an estimate up as a reading. If you search Explore for a break we do not list, the empty result now walks you into creating it.",
        ],
        howTo: {
          title: "How to add one",
          steps: [
            "Long-press the map, or tap Add Spot on Explore",
            "Drag the map to place the pin exactly where the peak is",
            "Name it and choose whether it stays private",
          ],
        },
        preview: {
          src: "/images/whats-new/spot-poster.jpg",
          alt: "Quiver Explore map with the swell field, tapping Add a spot, dragging the pin, and opening the Save this spot sheet.",
          label: "Add spot",
          video: "/videos/whats-new/spot.mp4",
        },
        availability: "Live now in the iPhone app, free tier included.",
      },
      {
        id: "alerts",
        label: "Alerts",
        heading: "Watch a window, and get alerts built around where you surf",
        paragraphs: [
          "Tap Watch on any forecast window and Quiver keeps an eye on it. If the window improves, slips, or disappears, you hear about it, and you stop hearing about it once it has passed.",
          "Similarity alerts now start from where you last surfed instead of a fixed home beach, so a swell that lines up for the coast you are actually on is the one you get pinged about.",
        ],
        bullets: [
          "One-tap Watch on forecast windows",
          "Similarity alert candidates built around your last location",
          "Every alert links straight to manage or turn off alerts",
        ],
        preview: {
          src: "/images/whats-new/alerts-poster.jpg",
          alt: "Quiver Alert Center showing surf window alerts and the beaches being watched.",
          label: "Alerts",
          video: "/videos/whats-new/alerts.mp4",
        },
        availability: "Live now in the iPhone app.",
      },
      {
        id: "on-the-web",
        label: "On the web",
        heading: "More coast, better guides, and a hourly table you can actually read",
        paragraphs: [
          "The website got the same attention. Every Learn guide was rewritten to match how people actually search for it, with a real photo on each one instead of a generated loop. City pages now carry a photo, one pin per beach, and a planning checklist you can tick through.",
          "We also added a lot of coastline: Humboldt County, Virginia, and a Baja surf spot catalog, with the map now zooming close enough to tell neighboring peaks apart.",
        ],
        bullets: [
          "Learn guides with real photography and a device-aware Get the app handoff",
          "A server-rendered hourly forecast table on beach pages",
          "Follow this beach on water temp pages, collected under My Coast",
          "New beaches across Humboldt, Virginia, and Baja",
        ],
        availability: "Live now on quiversurf.app.",
      },
    ],
  },
  {
    slug: "2026-06-week-scout",
    date: "2026-06-18",
    title: "Week Scout, water quality, and a morning email",
    summary:
      "Scout the whole week across your spots, see water quality on every beach, and wake up to a daily conditions email.",
    intro: [
      "June was about widening the view. One beach at a time is how most apps work; surfers plan across a handful of spots and a week of tides. This release makes that the default.",
    ],
    sections: [
      {
        id: "week-scout",
        label: "Week Scout",
        heading: "Scout the whole week across every spot you save",
        paragraphs: [
          "A day strip across all your spots at once, the best windows per break, confidence bands on each, and a one-tap share to send the plan to your crew.",
        ],
        availability: "Live now in the iPhone app.",
      },
      {
        id: "water-quality",
        label: "Water quality",
        heading: "Water quality on every beach",
        paragraphs: [
          "Clean, advisory, or closed now shows on every beach page, fed by live San Diego County advisories and expanding from there. Beaches under a health hold drop out of rankings until they clear.",
        ],
      },
      {
        id: "daily-email",
        label: "Daily email",
        heading: "A daily conditions email, and alerts for the windows you want",
        paragraphs: [
          "A morning email with your beaches' conditions: rip risk, rideable waves, confidence, and the day's window, quiet-hours aware. Alongside it, condition alerts let you set a rule for the setup you are waiting on and get pinged when it lines up.",
        ],
        bullets: [
          "Daily conditions email for your saved beaches",
          "Condition alerts with skip-the-flat-days built in",
          "Push notifications that open straight to the right beach",
        ],
      },
      {
        id: "logging",
        label: "Sessions",
        heading: "Richer session logs, with photos",
        paragraphs: [
          "Every logged session now captures wave character, an automatic tide snapshot, and rip-current notes. Add photos to a session and share them; uploads are moderated before they go public. Match scoring now reads your board as well as your skill, so a longboarder scores well on a small long-period day.",
        ],
      },
      {
        id: "more-coast",
        label: "More coast",
        heading: "Monterey, Big Sur, Puerto Rico, and a live swell map",
        paragraphs: [
          "New breaks across the Monterey Peninsula, Big Sur, and the San Juan metro. Pro members get the animated swell-field map: watch swell move along the coast, tap clusters to zoom, and drop custom spots right on it. Early supporters can now pick up Founder Lifetime Pro, every Pro feature forever with no subscription.",
        ],
      },
    ],
  },
  {
    slug: "2026-05-surf-windows",
    date: "2026-05-30",
    title: "Surf windows, your crew, and push notifications",
    summary:
      "The day laid out as a timeline of rideable windows, invite links that carry your crew through sign-up, and real push notifications.",
    intro: [
      "May was the launch month. The pieces below turned Quiver from a forecast you check into something you check with people.",
    ],
    sections: [
      {
        id: "surf-windows",
        label: "Surf windows",
        heading: "See the day as windows, not hours",
        paragraphs: [
          "Rideable windows for the day laid out on a timeline: when it turns on, when it backs off, and how confident we are in each.",
        ],
        preview: {
          src: "/images/app-screenshots/forecast.png",
          alt: "Quiver forecast timeline showing the day's rideable windows.",
          label: "Forecast",
        },
      },
      {
        id: "crew",
        label: "Your crew",
        heading: "Friends feed, invite links, and Apple Sign-In",
        paragraphs: [
          "A segmented Friends, Nearby, and Roadmap feed, invite links that carry your crew connection through sign-up, and Sign in with Apple with account linking so an existing profile carries over. Block and report are available from any profile or session.",
        ],
      },
      {
        id: "push",
        label: "Push",
        heading: "Push notifications with deep links",
        paragraphs: [
          "Follows, water-quality flags, and forecast windows now arrive as real push notifications that open straight to the right beach, profile, or alert.",
        ],
      },
    ],
  },
  {
    slug: "2026-04-custom-spots",
    date: "2026-04-24",
    title: "Custom spots and a smarter match",
    summary:
      "Save any break as a custom spot, place the pin exactly, and get a match score that knows what you avoid as well as what you like.",
    intro: [
      "The first public release notes. Two things surfers asked for most: log sessions at the spots we do not list, and stop scoring a howling onshore day as a partial match.",
    ],
    sections: [
      {
        id: "custom-spots",
        label: "Custom spots",
        heading: "Save any break as a custom spot",
        paragraphs: [
          "Long-press the map or use Add Spot to save any break, and log sessions to it. A map-center placement mode lets you drag the map to position the pin exactly, for when GPS is off or you are not at the beach.",
        ],
      },
      {
        id: "match",
        label: "Match score",
        heading: "A match score with a sweet spot and a no-go list",
        paragraphs: [
          "Match scoring now finds your preferred conditions and penalizes the ones you actively avoid, instead of averaging everything into one number. Post-signup confirmation and callback flows were also fixed so a confirmed account no longer lands logged out.",
        ],
      },
    ],
  },
];

function byDateDesc(a: Release, b: Release): number {
  return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
}

export function getAllReleases(): Release[] {
  return [...releases].sort(byDateDesc);
}

export function getLatestRelease(): Release {
  return getAllReleases()[0];
}

export function getPreviousReleases(): Release[] {
  return getAllReleases().slice(1);
}

export function formatReleaseDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}
