/**
 * Intent FAQ Generator
 * Generates SEO-friendly FAQ content for intent pages
 */

import type { SurfIntentSlug } from "@/lib/data/surf-spots";
import { getRegionalData } from "@/lib/seo/regional-surf-data";

export interface FAQItem {
  question: string;
  answer: string;
}

/**
 * Generate FAQ items for a specific intent and location
 * @param intent - The surf intent slug
 * @param locationName - Name of the city or state
 * @param topSpots - Array of top spot names (up to 3 will be used)
 * @param stateSlug - Optional state slug for regional data (e.g., "ca", "hi")
 * @returns Array of FAQ items suitable for FAQSchema component
 */
export function generateIntentFAQ(
  intent: SurfIntentSlug,
  locationName: string,
  topSpots: string[],
  stateSlug?: string
): FAQItem[] {
  const spotList = topSpots.slice(0, 3).join(", ");
  const hasSpots = topSpots.length > 0;
  const regional = stateSlug ? getRegionalData(stateSlug) : null;

  const faqs: Record<SurfIntentSlug, FAQItem[]> = {
    beginner: [
      {
        question: `What are the best beginner surf spots in ${locationName}?`,
        answer: hasSpots
          ? `The top beginner-friendly surf spots in ${locationName} include ${spotList}. These spots feature gentle waves, sandy bottoms, and manageable crowds, making them ideal for learning to surf.`
          : `${locationName} offers several beginner-friendly surf spots with gentle waves and sandy bottoms that are ideal for learning to surf.`,
      },
      {
        question: `Is ${locationName} good for learning to surf?`,
        answer: `Yes! ${locationName} offers excellent conditions for learning to surf with consistent small waves, surf schools, and beginner-friendly beaches. The area is known for its welcoming surf community and accessible beach breaks.`,
      },
      {
        question: `Do I need a wetsuit for surfing in ${locationName}?`,
        answer: regional
          ? `Wetsuit requirements in ${locationName} vary by season. Summer typically calls for ${regional.summerWetsuit}, while winter requires ${regional.winterWetsuit}. Water temperatures range from ${regional.waterTempRange}\u00B0F throughout the year.`
          : `Wetsuit requirements in ${locationName} vary by season. Summer typically requires a spring suit or just board shorts, while winter calls for a full 3/2mm or 4/3mm wetsuit depending on water temperature.`,
      },
    ],
    "least-crowded": [
      {
        question: `Where can I find uncrowded waves in ${locationName}?`,
        answer: hasSpots
          ? `Less crowded surf spots in ${locationName} include ${spotList}. Early mornings and weekdays offer the best chance for empty lineups and more waves to yourself.`
          : `${locationName} has several less crowded surf spots. Early mornings and weekdays offer the best chance for empty lineups and more waves to yourself.`,
      },
      {
        question: `What time of day is least crowded for surfing in ${locationName}?`,
        answer: `Early morning dawn patrol sessions (before 8 AM) and weekday afternoons are typically the least crowded times to surf in ${locationName}. Weekends and holidays see the biggest crowds, especially from 9 AM to 2 PM.`,
      },
      {
        question: `How do I avoid crowds at popular ${locationName} surf spots?`,
        answer: `To avoid crowds in ${locationName}, try surfing during off-peak hours, explore lesser-known breaks, check conditions midweek, and be flexible with your surf schedule. Local knowledge and timing around tide changes can also help you find emptier lineups.`,
      },
    ],
    tide: [
      {
        question: `What's the best tide for surfing in ${locationName}?`,
        answer: `Tide preferences vary by spot in ${locationName}. Generally, incoming mid-tides work well for most beaches, offering a good balance of wave shape and power. Check individual spot guides for specific tide recommendations.`,
      },
      {
        question: `How do tides affect surfing conditions in ${locationName}?`,
        answer: `Tides significantly impact surf conditions in ${locationName}. Low tide can expose reefs and sandbars creating hollow waves, while high tide often creates softer, more forgiving waves. Mid-tide transitions typically offer the most consistent conditions.`,
      },
      {
        question: `Where can I check tide charts for ${locationName}?`,
        answer: `You can check tide charts for ${locationName} on Quiver's surf forecast pages, NOAA tide predictions, or various surf forecast apps. Quiver provides real-time tide information integrated with surf conditions for accurate session planning.`,
      },
    ],
    "water-temp": [
      {
        question: `What wetsuit do I need for ${locationName}?`,
        answer: regional
          ? `Water temperatures in ${locationName} typically range from ${regional.waterTempRange}\u00B0F. For summer, ${regional.summerWetsuit} is recommended. In winter, you'll want ${regional.winterWetsuit}. Spring and fall may require adjusting based on your cold tolerance.`
          : `Water temperatures in ${locationName} typically range from 55-70\u00B0F. A 3/2mm wetsuit works for summer, while 4/3mm is recommended for winter. Spring and fall may require a 4/3mm or 3/2mm depending on your cold tolerance.`,
      },
      {
        question: `What is the water temperature in ${locationName} right now?`,
        answer: regional
          ? `Water temperatures in ${locationName} vary by season, ranging from ${regional.waterTempRange}\u00B0F. Check Quiver's live water temperature data for real-time readings at specific surf spots. Temperatures are typically warmest around ${regional.warmestMonth} and coldest in ${regional.coldestMonth}.`
          : `Water temperatures in ${locationName} vary by season. Check Quiver's live water temperature data for real-time readings at specific surf spots. Temperatures are typically warmest in late summer (68-72\u00B0F) and coldest in winter (55-60\u00B0F).`,
      },
      {
        question: `Does ${locationName} get warm enough to surf without a wetsuit?`,
        answer: regional
          ? regional.trunksSeason
            ? `Yes! During ${regional.trunksSeason}, water temperatures in ${locationName} are warm enough to surf in boardshorts. Outside that window, ${regional.summerWetsuit} is a good baseline for comfortable sessions.`
            : `Water temperatures in ${locationName} range from ${regional.waterTempRange}\u00B0F, so most surfers wear at least ${regional.summerWetsuit} even in summer. A wetsuit is recommended year-round for longer sessions and early morning surfs.`
          : `During peak summer months, water temperatures in ${locationName} can reach 68-72\u00B0F, making it possible to surf in board shorts or a spring suit. However, most surfers prefer at least a spring suit for longer sessions and early morning surfs.`,
      },
    ],
    longboard: [
      {
        question: `Where are the best longboard spots in ${locationName}?`,
        answer: hasSpots
          ? `Great longboard spots in ${locationName} include ${spotList}. Look for peeling point breaks and gentle beach breaks with long shoulders.`
          : `${locationName} offers several longboard-friendly spots with peeling point breaks and gentle beach breaks that provide long shoulders for trimming and noseriding.`,
      },
      {
        question: `What makes a good longboard wave?`,
        answer: `Ideal longboard waves have gentle shoulders, a mellow takeoff, and long walls to trim. The best spots feature point breaks or sandbars that create peeling waves.`,
      },
    ],
    "dawn-patrol": [
      {
        question: `What time should I surf for dawn patrol in ${locationName}?`,
        answer: `Dawn patrol in ${locationName} typically starts at first light, around 30 minutes before sunrise. This gives you the glassiest conditions before onshore winds develop.`,
      },
      {
        question: `Why is dawn patrol the best time to surf?`,
        answer: `Early morning offers glassy conditions, fewer crowds, and calmer winds. Water temperature is also warmer relative to air temperature at sunrise.`,
      },
    ],
    sunset: [
      {
        question: `What are the best sunset surf spots in ${locationName}?`,
        answer: hasSpots
          ? `The best sunset sessions in ${locationName} are at ${spotList}. These spots offer stunning golden hour views while you ride.`
          : `${locationName} has several west-facing beaches that offer stunning golden hour sessions during sunset.`,
      },
      {
        question: `Is sunset a good time to surf?`,
        answer: `Yes! Afternoon often brings cleaner conditions as morning onshore winds die down. Plus, the golden hour light and fewer crowds make for magical sessions.`,
      },
    ],
  };

  return faqs[intent] || [];
}
