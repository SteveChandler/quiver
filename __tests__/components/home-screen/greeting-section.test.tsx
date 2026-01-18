import { render, screen } from "@testing-library/react";
import { GreetingSection } from "@/components/home-screen/greeting-section";

// Mock framer-motion
jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    h1: ({ children, ...props }: any) => <h1 {...props}>{children}</h1>,
  },
}));

describe("GreetingSection", () => {
  it("renders personalized greeting with user name", () => {
    render(<GreetingSection userName="John" timeOfDay="morning" />);

    expect(screen.getByText(/Good morning, John/)).toBeInTheDocument();
  });

  it("renders greeting without name when userName is null", () => {
    render(<GreetingSection userName={null} timeOfDay="afternoon" />);

    expect(screen.getByText(/Good afternoon/)).toBeInTheDocument();
  });

  it("has data-testid for testing", () => {
    render(<GreetingSection userName="John" timeOfDay="morning" />);

    expect(screen.getByTestId("greeting-section")).toBeInTheDocument();
  });

  it("renders with motion wrapper", () => {
    const { container } = render(<GreetingSection userName="John" timeOfDay="morning" />);

    // Should have a div wrapper (from mocked motion.div)
    expect(container.firstChild).toBeTruthy();
  });
});
