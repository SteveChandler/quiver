import { render } from "@testing-library/react";
import { RoadmapStatusChip } from "@/components/roadmap/RoadmapStatusChip";

describe("<RoadmapStatusChip/>", () => {
  it("renders 'Shipped' for status='shipped' with the teal token class", () => {
    const { getByText, container } = render(<RoadmapStatusChip status="shipped" />);
    expect(getByText("Shipped")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("text-teal-400");
  });

  it("renders 'In Progress' for status='in_progress'", () => {
    const { getByText } = render(<RoadmapStatusChip status="in_progress" />);
    expect(getByText("In Progress")).toBeInTheDocument();
  });

  it("renders 'Under Consideration' for status='under_consideration'", () => {
    const { getByText } = render(<RoadmapStatusChip status="under_consideration" />);
    expect(getByText("Under Consideration")).toBeInTheDocument();
  });

  it("renders 'Declined' for status='declined'", () => {
    const { getByText } = render(<RoadmapStatusChip status="declined" />);
    expect(getByText("Declined")).toBeInTheDocument();
  });
});
