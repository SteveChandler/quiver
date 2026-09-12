import * as React from "react";
import { createHash } from "node:crypto";
import { render } from "@react-email/render";
import { buildAppEmailLink, buildSessionEmailLink } from "@/lib/mailer/email-links";
import { LIFECYCLE_CAMPAIGN, type LifecycleDecision, type LifecycleJob } from "@/lib/email/lifecycle";
import type { QuiverStickerKey } from "@/lib/ui/quiver-sticker-assets";
import { LifecycleEmail } from "@/lib/mailer/templates/LifecycleEmail";

const COPY: Record<LifecycleJob, { subject: string; paragraphs: string[]; cta: string }> = {
  offer_ready: { subject: "Your Pro offer is ready", paragraphs: ["I built Quiver to help you make more of your time in the water.", "Your offer is saved on your Quiver account. Review it when you’re ready."], cta: "Review my Pro offer" },
  welcome: { subject: "Why I built Quiver", paragraphs: ["I built Quiver for the question before every surf: is it worth the drive?", "Save your home beach. Get the forecast. Make your call."], cta: "Check your beach" },
  activation: { subject: "Remember what the forecast felt like", paragraphs: ["The forecast is half the story. Your surf is the other half.", "Log your next session so you can look back on what worked."], cta: "Log a session" },
  progress: { subject: "Quiver remembers what works for you", paragraphs: ["Your session history is starting to take shape.", "Check the forecast. Surf. Tell Quiver how it matched. Your feedback helps your personal forecaster learn the conditions you love."], cta: "Log your next session" },
  friction: { subject: "What got in the way?", paragraphs: ["I’d love to know where Quiver fell short.", "What’s the one thing that made it hard to keep using?"], cta: "Reply to Steven" },
  trial_support: { subject: "Make the most of Quiver", paragraphs: ["Create a custom beach for the spot you surf.", "Set an alert for the conditions you want there.", "Log your surf and give forecast feedback. It helps tune your personal forecaster."], cta: "Open Quiver" },
  routine: { subject: "Does Quiver fit your surf routine?", paragraphs: ["You’ve been using Quiver for a few weeks now.", "How can we help Quiver fit into your routine, and what is still missing from the app that you’d like to see?"], cta: "Reply to Steven" },
};

const OFFER_COPY = {
  progress: "Five completed sessions = one calendar month of Pro on us. Previous sessions count. No payment or automatic renewal.",
  readyOne: "You’ve logged five completed sessions. One calendar month of Pro is on us.",
  readyThree: "I’d like to give you three calendar months of Quiver Pro on us.",
  acceptance: "Accept your gift in Quiver. It starts once added to your account. No payment or automatic renewal.",
};
const POSTAL_ADDRESS = "Quiver Surf Technologies · 2261 Market Street STE 10852, San Francisco, CA 94114";
const PERSONAL_COPY = {
  activation: "Log your next surf and give forecast feedback. It helps tune your personal forecaster.",
  progress: "Check the forecast. Surf. Tell Quiver how it matched. Your feedback helps your personal forecaster learn the conditions you love.",
};
const VISUALS: Record<LifecycleJob, { sticker: QuiverStickerKey; eyebrow: string }> = {
  welcome: { sticker: "breakingWave", eyebrow: "A note from Steven" },
  activation: { sticker: "surfWax", eyebrow: "From forecast to water" },
  progress: { sticker: "singleFin", eyebrow: "Keep the loop going" },
  friction: { sticker: "creamCoastMap", eyebrow: "Let’s find your way" },
  trial_support: { sticker: "orangeMap", eyebrow: "Your spot. Your forecast." },
  routine: { sticker: "singleFin", eyebrow: "Room for your routine" },
  offer_ready: { sticker: "breakingWave", eyebrow: "This one’s on us" },
};
// Variant copy participates in approval just like the base messages.
export const LIFECYCLE_CONTENT_HASH = createHash("sha256").update(JSON.stringify({ copy: COPY, offerCopy: OFFER_COPY, personalCopy: PERSONAL_COPY, visuals: VISUALS, postalAddress: POSTAL_ADDRESS, layout: "LifecycleEmail-v4-stickers-postal-footer", links: "app-session-offers-v2" })).digest("hex");

export async function renderLifecycleEmail(decision: LifecycleDecision, attemptId: string, origin: string, replyTo: string, unsubscribeUrl: string): Promise<{ subject: string; html: string; text: string }> {
  if (!decision.job || !decision.source) throw new Error("Missing lifecycle content source");
  if (decision.job === "offer_ready" && (!decision.source.offer_id || !decision.source.offer_months || (decision.source.offer_months === 1 && decision.source.sessions < 5))) throw new Error("Missing earned offer evidence");
  const promotional = decision.source.audience === "free";
  if (decision.job === "offer_ready" && !promotional) throw new Error("Offers require a verified free audience");
  const copy = COPY[decision.job];
  const attribution = { origin, emailType: decision.job, messageInstanceId: attemptId, utmCampaign: LIFECYCLE_CAMPAIGN };
  const reply = decision.job === "friction" || decision.job === "routine";
  const session = decision.job === "activation" || decision.job === "progress";
  const ctaHref = decision.job === "offer_ready" ? `${origin}/offers/claim?message_instance_id=${encodeURIComponent(attemptId)}&utm_campaign=${LIFECYCLE_CAMPAIGN}` : reply ? `mailto:${replyTo}?subject=${encodeURIComponent(copy.subject)}` : session
    ? buildSessionEmailLink(attribution)
    : buildAppEmailLink({ ...attribution, params: decision.job === "welcome" && !decision.source.home_beach_id ? { onboarding: "required" } : undefined });
  const ctaLabel = decision.job === "welcome" && !decision.source.home_beach_id ? "Choose your home beach" : copy.cta;
  let paragraphs = decision.job === "progress" ? [`You’ve logged ${decision.source.sessions} completed session${decision.source.sessions === 1 ? "" : "s"} in Quiver.`, ...copy.paragraphs.slice(1)] : [...copy.paragraphs];
  if ((decision.job === "activation" || decision.job === "progress") && decision.source.audience === "entitled") paragraphs[1] = PERSONAL_COPY[decision.job];
  if (promotional && (decision.job === "progress" || decision.job === "activation") && decision.source.offer_id && decision.source.offer_months === 1) paragraphs.push(OFFER_COPY.progress);
  if (decision.job === "offer_ready") paragraphs = [decision.source.offer_months === 1 ? OFFER_COPY.readyOne : OFFER_COPY.readyThree, OFFER_COPY.acceptance];
  return {
    subject: copy.subject,
    html: await render(<LifecycleEmail headline={copy.subject} paragraphs={paragraphs} ctaLabel={ctaLabel} ctaHref={ctaHref} unsubscribeUrl={unsubscribeUrl} postalAddress={POSTAL_ADDRESS} {...VISUALS[decision.job]} checklist={decision.job === "trial_support"} />),
    text: [...paragraphs, `${ctaLabel}: ${ctaHref}`, "— Steven, founder of Quiver", POSTAL_ADDRESS, `Unsubscribe: ${unsubscribeUrl}`].join("\n\n"),
  };
}
