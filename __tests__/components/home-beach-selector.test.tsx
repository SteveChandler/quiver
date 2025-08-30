import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { HomeBeachSelector } from "@/components/home-beach-selector";
import { useDataFetcher } from "@/hooks/use-data-fetcher";

// Mock the hooks and actions
jest.mock("@/hooks/use-data-fetcher");
jest.mock("@/actions/beach/beach-query-actions");
jest.mock("@/lib/utils/beach-search-utils");

const mockUseDataFetcher = useDataFetcher as jest.MockedFunction<typeof useDataFetcher>;

const mockBeaches = [
  {
    id: "1",
    name: "Pacific Beach",
    location: "San Diego, CA",
    latitude: 32.7942,
    longitude: -117.2542,
  },
  {
    id: "2", 
    name: "Ocean Beach",
    location: "San Diego, CA", 
    latitude: 32.7507,
    longitude: -117.2540,
  },
  {
    id: "3",
    name: "Mission Beach",
    location: "San Diego, CA",
    latitude: 32.7697,
    longitude: -117.2542,
  },
];

describe("HomeBeachSelector", () => {
  const mockOnValueChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock for beaches list
    mockUseDataFetcher.mockImplementation((fetchFn, options = {}) => {
      if (!options.skip) {
        return {
          data: mockBeaches,
          loading: false,
          error: null,
          refetch: jest.fn(),
        };
      }
      return {
        data: null,
        loading: false,
        error: null,
        refetch: jest.fn(),
      };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders with placeholder when no value selected", () => {
    render(
      <HomeBeachSelector
        value={undefined}
        onValueChange={mockOnValueChange}
        placeholder="Select your home beach"
      />
    );

    expect(screen.getByText("Select your home beach")).toBeInTheDocument();
  });

  it("displays selected beach when value is provided", async () => {
    render(
      <HomeBeachSelector
        value="1"
        onValueChange={mockOnValueChange}
        placeholder="Select your home beach"
      />
    );

    // Wait for the beach to be found and displayed
    await waitFor(() => {
      expect(screen.getByText("Pacific Beach")).toBeInTheDocument();
    });
  });

  it("shows loading state when beaches are loading", () => {
    mockUseDataFetcher.mockReturnValue({
      data: [],
      loading: true,
      error: null,
      refetch: jest.fn(),
    });

    render(
      <HomeBeachSelector
        value={undefined}
        onValueChange={mockOnValueChange}
      />
    );

    // Click to open the dropdown
    fireEvent.click(screen.getByRole("combobox"));

    expect(screen.getByText("Loading beaches...")).toBeInTheDocument();
  });

  it("opens dropdown and displays beach options", async () => {
    render(
      <HomeBeachSelector
        value={undefined}
        onValueChange={mockOnValueChange}
      />
    );

    // Click to open the dropdown
    fireEvent.click(screen.getByRole("combobox"));

    await waitFor(() => {
      expect(screen.getByText("Pacific Beach")).toBeInTheDocument();
      expect(screen.getByText("Ocean Beach")).toBeInTheDocument();
      expect(screen.getByText("Mission Beach")).toBeInTheDocument();
    });
  });

  it("calls onValueChange when beach is selected", async () => {
    render(
      <HomeBeachSelector
        value={undefined}
        onValueChange={mockOnValueChange}
      />
    );

    // Open dropdown
    fireEvent.click(screen.getByRole("combobox"));

    // Wait for options to load and click on Pacific Beach
    await waitFor(() => {
      expect(screen.getByText("Pacific Beach")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Pacific Beach"));

    expect(mockOnValueChange).toHaveBeenCalledWith("1");
  });

  it("allows clearing the selection", async () => {
    render(
      <HomeBeachSelector
        value="1"
        onValueChange={mockOnValueChange}
      />
    );

    // Wait for beach to display
    await waitFor(() => {
      expect(screen.getByText("Pacific Beach")).toBeInTheDocument();
    });

    // Find and click the clear button (X icon)
    const clearButton = screen.getByRole("button", { name: "" }); // X button has no text
    fireEvent.click(clearButton);

    expect(mockOnValueChange).toHaveBeenCalledWith(undefined);
  });

  it("shows disabled state when disabled prop is true", () => {
    render(
      <HomeBeachSelector
        value={undefined}
        onValueChange={mockOnValueChange}
        disabled={true}
      />
    );

    const combobox = screen.getByRole("combobox");
    expect(combobox).toBeDisabled();
  });

  it("applies custom className", () => {
    render(
      <HomeBeachSelector
        value={undefined}
        onValueChange={mockOnValueChange}
        className="custom-class"
      />
    );

    const container = screen.getByRole("combobox").closest("div");
    expect(container).toHaveClass("custom-class");
  });
});