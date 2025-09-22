import * as React from "react";
import { render, screen, waitFor } from "@testing-library/react";
// Use the real AuthContext module (it is a client component)
jest.unmock("@/context/auth-context");
import { AuthProvider, useAuth } from "@/context/auth-context";

jest.mock("@/lib/supabase/client", () => {
  const mock = require("@/__tests__/setup/mock-supabase");
  const getClient =
    typeof mock.createClient === "function"
      ? mock.createClient
      : () => mock.default;
  return {
    __esModule: true,
    createClient: () => getClient(),
  };
});

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
  });

  it("handles getSession error and sets unauthenticated", async () => {
    const mock = require("@/__tests__/setup/mock-supabase");
    const getClient =
      typeof mock.createClient === "function"
        ? mock.createClient
        : () => mock.default;
    const client = getClient();
    client.auth.getSession.mockResolvedValueOnce({
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
