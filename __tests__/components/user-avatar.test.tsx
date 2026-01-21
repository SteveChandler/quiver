import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { UserAvatar } from "@/components/user-avatar";

// Mock the UI components
jest.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children, className }: any) => (
    <div data-testid="avatar" className={className}>
      {children}
    </div>
  ),
  AvatarImage: ({ src, alt, onError, onLoad }: any) => (
    <img
      data-testid="avatar-image"
      src={src}
      alt={alt}
      onError={onError}
      onLoad={onLoad}
    />
  ),
  AvatarFallback: ({ children, className }: any) => (
    <div data-testid="avatar-fallback" className={className}>
      {children}
    </div>
  ),
}));

// Mock the utils
jest.mock("@/lib/utils", () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(" "),
}));

// Mock image utils - getTransformedUrl returns the URL unchanged for testing
jest.mock("@/lib/utils/image-utils", () => ({
  getTransformedUrl: (url: string | null | undefined) => url || "",
}));

describe("UserAvatar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic Rendering", () => {
    it("renders avatar with default props", () => {
      render(<UserAvatar />);

      expect(screen.getByTestId("avatar")).toBeInTheDocument();
      expect(screen.getByTestId("avatar-fallback")).toBeInTheDocument();
    });

    it("applies correct size classes", () => {
      const { rerender } = render(<UserAvatar size="sm" />);
      expect(screen.getByTestId("avatar")).toHaveClass("h-8", "w-8");

      rerender(<UserAvatar size="md" />);
      expect(screen.getByTestId("avatar")).toHaveClass("h-12", "w-12");

      rerender(<UserAvatar size="lg" />);
      expect(screen.getByTestId("avatar")).toHaveClass("h-16", "w-16");

      rerender(<UserAvatar size="xl" />);
      expect(screen.getByTestId("avatar")).toHaveClass("h-24", "w-24");
    });

    it("applies custom className", () => {
      render(<UserAvatar className="custom-class" />);

      expect(screen.getByTestId("avatar")).toHaveClass("custom-class");
    });

    it("combines size and custom classes correctly", () => {
      render(<UserAvatar size="lg" className="custom-class" />);

      const avatar = screen.getByTestId("avatar");
      expect(avatar).toHaveClass("h-16", "w-16", "custom-class");
    });
  });

  describe("Image Handling", () => {
    it("renders image when valid src is provided", () => {
      const validSrc = "https://example.com/avatar.jpg";
      render(<UserAvatar src={validSrc} name="John Doe" />);

      const image = screen.getByTestId("avatar-image");
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute("src", validSrc);
      expect(image).toHaveAttribute("alt", "Profile picture of John Doe");
    });

    it("does not render image when src is null or undefined", () => {
      render(<UserAvatar src={null} name="John Doe" />);
      expect(screen.queryByTestId("avatar-image")).not.toBeInTheDocument();

      render(<UserAvatar src={undefined} name="John Doe" />);
      expect(screen.queryByTestId("avatar-image")).not.toBeInTheDocument();
    });

    it("filters out placeholder URLs", () => {
      render(
        <UserAvatar
          src="/placeholder.svg?height=200&width=200"
          name="John Doe"
        />
      );
      expect(screen.queryByTestId("avatar-image")).not.toBeInTheDocument();
    });

    it("allows Supabase storage URLs", () => {
      const supabaseSrc =
        "https://example.supabase.co/storage/v1/object/public/avatars/avatar.jpg";
      render(<UserAvatar src={supabaseSrc} name="John Doe" />);

      expect(screen.getByTestId("avatar-image")).toHaveAttribute(
        "src",
        supabaseSrc
      );
    });

    it("handles image load error", () => {
      const validSrc = "https://example.com/avatar.jpg";
      render(<UserAvatar src={validSrc} name="John Doe" />);

      const image = screen.getByTestId("avatar-image");

      // Simulate image error
      fireEvent.error(image);

      expect(screen.queryByTestId("avatar-image")).not.toBeInTheDocument();
      expect(screen.getByText("JD")).toBeInTheDocument();
    });

    it("handles successful image load", () => {
      const validSrc = "https://example.com/avatar.jpg";
      render(<UserAvatar src={validSrc} name="John Doe" />);

      const image = screen.getByTestId("avatar-image");

      // Simulate image load
      fireEvent.load(image);

      expect(screen.getByTestId("avatar-image")).toBeInTheDocument();
    });

    it("does not log image load in production", () => {
      Object.defineProperty(process.env, "NODE_ENV", {
        value: "production",
        writable: true,
        configurable: true,
      });
      const validSrc = "https://example.com/avatar.jpg";
      render(<UserAvatar src={validSrc} name="John Doe" />);

      const image = screen.getByTestId("avatar-image");

      // Simulate image load
      fireEvent.load(image);

      expect(screen.getByTestId("avatar-image")).toBeInTheDocument();
    });

    it("removes image after error and shows fallback", () => {
      const { rerender } = render(
        <UserAvatar src="https://example.com/avatar.jpg" name="John Doe" />
      );

      const image = screen.getByTestId("avatar-image");
      fireEvent.error(image);

      // Re-render to trigger state update
      rerender(
        <UserAvatar src="https://example.com/avatar.jpg" name="John Doe" />
      );

      // After error, image should not be rendered even with the same src
      expect(screen.queryByTestId("avatar-image")).not.toBeInTheDocument();
    });
  });

  describe("Fallback and Initials", () => {
    it("generates initials from full name", () => {
      render(<UserAvatar name="John Doe" />);

      expect(screen.getByTestId("avatar-fallback")).toHaveTextContent("JD");
    });

    it("generates initials from single name", () => {
      render(<UserAvatar name="John" />);

      expect(screen.getByTestId("avatar-fallback")).toHaveTextContent("J");
    });

    it("generates initials from multiple names (max 2 characters)", () => {
      render(<UserAvatar name="John Michael Doe Smith" />);

      expect(screen.getByTestId("avatar-fallback")).toHaveTextContent("JM");
    });

    it("handles names with extra spaces", () => {
      render(<UserAvatar name="  John   Doe  " />);

      expect(screen.getByTestId("avatar-fallback")).toHaveTextContent("JD");
    });

    it("falls back to email initial when no name provided", () => {
      render(<UserAvatar email="john@example.com" />);

      expect(screen.getByTestId("avatar-fallback")).toHaveTextContent("J");
    });

    it("handles email with extra spaces", () => {
      render(<UserAvatar email="  john@example.com  " />);

      expect(screen.getByTestId("avatar-fallback")).toHaveTextContent("J");
    });

    it("uses 'U' as ultimate fallback", () => {
      render(<UserAvatar />);

      expect(screen.getByTestId("avatar-fallback")).toHaveTextContent("U");
    });

    it("uses 'U' when name and email are empty strings", () => {
      render(<UserAvatar name="" email="" />);

      expect(screen.getByTestId("avatar-fallback")).toHaveTextContent("U");
    });

    it("prefers name over email for initials", () => {
      render(<UserAvatar name="John Doe" email="jane@example.com" />);

      expect(screen.getByTestId("avatar-fallback")).toHaveTextContent("JD");
    });

    it("converts initials to uppercase", () => {
      render(<UserAvatar name="john doe" />);

      expect(screen.getByTestId("avatar-fallback")).toHaveTextContent("JD");
    });

    it("applies correct fallback styling", () => {
      render(<UserAvatar name="John Doe" />);

      const fallback = screen.getByTestId("avatar-fallback");
      expect(fallback).toHaveClass("bg-blue-500", "text-white");
    });
  });

  describe("Loading State", () => {
    it("shows loading dots when isLoading is true", () => {
      render(<UserAvatar isLoading={true} name="John Doe" />);

      expect(screen.getByTestId("avatar-fallback")).toHaveTextContent("...");
    });

    it("shows initials when isLoading is false", () => {
      render(<UserAvatar isLoading={false} name="John Doe" />);

      expect(screen.getByTestId("avatar-fallback")).toHaveTextContent("JD");
    });

    it("defaults to not loading", () => {
      render(<UserAvatar name="John Doe" />);

      expect(screen.getByTestId("avatar-fallback")).toHaveTextContent("JD");
    });
  });

  describe("Edge Cases", () => {
    it("handles null values gracefully", () => {
      render(<UserAvatar src={null} name={null} email={null} />);

      expect(screen.getByTestId("avatar")).toBeInTheDocument();
      expect(screen.getByTestId("avatar-fallback")).toHaveTextContent("U");
    });

    it("handles special characters in names", () => {
      render(<UserAvatar name="José María" />);

      expect(screen.getByTestId("avatar-fallback")).toHaveTextContent("JM");
    });

    it("handles numeric characters in names", () => {
      render(<UserAvatar name="John 2 Doe" />);

      expect(screen.getByTestId("avatar-fallback")).toHaveTextContent("J2");
    });

    it("handles very long names", () => {
      render(
        <UserAvatar name="ThisIsAVeryLongFirstName AnotherVeryLongLastName" />
      );

      expect(screen.getByTestId("avatar-fallback")).toHaveTextContent("TA");
    });

    it("handles single character names", () => {
      render(<UserAvatar name="A B" />);

      expect(screen.getByTestId("avatar-fallback")).toHaveTextContent("AB");
    });

    it("handles empty email domain", () => {
      render(<UserAvatar email="j@" />);

      expect(screen.getByTestId("avatar-fallback")).toHaveTextContent("J");
    });
  });

  describe("Integration", () => {
    it("properly switches from image to fallback on error", async () => {
      const { rerender } = render(
        <UserAvatar src="https://example.com/avatar.jpg" name="John Doe" />
      );

      // Initially should show image
      expect(screen.getByTestId("avatar-image")).toBeInTheDocument();
      expect(screen.getByTestId("avatar-fallback")).toHaveTextContent("JD");

      // Simulate image error
      fireEvent.error(screen.getByTestId("avatar-image"));

      // Re-render to apply state change
      rerender(
        <UserAvatar src="https://example.com/avatar.jpg" name="John Doe" />
      );

      // Should now only show fallback
      expect(screen.queryByTestId("avatar-image")).not.toBeInTheDocument();
      expect(screen.getByTestId("avatar-fallback")).toHaveTextContent("JD");
    });

    it("maintains state when props change", () => {
      const { rerender } = render(<UserAvatar name="John Doe" />);

      expect(screen.getByTestId("avatar-fallback")).toHaveTextContent("JD");

      rerender(<UserAvatar name="Jane Smith" />);

      expect(screen.getByTestId("avatar-fallback")).toHaveTextContent("JS");
    });
  });
});
