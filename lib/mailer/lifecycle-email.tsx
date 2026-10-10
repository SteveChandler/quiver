import * as React from "react";
import { createHash } from "node:crypto";
import { render } from "@react-email/render";
import { buildAppEmailLink, buildSessionEmailLink } from "@/lib/mailer/email-links";
import { LIFECYCLE_CAMPAIGN, type LifecycleDecision, type LifecycleJob } from "@/lib/email/lifecycle";
import type { QuiverStickerKey } from "@/lib/ui/quiver-sticker-assets";
import { LifecycleEmail } from "@/lib/mailer/templates/LifecycleEmail";

const COPY: Record<Exclude<LifecycleJob, "trial_feedback">, { subject: string; paragraphs: string[]; cta: string }> = {
  offer_ready: { subject: "Some Pro, on me", paragraphs: ["It’s saved on your Quiver account.", "Add it whenever you’re ready."], cta: "Add my Pro" },
  welcome: { subject: "Why I built Quiver", paragraphs: ["I built Quiver because I wanted to know whether a surf was worth the drive before I got in the car.", "Pick your home beach and Quiver will tell you if it’s worth going."], cta: "Check your beach" },
  activation: { subject: "How was your last surf?", paragraphs: ["When you log a session, Quiver keeps that day’s conditions with it.", "Log a few and you can look back at which days were actually good."], cta: "Log a session" },
  progress: { subject: "Your surf log is filling up", paragraphs: ["You’ve logged a few sessions in Quiver.", "Keep rating them. Your ratings teach Quiver what a good day looks like for you."], cta: "Log your next session" },
  friction: { subject: "What got in the way?", paragraphs: ["Haven’t seen you in Quiver for a bit.", "If something was confusing or just wrong, I’d like to hear about it. Reply with whatever comes to mind, even one line."], cta: "Reply to Steve" },
  trial_support: { subject: "A few things to set up first", paragraphs: ["Add the spot you actually surf, even if it isn’t on the map yet.", "Set an alert for the conditions you want there.", "Log your surfs and rate them, so Quiver knows what a good day looks like for you."], cta: "Open Quiver" },
  routine: { subject: "What’s missing?", paragraphs: ["You’ve had Quiver for a few weeks now.", "If there’s something you keep wishing it did, tell me. I’m picking what to build next."], cta: "Reply to Steve" },
};

const OFFER_COPY = {
  progress: "Five logged sessions gets you a month of Pro on me. Sessions you’ve already logged count, and nothing renews.",
  readyOne: "You’ve logged five sessions, so your next month of Pro is on me.",
  readyThree: "I’d like to give you three months of Quiver Pro, on me.",
  acceptance: "Tap below to add it. Nothing to pay, and nothing renews.",
};
const FEEDBACK_COPY = { subject: "Why’d you cancel?", paragraphs: ["No hard feelings at all.", "I’m still building Quiver, and I’d like to know what didn’t work for you. It’s two quick questions."], cta: "Tell me how it went" };
const FEEDBACK_VISUAL = { sticker: "singleFin" as const, eyebrow: "A note from Steve" };
const POSTAL_ADDRESS = "Quiver Surf Technologies · 2261 Market Street STE 10852, San Francisco, CA 94114";
const PERSONAL_COPY = {
  activation: "After you surf, tell Quiver how it went. Your ratings teach it what a good day looks like for you.",
  progress: "Keep rating your surfs. Your ratings teach Quiver what a good day looks like for you.",
};
const VISUALS: Record<Exclude<LifecycleJob, "trial_feedback">, { sticker: QuiverStickerKey; eyebrow: string }> = {
  welcome: { sticker: "breakingWave", eyebrow: "A note from Steve" },
  activation: { sticker: "surfWax", eyebrow: "Your surf log" },
  progress: { sticker: "singleFin", eyebrow: "Your surf log" },
  friction: { sticker: "creamCoastMap", eyebrow: "A note from Steve" },
  trial_support: { sticker: "orangeMap", eyebrow: "Getting set up" },
  routine: { sticker: "singleFin", eyebrow: "A note from Steve" },
  offer_ready: { sticker: "breakingWave", eyebrow: "A note from Steve" },
};
// Variant copy participates in approval just like the base messages.
export const LIFECYCLE_CONTENT_HASH = createHash("sha256").update(JSON.stringify({ copy: COPY, offerCopy: OFFER_COPY, personalCopy: PERSONAL_COPY, visuals: VISUALS, postalAddress: POSTAL_ADDRESS, layout: "LifecycleEmail-v5-steve-signoff", links: "app-session-offers-v2", ...(process.env.TRIAL_FEEDBACK_ENABLED === "true" ? { trialFeedback: { copy: FEEDBACK_COPY, visual: FEEDBACK_VISUAL, path: "/trial-feedback", version: 1 } } : {}) })).digest("hex");

export async function renderLifecycleEmail(decision: LifecycleDecision, attemptId: string, origin: string, replyTo: string, unsubscribeUrl: string): Promise<{ subject: string; html: string; text: string }> {
  if (!decision.job || !decision.source) throw new Error("Missing lifecycle content source");
  if (decision.job === "offer_ready" && (!decision.source.offer_id || !decision.source.offer_months || (decision.source.offer_months === 1 && decision.source.sessions < 5))) throw new Error("Missing earned offer evidence");
  const promotional = decision.source.audience === "free";
  if (decision.job === "offer_ready" && !promotional) throw new Error("Offers require a verified free audience");
  const copy = decision.job === "trial_feedback" ? FEEDBACK_COPY : COPY[decision.job];
  const attribution = { origin, emailType: decision.job, messageInstanceId: attemptId, utmCampaign: LIFECYCLE_CAMPAIGN };
  const reply = decision.job === "friction" || decision.job === "routine";
  const session = decision.job === "activation" || decision.job === "progress";
  const ctaHref = decision.job === "trial_feedback" ? `${origin}/trial-feedback?message_instance_id=${encodeURIComponent(attemptId)}` : decision.job === "offer_ready" ? `${origin}/offers/claim?message_instance_id=${encodeURIComponent(attemptId)}&utm_campaign=${LIFECYCLE_CAMPAIGN}` : reply ? `mailto:${replyTo}?subject=${encodeURIComponent(copy.subject)}` : session
    ? buildSessionEmailLink(attribution)
    : buildAppEmailLink({ ...attribution, params: decision.job === "welcome" && !decision.source.home_beach_id ? { onboarding: "required" } : undefined });
  const ctaLabel = decision.job === "welcome" && !decision.source.home_beach_id ? "Choose your home beach" : copy.cta;
  let paragraphs = decision.job === "progress" ? [`You’ve logged ${decision.source.sessions} completed session${decision.source.sessions === 1 ? "" : "s"} in Quiver.`, ...copy.paragraphs.slice(1)] : [...copy.paragraphs];
  if ((decision.job === "activation" || decision.job === "progress") && decision.source.audience === "entitled") paragraphs[1] = PERSONAL_COPY[decision.job];
  if (promotional && (decision.job === "progress" || decision.job === "activation") && decision.source.offer_id && decision.source.offer_months === 1) paragraphs.push(OFFER_COPY.progress);
  if (decision.job === "offer_ready") paragraphs = [decision.source.offer_months === 1 ? OFFER_COPY.readyOne : OFFER_COPY.readyThree, OFFER_COPY.acceptance];
  return {
    subject: copy.subject,
    html: await render(<LifecycleEmail headline={copy.subject} paragraphs={paragraphs} ctaLabel={ctaLabel} ctaHref={ctaHref} unsubscribeUrl={unsubscribeUrl} postalAddress={POSTAL_ADDRESS} {...(decision.job === "trial_feedback" ? FEEDBACK_VISUAL : VISUALS[decision.job])} checklist={decision.job === "trial_support"} />),
    text: [...paragraphs, `${ctaLabel}: ${ctaHref}`, "Steve, Quiver", POSTAL_ADDRESS, `Unsubscribe: ${unsubscribeUrl}`].join("\n\n"),
  };
}
