import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@/__tests__/setup/test-utils";
import { SignUpForm } from "@/components/auth/sign-up-form";

// Mock next/navigation router
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
}));

// Mock useAuth
jest.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    signUp: jest.fn().mockResolvedValue(undefined),
  }),
}));

describe("SignUpForm - verification modal", () => {
  it("shows verification modal after successful signup and navigates on CTA", async () => {
    render(<SignUpForm />);

    // Fill form
    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: "Kelly" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "kelly@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "secret123" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "secret123" },
    });

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /sign up/i }));

    // Modal appears
    await waitFor(() => {
      expect(screen.getByText(/verify your email/i)).toBeInTheDocument();
      expect(screen.getByText(/kelly@example.com/i)).toBeInTheDocument();
    });

    // Click CTA
    fireEvent.click(screen.getByRole("button", { name: /go to sign in/i }));
  });
});
