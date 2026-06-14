import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";

const CONTEXT_TAG = "[email-suppression]";
const SUPPRESSION_LOOKUP_CHUNK_SIZE = 200;

export async function filterSuppressedRecipients<
  T extends { user_id: string; email: string },
>(supabase: SupabaseClient<Database>, recipients: T[]): Promise<T[]> {
  if (recipients.length === 0) {
    return recipients;
  }

  // Resend webhook storage normalizes suppression rows to lowercase.
  const lowercasedEmails = Array.from(
    new Set(recipients.map((recipient) => recipient.email.toLowerCase()))
  );

  try {
    const suppressedEmails = new Set<string>();

    for (
      let offset = 0;
      offset < lowercasedEmails.length;
      offset += SUPPRESSION_LOOKUP_CHUNK_SIZE
    ) {
      const emailChunk = lowercasedEmails.slice(
        offset,
        offset + SUPPRESSION_LOOKUP_CHUNK_SIZE
      );
      const { data, error } = await supabase
        .from("email_suppression_list")
        .select("email")
        .in("email", emailChunk);

      if (error) {
        console.error(
          `${CONTEXT_TAG} Failed to check email suppression list:`,
          error
        );
        return recipients;
      }

      for (const entry of data ?? []) {
        suppressedEmails.add(entry.email.toLowerCase());
      }
    }

    if (suppressedEmails.size === 0) {
      return recipients;
    }

    return recipients.filter(
      (recipient) => !suppressedEmails.has(recipient.email.toLowerCase())
    );
  } catch (error) {
    console.error(
      `${CONTEXT_TAG} Failed to check email suppression list:`,
      error
    );
    return recipients;
  }
}
