import type { Metadata } from "next";
import type { ReactElement } from "react";
import { QRCodeSVG } from "qrcode.react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildPartnerQrUrl,
  isValidPartnerCode,
} from "@/lib/partner/partner-qr-url";
import { fetchPartnerByReferralCode } from "@/lib/partner/partner-profile";

interface PartnerFlyerPageProps {
  params: Promise<{ partnerCode: string }>;
}

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

function partnerFlyerSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";
}

export default async function PartnerFlyerPage({
  params,
}: PartnerFlyerPageProps): Promise<ReactElement> {
  const { partnerCode } = await params;

  if (!isValidPartnerCode(partnerCode)) {
    redirect("/");
  }

  const code = partnerCode.toUpperCase();
  const siteUrl = partnerFlyerSiteUrl();
  const supabase = await createSupabaseServerClient();
  const partner = await fetchPartnerByReferralCode(supabase, code);
  const partnerLabel = partner?.name?.trim() || "A Quiver partner";
  const qrUrl = buildPartnerQrUrl({ partnerCode: code, siteUrl });

  return (
    <main className="partner-flyer zine-tab min-h-screen bg-[#252D6B] px-4 py-8 text-[#11100D] print:bg-white print:p-0">
      <style>{`
        @page {
          size: 8.5in 11in;
          margin: 0.35in;
        }

        @media print {
          body > footer,
          nav,
          [data-radix-toast-viewport],
          [data-sonner-toaster],
          .partner-flyer-print-hint {
            display: none !important;
          }

          .partner-flyer-sheet {
            min-height: 10.3in !important;
            box-shadow: none !important;
            transform: none !important;
          }
        }
      `}</style>

      <section className="partner-flyer-sheet mx-auto flex min-h-[10.3in] w-full max-w-[8.5in] flex-col overflow-hidden border-[3px] border-[#11100D] bg-[#F4EBD8] shadow-[12px_14px_0_rgba(17,16,13,0.35)] print:min-h-[10.3in] print:max-w-none print:border-0">
        <div className="partner-flyer-print-hint border-b-2 border-[#11100D] bg-[#F78E42] px-5 py-2 text-center font-heading text-xs font-black uppercase tracking-[0.12em] text-[#11100D]">
          Print on US Letter, scale 100%, portrait
        </div>

        <div className="grid flex-1 grid-rows-[auto_1fr_auto] gap-6 px-7 py-8 sm:px-10">
          <header className="flex items-start justify-between gap-5">
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-[0.18em]">
                Quiver x local surf call
              </p>
              <p className="mt-2 inline-block -rotate-1 bg-[#11100D] px-3 py-1 font-heading text-sm font-black uppercase tracking-[0.1em] text-[#F4EBD8]">
                {partnerLabel}
              </p>
            </div>
            <div className="rotate-3 border-2 border-[#11100D] bg-[#F78E42] px-3 py-2 text-right font-heading text-xs font-black uppercase leading-tight tracking-[0.1em] shadow-[3px_3px_0_#11100D]">
              Know
              <br />
              before
              <br />
              you go
            </div>
          </header>

          <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_2.35in]">
            <div>
              <h1 className="font-heading text-[clamp(3.25rem,9vw,6.35rem)] font-black uppercase leading-[0.86] tracking-normal">
                Scan for
                <br />
                the surf call
              </h1>
              <p className="mt-6 max-w-[5.8in] text-[clamp(1.2rem,2.4vw,1.65rem)] font-bold leading-tight">
                Check the tide, wind, swell, and local call before you load the
                board.
              </p>
              <div className="mt-7 grid max-w-[5.4in] gap-3 border-y-2 border-[#11100D] py-4 font-mono text-sm font-bold uppercase tracking-[0.08em] sm:grid-cols-3">
                <span>Dawn patrol</span>
                <span>Lunch window</span>
                <span>After-work run</span>
              </div>
            </div>

            <div className="justify-self-center">
              <div className="-rotate-2 border-[3px] border-[#11100D] bg-white p-3 shadow-[6px_7px_0_rgba(17,16,13,0.32)]">
                <QRCodeSVG
                  value={qrUrl}
                  data-testid="partner-flyer-qr"
                  size={216}
                  level="H"
                  marginSize={4}
                  bgColor="#FFFFFF"
                  fgColor="#11100D"
                />
              </div>
              <p className="mt-4 max-w-[2.25in] text-center font-heading text-sm font-black uppercase leading-tight tracking-[0.08em]">
                Open camera, scan, make the call
              </p>
            </div>
          </div>

          <div className="grid gap-4 border-t-[3px] border-[#11100D] pt-5 sm:grid-cols-[1fr_auto] sm:items-end">
            <p className="max-w-[5.8in] text-base font-semibold leading-snug">
              Quiver gives surfers a quick read on what matters: wave height,
              period, wind, tide, and session notes from the crew.
            </p>
            <p className="justify-self-start rounded-sm border-2 border-[#11100D] px-3 py-2 font-mono text-xs font-bold uppercase tracking-[0.12em] sm:justify-self-end">
              {code}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
