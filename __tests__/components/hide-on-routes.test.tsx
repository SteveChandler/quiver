import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { HideOnRoutes } from "@/components/hide-on-routes";

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
}));

function renderGate(pathname: string) {
  (usePathname as jest.Mock).mockReturnValue(pathname);
  return render(
    <HideOnRoutes exact={["/"]} prefixes={["/map"]}>
      <footer>site footer</footer>
    </HideOnRoutes>,
  );
}

describe("HideOnRoutes", () => {
  it("renders children on routes outside the hide lists", () => {
    renderGate("/ca/carlsbad/terramar-point");
    expect(screen.getByText("site footer")).toBeInTheDocument();
  });

  it("hides children on an exact match and a prefix match", () => {
    renderGate("/");
    expect(screen.queryByText("site footer")).not.toBeInTheDocument();

    renderGate("/map");
    expect(screen.queryByText("site footer")).not.toBeInTheDocument();
  });

  // Next's ISR render of the root page reports "/index". If the server shows
  // the footer there while the browser (at "/") hides it, hydration leaves an
  // unowned <footer> in <body> that later lands above the header on /map.
  it("treats the ISR root pathname /index as /", () => {
    renderGate("/index");
    expect(screen.queryByText("site footer")).not.toBeInTheDocument();
  });
});
