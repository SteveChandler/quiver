import type { FigureKey } from "@/components/learn/figures/figure-keys";

interface LearnArticle {
  slug: string;
  title: string;
  description: string;
  readingTimeMin: number;
  heroImage: string;
  thumbnailImage: string;
  keywords: string[];
  /** ISO 8601 date string (e.g., "2026-03-26") */
  datePublished?: string;
  /** ISO 8601 date string. Defaults to datePublished if omitted. */
  dateModified?: string;
  sections: {
    id: string;
    heading: string;
    content: string;
    keyTakeaway?: string;
    /** Optional inline image displayed alongside section content */
    image?: {
      src: string;
      alt: string;
      /** "left" or "right" — side the image appears on in split layout */
      position: "left" | "right";
    };
    /** Optional interactive figure rendered above this section's prose */
    figureKey?: FigureKey;
  }[];
  faqs: {
    question: string;
    answer: string;
  }[];
  relatedLinks: {
    label: string;
    href: string;
    description: string;
  }[];
}

export const learnArticles: LearnArticle[] = [
  {
    slug: "surf-paddling-for-beginners",
    title: "Surf Paddling for Beginners: Technique & Paddle-Out Guide",
    description:
      "Learn beginner surf paddling technique, how to judge the paddle-out, conserve energy, and choose a manageable beginner window before you go.",
    readingTimeMin: 7,
    datePublished: "2026-07-23",
    dateModified: "2026-07-23",
    heroImage: "/beginnerWhiteWater.jpg",
    thumbnailImage: "/beginnerWhiteWater.jpg",
    keywords: [
      "surf paddling for beginners",
      "how to paddle a surfboard",
      "how to paddle out surfing",
      "beginner surf paddling technique",
      "surf paddle fitness",
      "paddle out difficulty",
    ],
    sections: [
      {
        id: "answer",
        heading: "The Short Answer",
        content: `<p>Good surf paddling starts with a balanced board, a quiet chest, long relaxed strokes, and a route that avoids the strongest whitewater. The common beginner mistake is sprinting straight at every broken wave until the arms are gone. Before you enter, watch several sets, identify the channel or softest inside section, and decide where you will turn back if the paddle-out is taking too much energy. The pop-up gets attention, but paddle judgment determines how many useful waves you can attempt.</p>`,
        keyTakeaway:
          "Save energy by balancing the board, using long relaxed strokes, and choosing the easiest route before you enter.",
      },
      {
        id: "difficulty-near-you",
        heading: "Paddling Difficulty Near You Today",
        content: `<p>This is a <strong>planning insert, not an ocean-safety claim</strong>. Paddling difficulty rises with larger surf, shorter gaps between waves, stronger onshore wind, adverse current, and a long route to the lineup. Quiver's beginner city pages combine the current wave, wind, tide, and time window into a <strong>YES, MAYBE, or NO</strong> learner call. Start with <a href="/beginner/huntington-beach">Huntington Beach</a>, <a href="/beginner/san-diego">San Diego</a>, <a href="/beginner/santa-cruz">Santa Cruz</a>, <a href="/beginner/cocoa-beach">Cocoa Beach</a>, or <a href="/beginner/honolulu">Honolulu</a>, then open the named reference spot and watch conditions from shore before deciding.</p><p>If live forecast data is unavailable, treat the difficulty as <strong>unknown</strong>. Check the beach first, keep a turnaround point, and choose a lesson or protected whitewater practice area when the route is unclear.</p>`,
        keyTakeaway:
          "Use the city verdict as a first filter, then confirm the actual paddle route and set pattern from shore.",
      },
      {
        id: "board-position",
        heading: "Find the Board's Balance Point",
        content: `<p>Lie centered over the stringer with your nose just above the water. Too far back and the nose lifts, pushing water like a plow. Too far forward and the nose pearls whenever a bump reaches you. Keep your feet together, squeeze your legs lightly, and lift your chest only enough to keep the nose clear. A stable board lets each stroke move you forward instead of rocking side to side.</p><p>Beginners often copy shortboard posture on a large foam board. That wastes the foamie's biggest advantage: glide. Let the board run flat. Make one adjustment at a time until it carries speed between strokes.</p>`,
        keyTakeaway:
          "The fastest beginner paddle position is usually flatter and quieter than it feels.",
      },
      {
        id: "stroke",
        heading: "Use Long Strokes Without Burning Your Shoulders",
        content: `<p>Reach forward without twisting off center, place the hand cleanly, pull past your ribs, and release before the hand reaches your hip. Keep the elbow comfortably high and alternate at a rhythm you can hold. Splashy windmill strokes feel fast for ten seconds and then collapse. Smooth strokes preserve enough energy for the takeoff and the trip back outside.</p><p>When you need a short burst, increase cadence while keeping the same clean entry. Do not shorten the stroke so much that your hands only slap the surface. For wave-catching, take several controlled strokes first, then add the burst as the wave reaches you.</p>`,
        keyTakeaway:
          "Build speed with clean repeatable strokes, then add cadence instead of abandoning technique.",
      },
      {
        id: "route",
        heading: "Read the Paddle-Out Before You Enter",
        content: `<p>Watch at least three set cycles. Look for where surfers are returning outside, where foam loses power, and whether a channel is carrying water seaward. A channel can make the paddle easier, but it can also pull you away from the beach, so use it only when you understand where it goes. At a beach break, a diagonal route around the main impact zone is often easier than the shortest straight line.</p><p>Choose landmarks on shore before you enter. If you drift past them, reassess. If you are still trapped inside after repeated attempts, come in, rest, and try a smaller window. Turning around early is better judgment than spending the whole session exhausted.</p>`,
        keyTakeaway:
          "The shortest route is not always the easiest; watch where foam weakens and where other surfers return outside.",
      },
      {
        id: "whitewater",
        heading: "Handle Whitewater in Stages",
        content: `<p>For small foam, keep paddling and lift your chest slightly so the board climbs over it. For a firmer line of whitewater on a foam board, grip the rails, press your chest up, and let the foam pass between you and the deck. A turtle roll can work on a longboard once practiced, but it is not a substitute for choosing a manageable day. Duck diving is mainly for lower-volume boards and takes repetition to time correctly.</p><p>Never abandon the board where someone is behind you. Keep control, leave space, and angle away from other surfers before the wave reaches you. If the foam is repeatedly ripping the board from your hands, that is useful information: the window or equipment may not fit your current level.</p>`,
        keyTakeaway:
          "Technique helps with whitewater, but repeated loss of control is a reason to choose an easier window.",
      },
      {
        id: "practice",
        heading: "Build Paddle Fitness Without Chasing Heavy Surf",
        content: `<p>Short consistent sessions beat one exhausting mission. Practice twenty relaxed strokes, a clean turn, and a controlled prone glide in flat water or gentle whitewater. Add shoulder and upper-back endurance away from the ocean with swimming, band rows, and mobility work. Stop before fatigue destroys your form.</p><p>Track one simple measure: how many wave attempts you can make while still paddling smoothly. As that number rises, you will catch more waves because you arrive in position with energy left. The goal is not to win the paddle-out. It is to have enough control for the whole session.</p>`,
        keyTakeaway:
          "Paddle fitness is useful only when it leaves you enough control to catch waves and return to shore.",
      },
    ],
    faqs: [
      {
        question: "Why is paddling a surfboard so tiring for beginners?",
        answer:
          "New surfers often sit too far back, rock side to side, sprint with short strokes, and take the hardest route through the foam. A balanced board, relaxed long strokes, and better route choice reduce wasted effort quickly.",
      },
      {
        question: "How do I know whether the paddle-out is too difficult?",
        answer:
          "Watch several sets first. If surfers are repeatedly losing ground, the channel is unclear, whitewater is taking boards away, or you cannot identify a turnaround point, choose a smaller window or a lesson at a more protected break.",
      },
      {
        question: "Should a beginner learn to duck dive?",
        answer:
          "Most true beginners use high-volume foam boards that do not duck dive easily. Learn board control, push-ups over small foam, route choice, and eventually turtle rolls before treating duck diving as the answer.",
      },
      {
        question: "How can I improve surf paddling away from the ocean?",
        answer:
          "Swimming, band rows, shoulder mobility, and short prone-paddling sessions build useful endurance. Keep the work controlled and stop when shoulder discomfort changes your stroke.",
      },
    ],
    relatedLinks: [
      {
        label: "Beginner Surf in Huntington Beach",
        href: "/beginner/huntington-beach",
        description:
          "Check the current learner window, reference spot, tide, and alert option.",
      },
      {
        label: "Beginner Surf in San Diego",
        href: "/beginner/san-diego",
        description:
          "Compare beginner breaks and today's local conditions.",
      },
      {
        label: "Beginner Surf in Santa Cruz",
        href: "/beginner/santa-cruz",
        description:
          "Use the current call before choosing Cowell's or another learner spot.",
      },
      {
        label: "Best Surf Conditions for Beginners",
        href: "/learn/best-surf-conditions-for-beginners",
        description:
          "Understand the wave, wind, tide, and crowd window before paddling out.",
      },
      {
        label: "How to Read Surf Conditions",
        href: "/learn/how-to-read-surf-conditions",
        description:
          "Read period, direction, wind, tide, and height in the right order.",
      },
      {
        label: "Beginner Surf in Long Island",
        href: "/beginner/long-island",
        description:
          "Check an East Coast learner window and local spot options.",
      },
    ],
  },
  {
    slug: "how-to-read-surf-conditions",
    title: "How to Read a Surf Report: Forecast & Conditions Guide",
    description: "Learn how to read a surf report or surf forecast: period, direction, wind, tide, and wave height, plus what changes at your break.",
    readingTimeMin: 6,
    datePublished: "2026-03-26",
    dateModified: "2026-06-23",
    heroImage: "/beginnerWhiteWater.jpg",
    thumbnailImage: "/beginnerWhiteWater.jpg",
    keywords: [
      "how to read a surf report",
      "how to read surf report",
      "how to read surf conditions",
      "how to read surf forecast",
      "how to read a surf forecast",
      "surf report explained",
      "surf forecast guide",
      "understanding surf reports",
      "beginner surf conditions",
      "wave height",
      "swell period",
      "surf forecast explained",
    ],
    sections: [
      {
        id: "answer",
        heading: "The Short Answer",
        content: `<p>To read a <strong>surf report</strong> or <strong>surf forecast</strong>, do not start with wave height. Start with <strong>period</strong> for power, <strong>direction</strong> for whether your break receives the swell, <strong>wind</strong> for surface quality, <strong>tide</strong> for shape, then <strong>height</strong> for scale. The same reported <strong>2-4 ft</strong> can be weak and longboard-friendly one day, then steep and shortboard-only the next. Local beach shape decides how those numbers translate once the swell hits shore.</p>`,
        keyTakeaway:
          "Read a surf report in this order: period, direction, wind, tide, then height. Height is the last number to trust by itself.",
      },
      {
        id: "same-size-different-session",
        heading: "Why the Same 2-4 Ft Day Can Feel Totally Different",
        content: `<p>This is the beginner trap: the forecast says <strong>2-4 ft</strong>, but when you show up everyone else is on shortboards and your longboard suddenly feels wrong. Usually the missing variable is <strong>period</strong>. A small swell at <strong>7-9 seconds</strong> is often soft local windswell. A small swell at <strong>13-16 seconds</strong> has real push, stands up earlier, and throws steeper takeoffs.</p><p>Then layer in tide and direction. A long-period south swell hitting the right sandbar at mid tide can make a beach break feel punchy even when the headline number still looks modest. That is why experienced surfers seem to “just know” which board to bring. They are not reading one number. They are reading how the whole combo fits that spot.</p>`,
        keyTakeaway:
          "Two sessions with the same height can surf completely differently because period, tide, and direction change the wave's power and shape.",
        image: { src: "/images/learn/learn-surfer-watching.jpg", alt: "Surfer watching waves from the beach before paddling out", position: "right" },
      },
      {
        id: "period-first",
        heading: "Start with Period Before You Judge Height",
        content: `<p><strong>Period</strong> is the time between waves in seconds. It is the fastest way to separate weak surf from quality surf. Short period, like <strong>6-9 seconds</strong>, usually means local wind energy, closer-spaced waves, and less push. Longer period, like <strong>12-16 seconds</strong>, usually means distant storm energy with cleaner lines and more force behind every takeoff.</p><p>For beginners, period is often the answer to “why was I undergunned?” A longboard that feels great in weak <strong>3 ft @ 8s</strong> surf can feel sticky and late in <strong>3 ft @ 15s</strong> surf because the wave is standing up faster. Height tells you the rough scale. Period tells you whether that scale will actually matter.</p>`,
        keyTakeaway:
          "If you're confused by a session, check period first. It often explains more than the headline height.",
        image: {
          src: "/images/Winter-Swamis.webp",
          alt: "Long-period swell creating steeper, more powerful waves",
          position: "right",
        },
      },
      {
        id: "direction-and-exposure",
        heading: "Direction Only Matters if Your Break Faces It",
        content: `<p><strong>Swell direction</strong> tells you where the energy is coming from. But that number only helps if your beach is exposed to that angle. One nearby break might love south swell and another might be shadowed and nearly flat on the same day. This is where local knowledge starts to compound.</p><p>When you're learning a spot, stop asking “is 3 feet good?” and start asking “does this beach like south, west, or northwest swell?” A modest swell from the right angle can be better than a bigger swell from the wrong one. Quiver models this with <strong>beach-specific calibration for exposure and shoaling</strong>, because nearby beaches do not translate the same raw swell in the same way.</p>`,
        keyTakeaway:
          "A good swell at the wrong angle is still the wrong swell for your break.",
      },
      {
        id: "wind-and-board-choice",
        heading: "Wind Changes Board Choice More Than Beginners Expect",
        content: `<p>Wind is not just “good” or “bad.” <strong>Offshore</strong> wind cleans up the face and can hold a wave open longer. <strong>Onshore</strong> wind adds bump and makes sections crumble. <strong>Cross-shore</strong> wind can still be fine if it's light. That is why you can get advice like “the arrows look okay” and still miss the real call: light cross-shore with weak period is completely different from light cross-shore with long-period punch.</p><p>Board choice lives in that difference. On a mushy day you want glide and foam. On a steeper, more powerful day you often want something that gets in later, sets rail quicker, and fits the pocket better. If you're deciding between longboard and shortboard, compare <strong>period + wind + tide</strong> before you compare height.</p>`,
        keyTakeaway:
          "When board choice feels mysterious, it's usually because the wave shape changed, not just the size.",
      },
      {
        id: "tide-and-bottom",
        heading: "Tide and Bottom Shape Decide Whether Waves Feel Friendly or Heavy",
        content: `<p><strong>Tide</strong> changes water depth over the sandbar, reef, or point that is shaping the wave. Low tide can make a wave stand up fast and hollow out. High tide can slow the same wave down or swamp it completely. Mid tide is often the most forgiving at beach breaks, but not always. Some points want more water. Some reefs get sketchy below a certain tide.</p><p>This is also where beach shape matters. Two neighboring beaches can receive the same buoy swell, but one will focus energy into a punchy peak while the other spreads it into softer shoulders. That's why “what should I look for?” eventually becomes “what should I look for at <em>this</em> spot?”</p>`,
        keyTakeaway:
          "Tide does not just raise and lower the water. It changes how and where the wave breaks.",
        image: {
          src: "/images/learn/learn-tide-pools.jpg",
          alt: "Low tide exposing the bottom contours that reshape incoming swell",
          position: "left",
        },
      },
      {
        id: "reading-order",
        heading: "A 30-Second Way to Read a Surf Report Before You Drive",
        content: `<p>Use this order every time you open a surf report:</p><ol><li><strong>Period</strong>: is this weak windswell or ground swell?</li><li><strong>Direction</strong>: does my spot actually receive this angle?</li><li><strong>Wind</strong>: clean, cross, or blown out?</li><li><strong>Tide</strong>: is the break in its usable window?</li><li><strong>Height</strong>: now that I trust the setup, how big is it really?</li></ol><p>If you want to get good fast, log a few notes after every surf: period, direction, tide, wind, and which board felt right. After 10 to 20 sessions at the same beach, the numbers stop being abstract and start matching what you feel in the water.</p><p>The data behind those checks is public and transparent: NOAA/NWS WaveWatch-style marine forecasts, NDBC/CDIP/IOOS buoy observations where available, NOAA CO-OPS tides, and Open-Meteo for some wind and extended-horizon coverage. The hard part is not getting numbers. It's learning which numbers matter most for your break.</p><p>Want the read done for you? Quiver scores 280+ breaks by tide, wind, and swell and learns the days you rate — see <a href="/vs/surfline/free">how it compares to Surfline</a> or <a href="/roadmap">vote on what we build next</a>. Runs in any browser, or <a href="/app">get the iOS app</a>.</p>`,
        keyTakeaway:
          "Read surf reports in the same order every time so you stop chasing a misleading height number.",
      },
    ],
    faqs: [
      {
        question: "How do you read a surf report?",
        answer:
          "Read the surf report in this order: period, direction, wind, tide, then height. Period tells you power, direction tells you whether your break receives the swell, wind tells you surface quality, tide tells you shape, and height tells you scale after the setup already makes sense.",
      },
      {
        question: "Why were other surfers on shortboards when the forecast still looked small?",
        answer:
          "Because the wave was probably steeper and more powerful than the headline size suggested. Long period, the right swell angle, and a favorable tide can make a modest-height day surf much punchier, which often pushes experienced surfers toward shorter boards.",
      },
      {
        question: "What period is usually easier for a beginner longboarder?",
        answer:
          "There is no universal magic number, but weaker short-to-mid period surf is usually more forgiving than long-period punch. Many beginners find softer sessions in the roughly 7-11 second range easier than a long-period 14-16 second swell of the same reported size.",
      },
      {
        question: "Should I trust the cams or the forecast numbers more?",
        answer:
          "Use both. The forecast tells you what ingredients are arriving: period, direction, wind, and tide. The cam shows what those ingredients are doing at one angle in real time. Cams are useful, but they can flatten size or miss how steep and fast the wave really is.",
      },
      {
        question: "Where does surf-condition data come from?",
        answer:
          "Quiver uses public, transparent sources rather than scraping another surf app: NOAA/NWS WaveWatch-style marine forecasts, CDIP/NDBC/IOOS buoy observations where available, NOAA CO-OPS tides, and Open-Meteo for some wind and extended-horizon coverage.",
      },
      {
        question: "Why do nearby beaches react differently to the same swell?",
        answer:
          "Because each beach has different exposure, shoaling, bottom contour, and protection from local wind. The same buoy swell can resolve into weak rollers at one beach and steeper peaks at another. That is why beach-specific calibration matters.",
      },
    ],
    relatedLinks: [
      { label: "Groundswell vs Wind Swell", href: "/learn/groundswell-vs-wind-swell", description: "Why a 2-ft groundswell can out-surf a 6-ft wind swell." },
      { label: "Swell Period Explained", href: "/learn/swell-period-explained", description: "What the seconds in a forecast actually tell you." },
      { label: "How Accurate Are Surf Forecasts?", href: "/learn/how-accurate-are-surf-forecasts", description: "How far out to trust the numbers." },
      { label: "Quiver vs Surfline", href: "/vs/surfline", description: "How Quiver's per-beach call compares." },
      { label: "Best Surf Conditions for Beginners", href: "/learn/best-surf-conditions-for-beginners", description: "The friendliest windows to paddle out." },
      { label: "What Is the Best Tide for Surfing?", href: "/learn/best-tide-for-surfing", description: "How tide reshapes the same swell." },
    ],
  },

  {
    slug: "swell-period-explained",
    title: "Swell Period Explained: What Seconds Mean for Surf",
    description: "Swell period explained for surfers: what 6, 10, 12, and 16 seconds mean, when long period helps, and how to read period in a forecast.",
    datePublished: "2026-03-26",
    dateModified: "2026-07-06",
    readingTimeMin: 4,
    heroImage: "/point-break.webp",
    thumbnailImage: "/point-break.webp",
    keywords: [
      "swell period",
      "what is swell period",
      "wave period surfing",
      "swell period chart",
      "long period swell",
      "short period swell",
    ],
    sections: [
      {
        id: "answer",
        heading: "The Short Answer",
        figureKey: "swell-period-morph",
        content: `<p>Swell period is the time in seconds between consecutive wave crests passing a fixed point, typically measured by NDBC and CDIP buoys. It's the single best indicator of wave quality on any forecast. Waves with periods <strong>under 9 seconds</strong> come from local wind and break mushy and chaotic. Waves with periods <strong>above 12 seconds</strong> come from distant storms — like North Pacific or Southern Ocean systems — and break clean, powerful, and organized. A 3-foot swell at 14 seconds at Rincon will always outperform a 6-foot swell at 6 seconds. Check period on every forecast.</p>`,
        keyTakeaway:
          "Swell period (seconds between waves) is the best wave quality indicator: under 9 seconds means local chop, over 12 seconds means powerful distant-storm energy.",
      },
      {
        id: "definition",
        heading: "What Swell Period Actually Is",
        content: `<p>Period is the gap between waves — count the seconds between crests passing a buoy. A <strong>6-second period</strong> means waves every 6 seconds. A <strong>14-second period</strong> means 14 seconds between waves. Unlike height or wavelength, period doesn't change with water depth. A 14-second swell stays 14 seconds from the deep ocean all the way to shore, making it the most reliable quality signal on any forecast.</p>`,
        keyTakeaway:
          "Swell period is the time in seconds between consecutive wave crests passing a point.",
        image: { src: "/images/learn/learn-aerial-swell.jpg", alt: "Aerial view of organized swell lines approaching shore", position: "right" },
      },
      {
        id: "short-period",
        heading: "Short Period (5-9 seconds): Local Wind and Chop",
        content: `<p>Short-period swells come from local wind hitting the water near your coast. Waves are close together, weaker, and chaotic — energy scattered across directions and frequencies. In the water, they feel mushy and quick. Waves don't stand up as you paddle in; they collapse fast with a steep takeoff but little face. You'll get plenty of opportunities but fewer quality rides. Common on calm days after overnight wind, they're not necessarily bad — just softer and more forgiving of technique.</p>`,
        keyTakeaway:
          "Short-period swells (5-9 sec) come from local wind and create mushy, quick-breaking waves that are close together.",
      },
      {
        id: "long-period",
        heading: "Long Period (12+ seconds): Distant Storms",
        content: `<p>Long-period swells come from storms thousands of miles away. A <strong>14-second swell</strong> travels roughly <strong>25 mph</strong> through deep water, crossing entire ocean basins over days. Short-period energy gets stripped away by friction along the way, leaving only organized, powerful energy behind. In the lineup, long-period waves stand up slower, peel longer, and maintain power through the break. You'll catch fewer waves but ride cleaner lines — that's why most surfers live for long-period days.</p>`,
        keyTakeaway:
          "Long-period swells (12+ sec) come from distant storms, travel thousands of miles, and create organized, peeling waves.",
        image: {
          src: "/images/activities/point-breaks.webp",
          alt: "Long-period ground swell peeling along a point break",
          position: "right",
        },
      },
      {
        id: "why-period-matters",
        heading: "Why Period Matters More Than Height",
        content: `<p>Height tells you scale. Period tells you quality. A <strong>2-foot swell at 16 seconds</strong> will be more fun than a <strong>4-foot swell at 6 seconds</strong> — the first means clean, organized distant energy; the second means mushy chop that collapses fast. This is why a beach break at 3 feet and 14 seconds will have packed lineups while the same beach at 4 feet and 7 seconds sits empty. Locals know. Period is the invisible metric that separates a real session from a blown-out day.</p>`,
        keyTakeaway:
          "A smaller swell with longer period (12+ sec) produces better waves than a bigger swell with short period (6 sec) because it means organized distant energy.",
        image: {
          src: "/images/hero/hero-2-barrel-wave.webp",
          alt: "Powerful wave from a long-period swell",
          position: "left",
        },
      },
      {
        id: "fetch-and-distance",
        heading: "Period and Distance: The Fetch Law",
        content: `<p>Period tells you how far away the storm was. A <strong>6-second swell</strong> was generated within 100 miles. An <strong>8-second swell</strong>, 200-500 miles. A <strong>12-second swell</strong>, 500-1500 miles. A <strong>16-second swell</strong> often crossed an entire ocean basin — Southern Hemisphere storms reaching California, for example. Long periods require either massive wind speed or enormous fetch (the distance wind blows uninterrupted over open water). When you see 14+ seconds on the forecast, a serious storm got organized enough to push energy across an ocean.</p>`,
        keyTakeaway:
          "Swell period indicates distance from source: 6-sec means nearby wind, 12-sec means 500+ miles away, 16-sec means thousands of miles away.",
      },
      {
        id: "reading-period",
        heading: "Reading Period on Your Forecast",
        content: `<p>Forecasts show period as a single number — "4 feet at 14 seconds" — or split into primary and secondary components. Focus on the primary (dominant) period. Quick guide: <strong>below 9 seconds</strong> is short period (local wind, mushy). <strong>9-12 seconds</strong> is medium (decent, some local influence). <strong>Above 12 seconds</strong> is long period (quality, distant origin). If you see "3 feet at 14 sec + 2 feet at 7 sec," you've got ground swell mixed with local wind — the 14-second component is the one that'll peel.</p>`,
        keyTakeaway:
          "Check period on your forecast: 9-12 sec is medium quality, 12+ sec is good, below 9 sec means mushy local chop.",
        image: { src: "/images/learn/learn-aerial-shore.jpg", alt: "Aerial view of swell lines hitting the coastline at an angle", position: "left" },
      },
      {
        id: "period-and-bathymetry",
        heading: "How Your Break's Bathymetry Interacts with Period",
        content: `<p>Every break has a period sweet spot. Reef breaks tend to prefer <strong>12+ second</strong> periods because fixed underwater structure channels organized energy into clean lines. Beach breaks are more forgiving across the range, but sandbars shift based on what swells they receive — winter ground swell reshapes bars differently than summer wind chop. Learn your break's preferred period by surfing it across different forecasts and noting which swells produce the best shape. That local knowledge is worth more than any forecasting skill.</p>`,
        keyTakeaway:
          "Every break has a preferred period: reef breaks often work best at 12+ seconds, beach breaks work across ranges, sandbars shift with swell frequency.",
      },
    ],
    faqs: [
      {
        question: "Is a 6-foot swell at 8 seconds better or worse than 4 feet at 14 seconds?",
        answer:
          "The 4 feet at 14 seconds is better. The longer period means cleaner, more organized waves from a distant storm. The 6 feet at 8 seconds means local chop that's close together and mushy. Surfers choose the longer period even at smaller height.",
      },
      {
        question: "Can period predict how far away a storm is?",
        answer:
          "Generally, yes. Period correlates to fetch distance. A 16-second swell usually came from 1000+ miles away. An 8-second swell came from 200-500 miles away. This is why Southern Hemisphere swells that hit California are always 14+ seconds—they've traveled Pacific basin distances.",
      },
      {
        question: "What's the difference between primary and secondary period?",
        answer:
          "Primary period is the dominant wavelength in the water right now. Secondary is a weaker swell component mixing in. If your forecast shows 14-sec primary and 8-sec secondary, the 14-second swell is the better one—ride that.",
      },
      {
        question: "Does period change as swell travels to shore?",
        answer:
          "No. Period stays constant from deep ocean to the beach. Wavelength and speed change, but period is stable. A 14-second swell at the buoy is still 14 seconds when it hits your beach.",
      },
      {
        question: "Why do locals say 'wait for the period to fill in'?",
        answer:
          "Long-period swell takes longer to cross ocean basins than short period. When a big storm happens, short-period chop arrives first (2-3 days), then long-period swell follows (4-7 days). Waiting for period to fill in means waiting for the organized swell, not just the initial windswells.",
      },
    ],
    relatedLinks: [
      {
        label: "How to Read Surf Conditions",
        href: "/learn/how-to-read-surf-conditions",
        description:
          "Master all forecast metrics: height, period, direction, wind, and tide.",
      },
      {
        label: "Groundswell vs Wind Swell",
        href: "/learn/groundswell-vs-wind-swell",
        description:
          "Understand how period reveals whether swell came from local wind or a distant storm.",
      },
      {
        label: "How Surf Forecasts Work",
        href: "/learn/how-surf-forecasts-work",
        description:
          "Learn how NOAA models predict period and other swell metrics.",
      },
    ],
  },

  {
    slug: "best-surf-conditions-for-beginners",
    title: "Best Surf Conditions for Beginners: Size, Wind & Tide",
    description: "Learn the best beginner surf conditions: 1-3 ft waves, 12+ sec period, light offshore wind, mid tide, and lower-crowd windows before you paddle out.",
    readingTimeMin: 5,
    datePublished: "2026-03-26",
    heroImage: "/4groms.jpg",
    thumbnailImage: "/4groms.jpg",
    keywords: [
      "best surf conditions for beginners",
      "what waves are good for beginners",
      "beginner surf conditions",
      "learning to surf",
      "beginner swell size",
    ],
    sections: [
      {
        id: "overview",
        heading: "The Ideal Beginner Session",
        content: `<p>You don't need big waves — you need repeatable waves. The best beginner session has small consistent surf, long period, light offshore wind, and mid-tide over sand. That combo gives you soft, predictable waves breaking in the same spot. You'll catch 10+ waves, build muscle memory, and not get worked. A <strong>2-foot swell at 14 seconds</strong> in offshore wind will teach you more than a 6-foot day with onshore chop. Your local beach probably serves this up 1-2 times a week if you know what to look for.</p>`,
        keyTakeaway:
          "Best beginner sessions have small consistent waves (1-3 feet), long period (12+ sec), offshore wind, and mid-tide.",
        image: { src: "/images/learn/learn-surfer-walks.jpg", alt: "Surfer walking toward gentle waves at a beginner-friendly beach", position: "right" },
      },
      {
        id: "wave-height",
        heading: "Wave Height: 1-3 Feet (Face Height) Is Ideal",
        content: `<p><strong>1-3 foot face height</strong> is the sweet spot — roughly 0.5-2 feet significant height on a forecast. Learning to pop up takes 100+ reps, and small waves let you practice safely without getting worked. If a forecast says 2 feet, expect 3-4 foot faces (significant height is 60-70% of face height). That's borderline — still okay with long period and offshore wind. Above 4 feet significant (6+ foot faces) is intermediate territory. Simple rule: if you can't duck-dive confidently, it's too big.</p>`,
        keyTakeaway:
          "Start on 1-3 foot face height (0.5-2 feet on the forecast), which gives you safe, repeatable waves for practicing.",
        image: {
          src: "/images/activities/beginner-friendly.webp",
          alt: "Beginner surfer riding small whitewater waves",
          position: "right",
        },
      },
      {
        id: "period-for-beginners",
        heading: "Swell Period: Why Longer Period Is Actually Easier",
        content: `<p>Long-period waves break slower and more predictably — the opposite of what most beginners expect. A <strong>14-second period</strong> gives you 14 seconds between waves to paddle back out and regroup. A 6-second period means constant chaos. Long-period swells also stand up slower, giving you more time to pop up and set your line. A 16-second ground swell at 2 feet feels way more approachable than a 6-second wind swell at 3 feet. If your forecast shows <strong>12+ seconds</strong>, that's your best learning window.</p>`,
        keyTakeaway:
          "Long-period swells (12+ sec) break slower and more predictably, giving beginners time to set up and recover between waves.",
      },
      {
        id: "wind",
        heading: "Wind: Offshore Early Morning Is Best",
        content: `<p>Offshore wind holds up the wave face and slows the break — easier pop-ups, easier control. Early morning is almost always offshore because land cools overnight, pulling wind from shore to sea. By noon, heating reverses it to onshore. That's why every surfer wakes up at dawn. If the forecast shows offshore until 10 AM, be in the water by 7. Even <strong>5 knots offshore</strong> helps; <strong>10+ knots offshore</strong> is excellent. Onshore wind makes the same waves unrideable for beginners — pick a different day.</p>`,
        keyTakeaway:
          "Offshore wind holds up waves and slows breaks, making them easier to catch and control. Early morning (before heating) has the best offshore window.",
        image: { src: "/images/learn/learn-dawn-patrol.jpg", alt: "Surfers heading out at golden hour — dawn patrol for calm offshore winds", position: "right" },
      },
      {
        id: "tide",
        heading: "Tide: Mid-Tide on Sand Is Sweet Spot",
        content: `<p><strong>Mid-tide on a sandy bottom</strong> is the most forgiving setup. Low tide exposes bars and creates hollow, fast sections — not beginner-friendly. High tide floods everything out, making it slow and mushy. Mid-tide (roughly 3-4 hours after low) creates balanced bar shapes where waves peel smoothly. Sand is also softer than reef when you fall. Learn your break's best tide window by surfing different tides and noting where peaks form.</p>`,
        keyTakeaway:
          "Mid-tide on a sandy beach creates the most forgiving, consistent waves because the bar is balanced and waves slow down gradually.",
      },
      {
        id: "crowd-management",
        heading: "Crowd Management: When to Avoid the Pack",
        content: `<p>You'll progress faster in empty lineups than fighting 50 people for waves at a famous spot. Crowded sessions mean fewer waves, more collisions, and less room to make mistakes. Go on weekday mornings before work. Target smaller swells that don't draw the crowd. Hit lesser-known beaches with the same conditions and more space. You don't need the best wave — you need a forgiving wave with room to paddle. After 6 months of consistent practice in smaller crowds, you'll be ready for the lineups.</p>`,
        keyTakeaway:
          "Beginners progress faster in less crowded sessions: choose weekday mornings, smaller swells, and lesser-known spots over famous beaches.",
        image: {
          src: "/images/blacks.webp",
          alt: "Crowded lineup at a popular surf break",
          position: "left",
        },
      },
      {
        id: "using-forecast",
        heading: "Using a Forecast to Plan Your Beginner Session",
        content: `<p>The checklist: (1) height under 3 feet significant, (2) period 12+ seconds, (3) offshore wind under 10 knots, (4) mid-tide timing. When a forecast matches all four, that's your day. Example: Tuesday 6 AM, 1.5 feet at 14 seconds, 8 knots offshore, high tide 7:30 AM — perfect beginner session. Don't paddle randomly hoping conditions work out. Use Quiver to scan the next 7 days and block the best windows. Within a few weeks, you'll spot the pattern at your break.</p>`,
        keyTakeaway:
          "Use forecasts to match four conditions: height under 3 feet, period 12+ sec, offshore wind, and mid-tide. Plan sessions around these windows.",
      },
    ],
    faqs: [
      {
        question: "Can I learn on 4-foot waves?",
        answer:
          "Yes, but it's slower and harder. Small days (1-3 feet) let you practice more frequently and safely. 4-foot waves require better fitness and balance. Most beginners improve fastest on 2-3 foot waves where they can catch 15-20 waves per session instead of 5-10.",
      },
      {
        question: "Is a long-period swell really easier than short period?",
        answer:
          "Yes. Long-period swells break slower and more predictably, giving you time to pop up and set your line. Short-period swells come fast and mushy, making it harder to catch and harder to ride. 14-second swell at 2 feet beats 6-second swell at 4 feet for learning.",
      },
      {
        question: "What's a good morning to paddle if wind is onshore?",
        answer:
          "Don't. Onshore wind makes waves chaotic and blown-out. Wait for an offshore day or find a break that faces a different direction so you can access an offshore window. One offshore day per week is better than five onshore days.",
      },
      {
        question: "Do I need to check tide if I'm just learning?",
        answer:
          "Yes. Tide changes wave shape significantly. Low tide makes waves hollow and fast; high tide makes them slow and mushy. Mid-tide is usually best. Learn your local break's tidal window so you can time your sessions right.",
      },
      {
        question: "How long until I can surf bigger waves?",
        answer:
          "Roughly 50-100 sessions of 20-30 minutes on 2-3 foot waves. This builds paddle strength, balance, and wave sense. After that, 4-5 foot waves are manageable. Above 6 feet, you need fitness, confidence, and knowledge of your break. Small-wave practice is not wasted—it's the foundation.",
      },
    ],
    relatedLinks: [
      {
        label: "What Size Surfboard Should I Get?",
        href: "/learn/what-size-surfboard-should-i-get",
        description:
          "Board sizing guide — why foamies accelerate learning.",
      },
      {
        label: "Surf Etiquette Rules",
        href: "/learn/surf-etiquette-rules",
        description:
          "Know the lineup rules before you paddle out.",
      },
      {
        label: "How to Read Surf Conditions",
        href: "/learn/how-to-read-surf-conditions",
        description:
          "Learn to read all metrics so you can identify beginner-friendly conditions.",
      },
      {
        label: "Swell Period Explained",
        href: "/learn/swell-period-explained",
        description:
          "Understand why long-period swells are easier for beginners to learn on.",
      },
      {
        label: "Surf Paddling for Beginners",
        href: "/learn/surf-paddling-for-beginners",
        description:
          "Paddling technique is the skill that gates every other one.",
      },
      {
        label: "Best Beginner Surf Spots in San Diego",
        href: "/learn/beginner-breaks-san-diego",
        description:
          "Where these conditions actually show up on the San Diego coast.",
      },
      {
        label: "Best Beginner Surf Spots in Santa Cruz",
        href: "/learn/beginner-breaks-santa-cruz",
        description:
          "Where these conditions actually show up around Santa Cruz.",
      },
    ],
  },

  {
    slug: "groundswell-vs-wind-swell",
    title: "Wind Swell vs Groundswell: Tell Them Apart by Period",
    description:
      "Under 10 seconds is wind swell: choppy, weak, quick to fade. Past 12 seconds is groundswell: long lines and real push. How to read which one is arriving.",
    readingTimeMin: 4,
    datePublished: "2026-03-26",
    dateModified: "2026-09-02",
    heroImage: "/offShore.jpeg",
    thumbnailImage: "/offShore.jpeg",
    keywords: [
      "groundswell vs wind swell",
      "ground swell vs wind swell",
      "wind swell vs groundswell",
      "wind swell vs ground swell",
      "what is groundswell",
      "what is ground swell",
      "types of ocean swells",
      "wind swell",
      "ground swell definition",
    ],
    sections: [
      {
        id: "answer",
        heading: "Read Period First",
        figureKey: "swell-period-morph",
        content: `<p><strong>Period</strong> — the seconds between waves — is the fastest way to tell <strong>groundswell</strong> from <strong>wind swell</strong>. Under about <strong>10 seconds</strong>, you are usually looking at local wind swell: short-spaced, choppy, weak, and quick to fade. Push into <strong>10-12 seconds</strong> and longer, and the ocean starts acting like groundswell: longer lines, more organized sets, and more push when the wave stands up. Drag the dial above and watch the same ocean reorganize.</p><p>Height still matters, but period explains why a clean <strong>2 ft @ 14s</strong> groundswell can surf better than a messy <strong>6 ft @ 7s</strong> wind swell. The long-period wave is carrying distant storm energy in a cleaner package. The short-period wave is mostly local chop.</p>`,
        keyTakeaway:
          "Under ~10s is usually wind swell; 10-12s+ is groundswell. Read period before height.",
      },
      {
        id: "definitions",
        heading: "Two Types of Ocean Swells: Definitions",
        content: `<p><strong>Wind swell</strong> is generated by wind blowing near your coast now — short periods, chaotic energy, and waves stacked close together. <strong>Groundswell</strong> comes from storms far away, sometimes thousands of miles across an ocean basin. Distance filters the mess into longer-period, more organized energy. Most forecasts show both as separate components: "4 feet at 14 seconds + 2 feet at 6 seconds." The first is groundswell, the second is local wind swell. Both can contribute, but the longest-period component usually drives the waves worth waiting for.</p>`,
        keyTakeaway:
          "Wind swell is local wind energy; groundswell is distant storm energy filtered into longer, cleaner lines.",
      },
      {
        id: "ground-swell-forms",
        heading: "Where Each Swell Comes From",
        figureKey: "swell-origin-fetch",
        content: `<p>Groundswell is born from <strong>distant storms</strong> with sustained wind blowing across hundreds or thousands of miles of <em>fetch</em>. The storm creates a messy field of waves at first, but as that energy travels across the basin, short-period chop fades and the longer lines outrun the noise. By the time a Southern Ocean storm reaches California five to seven days later, it can arrive as a clean <strong>16-second swell</strong>.</p><p>Wind swell is generated by <strong>local wind</strong> close to shore. It has not traveled far enough to organize, so it arrives as short, textured chop. When the wind dies, the wind-swell component usually fades fast. Groundswell persists because the energy is already moving across the ocean as organized lines.</p>`,
        keyTakeaway:
          "Groundswell = distant storm + long fetch = clean lines. Wind swell = local wind = chop.",
        image: {
          src: "/images/hero/hero-3-windansea.webp",
          alt: "Clean ground swell lines at Windansea",
          position: "right",
        },
      },
      {
        id: "wind-swell-forms",
        heading: "How Wind Swells Form: Local Wind Right Now",
        content: `<p>Wind swell forms when wind blows across the ocean near your coast. The energy is scattered across periods and directions because local wind is constantly shifting intensity and angle. That is why wind swell looks messy and close together in person. It can still be surfable, especially at punchy beach breaks, but it rarely has the clean set structure of a longer-period groundswell.</p>`,
        keyTakeaway:
          "Wind swell is short-period because local wind has not had enough distance to sort into clean lines.",
        image: { src: "/images/learn/learn-choppy-sea.jpg", alt: "Choppy disorganized sea from local wind swell", position: "right" },
      },
      {
        id: "visual-differences",
        heading: "What Wind Swell and Groundswell Look Like in the Water",
        content: `<p>Groundswell is unmistakable: organized sets with clean spacing, long lulls between them, waves all peeling in similar directions. You can see sets coming from far away because the energy is long and coherent. Even small groundswell looks powerful. Wind swell is the opposite — waves from every direction, no clear sets, everything crammed together at 6-9 second intervals. Even big wind swell feels mushy because the energy is scattered. You can spot the difference from shore once you know what to look for.</p>`,
        keyTakeaway:
          "Groundswell has organized sets with clean spacing; wind swell is chaotic texture from many directions.",
      },
      {
        id: "quality-comparison",
        heading: "Which Produces Better Surf and Why",
        content: `<p>Groundswell, almost always. Organized energy creates predictable, shapeable waves — you can set your line before the wave reaches your takeoff zone, and the ride lasts because the face is stable. Wind swell collapses fast with no clear peak, making waves harder to catch and shorter to ride. Even an 8-foot wind swell is usually inferior to a 2-foot groundswell. The swell type (period) determines rideability far more than height. That's why surfers obsess over tracking distant storms.</p>`,
        keyTakeaway:
          "Groundswell produces better waves than wind swell because organized distant energy creates predictable, shapeable rides.",
        image: {
          src: "/images/activities/reef-breaks.webp",
          alt: "Well-organized ground swell hitting a reef break",
          position: "left",
        },
      },
      {
        id: "when-wind-swell-is-fun",
        heading: "When Wind Swell Can Actually Be Good",
        content: `<p>Wind swell has its place. When groundswell is 1-2 feet and the ocean looks dead, a 3-4 foot wind swell provides more waves and more action. Advanced shortboarders sometimes prefer it — more opportunities, quicker reps, playful sessions. Fast beach breaks with A-frames can turn wind swell into fun peaks even at short periods. Reef breaks struggle with it because disorganized energy doesn't focus onto the structure. If you're choosing between a 1-foot groundswell and a 4-foot wind swell at a beach break, the wind swell might actually be more rideable — just lower quality per wave.</p>`,
        keyTakeaway:
          "Wind swell can be fun for advanced shortboarders on small days or at beach breaks, but groundswell is almost always better for wave quality.",
      },
      {
        id: "reading-both",
        heading: "Reading Both Swells in a Forecast",
        content: `<p>When a forecast shows "3 feet at 14 seconds + 2 feet at 7 seconds," read it as: 3-foot groundswell doing the main work, plus 2-foot wind swell adding local texture. If it flips to "2 feet at 7 seconds only," you are probably looking at short-period chop. Always start with the longest-period component, then check <a href="/learn/how-to-read-surf-conditions">wind, tide, and direction</a> before you drive.</p><p>Want to go deeper? Use <a href="/learn/swell-period-explained">swell period</a> to judge power, <a href="/learn/how-swell-direction-affects-surf">swell direction</a> to see whether your spot catches the angle, and <a href="/vs/surfline">Quiver vs Surfline</a> to compare per-beach calls against regional forecast tools.</p><p>Skip the chart-reading? Quiver tags primary groundswell vs secondary wind swell for 280+ breaks and learns the days you rate. Runs in any browser, or <a href="/app">get the iOS app</a>.</p>`,
        keyTakeaway:
          "In a forecast with multiple swells, the longest-period component is groundswell and produces the best waves; short-period is wind swell and local chop.",
      },
    ],
    faqs: [
      {
        question: "Can groundswell and wind swell mix in the water?",
        answer:
          "Yes, always. Most days you have both at the same time. The groundswell creates the main peeling waves, and the wind swell adds texture and extra sets in between. Experienced surfers learn to read which waves are which and focus on catching the groundswell.",
      },
      {
        question: "How do I tell the difference in the water?",
        answer:
          "Groundswell has consistent set patterns and long lulls between. Wind swell is constant texture with no clear sets. Groundswell waves all break similarly; wind swell waves break from many directions. After one session, you'll recognize the difference automatically.",
      },
      {
        question: "Is a 10-foot wind swell ever better than a 2-foot groundswell?",
        answer:
          "Rarely. Big wind swell is entertaining because there's volume, but the rides are lower quality. A 2-foot groundswell at your reef break will have more structured, rideable waves than 10-foot wind swell. Experienced surfers choose the smaller but longer-period option almost always.",
      },
      {
        question: "Where do I check for incoming groundswells?",
        answer:
          "Surf forecast models show swell components. Quiver displays both primary (ground) and secondary (wind) swells. You can also check synoptic weather maps to see where storms are forming. Southern Hemisphere and North Pacific storms typically generate the best swells to North America.",
      },
      {
        question: "Why do forecasters separate groundswell and wind swell?",
        answer:
          "Because they behave differently and arrive at different times. Wind swell shows up immediately and disappears fast. Groundswell takes days to arrive but lasts longer. Separating them lets surfers plan ahead and understand what's really driving the session.",
      },
    ],
    relatedLinks: [
      { label: "How to Read a Surf Report", href: "/learn/how-to-read-surf-conditions", description: "Period, direction, wind, tide, then height." },
      { label: "Swell Period Explained", href: "/learn/swell-period-explained", description: "Why period separates power from mush." },
      { label: "How Swell Direction Affects Surf", href: "/learn/how-swell-direction-affects-surf", description: "Whether your break even catches the swell." },
      { label: "How Surf Forecasts Work", href: "/learn/how-surf-forecasts-work", description: "Where the swell data comes from." },
      { label: "Quiver vs Surfline", href: "/vs/surfline", description: "Per-beach calls vs a regional star." },
    ],
  },

  {
    slug: "how-surf-forecasts-work",
    title: "How Surf Forecasts Work",
    description: "From weather satellites to your phone: NOAA models, buoy networks, and ML corrections that power accurate wave predictions.",
    readingTimeMin: 5,
    datePublished: "2026-03-26",
    heroImage: "/images/hero/hero-5-aerial-ocean.webp",
    thumbnailImage: "/images/hero/hero-5-aerial-ocean.webp",
    keywords: [
      "how do surf forecasts work",
      "surf forecast accuracy",
      "wave forecast models",
      "NOAA WaveWatch III",
      "surf buoys",
    ],
    sections: [
      {
        id: "overview",
        heading: "From Satellites to Your Phone: The Complete Picture",
        content: `<p>A surf forecast is a pipeline: satellites measure ocean wind, global computers run that data through wave equations, buoys verify predictions in real-time, and machine learning corrects for local effects the models miss. This cycles every 6 hours, refining the next 10 days of predictions. No single model is perfect — WaveWatch III is accurate to about <strong>±1-2 feet</strong> for height and <strong>±2-3 seconds</strong> for period, 3-5 days out. Buoys ground-truth the model, and Quiver's ML layer fixes the systematic errors at your specific break.</p>`,
        keyTakeaway:
          "Surf forecasts combine NOAA weather models, satellite wind data, buoy observations, and ML corrections to predict waves 6-10 days out.",
        image: { src: "/images/learn/learn-misty-lineup.jpg", alt: "Surfer in misty conditions — forecast models predict what you'll find", position: "right" },
      },
      {
        id: "global-models",
        heading: "Global Wave Models: WaveWatch III and WAM",
        content: `<p><strong>WaveWatch III</strong> is NOAA's global wave model — it takes wind predictions from GFS and outputs wave height, period, and direction every 3 hours at 0.5-degree resolution (roughly 30 miles per grid point). <strong>ECMWF's WAM</strong> is the European alternative with similar accuracy, slightly different physics. Both solve wave equations across ocean basins: wind generates waves, swells travel and decay, energy interacts with bathymetry. They track ground swell and wind swell as separate components. Quiver primarily displays WaveWatch III because it's publicly available and accurate for North America.</p>`,
        keyTakeaway:
          "WaveWatch III is NOAA's global model predicting waves at 0.5-degree resolution every 3 hours using satellite wind data.",
      },
      {
        id: "buoy-networks",
        heading: "Buoy Networks: NDBC and CDIP Ground-Truth the Models",
        content: `<p><strong>NDBC</strong> maintains roughly 80 buoys along US coasts measuring wave height, period, direction, wind, and temperature every hour. <strong>CDIP</strong> runs denser networks near Southern California and Hawaii with directional wave sensors for finer detail. Buoys are the ground truth — if WaveWatch III predicts 4 feet at 12 seconds but the nearest buoy shows 2.5 feet at 10 seconds, the model is wrong at that location. Quiver shows both model predictions and buoy observations side-by-side so you can see how accurate the forecast is being at your break.</p>`,
        keyTakeaway:
          "NDBC and CDIP buoys measure real waves every hour across US coasts, providing ground-truth observations that verify and correct global models.",
        image: {
          src: "/images/learn/learn-aerial-swell.jpg",
          alt: "Aerial view of organized swell lines, the kind ocean buoys measure",
          position: "right",
        },
      },
      {
        id: "nearshore-problem",
        heading: "The Nearshore Problem: Why Models Miss the Last Mile",
        content: `<p>WaveWatch III runs at 30-mile grid resolution. Your local beach is way smaller than that. The model doesn't see underwater canyons that focus swell, headlands that block it, beach slope that changes how waves break, or coastal wind patterns that differ from open-ocean wind. A deep canyon offshore amplifies waves locally. A headland shadows certain swell angles. Sandbars shift week to week. The model misses all of it — sometimes by 1-2 feet or entire wave quality grades. This is the "last mile problem," and it's why buoys and ML corrections exist.</p>`,
        keyTakeaway:
          "Global models miss local bathymetry, underwater canyons, and coastal wind effects because they operate at 30-mile resolution; buoys and ML corrections fix this.",
      },
      {
        id: "ml-corrections",
        heading: "How Quiver Improves Accuracy: ML Trained on Real Observations",
        content: `<p>Quiver's ML trains on years of historical buoy observations alongside WaveWatch III predictions. It learns the patterns: when the model predicts 4 feet at your break, observations average 3.5 feet. During offshore wind, model accuracy improves. Certain swell directions interact with local bathymetry to amplify or reduce height. These corrections are unique per break — Rincon's underwater topography focuses swell differently than Malibu's reef. The result is a location-specific correction layer that makes Quiver's forecast more accurate than raw WaveWatch III at your spot.</p>`,
        keyTakeaway:
          "Quiver uses machine learning trained on historical buoy observations to correct WaveWatch III predictions for local bathymetry and coastal effects.",
        image: {
          src: "/surfer-wave-sample.jpg",
          alt: "Surfer riding a wave with ML-corrected forecast conditions",
          position: "left",
        },
      },
      {
        id: "accuracy-timeline",
        heading: "Forecast Accuracy by Timeline",
        content: `<p>The sweet spot is <strong>0-3 days out</strong>: accuracy within ±1-2 feet height and ±2-3 seconds period. At <strong>3-5 days</strong>, it degrades to ±2-3 feet and ±3-5 seconds. Beyond <strong>7 days</strong>, forecasts are rough estimates — weather chaos takes over. Use the 10-day view to track incoming storm systems and swell trends, but book your sessions from the 3-day window. Check the forecast daily as your session approaches — by day 3, you'll have much better detail on whether that predicted swell is actually coming.</p>`,
        keyTakeaway:
          "Wave model accuracy is ±1-2 feet for 0-3 days out, ±2-3 feet for 3-7 days, and rough estimates beyond 7 days.",
      },
      {
        id: "where-models-struggle",
        heading: "Where Forecasts Still Struggle and How to Account for It",
        content: `<p>Models miss: extreme coastal winds (sea breezes, katabatic flow), microscale topography (small headlands, rock outcrops), fast-moving cold fronts, and sandbars that shift week to week. A forecast might call offshore but a faster-than-modeled cold front gives you onshore instead.</p><p>Account for it: (1) check NDBC buoys 1-3 hours before your session, (2) watch for buoy data diverging from the forecast, (3) learn your break's seasonal patterns, (4) talk to locals who paddle daily. A forecast is a guide, not gospel. Ground-truth it before committing.</p>`,
        keyTakeaway:
          "Forecasts miss coastal wind effects and sandbar migrations; always check real-time buoy observations 1-3 hours before your session.",
      },
    ],
    faqs: [
      {
        question: "Why is my forecast different on Quiver vs other apps?",
        answer:
          "Different apps use different data sources and different ML corrections. Quiver uses WaveWatch III + NDBC + CDIP + location-specific ML. Others might use different models (ECMWF, HRRR) or no ML at all. Quiver's ML is trained on years of observation data at each break, so it should be more accurate long-term.",
      },
      {
        question: "How often do forecasts update?",
        answer:
          "WaveWatch III updates every 6 hours (0Z, 6Z, 12Z, 18Z UTC). NDBC buoys report every hour. Quiver refreshes every 1-3 hours with new model data. Check again in the morning and mid-day—today's forecast will be different (and more accurate) than yesterday's forecast for the same day.",
      },
      {
        question: "Should I trust a forecast 10 days out?",
        answer:
          "No. Use 10-day forecasts to track swell systems and trends, not to plan sessions. Weather is chaotic beyond 7 days. By the time your session is 2 days away, check the updated forecast—it'll be much more accurate.",
      },
      {
        question: "What if the buoy disagrees with the forecast?",
        answer:
          "Trust the buoy. Buoys measure real waves right now. Forecasts are predictions. If WaveWatch III predicts 4 feet but the nearest buoy shows 2 feet, the swell is 2 feet. The model is wrong at that location—use the buoy truth.",
      },
      {
        question: "Can forecasts predict 30 minutes ahead?",
        answer:
          "No. WaveWatch III outputs every 3 hours. Real-time observations (buoys) tell you what's happening now, but 30-minute forecasts don't exist for wave models. Use the 3-hour forecast window and adapt based on what you see when you paddle out.",
      },
    ],
    relatedLinks: [
      {
        label: "Forecast Accuracy at Your Break",
        href: "/forecast-accuracy",
        description:
          "See how accurate our forecast is at your local beach based on historical buoy data.",
      },
      {
        label: "How to Read Surf Conditions",
        href: "/learn/how-to-read-surf-conditions",
        description:
          "Learn what each forecast metric means and how to interpret them.",
      },
      {
        label: "NOAA WaveWatch III",
        href: "https://polar.ncei.noaa.gov/products/wavewatch-3-global-wave-model",
        description:
          "Official NOAA documentation for WaveWatch III global wave model.",
      },
      {
        label: "NDBC Buoy Network",
        href: "https://www.ndbc.noaa.gov/",
        description:
          "Real-time wave observations from NOAA buoys around US coasts.",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // AEO-optimized answer articles (added 2026-03-30)
  // ─────────────────────────────────────────────────────────────────────────

  {
    slug: "offshore-vs-onshore-wind-surfing",
    title: "Offshore vs Onshore Wind: Best Wind for Surfing",
    description:
      "Offshore vs onshore wind explained: which wind cleans up surf, how much is too much, and how to use wind direction before choosing a break.",
    readingTimeMin: 3,
    datePublished: "2026-03-30",
    heroImage: "/images/activities/offshore-winds.webp",
    thumbnailImage: "/images/activities/offshore-winds.webp",
    keywords: [
      "offshore wind surfing",
      "onshore wind surfing",
      "wind direction waves",
      "offshore vs onshore",
      "best wind for surfing",
      "how wind affects surf",
    ],
    sections: [
      {
        id: "answer",
        heading: "The Short Answer",
        content: `<p><strong>Offshore wind</strong> blows from land to sea, holding up wave faces and creating clean, organized lines at breaks like Rincon and Malibu. <strong>Onshore wind</strong> blows sea to land, pushing waves down and adding chop. Most breaks measured by NDBC anemometers surf best with under <strong>10 knots</strong> of offshore wind. Dawn patrol exists because overnight land cooling creates natural offshore flow that reverses by midday.</p>`,
        keyTakeaway:
          "Offshore wind (land to sea) cleans up waves; onshore (sea to land) destroys them. Under 10 knots offshore is ideal.",
      },
      {
        id: "detail",
        heading: "How Wind Direction Changes Wave Shape",
        content: `<p>Offshore wind pushes against the wave face as it steepens, slowing the break and holding the lip up longer. This creates <strong>cleaner, more hollow waves</strong> with defined shoulders — ideal for surfing. Even 5 knots of offshore can transform a mushy wave into a rideable one. At <strong>15-20 knots offshore</strong>, spray blows back over the crest (the classic "offshore mist" shot), but paddling out becomes difficult and drops are harder because the wind pushes you up the face.</p><p>Onshore wind does the opposite: it pushes the wave forward, collapsing the lip before it can form a clean face. Waves break inconsistently with no defined shoulder. The surface gets choppy, making it hard to paddle, hard to read the wave, and hard to generate speed. Even <strong>8-10 knots onshore</strong> can ruin an otherwise solid swell. Cross-shore wind (blowing parallel to the beach) is in between — not ideal but surfable.</p>`,
        keyTakeaway:
          "Offshore holds up wave lips for cleaner breaks; onshore collapses them. Even 5 knots offshore helps, while 8-10 knots onshore ruins a session.",
        image: {
          src: "/images/activities/offshore-winds.webp",
          alt: "Offshore wind creating clean spray off wave lips",
          position: "right",
        },
      },
      {
        id: "practical",
        heading: "What This Means for Your Session",
        content: `<p>Check wind forecast before swell forecast — wind determines whether a good swell produces good waves. On Quiver, the wind overlay shows speed and direction for every 3-hour window. Target the <strong>early morning slot</strong> (5:30-9 AM) when thermal offshore is strongest. If your forecast shows onshore by 10 AM, be in the water by 7. If it's onshore all day, check a different break that faces the opposite direction — one beach's onshore is another's cross-shore or sideshore. Headlands and points can create localized wind shadows even when the regional wind is onshore.</p>`,
        keyTakeaway:
          "Check wind before swell. Target early morning for offshore. If onshore all day, try a break facing a different direction.",
      },
    ],
    faqs: [
      {
        question: "How much offshore wind is too much?",
        answer:
          "Above 20 knots offshore, paddling becomes exhausting and takeoffs are hard because wind pushes you up the wave face. The sweet spot is 5-12 knots offshore — enough to clean up faces without making paddling miserable.",
      },
      {
        question: "Why does wind change direction during the day?",
        answer:
          "Thermal cycling. Land heats faster than ocean during the day, pulling onshore flow. At night, land cools faster, creating offshore flow. This is why mornings are offshore and afternoons are onshore in most coastal areas.",
      },
      {
        question: "Can you surf in onshore wind?",
        answer:
          "Yes, but quality drops significantly. Under 8 knots onshore is manageable — waves are choppy but rideable. Above 12 knots onshore, most breaks become unsurfable for all but advanced shortboarders who enjoy the challenge.",
      },
      {
        question: "What is glass-off?",
        answer:
          "Glass-off happens in late afternoon when onshore wind dies before sunset. The ocean surface smooths out — 'glassy' conditions. It's often the second-best window after dawn patrol, lasting 30-90 minutes.",
      },
    ],
    relatedLinks: [
      {
        label: "How to Read Surf Conditions",
        href: "/learn/how-to-read-surf-conditions",
        description: "Wind is one of five forecast metrics — learn them all.",
      },
      {
        label: "Best Time of Day to Surf",
        href: "/learn/best-time-of-day-to-surf",
        description:
          "Why dawn patrol and glass-off are the best windows for clean waves.",
      },
      {
        label: "Check Your Forecast",
        href: "/forecast",
        description: "See wind speed and direction for every 3-hour window.",
      },
    ],
  },

  {
    slug: "best-tide-for-surfing",
    title: "What Is the Best Tide for Surfing?",
    description:
      "Most beach breaks work best at mid-tide on an incoming (rising) tide. Low tide exposes sandbars and reefs, creating hollow fast waves. High tide floods the bottom contour, producing slower mushy waves. Every break has a preferred tidal window. NWS tide predictions are accurate to the minute.",
    readingTimeMin: 3,
    datePublished: "2026-03-30",
    heroImage: "/images/learn/learn-tide-pools.jpg",
    thumbnailImage: "/images/learn/learn-tide-pools.jpg",
    keywords: [
      "best tide for surfing",
      "surf tide chart",
      "low tide surfing",
      "high tide surfing",
      "mid tide",
      "tide and waves",
    ],
    sections: [
      {
        id: "answer",
        heading: "The Short Answer",
        content: `<p>Most beach breaks work best at <strong>mid-tide on an incoming (rising) tide</strong>. Low tide exposes sandbars and reefs, creating hollow, fast, often dangerous waves. High tide floods the bottom contour, producing slower, mushier waves. Reef breaks like Pipeline often prefer higher tide for safety. Every break has a preferred tidal window — learn it by surfing different tides at your spot. NWS tide predictions (shown on Quiver's tide charts) are accurate to the minute.</p>`,
        keyTakeaway:
          "Mid-tide incoming is the safest bet for most beach breaks. Every spot has a preferred tidal window — learn yours.",
        image: {
          src: "/images/learn/learn-tide-pools.jpg",
          alt: "Exposed reef and tide pools at low tide",
          position: "right",
        },
      },
      {
        id: "detail",
        heading: "How Tide Changes Wave Shape at Different Break Types",
        content: `<p><strong>Beach breaks</strong> (sand bottom, shifting peaks): Mid-tide balances water depth over sandbars. Low tide makes bars too shallow — waves jack up fast and close out. High tide puts too much water over bars — waves don't break cleanly. The <strong>incoming tide</strong> is slightly better than outgoing because water pushes toward shore, adding energy.</p><p><strong>Reef breaks</strong>: Many prefer <strong>mid-to-high tide</strong> because the reef needs water coverage for safety and to shape the wave correctly. Pipeline, for example, is most rideable at 3-5 feet of tide. At extreme low tide, the reef is dangerously exposed.</p><p><strong>Point breaks</strong>: Typically less tide-sensitive because the bottom contour is rock, not sand. Rincon works across most tides but fires best on a <strong>dropping mid-tide</strong> when the swell wraps perfectly along the point.</p>`,
        keyTakeaway:
          "Beach breaks favor mid-tide, reef breaks need higher tide for safety, and point breaks are less sensitive but still have sweet spots.",
      },
      {
        id: "practical",
        heading: "What This Means for Your Session",
        content: `<p>Check Quiver's tide chart before every session — it shows exact high/low times and a visual curve so you can time your paddle-out to hit the <strong>mid-tide window</strong>. A typical tidal cycle is ~6 hours from low to high. If high tide is at noon, mid-tide (the best window) is roughly <strong>9-10 AM and 2-3 PM</strong>. Pair this with wind: if offshore dies by 10 AM but mid-tide is at 9 AM, you've got a one-hour golden window. The best surfers plan around both tide and wind, not just swell. After 10-15 sessions at the same break, you'll know its tidal sweet spot instinctively.</p>`,
        keyTakeaway:
          "Use tide charts to time your session within the mid-tide window. Pair tide timing with wind to find the golden hour at your break.",
      },
    ],
    faqs: [
      {
        question: "Is incoming or outgoing tide better for surfing?",
        answer:
          "Incoming (rising) tide is slightly better at most beach breaks because water pushes toward shore, adding energy to breaking waves. But the difference is subtle — the absolute tide height matters more than the direction.",
      },
      {
        question: "Can you surf at dead low or dead high tide?",
        answer:
          "Yes, but conditions are usually worst at the extremes. Dead low exposes hazards and makes waves close out. Dead high drowns the break. The hour before and after the extremes is the worst window. Stick to the middle third of the tidal range.",
      },
      {
        question: "Do tides affect all beaches the same way?",
        answer:
          "No. Steep beaches with deep water close to shore are less tide-sensitive. Shallow, flat beaches change dramatically with tide. Reef breaks depend on reef depth. You need to learn your specific break's response to tide.",
      },
      {
        question: "How much does tidal range matter?",
        answer:
          "Large tidal ranges (6+ feet, common in Northern California and Pacific Northwest) amplify the effect — the break changes dramatically between low and high. Small ranges (2-3 feet, common in Southern California) mean tide matters less.",
      },
    ],
    relatedLinks: [
      {
        label: "How Do Tides Work?",
        href: "/learn/how-do-tides-work",
        description:
          "Moon, sun, and gravity — the science behind tidal cycles.",
      },
      {
        label: "How to Read Surf Conditions",
        href: "/learn/how-to-read-surf-conditions",
        description: "Tide is one of five forecast metrics you need to read.",
      },
      {
        label: "Check Tide Charts",
        href: "/forecast",
        description:
          "See today's tide curve and optimal surf windows at your beach.",
      },
    ],
  },

  {
    slug: "how-are-waves-measured",
    title: "How Big Is 3 ft Surf? Face Height vs Hawaiian Scale",
    description:
      "A 3-5 ft forecast is significant wave height. Faces run 1.5-2x that, so 4.5-10 ft; Hawaiian scale calls the same wave half. Know which you're reading.",
    readingTimeMin: 3,
    datePublished: "2026-03-30",
    dateModified: "2026-09-02",
    heroImage: "/images/hero/hero-2-barrel-wave.webp",
    thumbnailImage: "/images/hero/hero-2-barrel-wave.webp",
    keywords: [
      "wave height measurement",
      "significant wave height",
      "how big is 3 foot surf",
      "face height vs forecast height",
      "hawaiian scale waves",
      "surf forecast height explained",
    ],
    sections: [
      {
        id: "answer",
        heading: "The Short Answer",
        content: `<p>Surf forecast height is <strong>significant wave height (Hs)</strong> — the average of the tallest third of waves measured by NDBC and CDIP buoys. Face height (what you actually see at the beach) runs <strong>1.5-2x</strong> the forecast number. So a "3-5 ft" forecast means roughly <strong>4.5-10 ft wave faces</strong>. Hawaiian scale uses roughly half of face height, adding further confusion. Always ask: which scale is being used?</p>`,
        keyTakeaway:
          "Forecast height (Hs) is 60-70% of face height. Multiply the forecast by 1.5-2x to estimate what you'll actually see.",
        image: {
          src: "/images/hero/hero-2-barrel-wave.webp",
          alt: "Barrel wave demonstrating face height vs forecast height",
          position: "right",
        },
      },
      {
        id: "detail",
        heading: "The Three Wave Measurement Scales",
        figureKey: "wave-height-reference",
        content: `<p><strong>Significant wave height (Hs)</strong>: Used by NOAA, WaveWatch III, and most forecast models. It's a statistical measure from buoys — the mean of the highest third of waves over a 20-minute sampling window. This is what you see on Quiver and most forecasting apps.</p><p><strong>Face height</strong>: What surfers actually see standing on the beach. A 3-foot Hs reading from a CDIP buoy translates to roughly 4.5-6 foot faces, depending on the break's bathymetry. Sandy beach breaks tend toward the higher multiplier; deep-water reefs toward the lower.</p><p><strong>Hawaiian scale</strong>: Used in Hawaii and by some old-school surfers. Roughly half of face height (or close to Hs). A "6-foot Hawaiian" wave has a 10-12 foot face. If someone in Hawaii says "it's 4 feet," prepare for 8-foot faces.</p>`,
        keyTakeaway:
          "Three scales exist: significant height (buoy/forecast), face height (what you see, 1.5-2x Hs), and Hawaiian scale (~0.5x face height).",
      },
      {
        id: "practical",
        heading: "What This Means for Your Session",
        content: `<p>When Quiver shows "4 ft at 14 sec," expect <strong>6-8 foot faces</strong> at most beach breaks. Beginners comfortable in 3-foot faces should look for forecasts of <strong>1.5-2 ft Hs</strong>. Don't compare numbers across apps without checking their measurement convention — Surfline, Quiver, and Windguru may use different scales or conversions. The best calibration: surf your local break at a known forecast, compare what you see, and build your personal conversion factor. After 10 sessions, you'll know that "3 feet on Quiver" means exactly what at your spot.</p>`,
        keyTakeaway:
          "Calibrate forecast numbers to your local break by comparing predictions to what you actually see over several sessions.",
      },
    ],
    faqs: [
      {
        question: "Why don't forecasts just use face height?",
        answer:
          "Significant wave height (Hs) is a standardized measurement from buoys. Face height varies by beach — the same swell produces different face heights at different breaks due to bottom contour, refraction, and focusing effects. Hs is the objective, comparable number.",
      },
      {
        question: "Is a 6-foot wave dangerous for beginners?",
        answer:
          "If that's 6-foot face height, yes — that's overhead and can hold you under. If it's 6-foot Hs, it means 9-12 foot faces, which is very large surf. Beginners should stay in 1-3 foot face height (roughly 0.5-2 ft Hs).",
      },
      {
        question: "Why do Hawaiians measure waves differently?",
        answer:
          "Historical tradition from the 1960s-70s surf culture. Hawaiian surfers measured from the back of the wave, not the face. The convention stuck. When a Hawaiian says '10 foot,' they mean a 15-20 foot face — it's not modesty, it's a different ruler.",
      },
      {
        question: "What's the biggest wave ever measured by a buoy?",
        answer:
          "NDBC buoy 46005 recorded significant wave heights over 50 feet during North Pacific storms. The largest individual waves in those events likely exceeded 90-100 feet face height. These are open-ocean measurements, not surfable coastline waves.",
      },
    ],
    relatedLinks: [
      {
        label: "How to Read Surf Conditions",
        href: "/learn/how-to-read-surf-conditions",
        description:
          "Height is one of five metrics — learn what they all mean.",
      },
      {
        label: "Swell Period Explained",
        href: "/learn/swell-period-explained",
        description: "Period matters more than height for wave quality.",
      },
      {
        label: "Check Wave Heights Now",
        href: "/forecast",
        description:
          "See current significant wave height at 279+ beaches.",
      },
    ],
  },

  {
    slug: "how-swell-direction-affects-surf",
    title: "How Does Swell Direction Affect Surf at Your Beach?",
    description:
      "Swell direction is the compass heading waves arrive from — 300 degrees means northwest. Every beach has a swell window determined by its coastline orientation and exposure. A 45-degree mismatch between swell direction and beach facing loses 10-15% wave energy. A 90-degree mismatch loses 50-70%.",
    readingTimeMin: 3,
    datePublished: "2026-03-30",
    dateModified: "2026-07-06",
    heroImage: "/images/learn/learn-aerial-shore.jpg",
    thumbnailImage: "/images/learn/learn-aerial-shore.jpg",
    keywords: [
      "swell direction surfing",
      "how swell direction affects waves",
      "best swell direction",
      "swell window",
      "wave direction beach",
      "swell angle surf",
    ],
    sections: [
      {
        id: "answer",
        heading: "The Short Answer",
        content: `<p>Swell direction is the compass heading waves arrive from — <strong>300° means northwest</strong>, 180° means south. Every beach has a <strong>swell window</strong> determined by its coastline orientation. Malibu faces south and needs south swells (170-210°). Rincon faces southwest. Ocean Beach SF faces west and catches everything from 250-320°. A <strong>45° mismatch</strong> between swell direction and beach exposure loses 10-15% wave energy. A <strong>90° mismatch</strong> means 50-70% loss — and often no rideable waves.</p>`,
        keyTakeaway:
          "Your beach needs the swell to face it directly. Check your break's swell window and compare against the forecast direction before driving.",
        image: {
          src: "/images/learn/learn-aerial-shore.jpg",
          alt: "Aerial view of swell lines approaching the coast at an angle",
          position: "right",
        },
      },
      {
        id: "detail",
        heading: "Swell Windows and Coastal Geometry",
        figureKey: "swell-origin-fetch",
        content: `<p>Every beach has a <strong>swell window</strong> — the range of compass degrees that deliver waves. A west-facing beach (facing 270°) receives swells from roughly 240-300°, depending on how much headland protection exists on either side. Islands, headlands, and underwater canyons all modify which swell angles reach the lineup. Scripps Canyon in La Jolla <strong>focuses southwest swells</strong>, amplifying them at nearby breaks like Windansea. Point Conception in Santa Barbara <strong>blocks northwest swells</strong> from reaching most of Southern California, which is why SoCal needs south or southwest swells while NorCal fires on northwest.</p><p>WaveWatch III forecasts report swell direction as the bearing the swell travels <strong>from</strong> — a "300° swell" comes from the northwest heading southeast. Quiver displays this for every forecast period so you can match direction to your break's window.</p>`,
        keyTakeaway:
          "Headlands, islands, and canyons shape which swell angles reach your break. NorCal catches NW swells; SoCal needs S or SW swells because Point Conception blocks NW energy.",
      },
      {
        id: "practical",
        heading: "What This Means for Your Session",
        content: `<p>Before driving to the beach, compare the forecast swell direction to your break's exposure. If the forecast shows 310° (NW) and your break faces south, save the gas. Check Quiver's surf map — it shows which breaks are <strong>receiving the current swell direction</strong> so you can pick the best option. Nearby breaks often face very different directions. In San Diego, Blacks Beach faces west-northwest while La Jolla Shores faces southwest — they fire on completely different swells. A 20-minute drive can mean the difference between flat and firing. Build a mental list of which breaks work for which swell directions, and you'll always have a backup when your primary spot is shadowed.</p>`,
        keyTakeaway:
          "Use Quiver's map to see which breaks catch the current swell direction. Nearby breaks can face different directions — always have a backup.",
      },
    ],
    faqs: [
      {
        question: "Can swell wrap around a headland?",
        answer:
          "Yes. Swell bends (refracts) around obstacles like headlands and islands. A south swell can wrap into a west-facing cove if there's enough energy. But wrapping reduces wave size significantly — typically 30-50% loss compared to direct exposure.",
      },
      {
        question: "Why does SoCal need south swells but NorCal doesn't?",
        answer:
          "Point Conception at Santa Barbara blocks northwest swells from reaching most of Southern California. SoCal sits in its 'shadow.' NorCal faces the open North Pacific directly and catches NW swells unobstructed. SoCal relies on south and southwest swells that pass under Point Conception.",
      },
      {
        question: "Does swell direction change during a swell event?",
        answer:
          "Yes. As a storm moves, the swell angle shifts. A NW swell at 300° on Monday might rotate to 280° (more westerly) by Wednesday as the storm tracks east. This can cause different breaks to turn on and off over several days.",
      },
      {
        question: "How do I find my break's swell window?",
        answer:
          "Open a map and look at which direction your beach faces — that's the center of its swell window. Add ±30-45° depending on headland protection. Or just surf it across different forecasted directions and note which ones produce the best waves.",
      },
    ],
    relatedLinks: [
      {
        label: "How to Read Surf Conditions",
        href: "/learn/how-to-read-surf-conditions",
        description:
          "Direction is one of five metrics you need to check.",
      },
      {
        label: "Groundswell vs Wind Swell",
        href: "/learn/groundswell-vs-wind-swell",
        description:
          "Ground swell travels in organized directions; wind swell is scattered.",
      },
      {
        label: "Surf Map",
        href: "/map",
        description:
          "See which breaks are catching the current swell direction.",
      },
    ],
  },

  {
    slug: "how-accurate-are-surf-forecasts",
    title: "How Accurate Are Surf Forecasts? 3-Day vs 10-Day Guide",
    description:
      "How accurate are surf forecasts? Learn how lead time changes uncertainty, what buoys measure, and what a fair forecast comparison requires.",
    readingTimeMin: 7,
    datePublished: "2026-03-30",
    dateModified: "2026-08-19",
    heroImage: "/images/learn/learn-misty-lineup.jpg",
    thumbnailImage: "/images/learn/learn-misty-lineup.jpg",
    keywords: [
      "surf forecast accuracy",
      "how accurate are surf forecasts",
      "wave forecast reliability",
      "NOAA wave model accuracy",
      "surf prediction accuracy",
      "ML surf forecast",
    ],
    sections: [
      {
        id: "answer",
        heading: "The Short Answer",
        content: `<p>Surf forecasts are useful estimates, not exact promises. Their reliability changes with <strong>lead time, swell source, coastline exposure, local wind, tide, and the quantity being predicted</strong>. A forecast issued for the next 12 hours has more observed data behind it than a map for day eight, but even the near-term call can miss a fast wind shift or the way one sandbar focuses a swell. Use a forecast to narrow the likely window, then verify it with current wind, buoy trends, cameras where available, and what you see from shore.</p><p>There is no honest universal accuracy percentage. Offshore significant wave height, breaking face height, arrival time, wind, and wave quality are different targets. Quiver has not completed a same-sample comparison against other surf forecasts and does not claim an accuracy ranking.</p>`,
        keyTakeaway:
          "Treat every forecast as a range of likely outcomes, and judge it by lead time, variable, location, and matching observations.",
        image: {
          src: "/images/learn/learn-misty-lineup.jpg",
          alt: "Surfer in misty conditions — forecast vs reality",
          position: "right",
        },
      },
      {
        id: "lead-time",
        heading: "Accuracy Changes With Lead Time",
        content: `<p>Think in planning bands rather than a single trustworthy-or-not label. Inside <strong>0-24 hours</strong>, the swell has often reached nearby buoys and the short-term wind picture is clearer, so you can choose a session window. At <strong>2-3 days</strong>, use the forecast to choose between days while leaving room for timing and size changes. At <strong>5-7 days</strong>, track whether a swell event is developing, not whether Tuesday at 7 AM will be shoulder high. At <strong>8-10 days</strong>, treat individual heights and arrival hours as scenarios.</p><p>A useful decision rule is to look for stability between updates. If direction, period, and arrival time remain similar across several runs, confidence is higher. If the peak jumps six or twelve hours or the swell angle keeps moving, keep plans flexible even when the headline height barely changes.</p>`,
        keyTakeaway:
          "Use 0-3 days for session decisions, 5-7 days for event tracking, and 8-10 days only for tentative scenarios.",
      },
      {
        id: "measurement",
        heading: "Know What the Number Measures",
        content: `<p>An offshore buoy usually reports <strong>significant wave height</strong>, a statistical description of the sea state at the sensor. A surf report may describe breaking faces, Hawaiian scale, backs of waves, or a broad human category such as waist-to-chest high. Those values are not interchangeable. A buoy several miles offshore also cannot see the final transformation over a reef, canyon, point, or shallow sandbar.</p><p>Before calling a forecast wrong, compare like with like: same timestamp, same location, same height definition, and the forecast that was available before the observation. A screenshot taken after a model update is not a fair record of yesterday's prediction. The <strong>forecast-accuracy</strong> page documents Quiver's evaluation method and limitations.</p>`,
        keyTakeaway:
          "An offshore buoy can check an offshore forecast; it cannot directly verify the breaking face at your beach.",
      },
      {
        id: "local-transform",
        heading: "Why the Same Offshore Swell Produces Different Surf",
        content: `<p>Models describe energy moving through an ocean grid. Your break adds another layer. A swell inside one beach's open window may be partly blocked at the next cove. Long-period energy can refract around a point or focus through a submarine canyon. A beach break can change after one storm rearranges its bars. Tide can turn a soft shoulder into a closeout or make a shallow reef unsuitable.</p><p>This is why two beaches ten miles apart can receive the same offshore swell and show different size and shape. If the offshore data looks right but the beach call misses repeatedly in one direction or tide range, the likely issue is local transformation rather than the entire swell forecast. Record the exception instead of inventing a universal correction.</p>`,
        keyTakeaway:
          "Separate offshore swell quality from the local bathymetry, exposure, and tide that turn it into breaking waves.",
      },
      {
        id: "fast-changing-inputs",
        heading: "Wind and Mixed Swells Create the Hardest Calls",
        content: `<p>A clean, established groundswell is generally easier to track than a short-lived local wind swell. Local wind can build texture quickly, shift direction between forecast intervals, or arrive earlier at an exposed beach than at a sheltered one. Mixed swells add another trap: the displayed primary swell may not be the one producing the best sets at your peak.</p><p>Check the components, not only the combined height. A modest long-period swell from the useful direction can matter more than a larger short-period component aimed poorly at the break. When wind is forecast near the onshore-offshore boundary for your beach, a small direction error can flip the practical result. That is a low-confidence session even if the wave-height line looks stable.</p>`,
        keyTakeaway:
          "Confidence should drop when local wind is changing quickly, multiple swells overlap, or direction sits near the edge of a break's window.",
      },
      {
        id: "verification",
        heading: "Run a Three-Check Verification Before Leaving",
        content: `<p>First, compare the latest buoy trend with the forecasted arrival: are height and dominant period rising, flat, or falling? A swell may be late, but a distant buoy can also represent a different exposure. Second, check the most recent wind observation against the forecast. A predicted light offshore that is already moderate onshore should change the plan. Third, inspect a camera or the beach itself for actual breaking size, crowd, current, and surface quality.</p><p>If one check disagrees, investigate rather than automatically trusting either source. If two disagree, downgrade confidence and choose a flexible option. Current observations still do not make surfing safe; heed lifeguards, posted warnings, closures, and your own judgment at the beach.</p>`,
        keyTakeaway:
          "Verify the buoy trend, current wind, and the beach itself; two conflicting checks are a reason to downgrade the plan.",
      },
      {
        id: "personal-calibration",
        heading: "Build a Calibration for One Break",
        content: `<p>Keep a short log for <strong>10-20 sessions</strong>: forecasted swell height, period and direction; predicted wind and tide; actual paddle-out time; and a plain-language result such as undercalled, close, or overcalled. Note where you stood, because a beach break may vary by several peaks. Patterns become useful only when the measurement stays consistent.</p><p>Look for conditional rules: “This south swell needs at least 14 seconds to wrap,” or “The main peak gets soft above a certain tide.” Do not turn a handful of memorable days into a formula. Seasonal sand movement can invalidate last month's relationship, and a rule learned on a long-period groundswell may not apply to local wind swell.</p>`,
        keyTakeaway:
          "A consistent 10-20-session log can reveal local patterns, but those patterns remain conditional on season, swell type, and tide.",
      },
      {
        id: "fair-comparison",
        heading: "How to Compare Two Forecasts Fairly",
        content: `<p>Save both forecasts at the same issue time for the same beach and lead-time bucket. Decide beforehand whether you are scoring offshore height, breaking height, peak arrival, wind, or another variable. Use the same observation source and tolerance for both. Then repeat across enough ordinary and difficult events that one lucky swell does not decide the result.</p><p>Comparisons fail when one service is checked at a buoy and another against a camera, when updated forecasts replace the original predictions, or when “looked better” substitutes for a defined measurement. Until Quiver has a same-sample comparison with documented definitions and results, it is honest to explain the method without claiming to be more accurate than another provider.</p>`,
        keyTakeaway:
          "A fair comparison requires saved forecasts, identical samples and definitions, and the same ground truth for every provider.",
      },
    ],
    faqs: [
      {
        question: "Why are some forecasts more accurate than others?",
        answer:
          "Reliability changes with lead time, swell regime, local exposure, data coverage, and the variable being scored. A beach near a buoy may have stronger offshore ground truth, but that buoy still does not directly measure breaking face height.",
      },
      {
        question: "How does Quiver's ML correction work?",
        answer:
          "Quiver uses buoy history when evaluating forecast inputs and adjustments. A valid evaluation saves the forecast before the observation arrives, pairs it to a documented station and time window, and keeps offshore significant wave height separate from breaking face height.",
      },
      {
        question: "How does Quiver's forecast accuracy compare to other apps?",
        answer:
          "Quiver has not completed a same-sample comparison against other surf forecasts. Without identical beaches, timestamps, lead times, observations, and wave-height definitions, Quiver does not claim an accuracy ranking.",
      },
      {
        question: "Should I trust a 10-day forecast?",
        answer:
          "Use it to notice a possible swell pattern, not to commit to an exact session time or height. Recheck around five days, three days, the night before, and again against current observations.",
      },
      {
        question: "Can a buoy tell me exactly how big my beach will be?",
        answer:
          "No. A buoy measures the sea state at its location. Swell direction, period, shelter, refraction, bathymetry, tide, and local wind determine how that energy breaks at your beach.",
      },
      {
        question: "Why did the forecast miss the swell arrival time?",
        answer:
          "The storm track or generation area may have changed, different periods travel at different speeds, or the buoy and beach may sit on different paths. Watch the trend across upstream and local observations rather than one timestamp.",
      },
    ],
    relatedLinks: [
      {
        label: "Forecast Accuracy Methodology",
        href: "/forecast-accuracy",
        description:
          "See how wave-height forecasts should be checked and compared.",
      },
      {
        label: "How Surf Forecasts Work",
        href: "/learn/how-surf-forecasts-work",
        description:
          "From satellites to ML: the full forecasting pipeline.",
      },
      {
        label: "Check Your Forecast",
        href: "/forecast",
        description: "ML-corrected forecasts for 279+ beaches.",
      },
    ],
  },

  {
    slug: "best-time-of-day-to-surf",
    title: "Best Time of Day to Surf: Why Morning Usually Wins",
    description:
      "Dawn usually wins on wind, but not always. What makes morning surf cleaner, when an afternoon glass-off beats it, and how to check today's window.",
    readingTimeMin: 7,
    datePublished: "2026-03-30",
    dateModified: "2026-09-02",
    heroImage: "/images/learn/learn-dawn-patrol.jpg",
    thumbnailImage: "/images/learn/learn-dawn-patrol.jpg",
    keywords: [
      "best time to surf",
      "dawn patrol surfing",
      "when to surf",
      "glass off surfing",
      "morning surf vs afternoon",
      "best time of day waves",
      "why waves better morning",
      "morning surf better",
      "glassy conditions",
      "thermal wind surfing",
      "dawn patrol why",
      "offshore morning",
    ],
    sections: [
      {
        id: "answer",
        heading: "The Short Answer",
        content: `<p>The best time of day is the window when <strong>swell, wind, tide, daylight, and crowd level</strong> line up at your break. Dawn often wins because overnight cooling can leave light land-to-sea or calm wind before daytime heating builds an onshore sea breeze. A late-afternoon glass-off can offer a second chance when that breeze fades. Neither window is automatic: a front, trade wind, marine layer, canyon wind, or unfavorable tide can make midday or another hour the better call.</p><p>Start with the swell window, then compare wind direction and speed by hour, tide stage, and sunrise or sunset. Treat familiar times such as 5:30-8 AM or 4-6 PM as examples, not universal rules.</p>`,
        keyTakeaway:
          "Choose the overlap of swell, favorable wind, workable tide, and daylight; dawn is a common pattern, not a guarantee.",
        image: {
          src: "/images/learn/learn-dawn-patrol.jpg",
          alt: "Surfers heading out at golden hour during dawn patrol",
          position: "right",
        },
      },
      {
        id: "thermal-cycle",
        heading: "Why Waves Are Often Cleaner in the Morning",
        content: `<p>Land changes temperature faster than the adjacent ocean. Overnight, the ground loses heat and the air above it cools. When that cooler, denser air flows toward relatively warmer water, a west-facing beach may receive an easterly <strong>offshore land breeze</strong>. Light offshore wind smooths small surface chop and pushes against the breaking lip, helping the face stay organized.</p><p>After sunrise, land warms. If the larger weather pattern is weak enough, rising warm air over land draws cooler marine air shoreward and establishes an <strong>onshore sea breeze</strong>. The change is a circulation, not a stopwatch. Terrain, cloud cover, season, and the land-ocean temperature contrast determine whether the switch happens early, late, or not at all.</p>`,
        keyTakeaway:
          "Morning quality often comes from the land-breeze side of a land-sea thermal circulation, which daytime heating may reverse.",
      },
      {
        id: "wind-reading",
        heading: "Translate Wind Direction for Your Beach",
        content: `<p>“East wind” is not automatically offshore. It describes where wind comes from, and the result depends on beach orientation. An east wind is offshore at a west-facing beach, onshore at an east-facing beach, and cross-shore on many north- or south-facing stretches. Curved bays and headlands complicate the compass relationship further.</p><p>Use a map to identify the direction the beach faces, then compare hourly wind arrows. As a practical screen, <strong>calm to light favorable wind</strong> usually deserves a look; increasing cross-onshore or onshore wind lowers surface quality. Strong offshore wind can also be a poor choice because it blows spray into your vision, makes entry and paddling harder, and can carry a surfer or board seaward. Conditions and ability still decide.</p>`,
        keyTakeaway:
          "Convert the forecasted compass direction into offshore, cross-shore, or onshore for the exact beach rather than relying on a generic label.",
      },
      {
        id: "tide-and-swell",
        heading: "Let Tide and Swell Override the Alarm Clock",
        content: `<p>Clean wind cannot fix the wrong tide or a swell outside the break's exposure window. A reef may become too shallow near low tide; a steep beach can backwash near high tide; a point may need enough water over an inside section; and a beach break may work best only while a particular bar has a usable depth. Those relationships are local and can change with sand movement.</p><p>Compare the best wind window with the tide curve. If dawn is clean but the known tide window arrives at 11 AM, check whether wind remains acceptable until then. If not, choose the less compromised combination rather than chasing one perfect variable. Posted closures, lifeguard guidance, current, visibility, and your own judgment take priority over any timing rule.</p>`,
        keyTakeaway:
          "The best hour is the best overlap, not necessarily the cleanest wind hour; tide and swell exposure can be decisive.",
      },
      {
        id: "glass-off",
        heading: "When an Afternoon Glass-Off Is Worth Watching",
        content: `<p>A glass-off happens when daytime wind weakens enough for the surface to smooth, often as heating fades late in the day. Watch the hourly trend: a steady drop toward calm before sunset is more promising than a forecast that remains onshore through dark. Also check the live observation, because the fade can occur earlier or later than the model interval.</p><p>The window may last less than an hour, and smooth water does not mean the swell improved. Afternoon tide, crowd, glare, and limited daylight may erase the advantage. Decide on a latest safe entry time and leave margin to return before visibility becomes poor. If wind is still building or the tide is moving out of range, glass-off is a hope rather than a plan.</p>`,
        keyTakeaway:
          "Look for a measured wind decrease before sunset and enough tide and daylight margin; smooth water alone is not a complete session call.",
      },
      {
        id: "exceptions",
        heading: "Know When the Morning Pattern Does Not Apply",
        content: `<p>Large-scale, or synoptic, weather can overpower the local thermal circulation. Fronts, strong pressure gradients, persistent trade winds, Santa Ana-type offshore events, and coastal lows may set the wind from midnight through afternoon. A morning can therefore start choppy, stay strongly offshore, or improve later after a front passes.</p><p>Fog and marine cloud can delay land heating and the sea-breeze transition, but fog is not proof of offshore wind. It can arrive with onshore flow, reduce visibility, and hide sets or landmarks. The land-sea cycle occurs on many coasts, yet it is not equally strong worldwide: high latitudes, monsoon regimes, exposed islands, and windy seasons may be controlled mainly by broader weather. Check the local pattern rather than exporting a California schedule.</p>`,
        keyTakeaway:
          "Fronts and regional wind regimes can dominate; fog may delay heating but can also arrive with onshore wind and poor visibility.",
      },
      {
        id: "decision-routine",
        heading: "Use a Night-Before and Beach-Arrival Check",
        content: `<p>The night before, shortlist two windows: a primary session and a fallback. Compare hourly wind, tide stage, swell direction and period, sunrise or sunset, and any advisories. In the morning, check whether the actual wind and buoy trend match the forecast. A one-hour timing shift is common enough that flexibility matters more than a rigid alarm.</p><p>At the beach, watch at least two or three set cycles. Check surface texture outside, current, the paddle route, crowd movement, and whether the expected peak is working. If the forecast and ocean disagree, trust the observed conditions while staying within your ability. No timing method makes surfing safe; defer to lifeguards and posted conditions and choose not to paddle out when the situation is unclear.</p>`,
        keyTakeaway:
          "Plan a primary and fallback window, then confirm the call from shore across several sets before deciding.",
      },
    ],
    faqs: [
      {
        question: "Is dawn patrol always the best time?",
        answer:
          "No. Dawn is favored when the local land breeze is light and the tide and swell also work. A front, strong regional wind, poor visibility, current, or the wrong tide can make another window better or make the session unsuitable.",
      },
      {
        question: "What is glass-off?",
        answer:
          "Glass-off is the surface cleanup that occurs when daytime wind weakens, often late in the afternoon. It can be brief or fail to occur, so compare the forecasted trend with current observations and preserve enough daylight for the session.",
      },
      {
        question: "Does time of day affect wave size?",
        answer:
          "The swell source does not grow because it is morning, but tide, local wind swell, and surface texture can change what breaks at the beach. Time of day mainly affects local wind and the practical quality of a given swell.",
      },
      {
        question: "Why are some mornings still choppy?",
        answer:
          "A front, coastal low, trade wind, or other large-scale pressure pattern can overpower the weak land breeze. Leftover wind chop from overnight can also remain after the local wind eases.",
      },
      {
        question: "Does fog extend the offshore window?",
        answer:
          "It can delay solar heating and postpone a sea-breeze switch, but fog does not guarantee offshore wind. Marine fog often accompanies onshore flow and reduces visibility, so verify wind and conditions rather than using fog alone.",
      },
      {
        question: "Does the morning pattern hold worldwide?",
        answer:
          "Land-sea thermal circulation occurs on many coastlines, but its strength and timing vary. Seasonal trade winds, monsoons, fronts, high-latitude weather, island terrain, and local topography can dominate the daily cycle.",
      },
    ],
    relatedLinks: [
      {
        label: "Offshore vs Onshore Wind",
        href: "/learn/offshore-vs-onshore-wind-surfing",
        description: "Why wind direction matters more than wind speed.",
      },
      {
        label: "How to Read Surf Conditions",
        href: "/learn/how-to-read-surf-conditions",
        description: "Combine wind, tide, swell, and local observations.",
      },
      {
        label: "Check Wind Forecast",
        href: "/forecast",
        description:
          "See the 3-hour wind forecast for your break tonight.",
      },
    ],
  },

  {
    slug: "is-it-safe-to-surf-after-rain",
    title: "Is It Safe to Surf in the Rain or After It Rains?",
    description:
      "Light rain is fine; runoff after heavy rain is not. When the 72-hour rule applies, how to spot a dirty lineup, and where to surf instead.",
    readingTimeMin: 2,
    datePublished: "2026-03-30",
    dateModified: "2026-09-02",
    heroImage: "/images/learn/learn-choppy-sea.jpg",
    thumbnailImage: "/images/learn/learn-choppy-sea.jpg",
    keywords: [
      "surfing after rain",
      "is it safe to surf after rain",
      "ocean water quality after rain",
      "72 hour rule surfing",
      "storm drain runoff surfing",
      "surfrider water quality",
    ],
    sections: [
      {
        id: "answer",
        heading: "The Short Answer",
        content: `<p>The standard recommendation from the <strong>Surfrider Foundation</strong> and public health agencies is wait <strong>72 hours</strong> after rain before surfing near urban areas. Storm drains flush bacteria (fecal coliform, Enterococcus), chemicals, oil, pesticides, and debris into the ocean. A Surfrider study found <strong>12 extra illness cases per 1,000 surfers</strong> exposed to wet-weather runoff. Risk varies by location, rainfall intensity, and proximity to storm drain outfalls and river mouths.</p>`,
        keyTakeaway:
          "Wait 72 hours after rain near urban areas. Storm drains flush bacteria and chemicals. Risk increases near river mouths and storm drain outfalls.",
      },
      {
        id: "surfing-while-raining",
        heading: "Surfing While It Is Raining",
        content: `<p>Rain falling on the lineup is not the hazard. Light rain often thins the crowd and can arrive with calm, glassy conditions, and the water you are surfing in is the same water that was there an hour earlier. The two things that change the answer are what is happening in the sky and what the rain is about to wash into the sea.</p><p>Lightning ends the session. If you can hear thunder, you are close enough to be struck, and the ocean offers no cover. Get out, wait until thirty minutes have passed since the last thunder, and only then reassess. Heavy rain is the second signal: it is the start of the runoff problem below, not a separate one. A drizzle at a clean open-coast beach is a normal surf. A downpour next to a storm drain or river mouth is the beginning of the 72-hour clock.</p>`,
        keyTakeaway:
          "Rain itself is fine; lightning is not. Heavy rain near drains or river mouths starts the runoff clock rather than ending the risk.",
      },
      {
        id: "detail",
        heading: "What's Actually in the Water After Rain",
        content: `<p>Urban runoff carries <strong>fecal indicator bacteria</strong> (from pet waste, sewage overflows, and homeless encampments), <strong>heavy metals</strong> (from road surfaces), <strong>pesticides and herbicides</strong> (from lawns and agriculture), and <strong>oil and grease</strong> (from parking lots). The EPA's BEACH Act requires monitoring at popular swimming beaches, but surf breaks often fall outside monitored zones.</p><p>Risk factors: <strong>proximity to a storm drain outfall or river mouth</strong> (highest risk — bacteria counts spike 10-100x), <strong>rainfall intensity</strong> (heavy rain overwhelms treatment systems), and <strong>water circulation</strong> (enclosed bays flush slower than exposed coastline). Open-coast point breaks far from rivers clear faster than enclosed beach breaks near harbors. The <strong>San Diego River mouth</strong>, <strong>Malibu Creek</strong>, and <strong>Tijuana River</strong> are notoriously polluted after rain.</p>`,
        keyTakeaway:
          "Storm drains near surf breaks spike bacteria 10-100x after rain. Highest risk: near river mouths and in enclosed bays. Open coast clears faster.",
      },
      {
        id: "practical",
        heading: "What This Means for Your Session",
        content: `<p>After rain, <strong>avoid breaks near storm drains, river mouths, and harbors for 72 hours</strong>. Check local water quality reports — Heal the Bay (California) and Surfrider publish near-real-time beach grades. If you must surf sooner, choose an <strong>open-coast break far from runoff sources</strong> with good water circulation. Avoid getting water in your mouth, eyes, and open cuts. Shower immediately after. Ear plugs reduce ear infection risk. If you develop <strong>fever, gastrointestinal symptoms, or ear/sinus infection</strong> within 72 hours of surfing post-rain, see a doctor and mention ocean exposure.</p>`,
        keyTakeaway:
          "Check Heal the Bay or Surfrider water quality reports. Choose open-coast breaks far from drains. Shower immediately after surfing post-rain.",
      },
    ],
    faqs: [
      {
        question: "Is the 72-hour rule always necessary?",
        answer:
          "It depends on location. Open coastline far from rivers clears in 24-48 hours. Near river mouths or harbors, 72 hours is the minimum. After major storms, some areas like the Tijuana River zone can stay contaminated for a week or more.",
      },
      {
        question: "Can rain actually improve surf conditions?",
        answer:
          "Yes — storms that bring rain also bring swell. The irony of surfing is that the same weather system producing great waves also contaminates the water. Many surfers accept the risk for a pumping storm swell, but it's a personal health decision.",
      },
      {
        question: "What illness symptoms come from contaminated water?",
        answer:
          "Most common: gastroenteritis (nausea, diarrhea, cramps) from swallowing water, ear infections (otitis externa), sinus infections, and skin rashes. Symptoms typically appear 12-72 hours after exposure. Serious infections are rare but possible with open wounds.",
      },
      {
        question: "Where can I check water quality before surfing?",
        answer:
          "Heal the Bay (healthebay.org/beach-report-card) covers California. Surfrider Foundation (surfrider.org) covers national beaches. Many counties post advisories at beaches after rain. Check before you paddle — especially near urban areas.",
      },
    ],
    relatedLinks: [
      {
        label: "Best Time of Day to Surf",
        href: "/learn/best-time-of-day-to-surf",
        description:
          "Time your session around conditions, not just swell.",
      },
      {
        label: "What Equipment Do I Need?",
        href: "/learn/what-equipment-to-start-surfing",
        description: "Earplugs and rash guards reduce post-rain risk.",
      },
    ],
  },

  {
    slug: "what-wetsuit-thickness-do-i-need",
    title: "What Wetsuit Thickness Do I Need?",
    description:
      "Match wetsuit thickness to water temperature. Above 72°F: boardshorts or rashguard. 65-72°F: 2mm spring suit. 60-65°F: 3/2mm full suit. 55-60°F: 4/3mm full suit with optional boots. Below 55°F: 5/4mm full suit with boots, gloves, and hood. Check real-time water temps on Quiver.",
    readingTimeMin: 2,
    datePublished: "2026-03-30",
    heroImage: "/images/hero/hero-1-la-jolla.webp",
    thumbnailImage: "/images/hero/hero-1-la-jolla.webp",
    keywords: [
      "wetsuit thickness guide",
      "what wetsuit do i need",
      "wetsuit temperature chart",
      "3/2 vs 4/3 wetsuit",
      "wetsuit for cold water surfing",
      "surf wetsuit guide",
    ],
    sections: [
      {
        id: "answer",
        heading: "The Short Answer",
        content: `<p>Match wetsuit thickness to water temperature: <strong>Above 72°F</strong>: boardshorts or rashguard. <strong>65-72°F</strong>: 2mm spring suit or shorty. <strong>60-65°F</strong>: 3/2mm full suit (standard California suit). <strong>55-60°F</strong>: 4/3mm full suit with optional boots. <strong>Below 55°F</strong>: 5/4mm+ with boots, gloves, and hood. Check real-time water temperature on Quiver's beach pages — it varies significantly by region and season across NOAA monitoring stations.</p>`,
        keyTakeaway:
          "Wetsuit thickness maps directly to water temperature. A 3/2mm fits most of California year-round. Below 55°F, add boots, gloves, and hood.",
        image: {
          src: "/images/hero/hero-1-la-jolla.webp",
          alt: "Surfers at La Jolla — water temperature determines wetsuit choice",
          position: "right",
        },
      },
      {
        id: "detail",
        heading: "The Complete Temperature-to-Thickness Chart",
        content: `<p><strong>72°F+ (Hawaii, summer Florida, Puerto Rico)</strong>: Boardshorts and rash guard. A 1mm top if windy.</p><p><strong>65-72°F (SoCal summer, warm East Coast)</strong>: 2mm spring suit (short arms, short legs) or 2mm full suit. You won't overheat or freeze.</p><p><strong>60-65°F (SoCal winter, NorCal summer)</strong>: 3/2mm full suit — <strong>3mm torso, 2mm arms/legs</strong>. This is the standard California wetsuit. Most surfers own this as their primary suit.</p><p><strong>55-60°F (NorCal winter, Pacific Northwest, winter NJ/NY)</strong>: 4/3mm full suit with <strong>3mm boots</strong> for thermal protection and reef safety. Some surfers add gloves below 58°F.</p><p><strong>Below 55°F (Maine, Great Lakes, deep NorCal winter)</strong>: 5/4mm+ hooded suit with <strong>5mm boots, 4mm gloves</strong>, and integrated or separate hood. Ice cream headaches are real at 50°F.</p>`,
        keyTakeaway:
          "72°F+ = trunks, 65-72°F = 2mm, 60-65°F = 3/2mm, 55-60°F = 4/3mm + boots, below 55°F = 5/4mm + full accessories.",
      },
      {
        id: "practical",
        heading: "What This Means for Your Session",
        content: `<p>Check Quiver's water temperature on your beach page before packing — temperatures can swing <strong>5-10°F within a few weeks</strong> during spring and fall transitions. San Diego water ranges from <strong>57°F in February to 72°F in August</strong>. Santa Cruz ranges from <strong>50°F to 62°F</strong>. The wrong suit ruins a session: too thin and you'll be shivering after 20 minutes, too thick and you'll overheat and lose flexibility. If you surf one region year-round, you typically need <strong>two suits</strong> — a thinner one for summer and a thicker one for winter. Brands like O'Neill, Xcel, Patagonia, and Rip Curl all make quality suits. Budget $200-400 for a good 3/2mm full suit.</p>`,
        keyTakeaway:
          "Check water temp before packing. Most surfers need two suits — summer and winter. Budget $200-400 for a quality full suit.",
      },
    ],
    faqs: [
      {
        question: "What does 3/2mm mean?",
        answer:
          "3mm neoprene on the torso (where you need warmth most) and 2mm on the arms and legs (where you need flexibility). The first number is always the thickest panel. A 4/3mm is 4mm torso, 3mm limbs.",
      },
      {
        question: "Do I need a wetsuit in Hawaii?",
        answer:
          "Usually no. Hawaii water temperatures range from 74-80°F year-round. Boardshorts and a rash guard are standard. On windy winter days at North Shore spots, a 1-2mm vest or jacket can help with wind chill.",
      },
      {
        question: "How long does a wetsuit last?",
        answer:
          "With proper care (rinse after every session, hang dry out of sun), a quality wetsuit lasts 2-3 years of regular use. Seam integrity degrades first — if water seeps through seams, it's time to replace it.",
      },
      {
        question: "Is a more expensive wetsuit worth it?",
        answer:
          "Yes, for warmth and flexibility. Premium suits ($300-500) use lighter, stretchier neoprene and better seam construction. Budget suits ($100-200) work but are stiffer and less warm. If you surf 2+ times per week, invest in quality.",
      },
    ],
    relatedLinks: [
      {
        label: "What Equipment Do I Need?",
        href: "/learn/what-equipment-to-start-surfing",
        description: "Full beginner gear list with budget estimates.",
      },
      {
        label: "Best Conditions for Beginners",
        href: "/learn/best-surf-conditions-for-beginners",
        description: "Ideal wave size, period, and conditions to learn in.",
      },
      {
        label: "Check Water Temperature",
        href: "/forecast",
        description: "Real-time water temps at 279+ beaches.",
      },
    ],
  },

  {
    slug: "what-size-surfboard-should-i-get",
    title: "What Size Surfboard Should I Get?",
    description:
      "Beginners: 8-9 foot soft-top foamie with 60-80 liters of volume, roughly 1-3 feet taller than you. Volume determines paddle ease and stability. After 50+ sessions of consistent wave-catching, size down to a 7-foot funboard. Shortboards (5'8\"-6'4\") are for intermediate surfers with 100+ sessions.",
    readingTimeMin: 7,
    datePublished: "2026-03-30",
    dateModified: "2026-08-19",
    heroImage: "/images/activities/longboarding.webp",
    thumbnailImage: "/images/activities/longboarding.webp",
    keywords: [
      "what size surfboard",
      "beginner surfboard size",
      "surfboard volume guide",
      "foamie surfboard",
      "first surfboard",
      "surfboard size chart",
    ],
    sections: [
      {
        id: "answer",
        heading: "The Short Answer",
        content: `<p>For a first board, most adults should begin their search around an <strong>8-9 foot soft-top with roughly 60-90 liters</strong>, then adjust for body weight, paddle fitness, wave type, and storage. Length is only one dimension. Width, thickness, outline, and volume decide whether the board glides early and stays steady during a pop-up.</p><p>The correct first board is the one that lets you catch many manageable waves while maintaining control. A smaller board is not automatic progress. If you are missing waves, sinking the tail while paddling, or standing only after the wave has broken, add glide and stability before blaming technique. For the rest of the starter kit, use the <a href="/learn/what-equipment-to-start-surfing">beginner equipment checklist</a>.</p>`,
        keyTakeaway:
          "Start around 8-9 feet and 60-90 liters, then fit the board to your weight, wave type, control, and actual wave-catching rate.",
        image: {
          src: "/images/activities/longboarding.webp",
          alt: "Longboarder riding a mellow wave — bigger boards catch more waves",
          position: "right",
        },
      },
      {
        id: "detail",
        heading: "Why Volume Matters More Than Length",
        content: `<p><strong>Volume</strong> is a useful flotation clue, but it is not a complete sizing formula. Two 70-liter boards can feel different if one is long and narrow while the other is short, wide, and thick. Length and a fuller nose improve glide; width adds side-to-side stability; thickness adds float; rail and tail shape affect how easily the board turns and holds.</p><p>Use liters as a guardrail. A lighter, fit beginner in gentle whitewater may manage the lower end of the 60-90-liter starting band. A heavier surfer, infrequent surfer, or learner at a weak beach usually benefits from the upper end or more. If the deck sinks noticeably while you paddle or the board stalls between strokes, it is probably under-volumed for the job.</p>`,
        keyTakeaway:
          "Use volume as a guardrail, then check how length, width, thickness, and outline distribute that float.",
      },
      {
        id: "practical",
        heading: "What This Means for Your Session",
        content: `<p>Size down when your current board limits a specific skill, not because a calendar says it is time. A useful readiness check is whether you can catch unbroken waves without being pushed, angle the takeoff both ways, trim down the line, turn around efficiently, and keep control through the inside on most ordinary sessions.</p><p>Change one variable at a time. Moving from an 8-foot foam board near 70 liters to a 7-foot hard board near 45 liters changes length, volume, rails, weight, and durability at once. A fuller 7'6"-8'0" mid-length can make the transition easier. Keep the larger board so you can compare wave count on weak days instead of forcing the smaller board into unsuitable surf.</p>`,
        keyTakeaway:
          "Downsize only to solve a clear limitation, and change one major dimension at a time so you can tell what helped.",
      },
      {
        id: "weight-bands",
        heading: "Use Weight Bands as a Starting Filter",
        content: `<p>For an adult beginner in mellow surf, a practical shop-floor screen is <strong>7'6"-8'0" and 55-70 liters below about 150 lb</strong>, <strong>8'0"-9'0" and 65-85 liters from about 150-200 lb</strong>, and <strong>9'0" or larger with 80-100+ liters above about 200 lb</strong>. These are broad starting bands, not engineering limits.</p><p>Move upward when you surf less than weekly, have limited shoulder endurance, learn in weak waves, or want maximum stability. Move toward the lower edge only when you have strong paddle fitness, frequent coaching, and a controlled learner wave. Children need a board they can carry and control; an adult-sized 9-footer can be too much even if it floats them easily.</p>`,
        keyTakeaway:
          "Start with a weight band, then move up for weaker waves or less paddle fitness and down only when control and coaching support it.",
      },
      {
        id: "wave-type",
        heading: "Match the Board to the Waves You Will Actually Surf",
        content: `<p>Weak, rolling surf rewards length, foam, and glide. A board that catches a one-to-two-foot reform early may feel bulky in steeper, faster waves. Conversely, a compact board designed for a steep pocket can be frustrating at a soft beach where the wave barely pushes.</p><p>Base the purchase on the conditions you will surf <strong>most often</strong>, not the best photo from the local break. If lessons happen in waist-deep whitewater, stability and safe control matter more than turning response. If the only suitable learner wave has a long walk or tight storage, test whether you can carry and transport the board before buying. Never choose a more demanding wave merely to justify a smaller board.</p>`,
        keyTakeaway:
          "Size for your ordinary learner wave and transport reality, not for rare good days or an aspirational board category.",
      },
      {
        id: "fit-test",
        heading: "Run a Rental Test Before Buying",
        content: `<p>Rent or borrow two nearby sizes in similar conditions. Count <strong>wave attempts, waves caught, clean pop-ups, and controlled finishes</strong> over 30-60 minutes. If the smaller board cuts the successful wave count roughly in half without unlocking a skill you can use, it is too large a step. If both perform similarly and you can carry and control the smaller one, the smaller size may be reasonable.</p><p>Do not compare a clean small day on one board with a windy larger day on another. Ask a reputable instructor or shop to watch your paddling position and takeoff rather than recommending from height alone. A board that floats you but is too wide to paddle comfortably can also be the wrong fit.</p>`,
        keyTakeaway:
          "Compare nearby sizes in the same conditions and measure successful waves, not how advanced the smaller board looks.",
      },
      {
        id: "used-board-check",
        heading: "Check Whether a Used Board Still Matches Its Label",
        content: `<p>On a soft-top, check for a waterlogged feel, delamination or bubbles, torn fin boxes, loose leash plug, and a slick or badly creased deck. On a hard board, inspect the nose, tail, rails, fin boxes, and deck for open cracks or soft spots. Repaired cosmetic damage can be fine; unrepaired damage that admits water changes weight and durability.</p><p>Confirm the printed dimensions and volume when available, but do not assume every “8-foot beginner board” has the same stability. Install the fins and leash, lift the board, and lie on it if the seller allows. A low price does not help if the board is difficult to control or needs immediate structural repair.</p>`,
        keyTakeaway:
          "Inspect condition, dimensions, and control together; damage or an unusual outline can make the labeled size misleading.",
      },
    ],
    faqs: [
      {
        question: "Can a bigger person start on a smaller board?",
        answer:
          "No. Board size should match your weight, not your athletic background. A 220-lb athlete needs a 9-foot foamie just like a 220-lb beginner. The physics of paddling and wave-catching don't care about your gym fitness — ocean fitness is different.",
      },
      {
        question: "Are Wavestorms actually good?",
        answer:
          "Yes. The Costco Wavestorm 8-foot foamie is the best-selling surfboard in history for a reason. It's stable, forgiving, catches waves easily, and costs $100-150. Many experienced surfers keep one for small-wave fun days. It's the correct first board.",
      },
      {
        question: "When should I switch to a shortboard?",
        answer:
          "When you can consistently catch unbroken green waves, ride down the line, and generate speed on a funboard. This typically takes 100-200 sessions over 1-2 years. If you're still struggling to catch waves on your funboard, you're not ready for a shortboard.",
      },
      {
        question: "Does board shape matter for beginners?",
        answer:
          "Yes, although fine design details matter less than glide and stability at first. A fuller nose, generous width, adequate thickness, and forgiving rails usually help. No single width or thickness guarantees a good fit.",
      },
      {
        question: "Should I size a surfboard from my height?",
        answer:
          "Height helps with stance and carrying, but body weight, paddle fitness, volume distribution, wave power, and skill are more useful. Two surfers of equal height may need very different boards.",
      },
      {
        question: "Is the smallest board I can stand on the right size?",
        answer:
          "No. Standing once does not prove that you can paddle, catch waves early, position safely, and control the board for a full session. Choose by repeatable wave count and control.",
      },
    ],
    relatedLinks: [
      {
        label: "What Equipment Do I Need?",
        href: "/learn/what-equipment-to-start-surfing",
        description: "Full gear list including board, wetsuit, and accessories.",
      },
      {
        label: "How Long to Learn to Surf",
        href: "/learn/how-long-to-learn-to-surf",
        description: "Realistic timeline for progression milestones.",
      },
      {
        label: "Best Conditions for Beginners",
        href: "/learn/best-surf-conditions-for-beginners",
        description: "Ideal waves for learning on your new board.",
      },
    ],
  },

  {
    slug: "how-long-to-learn-to-surf",
    title: "How Long Does It Take to Learn to Surf? By Milestone",
    description:
      "Standing in whitewater takes 1-3 sessions; riding green waves down the line takes months. The realistic timeline by milestone and what speeds it up.",
    readingTimeMin: 2,
    datePublished: "2026-03-30",
    dateModified: "2026-09-02",
    heroImage: "/images/activities/beginner-friendly.webp",
    thumbnailImage: "/images/activities/beginner-friendly.webp",
    keywords: [
      "how long to learn to surf",
      "learning to surf timeline",
      "beginner surfer progression",
      "surf lessons",
      "how hard is surfing",
      "learn to surf time",
    ],
    sections: [
      {
        id: "answer",
        heading: "The Short Answer",
        content: `<p>Standing on whitewater: <strong>1-3 sessions</strong>. Catching unbroken green waves: <strong>2-4 weeks</strong> of regular practice. Riding down the line confidently: <strong>3-6 months</strong>. Intermediate level (reading waves, generating speed, basic turns): <strong>1-2 years</strong> at 2-3 sessions per week. These timelines assume an 8-9 ft foamie board, proper conditions (1-3 ft waves, offshore wind), and basic swimming fitness. Coaching from a surf school accelerates the first two milestones by 50% or more.</p>`,
        keyTakeaway:
          "Expect 3-6 months to ride green waves confidently. 1-2 years for intermediate skills. Proper equipment and coaching accelerate everything.",
      },
      {
        id: "detail",
        heading: "The Four Milestones of Learning to Surf",
        content: `<p><strong>Milestone 1 — Standing on foam (1-3 sessions)</strong>: Catching whitewater and popping up. Most people achieve this in their first lesson. The key is paddling technique and committing to the pop-up motion.</p><p><strong>Milestone 2 — Green waves (2-4 weeks)</strong>: Paddling into unbroken waves, angling the takeoff, and riding the face. This requires reading wave shapes, positioning in the lineup, and stronger paddle fitness. This is where most people stall — the jump from foam to green waves is the biggest hurdle.</p><p><strong>Milestone 3 — Down the line (3-6 months)</strong>: Consistently catching green waves and riding along the wave face with speed and control. You can now surf most 1-4 foot breaks safely.</p><p><strong>Milestone 4 — Intermediate (1-2 years)</strong>: Reading wave sections, generating speed through pumping, bottom turns, cutbacks. You understand forecasts, know your local breaks' moods, and can handle 4-6 foot surf.</p>`,
        keyTakeaway:
          "Four milestones: foam standing (days), green waves (weeks), down-the-line riding (months), intermediate turns (1-2 years).",
      },
      {
        id: "practical",
        heading: "What This Means for Your Session",
        content: `<p><strong>Accelerators</strong>: Take 2-3 professional lessons to nail the pop-up technique correctly. Bad habits formed in the first month take 6 months to fix. Surf <strong>2-3 times per week minimum</strong> — once a week isn't enough for muscle memory. Use a foamie until Milestone 3. Check Quiver's forecast and target <strong>1-3 foot days with long period and offshore wind</strong> — you'll catch 3x more waves in good conditions than in 5-foot onshore chop. Track your sessions in Quiver to see progression over time. <strong>The single biggest accelerator is water time</strong> — no substitute for hours in the ocean.</p>`,
        keyTakeaway:
          "Take lessons early, surf 2-3x per week, use a foamie, target small clean days. Water time is the #1 accelerator.",
      },
    ],
    faqs: [
      {
        question: "Can athletic people learn faster?",
        answer:
          "Somewhat. Swimmers and skateboarders have transferable balance and water comfort. But ocean fitness is unique — everyone needs time to build paddle endurance and wave-reading instincts. Athletic background helps with Milestone 1 but less with Milestones 3-4.",
      },
      {
        question: "Should I take surf lessons?",
        answer:
          "Yes, at least 2-3 lessons. A good instructor teaches proper pop-up technique, wave selection, and safety in a few hours. Self-teaching these takes weeks and often builds bad habits. Lessons are the highest-ROI investment in learning to surf.",
      },
      {
        question: "Is surfing harder than other board sports?",
        answer:
          "The entry barrier is higher because the 'terrain' (waves) moves and is never the same twice. Snowboarding or skateboarding have consistent surfaces. But once you catch green waves, progression is similar. The reading-the-ocean part is what takes years.",
      },
      {
        question: "Can I learn to surf at 40 or 50 years old?",
        answer:
          "Absolutely. Many adults learn in their 40s-60s. Fitness and flexibility matter more than age. Start on a large foamie, take lessons, and be patient. Longboarding is particularly accessible for older beginners — less paddling, more glide.",
      },
    ],
    relatedLinks: [
      {
        label: "Best Conditions for Beginners",
        href: "/learn/best-surf-conditions-for-beginners",
        description: "Ideal waves for accelerating your learning curve.",
      },
      {
        label: "What Size Surfboard?",
        href: "/learn/what-size-surfboard-should-i-get",
        description: "Why your board choice determines learning speed.",
      },
      {
        label: "Surf Etiquette Rules",
        href: "/learn/surf-etiquette-rules",
        description: "Know the rules before you paddle into the lineup.",
      },
      {
        label: "Surf Paddling for Beginners",
        href: "/learn/surf-paddling-for-beginners",
        description: "The technique that shortens the learning curve most.",
      },
    ],
  },

  {
    slug: "surf-etiquette-rules",
    title: "What Are the Rules of Surf Etiquette?",
    description:
      "The cardinal rule: the surfer closest to the peak (breaking part of the wave) has priority. Never drop in (take off on someone else's wave). Don't snake (paddle around someone to steal priority). Paddle wide around the lineup. Control your board. Respect locals. These prevent collisions and injuries.",
    readingTimeMin: 7,
    datePublished: "2026-03-30",
    dateModified: "2026-08-19",
    heroImage: "/images/learn/learn-surfer-watching.jpg",
    thumbnailImage: "/images/learn/learn-surfer-watching.jpg",
    keywords: [
      "surf etiquette",
      "surfing rules",
      "right of way surfing",
      "drop in surfing",
      "surf lineup rules",
      "beginner surf etiquette",
    ],
    sections: [
      {
        id: "answer",
        heading: "The Short Answer",
        content: `<p>The surfer already riding or taking off <strong>closest to the breaking peak</strong> normally has priority. Do not take off in front of that surfer, repeatedly paddle around people to gain position, or abandon your board where it can hit someone. Return to the lineup by the channel or wide shoulder when one exists, and avoid the rider's open face.</p><p>Etiquette is a collision-reduction system, not a guarantee of safety or a license for aggression. Conditions, local signs, contest rules, lessons, and lifeguard directions can change how an area operates. If you cannot identify the peak, exit route, or other surfers' paths, watch longer or choose a less crowded, more manageable place.</p>`,
        keyTakeaway:
          "Closest to the peak has priority. Never drop in. Don't snake. Paddle wide. Control your board. Respect locals.",
      },
      {
        id: "detail",
        heading: "The Six Rules Every Surfer Must Know",
        content: `<p><strong>1. Honor priority:</strong> the surfer closest to the breaking part of the wave generally has the first opportunity. <strong>2. Do not drop in:</strong> if someone is riding toward you, do not take off across their path. <strong>3. Do not snake:</strong> repeated repositioning around the next surfer to manufacture priority breaks the rotation.</p><p><strong>4. Paddle out of the riding line:</strong> use a channel or broken-water route when practical. <strong>5. Maintain board control:</strong> leave enough space that a fall does not send equipment into someone else. <strong>6. Share the set:</strong> observe who has been waiting and avoid taking every wave from the deepest position.</p><p>These rules interact. Being technically deepest does not excuse a last-second paddle around someone, and a paddler trapped inside should move predictably rather than making a sudden crossing.</p>`,
        keyTakeaway:
          "Six rules: right of way (closest to peak), no drop-ins, no snaking, paddle wide, control your board, respect the lineup order.",
      },
      {
        id: "practical",
        heading: "What This Means for Your Session",
        content: `<p>Watch from shore for at least <strong>two or three set cycles</strong>. Identify where waves first break, whether the peak shifts, which direction riders travel, where people paddle back out, and whether a lesson zone or swimming area is marked. Count how many surfers are competing for each peak; a small wave with ten people can demand more judgment than a larger empty reform.</p><p>Beginners usually learn more in a designated lesson or whitewater area than by sitting on a crowded main peak. If you join a lineup, start wide enough to observe without blocking riders. Take a wave only when you have checked both directions. If the crowd, current, or takeoff is beyond your control, leaving is good judgment, not a breach of etiquette.</p>`,
        keyTakeaway:
          "Read several sets from shore, identify traffic lanes and marked zones, and choose a peak where you can stay predictable and controlled.",
      },
      {
        id: "priority-cases",
        heading: "Resolve Priority on A-Frames and Shifting Peaks",
        content: `<p>On an A-frame, two surfers may be able to ride away from the peak in opposite directions. Call <strong>“left”</strong> or <strong>“right”</strong> early enough for the other surfer to react. Do not assume the split if either line closes into the other or if someone is already committed.</p><p>At a shifting beach break, priority resets with the location of each peak; sitting in one place does not reserve every wave nearby. At a point or reef, a clearer takeoff zone may create a rotation. Notice who has just ridden and who has waited through a set. When uncertain, yield and reset. One missed wave costs less than two surfers making incompatible takeoff decisions.</p>`,
        keyTakeaway:
          "Communicate on split peaks, recognize that shifting peaks change priority, and yield whenever two plans are unclear.",
      },
      {
        id: "paddling-path",
        heading: "Choose the Least Disruptive Paddle Path",
        content: `<p>If a channel exists, paddle around the breaking zone. When caught inside with a rider approaching, move toward the already-broken whitewater when that route is available, leaving the clean face to the rider. Do not race unpredictably across the face at the last second. The rider should also maintain control and avoid aiming at paddlers.</p><p>Sometimes there is no harmless route: a closeout beach break may fill the whole inside, or current may prevent a wide paddle. Create more spacing before the next wave and accept being pushed back rather than ditching the board into people behind you. A leash does not make a released board controlled.</p>`,
        keyTakeaway:
          "Use channels and broken water, move predictably, and accept lost ground when crossing a rider's line would create conflict.",
      },
      {
        id: "mistakes",
        heading: "Handle Mistakes Without Escalating",
        content: `<p>If you realize you have dropped in, stop entering the rider's path: straighten toward the foam or exit over the shoulder only when you can do so without another collision. A short, direct apology after the wave is enough. Explain only if the other surfer asks; arguing about intention rarely helps.</p><p>If someone drops in on you, prioritize avoiding contact. A calm reminder may resolve an honest mistake. Repeated dangerous behavior, threats, or a crowd that prevents safe spacing are reasons to move peaks, leave the water, or alert a lifeguard where appropriate. Etiquette does not require confronting an aggressive person, and “localism” never justifies violence or harassment.</p>`,
        keyTakeaway:
          "Exit a mistaken ride without crossing paths, apologize plainly, and disengage from repeated or aggressive conflict.",
      },
      {
        id: "board-control",
        heading: "Make Board Control a Spacing Decision",
        content: `<p>Before paddling for a wave, ask whether there is a clear zone in front, beside, and behind you if you fall. More speed, a longer board, stronger current, and a crowded inside all require more room. Do not take off directly behind another learner or aim toward swimmers.</p><p>Practice prone turns, stopping, turtle rolls or other board-control techniques in manageable conditions with qualified instruction. No technique works in every situation, and holding a board can itself become difficult in powerful whitewater. If you are repeatedly losing the board or cannot keep a buffer equal to at least the board-and-leash reach, choose smaller surf or a less crowded area and heed lifeguard guidance.</p>`,
        keyTakeaway:
          "Leave a buffer for the full reach of your board and leash, and step down in conditions when you cannot maintain it.",
      },
    ],
    faqs: [
      {
        question: "What happens if two people take off at the same time?",
        answer:
          "The person closer to the peak has priority. If you're farther from the peak, pull off the wave immediately. If it's genuinely simultaneous on an A-frame, communicate — one goes left, one goes right. A quick 'going left!' while paddling prevents collisions.",
      },
      {
        question: "What is localism and how do I deal with it?",
        answer:
          "Localism is territorial behavior that can range from a closed rotation to harassment. Observe the established flow and be courteous, but you do not owe anyone tolerance for threats or violence. Disengage, leave, or contact lifeguards or authorities when appropriate.",
      },
      {
        question: "Is it okay to surf near surf schools?",
        answer:
          "Yes, but give them space. Lesson groups use whitewater zones and may have beginners with poor board control. Stay well outside their area. If you're a beginner yourself, join a lesson rather than learning solo in their zone.",
      },
      {
        question: "What do I do if I get dropped in on?",
        answer:
          "Stay calm. If they didn't see you, a simple 'hey, I was on that one' is fine. Most people apologize immediately. If it keeps happening, they're either oblivious or aggressive — move to a different peak rather than escalating.",
      },
      {
        question: "Does a surfer farther outside always have priority?",
        answer:
          "No. Priority usually follows the surfer closest to the breaking peak who is committed to that wave, not whoever sits farthest offshore. Positioning gained by snaking also does not create respectful priority.",
      },
      {
        question: "Should I ditch my board if whitewater is too strong?",
        answer:
          "Do not release it when anyone may be within the board-and-leash reach. If you cannot maintain control in the conditions, create more distance, return to shore, and choose a smaller or less crowded session with appropriate instruction.",
      },
    ],
    relatedLinks: [
      {
        label: "Best Conditions for Beginners",
        href: "/learn/best-surf-conditions-for-beginners",
        description: "Learn in the right conditions with less crowd pressure.",
      },
      {
        label: "How Long to Learn to Surf",
        href: "/learn/how-long-to-learn-to-surf",
        description: "Realistic timeline for when you'll be lineup-ready.",
      },
      {
        label: "Beach Break vs Reef Break vs Point Break",
        href: "/learn/beach-break-vs-reef-break-vs-point-break",
        description: "Different break types have different lineup dynamics.",
      },
    ],
  },

  {
    slug: "beach-break-vs-reef-break-vs-point-break",
    title: "What Is a Beach Break vs Reef Break vs Point Break?",
    description:
      "Beach breaks: waves break over shifting sandbars, peaks move around, falls are forgiving. Best for beginners. Reef breaks: waves break over rock or coral, consistent shape, shallow and dangerous. Point breaks: waves peel along a headland or jetty, long rides, consistent direction. Examples: Huntington Beach (beach), Pipeline (reef), Rincon (point).",
    readingTimeMin: 7,
    datePublished: "2026-03-30",
    dateModified: "2026-08-19",
    heroImage: "/images/activities/reef-breaks.webp",
    thumbnailImage: "/images/activities/reef-breaks.webp",
    keywords: [
      "beach break vs reef break",
      "types of surf breaks",
      "point break surfing",
      "reef break",
      "beach break",
      "surf break types explained",
    ],
    sections: [
      {
        id: "answer",
        heading: "The Short Answer",
        content: `<p>A <strong>beach break</strong> breaks over sand that can shift after storms and strong currents. A <strong>reef break</strong> breaks over relatively fixed rock or coral. A <strong>point break</strong> peels along a headland or other projecting feature, often over rock, reef, or sand. The labels describe bottom and coastline geometry; they do not assign skill level or safety.</p><p>Use the type to predict what may stay fixed: takeoff location, peeling direction, paddle channel, and tide sensitivity. Then check the actual swell, water depth, current, crowd, entry, and posted conditions. A small reef can be approachable with local guidance while a powerful beach break can be unsuitable for a beginner.</p>`,
        keyTakeaway:
          "Break type explains the bottom and wave geometry, not whether today's conditions suit your ability.",
        image: {
          src: "/images/activities/reef-breaks.webp",
          alt: "Wave breaking over a shallow reef — consistent but dangerous",
          position: "right",
        },
      },
      {
        id: "detail",
        heading: "How Each Break Type Works",
        content: `<p><strong>Beach breaks</strong> depend on bars, troughs, and channels made from sand. One peak may offer a clean left today and close out after the next storm. The moving bottom rewards fresh observation rather than old directions.</p><p><strong>Reef breaks</strong> use a more fixed underwater contour, so the takeoff and peeling line are often repeatable. The reef may be flat, sharp, deep, shallow, exposed at low tide, or covered by enough water to be invisible; the category alone cannot tell you the consequence of a fall.</p><p><strong>Point breaks</strong> form as swell bends and breaks along a point. Some have long one-direction walls and a protected channel, while others section, run fast, or carry strong current down the line. A point can also be a reef break because “point” describes the coastline and “reef” describes the bottom.</p>`,
        keyTakeaway:
          "Sand moves, reef stays comparatively fixed, and points organize swell along a coastline—but each type has wide variation.",
      },
      {
        id: "practical",
        heading: "What This Means for Your Session",
        content: `<p>For a learner, prioritize a designated lesson area with <strong>small broken waves, room between people, a manageable current, straightforward entry, and lifeguard or instructor guidance</strong>. That is often a sandy beach, but “beach break” does not guarantee those traits. Shorebreak, rip channels, heavy closeouts, and moving peaks can make a sandy beach a poor choice.</p><p>Before trying a point or reef, be able to turn the board quickly, catch unbroken waves in a chosen direction, exit a ride on command, and follow a defined paddle route without crossing riders. Ask a reputable local instructor about suitable tide and swell windows. Do not use months surfed as the deciding threshold; control in comparable conditions matters more.</p>`,
        keyTakeaway:
          "Choose by controllable conditions and a clear route, not by assuming every sandy break is beginner-friendly.",
      },
      {
        id: "shore-read",
        heading: "Identify the Break Type From Shore",
        content: `<p>At a beach break, look for several peaks, gaps in whitewater, and surfers shifting position as the bars focus different sets. Darker or calmer channels can mark deeper water and current, not a safe swimming lane. At a reef, repeated waves usually begin near the same landmark and follow a similar line. Exposed rock or coral at low tide is an obvious clue, but a submerged reef may show no surface marker.</p><p>At a point, watch whether sets wrap around a headland and peel along the shoreline. Follow several riders from takeoff to exit and note where they paddle back. Mixed breaks are common: a point may feed into a beach section, or a jetty may stabilize sand like a short point.</p>`,
        keyTakeaway:
          "Watch multiple sets for fixed takeoffs, shifting peaks, channels, and the coastline path before assigning a label or choosing a route.",
      },
      {
        id: "tide-effects",
        heading: "Expect Tide to Affect Each Bottom Differently",
        content: `<p>On a beach break, a rising or falling tide changes water depth over every bar. A peak may soften, improve briefly, then stop breaking. On a reef, tide can change the clearance over rock or coral and the speed at which a wave stands up. On a point, tide may affect the takeoff, inside connection, entry rocks, and current separately.</p><p>Do not import a rule such as “reef equals high tide.” Some reefs become fuller at high tide; others stop breaking or develop backwash. Use a documented local range, observe the bottom at a lower tide from shore, and ask lifeguards or experienced local guidance. If you cannot verify depth, entry, and exit, choose another location.</p>`,
        keyTakeaway:
          "Tide changes depth and connection differently at every bottom; local observation beats a break-type shortcut.",
      },
      {
        id: "tradeoffs",
        heading: "Compare the Trade-Offs That Affect a Session",
        content: `<p>Beach breaks offer multiple peaks and often more room to spread out, but the correct takeoff can move between sets and the paddle-out may lack a channel. Reefs offer a repeatable line for learning a wave, yet fixed takeoffs concentrate crowds and mistakes occur over a fixed bottom. Points can deliver long rides and a recognizable route, but long rides also mean long paddles, current, and a tight priority rotation.</p><p>Decide which uncertainty you can manage. If your wave reading is developing, a clearly marked mellow takeoff may help—but only if depth, crowd, and entry fit. If crowd stress is the main issue, a broad small beach may offer more space even when individual waves are less predictable.</p>`,
        keyTakeaway:
          "Trade moving peaks against fixed-bottom exposure, crowd concentration, ride length, paddle distance, and current.",
      },
      {
        id: "decision-checklist",
        heading: "Use a Break-Specific Go/No-Go Checklist",
        content: `<p>For a beach break, ask: where are the rip channels, is shorebreak blocking entry, are peaks closing out, and is there enough space? For a reef, ask: what is the actual depth, where are the entry and exit, does the tide expose hazards, and can you follow the fixed line? For a point, ask: which swell angle connects, how strong is the down-line current, where does the ride end, and how will you return?</p><p>For every type, check lifeguard instructions, posted closures, wind, tide, swell, water quality, crowd, and your ability to control the board. A “good” break type can still be the wrong call today. When any critical answer is unknown, watch longer, ask qualified local guidance, or do not enter.</p>`,
        keyTakeaway:
          "Ask the questions unique to the bottom, then apply the same condition, crowd, and ability checks to every break.",
      },
    ],
    faqs: [
      {
        question: "Can beach breaks produce quality waves?",
        answer:
          "Yes. Sandy beach breaks like Hossegor (France), Puerto Escondido (Mexico), and Supertubos (Portugal) produce world-class barrels. It depends on bar formation, swell quality, and sand composition. But consistency is lower than reef or point breaks — the bars shift.",
      },
      {
        question: "Why are reef breaks more dangerous?",
        answer:
          "A fixed rock or coral bottom can be shallow, uneven, or sharp, and entry and exit may cross the same surface. Risk varies greatly with depth, tide, wave power, and the particular reef; local guidance and posted conditions matter.",
      },
      {
        question: "What about jetty breaks and rivermouth breaks?",
        answer:
          "Jetty breaks form where sand accumulates against a man-made structure — they behave like point breaks but can be dangerous due to rocks and currents. Rivermouth breaks form where river deposits create shifting bars — they can be excellent but are often polluted after rain.",
      },
      {
        question: "Which break type is best for longboarding?",
        answer:
          "A long, slower peeling point is a classic match, but small beach peaks and mellow reefs can also work. Wave shape, crowd, entry, and board control matter more than the label alone.",
      },
      {
        question: "Is a point break always a reef break?",
        answer:
          "No. A point describes the projecting coastline that organizes the wave. Its bottom may be rock, coral, cobble, sand, or a mixture, so a point can overlap with reef or sand-bottom classifications.",
      },
      {
        question: "Are sandy bottoms safe to fall on?",
        answer:
          "No bottom makes a wipeout safe. Sand can be shallow or hard-packed, and the wave, board, leash, current, and other people remain hazards. Avoid diving headfirst and follow qualified local guidance.",
      },
    ],
    relatedLinks: [
      {
        label: "Best Conditions for Beginners",
        href: "/learn/best-surf-conditions-for-beginners",
        description: "Ideal conditions at beach breaks for learning.",
      },
      {
        label: "Best Tide for Surfing",
        href: "/learn/best-tide-for-surfing",
        description:
          "How tide affects each break type differently.",
      },
      {
        label: "Surf Map",
        href: "/map",
        description: "Filter breaks by type and skill level.",
      },
    ],
  },

  {
    slug: "what-equipment-to-start-surfing",
    title: "What Equipment Do I Need to Start Surfing?",
    description:
      "Essential gear: soft-top surfboard (8-9 ft foamie, $200-400), leash (6-9 ft matched to board length), wetsuit (thickness matched to water temperature), and wax (temperature-specific). Optional: rash guard, earplugs, reef booties. Total starter budget: $300-600. Skip the shortboard.",
    readingTimeMin: 7,
    datePublished: "2026-03-30",
    dateModified: "2026-08-19",
    heroImage: "/images/learn/learn-surfer-walks.jpg",
    thumbnailImage: "/images/learn/learn-surfer-walks.jpg",
    keywords: [
      "surfing equipment list",
      "what do i need to start surfing",
      "beginner surf gear",
      "surfing starter kit",
      "surfboard leash wax wetsuit",
      "how much does surfing cost",
    ],
    sections: [
      {
        id: "answer",
        heading: "The Short Answer",
        content: `<p>You need a <strong>board suited to learning, compatible fins, a sound leash, traction, and exposure protection for the actual water and weather</strong>. For most first sessions, the simplest route is a lesson or rental package that includes an 8-9 foot soft-top, leash, and wetsuit. That lets you test the activity, fit, and local conditions before storing a large board.</p><p>Bring drinking water, a towel or changing layer, a secure key plan, and broad-spectrum water-resistant sun protection. Add booties, earplugs, gloves, or a hood only when temperature, entry, or personal needs justify them. Equipment does not make conditions safe; follow lifeguards and posted rules and stay within your ability.</p>`,
        keyTakeaway:
          "Start with board, fins, leash, traction, and condition-appropriate exposure protection; rent first to learn what fits.",
      },
      {
        id: "detail",
        heading: "The Essential Gear Breakdown",
        content: `<p><strong>Board and fins:</strong> choose a high-volume soft-top intended for learners, with every fin seated firmly and no sharp or loose hardware. Board sizing is its own decision; use the <a href="/learn/what-size-surfboard-should-i-get">surfboard sizing guide</a> rather than buying from height alone.</p><p><strong>Leash:</strong> match it roughly to board length so the board is not held unusually close after a fall. Inspect the cord, swivels, rail saver, cuff, and hook-and-loop closure before every session. A leash is board-retrieval equipment, not a substitute for swimming ability or board control.</p><p><strong>Traction:</strong> many soft-tops need suitable wax; some textured decks do not. Use the temperature grade on the wrapper and confirm the board maker allows wax. Apply a light, even pattern where hands and feet land rather than building slippery lumps.</p>`,
        keyTakeaway:
          "Check board, fins, leash, and traction as a system, and never treat the leash as your swimming plan.",
      },
      {
        id: "practical",
        heading: "What This Means for Your Session",
        content: `<p>Use three buying stages. For sessions one through three, rent or take a lesson and note board dimensions, wetsuit thickness, suit size, and anything that rubbed or leaked. If you plan to surf only a few times per season, continued rental avoids storage, transport, and repair costs. If you will surf regularly, buy the items where fit and condition matter most.</p><p>A realistic new-kit total often lands in the <strong>several-hundred-dollar range</strong>, but local prices and included accessories vary. Compare a package against the line items: board, fins, leash, wax, suit, and tax. A cheap used board that needs fins and a leash may not beat a complete rental. Spend first on fit, intact equipment, and instruction, not cosmetic upgrades.</p>`,
        keyTakeaway:
          "Rent for the first few sessions, price the complete system, and prioritize fit and condition over upgrades.",
      },
      {
        id: "wetsuit-fit",
        heading: "Choose Exposure Protection by Water, Air, and Session Length",
        content: `<p>A wetsuit should be snug through the torso and lower back without restricting a full paddle stroke or breathing. Large folds flush cold water; a collar that gaps when you move is a warning sign. Try several sizes and brands because the same labeled size can fit shoulders, torso, and legs differently.</p><p>Use the <a href="/learn/what-wetsuit-thickness-do-i-need">wetsuit thickness guide</a> as a starting point, then account for wind chill, air temperature, sun, personal cold tolerance, and how long you will be sitting between waves. A hood, gloves, or booties can extend comfort in cold water, but added thickness reduces feel and dexterity. If you are shivering, numb, confused, or losing coordination, leave the water and seek appropriate help.</p>`,
        keyTakeaway:
          "Fit the suit through a full paddle motion and adjust thickness for water, air, wind, duration, and personal cold tolerance.",
      },
      {
        id: "accessories",
        heading: "Add Accessories Only for a Defined Problem",
        content: `<p><strong>Rash guards</strong> reduce board and wetsuit chafe and add sun coverage. <strong>Surf earplugs</strong> may help regular cold-water surfers while still allowing some hearing, but they require cleaning and a secure fit. <strong>Booties</strong> add warmth and can help on rough entries, yet they do not make sharp reef or slippery rock harmless. Ask local lifeguards or instructors about entry hazards before relying on footwear.</p><p>A changing mat or waterproof tub keeps sand and salt out of the car. A board bag makes sense for roof transport, travel, or protecting a hard board; a sock may be enough for indoor storage. Skip action cameras and premium fins until you can explain the problem they solve.</p>`,
        keyTakeaway:
          "Buy each accessory to solve a specific exposure, chafe, transport, or entry problem—not because it appears in a generic bundle.",
      },
      {
        id: "transport-storage",
        heading: "Plan Transport and Storage Before the Board Arrives",
        content: `<p>Measure the vehicle interior, elevator, stair turn, and storage wall before choosing a nine-foot board. For roof transport, use racks or pads designed for the vehicle and board, follow their load instructions, use suitable straps, and recheck tension after the first few minutes. Do not run a strap or board where it interferes with doors, visibility, or vehicle controls.</p><p>Rinse salt and sand from the leash, suit, and moving hardware with fresh water, then dry gear out of intense sun. Store the board away from heat that can damage foam or lamination. Dry the wetsuit inside out first on a broad hanger or folded support; thin wire hangers can stress the shoulders.</p>`,
        keyTakeaway:
          "A beginner kit must fit your vehicle and storage space, and routine rinsing and shaded drying preserve the parts you depend on.",
      },
      {
        id: "pre-session-check",
        heading: "Use a 60-Second Pre-Session Equipment Check",
        content: `<p>Before leaving home, confirm the fins are present and tight, the leash has no cuts or damaged swivels, the cuff closes fully, the board has no open damage, and the suit and wax match the conditions. Pack water, sun protection, towel, dry clothes, and any required parking or access item. At the beach, attach the leash only when appropriate for the entry and keep the board controlled around other people.</p><p>If a fin box is loose, a leash connection is frayed, or a board is taking on water, do not improvise the session. Rent a replacement or get the equipment repaired. Even sound gear cannot remove ocean hazards, so combine the check with lifeguard advice, posted conditions, and a shore assessment.</p>`,
        keyTakeaway:
          "Check fins, leash, board damage, suit, traction, and shore conditions every time; replace or repair questionable equipment before entering.",
      },
    ],
    faqs: [
      {
        question: "Do I need surf lessons or just gear?",
        answer:
          "A qualified lesson is a practical first purchase because it usually includes suitable equipment and covers local entry, board control, and basic etiquette. Gear alone does not teach those decisions.",
      },
      {
        question: "Can I rent gear instead of buying?",
        answer:
          "Yes. Rental is often the better choice for the first few sessions, occasional trips, or anyone without transport and storage. Compare current local rates and what the package includes rather than assuming a fixed break-even point.",
      },
      {
        question: "Do I need fins for a foamie?",
        answer:
          "Yes. Most beginner soft-tops include compatible fins, but confirm they are installed firmly and that no hardware is sharp or damaged. Use the manufacturer's fin system rather than forcing an incompatible replacement.",
      },
      {
        question: "What about sunscreen?",
        answer:
          "Use broad-spectrum, water-resistant sun protection as directed on its label and cover exposed skin with suitable clothing where practical. Reapply according to the product instructions, especially after toweling off.",
      },
      {
        question: "Should I buy a used wetsuit?",
        answer:
          "Only if it fits through the shoulders, torso, neck, and limbs and the seams, zipper, and neoprene are sound. A badly fitted bargain can flush water, restrict paddling, or need replacement quickly.",
      },
      {
        question: "Do I need a repair kit in my starter setup?",
        answer:
          "Not for the first rental sessions. Once you own a board, keep manufacturer-compatible repair supplies at home for minor damage, but have structural cracks, loose fin boxes, or uncertain repairs assessed by a shop.",
      },
    ],
    relatedLinks: [
      {
        label: "What Size Surfboard?",
        href: "/learn/what-size-surfboard-should-i-get",
        description: "Detailed board sizing guide by weight and level.",
      },
      {
        label: "What Wetsuit Thickness?",
        href: "/learn/what-wetsuit-thickness-do-i-need",
        description:
          "Match your wetsuit to water temperature.",
      },
      {
        label: "How Long to Learn to Surf",
        href: "/learn/how-long-to-learn-to-surf",
        description: "Realistic timeline for your investment.",
      },
    ],
  },

  {
    slug: "what-is-a-rip-current",
    title: "What Is a Rip Current and How Do I Escape One?",
    description:
      "A rip current is a narrow channel of water flowing from shore back out to sea at 1-8 feet per second. It pulls you OUT, not under. Escape: don't fight it — swim parallel to shore until free of the current, then swim back in. If exhausted, float and signal for help. NOAA reports roughly 100 rip current drownings per year in the US.",
    readingTimeMin: 3,
    datePublished: "2026-03-30",
    heroImage: "/images/learn/learn-aerial-shore.jpg",
    thumbnailImage: "/images/learn/learn-aerial-shore.jpg",
    keywords: [
      "rip current",
      "how to escape rip current",
      "rip tide",
      "rip current safety",
      "ocean safety surfing",
      "rip current signs",
    ],
    sections: [
      {
        id: "answer",
        heading: "The Short Answer",
        content: `<p>A rip current is a narrow channel of water flowing from shore back out to sea at <strong>1-8 feet per second</strong> — faster than an Olympic swimmer. It pulls you <strong>OUT, not under</strong>. To escape: <strong>don't fight it</strong>. Swim parallel to shore (perpendicular to the rip) until you're out of the current, then swim back in with the breaking waves. If exhausted, <strong>float and signal for help</strong>. NOAA and the United States Lifesaving Association report roughly <strong>100 rip current drownings per year</strong> in the US — more than hurricanes, tornadoes, and lightning combined.</p>`,
        keyTakeaway:
          "Rip currents pull you out, not under. Swim parallel to shore to escape. Never fight the current — it's faster than you.",
        image: {
          src: "/images/learn/learn-aerial-shore.jpg",
          alt: "Aerial view of coastline showing water channels where rip currents form",
          position: "right",
        },
      },
      {
        id: "detail",
        heading: "How to Spot a Rip Current From Shore",
        content: `<p>Rip currents are visible once you know what to look for: <strong>a channel of darker, calmer water</strong> between areas of breaking whitewater. The calm patch isn't safe — it's the outflow channel. Other signs: <strong>choppy, discolored water</strong> moving seaward, foam or debris flowing steadily offshore, and a <strong>gap in the breaking waves</strong> where the rip carves through the sandbar.</p><p>Rips form where water pushed onshore by waves finds a low point in the sandbar to flow back out. They're <strong>most common at beach breaks</strong> near jetties, piers, and between sandbars. They intensify with larger surf and stronger longshore currents. A beach with uniform waves breaking everywhere is generally safer than one with obvious channels and gaps in the whitewater — those gaps are rips.</p>`,
        keyTakeaway:
          "Spot rips from shore: darker calm water between breaking waves, debris flowing seaward, gaps in the whitewater. Rips form at sandbar low points.",
      },
      {
        id: "practical",
        heading: "What This Means for Your Session",
        content: `<p>Before every session, <strong>spend 5 minutes watching the water from an elevated position</strong>. Look for channels, gaps in whitewater, and debris movement. Experienced surfers actually <strong>use rip currents as a free ride</strong> to paddle out — the outflow carries you past the break zone without fighting whitewater. But beginners should avoid them entirely until comfortable in the ocean.</p><p>If caught in a rip: <strong>stay calm</strong> (panic causes drowning, not the current). Don't try to swim directly to shore against the flow. Swim <strong>parallel to the beach</strong> for 50-100 feet until you feel the pull weaken, then angle toward shore. If you can't swim out of it, <strong>float on your back</strong> — most rips dissipate 100-200 yards offshore. Wave your arms to signal lifeguards. Surf near lifeguard stations, especially as a beginner.</p>`,
        keyTakeaway:
          "Watch the water 5 minutes before entering. If caught: stay calm, swim parallel to shore, float if exhausted. Surf near lifeguards.",
      },
    ],
    faqs: [
      {
        question: "Is a rip current the same as a riptide?",
        answer:
          "People use 'riptide' colloquially, but oceanographers distinguish them. A rip current is caused by wave-driven water flowing back through a channel in the sandbar. A true riptide is driven by tidal flow through inlets. For safety purposes, the escape technique is the same: swim parallel to shore.",
      },
      {
        question: "Can a rip current pull me underwater?",
        answer:
          "No. Rip currents flow horizontally along the surface and just below it. They pull you away from shore, not down. Drowning happens because people panic and exhaust themselves fighting the current, not because they're pulled under.",
      },
      {
        question: "Are rip currents more dangerous at certain tides?",
        answer:
          "Yes. Rips intensify during low-to-mid incoming tide as water volume increases over the bars. They're also stronger during bigger swells because more water is being pushed onshore and needs to flow back out. Check both tide and swell before entering.",
      },
      {
        question: "Do surfers really use rip currents to paddle out?",
        answer:
          "Yes. Experienced surfers identify rip channels and use them as a conveyor belt to get past the break zone without exhausting themselves duck-diving through whitewater. It's an advanced technique that requires rip identification skills.",
      },
    ],
    relatedLinks: [
      {
        label: "Best Conditions for Beginners",
        href: "/learn/best-surf-conditions-for-beginners",
        description: "Learn to read conditions and choose safer beaches.",
      },
      {
        label: "Surf Etiquette Rules",
        href: "/learn/surf-etiquette-rules",
        description: "Safety rules for being in the lineup.",
      },
      {
        label: "Beach Break vs Reef Break",
        href: "/learn/beach-break-vs-reef-break-vs-point-break",
        description: "Rip currents are most common at beach breaks.",
      },
      {
        label: "Best Beginner Surf Spots in San Diego",
        href: "/learn/beginner-breaks-san-diego",
        description: "Beginner-friendly San Diego breaks and their rip patterns.",
      },
    ],
  },

  {
    slug: "how-are-ocean-waves-formed",
    title: "What Causes Ocean Waves? How Wind Builds Swell",
    description:
      "Wind speed, duration, and fetch decide wave size. How a storm's energy becomes a swell that crosses an ocean, and why every forecast starts with the wind.",
    readingTimeMin: 2,
    datePublished: "2026-03-30",
    dateModified: "2026-09-02",
    heroImage: "/images/hero/hero-5-aerial-ocean.webp",
    thumbnailImage: "/images/hero/hero-5-aerial-ocean.webp",
    keywords: [
      "how are waves formed",
      "ocean wave formation",
      "what causes waves",
      "wave generation",
      "fetch wind waves",
      "how swells form",
    ],
    sections: [
      {
        id: "answer",
        heading: "The Short Answer",
        content: `<p>Wind transfers energy to the ocean surface through friction. Three factors determine wave size: <strong>wind speed</strong>, <strong>wind duration</strong> (how long it blows), and <strong>fetch</strong> (the uninterrupted distance wind blows over open water). Stronger wind + longer duration + greater fetch = bigger waves. Once formed, waves organize into <strong>swells</strong> that travel thousands of miles across ocean basins — a North Pacific storm can send swell to Hawaii in 2-3 days and California in 4-5 days. NOAA's WaveWatch III models this entire process globally every 6 hours.</p>`,
        keyTakeaway:
          "Waves form from wind friction on the ocean. Speed, duration, and fetch determine size. Swells then travel thousands of miles to coastlines.",
        image: {
          src: "/images/hero/hero-5-aerial-ocean.webp",
          alt: "Aerial view of open ocean swell lines traveling toward shore",
          position: "right",
        },
      },
      {
        id: "detail",
        heading: "From Storm to Swell: The Formation Process",
        content: `<p>Inside a storm at sea, wind creates <strong>chaotic, short-period waves</strong> in all directions — called a "wind sea." As this energy radiates outward from the storm center, it undergoes <strong>dispersion</strong>: longer-period waves travel faster than shorter ones. Over hundreds or thousands of miles, the chaos sorts itself into organized bands of energy grouped by period — this is a <strong>swell</strong>.</p><p>Short-period energy (5-8 seconds) dissipates fastest through friction with the ocean surface. Long-period energy (12-20 seconds) loses very little and can cross entire ocean basins. A major Southern Ocean storm near Antarctica generates waves that arrive at California, Hawaii, and Japan as clean 16-18 second ground swell 7-10 days later. The <strong>fetch</strong> in the Southern Ocean is enormous — wind can blow uninterrupted for thousands of miles — which is why it produces the world's most powerful swells.</p>`,
        keyTakeaway:
          "Storm wind creates chaotic waves that sort by period over distance. Long-period energy crosses ocean basins; short-period energy dissipates through friction.",
      },
      {
        id: "practical",
        heading: "What This Means for Your Session",
        content: `<p>Understanding wave formation helps you read forecasts: when you see a <strong>16-second swell at 4 feet</strong> on Quiver, you know a powerful distant storm generated it days ago. That energy will be clean, organized, and powerful at your break. A <strong>7-second swell at 4 feet</strong> means local wind right now — chaotic and weaker. Track storm systems on weather maps to anticipate swells 3-7 days out. Follow the <strong>North Pacific storm track</strong> in winter (produces NW swells for California) and <strong>South Pacific / Southern Ocean systems</strong> in summer (produces S-SW swells). Quiver's 7-day forecast shows these incoming swells so you can plan sessions around the best energy.</p>`,
        keyTakeaway:
          "Track distant storms to anticipate quality swell. North Pacific sends NW swells in winter; South Pacific sends SW swells in summer.",
      },
    ],
    faqs: [
      {
        question: "What is fetch and why does it matter?",
        answer:
          "Fetch is the uninterrupted distance wind blows over open water. More fetch = bigger, longer-period waves. The Southern Ocean has the world's longest fetch (wind circles the globe unobstructed by land), which is why it produces the planet's most powerful swells.",
      },
      {
        question: "Can earthquakes create surfable waves?",
        answer:
          "Earthquakes create tsunamis, which are fundamentally different from wind waves. Tsunamis have periods of 10-60 minutes (vs. 5-20 seconds for surf). They're not surfable — they're walls of water with no shape. Despite the name, 'tidal waves' (tsunamis) have nothing to do with tides or surfing.",
      },
      {
        question: "Why are some oceans wavier than others?",
        answer:
          "Storm frequency and fetch. The North Pacific and Southern Ocean are the stormiest bodies of water with the longest fetch, producing the world's best surf. The Mediterranean and Caribbean have limited fetch and fewer powerful storms, producing smaller, shorter-period waves.",
      },
      {
        question: "How far can ocean waves travel?",
        answer:
          "Thousands of miles. Southern Ocean swells have been tracked traveling 10,000+ miles from Antarctica to Alaska. Energy loss is minimal for long-period swells — a 16-second swell loses only about 10-15% of its energy per 1,000 miles traveled.",
      },
    ],
    relatedLinks: [
      {
        label: "Swell Period Explained",
        href: "/learn/swell-period-explained",
        description: "Period reveals how far waves traveled and their quality.",
      },
      {
        label: "Groundswell vs Wind Swell",
        href: "/learn/groundswell-vs-wind-swell",
        description: "How formation distance determines swell type.",
      },
      {
        label: "How Surf Forecasts Work",
        href: "/learn/how-surf-forecasts-work",
        description: "How NOAA models predict wave formation globally.",
      },
    ],
  },

  {
    slug: "how-do-tides-work",
    title: "How Tides Work for Surfing: Tide Timing Guide",
    description:
      "Learn how tides work for surfing: why high and low tide shift, what spring and neap tides mean, and how tide timing changes wave shape.",
    readingTimeMin: 3,
    datePublished: "2026-03-30",
    dateModified: "2026-07-23",
    heroImage: "/images/learn/learn-tide-pools.jpg",
    thumbnailImage: "/images/learn/learn-tide-pools.jpg",
    keywords: [
      "how do tides work",
      "what causes tides",
      "spring tide neap tide",
      "tidal range",
      "moon tides",
      "semidiurnal tides",
    ],
    sections: [
      {
        id: "answer",
        heading: "The Short Answer",
        content: `<p>Tides are the rise and fall of sea level caused by <strong>gravitational pull from the moon</strong> (primary force, ~2/3 of tidal effect) <strong>and the sun</strong> (secondary, ~1/3). Most US coastlines experience <strong>semidiurnal tides</strong> — two highs and two lows every <strong>24 hours 50 minutes</strong> (the extra 50 minutes is because the moon orbits Earth, shifting the cycle daily). <strong>Spring tides</strong> (new and full moon, when sun-moon-earth align) produce the largest tidal range. <strong>Neap tides</strong> (quarter moons) produce the smallest. NWS predictions are accurate to within minutes.</p>`,
        keyTakeaway:
          "Moon's gravity drives tides. Two highs and two lows per day. Spring tides (full/new moon) have the biggest range; neap tides the smallest.",
        image: {
          src: "/images/learn/learn-tide-pools.jpg",
          alt: "Tide pools exposed at low tide showing the dramatic effect of tidal range",
          position: "right",
        },
      },
      {
        id: "detail",
        heading: "The Lunar Cycle and Tidal Range",
        figureKey: "tide-window",
        content: `<p>The moon's gravity creates a <strong>tidal bulge</strong> — water is pulled toward the moon on the near side of Earth, and centrifugal force creates a second bulge on the far side. As Earth rotates, coastlines pass through these bulges, experiencing <strong>two high tides and two low tides daily</strong>.</p><p><strong>Spring tides</strong> happen twice per month (new moon and full moon) when sun and moon align. Their combined gravity produces tidal ranges <strong>20-30% larger</strong> than average. In San Francisco, spring tidal range can exceed <strong>7 feet</strong>. <strong>Neap tides</strong> happen at quarter moons when sun and moon pull at right angles, partially canceling each other. Neap ranges are <strong>20-30% smaller</strong> than average. For surfing, spring tides mean bigger swings between low and high — which can expose more reef at low tide or flood breaks more at high tide. Neap tides produce more moderate, stable conditions.</p>`,
        keyTakeaway:
          "Spring tides (full/new moon) swing 20-30% more than average. Neap tides (quarter moon) swing 20-30% less. Both affect wave shape at your break.",
      },
      {
        id: "practical",
        heading: "What This Means for Your Session",
        content: `<p>Check Quiver's tide chart before every session — it shows the exact curve with high/low times and heights. <strong>Plan around the mid-tide window</strong> for most beach breaks (see our <a href="/learn/best-tide-for-surfing">Best Tide for Surfing</a> guide). During <strong>spring tides</strong>, be extra cautious at reef breaks — extreme low tides expose hazards. During <strong>neap tides</strong>, conditions are more forgiving because the tidal swing is smaller. The <strong>tidal cycle shifts ~50 minutes later each day</strong>, so if high tide is at 8 AM today, it's at 8:50 AM tomorrow. Plan your week around this shift — sometimes the mid-tide window aligns perfectly with dawn patrol, and sometimes it doesn't. Moon phase calendars help you anticipate spring vs. neap weeks ahead of time.</p>`,
        keyTakeaway:
          "Check tide charts daily. High tide shifts 50 min later each day. Spring tides amplify effects at your break; neap tides moderate them.",
      },
    ],
    faqs: [
      {
        question: "Why does high tide shift 50 minutes each day?",
        answer:
          "Because the moon orbits Earth, advancing about 12.2 degrees per day. Earth has to rotate an extra 50 minutes to 'catch up' to the moon's new position, which delays each tidal cycle. This is why tide times are different every day.",
      },
      {
        question: "Do all coastlines have two tides per day?",
        answer:
          "Most US coastlines have semidiurnal tides (two highs, two lows). But the Gulf Coast (Texas, Louisiana, parts of Florida) has mixed or diurnal tides — sometimes just one high and one low per day. Coastal geometry and basin shape affect the tidal pattern.",
      },
      {
        question: "How do I know if it's a spring or neap tide?",
        answer:
          "Check the moon phase. Full moon and new moon = spring tide (big swings). First quarter and third quarter = neap tide (small swings). Spring tides happen about every 2 weeks. Most tide apps and Quiver's charts show this information.",
      },
      {
        question: "Can tides create currents?",
        answer:
          "Yes. Tidal currents flow as water moves to fill or drain coastal areas during tide changes. These are especially strong near inlets, harbors, and narrow bays. In open coastline surf, tidal currents are weaker but can affect rip current strength.",
      },
    ],
    relatedLinks: [
      {
        label: "Best Tide for Surfing",
        href: "/learn/best-tide-for-surfing",
        description: "Which tide stage produces the best waves at your break.",
      },
      {
        label: "How to Read Surf Conditions",
        href: "/learn/how-to-read-surf-conditions",
        description: "Tide is one of five metrics you need to check.",
      },
      {
        label: "Check Tide Charts",
        href: "/forecast",
        description: "See today's tide curve at your local beach.",
      },
    ],
  },
  {
    slug: "beginner-breaks-san-diego",
    title: "Best Beginner Surf Spots in San Diego",
    description:
      "Find beginner surf spots in San Diego with forgiving waves, mellow beaches, surf-school zones, gear tips, and when to paddle out.",
    readingTimeMin: 5,
    datePublished: "2026-03-30",
    heroImage: "/beginnerWhiteWater.jpg",
    thumbnailImage: "/beginnerWhiteWater.jpg",
    keywords: [
      "beginner surf spots san diego",
      "learn to surf san diego",
      "best beaches for beginners san diego",
      "san diego surf lessons",
      "easy surf spots san diego",
    ],
    sections: [
      {
        id: "overview",
        heading: "Why San Diego Is Perfect for Learning",
        content:
          '<p>San Diego delivers what most beginner destinations promise but rarely provide: <strong>consistent, small waves with warm water and easy beach access</strong>. The south-facing coastline catches summer swells that arrive with long periods and manageable size — exactly what you want when you\'re learning to pop up. From La Jolla to Imperial Beach, there\'s a forgiving sand-bottom break within a short drive no matter where you\'re staying.</p><p>Water temps range from 57°F in winter to 72°F in late summer, so a <strong>3/2mm wetsuit</strong> handles most of the year. The consistent sunshine, mellow vibe, and dozens of surf schools make San Diego the default recommendation for anyone asking "where should I learn to surf?"</p>',
        keyTakeaway:
          "San Diego offers warm water, consistent small waves, and easy beach access — ideal conditions for learning to surf year-round.",
      },
      {
        id: "top-spots",
        heading: "Top 5 Beginner Breaks",
        content:
          '<p><strong>Tourmaline Surf Park</strong> — The gold standard for San Diego beginners. A mellow point break with soft, rolling waves that peel slowly over sand. No shortboarders allowed (by local custom), so the vibe is relaxed. Parking lot right at the beach.</p><p><strong>La Jolla Shores</strong> — Wide sandy beach with gentle whitewater that\'s perfect for first-timers. Surf schools run lessons here every morning. The waves rarely get overhead, and the sandy bottom means soft landings. Watch for the occasional sea lion.</p><p><strong>Mission Beach (south end)</strong> — Consistent beach break with multiple peaks. The south end near the jetty offers more protection from wind. Easy boardwalk access with rental shops steps away.</p><p><strong>Oceanside Harbor</strong> — The south side of the harbor jetty creates a protected zone where waves break gently over sand. Less crowded than the main beach, and the harbor parking is free on weekdays.</p><p><strong>Del Mar</strong> — A forgiving beach break with a mellow local crowd. Best at mid-tide when the sandbars create predictable, peeling waves. The 15th Street access point is the sweet spot for beginners.</p>',
        keyTakeaway:
          "Tourmaline and La Jolla Shores are the go-to beginner spots. Mission Beach, Oceanside Harbor, and Del Mar round out the top five.",
      },
      {
        id: "when-to-go",
        heading: "Best Time to Surf as a Beginner",
        content:
          '<p><strong>Summer (June-September)</strong> is prime beginner season. South swells arrive with long periods, keeping wave faces clean and manageable at 1-3 feet. Water temps peak in the high 60s to low 70s.</p><p><strong>Fall (October-November)</strong> brings the warmest water of the year — often 68-72°F — plus Santa Ana winds that groom the surf into clean, glassy lines. Swell size increases, but protected spots like La Jolla Shores stay manageable.</p><p><strong>Dawn patrol</strong> is your best window any time of year. Winds are typically calm before 10am, creating glassy conditions. By afternoon, onshore westerly winds chop up the surface and make it harder to catch waves.</p><p>Aim for <strong>mid-tide</strong> at sand-bottom breaks. Low tide exposes rocks and creates shore break; high tide makes waves mushy and hard to catch. Check the tide chart and plan your session around the middle of the cycle.</p>',
        keyTakeaway:
          "Summer and early fall are best for beginners. Go at dawn for glassy conditions, and time your session around mid-tide.",
      },
      {
        id: "gear-and-lessons",
        heading: "Gear & Where to Take Lessons",
        content:
          '<p>A <strong>3/2mm wetsuit</strong> covers San Diego from April through November. Winter dawn patrols (December-March) call for a <strong>4/3mm</strong> when water dips into the high 50s. Booties are optional — the sand is soft.</p><p>If you\'re renting, grab a <strong>soft-top longboard</strong> (8-9 feet). Foamies are forgiving, stable, and won\'t hurt you or anyone else when you wipe out. Every beach town has rental shops: South Coast Surf Shop in OB, Cheap Rentals near Mission Beach, and Surf Diva in La Jolla are all solid options.</p><p>For lessons, expect to pay <strong>$80-120 for a 2-hour group session</strong>. La Jolla Shores and Tourmaline are the most common lesson spots. Surf Diva, San Diego Surf School, and Menehune Surf School all have good reputations.</p>',
        keyTakeaway:
          "A 3/2mm wetsuit and a soft-top longboard are all you need. Group lessons run $80-120 for 2 hours at La Jolla Shores or Tourmaline.",
      },
      {
        id: "safety",
        heading: "Safety Tips",
        content:
          '<p><strong>Do the stingray shuffle.</strong> Stingrays bury in the sand in shallow water, especially in summer. Shuffle your feet when wading out instead of stepping — you\'ll nudge them away before they sting.</p><p><strong>Learn to spot rip currents.</strong> Look for channels of darker, calmer water between breaking waves. If caught in a rip, don\'t fight it — paddle parallel to shore until you\'re out of the current, then ride the whitewater back in.</p><p><strong>Respect the lineup.</strong> Don\'t paddle straight to the peak on your first session. Stay on the shoulder, catch the whitewater, and watch how more experienced surfers position themselves. When you\'re ready to catch green waves, wait your turn.</p><p><strong>Watch for sea lions at La Jolla.</strong> They\'re generally harmless but can be territorial. Give them space and don\'t surf directly through a group of them.</p>',
        keyTakeaway:
          "Shuffle your feet for stingrays, learn to spot rip currents, respect the lineup pecking order, and give sea lions space at La Jolla.",
      },
    ],
    faqs: [
      {
        question: "What's the best time of year to learn to surf in San Diego?",
        answer:
          "Summer (June-September) is ideal — consistent small south swells, warm water in the mid-60s to low 70s, and morning glass almost every day. Early fall (October) is also excellent with the warmest water of the year.",
      },
      {
        question: "What wetsuit do I need for San Diego?",
        answer:
          "A 3/2mm wetsuit covers most of the year (April-November). For winter dawn patrols, a 4/3mm is more comfortable. Boardshorts-only sessions happen occasionally in late summer but are rare — even locals usually wear a spring suit.",
      },
      {
        question: "Which San Diego beaches should beginners avoid?",
        answer:
          "Avoid Blacks Beach (heavy shore break, long cliff walk), Windansea (shallow reef, locals-heavy), and Sunset Cliffs (rocks, strong currents). Stick to sand-bottom breaks like Tourmaline, La Jolla Shores, and Mission Beach.",
      },
      {
        question: "How much do surf lessons cost in San Diego?",
        answer:
          "Group lessons run $80-120 per person for a 2-hour session, including board and wetsuit. Private lessons are $150-200. Most schools operate at La Jolla Shores or Tourmaline.",
      },
      {
        question: "Can I surf year-round in San Diego?",
        answer:
          "Yes. San Diego has surf every month of the year. Winter brings bigger northwest swells (better for intermediate+), while summer delivers smaller, gentler south swells that are perfect for beginners.",
      },
    ],
    relatedLinks: [
      {
        label: "Best Surf Conditions for Beginners",
        href: "/learn/best-surf-conditions-for-beginners",
        description:
          "Learn the ideal wave size, period, wind, and tide for your first sessions.",
      },
      {
        label: "San Diego Beginner Spots",
        href: "/beginner/san-diego",
        description:
          "Live conditions and crowd data at San Diego's beginner-friendly breaks.",
      },
      {
        label: "San Diego Water Temperature",
        href: "/water-temp/san-diego",
        description:
          "Current water temps and wetsuit recommendations for San Diego.",
      },
      {
        label: "How to Read Surf Conditions",
        href: "/learn/how-to-read-surf-conditions",
        description:
          "Master wave height, swell period, direction, wind, and tide readings.",
      },
    ],
  },
  {
    slug: "beginner-breaks-santa-cruz",
    title: "Beginner Surf Spots in Santa Cruz: Cowell's to Capitola",
    description:
      "Santa Cruz's gentlest waves: Cowell's, Capitola, and Jack's at Pleasure Point, plus what 48-58°F water means for your wetsuit and when each spot works.",
    readingTimeMin: 5,
    datePublished: "2026-03-30",
    dateModified: "2026-09-02",
    heroImage: "/4groms.jpg",
    thumbnailImage: "/4groms.jpg",
    keywords: [
      "beginner surf spots santa cruz",
      "learn to surf santa cruz",
      "best beaches for beginners santa cruz",
      "santa cruz surf lessons",
      "cowells beach surfing",
    ],
    sections: [
      {
        id: "overview",
        heading: "Why Santa Cruz Works for Beginners",
        content:
          '<p>Santa Cruz has been a surf town since 1885 — longer than anywhere else on the mainland. That history means <strong>deep infrastructure for learning</strong>: surf schools at every major break, rental shops on Pacific Avenue, and a culture that genuinely welcomes new surfers at the right spots.</p><p>The catch is the water. At <strong>48-58°F year-round</strong>, Santa Cruz is significantly colder than Southern California. You\'ll need a real wetsuit (4/3mm minimum), and winter sessions require booties. But the tradeoff is worth it: consistent NW swell, world-class wave variety within a short drive, and a coastline that\'s genuinely beautiful — kelp forests, cypress trees, and otters floating in the lineup.</p>',
        keyTakeaway:
          "Santa Cruz has excellent beginner infrastructure and consistent waves, but the cold water (48-58°F) requires a 4/3mm wetsuit year-round.",
      },
      {
        id: "top-spots",
        heading: "Top 5 Beginner Breaks",
        content:
          '<p><strong>Cowell\'s Beach</strong> — The quintessential Santa Cruz beginner spot. A gentle sand-bottom break right next to the Santa Cruz Wharf with slow, rolling waves that are perfect for learning. Every surf school in town runs lessons here. Parking in the lot above is easy on weekday mornings.</p><p><strong>Capitola Beach</strong> — A sheltered cove that blocks the northwest wind and creates mellow, predictable waves. The water is slightly warmer than open-coast breaks thanks to the protected orientation. Family-friendly village with restaurants and rentals steps from the sand.</p><p><strong>38th Avenue (Pleasure Point area)</strong> — A mellow beach break south of the main Pleasure Point reef. The inside section produces soft whitewater that\'s ideal for practicing pop-ups. Stay inside and let the more experienced surfers have the outside peaks.</p><p><strong>Manresa State Beach</strong> — 20 minutes south of Santa Cruz, Manresa offers <strong>forgiving sandbars and significantly less crowd</strong> than in-town breaks. The waves are gentle and the beach is long — plenty of room to spread out and practice without bumping into other surfers.</p><p><strong>Pleasure Point (beginners area)</strong> — The inside section at 36th Avenue, known locally as "the Hook inside," has a soft breaking wave that works on smaller days. Only attempt this when the swell is small (under 3 feet) — bigger days make this spot too powerful for beginners.</p>',
        keyTakeaway:
          "Cowell's Beach is the #1 beginner spot in Santa Cruz. Capitola, 38th Ave, Manresa, and the inside at Pleasure Point round out the top five.",
      },
      {
        id: "when-to-go",
        heading: "Best Time to Surf as a Beginner",
        content:
          '<p><strong>Summer (June-August)</strong> is the best window for beginners. Swell size drops to 1-3 feet, water warms to its peak at 55-58°F, and morning glass is reliable before the afternoon westerly kicks in around noon.</p><p><strong>Early fall (September-October)</strong> can be excellent. Water stays warm from summer, swells are still manageable at sheltered spots, and the crowds thin out when school starts.</p><p><strong>Winter is for watching.</strong> November through March brings powerful NW groundswells that make most breaks too heavy for beginners. Cowell\'s can still work on smaller days, but check the forecast carefully — a 6-foot swell at 16 seconds will close out the whole bay.</p><p>Go at <strong>sunrise</strong>. The wind pattern in Santa Cruz is predictable: calm and glassy at dawn, building westerly by 11am. By 2pm it\'s usually blown out. Set your alarm and get in the water before 8am for the best conditions.</p>',
        keyTakeaway:
          "Summer is prime beginner season. Go at dawn for glassy conditions — the westerly wind kills it by noon. Avoid winter swells.",
      },
      {
        id: "gear-and-lessons",
        heading: "Gear & Where to Take Lessons",
        content:
          '<p>Santa Cruz water is <strong>cold</strong>. A <strong>4/3mm wetsuit is the year-round minimum</strong>. From November through April, upgrade to a <strong>5/4mm with booties</strong> — your feet will thank you. Gloves are optional but nice on the coldest mornings.</p><p>For rentals, the shops on Pacific Avenue and along West Cliff Drive have everything: <strong>Cowell\'s Surf Shop</strong>, <strong>O\'Neill Surf Shop</strong> (the original — Jack O\'Neill invented the wetsuit here), and <strong>Freeline Design</strong> all rent soft-tops and wetsuits for $25-40/day.</p><p>Lessons run at Cowell\'s Beach every morning. <strong>Richard Schmidt Surf School</strong> and <strong>Club Ed</strong> are the longest-running operations, with group lessons at $100-130 for a 2-hour session. Most include board and wetsuit rental.</p>',
        keyTakeaway:
          "Bring a 4/3mm wetsuit minimum (5/4mm + booties for winter). Cowell's Beach hosts most lessons at $100-130 per session.",
      },
      {
        id: "safety-and-localism",
        heading: "Safety & Localism",
        content:
          '<p><strong>Cold water shock is real.</strong> If you\'re used to warm water, the first plunge into 52°F ocean will take your breath away. Splash water on your face and neck before paddling out to acclimate. Wear the right wetsuit — hypothermia sneaks up on you when you\'re focused on catching waves.</p><p><strong>Watch for kelp.</strong> Kelp beds are everywhere along the Santa Cruz coast. If you get tangled, stay calm and slowly unwrap the strands. Don\'t thrash — it makes it worse. Kelp won\'t pull you under.</p><p><strong>Stay away from Steamer Lane as a beginner.</strong> This is one of California\'s most famous waves with a deeply established local crew. Paddling out at the Lane when you can\'t handle the wave is dangerous and disrespectful. Earn your skills at Cowell\'s first — the locals will notice when you\'re ready.</p><p><strong>Respect the lineup everywhere.</strong> Santa Cruz has a reputation for localism, but it\'s mostly concentrated at high-performance spots. At beginner breaks like Cowell\'s and Capitola, the vibe is welcoming. Be polite, don\'t drop in, and you\'ll be fine.</p>',
        keyTakeaway:
          "Prepare for cold water, watch for kelp, and stay away from Steamer Lane until you're experienced. Beginner spots are welcoming — just respect the lineup.",
      },
    ],
    faqs: [
      {
        question: "How cold is the water in Santa Cruz?",
        answer:
          "Cold year-round: 48-52°F in winter, 55-58°F in summer. A 4/3mm wetsuit is the minimum. Winter sessions need a 5/4mm with booties, and many locals add gloves on the coldest mornings.",
      },
      {
        question: "What's the best beginner beach in Santa Cruz?",
        answer:
          "Cowell's Beach, hands down. It's where every surf school operates, the waves are gentle and predictable, the bottom is sandy, and it's right next to the wharf with easy parking and food options.",
      },
      {
        question: "Is localism a problem for beginners in Santa Cruz?",
        answer:
          "Not at beginner spots. Cowell's and Capitola are welcoming to new surfers. Localism is concentrated at high-performance breaks like Steamer Lane and Pleasure Point. Stay at appropriate spots for your skill level and you'll have no issues.",
      },
      {
        question: "When is the best time of year to learn to surf in Santa Cruz?",
        answer:
          "Summer (June-August) offers the smallest waves and warmest water. September-October is also excellent. Avoid November-March as a beginner — winter swells are too powerful for most learning breaks.",
      },
      {
        question: "How much does it cost to start surfing in Santa Cruz?",
        answer:
          "A group lesson at Cowell's runs $100-130 including board and wetsuit. Renting gear on your own costs $25-40/day. If you're committed, a used wetsuit ($50-100) and a foam board ($200-300) pays for itself in a few sessions.",
      },
    ],
    relatedLinks: [
      {
        label: "Best Surf Conditions for Beginners",
        href: "/learn/best-surf-conditions-for-beginners",
        description:
          "Learn the ideal wave size, period, wind, and tide for your first sessions.",
      },
      {
        label: "Santa Cruz Beginner Spots",
        href: "/beginner/santa-cruz",
        description:
          "Live conditions and crowd data at Santa Cruz's beginner-friendly breaks.",
      },
      {
        label: "Santa Cruz Water Temperature",
        href: "/water-temp/santa-cruz",
        description:
          "Current water temps and wetsuit recommendations for Santa Cruz.",
      },
      {
        label: "How to Read Surf Conditions",
        href: "/learn/how-to-read-surf-conditions",
        description:
          "Master wave height, swell period, direction, wind, and tide readings.",
      },
    ],
  },

  {
    slug: "how-swell-wraps-around-points",
    title: "How Swell Wraps Around a Point",
    description:
      "Swell bends as it enters shallower water near a headland. That bending — refraction — is why points like Rincon and Trestles can magnify a small swell from the right direction and ignore a bigger one from the wrong angle. Direction matters more than height at a point.",
    readingTimeMin: 7,
    datePublished: "2026-04-30",
    dateModified: "2026-07-06",
    heroImage: "/point-break.webp",
    thumbnailImage: "/point-break.webp",
    keywords: [
      "swell refraction",
      "how swell wraps around a point",
      "point break swell direction",
      "wave refraction explained",
      "rincon swell direction",
      "trestles swell window",
      "why points need long period swell",
      "point break physics",
    ],
    sections: [
      {
        id: "answer",
        heading: "The Short Answer",
        content: `<p>Swell wraps around a point because waves slow down in shallow water near the headland while the rest of the wave keeps moving fast over deeper water. The line bends toward the slower side and refocuses along the point, peeling down the coast as a long, organized wall. That bending is called <strong>refraction</strong>. It's why a 4-foot west swell at 16 seconds can light up Rincon while the open beach next door barely notices, and why a bigger swell from the wrong direction can pass right by.</p>`,
        keyTakeaway:
          "Refraction is swell bending into shallower water at a headland — that's how points get long, peeling waves while the open coast next door looks flat.",
      },
      {
        id: "what-refraction-is",
        heading: "What Refraction Actually Is",
        figureKey: "swell-period-morph",
        content: `<p>Refraction is wave bending. When a swell line enters shallower water, the part of the wave touching the shallow side slows down. The part still in deep water keeps moving at full speed. The whole line pivots toward the slow side, like a marching band turning around a corner where the inside row takes shorter steps.</p><p>This isn't a metaphor. Wave speed in shallow water depends on depth — once depth drops below roughly half the wavelength, the bottom starts dragging on the wave. A 14-second swell has a wavelength of about 1,000 feet in deep water, so it starts feeling the bottom at around 500 feet of depth. A 7-second swell only has a wavelength of about 250 feet, so it doesn't start bending until it's much closer to shore. <strong>Longer-period swells refract more.</strong> That single fact controls almost everything about how a point fires.</p><p>At a headland — a chunk of land that sticks out into the ocean — the swell line hits the shallow shelf around the point first. That part slows. The rest of the line keeps charging. The result is a wave that bends inward and peels along the point's contour instead of just slamming straight into the cliff.</p>`,
        keyTakeaway:
          "Waves slow down in shallow water. The part of the swell line that hits shallow first lags, the line bends toward it, and longer-period swells bend more.",
        image: {
          src: "/images/activities/point-breaks.webp",
          alt: "Long-period ground swell wrapping around a point and peeling toward shore",
          position: "right",
        },
      },
      {
        id: "how-points-filter",
        heading: "How a Point Filters Swells",
        content: `<p>Every point break has a swell window — a range of directions and periods it can actually wrap. Outside that window, the swell either gets blocked by land upstream, refracts the wrong way, or arrives with too much shoulder-angle to break clean.</p><p><strong>Rincon</strong>, on California's central coast, faces roughly southwest. It sits in the shadow of Point Conception for north and northwest swells. A 6-foot NW swell at 10 seconds gets cut off by the headlands above and arrives shrunken and confused. A 4-foot west or WNW swell at 16 seconds, though, has enough wavelength to bend around Conception, refract along the cobblestones, and run the full length of the cove. Locals know the rule: long-period west is gold; short-period north is nothing.</p><p><strong>Trestles</strong>, further south, has a different geometry. The reef sits in a south-facing zone with a wide-open swell window for southern hemisphere groundswells. A 3-foot south swell at 17 seconds can produce shoulder-high, peeling rides because the period is long enough to refract cleanly across the reef. The same beach a hundred yards north misses most of that energy because there's no reef to focus it.</p><p>The pattern repeats up and down the coast. Each point has a preferred direction, a preferred period range, and a frustrating list of conditions where the open beach is going off and the point is asleep. <strong>The geometry of the headland and the seafloor in front of it determine the window.</strong> No model fixes that — you learn it by surfing the spot or asking locals.</p>`,
        keyTakeaway:
          "Each point has a swell window — a direction and period range it can refract. Outside that window, the same swell that lights up the beach next door does nothing here.",
      },
      {
        id: "direction-over-height",
        heading: "Why Direction Matters More Than Height at a Point",
        content: `<p>At a beach break, height and period dominate. At a point, <strong>direction comes first</strong>. A point that's blocked from a swell direction will turn a 6-foot day into a 1-foot day no matter how long the period is. Conversely, a point sitting wide open to a swell direction will magnify a 2-foot reading at the buoy into a chest-high wall on the right tide.</p><p>This is also why point breaks reward forecast literacy. The forecast might say "4 feet at 14 seconds." That's the open-coast reading. At your point, the actual wave depends on:</p><ul><li><strong>Whether the swell direction sits inside the point's window</strong> (otherwise no amount of energy reaches the lineup),</li><li><strong>Whether the period is long enough to refract</strong> around the headland (short-period swells stall out before they bend),</li><li><strong>Whether the seafloor in front of the point is shaped to focus or scatter</strong> the energy as it arrives.</li></ul><p>That's why surfers at Rincon will skip a 6-foot NW day and drive an hour for a 3-foot west day. The bigger swell can't get in. The smaller one can, and refraction does the rest.</p>`,
        keyTakeaway:
          "At a point, direction beats height. A small swell from the right direction outperforms a big swell from the wrong one because only the right direction can wrap.",
        image: {
          src: "/images/Winter-Swamis.webp",
          alt: "Long-period swell wrapping into a point lineup",
          position: "left",
        },
      },
      {
        id: "reading-refraction",
        heading: "How to Read Refraction From a Forecast",
        content: `<p>You don't need to model refraction. You need three pieces of information:</p><p><strong>1. The forecast swell direction</strong>, in degrees. 270 is straight west. 180 is straight south. 315 is northwest. Most surf forecasts give this as a number or a compass heading.</p><p><strong>2. Your point's swell window.</strong> This is local knowledge. Rincon: roughly 240–280. Trestles: roughly 180–220. Malibu: roughly 180–230. If the forecast direction is outside that range, the point is closed for that swell, period.</p><p><strong>3. The forecast period.</strong> If the period is under 10 seconds, the swell may not refract well even if the direction is correct. Points generally need <strong>12+ seconds</strong> to wrap properly, and the best days at most points are <strong>14–18 second</strong> ground swells.</p><p>Run those three filters before you check height. If all three line up, then check the buoy reading and the wind. If even one fails — wrong direction, short period — you're better off at a beach break that doesn't depend on refraction. The Quiver forecast for your beach already does this filtering for you, but the underlying logic is something every point surfer eventually learns by hand.</p><p>Quick gut check: <strong>at a point, never trust raw height alone.</strong> Always read direction and period first. The number on the forecast is the open-ocean signal. The wave you actually paddle out to is what survives the bend.</p>`,
        keyTakeaway:
          "Check direction and period before height. If the forecast direction sits inside your point's window and the period is 12+ seconds, then the height starts to matter.",
      },
    ],
    faqs: [
      {
        question: "Why does Rincon need a long-period west swell?",
        answer:
          "Two reasons. First, the cove faces roughly southwest, so a true west swell sits inside its window while a north swell gets blocked by Point Conception above. Second, refraction depends on wavelength — long-period swells (14+ seconds) have wavelengths long enough to bend around Conception's headlands and refract cleanly along the cobblestones. A short-period north swell stalls out before it gets there.",
      },
      {
        question: "Can a small swell wrap into a bigger wave at a point?",
        answer:
          "Sort of. Refraction concentrates energy along the point — the same wave that would spread out over an open beach gets focused into a narrower zone, so the face stands taller and the wave peels longer. It doesn't make a 2-foot swell into a 6-foot wave, but it can turn a 2-foot open-coast reading into a chest-high, well-formed wall, especially with long period. The energy is the same; refraction just packages it better.",
      },
      {
        question: "Why does my point fire on south swells but go flat on north?",
        answer:
          "Your point's swell window doesn't cover north. Either there's land upstream that blocks north swells, or the headland's geometry can't refract a swell coming from that angle. Most California points face south or southwest because their headlands stick out from north-facing coastline — that orientation opens them to southern hemisphere groundswells but shadows them from NW winter swells. Local geography is the answer.",
      },
      {
        question: "What's the minimum period for a swell to wrap a point?",
        answer:
          "Roughly 10 seconds, with 12+ seconds being where refraction starts producing genuinely good waves and 14–18 seconds being the sweet spot for most points. Below 10 seconds the wavelength is too short to interact with the seafloor far enough offshore to bend cleanly, so the swell hits the headland straight and breaks messy or just dies on the rocks.",
      },
      {
        question: "Does wind direction affect refraction?",
        answer:
          "Not really. Refraction is a function of seafloor depth and swell period, not wind. Wind affects what the wave looks like when it breaks — offshore cleans up the face, onshore chops it — but it doesn't change whether the swell can wrap into the point. A point with the wrong swell direction won't fire even on the cleanest offshore morning.",
      },
    ],
    relatedLinks: [
      {
        label: "How Swell Direction Affects Surf",
        href: "/learn/how-swell-direction-affects-surf",
        description:
          "Why some breaks light up on south swells and ignore north — direction windows explained.",
      },
      {
        label: "Swell Period Explained",
        href: "/learn/swell-period-explained",
        description:
          "Period drives refraction. Learn why long-period swells wrap and short-period swells don't.",
      },
      {
        label: "Beach Break vs Reef Break vs Point Break",
        href: "/learn/beach-break-vs-reef-break-vs-point-break",
        description:
          "How the bottom shapes the wave — and why points behave so differently from beaches.",
      },
      {
        label: "Rincon Forecast",
        href: "/forecasts/rincon",
        description:
          "Live forecast and refraction-aware conditions for Rincon, CA.",
      },
    ],
  },

  {
    slug: "how-quiver-calibrates-your-beach",
    title: "How Quiver Calibrates Your Beach",
    description:
      "Calibration starts by saving a forecast, matching it to a later observation, and keeping offshore buoy height separate from breaking surf at the beach.",
    readingTimeMin: 7,
    datePublished: "2026-04-30",
    heroImage: "/images/learn/learn-aerial-shore.jpg",
    thumbnailImage: "/images/learn/learn-aerial-shore.jpg",
    keywords: [
      "calibrated surf forecast",
      "how Quiver calibrates beach",
      "surf forecast accuracy",
      "buoy observations forecast correction",
      "personalized surf forecast per beach",
      "surf forecast transparency",
      "surf forecast methodology",
    ],
    sections: [
      {
        id: "answer",
        heading: "The Short Answer",
        content: `<p>Calibration starts by saving a forecast before conditions arrive, then matching it to a later observation using a fixed station and time-window rule. For buoy checks, the ground truth is offshore significant wave height at the sensor. That is not the same quantity as breaking face height at the beach. Quiver documents this method and its limits at <a href="/forecast-accuracy">/forecast-accuracy</a>; it does not publish an accuracy ranking against other forecasts.</p>`,
        keyTakeaway:
          "Calibration requires a saved forecast, matching ground truth, and a clear definition of the wave height being scored.",
      },
      {
        id: "what-calibrated-means",
        heading: "What 'Calibrated' Actually Means",
        content: `<p>Most surf forecasts start in the same place: a global wave model run by NOAA or a similar agency. WaveWatch III, ECMWF, and Open-Meteo all produce hourly predictions of swell height, period, direction, and wind for every spot on the planet. Those models are good. They are not perfect.</p><p>The gap between "model output" and "what actually shows up at your beach" is what calibration closes. Two things drive that gap:</p><ul><li><strong>Local seafloor and shoreline geometry.</strong> A global model has no idea your beach has a sandbar 300 feet offshore that turns a 4-foot reading into 3 feet of mush, or that the reef next door focuses the same swell into a head-high wall. The model just gives the open-ocean signal.</li><li><strong>Systematic model bias.</strong> Every model has tendencies. Some run hot on small swells. Some underestimate long-period north swells. Some are great on dominant swell but miss secondary windswell. These biases don't go away — they just need to be measured and corrected.</li></ul><p>Calibration is the act of measuring those biases for <strong>your specific beach</strong> and correcting the next forecast accordingly. It's the difference between "this is what the model said" and "this is what the model said, adjusted for what we've observed at your beach over the last several months."</p>`,
        keyTakeaway:
          "Calibration is the gap between what a global model predicts and what actually shows up at your beach. Closing that gap is the whole job.",
      },
      {
        id: "how-it-works",
        heading: "How It Works for Your Beach",
        content: `<p>Here's the data flow, in plain English:</p><p><strong>1. Save the forecast.</strong> Keep the raw model value and any adjusted value with the issue time, valid time, location, lead time, variable, and units.</p><p><strong>2. Pull the observation.</strong> Match the saved value to what a documented NDBC, CDIP, or IOOS buoy measured inside a fixed time window.</p><p><strong>3. Keep the definition straight.</strong> A buoy reports offshore significant wave height. Do not label that as observed breaking face height at the beach.</p><p><strong>4. Evaluate the adjustment.</strong> Compare the raw and adjusted offshore-height values on the same holdout sample. Keep the miss even when it is unfavorable.</p><p><strong>5. Report the limits.</strong> Publish the sample, date range, beaches, forecast horizon, missing data, and error formula before making a performance claim.</p><p>This is not magic. It is a testable loop: predict, observe, measure, and keep the result. A correction only earns trust when the saved evaluation shows that it helped on unseen data.</p>`,
        keyTakeaway:
          "Forecast in, real buoy reading in, learn the gap, apply the correction next time. Repeat per beach. That's the whole loop.",
        image: {
          src: "/images/learn/learn-aerial-swell.jpg",
          alt: "Aerial view of organized swell lines approaching shore",
          position: "right",
        },
      },
      {
        id: "what-we-publish",
        heading: "What the Method Has to Publish",
        content: `<p>Calibration only matters if it can be audited. The <a href="/forecast-accuracy">/forecast-accuracy</a> page now states the standard Quiver expects its own evaluation to meet:</p><p><strong>Preserve the forecast.</strong> The value must be saved before the observation arrives, with its timestamp, lead time, location, variable, and units.</p><p><strong>Name the ground truth.</strong> Offshore significant wave height from a buoy and breaking face height at a beach are different quantities. A report must say which one it scores.</p><p><strong>Use one sample for a comparison.</strong> Every provider must be evaluated across the same beaches, times, horizons, observations, and exclusion rules.</p><p><strong>State what is missing.</strong> Quiver has not completed a same-sample comparison against other surf forecasts, so it does not claim an accuracy ranking.</p>`,
        keyTakeaway:
          "A forecast score needs a saved sample, named ground truth, reproducible rules, and clear limits.",
      },
      {
        id: "the-day-i-caught-my-bug",
        heading: "The Day I Caught My Own Bug",
        content: `<p>One thing about running a calibration loop is that it surfaces problems in your own code. You can't hide from it. The buoy is the buoy.</p><p>I shipped a forecast model, found a direction bug in our own data pipeline, fixed it, retrained it, and kept the old predictions instead of rewriting history. That's the difference: we check our own work.</p><p>The reason it matters is straightforward. If I'd quietly patched the model and replaced the old predictions, the evaluation would no longer describe what actually shipped. A forecast you can't audit isn't calibrated — it is just a number.</p><p>The model is a tool. The discipline is the loop: predict, observe, measure, and preserve the result. The method matters more than the marketing label.</p>`,
        keyTakeaway:
          "The calibration loop catches your own bugs. We fix them, retrain, and keep the old predictions honest instead of rewriting history.",
      },
    ],
    faqs: [
      {
        question: "How is this different from a regular surf forecast?",
        answer:
          "A regular forecast hands you the global model's output and stops there. We take the same starting point — global model — and add a per-beach correction trained on what the local buoys actually measured. The forecast number you see has been adjusted for the systematic biases at your specific beach, not just the open ocean grid cell.",
      },
      {
        question: "What should an accuracy report publish?",
        answer:
          "At minimum: the saved forecast sample, date range, beaches, lead times, exact variable and units, observation source, matching window, missing-data rules, and error formula. A head-to-head also needs every provider evaluated on that same sample.",
      },
      {
        question: "What happens when the model is wrong?",
        answer:
          "The saved forecast and its matched observation should stay in the evaluation set. Do not delete the miss or replace the original prediction after conditions arrive. Being wrong is part of a valid test; rewriting the sample breaks it.",
      },
      {
        question: "Does calibration establish an accuracy ranking?",
        answer:
          "No. Quiver has not completed a same-sample comparison across identical beaches, timestamps, lead times, observations, and wave-height definitions. It does not claim an accuracy ranking.",
      },
      {
        question: "How long does it take a new beach to be well-calibrated?",
        answer:
          "There is no universal cutoff. Readiness depends on enough independent forecast-observation pairs across the conditions the beach receives, followed by holdout evaluation. More history alone does not prove that an adjustment improves the forecast.",
      },
    ],
    relatedLinks: [
      {
        label: "Forecast Accuracy",
        href: "/forecast-accuracy",
        description:
          "See the validation method, ground-truth limits, and comparison requirements.",
      },
      {
        label: "Quiver vs Surfline",
        href: "/vs/surfline",
        description:
          "Where we do the same thing, where we differ, and what we don't claim to compete on.",
      },
      {
        label: "How Swell Wraps Around a Point",
        href: "/learn/how-swell-wraps-around-points",
        description:
          "Why direction and period matter more than height at a point — and why a global model alone misses it.",
      },
      {
        label: "How to Read Surf Conditions",
        href: "/learn/how-to-read-surf-conditions",
        description:
          "The five metrics every forecast hands you, and how to read them together.",
      },
      {
        label: "Rincon Forecast",
        href: "/forecasts/rincon",
        description:
          "A calibrated forecast in action at one of California's most direction-sensitive points.",
      },
    ],
  },
  {
    slug: "how-does-water-temperature-affect-surfing",
    title: "How Does Water Temperature Affect Surfing?",
    description:
      "Learn how water temperature affects surfing through wetsuit choice, session length, cold shock, fatigue, comfort, and local wind—not wave height.",
    readingTimeMin: 6,
    datePublished: "2026-08-19",
    heroImage: "/images/learn/learn-tide-pools.jpg",
    thumbnailImage: "/images/learn/learn-tide-pools.jpg",
    keywords: [
      "how does water temperature affect surfing",
      "surfing water temperature",
      "cold water surfing",
      "surfing wetsuit temperature",
      "cold shock surfing",
      "water temperature surf conditions",
    ],
    sections: [
      {
        id: "short-answer",
        heading: "The Short Answer",
        content: `<p>Water temperature does <strong>not</strong> change swell height or make waves larger. It changes the surfer's experience: what thermal protection to wear, how long a session stays comfortable, and how quickly cold shock or fatigue can reduce breathing control, coordination, and judgment. Check the water temperature separately from wave height, period, wind, and tide before deciding whether the session fits you and your gear.</p>`,
        keyTakeaway:
          "Water temperature affects your body and equipment choices, not the height of the waves.",
      },
      {
        id: "wetsuit-choice",
        heading: "Water Temperature Determines What You Wear",
        content: `<p>Your wetsuit slows heat loss by trapping a thin layer of water and limiting circulation against the skin. Warmer water may call for trunks, a rash guard, or a thin spring suit; cooler water usually requires a full suit, then boots, gloves, and a hood as temperatures fall. Suit needs also vary with wind, air temperature, sun, body size, cold tolerance, and how active you are.</p><p>Use water temperature as a starting point, then adjust for the whole session. A shaded dawn patrol with strong wind can feel much colder than a sunny afternoon in the same ocean temperature. See the <a href="/learn/what-wetsuit-thickness-do-i-need">wetsuit thickness guide</a> for a practical range chart.</p>`,
        keyTakeaway:
          "Choose thermal protection from the water temperature, then account for wind, air temperature, sun, and personal tolerance.",
      },
      {
        id: "cold-shock",
        heading: "Cold Shock Changes the First Minutes",
        content: `<p>Sudden immersion in cold water can trigger an involuntary gasp, rapid breathing, and a spike in heart rate. That response can make a rushed paddle-out harder and becomes more serious if you enter without control of your breathing. A well-fitting wetsuit helps, but it does not remove the need to enter deliberately and stay within your experience.</p><p>If breathing does not settle, you feel chest pain, or you lose control of your hands and movement, leave the water and seek help. Surfers with heart or respiratory conditions should get individualized medical guidance before cold-water sessions.</p>`,
        keyTakeaway:
          "Cold water can disrupt breathing immediately; enter deliberately and end the session if control does not return.",
      },
      {
        id: "fatigue-session-length",
        heading: "Cold Shortens Useful Session Time",
        content: `<p>As the body cools, muscles and joints can feel stiffer, paddling becomes less efficient, and fine motor control can fade. That matters when gripping rails, fastening a leash, timing a pop-up, or making a calm decision in current. The useful session often ends before severe shivering begins.</p><p>Watch for persistent shivering, numb fingers, clumsy movement, confusion, or unusual fatigue. Those are reasons to return to shore, warm up gradually, and avoid paddling back out simply to reach a planned session length.</p>`,
        keyTakeaway:
          "End the session when cold begins reducing coordination or judgment, not when the clock says you are done.",
      },
      {
        id: "waves-and-wind",
        heading: "Temperature Does Not Create Bigger Surf",
        content: `<p>Swell height comes from wind transferring energy to the ocean over distance and time, then from how that swell interacts with the local seafloor and coastline. The temperature of the water at your beach does not add height to an arriving swell.</p><p>Temperature gradients can still matter indirectly. Differences between warmer land and cooler ocean help drive local sea breezes, while seasonal ocean patterns can influence weather over larger scales. That local wind may smooth, texture, or disrupt the surf depending on its direction and strength. The wind affects the waves; the water temperature itself is not changing the swell height.</p>`,
        keyTakeaway:
          "Separate temperature from swell: land-ocean temperature gradients can drive local wind, and that wind can affect surf quality.",
      },
      {
        id: "planning",
        heading: "Plan the Session With Temperature in Context",
        content: `<p>Check the current water temperature alongside air temperature, wind, weather, wave size, period, tide, and the time you expect to spend outside. Bring a dry layer for afterward, confirm that the wetsuit seals and moves properly, and remember that a suit that worked last month may not fit today's upwelling or seasonal change.</p><p>Quiver beach pages show water temperature and wetsuit guidance as part of the session check. Treat that guidance as a starting point rather than a guarantee of comfort, because cold tolerance and equipment condition vary by surfer.</p>`,
        keyTakeaway:
          "Use current water temperature and wetsuit guidance as part of a full conditions check, then adjust for your body and gear.",
      },
    ],
    faqs: [
      {
        question: "Does warmer water make waves bigger for surfing?",
        answer:
          "No. Water temperature at the beach does not determine swell height. Wave size comes from the generating wind, swell travel, and how the swell interacts with the coastline and seafloor.",
      },
      {
        question: "What water temperature is too cold to surf?",
        answer:
          "There is no single cutoff for everyone. The answer depends on exposure gear, experience, health, wind, air temperature, and session length. If you cannot control your breathing or cold reduces coordination or judgment, get out.",
      },
      {
        question: "Why do I get tired faster when surfing in cold water?",
        answer:
          "Your body spends energy limiting heat loss, while cooling muscles and joints can become stiffer and less efficient. A restrictive or poorly fitting wetsuit can also make paddling harder.",
      },
      {
        question: "Can I surf cold water without a wetsuit?",
        answer:
          "Brief exposure is possible for some trained people, but cold shock and rapid heat loss can impair breathing and movement. Most surfers use thermal protection matched to the temperature and conditions.",
      },
      {
        question: "Does water temperature affect surfboard performance?",
        answer:
          "For a normal session, the main effect is on the surfer rather than the board. Temperature can slightly change material stiffness or wax choice, but it does not replace wave height, period, wind, tide, and board design as the main performance factors.",
      },
    ],
    relatedLinks: [
      {
        label: "What Wetsuit Thickness Do I Need?",
        href: "/learn/what-wetsuit-thickness-do-i-need",
        description:
          "Match common water-temperature ranges to wetsuit thickness and accessories.",
      },
      {
        label: "How to Read Surf Conditions",
        href: "/learn/how-to-read-surf-conditions",
        description:
          "Combine water temperature with swell, wind, tide, and wave height.",
      },
      {
        label: "Best Time of Day to Surf",
        href: "/learn/best-time-of-day-to-surf",
        description:
          "Understand how wind and air temperature can change the feel of a session.",
      },
      {
        label: "Check Current Water Temperature",
        href: "/forecast",
        description:
          "Review current conditions and wetsuit guidance before heading out.",
      },
    ],
  },
  {
    slug: "beginner-breaks-orange-county",
    title: "Best Beginner Surf Spots in Orange County",
    description:
      "Compare beginner surf spots in Orange County, including Doheny, Bolsa Chica, Blackies, Old Man's, and Huntington Beach, plus conditions to check.",
    readingTimeMin: 7,
    datePublished: "2026-08-19",
    heroImage: "/images/activities/beginner-friendly.webp",
    thumbnailImage: "/images/activities/beginner-friendly.webp",
    keywords: [
      "beginner surf spots orange county",
      "best beginner surf spots orange county",
      "learn to surf orange county",
      "Doheny beginner surfing",
      "Bolsa Chica beginner surfing",
      "Blackies Newport beginner surfing",
    ],
    sections: [
      {
        id: "short-answer",
        heading: "The Short Answer",
        content: `<p>Orange County has several places where beginners can find manageable waves when the swell, tide, wind, and crowd line up. <strong>Doheny State Beach</strong> is the usual first choice for soft rollers; <strong>Bolsa Chica</strong> and <strong>Blackies in Newport Beach</strong> offer sand-bottom practice; <strong>San Onofre's Old Man's</strong> is known for slower longboard waves; and <strong>Huntington Beach south of the pier</strong> can work on smaller, cleaner days. None is automatically suitable every day, so check a current report and watch multiple sets from shore.</p>`,
        keyTakeaway:
          "Choose the day's conditions, not just a famous spot name, and confirm the wave pattern from shore before entering.",
      },
      {
        id: "doheny-old-mans",
        heading: "Doheny and Old Man's for Slower Waves",
        content: `<p><strong>Doheny State Beach</strong> in Dana Point is a classic learner option when the surf is small. The inside commonly offers soft whitewater and slower waves, but the bottom includes cobbles and rocks, the takeoff zones can be crowded, and larger south swells add speed and current. Stay clear of the harbor entrance and use the designated surf area.</p><p><strong>Old Man's at San Onofre</strong>, just south of the Orange County line, is a common OC surf trip because its broad peaks and rolling shoulders suit longboards on smaller days. It can still be crowded, the cobble bottom is uneven, and stronger swells create long paddles and more powerful sets. Check access and parking conditions before driving.</p>`,
        keyTakeaway:
          "Doheny and Old Man's favor slower longboard-style waves on smaller days, but rocks, crowds, and swell size still matter.",
      },
      {
        id: "bolsa-blackies",
        heading: "Bolsa Chica and Blackies for Sand-Bottom Practice",
        content: `<p><strong>Bolsa Chica State Beach</strong> has a long sandy shoreline with room to look for a softer peak. It is still an exposed beach break: short-period windswell can close out, afternoon wind can roughen the surface, and shifting sandbars can create rip currents. Beginners should favor small days, stay near staffed areas, and avoid assuming one section behaves like the next.</p><p><strong>Blackies</strong>, on the north side of Newport Pier, is popular with beginners and longboarders when waves are small. The pier can influence current, the lineup gets busy, and larger or lower-tide surf can become faster than its mellow reputation suggests. Keep distance from the pilings and practice in uncrowded whitewater before joining an outside peak.</p>`,
        keyTakeaway:
          "Sand bottoms make Bolsa Chica and Blackies practical learning options, but current, closeouts, crowds, and pier hazards require attention.",
      },
      {
        id: "huntington",
        heading: "When Huntington Beach Works for Beginners",
        content: `<p><strong>Huntington Beach south of the pier</strong> can offer multiple sandbar peaks and accessible whitewater when the forecast is small and wind is light. It is more exposed than Doheny, so the same incoming swell can produce steeper waves, stronger currents, and frequent closeouts. The pier area also attracts crowds and experienced surfers.</p><p>Look for a clearly separated, smaller inside zone rather than paddling toward the main peak. Keep well away from the pier, swimmers, and other boards. If sets are breaking across the whole beach or the current keeps moving you downshore, choose a more sheltered session or take a lesson.</p>`,
        keyTakeaway:
          "Huntington can work on small, clean days, but its exposure and current demand a more selective call than a sheltered learner break.",
      },
      {
        id: "conditions",
        heading: "Conditions to Check Before You Go",
        content: `<p>Start with <strong>wave height, period, wind, tide, and swell direction</strong>. For early practice, look for small surf with enough space between sets to regain control. Longer period can add more force than the height alone suggests, while onshore wind can make even small surf disorganized. Tide effects vary with the sandbar or reef, so use spot-specific guidance.</p><ul><li><strong>Check a current report:</strong> conditions can change between breakfast and arrival.</li><li><strong>Watch several sets:</strong> the quiet minute after a set is not the full pattern.</li><li><strong>Identify current and exits:</strong> note where surfers drift and where you can return to shore.</li><li><strong>Respect closures and lifeguards:</strong> posted restrictions and local direction override a general guide.</li></ul>`,
        keyTakeaway:
          "A beginner-friendly location only fits when the day's height, period, wind, tide, crowd, and current are manageable.",
      },
      {
        id: "lessons-etiquette",
        heading: "Lessons, Equipment, and Lineup Etiquette",
        content: `<p>A lesson is useful for learning board control, the day's entry and exit, rip-current recognition, and where beginners are expected to practice. Use a high-volume soft-top with a leash in good condition, and choose a wetsuit from the current water temperature rather than the season alone.</p><p>Carry the board at your side, never between you and an incoming wave. Leave generous space, do not abandon the board, and do not paddle directly into an established peak before you can turn and stop reliably. At Doheny, Blackies, Old Man's, and other busy longboard lineups, waiting your turn and avoiding drop-ins matters as much as standing up.</p>`,
        keyTakeaway:
          "A lesson, suitable soft-top, and basic board-control etiquette make a crowded learner lineup more manageable for everyone.",
      },
    ],
    faqs: [
      {
        question: "What is the best beginner surf spot in Orange County?",
        answer:
          "Doheny State Beach is the most common starting point because smaller days can produce soft inside waves. It is not suitable in every condition, so check the current report, crowd, and designated surf area before entering.",
      },
      {
        question: "Is Bolsa Chica good for beginner surfers?",
        answer:
          "It can be on small, clean days, especially for whitewater practice over sand. Because it is exposed, shifting sandbars, closeouts, wind, and rip currents can make other days a poor fit.",
      },
      {
        question: "Can beginners surf at Blackies in Newport Beach?",
        answer:
          "Yes, when the surf is small and there is room to practice, but the lineup can be crowded and the pier affects the risk picture. Stay away from pilings and do not join an outside peak before you can control your board.",
      },
      {
        question: "Is Huntington Beach south of the pier beginner-friendly?",
        answer:
          "Sometimes. Small wave height, light wind, a manageable period, and a softer sandbar can create a useful beginner window. Larger swells, closeouts, current, or heavy crowds are reasons to choose another spot.",
      },
      {
        question: "When is the best time for a beginner to surf in Orange County?",
        answer:
          "There is no guaranteed hour, but mornings often have lighter wind. Check the current spot report, tide, swell period, and crowd, then watch multiple sets because seasonal swell and local wind can override the usual pattern.",
      },
      {
        question: "Do I need a wetsuit to surf in Orange County?",
        answer:
          "Often, especially outside the warmest late-summer periods. Check the current water and air temperature, wind, session length, and your cold tolerance before choosing a spring suit or full suit.",
      },
    ],
    relatedLinks: [
      {
        label: "Beginner Surf Spots in San Diego",
        href: "/learn/beginner-breaks-san-diego",
        description:
          "Compare learner breaks farther south and the conditions each needs.",
      },
      {
        label: "Beginner Surf Spots in Santa Cruz",
        href: "/learn/beginner-breaks-santa-cruz",
        description:
          "Compare colder-water beginner options on the Central Coast.",
      },
      {
        label: "Best Surf Conditions for Beginners",
        href: "/learn/best-surf-conditions-for-beginners",
        description:
          "Learn how height, period, wind, tide, and crowds shape a beginner window.",
      },
      {
        label: "Beginner Surf in Huntington Beach",
        href: "/beginner/huntington-beach",
        description:
          "Check the current learner call and conditions for Huntington Beach.",
      },
    ],
  },
];
