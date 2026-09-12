import * as React from "react";
import { createHash } from "node:crypto";
import { render } from "@react-email/render";
import { buildAppEmailLink, buildSessionEmailLink } from "@/lib/mailer/email-links";
import { LIFECYCLE_CAMPAIGN, type LifecycleDecision, type LifecycleJob } from "@/lib/email/lifecycle";
import { LifecycleEmail } from "@/lib/mailer/templates/LifecycleEmail";

const COPY: Record<LifecycleJob, { subject: string; paragraphs: string[]; cta: string }> = {
  offer_ready: { subject: "Your Pro offer is ready", paragraphs: ["I built Quiver to help you make more of your time in the water.", "Your offer is saved on your Quiver account. Review it when you’re ready."], cta: "Review my Pro offer" },
  welcome: { subject: "Why I built Quiver", paragraphs: ["I built Quiver for that moment before a surf: you’re looking at conditions and deciding whether it’s worth the drive.", "Start with your home beach. Quiver brings the forecast together so you can make your own call."], cta: "Check your beach" },
  activation: { subject: "Remember what the forecast felt like", paragraphs: ["A forecast is one part of the story. What you actually surfed is the other.", "After your next surf, log a session in Quiver so you have that day to look back on."], cta: "Log a session" },
  progress: { subject: "One more day to look back on", paragraphs: ["Your session history is starting to take shape.", "After your next surf, add what happened. Over time, those days become a useful record of your own routine."], cta: "Log your next session" },
  friction: { subject: "What got in the way?", paragraphs: ["You gave Quiver a try, and I’d like to understand where it fell short.", "What’s the one thing that made it hard to keep using?"], cta: "Reply to Steven" },
  trial_support: { subject: "Make your trial useful", paragraphs: ["I built Quiver to help with a real decision: where and when to surf.", "Your trial is active. Start with the forecast for a beach you know and use it to plan your next check of the conditions."], cta: "Open Quiver" },
  routine: { subject: "Does Quiver fit your surf routine?", paragraphs: ["You’ve been using Quiver for a few weeks now.", "Where does it fit into your surf routine—and where is it still missing something?"], cta: "Reply to Steven" },
};

const OFFER_COPY = {
  progress: "Log five completed sessions and get one calendar month of Pro on us. Your previous completed sessions count. No payment or automatic renewal. If you already have access, your reward waits until it ends.",
  readyOne: "You’ve logged five completed sessions. One calendar month of Pro is on us.",
  readyThree: "If you’d like to give Quiver another go, three calendar months of Pro are on us.",
  acceptance: "Review and accept the offer on your account. Your access starts when it is fulfilled. No payment or automatic renewal.",
};
// Variant copy participates in approval just like the base messages.
export const LIFECYCLE_CONTENT_HASH = createHash("sha256").update(JSON.stringify({ copy: COPY, offerCopy: OFFER_COPY, layout: "LifecycleEmail-v1", links: "app-session-offers-v2" })).digest("hex");

export async function renderLifecycleEmail(decision: LifecycleDecision, attemptId: string, origin: string, replyTo: string, unsubscribeUrl: string): Promise<{ subject: string; html: string; text: string }> {
  if (!decision.job || !decision.source) throw new Error("Missing lifecycle content source");
  if (decision.job === "offer_ready" && (!decision.source.offer_id || !decision.source.offer_months || (decision.source.offer_months === 1 && decision.source.sessions < 5))) throw new Error("Missing earned offer evidence");
  const copy = COPY[decision.job];
  const attribution = { origin, emailType: decision.job, messageInstanceId: attemptId, utmCampaign: LIFECYCLE_CAMPAIGN };
  const reply = decision.job === "friction" || decision.job === "routine";
  const session = decision.job === "activation" || decision.job === "progress";
  const ctaHref = decision.job === "offer_ready" ? `${origin}/offers/claim?message_instance_id=${encodeURIComponent(attemptId)}&utm_campaign=${LIFECYCLE_CAMPAIGN}` : reply ? `mailto:${replyTo}?subject=${encodeURIComponent(copy.subject)}` : session
    ? buildSessionEmailLink(attribution)
    : buildAppEmailLink({ ...attribution, params: decision.job === "welcome" && !decision.source.home_beach_id ? { onboarding: "required" } : undefined });
  const ctaLabel = decision.job === "welcome" && !decision.source.home_beach_id ? "Choose your home beach" : copy.cta;
  let paragraphs = decision.job === "progress" ? [`You’ve logged ${decision.source.sessions} completed session${decision.source.sessions === 1 ? "" : "s"} in Quiver.`, ...copy.paragraphs.slice(1)] : [...copy.paragraphs];
  if ((decision.job === "progress" || decision.job === "activation") && decision.source.offer_id && decision.source.offer_months === 1) paragraphs.push(OFFER_COPY.progress);
  if (decision.job === "offer_ready") paragraphs = [decision.source.offer_months === 1 ? OFFER_COPY.readyOne : OFFER_COPY.readyThree, OFFER_COPY.acceptance];
  return {
    subject: copy.subject,
    html: await render(<LifecycleEmail headline={copy.subject} paragraphs={paragraphs} ctaLabel={ctaLabel} ctaHref={ctaHref} unsubscribeUrl={unsubscribeUrl} />),
    text: [...paragraphs, `${ctaLabel}: ${ctaHref}`, "— Steven, founder of Quiver", `Unsubscribe: ${unsubscribeUrl}`].join("\n\n"),
  };
}
