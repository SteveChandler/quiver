import React from "react";
import { render, screen } from "@testing-library/react";
import { ConditionsIntelCard } from "@/components/intel/conditions-intel-card";

describe("ConditionsIntelCard", () => {
  it("renders a rich summary when morning_intel_v2 payload is present", () => {
    const post: any = {
      id: "post-1",
      user_id: "user-1",
      beach_id: null,
      latitude: 32.7,
      longitude: -117.2,
      tag: "conditions",
      title: "Morning Surf Intel (06:00)",
      description: "fallback text",
      confirmations_count: 0,
      is_active: true,
      created_at: "2025-12-29T00:00:00Z",
      updated_at: "2025-12-29T00:00:00Z",
      dedupe_hash: null,
      expires_at: null,
      photo_storage_path: null,
      photo_url: null,
      surf_conditions: {
        kind: "morning_intel_v2",
        generatedAt: "2025-12-29T14:00:00Z",
        date: "2025-12-29",
        time: "06:00",
        recommendation: {
          decision: "worth_it",
          label: "Worth it",
          reasons: ["all factors line up"],
        },
        conditions: {
          score: 10,
          swell: { status: "optimal", emoji: "✅", message: "ok" },
          wind: { status: "optimal", emoji: "✅", message: "ok" },
          tide: { status: "optimal", emoji: "✅", message: "ok" },
        },
        bestWindow: "06:00–08:00",
        confidence: "High",
        surf: { min: 2, max: 4, dominant: "Chest-high" },
        tide: { height: 2.0, direction: "rising", nextEvent: null },
        wind: {
          speed: 4,
          direction: 90,
          cardinal: "E",
          offshore: true,
          description: "light offshore",
        },
        swells: { primary: null, secondary: null },
        dataCompleteness: 1,
        sources: { wave: true, tide: true, wind: true, swell: true },
      },
      user: { full_name: "Morning Intel", avatar_url: null },
    };

    render(<ConditionsIntelCard post={post} variant="feed" />);

    expect(screen.getByText("Worth it")).toBeInTheDocument();
    expect(screen.getByText("10/10 score")).toBeInTheDocument();
    expect(screen.getByText("Best window")).toBeInTheDocument();
    expect(screen.getByText("06:00–08:00")).toBeInTheDocument();
    expect(screen.getByText("Surf")).toBeInTheDocument();
    expect(screen.getByText("2–4 ft")).toBeInTheDocument();
  });
});









