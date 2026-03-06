import { render, screen, fireEvent } from "@testing-library/react";
import { WaveTypeSelector, WAVE_TYPES } from "@/components/ui/wave-type-selector";

describe("WaveTypeSelector", () => {
  const defaultProps = {
    selectedTypes: [],
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders wave characteristics heading", () => {
    render(<WaveTypeSelector {...defaultProps} />);
    
    expect(screen.getByText("Wave characteristics:")).toBeInTheDocument();
  });

  it("renders all 8 wave type options in 2x4 grid", () => {
    render(<WaveTypeSelector {...defaultProps} />);
    
    // Check that all wave types are rendered
    WAVE_TYPES.forEach((waveType) => {
      expect(screen.getByText(waveType.label)).toBeInTheDocument();
      expect(screen.getByText(waveType.description)).toBeInTheDocument();
    });
    
    // Check grid layout - should have 2 columns
    const gridContainer = screen.getByText("Wave characteristics:").nextElementSibling;
    expect(gridContainer).toHaveClass("grid", "grid-cols-2");
  });

  it("displays empty state message when no types selected", () => {
    render(<WaveTypeSelector {...defaultProps} />);
    
    expect(screen.getByText("Select wave characteristics that best describe the conditions")).toBeInTheDocument();
  });

  it("calls onChange when wave type is selected", () => {
    const mockOnChange = jest.fn();
    render(<WaveTypeSelector {...defaultProps} onChange={mockOnChange} />);
    
    const fatButton = screen.getByRole("button", { name: /Fat Wide, mellow waves/i });
    fireEvent.click(fatButton);
    
    expect(mockOnChange).toHaveBeenCalledWith(["fat"]);
  });

  it("displays selected wave types with remove functionality", () => {
    const mockOnChange = jest.fn();
    render(
      <WaveTypeSelector 
        {...defaultProps} 
        selectedTypes={["fat", "peaky"]} 
        onChange={mockOnChange} 
      />
    );
    
    // Should show selected section
    expect(screen.getByText("Selected:")).toBeInTheDocument();
    
    // Should show selected wave types - find by badge class patterns
    const fatBadges = screen.getAllByText("Fat");
    const peakyBadges = screen.getAllByText("Peaky");
    
    // Check that we have badges (elements with cursor-pointer)
    expect(fatBadges.some(el => el.closest("div")?.classList.contains("cursor-pointer"))).toBe(true);
    expect(peakyBadges.some(el => el.closest("div")?.classList.contains("cursor-pointer"))).toBe(true);
    
    // Should show clear all button
    const clearAllButton = screen.getByText("Clear all");
    expect(clearAllButton).toBeInTheDocument();
    
    fireEvent.click(clearAllButton);
    expect(mockOnChange).toHaveBeenCalledWith([]);
  });

  it("toggles wave type selection correctly", () => {
    const mockOnChange = jest.fn();
    render(
      <WaveTypeSelector 
        {...defaultProps} 
        selectedTypes={["fat"]} 
        onChange={mockOnChange} 
      />
    );
    
    // Click already selected type to deselect
    const fatButton = screen.getByRole("button", { name: /Fat Wide, mellow waves/i });
    fireEvent.click(fatButton);
    
    expect(mockOnChange).toHaveBeenCalledWith([]);
  });

  it("removes individual wave type when badge is clicked", () => {
    const mockOnChange = jest.fn();
    render(
      <WaveTypeSelector 
        {...defaultProps} 
        selectedTypes={["fat", "peaky", "powerful"]} 
        onChange={mockOnChange} 
      />
    );
    
    // Find badges in the selected section (has cursor-pointer class)
    const badges = screen.getAllByText("Fat");
    const fatBadge = badges.find(el => el.closest("div")?.classList.contains("cursor-pointer"));
    fireEvent.click(fatBadge!.closest("div")!);
    
    expect(mockOnChange).toHaveBeenCalledWith(["peaky", "powerful"]);
  });

  it("highlights selected wave types", () => {
    render(
      <WaveTypeSelector 
        {...defaultProps} 
        selectedTypes={["fat"]} 
      />
    );
    
    const fatButton = screen.getByRole("button", { name: /Fat Wide, mellow waves/i });
    expect(fatButton).toHaveClass("border-[#FF3B8B]");
  });

  it("shows tooltips with wave type descriptions", () => {
    render(<WaveTypeSelector {...defaultProps} />);
    
    const fatButton = screen.getByRole("button", { name: /Fat Wide, mellow waves/i });
    expect(fatButton).toHaveAttribute("title", "Wide, mellow waves");
  });

  it("hides empty state message when types are selected", () => {
    render(
      <WaveTypeSelector 
        {...defaultProps} 
        selectedTypes={["fat"]} 
      />
    );
    
    expect(screen.queryByText("Select wave characteristics that best describe the conditions")).not.toBeInTheDocument();
  });

  it("applies custom className correctly", () => {
    const { container } = render(
      <WaveTypeSelector {...defaultProps} className="custom-class" />
    );
    
    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("handles multiple selections correctly", () => {
    const mockOnChange = jest.fn();
    render(
      <WaveTypeSelector 
        {...defaultProps} 
        selectedTypes={["fat"]} 
        onChange={mockOnChange} 
      />
    );
    
    // Select another type
    const peakyButton = screen.getByRole("button", { name: /Peaky Sharp, defined peaks/i });
    fireEvent.click(peakyButton);
    
    expect(mockOnChange).toHaveBeenCalledWith(["fat", "peaky"]);
  });
});
