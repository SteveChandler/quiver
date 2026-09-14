import type { Metadata } from "next";
import Image from "next/image";
import { TrialFeedbackForm } from "./trial-feedback-form";

export const metadata: Metadata = { title: "Tell me how it went | Quiver", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default function TrialFeedbackPage(): React.ReactElement {
  return <main className="zine-tab min-h-screen bg-background px-5 py-12">
    <section className="mx-auto max-w-lg space-y-6 rounded-xl border border-[var(--ink)] bg-[var(--paper)] p-6 text-[var(--ink)] sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <p className="font-mono text-xs uppercase tracking-widest">A note from Steven</p>
        <Image src="/images/quiver-stickers/single-fin.png" width={72} height={72} className="h-auto w-[72px] shrink-0" alt="" />
      </div>
      <h1 className="font-heading text-3xl font-bold">Tell me how it went.</h1>
      <p>Thanks for giving Quiver a little time in your surf routine. Your honest feedback helps shape what comes next.</p>
      <TrialFeedbackForm enabled={process.env.TRIAL_FEEDBACK_ENABLED === "true"} />
    </section>
  </main>;
}
