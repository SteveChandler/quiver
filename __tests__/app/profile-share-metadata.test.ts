jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(),
  createSupabaseServiceRoleClient: jest.fn(),
}));

const { createSupabaseServerClient } = require("@/lib/supabase/server") as {
  createSupabaseServerClient: jest.Mock;
};
const { buildProfileShareMetadata, generateMetadata } = require(
  "@/app/profile/[id]/page",
) as typeof import("@/app/profile/[id]/page");

describe("profile share metadata", () => {
  it("uses concise profile-specific copy and the current social image", () => {
    const metadata = buildProfileShareMetadata(
      "bcacdc51-b01b-4702-ac0b-fb492c0a926a",
      {
        full_name: "Shapan Dashore",
      },
    );

    expect(metadata.title).toEqual({ absolute: "Shapan Dashore on Quiver" });
    expect(metadata.description).toBe(
      "See Shapan Dashore's surf profile on Quiver.",
    );
    expect(metadata.alternates?.canonical).toContain(
      "/profile/bcacdc51-b01b-4702-ac0b-fb492c0a926a",
    );
    expect(metadata.openGraph).toMatchObject({
      title: "Shapan Dashore on Quiver",
      description: "See Shapan Dashore's surf profile on Quiver.",
      images: [
        expect.objectContaining({
          url: expect.stringContaining(
            "/images/hero/quiver-landing-hero-social.jpg",
          ),
          width: 1200,
          height: 630,
        }),
      ],
    });
  });

  it("keeps fallback metadata concise and branded when profile lookup fails", () => {
    const metadata = buildProfileShareMetadata(
      "00000000-0000-4000-8000-000000000000",
      null,
    );

    expect(metadata.title).toEqual({ absolute: "Surfer profile on Quiver" });
    expect(metadata.description).toBe(
      "See this surfer's sessions and profile on Quiver.",
    );
    expect(metadata.openGraph?.images).toEqual([
      expect.objectContaining({
        url: expect.stringContaining(
          "/images/hero/quiver-landing-hero-social.jpg",
        ),
        width: 1200,
        height: 630,
      }),
    ]);
  });

  it("renders the surfer's display name in metadata", async () => {
    createSupabaseServerClient.mockResolvedValue({
      from: (table: string) => table === "profiles"
        ? {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: { full_name: "Shapan Dashore" },
                  error: null,
                }),
              }),
            }),
          }
        : {
            select: () => ({ eq: async () => ({ count: 0 }) }),
          },
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ id: "bcacdc51-b01b-4702-ac0b-fb492c0a926a" }),
    });

    expect(createSupabaseServerClient).toHaveBeenCalled();
    expect(metadata.title).toEqual({ absolute: "Shapan Dashore on Quiver" });
    expect(metadata.description).toContain("Shapan Dashore");
    expect(metadata.openGraph).toMatchObject({
      title: "Shapan Dashore on Quiver",
    });
  });
});
