import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionForm } from "@/components/session-forms/SessionForm";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));

jest.mock("@/context/auth-context", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

jest.mock("@/actions/session-actions", () => ({
  createPlannedSession: jest.fn().mockResolvedValue({ id: "s1" }),
  createLoggedSession: jest.fn(),
}));

// Prevent Supabase client initialization in this test
jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u" } } }) },
    from: () => ({
      select: () => ({
        order: async () => ({ data: [], error: null }),
      }),
    }),
  }),
}));
jest.mock("@/lib/supabase/storage", () => ({}));

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
    },
    updateField: jest.fn(),
    resetForm: jest.fn(),
    refreshBoards: jest.fn(),
    isPlanning: true,
  }),
}));

describe("SessionForm gating", () => {
  test("submit button disabled until required fields present", async () => {
    render(<SessionForm initialMode="plan" />);

    const submit = screen.getByRole("button", {
      name: /Plan Session|Complete required fields to save/i,
    });
    expect(submit).toBeDisabled();
  });
});
