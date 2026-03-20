/**
 * FAQ Schema Component
 * Provides structured data for FAQ sections to enhance SEO with rich snippets
 */

import type { RichContent } from "@/lib/seo/rich-content";

interface FAQItem {
  question: string;
  answer: string;
}

/** FAQ item with optional rich-content answer containing internal links. */
export interface RichFAQItem extends FAQItem {
  richAnswer?: RichContent;
}

interface FAQSchemaProps {
  items: FAQItem[] | RichFAQItem[];
}

export function FAQSchema({ items }: FAQSchemaProps) {
  const faqStructuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(faqStructuredData),
      }}
    />
  );
}

// FAQSection is now in ./faq-section.tsx (client component with accordion).
// Re-export for backwards compatibility.
export { FAQSection } from "./faq-section";

/**
 * Beach-specific FAQ Schema for individual beach pages
 * Targets common search queries: tide times, water temp, wave size
 */
export function BeachFAQSchema({ beachName }: { beachName: string }) {
  const faqItems: FAQItem[] = [
    {
      question: `What are the tide times at ${beachName} today?`,
      answer: `View today's high and low tide times at ${beachName} on our tide chart. Updated daily with hourly predictions and optimal surf windows.`,
    },
    {
      question: `What is the water temperature at ${beachName}?`,
      answer: `Check the current water temperature at ${beachName}. We provide real-time conditions and wetsuit recommendations based on seasonal trends.`,
    },
    {
      question: `What size waves at ${beachName} right now?`,
      answer: `See live wave height and surf conditions at ${beachName}. Our forecast is updated throughout the day with swell direction, period, and wind data.`,
    },
    {
      question: `Is ${beachName} good for beginners?`,
      answer: `Check our surf report for ${beachName} to see current conditions and crowd levels. We include skill level recommendations and the best times to paddle out.`,
    },
  ];

  return <FAQSchema items={faqItems} />;
}

/**
 * Tide-specific FAQ Schema for tide sub-pages
 * Targets high-intent queries like "what time is high tide" and "best tide for surfing"
 * These are the exact questions GSC shows with >100 impressions and 0 clicks on tide pages.
 */
export function TideFAQSchema({ beachName }: { beachName: string }) {
  const faqItems: FAQItem[] = [
    {
      question: `What time is high tide at ${beachName} today?`,
      answer: `Today's high and low tide times for ${beachName} are shown on our interactive tide chart, updated every 3 hours with precise hourly predictions. The chart also highlights the optimal surf windows around each tide extreme.`,
    },
    {
      question: `What's the best tide for surfing at ${beachName}?`,
      answer: `The best tide for surfing at ${beachName} depends on the break type. Our tide chart includes surf window analysis that identifies the 2–3 hour windows each day when tide direction and height combine for the best conditions. Check the 7-day outlook to plan sessions in advance.`,
    },
    {
      question: `How accurate are the tide predictions for ${beachName}?`,
      answer: `Tide predictions for ${beachName} are sourced from NOAA harmonic tide tables and are highly accurate (typically within a few minutes). Our forecast also factors in local conditions like swell, wind, and how the tide interacts with the specific break.`,
    },
    {
      question: `What wetsuit do I need for ${beachName}?`,
      answer: `Wetsuit recommendations for ${beachName} are based on real-time water temperature from the nearest CDIP or NDBC buoy. Check the water temperature page for ${beachName} to get today's reading and a gear recommendation.`,
    },
  ];

  return <FAQSchema items={faqItems} />;
}

/**
 * Water temperature-specific FAQ Schema for water-temp sub-pages
 * Targets gear-planning queries that pull users deeper into Quiver's unique value.
 */
export function WaterTempFAQSchema({ beachName }: { beachName: string }) {
  const faqItems: FAQItem[] = [
    {
      question: `What wetsuit do I need for ${beachName}?`,
      answer: `The wetsuit recommendation for ${beachName} is based on today's live water temperature from the nearest buoy. Visit the ${beachName} water temperature page for the current reading and a specific wetsuit thickness recommendation (e.g., 3/2mm, 4/3mm, or boardshorts).`,
    },
    {
      question: `What is the water temperature at ${beachName} right now?`,
      answer: `Current water temperature at ${beachName} is sourced from CDIP and NDBC buoy networks and updated multiple times per day. The page also shows seasonal trends and monthly averages so you can plan trips in advance.`,
    },
    {
      question: `Is the water warm enough to surf without a wetsuit at ${beachName}?`,
      answer: `Whether you need a wetsuit at ${beachName} depends on the current water temperature. In summer at warmer breaks, boardshorts may suffice above ~70°F. In colder months or at northern beaches, a 3/2mm–5/4mm fullsuit is typically required. Check the current reading on the ${beachName} water temperature page for a specific recommendation.`,
    },
    {
      question: `What time of year is the water warmest at ${beachName}?`,
      answer: `Water temperature at ${beachName} typically peaks in late summer (August–October) and drops to its coldest in late winter (February–March). The monthly averages chart on the ${beachName} water temperature page shows the full seasonal pattern so you can plan your trip.`,
    },
  ];

  return <FAQSchema items={faqItems} />;
}

/**
 * Quiver-specific FAQ Schema for Landing Page
 */
export function QuiverFAQSchema() {
  const faqItems: FAQItem[] = [
    {
      question: "What is Quiver?",
      answer:
        "Quiver is a free surf report and forecast app that tells you when to go surfing at your beach. It uses real buoy data from CDIP, NDBC, and IOOS networks to build a forecast model for each of its 279+ beaches across California, Hawaii, Oregon, Washington, Florida, the East Coast, and Puerto Rico. The forecast updates every 3 hours and gets more accurate as surfers log sessions and report conditions. Features include surf reports, tide charts, crowd data, best-time-to-surf windows, session tracking, and a surf community — all free.",
    },
    {
      question: "How do I track surf sessions on Quiver?",
      answer:
        "Tracking sessions is easy! Log in to your account, navigate to the journal section, and either plan a future session or log a completed one. Record details like beach location, conditions, wave quality, duration, and even add photos. Your sessions build your surf journal over time.",
    },
    {
      question: "How do I find surf buddies?",
      answer:
        "Finding surf buddies is one of Quiver's core features. Browse the community feed to see other surfers' sessions, follow surfers who frequent your favorite spots, and connect through planned sessions. You can also check who's surfing at specific beaches and join them.",
    },
    {
      question: "Is Quiver free to use?",
      answer:
        "Yes! Quiver is completely free to use. You can track unlimited sessions, connect with surfers, access forecasts, and discover new surf spots without any cost. We're focused on building the best surf community first.",
    },
    {
      question: "How accurate are the surf forecasts?",
      answer:
        "Quiver provides highly accurate forecasts by combining data from multiple sources including live buoy data, NOAA marine forecasts, and wind conditions. Each forecast includes a confidence rating so you know how reliable the prediction is. We also show data transparency when using fallback sources.",
    },
    {
      question: "Can I share my surf sessions on social media?",
      answer:
        "Absolutely! Quiver makes it easy to share your epic sessions on Instagram, TikTok, and other platforms. Each session can be shared with beautiful summary cards showing your beach, conditions, and photos. Perfect for building your surf portfolio.",
    },
    {
      question: "What areas does Quiver cover?",
      answer:
        "Quiver covers 279+ surf spots across the US, including California, Hawaii, Florida, Oregon, Washington, the East Coast (NJ, NY, NC, SC), New England, Texas, and Baja Mexico. Every spot includes live conditions, forecasts, tide charts, and crowd data — all free.",
    },
    {
      question: "Is my data private on Quiver?",
      answer:
        "Your privacy is important to us. You control what you share - sessions can be public or private, and you can adjust your profile visibility settings. Private sessions are only visible to you, while public sessions help build the community.",
    },
  ];

  return <FAQSchema items={faqItems} />;
}
