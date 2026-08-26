import { buildProfileShareMetadata } from "@/app/profile/[id]/page";

describe("profile share metadata", () => {
  it("uses concise profile-specific copy and the current square app icon", () => {
    const metadata = buildProfileShareMetadata(
      "bcacdc51-b01b-4702-ac0b-fb492c0a926a",
      {
        full_name: "Shapan Dashore",
        session_count: 12,
      },
    );

    expect(metadata.title).toEqual({ absolute: "Shapan Dashore on Quiver" });
    expect(metadata.description).toBe(
      "See Shapan Dashore's 12 surf sessions on Quiver.",
    );
    expect(metadata.alternates?.canonical).toContain(
      "/profile/bcacdc51-b01b-4702-ac0b-fb492c0a926a",
    );
    expect(metadata.openGraph).toMatchObject({
      title: "Shapan Dashore on Quiver",
      description: "See Shapan Dashore's 12 surf sessions on Quiver.",
      images: [
        expect.objectContaining({
          url: expect.stringContaining("/quiver-app-icon.png"),
          width: 1024,
          height: 1024,
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
        url: expect.stringContaining("/quiver-app-icon.png"),
        width: 1024,
        height: 1024,
      }),
    ]);
  });
});
