import { SITE_URL } from "@/lib/constants/seo";
import { submitUrlsToIndexNow } from "@/lib/services/indexnow-service";

describe("IndexNow service", () => {
  const originalFetch = global.fetch;
  const originalIndexNowKey = process.env.INDEXNOW_KEY;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.INDEXNOW_KEY = originalIndexNowKey;
    jest.restoreAllMocks();
  });

  it("uses the public indexnow-key.txt verification location", async () => {
    process.env.INDEXNOW_KEY = "test-indexnow-key";
    const fetchMock = jest.fn().mockResolvedValue({ status: 202 });
    global.fetch = fetchMock as unknown as typeof fetch;

    await submitUrlsToIndexNow([`${SITE_URL}/ca/ventura/c-street-ventura-ca`]);

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(requestInit.body as string) as {
      keyLocation: string;
    };

    expect(body.keyLocation).toBe(`${SITE_URL}/indexnow-key.txt`);
  });
});
