import { HelpCircle } from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
}

interface BeginnerFAQProps {
  items: FAQItem[];
}

export function BeginnerFAQ({ items }: BeginnerFAQProps) {
  return (
    <section data-testid="beginner-faq">
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">
        <HelpCircle className="inline h-5 w-5 text-sky-600 mr-2" aria-hidden="true" />
        Frequently Asked Questions
      </h2>
      <div className="space-y-3">
        {items.map(({ question, answer }) => (
          <details
            key={question}
            className="group rounded-xl border border-blue-100/50 bg-gradient-to-br from-white/90 to-blue-50/20"
          >
            <summary className="cursor-pointer p-4 text-sm font-semibold text-gray-800 hover:bg-blue-50/50 transition-colors">
              {question}
            </summary>
            <div className="px-4 pb-4 text-sm text-gray-700 leading-relaxed">
              {answer}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
