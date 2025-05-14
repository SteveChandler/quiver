import { render, screen } from "@testing-library/react";
import TestPage from "@/app/test/page";

// Mock the TestDialog component
jest.mock("@/components/test-dialog", () => ({
  TestDialog: () => <div data-testid="test-dialog">Test Dialog Component</div>,
}));

describe("Test Page", () => {
  it("renders the TestDialog component", () => {
    render(<TestPage />);

    expect(screen.getByTestId("test-dialog")).toBeInTheDocument();
    expect(screen.getByText("Test Dialog Component")).toBeInTheDocument();
  });
});
