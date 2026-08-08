import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NearbySpots } from "@/components/oracle/nearby-spots";
import type { NearbySpot } from "@/components/oracle/nearby-spots";

jest.mock("next/image", () => {
  return function MockImage({
    src,
    alt,
    ...props
  }: {
    src: string;
    alt: string;
    [key: string]: unknown;
  }) {
    return <img src={src} alt={alt} {...props} />;
  };
});

const mockSpots: NearbySpot[] = [
  {
    id: "spot-1",
    name: "Mavericks",
    conditions: "Offshore · 14s",
    height: "3-4ft",
    photoUrl: null,
    score: 85,
  },
  {
    id: "spot-2",
    name: "Steamer Lane",
    conditions: "Onshore · 12s",
    height: "2-3ft",
    photoUrl: "https://example.com/steamer.jpg",
  },
  {
    id: "spot-3",
    name: "Ocean Beach",
    conditions: "Cross-shore · 10s",
    height: "1-2ft",
    photoUrl: null,
  },
];

describe("NearbySpots", () => {
  describe("Title rendering", () => {
    it('renders "Nearby Spots" title', () => {
      render(
        <NearbySpots spots={mockSpots} onViewSpot={jest.fn()} />
      );

      expect(
        screen.getByRole("heading", { name: "Nearby Spots" })
      ).toBeInTheDocument();
    });
  });

  describe("Spot name rendering", () => {
    it("renders all spot names", () => {
      render(
        <NearbySpots spots={mockSpots} onViewSpot={jest.fn()} />
      );

      expect(screen.getByText("Mavericks")).toBeInTheDocument();
      expect(screen.getByText("Steamer Lane")).toBeInTheDocument();
      expect(screen.getByText("Ocean Beach")).toBeInTheDocument();
    });

    it("renders conditions and wave height for each spot", () => {
      render(
        <NearbySpots spots={mockSpots} onViewSpot={jest.fn()} />
      );

      expect(screen.getByText("Offshore · 14s")).toBeInTheDocument();
      expect(screen.getByText("3-4ft")).toBeInTheDocument();
    });
  });

  describe("Click interaction", () => {
    it("calls onViewSpot with the correct id when a card is clicked", async () => {
      const user = userEvent.setup();
      const onViewSpot = jest.fn();

      render(<NearbySpots spots={mockSpots} onViewSpot={onViewSpot} />);

      await user.click(screen.getByText("Mavericks"));

      expect(onViewSpot).toHaveBeenCalledTimes(1);
      expect(onViewSpot).toHaveBeenCalledWith("spot-1");
    });

    it("calls onViewSpot for the correct spot when multiple cards are present", async () => {
      const user = userEvent.setup();
      const onViewSpot = jest.fn();

      render(<NearbySpots spots={mockSpots} onViewSpot={onViewSpot} />);

      await user.click(screen.getByText("Steamer Lane"));

      expect(onViewSpot).toHaveBeenCalledWith("spot-2");
    });
  });

  describe("Loading state", () => {
    it("renders 4 skeleton cards when loading is true", () => {
      const { container } = render(
        <NearbySpots spots={[]} onViewSpot={jest.fn()} loading={true} />
      );

      // Skeletons are rendered as divs with animate-pulse; count the skeleton wrappers
      const skeletonWrappers = screen.getAllByTestId("nearby-spot-skeleton");
      expect(skeletonWrappers).toHaveLength(4);
    });

    it("does not render spot names when loading", () => {
      render(
        <NearbySpots spots={mockSpots} onViewSpot={jest.fn()} loading={true} />
      );

      expect(screen.queryByText("Mavericks")).not.toBeInTheDocument();
    });
  });

  describe("Photo rendering", () => {
    it("renders an img element when photoUrl is provided", () => {
      render(
        <NearbySpots spots={[mockSpots[1]]} onViewSpot={jest.fn()} />
      );

      const img = screen.getByRole("img", { name: "Steamer Lane" });
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", "https://example.com/steamer.jpg");
    });

    it("renders gradient placeholder when photoUrl is null", () => {
      const { container } = render(
        <NearbySpots spots={[mockSpots[0]]} onViewSpot={jest.fn()} />
      );

      // No img should be present for this spot
      expect(screen.queryByRole("img")).not.toBeInTheDocument();

      // The gradient placeholder div should exist
      const placeholder = screen.queryByTestId("nearby-spot-photo-placeholder");
      expect(placeholder).toBeInTheDocument();
    });
  });

  describe("Empty spots", () => {
    it("renders the section header even when spots array is empty", () => {
      render(<NearbySpots spots={[]} onViewSpot={jest.fn()} />);

      expect(
        screen.getByRole("heading", { name: "Nearby Spots" })
      ).toBeInTheDocument();
    });
  });

  describe("Reason text rendering", () => {
    it("renders pre-computed reasonText when provided", () => {
      const spotsWithReason: NearbySpot[] = [
        {
          ...mockSpots[0],
          conditions: "Generic conditions summary",
          reasonText: "More size than the hero call",
          strategyTag: {
            type: "biggest_waves",
            label: "Biggest",
            reason: "Strategy-tag default reason",
          },
        },
      ];
      render(<NearbySpots spots={spotsWithReason} onViewSpot={jest.fn()} />);

      // Personalized reasonText wins over both strategyTag.reason and conditions.
      expect(
        screen.getByText("More size than the hero call")
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Strategy-tag default reason")
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("Generic conditions summary")
      ).not.toBeInTheDocument();
    });

    it("falls back to conditions when reasonText is omitted", () => {
      const spotsNoReason: NearbySpot[] = [
        {
          ...mockSpots[0],
          conditions: "Offshore · 14s",
          // reasonText intentionally omitted
        },
      ];
      render(<NearbySpots spots={spotsNoReason} onViewSpot={jest.fn()} />);

      expect(screen.getByText("Offshore · 14s")).toBeInTheDocument();
    });
  });

  describe("Scroll fade indicator", () => {
    it("shows fade indicator when more than 2 spots are present", () => {
      render(<NearbySpots spots={mockSpots} onViewSpot={jest.fn()} />);

      expect(screen.getByTestId("scroll-fade-indicator")).toBeInTheDocument();
    });

    it("does not show fade indicator when 2 or fewer spots", () => {
      render(
        <NearbySpots spots={mockSpots.slice(0, 2)} onViewSpot={jest.fn()} />
      );

      expect(screen.queryByTestId("scroll-fade-indicator")).not.toBeInTheDocument();
    });

    it("does not show fade indicator when loading", () => {
      render(
        <NearbySpots spots={mockSpots} onViewSpot={jest.fn()} loading={true} />
      );

      expect(screen.queryByTestId("scroll-fade-indicator")).not.toBeInTheDocument();
    });
  });
});
