import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  SessionCardPhotos,
  type SessionPhoto,
} from "@/components/session-card-photos";
import "@testing-library/jest-dom";

describe("SessionCardPhotos", () => {
  const mockPhotos: SessionPhoto[] = [
    {
      id: "photo-1",
      public_url: "https://example.com/photo1.jpg",
      caption: "First photo",
    },
    {
      id: "photo-2",
      public_url: "https://example.com/photo2.jpg",
      caption: "Second photo",
    },
    {
      id: "photo-3",
      public_url: "https://example.com/photo3.jpg",
      caption: "Third photo",
    },
  ];

  it("should render nothing when no photos provided", () => {
    const { container } = render(<SessionCardPhotos photos={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("should render nothing when photos is empty array", () => {
    const { container } = render(<SessionCardPhotos photos={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("should render single photo in full width layout", () => {
    render(<SessionCardPhotos photos={[mockPhotos[0]]} />);

    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute("src", mockPhotos[0].public_url);
    expect(images[0]).toHaveAttribute("alt", mockPhotos[0].caption);
  });

  it("should render two photos in side-by-side layout", () => {
    render(<SessionCardPhotos photos={mockPhotos.slice(0, 2)} />);

    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute("src", mockPhotos[0].public_url);
    expect(images[1]).toHaveAttribute("src", mockPhotos[1].public_url);
  });

  it("should render three photos in row layout", () => {
    render(<SessionCardPhotos photos={mockPhotos} />);

    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(3);
    expect(images[0]).toHaveAttribute("src", mockPhotos[0].public_url);
    expect(images[1]).toHaveAttribute("src", mockPhotos[1].public_url);
    expect(images[2]).toHaveAttribute("src", mockPhotos[2].public_url);
  });

  it("should show photo count badge with correct number", () => {
    render(<SessionCardPhotos photos={mockPhotos} />);

    // Badge should show total count
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("should show +N overlay on last photo when more than maxDisplay", () => {
    const manyPhotos: SessionPhoto[] = [
      ...mockPhotos,
      {
        id: "photo-4",
        public_url: "https://example.com/photo4.jpg",
      },
      {
        id: "photo-5",
        public_url: "https://example.com/photo5.jpg",
      },
    ];

    render(<SessionCardPhotos photos={manyPhotos} maxDisplay={3} />);

    // Should only show 3 images
    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(3);

    // Should show +2 overlay (5 total - 3 displayed = 2 remaining)
    expect(screen.getByText("+2")).toBeInTheDocument();

    // Badge should show total count (5)
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("should call onClick handler when photo grid clicked", () => {
    const handleClick = jest.fn();
    render(<SessionCardPhotos photos={mockPhotos} onClick={handleClick} />);

    const photoGrid = screen.getByRole("button");
    fireEvent.click(photoGrid);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("should support keyboard navigation with Enter key", () => {
    const handleClick = jest.fn();
    render(<SessionCardPhotos photos={mockPhotos} onClick={handleClick} />);

    const photoGrid = screen.getByRole("button");
    fireEvent.keyDown(photoGrid, { key: "Enter" });

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("should support keyboard navigation with Space key", () => {
    const handleClick = jest.fn();
    render(<SessionCardPhotos photos={mockPhotos} onClick={handleClick} />);

    const photoGrid = screen.getByRole("button");
    fireEvent.keyDown(photoGrid, { key: " " });

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("should not call onClick when other keys are pressed", () => {
    const handleClick = jest.fn();
    render(<SessionCardPhotos photos={mockPhotos} onClick={handleClick} />);

    const photoGrid = screen.getByRole("button");
    fireEvent.keyDown(photoGrid, { key: "Tab" });
    fireEvent.keyDown(photoGrid, { key: "Escape" });

    expect(handleClick).not.toHaveBeenCalled();
  });

  it("should have correct ARIA label for single photo", () => {
    render(<SessionCardPhotos photos={[mockPhotos[0]]} />);

    const photoGrid = screen.getByRole("button", {
      name: "View 1 session photo",
    });
    expect(photoGrid).toBeInTheDocument();
  });

  it("should have correct ARIA label for multiple photos", () => {
    render(<SessionCardPhotos photos={mockPhotos} />);

    const photoGrid = screen.getByRole("button", {
      name: "View 3 session photos",
    });
    expect(photoGrid).toBeInTheDocument();
  });

  it("should use lazy loading for images", () => {
    render(<SessionCardPhotos photos={mockPhotos} />);

    const images = screen.getAllByRole("img");
    images.forEach((img) => {
      expect(img).toHaveAttribute("loading", "lazy");
    });
  });

  it("should use photo caption as alt text when available", () => {
    render(<SessionCardPhotos photos={mockPhotos} />);

    const images = screen.getAllByRole("img");
    expect(images[0]).toHaveAttribute("alt", "First photo");
    expect(images[1]).toHaveAttribute("alt", "Second photo");
    expect(images[2]).toHaveAttribute("alt", "Third photo");
  });

  it("should use default alt text when caption not available", () => {
    const photosWithoutCaptions: SessionPhoto[] = [
      {
        id: "photo-1",
        public_url: "https://example.com/photo1.jpg",
      },
      {
        id: "photo-2",
        public_url: "https://example.com/photo2.jpg",
      },
    ];

    render(<SessionCardPhotos photos={photosWithoutCaptions} />);

    const images = screen.getAllByRole("img");
    expect(images[0]).toHaveAttribute("alt", "Session photo 1");
    expect(images[1]).toHaveAttribute("alt", "Session photo 2");
  });

  it("should apply custom className when provided", () => {
    const { container } = render(
      <SessionCardPhotos photos={mockPhotos} className="custom-class" />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("custom-class");
  });

  it("should respect maxDisplay prop", () => {
    render(<SessionCardPhotos photos={mockPhotos} maxDisplay={2} />);

    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(2);
  });

  it("should show camera icon in badge", () => {
    const { container } = render(<SessionCardPhotos photos={mockPhotos} />);

    // Check for camera icon (lucide-react Camera component)
    const cameraIcon = container.querySelector('svg');
    expect(cameraIcon).toBeInTheDocument();
  });

  it("should have hover effect classes", () => {
    const { container } = render(<SessionCardPhotos photos={mockPhotos} />);

    const photoGrid = screen.getByRole("button");
    expect(photoGrid).toHaveClass("group");
    expect(photoGrid).toHaveClass("cursor-pointer");
  });

  it("should render with correct tabIndex for keyboard accessibility", () => {
    render(<SessionCardPhotos photos={mockPhotos} />);

    const photoGrid = screen.getByRole("button");
    expect(photoGrid).toHaveAttribute("tabIndex", "0");
  });
});
