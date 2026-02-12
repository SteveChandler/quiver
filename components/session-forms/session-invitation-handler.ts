/**
 * Fire-and-forget session invitation sending.
 * Extracted from SessionForm.tsx to reduce component complexity.
 */

import { toast } from "sonner";

/**
 * Send session invitations to invitees. Fire-and-forget — does not throw.
 */
export async function sendSessionInvitations(
  sessionId: string,
  invitees: Array<{ userId?: string; email?: string; name?: string }>,
  message?: string
): Promise<void> {
  try {
    const response = await fetch("/api/session-planner/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        invitees,
        message,
      }),
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.success) {
      const errMessage =
        payload?.error ||
        (typeof payload?.details === "string"
          ? payload.details
          : response.statusText) ||
        "Failed to send invitations";
      console.error("Invitation API error:", errMessage, payload);
      toast.error("Failed to send invitations");
      return;
    }

    const inviteErrors: string[] = payload?.data?.errors ?? [];
    if (inviteErrors.length > 0) {
      console.warn("Invitation warnings:", inviteErrors);
      toast.warning(inviteErrors[0]);
    }
  } catch (invitationError) {
    console.error("Error sending invitations:", invitationError);
    toast.error("Failed to send invitations");
  }
}
