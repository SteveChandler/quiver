import { FAQSection } from "@/components/seo/faq-schema";
import type { SeoFaqItem } from "@/lib/seo/funnel-pages";

interface SeoFaqProps {
  items: SeoFaqItem[];
  locationName: string;
}

export function SeoFaq({ items, locationName }: SeoFaqProps) {
  return <FAQSection items={items} locationName={locationName} />;
}
