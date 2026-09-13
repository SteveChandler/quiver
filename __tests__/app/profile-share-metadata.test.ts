/** @jest-environment node */
const mockGetUserMetadata = jest.fn();

describe("profile share metadata", () => {
  beforeEach(() => {
    jest.resetModules();
    mockGetUserMetadata.mockReset();
    jest.doMock("../../actions/profile-actions", () => ({ getUserMetadata: mockGetUserMetadata }));
  });

  it("uses concise profile-specific copy and the current square app icon", async () => {
    mockGetUserMetadata.mockResolvedValue({ success: true, data: { full_name: "Shapan Dashore" } } as any);
    const { generateMetadata } = await import("@/app/profile/[id]/page");
    const metadata = await generateMetadata({
      params: Promise.resolve({ id: "bcacdc51-b01b-4702-ac0b-fb492c0a926a" }),
    });
    expect(mockGetUserMetadata).toHaveBeenCalledWith("bcacdc51-b01b-4702-ac0b-fb492c0a926a");

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
          url: expect.stringContaining("/quiver-app-icon.png"),
          width: 1024,
          height: 1024,
        }),
      ],
    });
  });

  it.each(["missing", "rejected"])("keeps fallback metadata concise and branded for a %s lookup", async (outcome) => {
    if (outcome === "rejected") mockGetUserMetadata.mockRejectedValue(new Error("lookup unavailable"));
    else mockGetUserMetadata.mockResolvedValue({ success: false, data: null } as any);
    const { generateMetadata } = await import("@/app/profile/[id]/page");
    const metadata = await generateMetadata({
      params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000000" }),
    });
    expect(mockGetUserMetadata).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000000");

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
