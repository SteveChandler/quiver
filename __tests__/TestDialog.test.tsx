import { render, screen, fireEvent } from "@testing-library/react";
import { TestDialog } from "@/components/test-dialog";

// Create a custom wrapper to handle the dialog portal
const customRender = (ui, options = {}) => {
  // Create a div that Dialog will portal into
  const portalRoot = document.createElement("div");
  portalRoot.setAttribute("id", "radix-dialog-portal");
  document.body.appendChild(portalRoot);

  return render(ui, options);
};

describe("TestDialog Component", () => {
  afterEach(() => {
    // Clean up any portals after each test
    const portalRoot = document.getElementById("radix-dialog-portal");
    if (portalRoot) {
      document.body.removeChild(portalRoot);
    }
  });

  it("renders the dialog trigger button", () => {
    customRender(<TestDialog />);

    const button = screen.getByRole("button", { name: /open dialog/i });
    expect(button).toBeInTheDocument();
  });

  it("opens the dialog when button is clicked", () => {
    customRender(<TestDialog />);

    // Initially dialog content should not be in the document
    expect(screen.queryByText("Test Dialog")).not.toBeInTheDocument();

    // Click the button to open dialog
    const button = screen.getByRole("button", { name: /open dialog/i });
    fireEvent.click(button);

    // Now dialog content should be in the document
    expect(screen.getByText("Test Dialog")).toBeInTheDocument();
    expect(screen.getByText("This is a test dialog")).toBeInTheDocument();
  });
});
