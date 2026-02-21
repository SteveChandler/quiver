import { render, screen, fireEvent } from "@testing-library/react";
import { SidebarBeachCard } from "@/components/map/sidebar-beach-card";

jest.mock("@/lib/utils/beach-card-utils", () => ({
  getBeachLocation: jest.fn((beach: any) => {
    if (beach.city && beach.state) return `${beach.city}, ${beach.state}`;
    return "California";
  }),
}));

describe("SidebarBeachCard", () => {
  const beach = {
    id: "beach-1",
    slug: "blacks-beach",
    name: "Blacks Beach",
    city: "San Diego",
    state: "CA",
    region: "South SD",
  } as any;

  const defaultProps = {
    beach,
    waveHeight: 3.5,
    isSelected: false,
    distance: "2.1 mi",
    onSelect: jest.fn(),
  };

  it("renders beach name and location", () => {
    render(<SidebarBeachCard {...defaultProps} />);

    expect(screen.getByText("Blacks Beach")).toBeInTheDocument();
    expect(screen.getByText("San Diego, CA")).toBeInTheDocument();
  });

  it("renders wave height", () => {
    render(<SidebarBeachCard {...defaultProps} />);
    // formatWaveHeight(3.5): low=round(3.5)=4, high=round(3.5*1.5)=round(5.25)=5 -> "4-5ft"
    expect(screen.getByText("4-5ft")).toBeInTheDocument();
  });

  it("renders distance", () => {
    render(<SidebarBeachCard {...defaultProps} />);
    expect(screen.getByText("2.1 mi")).toBeInTheDocument();
  });

  it("calls onSelect when clicked", () => {
    const onSelect = jest.fn();
    render(<SidebarBeachCard {...defaultProps} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith(beach);
  });

  it("applies selected styles when isSelected is true", () => {
    render(<SidebarBeachCard {...defaultProps} isSelected={true} />);

    const button = screen.getByRole("button");
    expect(button).toHaveClass("border-primary/30");
    expect(button).toHaveClass("bg-primary/5");
  });

  // Bug 12: Truncated text must have title attribute for accessibility
  it("beach name has title attribute matching the name", () => {
    render(<SidebarBeachCard {...defaultProps} />);

    const nameEl = screen.getByText("Blacks Beach");
    expect(nameEl).toHaveAttribute("title", "Blacks Beach");
  });

  it("location text has title attribute matching the location", () => {
    render(<SidebarBeachCard {...defaultProps} />);

    const locationEl = screen.getByText("San Diego, CA");
    expect(locationEl).toHaveAttribute("title", "San Diego, CA");
  });
});
