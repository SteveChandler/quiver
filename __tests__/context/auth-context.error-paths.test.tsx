import * as React from "react";
import { render, screen, waitFor } from "@testing-library/react";

// Mock Supabase client setup
const mockGetSession = jest.fn(() =>
  Promise.resolve({ data: { session: null }, error: null })
);
const mockGetUser = jest.fn(() =>
  Promise.resolve({ data: { user: null }, error: null })
);
const mockOnAuthStateChange = jest.fn(() => ({
  data: { subscription: { unsubscribe: jest.fn() } },
}));

jest.mock("@/lib/supabase/client", () => ({
  __esModule: true,
  createClient: () => ({
    auth: {
      getSession: mockGetSession,
      getUser: mockGetUser,
      onAuthStateChange: mockOnAuthStateChange,
      refreshSession: jest.fn(),
    },
  }),
}));

// Use the real AuthContext module (it is a client component)
jest.unmock("@/context/auth-context");
import { AuthProvider, useAuth } from "@/context/auth-context";

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
    // Reset to default behavior
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
  });

  it("handles getSession error and sets unauthenticated", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: null },
      error: new Error("boom"),
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
});
