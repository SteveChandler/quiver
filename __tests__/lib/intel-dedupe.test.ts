import { describe, test, expect } from "@jest/globals";
import {
  createIntelDedupeHash,
  normalizeIntelText,
} from "@/lib/utils/intel-dedupe";

describe("intel dedupe utilities", () => {
  test("normalizes whitespace and casing", () => {
    expect(normalizeIntelText("  Hello   World  ")).toBe("hello world");
  });

  test("produces stable hash for semantically identical posts", () => {
    const base = {
      userId: "user-1",
      tag: "conditions",
      beachId: "beach-1",
      lat: 32.715,
      lon: -117.161,
    };

    const hashA = createIntelDedupeHash({
      ...base,
      title: " Dawn Patrol  ",
      description: "Light   winds and playful waist high lines.",
    });

    const hashB = createIntelDedupeHash({
      ...base,
      title: "dawn patrol",
      description: "light winds and playful waist high lines.",
    });

    expect(hashA).toBe(hashB);
  });

  test("changes hash when content meaningfully changes", () => {
    const base = {
      userId: "user-1",
      tag: "conditions",
      beachId: "beach-1",
      title: "Morning surf report",
      description: "Clean 3-4ft with light offshore winds.",
      lat: 32.71,
      lon: -117.16,
    };

    const original = createIntelDedupeHash(base);
    const changed = createIntelDedupeHash({
      ...base,
      description: "Choppy 1-2ft with stiff onshore winds.",
    });

    expect(original).not.toBe(changed);
  });
});
