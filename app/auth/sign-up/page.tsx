import { Suspense } from "react";
import { redirect } from "next/navigation";
import { buildInviteStartPath } from "@/lib/invites/consume";
import SignUpClient from "./sign-up-client";

interface Props {
  searchParams: Promise<{
    invite_token?: string;
    redirectTo?: string;
    redirectUrl?: string;
  }>;
}

/**
 * Server-side sign-up page entry.
 *
 * Direct legacy links with an `invite_token` query param are redirected through
 * /invite/start so a Route Handler owns the HTTP-only cookie write.
 */
export default async function SignUpPage({ searchParams }: Props) {
  const params = await searchParams;
  const inviteToken = params.invite_token;

  if (inviteToken) {
    redirect(buildInviteStartPath(inviteToken));
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen w-full items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <SignUpClient />
    </Suspense>
  );
}
