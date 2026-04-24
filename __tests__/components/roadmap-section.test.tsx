import { render, screen } from "@testing-library/react";
import { RoadmapSection } from "@/components/roadmap/RoadmapSection";
import type { RoadmapItem } from "@/lib/roadmap/types";

const item = (overrides: Partial<RoadmapItem> = {}): RoadmapItem => ({
  id: "1",
  title: "Auto-log sessions from your watch",
  description: "Wave count, paddle distance, ride distance from the wrist.",
  category: "logging",
  status: "under_consideration",
  eta_label: null,
  founder_reply: null,
  shipped_at: null,
  created_at: "2026-04-24T00:00:00Z",
  updated_at: "2026-04-24T00:00:00Z",
  vote_count: 12,
  viewer_has_voted: false,
  ...overrides,
});

describe("<RoadmapSection/>", () => {
  it("renders title, count, and item cards", () => {
    render(
      <RoadmapSection
        title="Under Consideration"
        status="under_consideration"
        items={[item(), item({ id: "2", title: "Offline session save" })]}
        authed={true}
      />,
    );
    expect(screen.getAllByText("Under Consideration").length).toBeGreaterThan(0);
    expect(screen.getByText("(2)")).toBeInTheDocument();
    expect(screen.getByText(item().title)).toBeInTheDocument();
    expect(screen.getByText("Offline session save")).toBeInTheDocument();
  });

  it("shows empty-state copy when items is empty", () => {
    render(
      <RoadmapSection
        title="Declined"
        status="declined"
        items={[]}
        authed={false}
      />,
    );
    expect(screen.getByText(/nothing here yet/i)).toBeInTheDocument();
    expect(screen.getByText("(0)")).toBeInTheDocument();
  });

  it("hides VoteButton on shipped items (via RoadmapItemCard)", () => {
    const { container } = render(
      <RoadmapSection
        title="Shipped"
        status="shipped"
        items={[item({ status: "shipped", shipped_at: "2026-04-20T00:00:00Z" })]}
        authed={true}
      />,
    );
    // Shipped cards show RoadmapStatusChip but no VoteButton
    expect(container.querySelector('button[aria-pressed]')).toBeNull();
    expect(screen.getAllByText("Shipped").length).toBeGreaterThan(0); // chip label
  });

  it("hides VoteButton on declined items", () => {
    const { container } = render(
      <RoadmapSection
        title="Declined"
        status="declined"
        items={[item({ status: "declined" })]}
        authed={true}
      />,
    );
    expect(container.querySelector('button[aria-pressed]')).toBeNull();
  });

  it("shows VoteButton on under_consideration and in_progress", () => {
    const { container: c1 } = render(
      <RoadmapSection title="UC" status="under_consideration" items={[item()]} authed={true} />,
    );
    expect(c1.querySelector('button[aria-pressed]')).not.toBeNull();

    const { container: c2 } = render(
      <RoadmapSection title="IP" status="in_progress" items={[item({ status: "in_progress", eta_label: "This month" })]} authed={true} />,
    );
    expect(c2.querySelector('button[aria-pressed]')).not.toBeNull();
  });
});
