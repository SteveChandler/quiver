import { uploadSessionPhoto } from "@/lib/supabase/storage";

function createSupabaseMock() {
  const upload = jest.fn().mockResolvedValue({ data: { path: "session/photo.jpg" }, error: null });
  const rpc = jest.fn().mockResolvedValue({ data: null, error: null });
  const client = {
    from: jest.fn(() => ({
      select: () => ({
        eq: () => ({ single: async () => ({ data: { total_bytes: 0, image_count: 0 }, error: null }) }),
      }),
    })),
    storage: {
      from: jest.fn(() => ({
        upload,
        getPublicUrl: () => ({ data: { publicUrl: "https://example.com/photo.jpg" } }),
      })),
    },
    rpc,
  };
  return { client, upload, rpc };
}

describe("session photo storage", () => {
  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it("uploads the original file and accounts for its size", async () => {
    const file = new File(["photo"], "photo.png", { type: "image/png" });
    const { client, upload, rpc } = createSupabaseMock();

    const result = await uploadSessionPhoto(file, "session", "user", client as any);

    expect(result).toMatchObject({ success: true, fileSize: file.size });
    expect(upload).toHaveBeenCalledWith(expect.any(String), file, expect.any(Object));
    expect(rpc).toHaveBeenCalledWith("update_user_storage_usage", expect.objectContaining({ p_bytes_to_add: file.size }));
  });

  it("rejects files above the storage limit before upload", async () => {
    const file = new File(["x".repeat(6 * 1024 * 1024)], "large.jpg", { type: "image/jpeg" });
    const { client, upload } = createSupabaseMock();

    const result = await uploadSessionPhoto(file, "session", "user", client as any);

    expect(result.success).toBe(false);
    expect(result.error).toContain("under 5MB");
    expect(upload).not.toHaveBeenCalled();
  });
});
