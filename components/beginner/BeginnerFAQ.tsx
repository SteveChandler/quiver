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
      <h2 className="text-2xl font-semibold text-slate-900 mb-4">
        <HelpCircle className="inline h-5 w-5 text-sky-600 mr-2" aria-hidden="true" />
        Frequently Asked Questions
      </h2>
      <div className="space-y-3">
        {items.map(({ question, answer }) => (
          <details
            key={question}
            className="group rounded-lg border border-slate-200 bg-white"
          >
            <summary className="cursor-pointer p-4 text-sm font-semibold text-slate-900 hover:bg-slate-50 transition-colors">
              {question}
            </summary>
            <div className="px-4 pb-4 text-sm text-slate-700 leading-relaxed">
              {answer}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
