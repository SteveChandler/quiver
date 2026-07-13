import React from "react";
import { render } from "@testing-library/react";
import {
  FAQSchema,
  QUIVER_FAQ_ITEMS,
  QuiverFAQSchema,
} from "@/components/seo/faq-schema";
import { HowToBoardCalculatorSchema } from "@/components/seo/how-to-board-calculator-schema";
import { HowToWaveConverterSchema } from "@/components/seo/how-to-wave-converter-schema";

function getFaqSchema(container: HTMLElement) {
  const script = container.querySelector('script[type="application/ld+json"]');
  return JSON.parse(script?.textContent || "{}");
}

describe("QuiverFAQSchema", () => {
  it("keeps FAQ content available without emitting broad FAQPage JSON-LD", () => {
    const { container } = render(<QuiverFAQSchema />);

    expect(container.querySelector('script[type="application/ld+json"]')).toBeNull();
  });

  it("does not emit FAQPage JSON-LD for generic Quiver FAQ data", () => {
    const { container } = render(
      <FAQSchema
        items={[{
          question: "Is Quiver free to use?",
          answer:
            "Quiver's iPhone app is live on the App Store, and the Android beta is open through Google Play closed testing.",
        }]}
      />,
    );

    expect(container.querySelector('script[type="application/ld+json"]')).toBeNull();
  });

  it("keeps public paid-plan copy out of the rendered FAQ data source", () => {
    const freeUseQuestion = QUIVER_FAQ_ITEMS.find(
      (item) => item.question === "Is Quiver free to use?",
    );
    const faqCopy = freeUseQuestion?.answer ?? "";

    expect(faqCopy).toContain("iPhone app is live on the App Store");
    expect(faqCopy).toContain("Android beta is open");
    expect(faqCopy).not.toContain("Android is coming soon");
    expect(faqCopy).not.toContain("Android waitlist");
    expect(faqCopy).not.toContain("$4.99");
    expect(faqCopy).not.toContain("$39.99");
    expect(faqCopy).not.toMatch(/14-day free trial/i);
    expect(faqCopy).not.toMatch(/buy|purchase|checkout/i);
    expect(faqCopy).not.toMatch(/plan details|pricing/i);
  });
});

describe("deprecated schema components", () => {
  it("does not emit HowTo JSON-LD for surf tools", () => {
    const { container: waveConverter } = render(<HowToWaveConverterSchema />);
    const { container: boardCalculator } = render(<HowToBoardCalculatorSchema />);

    expect(waveConverter.querySelector('script[type="application/ld+json"]')).toBeNull();
    expect(boardCalculator.querySelector('script[type="application/ld+json"]')).toBeNull();
  });
});

describe("legacy FAQ schema parser", () => {
  it("returns an empty object when no FAQPage script is emitted", () => {
    const { container } = render(<QuiverFAQSchema />);
    const schema = getFaqSchema(container);

    expect(schema).toEqual({});
  });
});
