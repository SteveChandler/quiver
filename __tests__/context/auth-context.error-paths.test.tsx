import * as React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";

const mockSetClientPostHogTrackingAllowed = jest.fn();
const mockQueueClientPostHogSignup = jest.fn();
const mockGetExistingVisitorId = jest.fn<string | null, []>(() => null);
const mockClearVisitorId = jest.fn();
const mockUpdateUser = jest.fn(() =>
  Promise.resolve({ data: { user: null }, error: null }),
);
const originalPostHogToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
jest.mock("@/lib/analytics/auth-events", () => {
  const actual = jest.requireActual("@/lib/analytics/auth-events");
  return {
    ...actual,
    trackSignupSuccess: jest.fn(),
    trackLoginSuccess: jest.fn(),
  };
});
jest.mock("@/lib/posthog-client", () => ({
  buildPostHogUserProperties: jest.fn(() => ({})),
  captureClientPostHogEvent: jest.fn(),
  identifyPostHogUser: jest.fn(),
  resetPostHog: jest.fn(),
  queueClientPostHogSignup: (...args: unknown[]) =>
    mockQueueClientPostHogSignup(...args),
  setClientPostHogTrackingAllowed: (...args: unknown[]) =>
    mockSetClientPostHogTrackingAllowed(...args),
}));

jest.mock("@/lib/utils/visitor-id", () => ({
  getExistingVisitorId: () => mockGetExistingVisitorId(),
  clearVisitorId: () => mockClearVisitorId(),
}));

// Mock Supabase client setup
const mockGetSession = jest.fn(() =>
  Promise.resolve({ data: { session: null }, error: null })
);
const mockGetUser = jest.fn(() =>
  Promise.resolve({ data: { user: null }, error: null })
);
type AuthStateChangeHandler = (
  event: string,
  session: {
    user: {
      id: string;
      created_at: string;
      app_metadata: Record<string, unknown>;
    };
  } | null,
) => void;
const mockOnAuthStateChange = jest.fn(
  (_handler: AuthStateChangeHandler) => ({
    data: { subscription: { unsubscribe: jest.fn() } },
  }),
);

function getAuthStateChangeHandler(): AuthStateChangeHandler {
  const handler = mockOnAuthStateChange.mock.calls[0]?.[0];
  if (!handler) throw new Error("Auth state change handler was not registered");
  return handler;
}

jest.mock("@/lib/supabase/client", () => ({
  __esModule: true,
  createClient: () => ({
    auth: {
      getSession: mockGetSession,
      getUser: mockGetUser,
      onAuthStateChange: mockOnAuthStateChange,
      refreshSession: jest.fn(),
      updateUser: mockUpdateUser,
    },
  }),
}));

// Use the real AuthContext module (it is a client component)
jest.unmock("@/context/auth-context");
import { AuthProvider, useAuth } from "@/context/auth-context";
import {
  trackLoginSuccess,
  trackSignupSuccess,
} from "@/lib/analytics/auth-events";

function Consumer() {
  const { isLoading, isAuthenticated, refreshSession } = useAuth();
  React.useEffect(() => {
    void refreshSession();
  }, [refreshSession]);
  return (
    <div>
      <div data-testid="loading">{String(isLoading)}</div>
      <div data-testid="authed">{String(isAuthenticated)}</div>
    </div>
  );
}

describe("AuthContext error paths", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetExistingVisitorId.mockReturnValue(null);
    global.fetch = jest.fn(() =>
      Promise.resolve(new Response("{}", { status: 200 })),
    ) as jest.Mock;
    // Reset to default behavior
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
  });

  afterEach(() => {
    sessionStorage.removeItem("welcome_email_sent_new-user");
    sessionStorage.removeItem("pending_signup_metadata");
    sessionStorage.removeItem("events_linked_new-user");
    sessionStorage.removeItem("quiver_signup_flow");
    sessionStorage.removeItem("signup_metadata_applied_new-user");
    sessionStorage.removeItem("posthog_signup_queued_new-user");
    if (originalPostHogToken === undefined) {
      delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    } else {
      process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = originalPostHogToken;
    }
  });

  it("handles getSession error and sets unauthenticated", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: null },
      error: { message: "boom" } as any,
    });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("authed").textContent).toBe("false")
    );
  });

  it("lets PostHog consent follow the authenticated user state", async () => {
    render(
      <AuthProvider>
        <div>child</div>
      </AuthProvider>
    );

    await waitFor(() => expect(mockOnAuthStateChange).toHaveBeenCalled());
    const onAuthStateChange = getAuthStateChangeHandler();

    act(() => {
      onAuthStateChange("SIGNED_IN", {
        user: {
          id: "user-123",
          created_at: "2020-01-01T00:00:00.000Z",
          app_metadata: {},
        },
      });
    });

    expect(mockSetClientPostHogTrackingAllowed).not.toHaveBeenCalled();
  });

  it("queues a fresh signup conversion for the consent-aware provider", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = "phc_test";
    sessionStorage.setItem("welcome_email_sent_new-user", "true");

    render(
      <AuthProvider>
        <div>child</div>
      </AuthProvider>
    );

    await waitFor(() => expect(mockOnAuthStateChange).toHaveBeenCalled());
    const onAuthStateChange = getAuthStateChangeHandler();

    act(() => {
      onAuthStateChange("SIGNED_IN", {
        user: {
          id: "new-user",
          created_at: new Date().toISOString(),
          app_metadata: { provider: "google" },
        },
      });
    });

    expect(mockQueueClientPostHogSignup).toHaveBeenCalledWith(
      "new-user",
      "google",
    );
  });

  it("passes validated pending acquisition context to the identity link", async () => {
    const visitorId = "11111111-1111-4111-8111-111111111111";
    mockGetExistingVisitorId.mockReturnValue(visitorId);
    sessionStorage.setItem("welcome_email_sent_new-user", "true");
    sessionStorage.setItem(
      "pending_signup_metadata",
      JSON.stringify({
        signup_context: {
          schema_version: 2,
          signup_surface: "web",
          method: "google",
          entrypoint: "landing_hero",
          source_capture_status: "captured",
          captured_at: "2026-07-25T18:00:00.000Z",
        },
      }),
    );

    render(
      <AuthProvider>
        <div>child</div>
      </AuthProvider>,
    );

    await waitFor(() => expect(mockOnAuthStateChange).toHaveBeenCalled());
    const onAuthStateChange = getAuthStateChangeHandler();

    act(() => {
      onAuthStateChange("SIGNED_IN", {
        user: {
          id: "new-user",
          created_at: new Date().toISOString(),
          app_metadata: { provider: "google" },
        },
      });
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/events/link",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            sessionId: visitorId,
            signupContext: {
              schema_version: 2,
              signup_surface: "web",
              method: "google",
              entrypoint: "landing_hero",
              source_capture_status: "captured",
              captured_at: "2026-07-25T18:00:00.000Z",
            },
          }),
        }),
      );
    });
    expect(sessionStorage.getItem("pending_signup_metadata")).toBeNull();

  });

  it("reconciles a callback session already present during bootstrap", async () => {
    const visitorId = "22222222-2222-4222-8222-222222222222";
    mockGetExistingVisitorId.mockReturnValue(visitorId);
    const flow = {
      flow_id: "oauth-bootstrap-flow",
      provider: "google",
      source: "landing_hero",
      landing_page: "/",
      redirect_path: "/sessions",
      redirect_state: "pending",
      started_at: Date.now(),
    };
    sessionStorage.setItem("quiver_signup_flow", JSON.stringify(flow));
    sessionStorage.setItem(
      "pending_signup_metadata",
      JSON.stringify({
        signup_context: {
          schema_version: 2,
          signup_surface: "web",
          method: "google",
          entrypoint: "landing_hero",
          source_capture_status: "captured",
          captured_at: "2026-07-25T18:00:00.000Z",
        },
      }),
    );
    mockGetSession.mockResolvedValueOnce({
      data: {
        session: {
          user: {
            id: "new-user",
            created_at: new Date().toISOString(),
            app_metadata: { provider: "google" },
          },
        },
      },
      error: null,
    } as any);

    render(
      <AuthProvider>
        <div>child</div>
      </AuthProvider>,
    );

    await waitFor(() => expect(trackSignupSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        flow_id: flow.flow_id,
        method: "google",
        redirect_state: "completed",
      }),
    ));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/events/link",
        expect.objectContaining({
          body: JSON.stringify({
            sessionId: visitorId,
            signupContext: {
              schema_version: 2,
              signup_surface: "web",
              method: "google",
              entrypoint: "landing_hero",
              source_capture_status: "captured",
              captured_at: "2026-07-25T18:00:00.000Z",
            },
          }),
        }),
      );
    });
    expect(sessionStorage.getItem("pending_signup_metadata")).toBeNull();

    const onAuthStateChange = getAuthStateChangeHandler();
    act(() => {
      onAuthStateChange("SIGNED_IN", {
        user: {
          id: "new-user",
          created_at: new Date().toISOString(),
          app_metadata: { provider: "google" },
        },
      });
    });
    await waitFor(() => {
      const urls = (global.fetch as jest.Mock).mock.calls.map(([url]) => url);
      expect(urls.filter((url) => url === "/api/events/link")).toHaveLength(1);
      expect(urls.filter((url) => url === "/api/internal/send-welcome-email")).toHaveLength(1);
      expect(urls.filter((url) => url === "/api/admin/new-user-alert")).toHaveLength(1);
    });
    expect(mockSetClientPostHogTrackingAllowed).not.toHaveBeenCalled();
  });

  it("classifies signup-mode OAuth resolving to an existing account as login", async () => {
    const flow = {
      flow_id: "oauth-existing-flow",
      provider: "google",
      source: "landing_hero",
      redirect_path: "/sessions",
      redirect_state: "pending",
      started_at: Date.now(),
    };
    sessionStorage.setItem("quiver_signup_flow", JSON.stringify(flow));
    sessionStorage.setItem(
      "pending_signup_metadata",
      JSON.stringify({
        signup_context: {
          schema_version: 2,
          signup_surface: "web",
          method: "google",
          entrypoint: "landing_hero",
          source_capture_status: "captured",
          captured_at: "2026-07-25T18:00:00.000Z",
        },
      }),
    );

    render(
      <AuthProvider>
        <div>child</div>
      </AuthProvider>,
    );
    await waitFor(() => expect(mockOnAuthStateChange).toHaveBeenCalled());
    const onAuthStateChange = getAuthStateChangeHandler();

    act(() => {
      onAuthStateChange("SIGNED_IN", {
        user: {
          id: "existing-user",
          created_at: "2020-01-01T00:00:00.000Z",
          app_metadata: { provider: "google" },
        },
      });
    });

    await waitFor(() => expect(trackLoginSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        flow_id: flow.flow_id,
        method: "google",
        redirect_state: "completed",
      }),
    ));
    expect(sessionStorage.getItem("quiver_signup_flow")).toBeNull();
  });
});
