import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildPartnerAppSchemeUrl,
  buildPartnerQrUrl,
  isValidPartnerCode,
} from "@/lib/partner/partner-qr-url";
import { fetchPartnerByReferralCode } from "@/lib/partner/partner-profile";
import { PartnerQrLandingClient } from "./partner-qr-landing-client";

interface PartnerPageProps {
  params: Promise<{ partnerCode: string }>;
}

/**
 * /p/[partnerCode]
 *
 * Attributed partner-QR landing. A partner (surf shop / instructor / business)
 * prints this URL as a QR; a surfer scans it and lands here to install Quiver.
 * Attribution rides on `utm_content=<partnerCode>`, threaded into the landing's
 * anonymous-allowed handoff events — reusing the existing referrals spine, no
 * schema change.
 *
 * Server component; read-only, no cookie mutation.
 */
export default async function PartnerPage({ params }: PartnerPageProps) {
  const { partnerCode } = await params;

  if (!isValidPartnerCode(partnerCode)) {
    redirect("/");
  }

  const code = partnerCode.toUpperCase();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const supabase = await createSupabaseServerClient();
  const partner = await fetchPartnerByReferralCode(supabase, code);

  const qrUrl = buildPartnerQrUrl({ partnerCode: code, siteUrl });

  return (
    <PartnerQrLandingClient
      partnerCode={code}
      partnerName={partner?.name ?? null}
      qrUrl={qrUrl}
      appSchemeUrl={buildPartnerAppSchemeUrl(code)}
      startPath={`/?ref=${code}&utm_source=partner_qr&utm_content=${code}`}
      utm={{
        utm_source: "partner_qr",
        utm_medium: "partner_qr",
        utm_campaign: "partner_access",
        utm_content: code,
      }}
    />
  );
}
