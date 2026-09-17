/** @jest-environment node */
import { checkGmailRepliesBeforeSend, gmailFailureCode } from "@/lib/email/gmail-replies";

const mockRpc = jest.fn();
jest.mock("@/lib/email/lifecycle", () => ({ lifecycleRpc: (...args: unknown[]) => mockRpc(...args) }));
const json = (value: unknown, status = 200): Response => new Response(JSON.stringify(value), { status });
const now = String(Date.now());
const incoming = { id: "m1", threadId: "t1", internalDate: now, payload: { headers: [
  { name: "From", value: "Surfer <surfer@example.com>" }, { name: "To", value: "Steve <steve@quiversurf.app>" }, { name: "In-Reply-To", value: "<sent-message>" },
] } };
const setup = (): void => { Object.assign(process.env, { EMAIL_GMAIL_ACCOUNT: "mail@gmail.com", EMAIL_REPLY_MAILBOX: "steve@quiversurf.app", EMAIL_GMAIL_CLIENT_ID: "fixture", EMAIL_GMAIL_CLIENT_SECRET: "fixture", EMAIL_GMAIL_REFRESH_TOKEN: "fixture" }); };
beforeEach(() => { jest.resetAllMocks(); setup(); });
afterEach(() => { for (const key of ["EMAIL_GMAIL_ACCOUNT", "EMAIL_REPLY_MAILBOX", "EMAIL_GMAIL_CLIENT_ID", "EMAIL_GMAIL_CLIENT_SECRET", "EMAIL_GMAIL_REFRESH_TOKEN", "EMAIL_GMAIL_REPLY_LABEL"]) delete process.env[key]; });

it("filters known IDs and records only an eligible sender addressed to the mailbox", async () => {
  mockRpc.mockResolvedValueOnce(["m1"]);
  const fetchMock = jest.fn().mockResolvedValueOnce(json({ access_token: "fixture" })).mockResolvedValueOnce(json({ emailAddress: "mail@gmail.com" }))
    .mockResolvedValueOnce(json({ labels: [{ id: "Label_1", name: "QUIVER-SUPPORT" }] })).mockResolvedValueOnce(json({ messages: [{ id: "known" }, { id: "m1" }] })).mockResolvedValueOnce(json(incoming));
  expect(await checkGmailRepliesBeforeSend(fetchMock)).toEqual({ checked: 1, recorded: 1 });
  expect(mockRpc).toHaveBeenNthCalledWith(1, "gmail_reply_known", { p_message_ids: ["known", "m1"] });
  expect(mockRpc).toHaveBeenNthCalledWith(2, "record_gmail_reply_v2", expect.objectContaining({ p_message_id: "m1", p_sender: "surfer@example.com" }));
  const urls = fetchMock.mock.calls.map(([url]) => String(url));
  expect(urls.every(url => !new URL(url).searchParams.has("q"))).toBe(true);
  expect(new URL(urls[3]).searchParams.get("labelIds")).toBe("Label_1");
});

it("skips a message deleted between list and metadata fetch", async () => {
  mockRpc.mockResolvedValueOnce(["gone"]);
  const fetchMock = jest.fn().mockResolvedValueOnce(json({ access_token: "fixture" })).mockResolvedValueOnce(json({ emailAddress: "mail@gmail.com" }))
    .mockResolvedValueOnce(json({ labels: [{ id: "label", name: "quiver-support" }] })).mockResolvedValueOnce(json({ messages: [{ id: "gone" }] })).mockResolvedValueOnce(json({}, 404));
  await expect(checkGmailRepliesBeforeSend(fetchMock)).resolves.toEqual({ checked: 1, recorded: 0 });
  expect(mockRpc).not.toHaveBeenCalledWith("record_gmail_reply_v2", expect.anything());
});

it.each([
  [{ ...incoming, labelIds: ["SENT"] }],
  [{ ...incoming, payload: { headers: [{ name: "From", value: "mail@gmail.com" }, { name: "To", value: "steve@quiversurf.app" }] } }],
  [{ ...incoming, payload: { headers: [{ name: "From", value: "surfer@example.com" }, { name: "To", value: "other@example.com" }] } }],
])("applies sender and recipient rules", async message => {
  mockRpc.mockResolvedValueOnce(["m1"]);
  const fetchMock = jest.fn().mockResolvedValueOnce(json({ access_token: "fixture" })).mockResolvedValueOnce(json({ emailAddress: "mail@gmail.com" }))
    .mockResolvedValueOnce(json({ labels: [{ id: "label", name: "quiver-support" }] })).mockResolvedValueOnce(json({ messages: [{ id: "m1" }] })).mockResolvedValueOnce(json(message));
  expect(await checkGmailRepliesBeforeSend(fetchMock)).toEqual({ checked: 1, recorded: 0 });
  expect(mockRpc).not.toHaveBeenCalledWith("record_gmail_reply_v2", expect.anything());
});

it("resolves the configured label and caps pagination at three pages", async () => {
  process.env.EMAIL_GMAIL_REPLY_LABEL = "QuIvEr-SuPpOrT";
  mockRpc.mockResolvedValueOnce([]);
  const fetchMock = jest.fn().mockResolvedValueOnce(json({ access_token: "fixture" })).mockResolvedValueOnce(json({ emailAddress: "mail@gmail.com" }))
    .mockResolvedValueOnce(json({ labels: [{ id: "label", name: "quiver-support" }] })).mockResolvedValueOnce(json({ messages: [{ id: "m1" }], nextPageToken: "2" })).mockResolvedValueOnce(json({ messages: [{ id: "m2" }], nextPageToken: "3" }))
    .mockResolvedValueOnce(json({ messages: [{ id: "m3" }], nextPageToken: "4" }));
  expect(await checkGmailRepliesBeforeSend(fetchMock)).toEqual({ checked: 0, recorded: 0 });
  expect(fetchMock).toHaveBeenCalledTimes(6);
  expect(fetchMock.mock.calls.slice(3).every(([url]) => !String(url).includes("q="))).toBe(true);
});

it("fails when the configured label is missing", async () => {
  const fetchMock = jest.fn().mockResolvedValueOnce(json({ access_token: "fixture" })).mockResolvedValueOnce(json({ emailAddress: "mail@gmail.com" }))
    .mockResolvedValueOnce(json({ labels: [{ id: "other", name: "other" }] }));
  await expect(checkGmailRepliesBeforeSend(fetchMock)).rejects.toThrow("gmail_label_missing");
  expect(gmailFailureCode(new Error("gmail_label_missing"))).toBe("gmail_label_missing");
});

it("propagates OAuth and Gmail failures", async () => {
  const fetchMock = jest.fn().mockResolvedValueOnce(json({}, 503));
  await expect(checkGmailRepliesBeforeSend(fetchMock)).rejects.toThrow("gmail_oauth_503");
  expect(gmailFailureCode(new TypeError("network"))).toBe("gmail_transport_error");
});
