/**
 * @jest-environment node
 */

import LearnArticlePage from "@/app/learn/[slug]/page";
import { redirect } from "next/navigation";

jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    const error = new Error("NEXT_NOT_FOUND");
    (error as { digest?: string }).digest = "NEXT_NOT_FOUND";
    throw error;
  }),
  redirect: jest.fn((url: string) => {
    const error = new Error(`NEXT_REDIRECT:${url}`);
    (error as { digest?: string }).digest = "NEXT_REDIRECT";
    throw error;
  }),
}));

describe("learn article redirect aliases", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("redirects the surf-report alias to the canonical surf-conditions guide", async () => {
    await expect(
      LearnArticlePage({
        params: Promise.resolve({ slug: "how-to-read-a-surf-report" }),
      }),
    ).rejects.toMatchObject({ digest: "NEXT_REDIRECT" });

    expect(redirect).toHaveBeenCalledWith(
      "/learn/how-to-read-surf-conditions",
    );
  });
});
