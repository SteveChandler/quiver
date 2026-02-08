/**
 * State Content Generator
 *
 * Auto-generates data-driven summary text and FAQ items for state listing pages.
 * Designed to add 200-400 words of unique, indexable content per page to
 * address Google's "Discovered - Not Indexed" issue on thin listing pages.
 */

import type { Beach } from "@/types/database";
import type { FAQItem } from "@/lib/utils/beach-faq-utils";
import { getRegionalData } from "@/lib/seo/regional-surf-data";
import { countValues, pluralize, joinList } from "@/lib/seo/content-helpers";

export interface StateContentInput {
  stateName: string;
  stateSlug: string;
  beaches: Beach[];
  cityCount: number;
}

/**
 * Generate a 3-5 sentence data-driven summary for a state listing page.
 *
 * Returns a sensible fallback when `beaches` is empty (e.g. when the
 * beach query fails but the city list loaded successfully).
 */
export function generateStateSummary(input: StateContentInput): string {
  const { stateName, stateSlug, beaches, cityCount } = input;
  const sentences: string[] = [];
  const total = beaches.length;
  const regional = getRegionalData(stateSlug);

  // Guard: if no beach data loaded, produce a useful but honest summary
  if (total === 0) {
    sentences.push(
      `Explore surf cities across ${stateName}. Tap a city to see a ranked list of beaches with ratings and current conditions.`
    );
    if (regional) {
      sentences.push(
        `Water temperatures range from ${regional.waterTempRange}\u00B0F throughout the year.`
      );
    }
    return sentences.join(" ");
  }

  // Sentence 1: Total beaches + city count
  sentences.push(
    `${stateName} has ${total} surf ${pluralize("spot", total)} across ${cityCount} ${pluralize("city", cityCount)}.`
  );

  // Sentence 2: Skill level distribution
  const skillCounts = countValues(beaches.map((b) => b.skill_level));
  const beginnerCount = skillCounts["Beginner"] || 0;
  if (beginnerCount > 0) {
    const pct = Math.round((beginnerCount / total) * 100);
    sentences.push(
      `About ${pct}% of spots are beginner-friendly, making ${stateName} ${pct >= 30 ? "a great" : "a viable"} destination for surfers of all levels.`
    );
  } else {
    sentences.push(
      `Most spots in ${stateName} are suited for intermediate to advanced surfers.`
    );
  }

  // Sentence 3: Break type distribution
  const breakCounts = countValues(beaches.map((b) => b.break_type));
  const breakParts: string[] = [];
  for (const [type, count] of Object.entries(breakCounts)) {
    breakParts.push(`${type.toLowerCase()} ${pluralize("break", count)} (${count})`);
  }
  if (breakParts.length > 0) {
    sentences.push(`Wave types include ${joinList(breakParts)}.`);
  }

  // Sentence 4-5: Water temp + wetsuit from regional data
  if (regional) {
    sentences.push(
      `Water temperatures range from ${regional.waterTempRange}\u00B0F throughout the year.`
    );
    sentences.push(
      `In summer, ${regional.summerWetsuit} is typical; in winter, ${regional.winterWetsuit} is recommended.`
    );
  }

  return sentences.join(" ");
}

/**
 * Generate 4 FAQ items for a state listing page.
 */
export function generateStateFAQ(input: StateContentInput): FAQItem[] {
  const { stateName, stateSlug, beaches, cityCount } = input;
  const faqs: FAQItem[] = [];
  const total = beaches.length;

  // FAQ 1: How many surf spots in this state?
  faqs.push({
    question: `How many surf spots are in ${stateName}?`,
    answer: total > 0
      ? `${stateName} has ${total} documented surf ${pluralize("spot", total)} spread across ${cityCount} coastal ${pluralize("city", cityCount)}. Each city page includes a ranked list of beaches with ratings and current conditions.`
      : `${stateName} has surf spots spread across ${cityCount} coastal ${pluralize("city", cityCount)}. Tap a city to see a ranked list of beaches with ratings and current conditions.`,
  });

  // FAQ 2: Best time to surf
  const regional = getRegionalData(stateSlug);
  if (regional) {
    faqs.push({
      question: `When is the best time to surf in ${stateName}?`,
      answer: `Water is warmest in ${regional.warmestMonth} and coldest in ${regional.coldestMonth}. ${
        regional.trunksSeason
          ? `You can surf in just trunks ${regional.trunksSeason}.`
          : `A wetsuit is needed year-round in ${stateName}.`
      } Check individual spot forecasts for swell-specific timing.`,
    });
  } else {
    faqs.push({
      question: `When is the best time to surf in ${stateName}?`,
      answer: `The best surf season varies by region within ${stateName}. Check our spot-level forecasts for swell timing and water temperature data.`,
    });
  }

  // FAQ 3: Wetsuit recommendation
  if (regional) {
    faqs.push({
      question: `What wetsuit do I need for surfing in ${stateName}?`,
      answer: `Water temperatures range from ${regional.waterTempRange}\u00B0F. In summer, ${regional.summerWetsuit} works well. In winter, bring ${regional.winterWetsuit}.${
        regional.trunksSeason
          ? ` Trunks are fine ${regional.trunksSeason}.`
          : ""
      }`,
    });
  } else {
    faqs.push({
      question: `What wetsuit do I need for surfing in ${stateName}?`,
      answer: `Wetsuit needs vary by season and specific coastline. Check the water temperature data on individual spot pages for the latest recommendations.`,
    });
  }

  // FAQ 4: Best beginner spots
  const skillCounts = total > 0 ? countValues(beaches.map((b) => b.skill_level)) : {};
  const beginnerCount = skillCounts["Beginner"] || 0;
  if (beginnerCount > 0) {
    const cityBeginnerCounts: Record<string, number> = {};
    for (const b of beaches) {
      if (b.skill_level === "Beginner" && b.city) {
        cityBeginnerCounts[b.city] = (cityBeginnerCounts[b.city] || 0) + 1;
      }
    }
    const topCities = Object.entries(cityBeginnerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([city, count]) => `${city} (${count} ${pluralize("spot", count)})`);

    faqs.push({
      question: `Where are the best beginner surf spots in ${stateName}?`,
      answer: `${stateName} has ${beginnerCount} beginner-friendly ${pluralize("spot", beginnerCount)}. The cities with the most learner-friendly waves are ${joinList(topCities)}. Each city page lists spots by difficulty so you can find the right wave for your level.`,
    });
  } else {
    faqs.push({
      question: `Where are the best beginner surf spots in ${stateName}?`,
      answer: `Most surf spots in ${stateName} are suited for intermediate to advanced surfers. Check individual spot reports on calmer days for beginner-appropriate conditions.`,
    });
  }

  return faqs;
}
