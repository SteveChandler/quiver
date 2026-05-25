import React from "react";
import { render } from "@testing-library/react";
import { QuiverFAQSchema } from "@/components/seo/faq-schema";

function getFaqSchema(container: HTMLElement) {
  const script = container.querySelector('script[type="application/ld+json"]');
  return JSON.parse(script?.textContent || "{}");
}

describe("QuiverFAQSchema", () => {
  it("keeps public paid-plan claims offsite while iOS is live", () => {
    const { container } = render(<QuiverFAQSchema />);

    const schema = getFaqSchema(container);
    const freeUseQuestion = schema.mainEntity.find(
      (entry: { name: string }) => entry.name === "Is Quiver free to use?",
    );
    const answer = freeUseQuestion.acceptedAnswer.text;

    expect(answer).toContain("iPhone app is live on the App Store");
    expect(answer).toContain("Android is coming soon");
    expect(answer).not.toContain("$4.99");
    expect(answer).not.toContain("$39.99");
    expect(answer).not.toMatch(/14-day free trial/i);
    expect(answer).not.toMatch(/buy|purchase|checkout/i);
    expect(answer).not.toMatch(/plan details|pricing/i);
  });
});
