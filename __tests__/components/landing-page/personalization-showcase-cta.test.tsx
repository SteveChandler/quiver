import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { PersonalizationShowcase } from "@/components/landing-page/personalization-showcase";
import { useAuth } from "@/context/auth-context";

// Mock framer-motion to avoid animation issues in tests
jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    li: ({ children, ...props }: any) => <li {...props}>{children}</li>,
  },
  useInView: () => false,
}));

// Mock auth context
jest.mock("@/context/auth-context");

// Mock UnifiedAuthModal
jest.mock("@/components/auth/unified-auth-modal", () => ({
  UnifiedAuthModal: (props: any) =>
    props.isOpen ? (
      <div data-testid="auth-modal" data-source={props.source} />
    ) : null,
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe("PersonalizationShowcase CTA", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders CTA button for non-authenticated users", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      session: null as any,
      isLoading: false,
      isAuthenticated: false,
      signUp: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      refreshSession: jest.fn(),
    } as any);

    render(<PersonalizationShowcase />);

    expect(
      screen.getByRole("button", { name: /see your forecast/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/see conditions explained clearly for your level/i)
    ).toBeInTheDocument();
  });

  it("hides CTA button for authenticated users", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1", email: "surfer@example.com" } as any,
      session: null as any,
      isLoading: false,
      isAuthenticated: true,
      signUp: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      refreshSession: jest.fn(),
    } as any);

    render(<PersonalizationShowcase />);

    expect(
      screen.queryByRole("button", { name: /see your forecast/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/see conditions explained clearly for your level/i)
    ).not.toBeInTheDocument();
  });

  it("opens auth modal when CTA is clicked", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      session: null as any,
      isLoading: false,
      isAuthenticated: false,
      signUp: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      refreshSession: jest.fn(),
    } as any);

    render(<PersonalizationShowcase />);

    expect(screen.queryByTestId("auth-modal")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /see your forecast/i })
    );

    const modal = screen.getByTestId("auth-modal");
    expect(modal).toBeInTheDocument();
    expect(modal).toHaveAttribute("data-source", "personalization-showcase");
  });
});
