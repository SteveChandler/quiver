import { render } from "@testing-library/react";
import { RoadmapStatusChip } from "@/components/roadmap/RoadmapStatusChip";

describe("<RoadmapStatusChip/>", () => {
  it("renders 'Shipped' for status='shipped' with the Pacific Teal brand class", () => {
    const { getByText, container } = render(<RoadmapStatusChip status="shipped" />);
    expect(getByText("Shipped")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("text-[#00D4AA]");
  });

  it("renders 'Building Now' for status='in_progress'", () => {
    const { getByText } = render(<RoadmapStatusChip status="in_progress" />);
    expect(getByText("Building Now")).toBeInTheDocument();
  });

  it("renders 'Under Consideration' for status='under_consideration'", () => {
    const { getByText } = render(<RoadmapStatusChip status="under_consideration" />);
    expect(getByText("Under Consideration")).toBeInTheDocument();
  });

  it("renders 'Passed' for status='declined'", () => {
    const { getByText } = render(<RoadmapStatusChip status="declined" />);
    expect(getByText("Passed")).toBeInTheDocument();
  });
});
