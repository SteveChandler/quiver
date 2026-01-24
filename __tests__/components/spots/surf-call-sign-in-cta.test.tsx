import { render, screen } from "@testing-library/react";
import { SurfCallSignInCTA } from "@/components/spots/surf-call-sign-in-cta";

jest.mock("next/link", () => {
  return function MockLink({ children, href, ...props }: any) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  };
});

const mockUseAuth = jest.fn();
jest.mock("@/context/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("SurfCallSignInCTA", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders nothing when user is authenticated", () => {
    mockUseAuth.mockReturnValue({ user: { id: "user-1" } });
    const { container } = render(<SurfCallSignInCTA />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders link with correct href when user is null", () => {
    mockUseAuth.mockReturnValue({ user: null });
    render(<SurfCallSignInCTA />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/auth/sign-in");
  });

  it("renders correct link text when user is null", () => {
    mockUseAuth.mockReturnValue({ user: null });
    render(<SurfCallSignInCTA />);

    expect(
      screen.getByText("Sign in for your call (board + level)")
    ).toBeInTheDocument();
  });
});
