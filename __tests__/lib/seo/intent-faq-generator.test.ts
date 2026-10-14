import { generateIntentFAQ } from "@/lib/seo/intent-faq-generator";

describe("generateIntentFAQ water-temp", () => {
  it("answers is-it-cold and right-now from the live reading", () => {
    const faqs = generateIntentFAQ("water-temp", "San Diego", ["Pacific Beach"], "ca", 64.4);

    expect(faqs[0]).toEqual({
      question: "Is the water cold in San Diego right now?",
      answer:
        "San Diego water is 64°F today, which is cool for most people, so most surfers wear a 3/2mm fullsuit. Wind, air temperature, and session length change how cold it feels.",
    });
    const rightNow = faqs.filter((faq) => faq.question === "What is the water temperature in San Diego right now?");
    expect(rightNow).toHaveLength(1);
    expect(rightNow[0].answer).toMatch(/^San Diego water is 64°F today\./);
    expect(faqs.some((faq) => faq.question === "What wetsuit do I need for San Diego?")).toBe(true);
  });

  it("keeps the seasonal answers when there is no reading", () => {
    const faqs = generateIntentFAQ("water-temp", "San Diego", [], "ca");

    expect(faqs.some((faq) => faq.question.startsWith("Is the water cold"))).toBe(false);
    expect(faqs.find((faq) => faq.question.endsWith("right now?"))?.answer).not.toMatch(/today/);
  });
});
