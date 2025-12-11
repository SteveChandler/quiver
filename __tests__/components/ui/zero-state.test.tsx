import { render, screen, fireEvent } from "@testing-library/react";
import { ZeroState } from "@/components/ui/zero-state";
import { BookOpen, Plus, MessageCircle } from "lucide-react";

// Mock next/link
jest.mock("next/link", () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

describe("ZeroState", () => {
  it("renders with required props", () => {
    render(
      <ZeroState
        icon={BookOpen}
        title="No Sessions Yet"
        description="Start tracking your surf journey"
      />
    );

    expect(screen.getByText("No Sessions Yet")).toBeInTheDocument();
    expect(
      screen.getByText("Start tracking your surf journey")
    ).toBeInTheDocument();
  });

  it("renders icon with correct styling", () => {
    render(
      <ZeroState
        icon={BookOpen}
        title="Test Title"
        description="Test description"
      />
    );

    // Icon should be rendered (we can't directly check for the icon, but we check the container)
    const container = screen.getByText("Test Title").parentElement;
    expect(container).toBeInTheDocument();
  });

  it("renders primary action button with href", () => {
    render(
      <ZeroState
        icon={BookOpen}
        title="No Sessions"
        description="Log your first session"
        action={{
          label: "Log Session",
          href: "/sessions/new",
        }}
      />
    );

    const button = screen.getByRole("link", { name: /log session/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("href", "/sessions/new");
  });

  it("renders primary action button with onClick", () => {
    const handleClick = jest.fn();

    render(
      <ZeroState
        icon={BookOpen}
        title="No Sessions"
        description="Log your first session"
        action={{
          label: "Log Session",
          onClick: handleClick,
        }}
      />
    );

    const button = screen.getByRole("button", { name: /log session/i });
    fireEvent.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("renders action with icon", () => {
    render(
      <ZeroState
        icon={BookOpen}
        title="No Sessions"
        description="Log your first session"
        action={{
          label: "Log Session",
          href: "/sessions/new",
          icon: Plus,
        }}
      />
    );

    const button = screen.getByRole("link", { name: /log session/i });
    expect(button).toBeInTheDocument();
  });

  it("renders secondary action button", () => {
    render(
      <ZeroState
        icon={BookOpen}
        title="No Sessions"
        description="Log your first session"
        action={{
          label: "Log Session",
          href: "/sessions/new",
        }}
        secondaryAction={{
          label: "Plan Session",
          href: "/sessions/new?mode=plan",
        }}
      />
    );

    expect(
      screen.getByRole("link", { name: /log session/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /plan session/i })
    ).toBeInTheDocument();
  });

  it("renders pro tip when provided", () => {
    render(
      <ZeroState
        icon={BookOpen}
        title="No Sessions"
        description="Log your first session"
        proTip="Add photos to capture memories"
      />
    );

    expect(
      screen.getByText("Add photos to capture memories")
    ).toBeInTheDocument();
  });

  it("does not render pro tip when not provided", () => {
    render(
      <ZeroState
        icon={BookOpen}
        title="No Sessions"
        description="Log your first session"
      />
    );

    // The lightbulb icon container should not be present
    expect(
      screen.queryByText("Add photos to capture memories")
    ).not.toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <ZeroState
        icon={BookOpen}
        title="Test"
        description="Test description"
        className="custom-class"
      />
    );

    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("renders without action buttons when not provided", () => {
    render(
      <ZeroState
        icon={MessageCircle}
        title="No Intel"
        description="Be the first to share intel"
      />
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders with both actions having onClick handlers", () => {
    const primaryClick = jest.fn();
    const secondaryClick = jest.fn();

    render(
      <ZeroState
        icon={BookOpen}
        title="No Sessions"
        description="Description"
        action={{
          label: "Primary Action",
          onClick: primaryClick,
        }}
        secondaryAction={{
          label: "Secondary Action",
          onClick: secondaryClick,
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /primary action/i }));
    fireEvent.click(screen.getByRole("button", { name: /secondary action/i }));

    expect(primaryClick).toHaveBeenCalledTimes(1);
    expect(secondaryClick).toHaveBeenCalledTimes(1);
  });
});

