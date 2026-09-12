import * as React from "react";
import { EmailShell, Wordmark, CTAButton } from "@/lib/mailer/components";
import { CREAM, PAPER_INK, FONT_BODY, FONT_DISPLAY } from "@/lib/mailer/theme";

interface LifecycleEmailProps {
  headline: string;
  paragraphs: readonly string[];
  ctaLabel: string;
  ctaHref: string;
  unsubscribeUrl: string;
}

export function LifecycleEmail(props: LifecycleEmailProps): React.ReactElement {
  return <EmailShell>
    <Wordmark />
    <tr><td style={{ backgroundColor: CREAM, color: PAPER_INK, padding: "28px 24px", overflowWrap: "anywhere" }}>
      <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 27, lineHeight: 1.2, margin: "0 0 20px" }}>{props.headline}</h1>
      {props.paragraphs.map(paragraph => <p key={paragraph} style={{ fontFamily: FONT_BODY, fontSize: 16, lineHeight: 1.6, margin: "0 0 16px" }}>{paragraph}</p>)}
      <p style={{ margin: "24px 0" }}><CTAButton href={props.ctaHref}>{props.ctaLabel}</CTAButton></p>
      <p style={{ fontSize: 16, margin: "24px 0 0" }}>— Steven, founder of Quiver</p>
      <p style={{ fontSize: 13, lineHeight: 1.5, margin: "28px 0 0" }}>You opted in to Quiver lifecycle emails. <a href={props.unsubscribeUrl} style={{ color: PAPER_INK, textDecoration: "underline" }}>Unsubscribe</a></p>
    </td></tr>
  </EmailShell>;
}
