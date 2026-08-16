import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ConditionsReportCard } from "@/components/beach-detail/conditions-report-card";
import { useAuth } from "@/context/auth-context";
import { submitConditionsReport } from "@/actions/conditions-report-actions";
import { useReducedMotion } from "framer-motion";

jest.mock("@/context/auth-context");
jest.mock("@/actions/conditions-report-actions", () => ({
  submitConditionsReport: jest.fn(),
}));
jest.mock("@/lib/analytics", () => ({ track: jest.fn() }));
jest.mock("framer-motion", () => ({
  ...jest.requireActual("framer-motion"),
  useReducedMotion: jest.fn(() => true),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockSubmit = submitConditionsReport as jest.MockedFunction<
  typeof submitConditionsReport
>;
const mockUseReducedMotion = useReducedMotion as jest.MockedFunction<
  typeof useReducedMotion
>;

const defaultProps = {
  beachId: "beach-123",
  beachName: "Blacks",
};

function signIn() {
  mockUseAuth.mockReturnValue({ user: { id: "user-1" } } as ReturnType<
    typeof useAuth
  >);
}

function fillForm() {
  fireEvent.click(screen.getByRole("button", { name: "2-3ft" }));
  fireEvent.click(screen.getByRole("button", { name: /Fun/ }));
}

beforeEach(() => {
  jest.clearAllMocks();
  signIn();
  // clearAllMocks resets call history, not implementations -- restore the
  // reduced-motion default here so a test that overrides it cannot leak into
  // its neighbours, even if it throws before restoring.
  mockUseReducedMotion.mockReturnValue(true);
});

describe("ConditionsReportCard", () => {
  it("disables submit until wave size and vibe are selected", () => {
    render(<ConditionsReportCard {...defaultProps} />);
    const submit = screen.getByRole("button", { name: "Share Report" });
    expect(submit).toBeDisabled();
    fillForm();
    expect(submit).toBeEnabled();
  });

  it("submits the structured report and shows the success state", async () => {
    const onSubmitSuccess = jest.fn();
    mockSubmit.mockResolvedValue({
      success: true,
      data: { success: true, data: { intelPostId: "intel-1", sessionId: null } },
    } as never);
    render(
      <ConditionsReportCard
        {...defaultProps}
        onSubmitSuccess={onSubmitSuccess}
      />
    );
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Share Report" }));

    await waitFor(() =>
      expect(screen.getByText(/Report shared!/)).toBeInTheDocument()
    );
    expect(mockSubmit).toHaveBeenCalledWith({
      beachId: "beach-123",
      waveSizeRange: "2-3ft",
      vibe: "fun",
      note: undefined,
    });
    expect(onSubmitSuccess).toHaveBeenCalledTimes(1);
  });

  it("renders a static zine success state when reduced motion is preferred", async () => {
    mockSubmit.mockResolvedValue({
      success: true,
      data: { success: true, data: { intelPostId: "intel-1", sessionId: null } },
    } as never);

    render(<ConditionsReportCard {...defaultProps} />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Share Report" }));

    await waitFor(() =>
      expect(
        screen.getByText("Report shared! Thanks for helping the Blacks crew.")
      ).toBeInTheDocument()
    );
    expect(screen.queryByTestId("conditions-report-confetti")).not.toBeInTheDocument();
    expect(screen.queryByText("community")).not.toBeInTheDocument();
  });

  it("shows the already-reported state on dedupe", async () => {
    mockSubmit.mockResolvedValue({
      success: true,
      data: { success: false, error: "ALREADY_REPORTED_TODAY" },
    } as never);
    render(<ConditionsReportCard {...defaultProps} />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Share Report" }));

    await waitFor(() =>
      expect(
        screen.getByText(/already reported conditions at Blacks today/)
      ).toBeInTheDocument()
    );
  });

  it("self-guards auth: signed-out submit triggers onAuthRequired even without publicMode", async () => {
    mockUseAuth.mockReturnValue({ user: null } as ReturnType<typeof useAuth>);
    const onAuthRequired = jest.fn();
    render(
      <ConditionsReportCard {...defaultProps} onAuthRequired={onAuthRequired} />
    );
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Share Report" }));

    await waitFor(() => expect(onAuthRequired).toHaveBeenCalled());
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it("renders the confetti burst when reduced motion is not preferred", async () => {
    mockUseReducedMotion.mockReturnValue(false);

    mockSubmit.mockResolvedValue({
      success: true,
      data: { success: true, data: { intelPostId: "intel-1", sessionId: null } },
    } as never);

    render(<ConditionsReportCard {...defaultProps} />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Share Report" }));

    await waitFor(() =>
      expect(screen.getByText(/Report shared!/)).toBeInTheDocument()
    );
    expect(screen.getByTestId("conditions-report-confetti")).toBeInTheDocument();
  });
});
