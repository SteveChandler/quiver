import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { PhotoSelectionSection } from "@/components/session-forms/PhotoSelectionSection";

// Mock file for testing
const createMockFile = (name: string, size: number, type: string) => {
  const file = new File([""], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
};

describe("PhotoSelectionSection", () => {
  const defaultProps = {
    mode: "log" as const,
    selectedFiles: [] as File[],
    onFilesChange: jest.fn(),
    disabled: false,
    maxPhotos: 5,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock URL.createObjectURL and revokeObjectURL
    global.URL.createObjectURL = jest.fn(() => "mock-url");
    global.URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders photo selection section for log mode", () => {
    render(<PhotoSelectionSection {...defaultProps} />);

    expect(screen.getByText("Session Photos")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Add photos from your surf session (optional - you can skip this)"
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Add session photos")).toBeInTheDocument();
    expect(
      screen.getByText(/Drag and drop or click to browse/)
    ).toBeInTheDocument();
  });

  it("shows default upload message when no files selected", () => {
    render(<PhotoSelectionSection {...defaultProps} />);

    expect(screen.getByText("Add session photos")).toBeInTheDocument();
  });

  it("renders file input element with correct attributes", () => {
    const { container } = render(<PhotoSelectionSection {...defaultProps} />);

    const fileInput = container.querySelector("input[type=file]");

    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute(
      "accept",
      "image/jpeg,image/jpg,image/png,image/webp"
    );
    expect(fileInput).toHaveAttribute("multiple");
  });

  it("shows correct max photos information", () => {
    render(<PhotoSelectionSection {...defaultProps} maxPhotos={3} />);

    expect(screen.getByText(/Max 3 photos/)).toBeInTheDocument();
  });

  it("handles disabled state correctly", () => {
    render(<PhotoSelectionSection {...defaultProps} disabled={true} />);

    const uploadArea = screen
      .getByText(/Drag and drop or click to browse/)
      .closest("div");
    expect(uploadArea?.closest(".cursor-not-allowed")).toBeInTheDocument();

    const chooseFilesButton = screen.getByRole("button", {
      name: /choose files/i,
    });
    expect(chooseFilesButton).toBeDisabled();
  });

  it("renders without errors when files are provided", () => {
    const mockFiles = [createMockFile("photo1.jpg", 1024 * 1024, "image/jpeg")];

    render(
      <PhotoSelectionSection {...defaultProps} selectedFiles={mockFiles} />
    );

    // Should render the upload area without errors
    expect(screen.getByText("Add session photos")).toBeInTheDocument();
  });

  // Previews live in local state and are only populated through the file input,
  // so the prop alone will not render them.
  const selectPhoto = (container: HTMLElement, name = "photo1.jpg") => {
    const fileInput = container.querySelector(
      "input[type=file]"
    ) as HTMLInputElement;
    const file = createMockFile(name, 1024 * 1024, "image/jpeg");
    fireEvent.change(fileInput, { target: { files: [file] } });
  };

  it("exposes a named remove control that is visible without hover", async () => {
    // Sessions get logged on a phone, where there is no hover state — a
    // reveal-on-hover remove button is unreachable there.
    const { container } = render(<PhotoSelectionSection {...defaultProps} />);
    selectPhoto(container);

    const remove = await screen.findByRole("button", {
      name: /remove photo photo1\.jpg/i,
    });
    expect(remove).toBeVisible();
    expect(remove.className).not.toMatch(/(^|\s)opacity-0(\s|$)/);
    expect(remove.className).not.toMatch(/group-hover:opacity-100/);
  });

  it("gives each preview image a descriptive alt", async () => {
    const { container } = render(<PhotoSelectionSection {...defaultProps} />);
    selectPhoto(container);

    expect(
      await screen.findByAltText("Selected photo: photo1.jpg")
    ).toBeInTheDocument();
  });

  it("handles drag and drop area rendering", () => {
    render(<PhotoSelectionSection {...defaultProps} />);

    const uploadArea = screen.getByText(/Add session photos/).closest("div");
    expect(uploadArea).toBeInTheDocument();

    // Should have drag and drop styling classes
    expect(uploadArea?.closest(".border-dashed")).toBeInTheDocument();
  });

  it("handles rerender with different props", () => {
    const { rerender } = render(<PhotoSelectionSection {...defaultProps} />);

    // Default state
    expect(screen.getByText("Add session photos")).toBeInTheDocument();

    // With disabled state
    rerender(<PhotoSelectionSection {...defaultProps} disabled={true} />);

    expect(
      screen.getByRole("button", { name: /choose files/i })
    ).toBeDisabled();
  });

  it("shows camera icon in upload area", () => {
    render(<PhotoSelectionSection {...defaultProps} />);

    // Check for camera icon by looking for SVG with camera path
    const cameraIcon = screen
      .getByText("Session Photos")
      .closest("div")
      ?.querySelector("svg");
    expect(cameraIcon).toBeInTheDocument();
  });
});
