import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { VoteButton } from "@/components/roadmap/VoteButton";

describe("<VoteButton/>", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders count and a thumbs-up icon", () => {
    render(<VoteButton itemId="abc" voteCount={7} viewerHasVoted={false} authed={true} />);
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
  });

  it("shows viewerHasVoted as pressed", () => {
    render(<VoteButton itemId="abc" voteCount={7} viewerHasVoted={true} authed={true} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("redirects to sign-in when unauthenticated user taps", async () => {
    const onSignInRequired = jest.fn();
    render(
      <VoteButton
        itemId="abc"
        voteCount={7}
        viewerHasVoted={false}
        authed={false}
        onSignInRequired={onSignInRequired}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(onSignInRequired).toHaveBeenCalledTimes(1));
  });

  it("optimistically increments count on click (authed, not yet voted)", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ voted: true }),
    } as Response);

    render(<VoteButton itemId="abc" voteCount={7} viewerHasVoted={false} authed={true} />);

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(screen.getByText("8")).toBeInTheDocument();
      expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
    });
  });

  it("rolls back count on fetch error", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
    } as Response);

    render(<VoteButton itemId="abc" voteCount={7} viewerHasVoted={false} authed={true} />);

    // Count starts at 7
    expect(screen.getByText("7")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button"));

    // Optimistic: goes to 8
    await waitFor(() => expect(screen.getByText("8")).toBeInTheDocument());

    // After error: rolls back to 7
    await waitFor(() => {
      expect(screen.getByText("7")).toBeInTheDocument();
      expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
    });
  });
});
