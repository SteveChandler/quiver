import { render, screen } from "@testing-library/react";
import { FeatureCard } from "@/components/landing-page/feature-card";
import { Calendar, MapPin, Users, Waves } from "lucide-react";

// Mock framer-motion to avoid animation issues in tests
jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

const mockFeatureData = {
  icon: Calendar,
  title: "Plan Sessions",
  description:
    "Pick your beach, time, and board. Invite friends and coordinate the perfect session together.",
  iconBgColor: "bg-ocean-blue/10",
  iconColor: "text-ocean-blue",
  features: [
    {
      icon: MapPin,
      text: "Choose from 1000+ beaches",
      color: "text-ocean-blue",
    },
    {
      icon: Users,
      text: "Invite your crew",
      color: "text-ocean-blue",
    },
    {
      icon: Waves,
      text: "Track your boards",
      color: "text-ocean-blue",
    },
  ],
};

describe("FeatureCard", () => {
  it("renders the feature card with correct title and description", () => {
    render(<FeatureCard {...mockFeatureData} />);

    expect(screen.getByText("Plan Sessions")).toBeInTheDocument();
    expect(
      screen.getByText(/Pick your beach, time, and board/)
    ).toBeInTheDocument();
  });

  it("renders all feature items", () => {
    render(<FeatureCard {...mockFeatureData} />);

    expect(screen.getByText("Choose from 1000+ beaches")).toBeInTheDocument();
    expect(screen.getByText("Invite your crew")).toBeInTheDocument();
    expect(screen.getByText("Track your boards")).toBeInTheDocument();
  });

  it("applies the correct styling classes", () => {
    render(<FeatureCard {...mockFeatureData} />);

    const card = screen.getByText("Plan Sessions").closest(".bg-white\\/80");
    expect(card).toBeInTheDocument();
  });

  it("renders with custom delay prop", () => {
    render(<FeatureCard {...mockFeatureData} delay={2} />);

    expect(screen.getByText("Plan Sessions")).toBeInTheDocument();
  });
});
