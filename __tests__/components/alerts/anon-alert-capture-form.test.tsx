/**
 * Unit tests for AnonAlertCaptureForm (Task 19).
 *
 * Covers:
 * - Renders the form for anonymous users.
 * - Submits valid input → "Check your email" success copy.
 * - Submits invalid input → server error UI.
 * - Authenticated users → renders nothing (CTA defense-in-depth).
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(),
}));

import { AnonAlertCaptureForm } from "@/components/alerts/anon-alert-capture-form";
import { useAuth } from "@/context/auth-context";

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

function setAnon(): void {
  mockUseAuth.mockReturnValue({
    user: null,
    isLoading: false,
  } as any);
}

function setAuthed(): void {
  mockUseAuth.mockReturnValue({
    user: { id: "user-1", email: "u@x.com" },
    isLoading: false,
  } as any);
}

const defaultProps = {
  beachId: "beach-123",
  beachName: "Ocean Beach",
  returnPath: "/ca/san-diego/ocean-beach",
};

describe("AnonAlertCaptureForm", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
  });

  it("renders the form for anonymous users", () => {
    setAnon();
    render(<AnonAlertCaptureForm {...defaultProps} />);
    expect(
      screen.getByTestId("anon-alert-capture-form"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/email me when ocean beach is firing/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId("anon-alert-capture-email")).toBeInTheDocument();
    expect(screen.getByTestId("anon-alert-capture-submit")).toBeInTheDocument();
  });

  it("renders nothing for authenticated users (CTA defense-in-depth)", () => {
    setAuthed();
    const { container } = render(<AnonAlertCaptureForm {...defaultProps} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows "Check your email" copy on successful submit', async () => {
    setAnon();
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/alerts/anon-capture") {
        return Promise.resolve({
          json: () => Promise.resolve({ success: true }),
        });
      }
      // /api/events fire-and-forget — doesn't matter
      return Promise.resolve({ json: () => Promise.resolve({}) });
    });

    render(<AnonAlertCaptureForm {...defaultProps} />);

    fireEvent.change(screen.getByTestId("anon-alert-capture-email"), {
      target: { value: "surfer@example.com" },
    });
    fireEvent.click(screen.getByTestId("anon-alert-capture-submit"));

    await waitFor(() => {
      expect(
        screen.getByTestId("anon-alert-capture-success"),
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    expect(screen.getByText(/surfer@example.com/)).toBeInTheDocument();

    // Verify it actually called the capture endpoint with expected payload.
    const captureCall = fetchMock.mock.calls.find(
      (c) => c[0] === "/api/alerts/anon-capture",
    );
    expect(captureCall).toBeDefined();
    const body = JSON.parse(captureCall![1].body);
    expect(body).toMatchObject({
      email: "surfer@example.com",
      beach_id: "beach-123",
      preset_type: "glass_off",
      return_path: "/ca/san-diego/ocean-beach",
    });
    expect(body.website).toBe("");
  });

  it("shows error UI when server returns success:false", async () => {
    setAnon();
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/alerts/anon-capture") {
        return Promise.resolve({
          json: () =>
            Promise.resolve({ success: false, error: "invalid_email" }),
        });
      }
      return Promise.resolve({ json: () => Promise.resolve({}) });
    });

    render(<AnonAlertCaptureForm {...defaultProps} />);

    fireEvent.change(screen.getByTestId("anon-alert-capture-email"), {
      target: { value: "not-an-email@example.com" },
    });
    fireEvent.click(screen.getByTestId("anon-alert-capture-submit"));

    await waitFor(() => {
      expect(
        screen.getByTestId("anon-alert-capture-error"),
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/invalid_email/i)).toBeInTheDocument();
    // Did NOT switch to success state
    expect(
      screen.queryByTestId("anon-alert-capture-success"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/check your email/i)).not.toBeInTheDocument();

    // Confirm error event was fired
    const errorEvent = fetchMock.mock.calls.find(
      (c) =>
        c[0] === "/api/events" &&
        c[1]?.body?.includes("anon_alert_capture_error"),
    );
    expect(errorEvent).toBeDefined();
  });
});
