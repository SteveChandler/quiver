import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EmbedFigureSnippet } from "@/components/learn/figures/embed-figure-snippet";

describe("EmbedFigureSnippet", () => {
  it("renders an iframe snippet pointing at the embed route for the figure", () => {
    render(<EmbedFigureSnippet figureKey={"swell-period-morph" as never} />);
    const code = screen.getByText(/embed\/learn\/swell-period-morph/);
    expect(code.textContent).toContain("https://www.quiversurf.app/embed/learn/swell-period-morph");
    expect(code.textContent).toContain("<iframe");
  });

  it("copies the snippet to the clipboard and confirms on click", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<EmbedFigureSnippet figureKey={"swell-origin-fetch" as never} />);
    fireEvent.click(screen.getByRole("button", { name: /copy embed code/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toContain("/embed/learn/swell-origin-fetch");
    expect(await screen.findByText(/copied/i)).toBeInTheDocument();
  });
});
