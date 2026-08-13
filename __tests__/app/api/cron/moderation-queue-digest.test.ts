import { GET } from "@/app/api/cron/moderation-queue-digest/route";

jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));

const mockFrom = jest.fn();
const mockSendEmail = jest.fn();
const mockValidateCronRequest = jest.fn(() => true);

jest.mock("@/lib/cron/observability", () => ({
  withObservedCron: (_route: string, handler: (request: Request) => Promise<Response>) => handler,
}));

jest.mock("@/lib/middleware/api-wrappers", () => ({
  ...jest.requireActual("@/lib/middleware/api-wrappers"),
  validateCronRequest: () => mockValidateCronRequest(),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(async () => ({ from: mockFrom })),
}));

jest.mock("@/lib/mailer/client", () => ({
  MAIL_FROM: "Quiver <test@quiversurf.app>",
  MAIL_REPLY_TO: "Quiver <test@quiversurf.app>",
  getBaseUrl: () => "https://www.quiversurf.app",
  sendEmail: (...args: any[]) => mockSendEmail(...args),
}));

function query(result: unknown): Record<string, jest.Mock> & PromiseLike<unknown> {
  const builder = {} as Record<string, jest.Mock>;
  for (const method of ["select", "is", "in", "eq", "contains"]) {
    builder[method] = jest.fn(() => builder);
  }
  (builder as Record<string, unknown>).then = (
    resolve?: (value: unknown) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return builder as Record<string, jest.Mock> & PromiseLike<unknown>;
}

function request(): Request {
  return new Request("https://www.quiversurf.app/api/cron/moderation-queue-digest");
}

describe("moderation queue digest cron", () => {
  const originalStartDate = process.env.MODERATION_QUEUE_DIGEST_START_DATE;
  const originalRecipient = process.env.MODERATION_QUEUE_NOTIFY_TO;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    process.env.MODERATION_QUEUE_DIGEST_START_DATE = "2026-08-17";
    process.env.MODERATION_QUEUE_NOTIFY_TO = "moderator@example.com";
    mockValidateCronRequest.mockReturnValue(true);
    mockSendEmail.mockResolvedValue({ data: { id: "email-1" }, error: null });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    if (originalStartDate === undefined) delete process.env.MODERATION_QUEUE_DIGEST_START_DATE;
    else process.env.MODERATION_QUEUE_DIGEST_START_DATE = originalStartDate;
    if (originalRecipient === undefined) delete process.env.MODERATION_QUEUE_NOTIFY_TO;
    else process.env.MODERATION_QUEUE_NOTIFY_TO = originalRecipient;
  });

  it("rejects unauthorized cron calls", async () => {
    mockValidateCronRequest.mockReturnValue(false);

    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("does not run before the configured start date", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-13T16:00:00.000Z"));
    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.skipped).toBe("not_started");
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it("emails separate photo and video counts for pending media", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-18T16:00:00.000Z"));
    mockFrom
      .mockReturnValueOnce(
        query({
          data: [
            { id: "photo-1", media_type: "photo" },
            { id: "video-1", media_type: "video" },
          ],
          error: null,
        }),
      )
      .mockReturnValueOnce(
        query({
          data: [{ id: "photo-legacy", media_type: "photo" }],
          error: null,
        }),
      )
      .mockReturnValueOnce(
        query({
          data: [{ id: "beach-photo-1" }],
          error: null,
        }),
      );

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.summary).toEqual({ pendingPhotos: 3, pendingVideos: 1, total: 4 });
    expect(body.data.notified).toBe(true);
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "moderator@example.com",
        subject: "[Quiver Mod] 4 items awaiting review",
        text: expect.stringContaining("Review videos: https://www.quiversurf.app/admin/session-videos"),
      }),
    );
    jest.useRealTimers();
  });

  it("does not email when the queue is empty", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-18T16:00:00.000Z"));
    mockFrom
      .mockReturnValueOnce(query({ data: [], error: null }))
      .mockReturnValueOnce(query({ data: [], error: null }))
      .mockReturnValueOnce(query({ data: [], error: null }));

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.skipped).toBe("empty_queue");
    expect(mockSendEmail).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
});
