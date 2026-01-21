import { getResendClient, sendEmail } from '@/lib/email/resend-client';

// Mock Resend
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ data: { id: 'email-123' }, error: null }),
    },
  })),
}));

process.env.RESEND_API_KEY = 'test-api-key';
process.env.EMAIL_FROM_ADDRESS = 'test@example.com';

describe('resend-client', () => {
  describe('getResendClient', () => {
    it('creates a Resend client', () => {
      const client = getResendClient();
      expect(client).toBeDefined();
    });
  });

  describe('sendEmail', () => {
    it('sends an email successfully', async () => {
      const result = await sendEmail({
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<p>Test body</p>',
      });

      expect(result.success).toBe(true);
      expect(result.id).toBe('email-123');
    });
  });
});
