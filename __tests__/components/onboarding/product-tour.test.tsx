import React, { type ComponentType, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { HOW_THE_CALL_WORKS_FACTORS } from "@/lib/surf/how-the-call-works";

const mockCloseOnborda = jest.fn();
const mockStartOnborda = jest.fn();

interface MockStep {
  icon: ReactNode;
  title: string;
  content: ReactNode;
  selector: string;
  side?: string;
  showControls?: boolean;
  pointerPadding?: number;
  pointerRadius?: number;
}

interface MockCardComponentProps {
  step: MockStep;
  currentStep: number;
  totalSteps: number;
  nextStep: () => void;
  prevStep: () => void;
  arrow: ReactNode;
}

interface MockTour {
  tour: string;
  steps: MockStep[];
}

interface MockOnbordaProps {
  children: ReactNode;
  steps: MockTour[];
  cardComponent?: ComponentType<MockCardComponentProps>;
}

jest.mock("onborda", () => {
  const ReactRuntime = require("react") as typeof import("react");
  const mockOnbordaState = {
    currentStep: 0,
    currentTour: "main-product-tour",
    setCurrentStep: jest.fn(),
    closeOnborda: mockCloseOnborda,
    startOnborda: mockStartOnborda,
    isOnbordaVisible: false,
  };

  return {
    OnbordaProvider: ({ children }: { children: ReactNode }) => (
      <>{children}</>
    ),
    Onborda: ({
      children,
      steps,
      cardComponent: CardComponent,
    }: MockOnbordaProps) => {
      const [currentStep, setCurrentStep] = ReactRuntime.useState(0);
      const tourSteps = steps[0]?.steps ?? [];
      const step = tourSteps[currentStep];

      mockOnbordaState.currentStep = currentStep;

      if (!CardComponent || !step) {
        return <>{children}</>;
      }

      return (
        <>
          <CardComponent
            step={step}
            currentStep={currentStep}
            totalSteps={tourSteps.length}
            nextStep={() =>
              setCurrentStep((nextStep: number) =>
                Math.min(nextStep + 1, tourSteps.length - 1),
              )
            }
            prevStep={() =>
              setCurrentStep((previousStep: number) =>
                Math.max(previousStep - 1, 0),
              )
            }
            arrow={<div data-testid="tour-arrow" />}
          />
          {children}
        </>
      );
    },
    useOnborda: () => mockOnbordaState,
  };
});

jest.mock("@/store/onboarding-store", () => ({
  useOnboardingStore: () => ({
    isCompleted: false,
  }),
}));

jest.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: { id: "user-123" },
  }),
}));

jest.mock("@/lib/analytics", () => ({
  track: jest.fn(),
}));

const { ProductTour } = require(
  "@/components/onboarding/product-tour",
) as typeof import("@/components/onboarding/product-tour");

describe("ProductTour", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it("renders the added literacy step after the forecast map step with updated progress", async () => {
    const user = userEvent.setup();

    render(<ProductTour />);

    expect(
      screen.getByRole("heading", { name: "Interactive Forecast Map" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 6")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(
      screen.getByRole("heading", { name: "How Quiver makes the call" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Step 2 of 6")).toBeInTheDocument();
  });

  it("sources the literacy step content from HOW_THE_CALL_WORKS_FACTORS", async () => {
    const user = userEvent.setup();

    render(<ProductTour />);
    await user.click(screen.getByRole("button", { name: "Next" }));

    const body = screen.getByText((content) =>
      HOW_THE_CALL_WORKS_FACTORS.every((factor) =>
        content.includes(factor.label),
      ),
    );

    expect(body).toBeInTheDocument();
    expect(body).toHaveTextContent(
      HOW_THE_CALL_WORKS_FACTORS.map((factor) => factor.label).join(" -> "),
    );
    expect(body).toHaveTextContent(
      HOW_THE_CALL_WORKS_FACTORS.find((factor) => factor.id === "verdict")
        ?.description ?? "",
    );
  });

  it("advances through the six-step tour and finishes from the final step", async () => {
    const user = userEvent.setup();

    render(<ProductTour />);

    for (let stepIndex = 1; stepIndex < 6; stepIndex += 1) {
      await user.click(screen.getByRole("button", { name: "Next" }));
    }

    expect(
      screen.getByRole("heading", { name: "Log Your First Session" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Step 6 of 6")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Finish Tour" }));

    expect(mockCloseOnborda).toHaveBeenCalledTimes(1);
  });
});
