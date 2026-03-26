interface LearnArticle {
  slug: string;
  title: string;
  description: string;
  readingTimeMin: number;
  heroImage: string;
  thumbnailImage: string;
  keywords: string[];
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
    slug: "how-to-read-a-surf-forecast",
    title: "How to Read a Surf Forecast",
    description: "Learn what each metric means on a surf forecast: wave height, period, direction, wind, and tide. Master the data to find better sessions.",
    readingTimeMin: 5,
    heroImage: "/beginnerWhiteWater.jpg",
    thumbnailImage: "/beginnerWhiteWater.jpg",
    keywords: [
      "how to read surf forecast",
      "surf forecast explained",
      "understanding surf reports",
      "wave height",
      "swell period",
      "swell direction",
    ],
    sections: [
      {
        id: "overview",
        heading: "What a Surf Forecast Actually Tells You",
        content: `<p>A surf forecast predicts the raw ingredients you'll work with when you paddle out: wave size, period, direction, wind, and tide. These come from NOAA's WaveWatch III model, updated every 6 hours using global weather data. Quiver layers in real buoy observations from NDBC and CDIP stations so you can see how the prediction stacks up against reality. Think of it as a weather report for the ocean — useful, not perfect.</p>`,
        keyTakeaway:
          "A surf forecast predicts wave height, period, direction, and wind from NOAA models and real-time buoy observations.",
        image: { src: "/images/learn/learn-surfer-watching.jpg", alt: "Surfer watching waves from the beach, reading conditions before paddling out", position: "right" },
      },
      {
        id: "wave-height",
        heading: "Wave Height: Significant vs. Face Height",
        content: `<p>Forecast height means <strong>significant wave height</strong> (Hs) — the average of the tallest third of waves at a buoy. That's not the face height you see paddling out. Face height runs roughly <strong>1.5x to 2x</strong> significant height, so a 6-foot forecast means 9-12 foot faces. Beginners regularly show up expecting smaller waves than they get. Learn your break's conversion by comparing forecasts to what you actually see — sandy beaches and reef breaks scale differently.</p>`,
        keyTakeaway:
          "Significant wave height (forecast) is roughly 60-70% of face height—multiply the forecast by 1.5-2x to estimate what you'll actually see.",
        image: {
          src: "/images/Winter-Swamis.webp",
          alt: "Winter swell at Swamis — significant wave height vs face height",
          position: "right",
        },
      },
      {
        id: "swell-period",
        heading: "Swell Period: Why Seconds Matter",
        content: `<p>Period is the gap between waves — count the seconds between crests passing a buoy. A <strong>6-second period</strong> means local wind chop. A <strong>14-second period</strong> means distant storm energy traveling at roughly 25 mph through deep water. In the lineup, long-period waves feel more powerful, stand up faster, and break cleaner. A 4-foot swell at 14 seconds will outperform a 4-foot swell at 6 seconds every time. Don't ignore this number.</p>`,
        keyTakeaway:
          "Period (in seconds) is more important than height for wave quality: longer periods (12+ sec) mean cleaner, more powerful waves from distant storms.",
      },
      {
        id: "swell-direction",
        heading: "Swell Direction: Is Your Break Facing It?",
        content: `<p>Swell direction is the compass heading waves arrive from — 300 degrees means northwest. Your break has a preferred window: Rincon wants southwest, Malibu needs south, Sunset Beach wants north. If the swell doesn't face your break, it doesn't matter how big or long-period it is — you won't get waves. Check your break's exposure on a map, compare it to the forecast direction, and if they don't match, paddle somewhere else. Nearby breaks often face completely different directions.</p>`,
        keyTakeaway:
          "Swell direction only matters if your break faces it: check your beach's exposure on a map and compare to the forecast direction.",
      },
      {
        id: "wind",
        heading: "Wind Speed and Direction: Offshore vs. Onshore",
        content: `<p><strong>Offshore</strong> wind blows from land to sea — it holds up the wave face, slows the break, and creates clean lines. <strong>Onshore</strong> does the opposite: pushes waves down and adds chop. Most surfers want wind under <strong>10 knots</strong> with an offshore component. Between 5-15 knots, direction is everything. Above 15 knots, even offshore gets too textured.</p><p>Dawn patrol exists because land cools overnight and creates natural offshore flow before heating reverses it midday. If the forecast shows onshore, go early or wait for a different day.</p>`,
        keyTakeaway:
          "Offshore wind (blowing from land to sea) cleans up wave faces; onshore wind creates chop. Most breaks work best with 5-10 knot offshore winds.",
        image: {
          src: "/images/activities/offshore-winds.webp",
          alt: "Clean offshore wind holding up wave faces",
          position: "left",
        },
      },
      {
        id: "tide",
        heading: "Tide and How It Reshapes Your Break",
        content: `<p>Tide changes water depth, which controls where and how waves break. Low tide exposes shallow bars and reefs — hollow, fast, often dangerous for beginners. High tide floods things out — slower, mushier. Most beach breaks hit their sweet spot at <strong>mid-tide</strong> when there's enough water to form waves without drowning the bars. Learn your break's tidal window by surfing different tides and noting where peaks form. Tide forecasts are accurate to the minute — use them to time your session, not just the swell.</p>`,
        keyTakeaway:
          "Tide changes wave shape: low tide makes waves hollow and fast, high tide makes them slower, and most beaches work best at mid-tide.",
        image: { src: "/images/learn/learn-tide-pools.jpg", alt: "Aerial view of tide pools and exposed reef at low tide", position: "left" },
      },
      {
        id: "putting-it-together",
        heading: "Putting It All Together: Reading a Real Forecast",
        content: `<p>Good forecast: Tuesday 5 AM, 4 feet at 14 seconds from 230 degrees, 8 knots offshore, high tide 7:30 AM. Quality period, your break faces southwest, wind is clean — go early before tide floods it. Bad forecast: same day, 4 feet at 6 seconds from 230 degrees, 15 knots onshore, low tide. Same height, completely different session. The 6-second period means chop, onshore wind ruins the face, and low tide makes it dangerous.</p><p>The habit: never read height alone. Always check period, direction, wind, and tide before committing.</p>`,
        keyTakeaway:
          "Read forecasts in order: height tells you scale, period tells you quality, direction tells you if your break works, wind tells you texture, tide tells you timing.",
        image: {
          src: "/images/OceanBeachSurfers.webp",
          alt: "Surfers reading conditions at Ocean Beach",
          position: "right",
        },
      },
    ],
    faqs: [
      {
        question: "Why does my forecast height not match the waves I see?",
        answer:
          "Forecast height is significant wave height (average of the biggest waves), not face height. Multiply by 1.5-2x to estimate face height. Also, local bathymetry affects how waves break—a reef creates different scaling than a sand beach at the same forecasted height.",
      },
      {
        question: "Which is more important: wave height or period?",
        answer:
          "Period is more important for wave quality. A 4-foot swell at 14 seconds beats a 6-foot swell at 6 seconds every time. Long periods mean distant storms and cleaner lines. Short periods mean local chop and mushy waves.",
      },
      {
        question: "How accurate are surf forecasts?",
        answer:
          "NOAA's WaveWatch III is accurate within about 1-2 feet for significant height and 2-3 seconds for period, 3-5 days out. Accuracy drops for swell beyond that window. Local effects (reefs, sandbars) mean the global model misses the last mile—that's where CDIP buoys and Quiver's ML adjustments help.",
      },
      {
        question: "Should I check tide if my break is oceanfront?",
        answer:
          "Yes. Even ocean breaks are affected by tide. Shallow reefs and sandbars change shape. Some breaks get better or worse with tide change. Always compare your forecast session to your break's tidal window.",
      },
      {
        question: "What wind speed is too strong to surf?",
        answer:
          "Depends on wind direction. Offshore at 20 knots can still be fun. Onshore at 10 knots ruins it. Most breaks work best under 10 knots. Above 15 knots, chop usually takes over even with offshore direction.",
      },
    ],
    relatedLinks: [
      {
        label: "Swell Period Explained",
        href: "/learn/swell-period-explained",
        description:
          "Deep dive into why swell period matters more than height for wave quality.",
      },
      {
        label: "Wind Swell vs Ground Swell",
        href: "/learn/wind-swell-vs-ground-swell",
        description:
          "Understand the two types of ocean swells and how they form differently.",
      },
      {
        label: "How Surf Forecasts Work",
        href: "/learn/how-surf-forecasts-work",
        description:
          "Learn how NOAA models, buoys, and ML combine to predict the waves you see.",
      },
    ],
  },

  {
    slug: "swell-period-explained",
    title: "Swell Period Explained",
    description: "Understand swell period, why 14 seconds feels completely different than 6 seconds, and how to read it on your forecast.",
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
        label: "How to Read a Surf Forecast",
        href: "/learn/how-to-read-a-surf-forecast",
        description:
          "Master all forecast metrics: height, period, direction, wind, and tide.",
      },
      {
        label: "Wind Swell vs Ground Swell",
        href: "/learn/wind-swell-vs-ground-swell",
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
    title: "Best Surf Conditions for Beginners",
    description: "Ideal wave size, period, wind, and tide for learning to surf. Master conditions to learn faster and safer.",
    readingTimeMin: 5,
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
        label: "Beginner Breaks: San Diego",
        href: "/learn/beginner-breaks-san-diego",
        description:
          "Best beginner-friendly breaks in San Diego with forecast guidance.",
      },
      {
        label: "Beginner Breaks: Santa Cruz",
        href: "/learn/beginner-breaks-santa-cruz",
        description:
          "Beginner spots around Santa Cruz with tide and wind patterns.",
      },
      {
        label: "How to Read a Surf Forecast",
        href: "/learn/how-to-read-a-surf-forecast",
        description:
          "Learn to read all metrics so you can identify beginner-friendly conditions.",
      },
      {
        label: "Swell Period Explained",
        href: "/learn/swell-period-explained",
        description:
          "Understand why long-period swells are easier for beginners to learn on.",
      },
    ],
  },

  {
    slug: "wind-swell-vs-ground-swell",
    title: "Wind Swell vs Ground Swell",
    description: "Learn the difference between locally generated wind swells and distant ground swells, and why ground swell produces better waves.",
    readingTimeMin: 4,
    heroImage: "/offShore.jpeg",
    thumbnailImage: "/offShore.jpeg",
    keywords: [
      "wind swell vs ground swell",
      "what is ground swell",
      "types of ocean swells",
      "wind swell",
      "ground swell definition",
    ],
    sections: [
      {
        id: "definitions",
        heading: "Two Types of Ocean Swells: Definitions",
        content: `<p><strong>Wind swell</strong> is generated by wind blowing at your coast right now — short periods (5-9 seconds), chaotic energy, disorganized. <strong>Ground swell</strong> comes from distant storms, sometimes thousands of miles away — long periods (12+ seconds), organized energy, filtered by distance. Most forecasts show both as separate components: "4 feet at 14 seconds + 2 feet at 6 seconds." The first is ground swell (the good stuff), the second is wind swell (local noise). Both can contribute, but ground swell almost always makes the better waves.</p>`,
        keyTakeaway:
          "Wind swell is local wind generating chaotic short-period waves; ground swell is distant storms creating organized long-period waves.",
      },
      {
        id: "ground-swell-forms",
        heading: "How Ground Swells Form: Storms and Fetch",
        content: `<p>A major storm far out at sea churns the ocean with sustained wind over hundreds of miles of fetch. It generates waves across many periods, but long-period energy travels fastest and farthest. As the swell crosses ocean basins over days, short-period chop dissipates through friction, leaving behind clean, organized energy. A Southern Ocean storm takes 5-7 days to reach California as a <strong>16-second swell</strong>. An Alaskan storm takes 2-3 days. By the time it arrives, it's been filtered down to coherent, rideable energy.</p>`,
        keyTakeaway:
          "Ground swells form from distant storms with sustained wind over huge fetch, then travel ocean basins, losing short-period energy along the way.",
        image: {
          src: "/images/hero/hero-3-windansea.webp",
          alt: "Clean ground swell lines at Windansea",
          position: "right",
        },
      },
      {
        id: "wind-swell-forms",
        heading: "How Wind Swells Form: Local Wind Right Now",
        content: `<p>Wind swell forms when wind blows across the ocean at your coast. The energy is scattered across periods and directions because wind is chaotic — constantly shifting intensity and angle. That's why wind swell looks messy and close-together in person. The key difference: wind swell only lasts as long as the wind does. When the wind dies, the wind-swell component drops off the forecast. Ground swell persists for days because it's self-sustaining energy traveling across the ocean.</p>`,
        keyTakeaway:
          "Wind swell forms from local wind right now and disappears when wind stops; it's chaotic and short-period because energy is scattered.",
        image: { src: "/images/learn/learn-choppy-sea.jpg", alt: "Choppy disorganized sea from local wind swell", position: "right" },
      },
      {
        id: "visual-differences",
        heading: "What Wind and Ground Swells Look Like in the Water",
        content: `<p>Ground swell is unmistakable: organized sets with clean spacing, long lulls between them, waves all peeling in similar directions. You can see sets coming from far away because the energy is long and coherent. Even small ground swell looks powerful. Wind swell is the opposite — waves from every direction, no clear sets, everything crammed together at 6-9 second intervals. Even big wind swell feels mushy because the energy is scattered. You can spot the difference from shore once you know what to look for.</p>`,
        keyTakeaway:
          "Ground swell has organized sets with clean spacing; wind swell is chaotic texture from many directions.",
      },
      {
        id: "quality-comparison",
        heading: "Which Produces Better Surf and Why",
        content: `<p>Ground swell, almost always. Organized energy creates predictable, shapeable waves — you can set your line before the wave reaches your takeoff zone, and the ride lasts because the face is stable. Wind swell collapses fast with no clear peak, making waves harder to catch and shorter to ride. Even an 8-foot wind swell is usually inferior to a 2-foot ground swell. The swell type (period) determines rideability far more than height. That's why surfers obsess over tracking distant storms.</p>`,
        keyTakeaway:
          "Ground swell produces better waves than wind swell because organized distant energy creates predictable, shapeable rides.",
        image: {
          src: "/images/activities/reef-breaks.webp",
          alt: "Well-organized ground swell hitting a reef break",
          position: "left",
        },
      },
      {
        id: "when-wind-swell-is-fun",
        heading: "When Wind Swell Can Actually Be Good",
        content: `<p>Wind swell has its place. When ground swell is 1-2 feet and the ocean looks dead, a 3-4 foot wind swell provides more waves and more action. Advanced shortboarders sometimes prefer it — more opportunities, quicker reps, playful sessions. Fast beach breaks with A-frames can turn wind swell into fun peaks even at short periods. Reef breaks struggle with it because disorganized energy doesn't focus onto the structure. If you're choosing between a 1-foot ground swell and a 4-foot wind swell at a beach break, the wind swell might actually be more rideable — just lower quality per wave.</p>`,
        keyTakeaway:
          "Wind swell can be fun for advanced shortboarders on small days or at beach breaks, but ground swell is almost always better for wave quality.",
      },
      {
        id: "reading-both",
        heading: "Reading Both Swells in a Forecast",
        content: `<p>When a forecast shows "3 feet at 14 seconds + 2 feet at 7 seconds," read it as: 3-foot ground swell (the rideable waves) plus 2-foot wind swell (local texture). If it flips to "2 feet at 7 seconds only," all you've got is chop. Always focus on the longest-period component — that's the best swell. As you build forecasting skills, you'll start tracking distant storms on charts and predicting when ground swells will arrive 5-7 days out. That forward-thinking is how locals always seem to know when the next good swell is coming.</p>`,
        keyTakeaway:
          "In a forecast with multiple swells, the longest-period component is ground swell and produces the best waves; short-period is wind swell and local chop.",
      },
    ],
    faqs: [
      {
        question: "Can ground swell and wind swell mix in the water?",
        answer:
          "Yes, always. Most days you have both at the same time. The ground swell creates the main peeling waves, and the wind swell adds texture and extra sets in between. Experienced surfers learn to read which waves are which and focus on catching the ground swell.",
      },
      {
        question: "How do I tell the difference in the water?",
        answer:
          "Ground swell has consistent set patterns and long lulls between. Wind swell is constant texture with no clear sets. Ground swell waves all break similarly; wind swell waves break from many directions. After one session, you'll recognize the difference automatically.",
      },
      {
        question: "Is a 10-foot wind swell ever better than a 2-foot ground swell?",
        answer:
          "Rarely. Big wind swell is entertaining because there's volume, but the rides are lower quality. A 2-foot ground swell at your reef break will have more structured, rideable waves than 10-foot wind swell. Experienced surfers choose the smaller but longer-period option almost always.",
      },
      {
        question: "Where do I check for incoming ground swells?",
        answer:
          "Surf forecast models show swell components. Quiver displays both primary (ground) and secondary (wind) swells. You can also check synoptic weather maps to see where storms are forming. Southern Hemisphere and North Pacific storms typically generate the best swells to North America.",
      },
      {
        question: "Why do forecasters separate ground swell and wind swell?",
        answer:
          "Because they behave differently and arrive at different times. Wind swell shows up immediately and disappears fast. Ground swell takes days to arrive but lasts longer. Separating them lets surfers plan ahead and understand what's really driving the session.",
      },
    ],
    relatedLinks: [
      {
        label: "Swell Period Explained",
        href: "/learn/swell-period-explained",
        description:
          "Period is the key metric that reveals whether swell is ground or wind-generated.",
      },
      {
        label: "How to Read a Surf Forecast",
        href: "/learn/how-to-read-a-surf-forecast",
        description:
          "Learn to read multiple swell components and understand what each means.",
      },
      {
        label: "How Surf Forecasts Work",
        href: "/learn/how-surf-forecasts-work",
        description:
          "Understand how wave models predict ground swell components.",
      },
    ],
  },

  {
    slug: "how-surf-forecasts-work",
    title: "How Surf Forecasts Work",
    description: "From weather satellites to your phone: NOAA models, buoy networks, and ML corrections that power accurate wave predictions.",
    readingTimeMin: 5,
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
          src: "/images/buoy.png",
          alt: "NOAA ocean buoy measuring wave conditions",
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
        label: "How to Read a Surf Forecast",
        href: "/learn/how-to-read-a-surf-forecast",
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
];
