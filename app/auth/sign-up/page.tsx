import { Suspense } from "react";
import { cookies } from "next/headers";
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
 * When an `invite_token` query param is present (set by /invite/[token] →
 * /auth/sign-up redirect, or direct links that include it), writes the token
 * to an HTTP-only cookie before rendering the client-side auth modal. The
 * cookie is later consumed by /auth/callback (email confirmation) or by
 * /invite/consume (post-signup web redirect).
 */
export default async function SignUpPage({ searchParams }: Props) {
  const params = await searchParams;
  const inviteToken = params.invite_token;

  if (inviteToken) {
    const cookieStore = await cookies();
    cookieStore.set("invite_token", inviteToken, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
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
