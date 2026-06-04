import { render, screen } from "@testing-library/react";

import AppSpotHandoffPage, { metadata } from "@/app/app/spot/[slug]/page";
import { IOS_APP_STORE_URL } from "@/lib/constants/app-store";

describe("/app/spot/[slug] handoff page", () => {
  it("is noindexed so app-link fallback URLs do not create SEO canonicals", () => {
    expect(metadata.robots && typeof metadata.robots === "object").toBe(true);
    expect((metadata.robots as any).index).toBe(false);
    expect((metadata.robots as any).follow).toBe(false);
  });

  it("renders App Store and canonical web fallback links while preserving window context", async () => {
    const page = await AppSpotHandoffPage({
      params: Promise.resolve({ slug: "ocean-beach" }),
      searchParams: Promise.resolve({ window: "window-1" }),
    });

    render(page);

    expect(
      screen.getByRole("link", { name: /open in the app store/i })
    ).toHaveAttribute("href", IOS_APP_STORE_URL);
    expect(
      screen.getByRole("link", { name: /continue on web/i })
    ).toHaveAttribute("href", "/beach/ocean-beach");
    expect(screen.getByText(/window-1/i)).toBeInTheDocument();
  });
});
