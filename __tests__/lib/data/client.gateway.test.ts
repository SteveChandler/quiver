import { data } from "@/lib/data/client";

describe("lib/data/client gateway", () => {
  const originalFetch = global.fetch as unknown as jest.Mock;

  beforeEach(() => {
    (global.fetch as unknown as jest.Mock) = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
    (global.fetch as unknown as jest.Mock) = originalFetch;
  });

  describe("beaches.getAll", () => {
    it("requests /api/beaches and returns beaches array", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(
          JSON.stringify({ beaches: [{ id: "1", name: "A", latitude: 1, longitude: 2 }] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const beaches = await data.beaches.getAll();
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/beaches",
        expect.objectContaining({ method: "GET", headers: { "Content-Type": "application/json" }, cache: "no-store" })
      );
      expect(Array.isArray(beaches)).toBe(true);
      expect(beaches[0].id).toBe("1");
    });

    it("returns [] when payload shape missing", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } })
      );
      const beaches = await data.beaches.getAll();
      expect(beaches).toEqual([]);
    });

    it("throws on non-ok response", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response("bad", { status: 500 })
      );
      await expect(data.beaches.getAll()).rejects.toThrow("Failed to load beaches: 500");
    });
  });

  describe("sessions.likes", () => {
    it("getStatus GETs like status and maps output", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { liked: true, likesCount: 7 } }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
      const res = await data.sessions.likes.getStatus("sess-1");
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/sessions/sess-1/likes",
        expect.objectContaining({ method: "GET" })
      );
      expect(res).toEqual({ liked: true, likesCount: 7 });
    });

    it("toggle POSTs and returns json", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } })
      );
      const res = await data.sessions.likes.toggle("sess-1");
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/sessions/sess-1/likes/toggle",
        expect.objectContaining({ method: "POST" })
      );
      expect(await res).toEqual({ success: true });
    });

    it("throws on non-ok for getStatus and toggle", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(new Response("", { status: 404 }));
      await expect(data.sessions.likes.getStatus("x")).rejects.toThrow("Failed to load like status: 404");

      (global.fetch as jest.Mock).mockResolvedValueOnce(new Response("", { status: 500 }));
      await expect(data.sessions.likes.toggle("x")).rejects.toThrow("Failed to toggle like: 500");
    });
  });

  describe("sessions.comments", () => {
    it("listTopLevel GETs and returns comments array", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { comments: [{ id: "c1" }] } }), { status: 200, headers: { "Content-Type": "application/json" } })
      );
      const comments = await data.sessions.comments.listTopLevel("sess");
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/sessions/sess/comments",
        expect.objectContaining({ method: "GET" })
      );
      expect(comments).toEqual([{ id: "c1" }]);
    });

    it("create POSTs with content", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { id: "c2" } }), { status: 200, headers: { "Content-Type": "application/json" } })
      );
      const res = await data.sessions.comments.create("sess", "hi");
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/sessions/sess/comments",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ content: "hi" }) })
      );
      expect(await res).toEqual({ data: { id: "c2" } });
    });

    it("delete DELETEs comment", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } })
      );
      const res = await data.sessions.comments.delete("sess", "c1");
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/sessions/sess/comments/c1",
        expect.objectContaining({ method: "DELETE" })
      );
      expect(await res).toEqual({ success: true });
    });

    it("throws on non-ok", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(new Response("", { status: 500 }));
      await expect(data.sessions.comments.listTopLevel("s")).rejects.toThrow("Failed to load comments: 500");

      (global.fetch as jest.Mock).mockResolvedValueOnce(new Response("", { status: 500 }));
      await expect(data.sessions.comments.create("s", "c")).rejects.toThrow("Failed to create comment: 500");

      (global.fetch as jest.Mock).mockResolvedValueOnce(new Response("", { status: 404 }));
      await expect(data.sessions.comments.delete("s", "c")).rejects.toThrow("Failed to delete comment: 404");
    });
  });

  describe("users.profile.get", () => {
    it("GETs profile and returns data", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { id: "u1" } }), { status: 200, headers: { "Content-Type": "application/json" } })
      );
      const res = await data.users.profile.get("u1");
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/users/u1/profile",
        expect.objectContaining({ method: "GET" })
      );
      expect(res).toEqual({ id: "u1" });
    });

    it("throws on non-ok", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(new Response("", { status: 401 }));
      await expect(data.users.profile.get("u1")).rejects.toThrow("Failed to load profile: 401");
    });
  });

  describe("users.follow", () => {
    it("getStatusAndCounts maps booleans and counts", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { following: 1, followersCount: "3", followingCount: 4 } }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
      const res = await data.users.follow.getStatusAndCounts("u1");
      expect(res).toEqual({ following: true, followersCount: 3, followingCount: 4 });
    });

    it("toggle POSTs and unwraps server action payload", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: { success: true, data: { followId: "follow-123" } },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
      const res = await data.users.follow.toggle("u1");
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/users/u1/follow/toggle",
        expect.objectContaining({ method: "POST" })
      );
      expect(res).toEqual({ success: true, data: { followId: "follow-123" } });
    });

    it("throws on non-ok for both", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(new Response("", { status: 404 }));
      await expect(data.users.follow.getStatusAndCounts("u1")).rejects.toThrow("Failed to load follow status: 404");

      (global.fetch as jest.Mock).mockResolvedValueOnce(new Response("", { status: 500 }));
      await expect(data.users.follow.toggle("u1")).rejects.toThrow("Failed to toggle follow: 500");
    });
  });

  describe("users.comments.listByUser", () => {
    it("GETs and returns array", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { comments: [{ id: "c1" }] } }), { status: 200, headers: { "Content-Type": "application/json" } })
      );
      const res = await data.users.comments.listByUser("u1");
      expect(res).toEqual([{ id: "c1" }]);
    });

    it("throws on non-ok", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(new Response("", { status: 500 }));
      await expect(data.users.comments.listByUser("u1")).rejects.toThrow("Failed to load user comments: 500");
    });
  });

  describe("users.sessions.list", () => {
    it("uses default limit=5 and parses array", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { sessions: [{ id: "s1" }] } }), { status: 200, headers: { "Content-Type": "application/json" } })
      );
      const res = await data.users.sessions.list("u1");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/users\/u1\/sessions\?limit=5$/),
        expect.objectContaining({ method: "GET" })
      );
      expect(res).toEqual([{ id: "s1" }]);
    });

    it("accepts custom limit", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { sessions: [] } }), { status: 200, headers: { "Content-Type": "application/json" } })
      );
      await data.users.sessions.list("u1", 2);
      const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(url.endsWith("limit=2")).toBe(true);
    });

    it("throws on non-ok", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(new Response("", { status: 404 }));
      await expect(data.users.sessions.list("u1")).rejects.toThrow("Failed to load user sessions: 404");
    });
  });

  describe("comments.delete (root)", () => {
    it("DELETEs /api/comments/:id", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } })
      );
      const res = await data.comments.delete("c1");
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/comments/c1",
        expect.objectContaining({ method: "DELETE" })
      );
      expect(await res).toEqual({ ok: true });
    });

    it("throws on non-ok", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(new Response("", { status: 500 }));
      await expect(data.comments.delete("c1")).rejects.toThrow("Failed to delete comment: 500");
    });
  });

  describe("auth.updateEmail", () => {
    it("POSTs JSON body to update email", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } })
      );
      const res = await data.auth.updateEmail("a@example.com");
      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(options).toMatchObject({ method: "POST", headers: { "Content-Type": "application/json" } });
      expect(options!.body).toBe(JSON.stringify({ newEmail: "a@example.com" }));
      expect(await res).toEqual({ ok: true });
    });

    it("throws on non-ok", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(new Response("", { status: 400 }));
      await expect(data.auth.updateEmail("x")).rejects.toThrow("Failed to update email: 400");
    });
  });
});

