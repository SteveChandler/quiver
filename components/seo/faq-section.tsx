"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { FAQSchema } from "./faq-schema";
import type { RichContent } from "@/lib/seo/rich-content";
import { RichContentRenderer } from "@/lib/seo/rich-content";

interface FAQItem {
  question: string;
  answer: string;
}

interface RichFAQItem extends FAQItem {
  richAnswer?: RichContent;
}

/**
 * Combined FAQ Section — visible interactive accordion.
 * FAQSchema is retained as a compatibility no-op; Quiver does not emit broad
 * FAQPage JSON-LD.
 * Use on listing pages (city, state) that generate data-driven FAQs.
 */
export function FAQSection({
  items,
  locationName,
}: {
  items: FAQItem[] | RichFAQItem[];
  locationName: string;
}) {
  const [expandedItems, setExpandedItems] = useState<Set<number>>(
    new Set([0])
  );

  if (items.length === 0) return null;

  function toggleItem(index: number) {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  return (
    <>
      <FAQSchema items={items} />
      <section aria-label={`FAQ about surfing in ${locationName}`}>
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900">
              Frequently Asked Questions
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              About surfing in {locationName}
            </p>
          </div>

          <dl>
            {items.map((faq, index) => {
              const isOpen = expandedItems.has(index);
              const richAnswer =
                "richAnswer" in faq ? faq.richAnswer : undefined;
              const answerId = `faq-answer-${index}`;

              return (
                <div
                  key={faq.question}
                  className={
                    index < items.length - 1
                      ? "border-b border-gray-100"
                      : undefined
                  }
                >
                  <dt>
                    <button
                      type="button"
                      onClick={() => toggleItem(index)}
                      aria-expanded={isOpen}
                      aria-controls={answerId}
                      className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors focus-ring"
                    >
                      <span className="text-base font-medium text-gray-900 pr-4">
                        {faq.question}
                      </span>
                      <ChevronDown
                        className={`h-5 w-5 flex-shrink-0 text-gray-400 transition-transform duration-200 ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  </dt>
                  <div
                    id={answerId}
                    role="region"
                    aria-labelledby={`faq-question-${index}`}
                    className="grid transition-[grid-template-rows] duration-300 ease-in-out"
                    style={{
                      gridTemplateRows: isOpen ? "1fr" : "0fr",
                    }}
                  >
                    <div className="overflow-hidden">
                      <dd className="px-6 pb-4 text-sm text-gray-600 leading-relaxed">
                        {richAnswer ? (
                          <RichContentRenderer content={richAnswer} />
                        ) : (
                          faq.answer
                        )}
                      </dd>
                    </div>
                  </div>
                </div>
              );
            })}
          </dl>
        </div>
      </section>
    </>
  );
}
