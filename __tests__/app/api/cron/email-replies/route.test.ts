/** @jest-environment node */
import { GET } from '@/app/api/cron/email-replies/route';
import * as Sentry from '@sentry/nextjs';
import { GmailReplyBackoffError, syncGmailReplies } from '@/lib/email/gmail-replies';
import { validateCronRequest } from '@/lib/middleware/api-wrappers';
import { completeCronCheckIn } from '@/lib/monitoring/sentry-cron';
const mockUpdate = jest.fn();
const mockFinish = jest.fn();
const mockStart = jest.fn();
jest.mock('@/lib/middleware/api-wrappers', () => ({ validateCronRequest: jest.fn() }));
jest.mock('@/lib/email/gmail-replies', () => ({ ...jest.requireActual('@/lib/email/gmail-replies'), syncGmailReplies: jest.fn() }));
jest.mock('@/lib/email/lifecycle', () => ({ lifecycleRpc: jest.fn() }));
jest.mock('@/lib/supabase/server', () => ({ createSupabaseServiceRoleClient: async () => ({ from: () => ({ insert: () => ({ select: () => ({ single: mockStart }) }), update: mockUpdate }) }) }));
jest.mock('@/lib/monitoring/sentry-cron', () => ({ startCronCheckIn: () => 'check-in', completeCronCheckIn: jest.fn() }));
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }));
beforeEach(() => {
  jest.resetAllMocks();
  process.env.EMAIL_GMAIL_REPLY_SYNC_ENABLED='true';
  jest.mocked(validateCronRequest).mockReturnValue(true);
  mockStart.mockResolvedValue({data:{id:'run'},error:null});
  mockUpdate.mockReturnValue({eq:mockFinish});mockFinish.mockResolvedValue({error:null});
});
afterEach(() => { delete process.env.EMAIL_GMAIL_REPLY_SYNC_ENABLED; });
it('rejects unauthenticated requests before touching Gmail or the ledger', async () => {
  jest.mocked(validateCronRequest).mockReturnValue(false);
  expect((await GET(new Request('http://localhost/api/cron/email-replies'))).status).toBe(401);
  expect(syncGmailReplies).not.toHaveBeenCalled();expect(mockStart).not.toHaveBeenCalled();
});
it.each(['gmail_message_gaps_unresolved','gmail_history_expired'])('makes %s visible without claiming a healthy run', async code => {
  jest.mocked(syncGmailReplies).mockRejectedValue(new Error(code));
  const response=await GET(new Request('http://localhost/api/cron/email-replies'));
  expect(response.status).toBe(503);expect(await response.json()).toMatchObject({code});
  expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({status:'error'}));
  expect(completeCronCheckIn).toHaveBeenLastCalledWith(expect.anything(),'email-replies','error');
  expect(Sentry.captureException).toHaveBeenCalledWith(new Error(code),{tags:{operation:'gmail_reply_sync'}});
});
it('never sends a raw provider error to monitoring or HTTP responses', async () => {
  jest.mocked(syncGmailReplies).mockRejectedValue(new Error('token=secret sender@example.com'));
  const response=await GET(new Request('http://localhost/api/cron/email-replies'));
  expect(await response.json()).toMatchObject({code:'gmail_unexpected_error'});
  expect(Sentry.captureException).toHaveBeenCalledWith(new Error('gmail_unexpected_error'),expect.anything());
});

it('returns retry timing without duplicate exception alerts or claiming health', async () => {
  jest.mocked(syncGmailReplies).mockRejectedValue(new GmailReplyBackoffError(480));
  const response=await GET(new Request('http://localhost/api/cron/email-replies'));
  expect(response.status).toBe(503);
  expect(response.headers.get('Retry-After')).toBe('480');
  expect(await response.json()).toMatchObject({code:'gmail_retry_backoff'});
  expect(Sentry.captureException).not.toHaveBeenCalled();
  expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({status:'error'}));
  expect(completeCronCheckIn).toHaveBeenLastCalledWith('check-in','email-replies','error');
});
