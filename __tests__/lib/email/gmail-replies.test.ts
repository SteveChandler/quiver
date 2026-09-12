/** @jest-environment node */
import { syncGmailReplies } from "@/lib/email/gmail-replies";
const mockRpc = jest.fn();
jest.mock("@/lib/email/lifecycle", () => ({ lifecycleRpc: (...args: unknown[]) => mockRpc(...args) }));
const lease = { lease_id: "11111111-1111-4111-8111-111111111111", history_id: "100" };
const json = (value: unknown, status = 200): Response => new Response(JSON.stringify(value), { status });
const message = { id: "m1", threadId: "t1", internalDate: "1700000000000", payload: { headers: [
  { name: "From", value: 'Surfer <surfer@example.com>' }, { name: "To", value: "Steve <steve@quiversurf.app>" }, { name: "In-Reply-To", value: "<sent-message>" },
] } };
let fetchMock: jest.Mock;
beforeEach(() => {
  jest.resetAllMocks(); Object.assign(process.env, { EMAIL_GMAIL_REPLY_SYNC_ENABLED: "true", EMAIL_GMAIL_ACCOUNT: "mail@gmail.com", EMAIL_REPLY_MAILBOX: "steve@quiversurf.app", EMAIL_GMAIL_CLIENT_ID: "fixture", EMAIL_GMAIL_CLIENT_SECRET: "fixture", EMAIL_GMAIL_REFRESH_TOKEN: "fixture" });
  mockRpc.mockImplementation(async (name: string) => name === "claim_gmail_reply_sync" ? lease : null);
  fetchMock = jest.fn().mockResolvedValueOnce(json({ access_token: "fixture" })).mockResolvedValueOnce(json({ emailAddress: "mail@gmail.com" }))
    .mockResolvedValueOnce(json({ historyId: "102", history: [{ messagesAdded: [{ message: { id: "m1" } }, { message: { id: "m1" } }] }] })).mockResolvedValueOnce(json(message));
});
afterEach(() => { for (const key of ["EMAIL_GMAIL_REPLY_SYNC_ENABLED", "EMAIL_GMAIL_ACCOUNT", "EMAIL_REPLY_MAILBOX", "EMAIL_GMAIL_CLIENT_ID", "EMAIL_GMAIL_CLIENT_SECRET", "EMAIL_GMAIL_REFRESH_TOKEN"]) delete process.env[key]; });
it("reads metadata only and durably pauses a reply once before advancing history", async () => {
  expect(await syncGmailReplies(fetchMock)).toEqual({ processed: 1 });
  expect(mockRpc.mock.calls.map(c => c[0])).toEqual(["claim_gmail_reply_sync", "record_gmail_reply", "finish_gmail_reply_sync"]);
  expect(mockRpc.mock.calls[1][1]).toMatchObject({ p_message_id: "m1", p_thread_id: "t1", p_sender: "surfer@example.com", p_in_reply_to: "<sent-message>" });
  expect(mockRpc.mock.calls[2][1]).toEqual({ p_lease_id: lease.lease_id, p_history_id: "102", p_processed: 1 });
  expect(fetchMock.mock.calls[3][0]).toContain("format=metadata");
});
it("disabled mode does no OAuth or storage work", async () => {
  delete process.env.EMAIL_GMAIL_REPLY_SYNC_ENABLED;
  await expect(syncGmailReplies(fetchMock)).rejects.toThrow("disabled"); expect(mockRpc).not.toHaveBeenCalled(); expect(fetchMock).not.toHaveBeenCalled();
});
it.each([404, 429, 500])("history HTTP %i stops the cursor and records failure", async status => {
  fetchMock.mockReset().mockResolvedValueOnce(json({ access_token: "fixture" })).mockResolvedValueOnce(json({ emailAddress: "mail@gmail.com" })).mockResolvedValueOnce(json({}, status));
  await expect(syncGmailReplies(fetchMock)).rejects.toThrow();
  expect(mockRpc.mock.calls.map(c => c[0])).toEqual(["claim_gmail_reply_sync", status === 404 ? "fail_gmail_reply_sync" : "retryable_gmail_reply_failure"]);
});
it("a pause-write failure never acknowledges the history", async () => {
  mockRpc.mockImplementation(async name => { if (name === "record_gmail_reply") throw Error("write failed"); return lease; });
  await expect(syncGmailReplies(fetchMock)).rejects.toThrow("write failed");
  expect(mockRpc).not.toHaveBeenCalledWith("finish_gmail_reply_sync", expect.anything());
});
it("incomplete bounded pagination fails without skipping messages", async () => {
  fetchMock.mockReset().mockResolvedValueOnce(json({ access_token: "fixture" })).mockResolvedValueOnce(json({ emailAddress: "mail@gmail.com" })).mockImplementation(async () => json({ historyId: "105", nextPageToken: "more" }));
  await expect(syncGmailReplies(fetchMock)).rejects.toThrow("incomplete"); expect(fetchMock).toHaveBeenCalledTimes(7);
  expect(mockRpc).not.toHaveBeenCalledWith("finish_gmail_reply_sync", expect.anything());
});
it("does not treat sent mail as an incoming reply", async () => {
  fetchMock.mockReset().mockResolvedValueOnce(json({ access_token: "fixture" })).mockResolvedValueOnce(json({ emailAddress: "mail@gmail.com" }))
    .mockResolvedValueOnce(json({ historyId: "102", history: [{ messagesAdded: [{ message: { id: "m1" } }] }] })).mockResolvedValueOnce(json({ ...message, labelIds: ["SENT"] }));
  expect(await syncGmailReplies(fetchMock)).toEqual({ processed: 0 }); expect(mockRpc).not.toHaveBeenCalledWith("record_gmail_reply", expect.anything());
});
