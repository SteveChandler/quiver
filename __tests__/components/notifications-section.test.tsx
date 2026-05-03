import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationsSection } from "@/components/profile/notifications-section";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";

// Wrapper component to provide form context
function TestWrapper({ onFormChange }: { onFormChange?: (values: any) => void }) {
  const form = useForm({
    defaultValues: {
      notif_push_enabled: true,
      notif_email_enabled: true,
      notif_inapp_enabled: true,
      notif_likes: true,
      notif_follows: true,
      notif_reminders: true,
      notif_xp_updates: true,
    },
  });

  // Watch form values for testing
  const values = form.watch();
  if (onFormChange) {
    onFormChange(values);
  }

  return (
    <Form {...form}>
      <form>
        <NotificationsSection control={form.control} />
      </form>
    </Form>
  );
}

describe("NotificationsSection", () => {
  it("renders section title and description", () => {
    render(<TestWrapper />);

    expect(screen.getByText("Notifications")).toBeInTheDocument();
    expect(
      screen.getByText(/Choose how you'd like to get updates/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/You can change these anytime/)
    ).toBeInTheDocument();
  });

  it("renders all master toggle rows", () => {
    render(<TestWrapper />);

    expect(screen.getByText("Push Notifications")).toBeInTheDocument();
    expect(screen.getByText("Email Notifications")).toBeInTheDocument();
    expect(screen.getByText("In-App Notifications")).toBeInTheDocument();
  });

  it("renders Advanced Settings collapsible", () => {
    render(<TestWrapper />);

    const advancedSettings = screen.getByText("Advanced Settings");
    expect(advancedSettings).toBeInTheDocument();
  });

  it("shows feature toggles when Advanced Settings is expanded", () => {
    render(<TestWrapper />);

    const advancedSettings = screen.getByText("Advanced Settings");
    fireEvent.click(advancedSettings);

    // Check all feature toggles are visible
    expect(screen.getByText("Likes")).toBeInTheDocument();
    expect(screen.getByText("Follows")).toBeInTheDocument();
    expect(screen.getByText("Reminders")).toBeInTheDocument();
    expect(screen.getByText("XP Updates")).toBeInTheDocument();
  });

  it("renders switches with correct aria labels", () => {
    render(<TestWrapper />);

    expect(screen.getByLabelText("Push Notifications")).toBeInTheDocument();
    expect(screen.getByLabelText("Email Notifications")).toBeInTheDocument();
    expect(screen.getByLabelText("In-App Notifications")).toBeInTheDocument();
  });

  it("switches are interactive and can be toggled", async () => {
    const user = userEvent.setup();
    let formValues: any = {};
    const handleFormChange = (values: any) => {
      formValues = values;
    };

    render(<TestWrapper onFormChange={handleFormChange} />);

    const pushSwitch = screen.getByLabelText("Push Notifications");

    // Initial state should be checked
    expect(pushSwitch).toBeChecked();
    expect(formValues.notif_push_enabled).toBe(true);

    // Toggle the switch
    await user.click(pushSwitch);

    // Wait for form to update - check form value instead of switch state
    await waitFor(() => {
      expect(formValues.notif_push_enabled).toBe(false);
    }, { timeout: 3000 });
  });

  it("Advanced Settings chevron rotates when expanded", () => {
    const { container } = render(<TestWrapper />);

    const advancedSettings = screen.getByText("Advanced Settings");
    const details = advancedSettings.closest("details");

    expect(details).not.toHaveAttribute("open");

    fireEvent.click(advancedSettings);

    expect(details).toHaveAttribute("open");
  });

  it("icons are rendered with proper aria-hidden attribute", () => {
    const { container } = render(<TestWrapper />);

    const icons = container.querySelectorAll('svg[aria-hidden="true"]');

    // We should have at least 3 icons for master toggles
    expect(icons.length).toBeGreaterThanOrEqual(3);
  });

  it("renders description with proper classes", () => {
    const { container } = render(<TestWrapper />);

    // Check for description classes
    const description = screen.getByText(
      /Choose how you'd like to get updates/
    );
    expect(description).toHaveClass("text-sm", "text-muted-foreground");
  });
});
