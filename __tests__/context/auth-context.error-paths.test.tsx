import * as React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/context/auth-context";

jest.mock("@/lib/supabase/client", () =>
  require("@/__tests__/setup/mock-supabase")
);

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

describe.skip("AuthContext error paths", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("handles getSession error and sets unauthenticated", async () => {
    const { createClient } = require("@/__tests__/setup/mock-supabase");
    const client = createClient();
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
      expect(screen.getByTestId("loading").textContent).toBe("false")
    );
    expect(screen.getByTestId("authed").textContent).toBe("false");
  });
});
