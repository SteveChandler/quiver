/**
 * FAQ Schema Component
 * Provides structured data for FAQ sections to enhance SEO with rich snippets
 */

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSchemaProps {
  items: FAQItem[];
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

/**
 * Quiver-specific FAQ Schema for Landing Page
 */
export function QuiverFAQSchema() {
  const faqItems: FAQItem[] = [
    {
      question: "What is Quiver?",
      answer:
        "Quiver is the ultimate surf community platform where you can find surf buddies, track your sessions, get accurate forecasts, and discover the best surf spots - connecting the surfing community worldwide.",
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
        "Quiver currently focuses on San Diego surf spots including Pacific Beach, La Jolla, Encinitas, and more. We're continuously expanding to cover more surf destinations worldwide. Can't find your spot? Let us know and we'll add it!",
    },
    {
      question: "Is my data private on Quiver?",
      answer:
        "Your privacy is important to us. You control what you share - sessions can be public or private, and you can adjust your profile visibility settings. Private sessions are only visible to you, while public sessions help build the community.",
    },
  ];

  return <FAQSchema items={faqItems} />;
}
