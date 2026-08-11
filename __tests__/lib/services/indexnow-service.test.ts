import { SITE_URL } from "@/lib/constants/seo";
import {
  submitUrlsInBatches,
  submitUrlsToIndexNow,
} from "@/lib/services/indexnow-service";

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

  // Observed against the live API on 2026-08-10: a key that does not match the
  // verification file returns 403 *or* 202, not reliably an error. Counting 202
  // as delivered made a wrong key indistinguishable from a working one.
  describe("delivery accounting", () => {
    const urls = [`${SITE_URL}/water-temp/corolla`];

    function mockStatus(status: number) {
      global.fetch = jest
        .fn()
        .mockResolvedValue({ status }) as unknown as typeof fetch;
    }

    beforeEach(() => {
      process.env.INDEXNOW_KEY = "test-indexnow-key";
    });

    it("counts a 200 as verified delivery", async () => {
      mockStatus(200);
      const result = await submitUrlsToIndexNow(urls);
      expect(result).toMatchObject({
        success: true,
        statusCode: 200,
        submitted: 1,
        pending: 0,
      });
    });

    it("counts a 202 as pending, not as delivered", async () => {
      mockStatus(202);
      const result = await submitUrlsToIndexNow(urls);
      expect(result).toMatchObject({
        success: true,
        statusCode: 202,
        submitted: 0,
        pending: 1,
      });
    });

    it("counts a 403 as neither delivered nor pending", async () => {
      mockStatus(403);
      const result = await submitUrlsToIndexNow(urls);
      expect(result).toMatchObject({
        success: false,
        statusCode: 403,
        submitted: 0,
        pending: 0,
      });
    });
  });

  describe("submitUrlsInBatches", () => {
    beforeEach(() => {
      process.env.INDEXNOW_KEY = "test-indexnow-key";
    });

    it("reports pending separately and warns instead of claiming delivery", async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue({ status: 202 }) as unknown as typeof fetch;

      const result = await submitUrlsInBatches([
        `${SITE_URL}/water-temp/corolla`,
        `${SITE_URL}/tide/monterey`,
      ]);

      expect(result.totalSubmitted).toBe(0);
      expect(result.totalPending).toBe(2);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([
        "Batch 1: HTTP 202 - key validation pending, delivery unconfirmed",
      ]);
      expect(result.batches[0].statusCode).toBe(202);
    });

    it("reports a verified batch with no warnings", async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue({ status: 200 }) as unknown as typeof fetch;

      const result = await submitUrlsInBatches([`${SITE_URL}/tide/monterey`]);

      expect(result.totalSubmitted).toBe(1);
      expect(result.totalPending).toBe(0);
      expect(result.warnings).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it("still records hard failures as errors", async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue({ status: 403 }) as unknown as typeof fetch;

      const result = await submitUrlsInBatches([`${SITE_URL}/tide/monterey`]);

      expect(result.totalSubmitted).toBe(0);
      expect(result.totalPending).toBe(0);
      expect(result.errors).toEqual(["Batch 1: HTTP 403"]);
    });
  });
});
