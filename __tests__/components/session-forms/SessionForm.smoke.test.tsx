import React from "react";
import { render, screen } from "@testing-library/react";
import { SessionForm } from "@/components/session-forms/SessionForm";

jest.mock("@/context/auth-context", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

// Mock supabase modules used in the SessionForm import graph
jest.mock("@/lib/supabase/client", () =>
  require("@/__tests__/setup/mock-supabase")
);
jest.mock("@/lib/supabase", () => ({
  createSupabaseBrowserClient: jest.fn(() => ({})),
}));
jest.mock("@supabase/realtime-js", () => ({ RealtimeClient: function () {} }));
jest.mock("@/lib/supabase/storage", () => ({
  uploadToBucket: jest.fn(() => Promise.resolve({ data: null, error: null })),
  getPublicUrl: jest.fn(() => "https://example.com/mock-url"),
}));

// Mock BeachSelector to avoid internal Supabase usage
jest.mock("@/components/BeachSelector", () => ({
  BeachSelector: ({ onBeachSelected, initialValue }: any) => (
    <input
      data-testid="beach-search-input"
      defaultValue={initialValue || ""}
      onChange={(e) => onBeachSelected({ id: "", name: e.target.value })}
    />
  ),
}));

// Keep the form in a stable initial shape
jest.mock("@/hooks/use-session-form", () => ({
  useSessionForm: () => ({
    mode: "plan",
    setMode: jest.fn(),
    loading: false,
    setLoading: jest.fn(),
    boards: [],
    beaches: [],
    formState: {
      selectedBeach: "",
      selectedBeachId: "",
      selectedDate: "",
      selectedTime: "",
      duration: "60m",
      invitees: [],
    },
    updateField: jest.fn(),
    resetForm: jest.fn(),
    refreshBoards: jest.fn(),
    isPlanning: true,
  }),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() },
}));

describe("SessionForm (smoke)", () => {
  it("renders the form shell without throwing", () => {
    render(<SessionForm initialMode="plan" />);
    expect(screen.getByTestId("session-planning-form")).toBeInTheDocument();
  });
});
