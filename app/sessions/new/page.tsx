import type { ReactElement } from "react";
import { verifyEmailActionToken } from "@/lib/email/verify-email-action";
import { SessionEmailLogFallback } from "@/app/session/log/SessionEmailLogFallback";
import { NewSessionClientPage } from "./NewSessionClientPage";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

interface NewSessionPageProps {
  searchParams?: SearchParams;
}

function firstParam(
  searchParams: Awaited<SearchParams>,
  key: string
): string | undefined {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

function EmailTokenErrorPage({
  title,
  message,
}: {
  title: string;
  message: string;
}): ReactElement {
  return (
    <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md">
        <div className="text-4xl mb-4">❌</div>
        <h1 className="text-xl font-semibold text-red-600 mb-2">{title}</h1>
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
}

export default async function NewSessionPage({
  searchParams,
}: NewSessionPageProps): Promise<ReactElement> {
  const resolvedSearchParams = (await searchParams) ?? {};
  const token = firstParam(resolvedSearchParams, "token");

  if (token === undefined) {
    return <NewSessionClientPage />;
  }

  const verification = await verifyEmailActionToken(token, "log_session");
  if (!verification.success) {
    const title =
      verification.errorType === "config"
        ? "Configuration Error"
        : "Invalid Link";

    return (
      <EmailTokenErrorPage
        title={title}
        message={verification.error}
      />
    );
  }

  return (
    <SessionEmailLogFallback
      token={token}
      beachId={
        firstParam(resolvedSearchParams, "beach_id") ??
        firstParam(resolvedSearchParams, "beach") ??
        null
      }
      windowStart={
        firstParam(resolvedSearchParams, "window") ??
        firstParam(resolvedSearchParams, "window_start") ??
        firstParam(resolvedSearchParams, "startTime") ??
        null
      }
      beachName={
        firstParam(resolvedSearchParams, "beach_name") ??
        firstParam(resolvedSearchParams, "beachName") ??
        "your session"
      }
      score={firstParam(resolvedSearchParams, "score")}
    />
  );
}
