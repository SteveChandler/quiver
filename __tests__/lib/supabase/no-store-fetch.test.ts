import { createNoStoreFetch } from "@/lib/supabase";

describe("createNoStoreFetch", () => {
  it("forces cache: no-store while preserving caller headers", async () => {
    const baseFetch = jest.fn(async (_input: any, _init?: any) => new Response("ok"));
    const wrapped = createNoStoreFetch(baseFetch as unknown as typeof fetch);

    await wrapped("https://example.com", {
      cache: "force-cache",
      headers: {
        "x-test": "1",
      },
    });

    expect(baseFetch).toHaveBeenCalledTimes(1);
    const passedInit = baseFetch.mock.calls[0]?.[1];

    expect(passedInit.cache).toBe("no-store");

    const headers = new Headers(passedInit.headers);
    expect(headers.get("x-test")).toBe("1");
    expect(headers.get("cache-control")).toBe("no-store");
    expect(headers.get("pragma")).toBe("no-cache");
  });
});


