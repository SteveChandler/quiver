import { render, screen } from "@testing-library/react";
import SocialPostCard from "@/components/social-post-card";

// Mock framer-motion to avoid animation issues in tests
jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

const mockProps = {
  id: "post-1",
  name: "John Doe",
  activity: "Had an epic surf session at Malibu!",
  imageUrl: "https://example.com/image.jpg",
  avatar: "https://example.com/avatar.jpg",
  index: 0,
};

describe("SocialPostCard", () => {
  it("should render post card with all content", () => {
    render(<SocialPostCard {...mockProps} />);

    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("Had an epic surf session at Malibu!")).toBeInTheDocument();
    
    const image = screen.getByAltText("John Doe's surf session");
    expect(image).toHaveAttribute("src", "https://example.com/image.jpg");
    
    const avatar = screen.getByAltText("John Doe");
    expect(avatar).toHaveAttribute("src", "https://example.com/avatar.jpg");
  });

  it("should display user initials as avatar fallback", () => {
    render(<SocialPostCard {...mockProps} avatar="" />);

    // Avatar fallback should show initials
    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  it("should handle single name for initials", () => {
    render(<SocialPostCard {...mockProps} name="Surfer" avatar="" />);

    expect(screen.getByText("S")).toBeInTheDocument();
  });

  it("should handle multiple names for initials", () => {
    render(<SocialPostCard {...mockProps} name="John Michael Doe Smith" avatar="" />);

    // Should take first letter of each name
    expect(screen.getByText("JMDS")).toBeInTheDocument();
  });

  it("should have proper accessibility attributes", () => {
    render(<SocialPostCard {...mockProps} />);

    const image = screen.getByAltText("John Doe's surf session");
    expect(image).toHaveAttribute("alt", "John Doe's surf session");

    const avatar = screen.getByAltText("John Doe");
    expect(avatar).toHaveAttribute("alt", "John Doe");
  });

  it("should have hover and cursor styles", () => {
    render(<SocialPostCard {...mockProps} />);

    const card = screen.getByText("John Doe").closest("[class*='cursor-pointer']");
    expect(card).toHaveClass("cursor-pointer");
  });

  it("should maintain aspect-square ratio", () => {
    render(<SocialPostCard {...mockProps} />);

    const card = screen.getByText("John Doe").closest("[class*='aspect-square']");
    expect(card).toHaveClass("aspect-square");
  });

  it("should render with gradient overlay", () => {
    render(<SocialPostCard {...mockProps} />);

    const overlay = screen.getByText("John Doe").closest("[class*='bg-gradient-to-t']");
    expect(overlay).toHaveClass("bg-gradient-to-t");
  });

  it("should handle empty activity text", () => {
    render(<SocialPostCard {...mockProps} activity="" />);

    expect(screen.getByText("John Doe")).toBeInTheDocument();
    // Activity text container should still be present but empty
    const activityElement = screen.queryByText("Had an epic surf session at Malibu!");
    expect(activityElement).not.toBeInTheDocument();
  });

  it("should handle long activity text", () => {
    const longActivity = "This is a very long activity description that might wrap to multiple lines and should be handled gracefully by the component without breaking the layout or styling.";
    
    render(<SocialPostCard {...mockProps} activity={longActivity} />);

    expect(screen.getByText(longActivity)).toBeInTheDocument();
  });

  it("should handle special characters in name", () => {
    render(<SocialPostCard {...mockProps} name="José María O'Connor" avatar="" />);

    expect(screen.getByText("José María O'Connor")).toBeInTheDocument();
    expect(screen.getByText("JMO")).toBeInTheDocument();
  });

  it("should handle missing image gracefully", () => {
    render(<SocialPostCard {...mockProps} imageUrl="" />);

    const image = screen.getByAltText("John Doe's surf session");
    expect(image).toHaveAttribute("src", "");
  });

  it("should apply border styling to avatar", () => {
    render(<SocialPostCard {...mockProps} />);

    const avatarContainer = screen.getByText("John Doe").parentElement?.querySelector("[class*='border-2']");
    expect(avatarContainer).toHaveClass("border-2", "border-white/80");
  });

  it("should use ocean-blue background for avatar fallback", () => {
    render(<SocialPostCard {...mockProps} avatar="" />);

    const fallback = screen.getByText("JD");
    expect(fallback).toHaveClass("bg-ocean-blue");
  });

  it("should handle index prop for animations", () => {
    const { rerender } = render(<SocialPostCard {...mockProps} index={0} />);
    
    // Component should render without errors regardless of index
    expect(screen.getByText("John Doe")).toBeInTheDocument();

    rerender(<SocialPostCard {...mockProps} index={5} />);
    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });

  it("should render as motion.div for animations", () => {
    const { container } = render(<SocialPostCard {...mockProps} />);

    // The outer container should be a div (mocked motion.div)
    expect(container.firstChild).toBeInTheDocument();
  });

  describe("Edge Cases", () => {
    it("should handle undefined name gracefully", () => {
      render(<SocialPostCard {...mockProps} name={undefined as any} avatar="" />);

      // Should not crash, but fallback might be empty
      const fallback = screen.getByText("");
      expect(fallback).toBeInTheDocument();
    });

    it("should handle names with only spaces", () => {
      render(<SocialPostCard {...mockProps} name="   " avatar="" />);

      expect(screen.getByText("   ")).toBeInTheDocument();
    });

    it("should handle very long names", () => {
      const longName = "Extremely Long Full Name With Many Parts That Might Test Edge Cases";
      render(<SocialPostCard {...mockProps} name={longName} avatar="" />);

      expect(screen.getByText(longName)).toBeInTheDocument();
      // Initials should be from each word
      expect(screen.getByText("ELFNWMPTMTEC")).toBeInTheDocument();
    });

    it("should handle names with numbers and symbols", () => {
      render(<SocialPostCard {...mockProps} name="User123 @Surfer!" avatar="" />);

      expect(screen.getByText("User123 @Surfer!")).toBeInTheDocument();
      expect(screen.getByText("U@")).toBeInTheDocument();
    });
  });

  describe("Styling and Layout", () => {
    it("should have proper spacing and positioning", () => {
      render(<SocialPostCard {...mockProps} />);

      const userInfo = screen.getByText("John Doe").closest("[class*='flex']");
      expect(userInfo).toHaveClass("flex", "items-center", "space-x-3");
    });

    it("should position overlay at bottom", () => {
      render(<SocialPostCard {...mockProps} />);

      const overlay = screen.getByText("John Doe").closest("[class*='absolute']");
      expect(overlay).toHaveClass("absolute", "bottom-0", "left-0", "right-0");
    });

    it("should use proper card styling", () => {
      render(<SocialPostCard {...mockProps} />);

      const card = screen.getByText("John Doe").closest("[class*='overflow-hidden']");
      expect(card).toHaveClass("overflow-hidden");
    });

    it("should handle responsive design", () => {
      render(<SocialPostCard {...mockProps} />);

      const avatar = screen.getByText("John Doe").parentElement?.querySelector("[class*='h-10']");
      expect(avatar).toHaveClass("h-10", "w-10");
    });
  });
});