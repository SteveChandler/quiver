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
    readingTimeMin: 8,
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
        content: `<p>A surf forecast predicts ocean conditions at your local break: wave size, period (how far apart the waves are), wind speed, and tide. These metrics come from NOAA's WaveWatch III wave model, which runs on global weather data updated every 6 hours. The forecast doesn't predict which wave you'll catch—it predicts the raw ingredients you'll work with when you paddle out.</p><p>Quiver pulls forecasts from multiple models and combines them with observations from NDBC buoys and CDIP wave-measuring stations along your coast. This gives you both the model prediction and real buoy data so you can see how accurate the forecast has been lately. Think of a forecast as a weather report for the ocean—useful, but not perfect.</p>`,
        keyTakeaway:
          "A surf forecast predicts wave height, period, direction, and wind from NOAA models and real-time buoy observations.",
      },
      {
        id: "wave-height",
        heading: "Wave Height: Significant vs. Face Height",
        content: `<p>Wave height on a forecast usually means <strong>significant wave height</strong> (Hs)—the average of the tallest third of waves passing a point. This is what scientists measure with buoys, but it's not the same as the face height you see when paddling. A face height is roughly 1.5x to 2x the significant height because you're measuring from the back of the wave, which is taller than the average.</p><p>If a forecast says 6 feet significant wave height, expect face heights of 9 to 12 feet. Beginners often mistake significant height for face height and show up expecting smaller, softer waves than they actually get. Learn your local break's conversion factor by comparing forecasts to the actual waves you see. Sandy beaches with shifting bars convert differently than reef breaks with consistent bathymetry.</p>`,
        keyTakeaway:
          "Significant wave height (forecast) is roughly 60-70% of face height—multiply the forecast by 1.5-2x to estimate what you'll actually see.",
      },
      {
        id: "swell-period",
        heading: "Swell Period: Why Seconds Matter",
        content: `<p>Swell period is the time in seconds between consecutive wave crests. A 6-second period means one wave crest passes a fixed point every 6 seconds. A 14-second period means 14 seconds between waves. This single number tells you where the swell originated: local wind makes short periods (5-9 seconds), while distant storms make long periods (12+ seconds).</p><p>Long-period swells travel farther and retain more energy. A 14-second swell travels roughly 25 mph through deep water and maintains its shape better than a 6-second swell. In the lineup, long-period waves feel more powerful, stand up faster, and break more cleanly. A 4-foot swell at 14 seconds will be much better quality than a 4-foot swell at 6 seconds. Most forecast models show period alongside height—don't ignore it.</p>`,
        keyTakeaway:
          "Period (in seconds) is more important than height for wave quality: longer periods (12+ sec) mean cleaner, more powerful waves from distant storms.",
      },
      {
        id: "swell-direction",
        heading: "Swell Direction: Is Your Break Facing It?",
        content: `<p>Swell direction tells you which compass heading the waves are coming from. A swell from 300 degrees is approaching from the northwest. Your local break has a preferred direction—Rincon works on southwest swells, Malibu needs south to southwest, Sunset Beach wants north swells. If the forecast shows swell from a direction your break doesn't face, that break won't work, no matter the height or period.</p><p>Check your break's exposure on a map. If you face south, a north swell won't give you good waves. If you face southwest, a south swell at 200 degrees might be better than one at 180 degrees. Most forecasts show swell direction as a compass bearing (0-360) or as directional arrows. Compare the forecast direction to your break's known windows. If they don't match, paddle somewhere else—nearby breaks often face different directions.</p>`,
        keyTakeaway:
          "Swell direction only matters if your break faces it: check your beach's exposure on a map and compare to the forecast direction.",
      },
      {
        id: "wind",
        heading: "Wind Speed and Direction: Offshore vs. Onshore",
        content: `<p>Wind at the surface can make or break your session. <strong>Offshore</strong> wind blows from land to sea—it holds up the wave face, slows the breaking wave, and creates clean lines. <strong>Onshore</strong> wind blows from sea to land—it pushes the wave down, speeds up the break, and creates chop. Offshore is always better. Most surfers prefer wind speeds under 10 knots with an offshore component.</p><p>Check both wind direction and speed on your forecast. Winds under 5 knots matter less. Between 5-15 knots, direction matters a lot—offshore keeps waves shaped, onshore ruins them. Above 15 knots, even offshore wind creates too much texture. Dawn patrol sessions are prized because land cools overnight and creates offshore breezes before heating up midday. If the forecast shows onshore wind, start early or wait for the next swell.</p>`,
        keyTakeaway:
          "Offshore wind (blowing from land to sea) cleans up wave faces; onshore wind creates chop. Most breaks work best with 5-10 knot offshore winds.",
      },
      {
        id: "tide",
        heading: "Tide and How It Reshapes Your Break",
        content: `<p>Tide changes water depth, and water depth controls where waves break. At low tide, shallow reefs and sandbars create hollow, fast waves—great for experienced surfers, often dangerous for beginners. At high tide, the same break becomes slower and mushier because water is deeper. Most beach breaks work best at mid-tide, when the bar has enough water to form waves but hasn't flooded out yet.</p><p>Check your local tide table before heading out. If your break breaks best at mid-tide, arriving at low tide means you'll be paddling over dry sandbars. Some reefs only work on the rising tide. Others are surfable only in a 2-hour window around high tide. Learn your break's tidal window by paddling at different tides and noting where the peaks form. Tide forecasts are accurate to minutes—use them to time your session, not just the swell.</p>`,
        keyTakeaway:
          "Tide changes wave shape: low tide makes waves hollow and fast, high tide makes them slower, and most beaches work best at mid-tide.",
      },
      {
        id: "putting-it-together",
        heading: "Putting It All Together: Reading a Real Forecast",
        content: `<p>A complete forecast looks like this: Tuesday, 5 AM, 4 feet at 14 seconds from 230 degrees, 8 knots offshore, high tide at 7:30 AM. This tells you the swell is quality (14-second period), face height will be roughly 6-7 feet, your break faces southwest so 230 degrees is good, wind is light and offshore (best case), and tide will be high so the break will be slower than usual. Overall: go early, before the tide floods it completely.</p><p>Compare this to: Tuesday, 5 AM, 4 feet at 6 seconds from 230 degrees, 15 knots onshore, low tide at 5 AM. The 6-second period means local chop, 15 knots onshore will roughen it up, and low tide will make it hollow and fast. This is a skippable session at this break, even though the height is the same. The period, wind, and tide tell the real story. Build this habit: never read height alone—always check period, direction, and wind before committing.</p>`,
        keyTakeaway:
          "Read forecasts in order: height tells you scale, period tells you quality, direction tells you if your break works, wind tells you texture, tide tells you timing.",
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
    readingTimeMin: 7,
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
        content: `<p>Swell period is the time in seconds between two wave crests as they pass a fixed point. If you watch a buoy or a stationary surfer and count seconds between waves, that count is the period. A 6-second period means a new wave arrives every 6 seconds. A 14-second period means 14 seconds between waves. This single number encodes critical information about where the swell came from and how it will behave in your lineup.</p><p>Buoys and forecasts always measure period because it's consistent and measurable. Period doesn't change with water depth the way wavelength does. A 14-second swell remains a 14-second swell from the deep ocean all the way to shore. This makes it the most reliable indicator of swell quality in any forecast.</p>`,
        keyTakeaway:
          "Swell period is the time in seconds between consecutive wave crests passing a point.",
      },
      {
        id: "short-period",
        heading: "Short Period (5-9 seconds): Local Wind and Chop",
        content: `<p>Short-period swells come from local wind—wind blowing at your coast right now. When wind hits water, it generates random energy across many directions and periods. Most of this energy is short-period, 5-9 seconds. Short periods mean waves are close together, but they're weaker, more chaotic, and break faster.</p><p>In the water, short-period waves feel mushy and quick. They don't stand up as you paddle into them—instead they collapse fast, creating a steep takeoff but little face. You get lots of opportunities to catch waves, but fewer good rides. Short-period swells are common on calm days when local wind has been blowing overnight. They're not bad—they're just smaller, softer, and require different technique than ground swells.</p>`,
        keyTakeaway:
          "Short-period swells (5-9 sec) come from local wind and create mushy, quick-breaking waves that are close together.",
      },
      {
        id: "long-period",
        heading: "Long Period (12+ seconds): Distant Storms",
        content: `<p>Long-period swells come from distant storms thousands of miles away. When a storm churns the ocean, it generates waves across many periods, but the long-period energy escapes first. These swells travel across entire ocean basins, losing short-period energy along the way through friction and spreading. By the time a 14-second swell reaches your coast, it's traveled days and thousands of miles.</p><p>A 14-second swell travels roughly 25 mph through deep water. Longer periods mean faster travel and more organized energy. In the lineup, long-period waves stand up slower, peel for longer, and maintain power all the way through the break. You'll catch fewer waves but ride cleaner lines. Most surfers prefer long-period swells because the rides are longer and the waves feel more controlled.</p>`,
        keyTakeaway:
          "Long-period swells (12+ sec) come from distant storms, travel thousands of miles, and create organized, peeling waves.",
      },
      {
        id: "why-period-matters",
        heading: "Why Period Matters More Than Height",
        content: `<p>Height tells you scale; period tells you quality. A 2-foot swell at 16 seconds will be more fun than a 4-foot swell at 6 seconds. Why? The 16-second swell means distant organized energy, clean lines, and rideable faces. The 4-foot chop means mushy, close-together waves that collapse fast. Beginners and pros alike will choose the smaller but longer-period swell.</p><p>This is why experienced surfers obsess over period. Height is visible from the beach—you can estimate it. Period is invisible but determines rideability. A beach break with a 14-second swell at 3 feet will have packed lineups. The same beach at 4 feet and 7 seconds will be empty because locals know it's unridden chop. Period is the secret metric that separates quality sessions from blown-out days.</p>`,
        keyTakeaway:
          "A smaller swell with longer period (12+ sec) produces better waves than a bigger swell with short period (6 sec) because it means organized distant energy.",
      },
      {
        id: "fetch-and-distance",
        heading: "Period and Distance: The Fetch Law",
        content: `<p>Swell period directly correlates to how far the generating storm is from your coast. A 6-second swell was generated nearby—probably within 100 miles. An 8-second swell was generated 200-500 miles away. A 12-second swell came from 500-1500 miles away. A 16-second swell often came from the Southern Hemisphere or South Pacific, thousands of miles distant.</p><p>This relationship comes from oceanography: wind-driven waves grow in proportion to wind speed, wind duration, and fetch (distance over which wind blows). Long swells require either very strong wind or very long fetch. Most long-period swells form from major storms with sustained wind over ocean basins. When you see a 14-second period on the forecast, you're looking at a system that got organized enough to push energy across an ocean.</p>`,
        keyTakeaway:
          "Swell period indicates distance from source: 6-sec means nearby wind, 12-sec means 500+ miles away, 16-sec means thousands of miles away.",
      },
      {
        id: "reading-period",
        heading: "Reading Period on Your Forecast",
        content: `<p>Every forecast tool shows period as a single number: "4 feet at 14 seconds" or sometimes split into primary and secondary periods. The primary period is what you want to focus on—it's the dominant wavelength in the water. Some forecasts show a range, like 12-16 seconds, which means multiple swells are mixing.</p><p>As a rule: below 9 seconds is short period (local wind, mushy). 9-12 seconds is medium (decent, still some local influence). Above 12 seconds is long period (quality, distant origin). Most forecast models break down into two or three swell components, each with its own period. If you see "3 feet at 14 sec + 2 feet at 7 sec," you have a long-period ground swell mixed with short-period local wind. The long-period part is the one that'll peel nicely.</p>`,
        keyTakeaway:
          "Check period on your forecast: 9-12 sec is medium quality, 12+ sec is good, below 9 sec means mushy local chop.",
      },
      {
        id: "period-and-bathymetry",
        heading: "How Your Break's Bathymetry Interacts with Period",
        content: `<p>Period behaves differently depending on what's under the water. Sand breaks accept all periods and work okay at any swell frequency. Reef breaks are picky—some reefs work best with 12+ second periods, while others peel at 8 seconds. Sandbars migrate based on winter swells (long period) vs summer chop (short period). A bar that breaks at peak tide on a 14-second swell might be completely different at low tide on a 6-second chop.</p><p>Learn your break's preferred period by paddling it across different forecasts. Note which swells produce the best banks, the cleanest lines, and the most favourable shape. Reef breaks often prefer longer periods because the fixed underwater structure works better with more organized energy. Beach breaks are more forgiving but still have sweet spots. This local knowledge—knowing your break prefers 12+ seconds—is worth more than any forecast skill.</p>`,
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
    readingTimeMin: 8,
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
        content: `<p>The best beginner session has four conditions: small consistent waves, long swell period, light offshore wind, and mid-tide on a sandy bottom. This combination gives you soft, predictable, forgiving waves that break repeatedly in the same spot. You'll catch 10+ waves, make mistakes safely, and build muscle memory without getting worked. Real beginners don't need big waves—they need repeatable waves.</p><p>Most beginners chase big swell and get discouraged. You don't want size; you want quality. A 2-foot swell at 14 seconds in offshore wind will teach you more in one session than a 6-foot day with onshore chop. This guide breaks down each condition and shows you how to read a forecast to find it. Your local beach probably offers beginner-perfect waves 1-2 times per week if you know what to look for.</p>`,
        keyTakeaway:
          "Best beginner sessions have small consistent waves (1-3 feet), long period (12+ sec), offshore wind, and mid-tide.",
      },
      {
        id: "wave-height",
        heading: "Wave Height: 1-3 Feet (Face Height) Is Ideal",
        content: `<p>A 1-3 foot face height is perfect for beginners. This converts to roughly 0.5-2 feet significant wave height on a forecast. Why so small? Because learning to pop up, balance, and steer takes 100+ repetitions. Small waves let you catch more waves, fall safely, and practice the same move over and over. You won't get worked, which builds confidence. A 4-foot face is noticeably harder; a 6-foot face is genuinely scary when you can't paddle fast.</p><p>When checking forecasts, remember that significant height is roughly 60-70% of face height. If a forecast shows 2 feet, expect 3-4 foot faces. That's borderline for beginners—still okay if the period is long and the wind is offshore. Anything above 4 feet significant (6+ foot faces) is intermediate territory. The rule is simple: if you're not comfortable duck-diving or doing a solid bottom turn, it's too big.</p>`,
        keyTakeaway:
          "Start on 1-3 foot face height (0.5-2 feet on the forecast), which gives you safe, repeatable waves for practicing.",
      },
      {
        id: "period-for-beginners",
        heading: "Swell Period: Why Longer Period Is Actually Easier",
        content: `<p>Beginners often think longer period is scarier because bigger waves look intimidating. The opposite is true: long-period waves break slower and more predictably. A 14-second swell means you have 14 seconds between waves to paddle back out, regroup, and prepare for the next one. A 6-second swell means constant action and chaos. Long period gives you breathing room.</p><p>Long-period swells also stand up slower, giving you more time to pop up and set your line before the wave pitches. A 16-second ground swell at 2 feet feels more approachable than a 6-second wind swell at 3 feet, even though it's smaller on paper. Most beginner spots (Rincon, Waikiki, Oceanside) work best when a long-period swell is running. If your forecast shows 12+ seconds, that's your best learning window. Below 9 seconds, waves come fast and mushy—harder to catch and harder to ride.</p>`,
        keyTakeaway:
          "Long-period swells (12+ sec) break slower and more predictably, giving beginners time to set up and recover between waves.",
      },
      {
        id: "wind",
        heading: "Wind: Offshore Early Morning Is Best",
        content: `<p>Offshore wind holds up the wave face and slows the break, making it easier to pop up and control your board. Early morning is almost always offshore because land cools overnight and creates a pressure gradient that pulls wind from shore to sea. By noon, the land heats up and wind reverses to onshore. This is why every surfer wakes up at dawn—the offshore window closes fast.</p><p>Check your forecast wind direction and time it. If the forecast shows offshore wind until 10 AM, be in the water by 7 AM. Onshore winds make the same waves unrideable—chaotic, blown-out, closing out. Beginners especially need the forgiving shape that offshore gives. Even a 5-knot offshore breeze helps; 10+ knots offshore is excellent. If your forecast only shows onshore, pick a different day or find a beach that faces a different direction.</p>`,
        keyTakeaway:
          "Offshore wind holds up waves and slows breaks, making them easier to catch and control. Early morning (before heating) has the best offshore window.",
      },
      {
        id: "tide",
        heading: "Tide: Mid-Tide on Sand Is Sweet Spot",
        content: `<p>Mid-tide on a sandy bottom produces the most consistent, forgiving waves for beginners. At low tide, reefs and bars get exposed, creating hollow, fast-breaking sections that pinch out your wave. At high tide, water floods the bar and everything becomes slower and mushier. Mid-tide—roughly 3-4 hours after low or before high—creates a balanced bar shape where waves peel smoothly.</p><p>Sandy beaches are more forgiving than reefs. If you fall, sand is softer than rock. Sandbars are naturally shoaling, which means they slow waves down gradually instead of pitching them abruptly. Your local beach probably has a best tide window—learn it by paddling at different tides and noting where the peak forms. Check tide tables and plan to be in the water during the mid-tide window for your spot.</p>`,
        keyTakeaway:
          "Mid-tide on a sandy beach creates the most forgiving, consistent waves because the bar is balanced and waves slow down gradually.",
      },
      {
        id: "crowd-management",
        heading: "Crowd Management: When to Avoid the Pack",
        content: `<p>Lineups get crowded on beautiful days—offshore wind, manageable swell, light winds. This is frustrating when you're learning because you have fewer waves to catch and more people to navigate around. Crowded lineups also mean more collisions and less margin for error. As a beginner, you'll progress faster in smaller, less crowded sessions than in famous spots where 50 people are fighting for waves.</p><p>Check your forecast and paddle at off-peak times. Weekday mornings before work are quieter. Early summer swells are smaller but emptier than winter bombs. Less famous beaches at your coast often have the same conditions as the famous spot but with space to learn. You don't need the "best" wave—you need a forgiving wave with room to paddle and time to recover between attempts. After 6 months of consistent practice in smaller crowds, you'll be ready for the lineups.</p>`,
        keyTakeaway:
          "Beginners progress faster in less crowded sessions: choose weekday mornings, smaller swells, and lesser-known spots over famous beaches.",
      },
      {
        id: "using-forecast",
        heading: "Using a Forecast to Plan Your Beginner Session",
        content: `<p>Here's the checklist: (1) Height under 3 feet significant (4-5 feet face height), (2) Period 12+ seconds, (3) Offshore wind under 10 knots, (4) Mid-tide timing. When you see a forecast matching these, that's your day. Example: Tuesday, 6 AM, 1.5 feet at 14 seconds, 8 knots offshore, high tide 7:30 AM. Perfect beginner session.</p><p>Set a phone alert for days matching these conditions. Don't paddle randomly hoping it'll work out. The forecast is a tool to find the easiest days, not the biggest days. Most beginner-friendly spots have 2-4 good learning days per week if you check the forecast regularly. Use Quiver to compare your spot's conditions across the next 7 days and block out the best ones. Within a few weeks, you'll see the pattern—which swells work, which tides work, which wind windows work at your break.</p>`,
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
    readingTimeMin: 7,
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
        content: `<p><strong>Wind swell</strong> is generated by wind blowing directly at your coast right now. The wind pushes the ocean surface, creating waves locally. These waves have short periods (5-9 seconds) and disorganized energy because wind is chaotic. <strong>Ground swell</strong> (also called primary swell or ocean swell) comes from storms far away—sometimes thousands of miles. Ground swells have long periods (12+ seconds) and organized energy because they've been filtered by distance.</p><p>Every ocean has both at all times. Even on calm days, long-period ground swell is rolling in from some distant storm. When the wind picks up on your coast, wind swell gets added on top. Most forecasts show both as separate components: "4 feet at 14 seconds + 2 feet at 6 seconds." The first is ground swell, the second is wind swell. Both can contribute to your session, but ground swell is almost always the better waves.</p>`,
        keyTakeaway:
          "Wind swell is local wind generating chaotic short-period waves; ground swell is distant storms creating organized long-period waves.",
      },
      {
        id: "ground-swell-forms",
        heading: "How Ground Swells Form: Storms and Fetch",
        content: `<p>A major storm far out at sea (typhoon, nor'easter, Southern Ocean low) churns the ocean with sustained wind over huge distances (hundreds of miles of fetch). The storm generates waves across many periods, but the long-period energy travels fastest and farthest. As the swell propagates across ocean basins, short-period energy disperses and dissipates through friction, leaving behind organized long-period swell that eventually reaches your coast.</p><p>This process takes time. A storm in the Southern Ocean takes 5-7 days to reach California as a 16-second swell. A storm off Alaska takes 2-3 days to reach the West Coast. As the swell travels, it loses the short-period chop but retains the long-period core. By the time it reaches shore, it's been filtered to coherent energy across a narrow range of periods. This is why distant swells are so clean and organized.</p>`,
        keyTakeaway:
          "Ground swells form from distant storms with sustained wind over huge fetch, then travel ocean basins, losing short-period energy along the way.",
      },
      {
        id: "wind-swell-forms",
        heading: "How Wind Swells Form: Local Wind Right Now",
        content: `<p>Wind swell forms when wind blows across the ocean at your coast. The longer the wind blows and the stronger it is, the bigger the wind swell grows. But wind is chaotic—it changes direction and intensity constantly—so the waves it generates are equally chaotic. Energy is scattered across periods and directions. This is why wind swell looks messy and close-together in person.</p><p>Wind swell only lasts as long as the wind does. As soon as the wind dies, the wind-swell component drops off a forecast. Ground swell persists for days because it's self-sustaining energy traveling across the ocean. The next time you see a forecast with multiple swell components, the short-period one is always wind swell (local), and the long-period one is always ground swell (distant).</p>`,
        keyTakeaway:
          "Wind swell forms from local wind right now and disappears when wind stops; it's chaotic and short-period because energy is scattered.",
      },
      {
        id: "visual-differences",
        heading: "What Wind and Ground Swells Look Like in the Water",
        content: `<p>Ground swell creates a visual pattern: organized sets with clean spacing, long lulls between sets (the 14-second period means 14 seconds between waves), and waves that all peel in similar directions. Sets are distinct and predictable. You can see them coming from far away because the swells are long and coherent. Ground swell looks powerful and clean even when it's small.</p><p>Wind swell looks chaotic: waves from many directions arriving at random, waves very close together (6-9 second periods), and no clear sets. It's crowded texture with little organization. Even big wind swell feels mushy because energy is scattered. On the beach, you can often see the visual difference from shore: clean, organized ground swell vs. choppy, confused wind swell. Experienced surfers spot this instantly.</p>`,
        keyTakeaway:
          "Ground swell has organized sets with clean spacing; wind swell is chaotic texture from many directions.",
      },
      {
        id: "quality-comparison",
        heading: "Which Produces Better Surf and Why",
        content: `<p>Ground swell produces better surf almost always because organized energy creates predictable, shapeable waves. You can set your line before the wave even gets to your takeoff zone. The ride is longer because the wave face is stable. Ground swell also works better with reef breaks because the fixed underwater structure channels organized energy into clean peeling lines.</p><p>Wind swell rarely produces good rides because waves collapse fast and chaotically. Catching them is harder because they don't have a clear peak—energy comes from multiple directions. Even a very big wind swell (8 feet) will usually be inferior to a small ground swell (2 feet). The swell type (period) determines ridability far more than the height. This is why surfers obsess over forecasting periods and monitor swell charts that show distant storms.</p>`,
        keyTakeaway:
          "Ground swell produces better waves than wind swell because organized distant energy creates predictable, shapeable rides.",
      },
      {
        id: "when-wind-swell-is-fun",
        heading: "When Wind Swell Can Actually Be Good",
        content: `<p>Wind swell has advantages on small days and for advanced shortboarders. When ground swell is 1-2 feet and looks dead, a 3-4 foot wind swell can provide more waves and more action. Experienced shortboarders sometimes prefer wind swell because you catch more opportunities and can practice quick maneuvers. For beginners and mellow waves, wind swell is frustrating. For advanced freestyle and shortboarding, it's playful.</p><p>Wind swell also works better at certain breaks. Fast beach breaks with A-frames sometimes turn wind swell into fun peaks, even if the energy is short-period. Reef breaks struggle with wind swell because disorganized energy doesn't focus onto the reef structure. If you're comparing a 1-foot ground swell to a 4-foot wind swell at a point break, the wind swell might actually be more rideable because of the volume of waves, despite inferior quality per wave.</p>`,
        keyTakeaway:
          "Wind swell can be fun for advanced shortboarders on small days or at beach breaks, but ground swell is almost always better for wave quality.",
      },
      {
        id: "reading-both",
        heading: "Reading Both Swells in a Forecast",
        content: `<p>When a forecast shows "3 feet at 14 seconds + 2 feet at 7 seconds," interpret it as: 3-foot ground swell (the good stuff) plus 2-foot wind swell (local noise). The ground swell will produce the rideable waves. The wind swell will add mushy texture but won't be the waves you want to catch. If the forecast flips to "2 feet at 7 seconds only," all you have is wind swell—it'll be choppy and less organized.</p><p>Focus on the longest-period component in your forecast. That's always the best swell. If you have a choice between catching the ground swell or the wind swell, choose the ground swell every time. As you build forecasting skills, you'll start tracking distant storms on charts and predicting when they'll send ground swells to your coast 5-7 days out. This forward-thinking is how local surfers always seem to know when the next good swell is coming.</p>`,
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
    readingTimeMin: 9,
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
        content: `<p>A surf forecast is a pipeline: weather satellites measure wind patterns across the ocean, global computers run wind data through wave equations, buoys verify predictions in real-time, and machine learning corrects for local effects that global models miss. Every 6 hours, this happens again, refining forecasts for the next 10 days. The forecast you see in Quiver is the output of this entire system.</p><p>No single model is perfect. NOAA's WaveWatch III is accurate to about ±1-2 feet for height and ±2-3 seconds for period, 3-5 days out. Accuracy drops beyond that window. Local bathymetry, underwater canyons, and weather microclimates make the last mile unpredictable. This is why buoy observations matter: they ground-truth the model. And why Quiver adds ML corrections trained on buoy data: to fix the systematic errors the global model makes at your specific break.</p>`,
        keyTakeaway:
          "Surf forecasts combine NOAA weather models, satellite wind data, buoy observations, and ML corrections to predict waves 6-10 days out.",
      },
      {
        id: "global-models",
        heading: "Global Wave Models: WaveWatch III and WAM",
        content: `<p><strong>WaveWatch III</strong> is NOAA's global wave model. It runs on weather predictions from the GFS (Global Forecast System) and outputs wave height, period, and direction every 3 hours across the entire globe at 0.5-degree resolution (roughly 30 miles per grid point). <strong>ECMWF's WAM</strong> (Wave Analysis and Modelling) is the European alternative—similarly accurate, slightly different physics. Both models use identical inputs: wind speed, wind direction, and fetch (distance wind can blow).</p><p>These models solve wave equations across ocean basins. Wind generates waves; existing swells travel and decay; swell interacts with bathymetry at continental shelves. The models track multiple swell components separately (ground swell, wind swell, etc.) and output them as combined forecasts. WaveWatch III is updated every 6 hours with new weather data. Quiver displays WaveWatch III primarily because it's publicly available and accurate for North America, with European models as comparison.</p>`,
        keyTakeaway:
          "WaveWatch III is NOAA's global model predicting waves at 0.5-degree resolution every 3 hours using satellite wind data.",
      },
      {
        id: "buoy-networks",
        heading: "Buoy Networks: NDBC and CDIP Ground-Truth the Models",
        content: `<p><strong>NDBC</strong> (National Data Buoy Center) maintains roughly 80 buoys offshore along US coasts. These measure wave height, period, direction, wind, and temperature every hour. <strong>CDIP</strong> (Coastal Data Information Program) operates denser networks near Southern California, Hawaii, and other key areas with directional wave sensors giving finer detail. Buoys are the ground truth: if WaveWatch III predicts 4 feet at 12 seconds but the nearest buoy shows 2.5 feet at 10 seconds, the model is wrong at that location.</p><p>Quiver and every major surf forecast pulls NDBC data in real-time. You see both the model prediction (WaveWatch III) and the actual observation (buoy) side-by-side on the forecast card. This comparison tells you how accurate the model is being at your break. If the model consistently over-predicts, you know to discount it slightly. If a CDIP buoy sits right at your break, use that observation as ground truth—ignore the global model if they disagree.</p>`,
        keyTakeaway:
          "NDBC and CDIP buoys measure real waves every hour across US coasts, providing ground-truth observations that verify and correct global models.",
      },
      {
        id: "nearshore-problem",
        heading: "The Nearshore Problem: Why Models Miss the Last Mile",
        content: `<p>Global models run at 0.5-degree resolution (roughly 30 miles per grid point). Your local beach is much smaller than 30 miles. WaveWatch III's grid point might be 20 miles offshore and misses crucial local details: underwater canyons that focus swell, headlands that block it, beach slope that changes how waves break, and coastal wind patterns that differ from open-ocean wind. This is the "last mile problem"—the model is good across ocean basins but not good at your specific break.</p><p>A swell approaching perpendicular to a coast gets the full energy. The same swell hitting at an angle gets partially shadowed by headlands. A deep canyon offshore focuses energy and amplifies waves locally. A shallow bar kills them. WaveWatch III doesn't see these—it just knows wind and general bathymetry. This is why global models are frequently off at your break, sometimes by 1-2 feet or entire wave quality. Buoys help, but buoys are sparse. Quiver's ML system is designed specifically to learn these local patterns.</p>`,
        keyTakeaway:
          "Global models miss local bathymetry, underwater canyons, and coastal wind effects because they operate at 30-mile resolution; buoys and ML corrections fix this.",
      },
      {
        id: "ml-corrections",
        heading: "How Quiver Improves Accuracy: ML Trained on Real Observations",
        content: `<p>Quiver's ML system trains on years of historical buoy observations and WaveWatch III predictions. It learns: when WaveWatch III predicts 4 feet at your break, actual observations show 3.5 feet on average (the model over-predicts by 0.5 feet). It learns: during offshore wind, model predictions are more accurate; during onshore, less accurate. It learns: certain swell directions interact with your local bathymetry to amplify or reduce height.</p><p>These patterns are unique to each break. Rincon's underwater topography means certain swells get focused and amplified. Malibu's reef breaks down swell differently. The ML system builds a location-specific correction layer that adjusts the global model based on what actually happens at that spot. This is why Quiver's forecast is often more accurate than pure WaveWatch III: it combines global physics with local observations.</p>`,
        keyTakeaway:
          "Quiver uses machine learning trained on historical buoy observations to correct WaveWatch III predictions for local bathymetry and coastal effects.",
      },
      {
        id: "accuracy-timeline",
        heading: "Forecast Accuracy by Timeline",
        content: `<p>WaveWatch III is accurate to ±1-2 feet height and ±2-3 seconds period for 0-3 days out. That's the sweet spot—weather is relatively predictable. 3-5 days out, accuracy degrades to ±2-3 feet and ±3-5 seconds. Beyond 7 days, weather chaos means forecasts are rough estimates. No model reliably predicts exact conditions more than 10 days out. This is why the best sessions are usually booked by checking the 3-5 day window, not looking 10 days ahead.</p><p>When a forecast shows 10 days of predictions, the far ones are educated guesses. Use them to track storm systems and upcoming swell trends (is a big swell coming?), not to book a session. Quiver shows forecasts out to 10 days for trend planning but highlights the 0-3 day confident window. Check the forecast every day—by day 3, you'll have much better detail on whether that predicted swell is really coming.</p>`,
        keyTakeaway:
          "Wave model accuracy is ±1-2 feet for 0-3 days out, ±2-3 feet for 3-7 days, and rough estimates beyond 7 days.",
      },
      {
        id: "where-models-struggle",
        heading: "Where Forecasts Still Struggle and How to Account for It",
        content: `<p>Models struggle with: extreme coastal wind effects (sea breezes, katabatic winds), microscale topography (small headlands, rock outcrops), rapid weather changes (cold fronts moving faster than modeled), and human-scale bathymetry (sandbars shifting week-to-week). If your forecast predicts offshore wind but a cold front is moving through faster than modeled, you might get onshore instead. If a sandbar shifted this week, the wave break zone changed but the model doesn't know.</p><p>Account for these by: (1) checking NDBC buoys 1-3 hours before your session (real-time data trumps forecast), (2) watching for buoy observations that diverge from forecast (red flag that something local is different), (3) learning your break's seasonal patterns (winter bar shape vs summer), (4) talking to locals who paddle daily and know the recent shifts. A forecast is a guide, not truth. Ground-truth it against real observations before committing to a session.</p>`,
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
