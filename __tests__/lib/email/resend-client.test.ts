// Mock Resend before any imports
const mockSend = jest.fn();
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: mockSend,
    },
  })),
}));

describe('resend-client', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.RESEND_API_KEY = 'test-api-key';
    process.env.EMAIL_FROM_ADDRESS = 'test@example.com';
    mockSend.mockResolvedValue({ data: { id: 'email-123' }, error: null });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getResendClient', () => {
    it('creates a Resend client', async () => {
      const { getResendClient } = await import('@/lib/email/resend-client');
      const client = getResendClient();
      expect(client).toBeDefined();
    });

    it('throws when RESEND_API_KEY is not set', async () => {
      delete process.env.RESEND_API_KEY;
      const { getResendClient } = await import('@/lib/email/resend-client');
      expect(() => getResendClient()).toThrow('RESEND_API_KEY environment variable is not set');
    });
  });

  describe('getFromAddress', () => {
    it('returns the from address', async () => {
      const { getFromAddress } = await import('@/lib/email/resend-client');
      expect(getFromAddress()).toBe('test@example.com');
    });

    it('throws when EMAIL_FROM_ADDRESS is not set', async () => {
      delete process.env.EMAIL_FROM_ADDRESS;
      const { getFromAddress } = await import('@/lib/email/resend-client');
      expect(() => getFromAddress()).toThrow('EMAIL_FROM_ADDRESS environment variable is not set');
    });
  });

  describe('sendEmail', () => {
    it('sends an email successfully', async () => {
      const { sendEmail } = await import('@/lib/email/resend-client');
      const result = await sendEmail({
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<p>Test body</p>',
      });

      expect(result.success).toBe(true);
      expect(result.id).toBe('email-123');
    });

    it('returns error when Resend API returns an error', async () => {
      mockSend.mockResolvedValue({
        data: null,
        error: { message: 'Rate limit exceeded' }
      });

      const { sendEmail } = await import('@/lib/email/resend-client');
      const result = await sendEmail({
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<p>Test body</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Rate limit exceeded');
    });

    it('returns error when an exception is thrown', async () => {
      mockSend.mockRejectedValue(new Error('Network error'));

      const { sendEmail } = await import('@/lib/email/resend-client');
      const result = await sendEmail({
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<p>Test body</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });
});
