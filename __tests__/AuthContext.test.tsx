import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/context/auth-context";
import { getClientBrowserClient } from "@/lib/supabase";
import type { Session, User } from "@supabase/supabase-js";

// Unmock the actual AuthContext module for this test file
jest.unmock("@/context/auth-context");

// Mock the supabase client
jest.mock("@/lib/supabase", () => ({
  getClientBrowserClient: jest.fn(),
  // Ensure other exports from lib/supabase are also mocked if AuthProvider uses them,
  // though it seems to primarily use getClientBrowserClient.
  // createServerClient: jest.fn(), // if needed
}));

const mockGetSession = jest.fn();
const mockOnAuthStateChange = jest.fn();
const mockSignOut = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockSignUp = jest.fn();

// Helper to set up the mock Supabase client
const setupMockSupabaseClient = (session: Session | null) => {
  (getClientBrowserClient as jest.Mock).mockReturnValue({
    auth: {
      getSession: mockGetSession.mockResolvedValue({
        data: { session },
        error: null,
      }),
      onAuthStateChange: mockOnAuthStateChange.mockImplementation(
        (callback) => {
          // Simulate initial session event
          Promise.resolve().then(() => callback("INITIAL_SESSION", session));
          // Simulate a sign-out event for testing sign-out later if needed
          // Promise.resolve().then(() => callback('SIGNED_OUT', null));
          return {
            data: { subscription: { unsubscribe: jest.fn() } },
          };
        }
      ),
      signOut: mockSignOut.mockResolvedValue({ error: null }),
      signInWithPassword: mockSignInWithPassword,
      signUp: mockSignUp,
    },
  });
};

// A simple component to consume and display auth state
const AuthConsumerComponent = () => {
  const { user, session, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div data-testid="is-authenticated">
        {isAuthenticated ? "true" : "false"}
      </div>
      <div data-testid="user">{user ? user.id : "null"}</div>
      <div data-testid="session">{session ? "exists" : "null"}</div>
      {user && user.email && <div data-testid="user-email">{user.email}</div>}
    </div>
  );
};

describe("AuthContext", () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    // Mock console.error and console.warn to suppress them during tests
    // You might already have this globally in jest.setup.js
    jest.spyOn(console, "error").mockImplementation(jest.fn());
    jest.spyOn(console, "warn").mockImplementation(jest.fn());
  });

  test("initializes with no session if getSession returns null", async () => {
    setupMockSupabaseClient(null);

    render(
      <AuthProvider>
        <AuthConsumerComponent />
      </AuthProvider>
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("is-authenticated")).toHaveTextContent("false");
    });

    expect(screen.getByTestId("user")).toHaveTextContent("null");
    expect(screen.getByTestId("session")).toHaveTextContent("null");
    expect(mockGetSession).toHaveBeenCalledTimes(1);
    // onAuthStateChange is called, and its callback is invoked once by our mock setup
  });

  test("initializes with a session if getSession returns a valid session", async () => {
    const mockUser: User = {
      id: "test-user-id",
      app_metadata: {},
      user_metadata: { full_name: "Test User" },
      aud: "authenticated",
      created_at: new Date().toISOString(),
      email: "test@example.com",
    };
    const mockSession: Session = {
      access_token: "test-access-token",
      refresh_token: "test-refresh-token",
      user: mockUser,
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Date.now() / 1000 + 3600,
    };

    setupMockSupabaseClient(mockSession);

    render(
      <AuthProvider>
        <AuthConsumerComponent />
      </AuthProvider>
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("is-authenticated")).toHaveTextContent("true");
    });

    expect(screen.getByTestId("user")).toHaveTextContent("test-user-id");
    expect(screen.getByTestId("user-email")).toHaveTextContent(
      "test@example.com"
    );
    expect(screen.getByTestId("session")).toHaveTextContent("exists");
    expect(mockGetSession).toHaveBeenCalledTimes(1);
  });

  // You could add more tests here for signIn, signOut, signUp, refreshSession if needed,
  // by further detailing the mocks for signInWithPassword, signOut, etc.,
  // and simulating their effects on onAuthStateChange.
});
