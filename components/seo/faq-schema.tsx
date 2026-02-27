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
 * Quiver-specific FAQ Schema for Landing Page
 */
export function QuiverFAQSchema() {
  const faqItems: FAQItem[] = [
    {
      question: "What is Quiver?",
      answer:
        "Quiver is an ML-powered surf forecast platform with live conditions, crowd intelligence, and session tracking for 185+ beaches across California, Hawaii, Oregon and more. Get personalized surf windows updated every 3 hours with real buoy data.",
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
