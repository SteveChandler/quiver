/**
 * City Content Generator
 *
 * Auto-generates data-driven summary text and FAQ items for city listing pages.
 * Designed to add 200-400 words of unique, indexable content per page to
 * address Google's "Discovered - Not Indexed" issue on thin listing pages.
 */

import type { BeachWithMetrics, LocationStats } from "@/types/location";
import type { FAQItem } from "@/lib/utils/beach-faq-utils";
import { getRegionalData } from "@/lib/seo/regional-surf-data";
import { countValues, pluralize, joinList } from "@/lib/seo/content-helpers";
import type { RichContent } from "@/lib/seo/rich-content";
import { linkFirstMentions } from "@/lib/seo/rich-content";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";

/** FAQ item with rich-content answer that can include internal links. */
export interface RichFAQItem {
  question: string;
  answer: string;
  richAnswer: RichContent;
}

export interface CityContentInput {
  cityName: string;
  stateName: string;
  stateSlug: string;
  stats: LocationStats;
  beaches: BeachWithMetrics[];
}

/**
 * Generate both summary and FAQ in one pass, avoiding duplicate countValues calls.
 */
export function generateCityContent(input: CityContentInput): {
  summary: string;
  faqs: FAQItem[];
} {
  const { cityName, stateName, stateSlug, stats, beaches } = input;

  // Shared computation — used by both summary and FAQ
  const skillCounts = countValues(beaches.map((b) => b.skill_level));
  const regional = getRegionalData(stateSlug);

  return {
    summary: buildSummary({ cityName, stateName, stats, beaches, skillCounts, regional }),
    faqs: buildFAQ({ cityName, stateSlug, stats, beaches, skillCounts, regional }),
  };
}

/**
 * Generate rich content (with internal links) for both summary and FAQ.
 *
 * Beach names in the summary and FAQ answers are converted to links
 * pointing to the beach detail pages. Only the first mention of each
 * beach name is linked per section.
 */
export function generateCityRichContent(input: CityContentInput): {
  summary: RichContent;
  faqs: RichFAQItem[];
} {
  const { cityName, stateName, stateSlug, stats, beaches } = input;

  const skillCounts = countValues(beaches.map((b) => b.skill_level));
  const regional = getRegionalData(stateSlug);

  const plainSummary = buildSummary({ cityName, stateName, stats, beaches, skillCounts, regional });
  const plainFaqs = buildFAQ({ cityName, stateSlug, stats, beaches, skillCounts, regional });

  // Build name -> href pairs for beaches that have valid URLs
  const beachLinks = beaches
    .filter((b) => b.slug && b.city && b.state)
    .map((b) => ({
      name: b.name,
      href: buildBeachUrl({ slug: b.slug, city: b.city, state: b.state, country: b.country }),
    }));

  const richSummary = linkFirstMentions(plainSummary, beachLinks);

  const richFaqs: RichFAQItem[] = plainFaqs.map((faq) => ({
    question: faq.question,
    answer: faq.answer,
    richAnswer: linkFirstMentions(faq.answer, beachLinks),
  }));

  return { summary: richSummary, faqs: richFaqs };
}

// ---------------------------------------------------------------------------
// Internal builders
// ---------------------------------------------------------------------------

interface BuildContext {
  cityName: string;
  stats: LocationStats;
  beaches: BeachWithMetrics[];
  skillCounts: Record<string, number>;
  regional: ReturnType<typeof getRegionalData>;
}

function buildSummary(
  ctx: BuildContext & { stateName: string }
): string {
  const { cityName, stateName, stats, beaches, skillCounts, regional } = ctx;
  const sentences: string[] = [];

  // Sentence 1: Beach count + skill level distribution
  const skillParts: string[] = [];
  if (skillCounts["Beginner"]) skillParts.push(`${skillCounts["Beginner"]} beginner-friendly`);
  if (skillCounts["Intermediate"]) skillParts.push(`${skillCounts["Intermediate"]} intermediate`);
  if (skillCounts["Advanced"]) skillParts.push(`${skillCounts["Advanced"]} advanced`);

  if (skillParts.length > 0) {
    const skillTotal = Object.values(skillCounts).reduce((a, b) => a + b, 0);
    sentences.push(
      `${cityName} has ${stats.totalBeaches} surf ${pluralize("spot", stats.totalBeaches)} across ${stateName}, including ${joinList(skillParts)} ${pluralize("break", skillTotal)}.`
    );
  } else {
    sentences.push(
      `${cityName} has ${stats.totalBeaches} surf ${pluralize("spot", stats.totalBeaches)} in ${stateName}.`
    );
  }

  // Sentence 2: Break type distribution
  const breakCounts = countValues(beaches.map((b) => b.break_type));
  const breakParts: string[] = [];
  for (const [type, count] of Object.entries(breakCounts)) {
    breakParts.push(`${count} ${type.toLowerCase()} ${pluralize("break", count)}`);
  }
  if (breakParts.length > 0) {
    sentences.push(`Wave types include ${joinList(breakParts)}.`);
  }

  // Sentence 3: Water temp + wetsuit from regional data
  if (regional) {
    sentences.push(
      `Water temperatures range from ${regional.waterTempRange}\u00B0F, with ${regional.winterWetsuit} recommended in winter and ${regional.summerWetsuit} in summer.`
    );
  }

  // Sentence 4: Top beach name + rating
  const topBeach = beaches[0];
  if (topBeach && topBeach.average_rating && topBeach.average_rating > 0) {
    sentences.push(
      `The top-rated spot is ${topBeach.name}, rated ${topBeach.average_rating.toFixed(1)} out of 5 by the surf community.`
    );
  } else if (topBeach) {
    sentences.push(
      `${topBeach.name} ranks as the top spot in ${cityName}.`
    );
  }

  return sentences.join(" ");
}

function buildFAQ(
  ctx: BuildContext & { stateSlug: string }
): FAQItem[] {
  const { cityName, stats, beaches, skillCounts, regional } = ctx;
  const faqs: FAQItem[] = [];

  // FAQ 1: How many surf spots?
  const skillDetail: string[] = [];
  if (skillCounts["Beginner"]) skillDetail.push(`${skillCounts["Beginner"]} beginner`);
  if (skillCounts["Intermediate"]) skillDetail.push(`${skillCounts["Intermediate"]} intermediate`);
  if (skillCounts["Advanced"]) skillDetail.push(`${skillCounts["Advanced"]} advanced`);

  faqs.push({
    question: `How many surf spots are in ${cityName}?`,
    answer: `${cityName} has ${stats.totalBeaches} surf ${pluralize("spot", stats.totalBeaches)}.${
      skillDetail.length > 0
        ? ` They break down by skill level: ${joinList(skillDetail)}.`
        : ""
    }`,
  });

  // FAQ 2: Best surf spot
  const top3 = beaches.slice(0, 3);
  if (top3.length > 0) {
    const top3Descriptions = top3.map((b, i) => {
      const rating = b.average_rating && b.average_rating > 0
        ? ` (${b.average_rating.toFixed(1)}/5)`
        : "";
      return `${i + 1}. ${b.name}${rating}`;
    });
    faqs.push({
      question: `What is the best surf spot in ${cityName}?`,
      answer: `The top-ranked surf spots in ${cityName} are: ${top3Descriptions.join(", ")}. Rankings are based on community ratings, reviews, and recent surf intel.`,
    });
  }

  // FAQ 3: Good for beginners?
  const beginnerCount = skillCounts["Beginner"] || 0;
  if (beginnerCount > 0) {
    const beginnerNames = beaches
      .filter((b) => b.skill_level === "Beginner")
      .slice(0, 3)
      .map((b) => b.name);
    faqs.push({
      question: `Is ${cityName} good for beginner surfers?`,
      answer: `Yes, ${cityName} has ${beginnerCount} beginner-friendly ${pluralize("spot", beginnerCount)}, including ${joinList(beginnerNames)}. These spots offer gentler waves suitable for learning.`,
    });
  } else {
    faqs.push({
      question: `Is ${cityName} good for beginner surfers?`,
      answer: `${cityName}'s surf spots are generally suited for intermediate to advanced surfers. Beginners should check individual spot reports for days with smaller, mellower conditions.`,
    });
  }

  // FAQ 4: Wetsuit recommendation
  if (regional) {
    faqs.push({
      question: `What wetsuit do I need to surf in ${cityName}?`,
      answer: `Water temperatures in the area range from ${regional.waterTempRange}\u00B0F. In summer, ${regional.summerWetsuit} is typical. In winter, bring ${regional.winterWetsuit}.${
        regional.trunksSeason
          ? ` You can go with just trunks ${regional.trunksSeason}.`
          : ""
      }`,
    });
  } else {
    faqs.push({
      question: `What wetsuit do I need to surf in ${cityName}?`,
      answer: `Wetsuit requirements vary by season. Check the latest water temperature data on our forecast page for current recommendations.`,
    });
  }

  return faqs;
}
