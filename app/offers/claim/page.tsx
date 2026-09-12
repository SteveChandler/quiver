import type { Metadata } from "next";
import { OwnedOffers } from "./owned-offers";
import { OfferClaimForm } from "./claim-form";

export const metadata: Metadata = { title: "Claim your Quiver Pro offer", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default function OfferClaimPage(): React.ReactElement {
  return <div className="zine-tab min-h-screen bg-background px-5 py-16">
    <section className="mx-auto max-w-md space-y-6 rounded-xl border border-[var(--ink)] bg-[var(--paper)] p-6 text-[var(--ink)] shadow-sm">
      <p className="font-mono text-sm uppercase tracking-widest">Quiver / On us</p>
      <h1 className="font-heading text-3xl font-bold">A little more time in the water.</h1>
      <p>Your available rewards are saved on your Quiver account. You can also enter an offer code you received. This offer creates no subscription and does not renew automatically.</p>
      <p className="text-sm">For the five-session offer, historical completed sessions count. Planned and deleted sessions do not. If you already have Pro or a trial, your reward stays available for later.</p>
      <OwnedOffers enabled={process.env.PRO_OFFERS_ENABLED === "true"} />
      <details open={process.env.PRO_OFFERS_ENABLED !== "true"} className="space-y-4"><summary className="cursor-pointer py-3 underline">I have an offer code</summary><OfferClaimForm enabled={process.env.PRO_OFFERS_ENABLED === "true"} /></details>
    </section>
  </div>;
}
