/**
 * Resend Email Client
 *
 * Wrapper around Resend SDK for sending emails.
 */

import { Resend } from 'resend';

let resendClient: Resend | null = null;

export function getResendClient(): Resend {
  if (
    process.env.E2E_ALLOW_EMAIL_SENDS !== 'true' &&
    (process.env.PLAYWRIGHT_TEST === 'true' ||
      process.env.NEXT_PUBLIC_E2E_DISABLE_EMAIL_SENDS === 'true')
  ) {
    return {
      emails: {
        async send() {
          return { data: { id: `e2e-email-${crypto.randomUUID()}` }, error: null };
        },
      },
    } as unknown as Resend;
  }

  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export function getFromAddress(): string {
  const from = process.env.MAIL_FROM;
  if (!from) {
    throw new Error('MAIL_FROM environment variable is not set');
  }
  return from;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  try {
    const client = getResendClient();
    const from = getFromAddress();

    const { data, error } = await client.emails.send({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}
